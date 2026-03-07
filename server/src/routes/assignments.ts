import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError, ConflictError } from '../errors/AppError';

const router = Router();
router.use(authenticate);

// GET /api/assignments
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, month, year, status, kindergartenId } = req.query;
  const authorityId = req.user!.authority_id;

  let sql = `
    SELECT
      a.*,
      k.name as kindergarten_name, k.address as kindergarten_address, k.neighborhood,
      u_sub.first_name as substitute_first_name, u_sub.last_name as substitute_last_name,
      u_sub.phone as substitute_phone,
      u_mgr.first_name as manager_first_name, u_mgr.last_name as manager_last_name
    FROM assignments a
    JOIN kindergartens k ON a.kindergarten_id = k.id
    JOIN substitutes s ON a.substitute_id = s.id
    JOIN users u_sub ON s.user_id = u_sub.id
    JOIN users u_mgr ON a.assigned_by = u_mgr.id
    WHERE k.authority_id = $1
  `;
  const params: unknown[] = [authorityId];
  let paramIdx = 2;

  if (date) {
    sql += ` AND a.assignment_date = $${paramIdx++}`;
    params.push(date);
  } else if (month && year) {
    sql += ` AND EXTRACT(MONTH FROM a.assignment_date) = $${paramIdx++} AND EXTRACT(YEAR FROM a.assignment_date) = $${paramIdx++}`;
    params.push(month, year);
  }
  if (status) {
    sql += ` AND a.status = $${paramIdx++}`;
    params.push(status);
  }
  if (kindergartenId) {
    sql += ` AND a.kindergarten_id = $${paramIdx++}`;
    params.push(kindergartenId);
  }
  if (req.user!.role === 'substitute') {
    const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
    if (subResult.rows.length > 0) {
      sql += ` AND a.substitute_id = $${paramIdx++}`;
      params.push(subResult.rows[0].id);
    }
  }
  sql += ` ORDER BY a.assignment_date DESC, a.created_at DESC`;
  const result = await query(sql, params);
  return res.json(result.rows);
}));

// POST /api/assignments
router.post('/', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { absenceId, substituteId, kindergartenId, assignmentDate, startTime, endTime, notes } = req.body;
  if (!substituteId || !kindergartenId || !assignmentDate) {
    throw new ValidationError('חסרים שדות חובה.', {
      source: 'POST /api/assignments',
      detail: 'Missing substituteId, kindergartenId, or assignmentDate',
      meta: { substituteId, kindergartenId, assignmentDate },
    });
  }
  const subCheck = await query(`SELECT s.id, s.work_permit_valid FROM substitutes s WHERE s.id = $1 AND s.authority_id = $2 AND s.status = 'active'`, [substituteId, req.user!.authority_id]);
  if (subCheck.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה או אינה פעילה.', { source: 'POST /api/assignments', detail: `Substitute ${substituteId} not found/inactive`, meta: { substituteId } });
  }
  if (!subCheck.rows[0].work_permit_valid) {
    throw new ValidationError('למחליפה אין תיק עובד תקף.', { source: 'POST /api/assignments', detail: `Substitute ${substituteId} permit invalid` });
  }
  const conflictCheck = await query(`SELECT id FROM assignments WHERE substitute_id = $1 AND assignment_date = $2 AND status NOT IN ('cancelled')`, [substituteId, assignmentDate]);
  if (conflictCheck.rows.length > 0) {
    throw new ConflictError('המחליפה כבר משובצת לתאריך זה.', { source: 'POST /api/assignments', detail: `Conflict on ${assignmentDate}`, meta: { existingId: conflictCheck.rows[0].id } });
  }
  const result = await query(`
    INSERT INTO assignments (absence_id, substitute_id, kindergarten_id, assigned_by, assignment_date, start_time, end_time, notes, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *
  `, [absenceId || null, substituteId, kindergartenId, req.user!.id, assignmentDate, startTime || '07:30', endTime || '14:00', notes || null]);
  if (absenceId) await query(`UPDATE absence_reports SET status = 'assigned' WHERE id = $1`, [absenceId]);
  await query(`UPDATE substitutes SET total_assignments = total_assignments + 1 WHERE id = $1`, [substituteId]);
  const subUser = await query('SELECT user_id FROM substitutes WHERE id = $1', [substituteId]);
  const kgName = await query('SELECT name FROM kindergartens WHERE id = $1', [kindergartenId]);
  await query(`INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, 'assignment_request', 'שיבוץ חדש', $2, $3)`, [
    subUser.rows[0].user_id,
    `שובצת לגן ${kgName.rows[0].name} בתאריך ${assignmentDate}`,
    JSON.stringify({ assignmentId: result.rows[0].id, kindergartenId, date: assignmentDate })
  ]);
  return res.status(201).json(result.rows[0]);
}));

