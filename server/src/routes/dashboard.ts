import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.use(authenticate);
router.use(requireRole('authority_admin', 'super_admin', 'manager'));

// GET /api/dashboard/stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const authorityId = req.user!.authority_id;

  const [substitutes, assignments, absences, permits] = await Promise.all([
    query(`SELECT COUNT(*) as count FROM substitutes WHERE authority_id = $1 AND status = 'active'`, [authorityId]),
    query(`SELECT COUNT(*) FILTER (WHERE status IN ('confirmed','arrived','completed')) as covered, COUNT(*) as total
      FROM assignments a JOIN kindergartens k ON a.kindergarten_id = k.id WHERE k.authority_id = $1 AND a.assignment_date = CURRENT_DATE`, [authorityId]),
    query(`SELECT COUNT(*) as count FROM absence_reports ar JOIN kindergartens k ON ar.kindergarten_id = k.id
      WHERE k.authority_id = $1 AND ar.absence_date = CURRENT_DATE AND ar.status = 'open'`, [authorityId]),
    query(`SELECT COUNT(*) as count FROM substitutes WHERE authority_id = $1
      AND work_permit_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`, [authorityId]),
  ]);

  const weekCoverage = await query(`
    SELECT d.dt::date as date,
      COUNT(a2.id) FILTER (WHERE a2.status NOT IN ('cancelled')) as assignments,
      COUNT(ar.id) FILTER (WHERE ar.status = 'open') as open_absences
    FROM generate_series(DATE_TRUNC('week', CURRENT_DATE), DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days', '1 day') as d(dt)
    LEFT JOIN absence_reports ar ON ar.absence_date = d.dt AND ar.kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $1)
    LEFT JOIN assignments a2 ON a2.assignment_date = d.dt AND a2.kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $1)
    GROUP BY d.dt::date ORDER BY date
  `, [authorityId]);

  return res.json({
    totalSubstitutes: parseInt(substitutes.rows[0].count),
    todayCovered: parseInt(assignments.rows[0].covered || '0'),
    todayTotal: parseInt(assignments.rows[0].total || '0'),
    openAbsences: parseInt(absences.rows[0].count),
    expiringPermits: parseInt(permits.rows[0].count),
    weekCoverage: weekCoverage.rows.map(r => ({
      date: r.date,
      assignments: parseInt(r.assignments) || 0,
      open_absences: parseInt(r.open_absences) || 0,
    })),
  });
}));

// GET /api/dashboard/coverage-by-neighborhood
router.get('/coverage-by-neighborhood', asyncHandler(async (req: AuthRequest, res: Response) => {
  const authorityId = req.user!.authority_id;
  const { month, year } = req.query;
  const result = await query(`
    SELECT k.neighborhood, COUNT(DISTINCT k.id) as kindergartens_count,
      COUNT(DISTINCT a.id) FILTER (WHERE a.status NOT IN ('cancelled')) as total_assignments,
      COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed') as completed,
      COUNT(DISTINCT ar.id) FILTER (WHERE ar.status = 'uncovered') as uncovered_absences,
      ROUND(COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed')::numeric / NULLIF(COUNT(DISTINCT ar.id), 0) * 100, 1) as coverage_pct
    FROM kindergartens k
    LEFT JOIN absence_reports ar ON ar.kindergarten_id = k.id
      AND ($2::int IS NULL OR EXTRACT(MONTH FROM ar.absence_date) = $2)
      AND ($3::int IS NULL OR EXTRACT(YEAR FROM ar.absence_date) = $3)
    LEFT JOIN assignments a ON a.absence_id = ar.id
      AND ($2::int IS NULL OR EXTRACT(MONTH FROM a.assignment_date) = $2)
      AND ($3::int IS NULL OR EXTRACT(YEAR FROM a.assignment_date) = $3)
    WHERE k.authority_id = $1 GROUP BY k.neighborhood ORDER BY coverage_pct DESC NULLS LAST
  `, [authorityId, month || null, year || null]);
  return res.json(result.rows.map(r => ({
    ...r,
    kindergartens_count: parseInt(r.kindergartens_count) || 0,
    total_assignments: parseInt(r.total_assignments) || 0,
    completed: parseInt(r.completed) || 0,
    uncovered_absences: parseInt(r.uncovered_absences) || 0,
    coverage_pct: parseFloat(r.coverage_pct) || 0,
  })));
}));

// GET /api/dashboard/alerts
router.get('/alerts', asyncHandler(async (req: AuthRequest, res: Response) => {
  const authorityId = req.user!.authority_id;
  const alerts: object[] = [];

  const uncovered = await query(`
    SELECT ar.id, k.name as kindergarten_name, ar.absent_employee_name
    FROM absence_reports ar JOIN kindergartens k ON ar.kindergarten_id = k.id
    WHERE k.authority_id = $1 AND ar.absence_date = CURRENT_DATE AND ar.status = 'open'
  `, [authorityId]);
  uncovered.rows.forEach(r => alerts.push({ type: 'uncovered_absence', severity: 'high', message: `גן ${r.kindergarten_name}: ${r.absent_employee_name} נעדרת ואין מחליפה`, data: r }));

  const expiring = await query(`
    SELECT u.first_name, u.last_name, s.work_permit_expiry
    FROM substitutes s JOIN users u ON s.user_id = u.id
    WHERE s.authority_id = $1 AND s.work_permit_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  `, [authorityId]);
  expiring.rows.forEach(r => alerts.push({ type: 'permit_expiring', severity: 'medium', message: `תיק עובד של ${r.first_name} ${r.last_name} פג ב-${r.work_permit_expiry}`, data: r }));

  const knownUnplanned = await query(`
    SELECT ka.*, k.name as kindergarten_name FROM known_absences ka JOIN kindergartens k ON ka.kindergarten_id = k.id
    WHERE k.authority_id = $1 AND ka.start_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
      AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.kindergarten_id = ka.kindergarten_id AND a.assignment_date = ka.start_date AND a.status NOT IN ('cancelled'))
  `, [authorityId]);
  knownUnplanned.rows.forEach(r => alerts.push({ type: 'unplanned_known_absence', severity: 'low', message: `חופש מתוכנן ב-${r.kindergarten_name} ב-${r.start_date} — אין שיבוץ עדיין`, data: r }));

  return res.json(alerts);
}));

export default router;
