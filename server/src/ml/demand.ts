// Demand-forecast model. Predicts how many absences a kindergarten will report
// per day going forward. Useful for staffing buffers and trend dashboards.

import { query } from '../db/pool';
import {
  DemandModel,
  DemandSeries,
  predictDemand,
  trainDemandModel,
} from './features';
import { saveModel } from './modelStore';

export interface DemandTrainingResult {
  kindergartens: number;
  totalSamples: number;
  metric: number;     // mean absolute error on held-out last week
}

interface AuthorityDemandModel {
  perKg: Record<string, DemandModel>;
  // Authority-wide baseline used as a fallback for new kindergartens.
  baseline: DemandModel;
}

function backfillSeries(series: DemandSeries, from: Date, to: Date): DemandSeries {
  // Make sure missing days count as zero so day-of-week averages are honest.
  const filled = new Map(series.counts);
  const cur = new Date(from);
  while (cur <= to) {
    const k = cur.toISOString().slice(0, 10);
    if (!filled.has(k)) filled.set(k, 0);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return { kindergartenId: series.kindergartenId, counts: filled };
}

export async function trainDemandModels(authorityId: string): Promise<{
  model: AuthorityDemandModel;
  result: DemandTrainingResult;
}> {
  const r = await query(
    `SELECT ar.kindergarten_id, ar.absence_date, COUNT(*)::int AS n
       FROM absence_reports ar
       JOIN kindergartens k ON k.id = ar.kindergarten_id
      WHERE k.authority_id = $1
        AND ar.absence_date >= CURRENT_DATE - INTERVAL '180 days'
      GROUP BY ar.kindergarten_id, ar.absence_date`,
    [authorityId],
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const trainingEnd = new Date(today);
  trainingEnd.setUTCDate(trainingEnd.getUTCDate() - 7);
  const trainingStart = new Date(trainingEnd);
  trainingStart.setUTCDate(trainingStart.getUTCDate() - 173); // ~180-7 days

  const seriesByKg = new Map<string, DemandSeries>();
  const heldOutByKg = new Map<string, Map<string, number>>();

  for (const row of r.rows) {
    const dateStr = typeof row.absence_date === 'string'
      ? row.absence_date
      : new Date(row.absence_date).toISOString().slice(0, 10);
    const d = new Date(dateStr + 'T00:00:00Z');
    const inTraining = d <= trainingEnd;
    const inHoldout = d > trainingEnd && d <= today;

    if (inTraining) {
      const s = seriesByKg.get(row.kindergarten_id) ?? { kindergartenId: row.kindergarten_id, counts: new Map() };
      s.counts.set(dateStr, (s.counts.get(dateStr) ?? 0) + Number(row.n));
      seriesByKg.set(row.kindergarten_id, s);
    } else if (inHoldout) {
      const m = heldOutByKg.get(row.kindergarten_id) ?? new Map<string, number>();
      m.set(dateStr, (m.get(dateStr) ?? 0) + Number(row.n));
      heldOutByKg.set(row.kindergarten_id, m);
    }
  }

  // Build authority-wide series for the fallback baseline.
  const baseline: DemandSeries = { kindergartenId: '__authority__', counts: new Map() };
  for (const s of seriesByKg.values()) {
    for (const [k, v] of s.counts) baseline.counts.set(k, (baseline.counts.get(k) ?? 0) + v);
  }

  const perKg: Record<string, DemandModel> = {};
  let totalSamples = 0;
  let mae = 0;
  let maeCount = 0;

  for (const [kgId, series] of seriesByKg) {
    const filled = backfillSeries(series, trainingStart, trainingEnd);
    const model = trainDemandModel(filled, trainingEnd);
    perKg[kgId] = model;
    totalSamples += filled.counts.size;

    // MAE on held-out week
    const holdout = heldOutByKg.get(kgId);
    if (holdout) {
      for (const [date, actual] of holdout) {
        const pred = predictDemand(model, date);
        mae += Math.abs(pred - actual);
        maeCount++;
      }
    }
  }

  const baselineModel = trainDemandModel(
    backfillSeries(baseline, trainingStart, trainingEnd),
    trainingEnd,
  );

  const authorityModel: AuthorityDemandModel = { perKg, baseline: baselineModel };

  await saveModel(authorityId, 'demand', authorityModel, {
    trainingSamples: totalSamples,
    metricName: 'mae',
    metricValue: maeCount > 0 ? mae / maeCount : 0,
    featureNames: ['per_kg_dow_mean', 'recent_7d_mean'],
  });

  return {
    model: authorityModel,
    result: {
      kindergartens: Object.keys(perKg).length,
      totalSamples,
      metric: maeCount > 0 ? mae / maeCount : 0,
    },
  };
}

export async function forecastDemand(
  authorityId: string,
  kindergartenId: string,
  daysAhead = 14,
): Promise<{ kindergartenId: string; horizon: number; predictions: { date: string; expected: number }[] } | null> {
  const r = await query(
    `SELECT params FROM ml_models WHERE authority_id = $1 AND kind = 'demand'`,
    [authorityId],
  );
  let model: AuthorityDemandModel | null = r.rows.length > 0
    ? r.rows[0].params as AuthorityDemandModel
    : null;

  // If no trained model yet, build a quick on-the-fly one from raw data so we
  // always return something useful.
  if (!model) {
    const trained = await trainDemandModels(authorityId);
    model = trained.model;
  }

  const kgModel = model.perKg[kindergartenId] ?? model.baseline;
  if (!kgModel) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const predictions: { date: string; expected: number }[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    predictions.push({
      date: dateStr,
      expected: Math.max(0, predictDemand(kgModel, dateStr)),
    });
  }
  return { kindergartenId, horizon: daysAhead, predictions };
}