// PATCH /api/assignments/:id/confirm
router.patch('/:id/confirm', requireRole('substitute'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
  if (subResult.rows.length === 0) throw new NotFoundError('מחליפה לא נמצאה.', { source: 'PATCH /assignments/:id/confirm', detail: `No substitute for user ${req.user!.id}` });
  const result = await query(`UPDATE assignments SET status = 'confirmed', substitute_confirmed_at = NOW() WHERE id = $1 AND substitute_id = $2 AND status = 'pending' RETURNING *`, [req.params.id, subResult.rows[0].id]);
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'PATCH /assignments/:id/confirm', detail: `Assignment ${req.params.id} not found/not pending` });
  return res.json({ message: 'שיבוץ אושר בהצלחה.', assignment: result.rows[0] });
}));

// PATCH /api/assignments/:id/arrive
router.patch('/:id/arrive', requireRole('substitute', 'manager'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`UPDATE assignments SET status = 'arrived', substitute_arrived_at = NOW() WHERE id = $1 AND status IN ('confirmed', 'pending') RETURNING *`, [req.params.id]);
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'PATCH /assignments/:id/arrive', detail: `Assignment ${req.params.id} not found/wrong status` });
  return res.json({ message: 'הגעה אושרה.', assignment: result.rows[0] });
}));

// PATCH /api/assignments/:id/complete
router.patch('/:id/complete', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { hoursWorked, hourlyRate } = req.body;
  const totalPay = hoursWorked && hourlyRate ? hoursWorked * hourlyRate : null;
  const result = await query(`UPDATE assignments SET status = 'completed', hours_worked = $1, hourly_rate = $2, total_pay = $3 WHERE id = $4 RETURNING *`, [hoursWorked || null, hourlyRate || null, totalPay, req.params.id]);
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'PATCH /assignments/:id/complete', detail: `Assignment ${req.params.id} not found` });
  return res.json({ message: 'שיבוץ הושלם.', assignment: result.rows[0] });
}));

// DELETE /api/assignments/:id
router.delete('/:id', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`UPDATE assignments SET status = 'cancelled', cancellation_reason = $1 WHERE id = $2 AND status NOT IN ('completed', 'cancelled') RETURNING *`, [req.body.reason || null, req.params.id]);
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'DELETE /assignments/:id', detail: `Assignment ${req.params.id} not found/already done` });
  if (result.rows[0].absence_id) await query(`UPDATE absence_reports SET status = 'open' WHERE id = $1`, [result.rows[0].absence_id]);
  return res.json({ message: 'שיבוץ בוטל.' });
}));

// GET /api/assignments/export/csv
router.get('/export/csv', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  if (!month || !year) throw new ValidationError('חודש ושנה נדרשים.', { source: 'GET /assignments/export/csv', detail: 'Missing month/year' });
  const result = await query(`
    SELECT s.id_number, u.first_name || ' ' || u.last_name as name, k.name as kindergarten, k.address,
      a.assignment_date, a.start_time, a.end_time, a.hours_worked, a.hourly_rate, a.total_pay
    FROM assignments a JOIN substitutes s ON a.substitute_id = s.id JOIN users u ON s.user_id = u.id JOIN kindergartens k ON a.kindergarten_id = k.id
    WHERE k.authority_id = $1 AND EXTRACT(MONTH FROM a.assignment_date) = $2 AND EXTRACT(YEAR FROM a.assignment_date) = $3 AND a.status = 'completed'
    ORDER BY a.assignment_date, u.last_name
  `, [req.user!.authority_id, month, year]);
  const headers = ['תעודת זהות', 'שם', 'גן', 'כתובת', 'תאריך', 'שעת התחלה', 'שעת סיום', 'שעות', 'תעריף לשעה', 'סה"כ לתשלום'];
  const rows = result.rows.map(r => [r.id_number, r.name, r.kindergarten, r.address, r.assignment_date, r.start_time, r.end_time, r.hours_worked || '', r.hourly_rate || '', r.total_pay || '']);
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  await query(`INSERT INTO madganet_exports (authority_id, exported_by, export_month, export_year, assignments_count) VALUES ($1, $2, $3, $4, $5)`, [req.user!.authority_id, req.user!.id, month, year, result.rows.length]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=madganet_${year}_${month}.csv`);
  res.write('\uFEFF');
  return res.end(csv);
}));

export default router;
