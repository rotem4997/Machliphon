// Substitute recommender. Trains a logistic-regression "match probability"
// model per authority using historical assignment outcomes, then ranks live
// candidates for a new (kindergarten, date) request.

import { query } from '../db/pool';
import {
  AssignmentRow,
  KindergartenRow,
  MATCH_FEATURE_NAMES,
  SubstituteRow,
  matchFeatures,
  matchLabel,
} from './features';
import { LogRegModel, predictProba, rocAuc, trainLogReg } from './logreg';
import { saveModel } from './modelStore';

export interface RecommendationEntry {
  substituteId: string;
  userId: string;
  fullName: string;
  score: number;        // 0..1
  reasons: string[];    // Hebrew, human-readable
  features: Record<string, number>;
}

export interface MatchTrainingResult {
  samples: number;
  positives: number;
  auc: number;
}

// === Training === //
export async function trainMatchModel(authorityId: string): Promise<{ model: LogRegModel; result: MatchTrainingResult }> {
  // Pull historical assignments (only those that reached a terminal status).
  const r = await query(
    `SELECT
        a.id, a.substitute_id, a.kindergarten_id, a.assignment_date, a.status,
        a.rating, a.cancellation_reason, a.hours_worked, a.created_at,
        s.id AS s_id, s.authority_id AS s_authority,
        s.neighborhood AS s_neighborhood, s.preferred_neighborhoods,
        s.available_days, s.max_distance_km, s.rating AS s_rating,
        s.total_assignments, s.years_experience, s.education_level,
        s.work_permit_valid, s.status AS s_status,
        k.neighborhood AS k_neighborhood, k.age_group
       FROM assignments a
       JOIN substitutes s ON s.id = a.substitute_id
       JOIN kindergartens k ON k.id = a.kindergarten_id
      WHERE k.authority_id = $1
        AND a.status IN ('completed','arrived','confirmed','cancelled','no_show')`,
    [authorityId],
  );

  const X: number[][] = [];
  const y: number[] = [];
  for (const row of r.rows) {
    const sub: SubstituteRow = {
      id: row.s_id,
      authority_id: row.s_authority,
      neighborhood: row.s_neighborhood,
      preferred_neighborhoods: row.preferred_neighborhoods ?? [],
      available_days: row.available_days ?? [],
      max_distance_km: row.max_distance_km,
      rating: row.s_rating != null ? Number(row.s_rating) : 0,
      total_assignments: row.total_assignments,
      years_experience: row.years_experience,
      education_level: row.education_level,
      work_permit_valid: row.work_permit_valid,
      status: row.s_status,
    };
    const kg: KindergartenRow = {
      id: row.kindergarten_id,
      neighborhood: row.k_neighborhood,
      age_group: row.age_group,
    };
    const a: AssignmentRow = {
      id: row.id,
      substitute_id: row.substitute_id,
      kindergarten_id: row.kindergarten_id,
      assignment_date: typeof row.assignment_date === 'string'
        ? row.assignment_date
        : new Date(row.assignment_date).toISOString().slice(0, 10),
      status: row.status,
      rating: row.rating != null ? Number(row.rating) : null,
      cancellation_reason: row.cancellation_reason,
      hours_worked: row.hours_worked != null ? Number(row.hours_worked) : null,
      created_at: row.created_at,
    };
    X.push(matchFeatures(sub, kg, a.assignment_date));
    y.push(matchLabel(a));
  }

  // Cold-start: with no history, return a "prior" model that mostly relies on
  // rating + permit + neighborhood. We bake that in as fixed weights so the
  // recommender still gives reasonable answers from day one.
  if (X.length < 10) {
    const fallback: LogRegModel = {
      featureNames: MATCH_FEATURE_NAMES,
      // Rough hand-tuned prior — emphasizes rating + permit + neighborhood + availability.
      weights: [0.6, 0.2, 0.2, 1.5, 1.2, 0.8, 0.2, 0.5],
      bias: -1.0,
      mean: new Array(MATCH_FEATURE_NAMES.length).fill(0),
      std: new Array(MATCH_FEATURE_NAMES.length).fill(1),
    };
    await saveModel(authorityId, 'match', fallback, {
      trainingSamples: X.length,
      metricName: 'auc',
      metricValue: 0.5,
      featureNames: MATCH_FEATURE_NAMES,
    });
    return { model: fallback, result: { samples: X.length, positives: y.filter(v => v === 1).length, auc: 0.5 } };
  }

  const model = trainLogReg(X, y, MATCH_FEATURE_NAMES, { epochs: 300, learningRate: 0.1, l2: 0.02 });
  const scores = X.map(row => predictProba(model, row));
  const auc = rocAuc(y, scores);

  await saveModel(authorityId, 'match', model, {
    trainingSamples: X.length,
    metricName: 'auc',
    metricValue: auc,
    featureNames: MATCH_FEATURE_NAMES,
  });

  return { model, result: { samples: X.length, positives: y.filter(v => v === 1).length, auc } };
}

