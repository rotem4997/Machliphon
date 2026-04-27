// Persistence helpers for trained models. Each (authority_id, kind) tuple has
// at most one row; UPSERT replaces the previous snapshot on retrain.

import { query } from '../db/pool';
import { LogRegModel } from './logreg';
import { DemandModel } from './features';

export type ModelKind = 'match' | 'no_show' | 'demand';

export interface StoredModel<P = unknown> {
  id: string;
  authority_id: string | null;
  kind: ModelKind;
  params: P;
  training_samples: number;
  metric_name: string | null;
  metric_value: number | null;
  feature_names: string[];
  trained_at: string;
}

export async function saveModel(
  authorityId: string,
  kind: ModelKind,
  params: unknown,
  meta: { trainingSamples: number; metricName?: string; metricValue?: number; featureNames?: string[] },
): Promise<void> {
  await query(
    `INSERT INTO ml_models (authority_id, kind, params, training_samples, metric_name, metric_value, feature_names, trained_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (authority_id, kind) DO UPDATE SET
       params = EXCLUDED.params,
       training_samples = EXCLUDED.training_samples,
       metric_name = EXCLUDED.metric_name,
       metric_value = EXCLUDED.metric_value,
       feature_names = EXCLUDED.feature_names,
       trained_at = NOW()`,
    [
      authorityId,
      kind,
      JSON.stringify(params),
      meta.trainingSamples,
      meta.metricName ?? null,
      meta.metricValue ?? null,
      JSON.stringify(meta.featureNames ?? []),
    ],
  );
}

export async function loadModel<P>(authorityId: string, kind: ModelKind): Promise<StoredModel<P> | null> {
  const r = await query(
    `SELECT id, authority_id, kind, params, training_samples, metric_name, metric_value,
            feature_names, trained_at
       FROM ml_models WHERE authority_id = $1 AND kind = $2`,
    [authorityId, kind],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    ...row,
    params: row.params as P, // pg returns JSONB already parsed
    feature_names: row.feature_names as string[],
  };
}

export async function logPrediction(opts: {
  authorityId: string;
  kind: ModelKind;
  subjectType: 'substitute' | 'assignment' | 'kindergarten';
  subjectId: string | null;
  score: number;
  details?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO ml_predictions (authority_id, kind, subject_type, subject_id, score, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      opts.authorityId,
      opts.kind,
      opts.subjectType,
      opts.subjectId,
      opts.score,
      JSON.stringify(opts.details ?? {}),
    ],
  );
}

// Convenience: typed loaders for each model kind.
export const loadMatchModel = (authorityId: string) => loadModel<LogRegModel>(authorityId, 'match');
export const loadNoShowModel = (authorityId: string) => loadModel<LogRegModel>(authorityId, 'no_show');
export const loadDemandModel = (authorityId: string) => loadModel<DemandModel>(authorityId, 'demand');
