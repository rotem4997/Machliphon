import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError';
import { recommendSubstitutes, trainMatchModel } from '../ml/recommender';
import { predictNoShowRisk, trainNoShowModel } from '../ml/noShowRisk';
import { forecastDemand, trainDemandModels } from '../ml/demand';
import { runIntegrityChecks } from '../ml/dataIntegrity';
import { logPrediction, loadMatchModel, loadNoShowModel, loadDemandModel } from '../ml/modelStore';
import { query } from '../db/pool';

const router = Router();
router.use(authenticate);

function requireAuthorityScope(req: AuthRequest): string {
  if (!req.user?.authority_id) {
    throw new ForbiddenError('משתמש ללא רשות מוגדרת.', {
      source: `${req.method} ${req.path}`,
      detail: 'No authority_id on user — ML endpoints require authority scope',
    });
  }
  return req.user.authority_id;
}

// GET /api/ml/recommend?kindergartenId=...&date=YYYY-MM-DD&topK=10
router.get('/recommend', requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);
    const { kindergartenId, date, topK } = req.query;
    if (!kindergartenId || !date) {
      throw new ValidationError('חסרים שדות: kindergartenId, date.', {
        source: 'GET /api/ml/recommend',
        detail: 'Missing kindergartenId or date',
        meta: { kindergartenId, date },
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      throw new ValidationError('פורמט תאריך שגוי (נדרש YYYY-MM-DD).', {
        source: 'GET /api/ml/recommend',
        detail: `Bad date format: ${date}`,
      });
    }
    const k = Math.min(Math.max(parseInt(String(topK ?? '10'), 10) || 10, 1), 50);
    const recs = await recommendSubstitutes(authorityId, String(kindergartenId), String(date), k);

    // Audit-log the top recommendation so we can later evaluate accuracy.
    if (recs.length > 0) {
      await logPrediction({
        authorityId,
        kind: 'match',
        subjectType: 'substitute',
        subjectId: recs[0].substituteId,
        score: recs[0].score,
        details: { kindergartenId, date, topK: k, total: recs.length },
      });
    }

    return res.json({ kindergartenId, date, count: recs.length, recommendations: recs });
  }),
);

// GET /api/ml/no-show-risk/:assignmentId
router.get('/no-show-risk/:assignmentId',
  requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);
    const result = await predictNoShowRisk(authorityId, req.params.assignmentId);
    if (!result) {
      throw new NotFoundError('שיבוץ לא נמצא.', {
        source: 'GET /api/ml/no-show-risk/:id',
        detail: `Assignment ${req.params.assignmentId} not found in authority ${authorityId}`,
      });
    }
    await logPrediction({
      authorityId,
      kind: 'no_show',
      subjectType: 'assignment',
      subjectId: req.params.assignmentId,
      score: result.score,
      details: { band: result.band },
    });
    return res.json({ assignmentId: req.params.assignmentId, ...result });
  }),
);

// GET /api/ml/forecast?kindergartenId=...&days=14
router.get('/forecast', requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);
    const { kindergartenId, days } = req.query;
    if (!kindergartenId) {
      throw new ValidationError('חסר kindergartenId.', {
        source: 'GET /api/ml/forecast',
        detail: 'Missing kindergartenId',
      });
    }
    const horizon = Math.min(Math.max(parseInt(String(days ?? '14'), 10) || 14, 1), 60);

    // Verify the kindergarten belongs to the user's authority.
    const kgCheck = await query(
      'SELECT id FROM kindergartens WHERE id = $1 AND authority_id = $2',
      [kindergartenId, authorityId],
    );
    if (kgCheck.rows.length === 0) {
      throw new NotFoundError('גן לא נמצא ברשות זו.', {
        source: 'GET /api/ml/forecast',
        detail: `Kindergarten ${kindergartenId} not in authority ${authorityId}`,
      });
    }

    const forecast = await forecastDemand(authorityId, String(kindergartenId), horizon);
    if (!forecast) {
      throw new NotFoundError('לא ניתן להפיק תחזית עבור גן זה.', {
        source: 'GET /api/ml/forecast',
        detail: `No demand model available for kg ${kindergartenId}`,
      });
    }
    await logPrediction({
      authorityId,
      kind: 'demand',
      subjectType: 'kindergarten',
      subjectId: String(kindergartenId),
      score: forecast.predictions.reduce((s, p) => s + p.expected, 0) / forecast.predictions.length,
      details: { horizon },
    });
    return res.json(forecast);
  }),
);

