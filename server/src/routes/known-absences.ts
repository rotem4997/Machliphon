import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError } from '../errors/AppError';

const router = Router();
router.use(authenticate);

// GET /api/known-absences — B3: list planned leaves for authority
router.get('/', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { kindergartenId, month, year } = req.query;
  let sql = `
    SELECT ka.*, k.name as kindergarten_name, k.neighborhood,
      u.first_name as creator_first_name, u.last_name as creator_last_name
    FROM known_absences ka
    JOIN kindergartens k ON ka.kindergarten_id = k.id
    LEFT JOIN users u ON ka.created_by = u.id
    WHERE k.authority_id = $1
  `;
  const params: unknown[] = [req.user!.authority_id];
  let paramIdx = 2;

  if (kindergartenId) { sql += ` AND ka.kindergarten_id = $${paramIdx++}`; params.push(kindergartenId); }
  if (month && year) {
    sql += ` AND EXTRACT(MONTH FROM ka.start_date) = $${paramIdx++} AND EXTRACT(YEAR FROM ka.start_date) = $${paramIdx++}`;
    params.push(month, year);
  }
  sql += ` ORDER BY ka.start_date`;
  const result = await query(sql, params);
  return res.json(result.rows);
}));

// POST /api/known-absences — B3: create a planned leave
router.post('/', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { kindergartenId, employeeName, employeeRole, startDate, endDate, reason, notes } = req.body;
  if (!kindergartenId || !employeeName || !startDate || !endDate) {
    throw new ValidationError('חסרים שדות חובה.', {
      source: 'POST /api/known-absences',
      detail: 'Missing kindergartenId, employeeName, startDate, or endDate',
    });
  }
  const kgCheck = await query('SELECT id FROM kindergartens WHERE id = $1 AND authority_id = $2', [kindergartenId, req.user!.authority_id]);
  if (kgCheck.rows.length === 0) throw new NotFoundError('גן ילדים לא נמצא.', { source: 'POST /api/known-absences', detail: `KG ${kindergartenId} not in authority` });

  const result = await query(`
    INSERT INTO known_absences (kindergarten_id, employee_name, employee_role, start_date, end_date, reason, notes, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
  `, [kindergartenId, employeeName, employeeRole || 'teacher', startDate, endDate, reason || null, notes || null, req.user!.id]);
  return res.status(201).json(result.rows[0]);
}));

// PATCH /api/known-absences/:id — update a planned leave
router.patch('/:id', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, reason, notes, employeeName, employeeRole } = req.body;
  const result = await query(`
    UPDATE known_absences SET
      employee_name = COALESCE($1, employee_name),
      employee_role = COALESCE($2, employee_role),
      start_date = COALESCE($3, start_date),
      end_date = COALESCE($4, end_date),
      reason = COALESCE($5, reason),
      notes = COALESCE($6, notes)
    WHERE id = $7
      AND kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $8)
    RETURNING *
  `, [employeeName || null, employeeRole || null, startDate || null, endDate || null, reason || null, notes || null, req.params.id, req.user!.authority_id]);
  if (result.rows.length === 0) throw new NotFoundError('חופש מתוכנן לא נמצא.', { source: 'PATCH /api/known-absences/:id', detail: `KnownAbsence ${req.params.id} not found` });
  return res.json(result.rows[0]);
}));

// DELETE /api/known-absences/:id
router.delete('/:id', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    DELETE FROM known_absences WHERE id = $1
      AND kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $2) RETURNING id
  `, [req.params.id, req.user!.authority_id]);
  if (result.rows.length === 0) throw new NotFoundError('חופש מתוכנן לא נמצא.', { source: 'DELETE /api/known-absences/:id', detail: `KnownAbsence ${req.params.id} not found` });
  return res.json({ message: 'חופש מתוכנן נמחק.' });
}));

export default router;
