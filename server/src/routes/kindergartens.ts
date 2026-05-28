import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { NotFoundError } from '../errors/AppError';

const router = Router();
router.use(authenticate);

// GET /api/kindergartens
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const authorityId = req.user!.authority_id;
  const { page: pageParam, limit: limitParam, search } = req.query;

  // Pagination is opt-in: only activate when both page and limit are provided
  const usePagination = pageParam !== undefined && limitParam !== undefined;
  const page = usePagination ? Math.max(1, parseInt(pageParam as string, 10) || 1) : 1;
  const limit = usePagination ? Math.min(100, Math.max(1, parseInt(limitParam as string, 10) || 20)) : 0;
  const offset = (page - 1) * limit;

  const params: unknown[] = [authorityId];
  let paramIdx = 2;
  let whereSql = `WHERE authority_id = $1 AND is_active = true`;

  if (search) {
    whereSql += ` AND name ILIKE $${paramIdx++}`;
    params.push(`%${search}%`);
  }

  const selectSql = `SELECT id, name, address, neighborhood, principal_name, phone, age_group, capacity, is_active
    FROM kindergartens`;
  const orderSql = ` ORDER BY name`;

  if (usePagination) {
    const countResult = await query(`SELECT COUNT(*) as total FROM kindergartens ${whereSql}`, params);
    const total = parseInt(countResult.rows[0].total, 10);
    const paginatedSql = `${selectSql} ${whereSql}${orderSql} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    const result = await query(paginatedSql, [...params, limit, offset]);
    return res.json({
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  const result = await query(`${selectSql} ${whereSql}${orderSql}`, params);
  return res.json(result.rows);
}));

// GET /api/kindergartens/:id — t008: kindergarten detail with manager, recent absences, assignment stats
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const source = 'GET /api/kindergartens/:id';
  const { id } = req.params;
  const authorityId = req.user!.authority_id;

  // ── Core kindergarten row ────────────────────────────────────────────────────
  const kgResult = await query(
    `SELECT id, name, address, neighborhood, principal_name, phone, age_group, capacity, is_active,
            created_at, updated_at
     FROM kindergartens
     WHERE id = $1 AND authority_id = $2`,
    [id, authorityId],
  );

  if (kgResult.rows.length === 0) {
    throw new NotFoundError('גן הילדים לא נמצא.', {
      source,
      detail: `Kindergarten ${id} not found in authority ${authorityId}`,
      meta: { kindergartenId: id, authorityId },
    });
  }

  const kindergarten = kgResult.rows[0];

  // ── Manager: linked via manager_kindergartens → managers → users ─────────────
  // A kindergarten may have zero or more linked managers; return the first active one.
  const managerResult = await query(
    `SELECT
       u.first_name,
       u.last_name,
       u.phone,
       u.email
     FROM manager_kindergartens mk
     JOIN managers             m  ON mk.manager_id = m.id
     JOIN users                u  ON m.user_id = u.id
     WHERE mk.kindergarten_id = $1
       AND u.is_active = true
     ORDER BY u.last_name, u.first_name
     LIMIT 1`,
    [id],
  );

  const manager = managerResult.rows.length > 0 ? managerResult.rows[0] : null;

  // ── Recent absences (last 10 absence_reports for this kindergarten) ──────────
  // The schema stores a single absence_date per report (not a range), so we
  // expose it as both start_date and end_date for API compatibility.
  const absencesResult = await query(
    `SELECT
       id,
       absent_employee_name AS employee_name,
       absence_date         AS start_date,
       absence_date         AS end_date,
       absence_reason       AS reason,
       status
     FROM absence_reports
     WHERE kindergarten_id = $1
     ORDER BY absence_date DESC
     LIMIT 10`,
    [id],
  );

  // ── Assignment stats ─────────────────────────────────────────────────────────
  const statsResult = await query(
    `SELECT
       COUNT(*)                                                          AS "totalAssignments",
       COUNT(*) FILTER (
         WHERE status = 'completed'
           AND DATE_TRUNC('month', assignment_date) = DATE_TRUNC('month', CURRENT_DATE)
       )                                                                 AS "completedThisMonth",
       COUNT(*) FILTER (
         WHERE assignment_date = CURRENT_DATE
           AND status NOT IN ('cancelled', 'completed', 'no_show')
       )                                                                 AS "pendingToday"
     FROM assignments
     WHERE kindergarten_id = $1`,
    [id],
  );

  const rawStats = statsResult.rows[0];
  const assignmentStats = {
    totalAssignments:   parseInt(rawStats.totalAssignments,   10),
    completedThisMonth: parseInt(rawStats.completedThisMonth, 10),
    pendingToday:       parseInt(rawStats.pendingToday,       10),
  };

  return res.json({
    ...kindergarten,
    manager,
    recentAbsences: absencesResult.rows,
    assignmentStats,
  });
}));

export default router;