// POST /api/ml/train  body: { kinds?: ['match','no_show','demand'] }
router.post('/train', requireRole('authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);
    const requested: string[] = Array.isArray(req.body?.kinds) && req.body.kinds.length
      ? req.body.kinds
      : ['match', 'no_show', 'demand'];

    // Run integrity checks first — refuse to train if there are blocking errors,
    // unless the caller explicitly forces it.
    const integrity = await runIntegrityChecks(authorityId);
    if (!integrity.ok && !req.body?.force) {
      return res.status(409).json({
        error: 'בעיות עקביות נתונים — נמצאו שגיאות שמונעות אימון. שלחו force=true כדי לעקוף.',
        integrity,
      });
    }

    const out: Record<string, unknown> = { integrity };

    if (requested.includes('match')) {
      const { result } = await trainMatchModel(authorityId);
      out.match = result;
    }
    if (requested.includes('no_show')) {
      const { result } = await trainNoShowModel(authorityId);
      out.no_show = result;
    }
    if (requested.includes('demand')) {
      const { result } = await trainDemandModels(authorityId);
      out.demand = result;
    }
    return res.json(out);
  }),
);

// GET /api/ml/integrity-report
router.get('/integrity-report', requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);
    const report = await runIntegrityChecks(authorityId);
    return res.json(report);
  }),
);

// GET /api/ml/models — show what's currently trained
router.get('/models', requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);
    const [match, noShow, demand] = await Promise.all([
      loadMatchModel(authorityId),
      loadNoShowModel(authorityId),
      loadDemandModel(authorityId),
    ]);
    const summarize = <P>(m: { kind: string; training_samples: number; metric_name: string | null; metric_value: number | null; feature_names: string[]; trained_at: string } & { params: P } | null) => m && {
      kind: m.kind,
      training_samples: m.training_samples,
      metric_name: m.metric_name,
      metric_value: m.metric_value,
      feature_names: m.feature_names,
      trained_at: m.trained_at,
    };
    return res.json({
      match: summarize(match),
      no_show: summarize(noShow),
      demand: summarize(demand),
    });
  }),
);

// GET /api/ml/insights — high-level summary the dashboard can render
router.get('/insights', requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authorityId = requireAuthorityScope(req);

    // Top-rated substitutes and at-risk substitutes (high cancellation rate)
    const [topRated, atRisk, openAbsences] = await Promise.all([
      query(
        `SELECT s.id, u.first_name || ' ' || u.last_name AS name,
                s.rating, s.total_assignments
           FROM substitutes s JOIN users u ON u.id = s.user_id
          WHERE s.authority_id = $1 AND s.status = 'active' AND s.total_assignments >= 3
          ORDER BY s.rating DESC NULLS LAST, s.total_assignments DESC
          LIMIT 5`,
        [authorityId],
      ),
      query(
        `SELECT s.id, u.first_name || ' ' || u.last_name AS name,
                COUNT(a.id) FILTER (WHERE a.status = 'no_show')::int AS no_shows,
                COUNT(a.id) FILTER (WHERE a.status = 'cancelled')::int AS cancels,
                COUNT(a.id)::int AS total
           FROM substitutes s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN assignments a ON a.substitute_id = s.id
          WHERE s.authority_id = $1
          GROUP BY s.id, u.first_name, u.last_name
         HAVING COUNT(a.id) >= 3
            AND (COUNT(a.id) FILTER (WHERE a.status = 'no_show')::float
               + COUNT(a.id) FILTER (WHERE a.status = 'cancelled')::float)
                / NULLIF(COUNT(a.id), 0) > 0.2
          ORDER BY no_shows DESC, cancels DESC
          LIMIT 5`,
        [authorityId],
      ),
      query(
        `SELECT COUNT(*)::int AS open_count
           FROM absence_reports ar
           JOIN kindergartens k ON k.id = ar.kindergarten_id
          WHERE k.authority_id = $1 AND ar.status = 'open'`,
        [authorityId],
      ),
    ]);

    return res.json({
      topRated: topRated.rows,
      atRisk: atRisk.rows,
      openAbsences: openAbsences.rows[0]?.open_count ?? 0,
    });
  }),
);

export default router;
