// No-show risk model. Predicts the probability that an assignment ends in
// a no-show or substitute-side cancellation, given the substitute's history
// and the assignment's lead time + neighborhood/availability fit.

import { query } from '../db/pool';
import {
  AssignmentRow,
  KindergartenRow,
  NO_SHOW_FEATURE_NAMES,
  SubstituteRow,
  noShowFeatures,
  noShowLabel,
  summarizeSubstituteHistory,
} from './features';
import { LogRegModel, predictProba, rocAuc, trainLogReg } from './logreg';
import { saveModel } from './modelStore';

export interface NoShowTrainingResult {
  samples: number;
  positives: number;
  auc: number;
}

export async function trainNoShowModel(authorityId: string): Promise<{ model: LogRegModel; result: NoShowTrainingResult }> {
  // Pull all assignments for the authority, ordered by date, so we can build
  // an *as-of* substitute history (no leakage from future assignments).
  const r = await query(
    `SELECT a.id, a.substitute_id, a.kindergarten_id, a.assignment_date, a.status,
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
      ORDER BY a.assignment_date ASC, a.created_at ASC`,
    [authorityId],
  );

  const historyBySub = new Map<string, AssignmentRow[]>();
  const X: number[][] = [];
  const y: number[] = [];

  for (const row of r.rows) {
    const dateStr = typeof row.assignment_date === 'string'
      ? row.assignment_date
      : new Date(row.assignment_date).toISOString().slice(0, 10);
    const a: AssignmentRow = {
      id: row.id,
      substitute_id: row.substitute_id,
      kindergarten_id: row.kindergarten_id,
      assignment_date: dateStr,
      status: row.status,
      rating: row.rating != null ? Number(row.rating) : null,
      cancellation_reason: row.cancellation_reason,
      hours_worked: row.hours_worked != null ? Number(row.hours_worked) : null,
      created_at: row.created_at,
    };

    // Skip pure pending/in-flight rows from training (no resolved label yet).
    if (a.status === 'pending' || a.status === 'confirmed') continue;

    const subKey = a.substitute_id;
    const prior = historyBySub.get(subKey) ?? [];
    const history = summarizeSubstituteHistory(prior);

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

    X.push(noShowFeatures(sub, kg, dateStr, new Date(a.created_at), history));
    y.push(noShowLabel(a));

    historyBySub.set(subKey, [...prior, a]);
  }

  // Cold-start handling
  if (X.length < 10 || y.every(v => v === 0)) {
    // Conservative prior: short lead time + no history → mild risk.
    const prior: LogRegModel = {
      featureNames: NO_SHOW_FEATURE_NAMES,
      // [lead_hours, sub_rating, total_assignments_log, years_experience,
      //  neighborhood_match, day_available, no_show_rate, cancellation_rate]
      weights: [-0.4, -0.5, -0.3, -0.2, -0.3, -0.4, 2.0, 1.5],
      bias: -2.0,
      mean: new Array(NO_SHOW_FEATURE_NAMES.length).fill(0),
      std: new Array(NO_SHOW_FEATURE_NAMES.length).fill(1),
    };
    await saveModel(authorityId, 'no_show', prior, {
      trainingSamples: X.length,
      metricName: 'auc',
      metricValue: 0.5,
      featureNames: NO_SHOW_FEATURE_NAMES,
    });
    return { model: prior, result: { samples: X.length, positives: y.filter(v => v === 1).length, auc: 0.5 } };
  }

  const model = trainLogReg(X, y, NO_SHOW_FEATURE_NAMES, { epochs: 300, learningRate: 0.1, l2: 0.02 });
  const scores = X.map(row => predictProba(model, row));
  const auc = rocAuc(y, scores);

  await saveModel(authorityId, 'no_show', model, {
    trainingSamples: X.length,
    metricName: 'auc',
    metricValue: auc,
    featureNames: NO_SHOW_FEATURE_NAMES,
  });

  return { model, result: { samples: X.length, positives: y.filter(v => v === 1).length, auc } };
}

export async function predictNoShowRisk(
  authorityId: string,
  assignmentId: string,
  model?: LogRegModel,
): Promise<{ score: number; band: 'low' | 'medium' | 'high'; features: Record<string, number> } | null> {
  const r = await query(
    `SELECT a.id, a.substitute_id, a.kindergarten_id, a.assignment_date, a.status,
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
      WHERE a.id = $1 AND k.authority_id = $2`,
    [assignmentId, authorityId],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const dateStr = typeof row.assignment_date === 'string'
    ? row.assignment_date
    : new Date(row.assignment_date).toISOString().slice(0, 10);

  const histRes = await query(
    `SELECT a.id, a.substitute_id, a.kindergarten_id, a.assignment_date, a.status,
            a.rating, a.cancellation_reason, a.hours_worked, a.created_at
       FROM assignments a
      WHERE a.substitute_id = $1 AND a.created_at < $2`,
    [row.substitute_id, row.created_at],
  );
  const history = summarizeSubstituteHistory(histRes.rows.map(h => ({
    id: h.id, substitute_id: h.substitute_id, kindergarten_id: h.kindergarten_id,
    assignment_date: typeof h.assignment_date === 'string' ? h.assignment_date : new Date(h.assignment_date).toISOString().slice(0, 10),
    status: h.status,
    rating: h.rating != null ? Number(h.rating) : null,
    cancellation_reason: h.cancellation_reason,
    hours_worked: h.hours_worked != null ? Number(h.hours_worked) : null,
    created_at: h.created_at,
  })));

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

  const feats = noShowFeatures(sub, kg, dateStr, new Date(row.created_at), history);

  let useModel = model;
  if (!useModel) {
    const m = await query(
      `SELECT params FROM ml_models WHERE authority_id = $1 AND kind = 'no_show'`,
      [authorityId],
    );
    if (m.rows.length > 0) useModel = m.rows[0].params as LogRegModel;
  }

  const score = useModel
    ? predictProba(useModel, feats)
    : (history.totalCount > 0
        ? (history.noShowCount + history.cancellationCount) / history.totalCount
        : 0.1);

  const band: 'low' | 'medium' | 'high' = score >= 0.5 ? 'high' : score >= 0.2 ? 'medium' : 'low';
  const featureMap: Record<string, number> = {};
  NO_SHOW_FEATURE_NAMES.forEach((n, i) => { featureMap[n] = feats[i]; });
  return { score, band, features: featureMap };
}