// === Inference === //
export async function recommendSubstitutes(
  authorityId: string,
  kindergartenId: string,
  dateStr: string,
  topK = 10,
  model?: LogRegModel,
): Promise<RecommendationEntry[]> {
  const kgRes = await query(
    `SELECT id, neighborhood, age_group FROM kindergartens
      WHERE id = $1 AND authority_id = $2 AND is_active = true`,
    [kindergartenId, authorityId],
  );
  if (kgRes.rows.length === 0) return [];
  const kg: KindergartenRow = kgRes.rows[0];

  // Pull eligible substitutes — active, valid permit, no conflict on date.
  const subsRes = await query(
    `SELECT s.id, s.authority_id, s.neighborhood, s.preferred_neighborhoods,
            s.available_days, s.max_distance_km, s.rating, s.total_assignments,
            s.years_experience, s.education_level, s.work_permit_valid, s.status,
            u.id AS user_id, u.first_name, u.last_name
       FROM substitutes s
       JOIN users u ON u.id = s.user_id
      WHERE s.authority_id = $1
        AND s.status = 'active'
        AND s.work_permit_valid = true
        AND NOT EXISTS (
          SELECT 1 FROM assignments a
           WHERE a.substitute_id = s.id
             AND a.assignment_date = $2
             AND a.status NOT IN ('cancelled')
        )`,
    [authorityId, dateStr],
  );

  // Lazy-load: caller may pass model in, otherwise fetch latest snapshot.
  let useModel = model;
  if (!useModel) {
    const r = await query(
      `SELECT params FROM ml_models WHERE authority_id = $1 AND kind = 'match'`,
      [authorityId],
    );
    if (r.rows.length > 0) {
      useModel = r.rows[0].params as LogRegModel;
    }
  }

  // If still no model (truly cold), fall back to a deterministic ranking.
  const fallbackScore = (sub: SubstituteRow): number => {
    const r = (sub.rating ?? 0) / 5;                // 0..1
    const exp = Math.min((sub.years_experience ?? 0) / 10, 1);
    const nb = sub.neighborhood === kg.neighborhood ? 1 : 0;
    return 0.5 * r + 0.2 * exp + 0.3 * nb;
  };

  const recs: RecommendationEntry[] = subsRes.rows.map(row => {
    const sub: SubstituteRow = {
      id: row.id,
      authority_id: row.authority_id,
      neighborhood: row.neighborhood,
      preferred_neighborhoods: row.preferred_neighborhoods ?? [],
      available_days: row.available_days ?? [],
      max_distance_km: row.max_distance_km,
      rating: row.rating != null ? Number(row.rating) : 0,
      total_assignments: row.total_assignments,
      years_experience: row.years_experience,
      education_level: row.education_level,
      work_permit_valid: row.work_permit_valid,
      status: row.status,
    };
    const feats = matchFeatures(sub, kg, dateStr);
    const score = useModel ? predictProba(useModel, feats) : fallbackScore(sub);

    const reasons: string[] = [];
    if (sub.neighborhood === kg.neighborhood) reasons.push('שכונה תואמת');
    else if (sub.preferred_neighborhoods?.includes(kg.neighborhood ?? '')) reasons.push('שכונה מועדפת');
    if ((sub.rating ?? 0) >= 4) reasons.push(`דירוג גבוה (${(sub.rating ?? 0).toFixed(1)})`);
    if ((sub.years_experience ?? 0) >= 5) reasons.push(`ותק (${sub.years_experience} שנים)`);
    if (feats[MATCH_FEATURE_NAMES.indexOf('available_on_day')] === 1) reasons.push('זמינה ביום זה');

    const featureMap: Record<string, number> = {};
    MATCH_FEATURE_NAMES.forEach((n, i) => { featureMap[n] = feats[i]; });

    return {
      substituteId: row.id,
      userId: row.user_id,
      fullName: `${row.first_name} ${row.last_name}`,
      score,
      reasons,
      features: featureMap,
    };
  });

  recs.sort((a, b) => b.score - a.score);
  return recs.slice(0, topK);
}
