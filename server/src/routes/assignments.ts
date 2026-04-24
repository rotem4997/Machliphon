import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError, ConflictError } from '../errors/AppError';

// D2: Israeli public holidays (fixed dates, format MM-DD)
const IL_HOLIDAYS: Record<string, string> = {
  '09-22': 'ראש השנה', '09-24': 'ראש השנה', '10-01': 'יום כיפור',
  '10-06': 'סוכות', '10-13': 'שמיני עצרת', '04-14': 'פסח', '04-21': 'אחרון של פסח',
  '05-14': 'יום העצמאות', '06-02': 'שבועות',
};
function getHolidayName(dateStr: string): string | null {
  const monthDay = dateStr.substring(5); // MM-DD
  return IL_HOLIDAYS[monthDay] || null;
}

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
  // D2: Holiday check
  const holiday = getHolidayName(assignmentDate as string);
  if (holiday) {
    throw new ValidationError(`לא ניתן לשבץ בחג/מועד: ${holiday}.`, {
      source: 'POST /api/assignments',
      detail: `Assignment date ${assignmentDate} is an Israeli holiday: ${holiday}`,
    });
  }
  const subCheck = await query(`SELECT s.id, s.work_permit_valid FROM substitutes s WHERE s.id = $1 AND s.authority_id = $2 AND s.status = 'active'`, [substituteId, req.user!.authority_id]);
  if (subCheck.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה או אינה פעילה.', { source: 'POST /api/assignments', detail: `Substitute ${substituteId} not found/inactive`, meta: { substituteId } });
  }
  if (!subCheck.rows[0].work_permit_valid) {
    throw new ValidationError('למחליפה אין תיק עובד תקף.', { source: 'POST /api/assignments', detail: `Substitute ${substituteId} permit invalid` });
  }
  // Verify the target kindergarten belongs to the requester's authority
  const kgAuthCheck = await query(
    'SELECT id FROM kindergartens WHERE id = $1 AND authority_id = $2 AND is_active = true',
    [kindergartenId, req.user!.authority_id]
  );
  if (kgAuthCheck.rows.length === 0) {
    throw new NotFoundError('גן ילדים לא נמצא.', { source: 'POST /api/assignments', detail: `Kindergarten ${kindergartenId} not found in authority ${req.user!.authority_id}` });
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
router.patch('/:id/arrive', requireRole('substitute', 'manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  let result;
  if (req.user!.role === 'substitute') {
    // Substitutes may only mark their own assignment as arrived
    const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
    if (subResult.rows.length === 0) {
      throw new NotFoundError('מחליפה לא נמצאה.', { source: 'PATCH /assignments/:id/arrive', detail: `No substitute profile for user ${req.user!.id}` });
    }
    result = await query(
      `UPDATE assignments SET status = 'arrived', substitute_arrived_at = NOW()
       WHERE id = $1 AND substitute_id = $2 AND status IN ('confirmed', 'pending') RETURNING *`,
      [req.params.id, subResult.rows[0].id]
    );
  } else {
    // Managers/admins may only mark assignments within their own authority
    result = await query(
      `UPDATE assignments SET status = 'arrived', substitute_arrived_at = NOW()
       WHERE id = $1 AND status IN ('confirmed', 'pending')
         AND kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $2) RETURNING *`,
      [req.params.id, req.user!.authority_id]
    );
  }
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'PATCH /assignments/:id/arrive', detail: `Assignment ${req.params.id} not found/wrong status` });

  // B5: auto-update linked absence to 'covered'
  if (result.rows[0].absence_id) {
    await query(`UPDATE absence_reports SET status = 'covered' WHERE id = $1`, [result.rows[0].absence_id]);
  }

  return res.json({ message: 'הגעה אושרה.', assignment: result.rows[0] });
}));

// PATCH /api/assignments/:id/complete
router.patch('/:id/complete', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { hoursWorked, hourlyRate } = req.body;
  const totalPay = hoursWorked && hourlyRate ? hoursWorked * hourlyRate : null;
  // Authority scoping: only complete assignments belonging to the user's own authority
  const result = await query(
    `UPDATE assignments SET status = 'completed', hours_worked = $1, hourly_rate = $2, total_pay = $3
     WHERE id = $4
       AND kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $5) RETURNING *`,
    [hoursWorked || null, hourlyRate || null, totalPay, req.params.id, req.user!.authority_id]
  );
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'PATCH /assignments/:id/complete', detail: `Assignment ${req.params.id} not found` });
  return res.json({ message: 'שיבוץ הושלם.', assignment: result.rows[0] });
}));

// DELETE /api/assignments/:id
router.delete('/:id', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  // Authority scoping: only cancel assignments belonging to the user's own authority
  const result = await query(
    `UPDATE assignments SET status = 'cancelled', cancellation_reason = $1
     WHERE id = $2 AND status NOT IN ('completed', 'cancelled')
       AND kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $3) RETURNING *`,
    [req.body.reason || null, req.params.id, req.user!.authority_id]
  );
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
  // Sanitize CSV cells to prevent formula injection (OWASP A03)
  const sanitizeCsvCell = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(str[0])) {
      return `'${str}`;
    }
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headers = ['תעודת זהות', 'שם', 'גן', 'כתובת', 'תאריך', 'שעת התחלה', 'שעת סיום', 'שעות', 'תעריף לשעה', 'סה"כ לתשלום'];
  const rows = result.rows.map(r => [r.id_number, r.name, r.kindergarten, r.address, r.assignment_date, r.start_time, r.end_time, r.hours_worked || '', r.hourly_rate || '', r.total_pay || '']);
  const csv = [headers, ...rows].map(row => row.map(sanitizeCsvCell).join(',')).join('\n');
  await query(`INSERT INTO madganet_exports (authority_id, exported_by, export_month, export_year, assignments_count) VALUES ($1, $2, $3, $4, $5)`, [req.user!.authority_id, req.user!.id, month, year, result.rows.length]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=madganet_${year}_${month}.csv`);
  res.write('\uFEFF');
  return res.end(csv);
}));

// PATCH /api/assignments/:id/substitute-cancel — B4: substitute can cancel with reason
router.patch('/:id/substitute-cancel', requireRole('substitute'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
  if (subResult.rows.length === 0) throw new NotFoundError('מחליפה לא נמצאה.', { source: 'PATCH /assignments/:id/substitute-cancel', detail: `No sub for user ${req.user!.id}` });
  const result = await query(
    `UPDATE assignments SET status = 'cancelled', cancellation_reason = $1
     WHERE id = $2 AND substitute_id = $3 AND status IN ('pending','confirmed') RETURNING *, absence_id`,
    [reason || 'ביטול על ידי מחליפה', req.params.id, subResult.rows[0].id]
  );
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא.', { source: 'PATCH /assignments/:id/substitute-cancel', detail: `Assignment ${req.params.id} not found` });
  if (result.rows[0].absence_id) {
    await query(`UPDATE absence_reports SET status = 'open' WHERE id = $1`, [result.rows[0].absence_id]);
  }
  // Notify authority admins
  const kgId = result.rows[0].kindergarten_id;
  const admins = await query(`SELECT u.id FROM users u JOIN kindergartens k ON u.authority_id = k.authority_id WHERE k.id = $1 AND u.role IN ('manager','authority_admin')`, [kgId]);
  const kgRes = await query('SELECT name FROM kindergartens WHERE id = $1', [kgId]);
  const subName = `${result.rows[0].substitute_id}`;
  for (const adm of admins.rows) {
    await query(`INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1,'assignment_cancelled','שיבוץ בוטל על ידי מחליפה',$2,$3)`,
      [adm.id, `שיבוץ ל${kgRes.rows[0]?.name || 'גן'} בוטל. סיבה: ${reason || 'ללא סיבה'}.`, JSON.stringify({ assignmentId: req.params.id })]);
  }
  return res.json({ message: 'ביטול בוצע.' });
}));

// PATCH /api/assignments/:id/rate — B6: manager rates the substitute after completion
router.patch('/:id/rate', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { rating, ratingNotes } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new ValidationError('דירוג חייב להיות בין 1 ל-5.', { source: 'PATCH /assignments/:id/rate', detail: 'rating out of range' });
  const result = await query(
    `UPDATE assignments SET rating = $1, rating_notes = $2
     WHERE id = $3 AND status = 'completed'
       AND kindergarten_id IN (SELECT id FROM kindergartens WHERE authority_id = $4) RETURNING substitute_id`,
    [rating, ratingNotes || null, req.params.id, req.user!.authority_id]
  );
  if (result.rows.length === 0) throw new NotFoundError('שיבוץ לא נמצא או לא הושלם.', { source: 'PATCH /assignments/:id/rate', detail: `Assignment ${req.params.id} not found or not completed` });
  // Update substitute's average rating
  await query(`
    UPDATE substitutes SET rating = (
      SELECT AVG(a.rating) FROM assignments a WHERE a.substitute_id = $1 AND a.rating IS NOT NULL
    ) WHERE id = $1
  `, [result.rows[0].substitute_id]);
  return res.json({ message: 'דירוג נשמר.' });
}));

export default router;
