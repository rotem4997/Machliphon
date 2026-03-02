import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/assignments - list assignments
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
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

    // Role-based filtering
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
  } catch (error) {
    console.error('Get assignments error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// POST /api/assignments - create assignment
router.post('/', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { absenceId, substituteId, kindergartenId, assignmentDate, startTime, endTime, notes } = req.body;

    if (!substituteId || !kindergartenId || !assignmentDate) {
      return res.status(400).json({ error: 'חסרים שדות חובה.' });
    }

    // Check substitute is available and has valid permit
    const subCheck = await query(`
      SELECT s.id, s.work_permit_valid, s.work_permit_expiry
      FROM substitutes s
      WHERE s.id = $1 AND s.authority_id = $2 AND s.status = 'active'
    `, [substituteId, req.user!.authority_id]);

    if (subCheck.rows.length === 0) {
      return res.status(400).json({ error: 'מחליפה לא נמצאה או אינה פעילה.' });
    }

    const sub = subCheck.rows[0];
    if (!sub.work_permit_valid) {
      return res.status(400).json({ error: 'למחליפה אין תיק עובד תקף.' });
    }

    // Check not already assigned that day
    const conflictCheck = await query(`
      SELECT id FROM assignments 
      WHERE substitute_id = $1 AND assignment_date = $2 AND status NOT IN ('cancelled')
    `, [substituteId, assignmentDate]);

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({ error: 'המחליפה כבר משובצת לתאריך זה.' });
    }

    const result = await query(`
      INSERT INTO assignments (absence_id, substitute_id, kindergarten_id, assigned_by, assignment_date, start_time, end_time, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *
    `, [absenceId || null, substituteId, kindergartenId, req.user!.id, assignmentDate, startTime || '07:30', endTime || '14:00', notes || null]);

    // Update absence status if linked
    if (absenceId) {
      await query(`UPDATE absence_reports SET status = 'assigned' WHERE id = $1`, [absenceId]);
    }

    // Update substitute total assignments
    await query(`UPDATE substitutes SET total_assignments = total_assignments + 1 WHERE id = $1`, [substituteId]);

    // Create notification for substitute
    const subUser = await query('SELECT user_id FROM substitutes WHERE id = $1', [substituteId]);
    const kgName = await query('SELECT name FROM kindergartens WHERE id = $1', [kindergartenId]);

    await query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'assignment_request', 'שיבוץ חדש', $2, $3)
    `, [
      subUser.rows[0].user_id,
      `שובצת לגן ${kgName.rows[0].name} בתאריך ${assignmentDate}`,
      JSON.stringify({ assignmentId: result.rows[0].id, kindergartenId, date: assignmentDate })
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create assignment error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// PATCH /api/assignments/:id/confirm - substitute confirms
router.patch('/:id/confirm', requireRole('substitute'), async (req: AuthRequest, res: Response) => {
  try {
    const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'מחליפה לא נמצאה.' });

    const result = await query(`
      UPDATE assignments SET status = 'confirmed', substitute_confirmed_at = NOW()
      WHERE id = $1 AND substitute_id = $2 AND status = 'pending'
      RETURNING *
    `, [req.params.id, subResult.rows[0].id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא.' });
    }

    return res.json({ message: 'שיבוץ אושר בהצלחה.', assignment: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// PATCH /api/assignments/:id/arrive - substitute marks arrived
router.patch('/:id/arrive', requireRole('substitute', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      UPDATE assignments SET status = 'arrived', substitute_arrived_at = NOW()
      WHERE id = $1 AND status IN ('confirmed', 'pending')
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'שיבוץ לא נמצא.' });
    return res.json({ message: 'הגעה אושרה.', assignment: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// PATCH /api/assignments/:id/complete - mark completed with hours
router.patch('/:id/complete', requireRole('manager', 'authority_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { hoursWorked, hourlyRate } = req.body;
    const totalPay = hoursWorked && hourlyRate ? hoursWorked * hourlyRate : null;

    const result = await query(`
      UPDATE assignments SET 
        status = 'completed', 
        hours_worked = $1, 
        hourly_rate = $2,
        total_pay = $3
      WHERE id = $4
      RETURNING *
    `, [hoursWorked || null, hourlyRate || null, totalPay, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'שיבוץ לא נמצא.' });
    return res.json({ message: 'שיבוץ הושלם.', assignment: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// DELETE /api/assignments/:id - cancel assignment
router.delete('/:id', requireRole('manager', 'authority_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;

    const result = await query(`
      UPDATE assignments SET status = 'cancelled', cancellation_reason = $1
      WHERE id = $2 AND status NOT IN ('completed', 'cancelled')
      RETURNING *
    `, [reason || null, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'שיבוץ לא נמצא.' });

    // Reopen absence if linked
    if (result.rows[0].absence_id) {
      await query(`UPDATE absence_reports SET status = 'open' WHERE id = $1`, [result.rows[0].absence_id]);
    }

    return res.json({ message: 'שיבוץ בוטל.' });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// GET /api/assignments/export/csv - Madganet CSV export
router.get('/export/csv', requireRole('manager', 'authority_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'חודש ושנה נדרשים.' });

    const result = await query(`
      SELECT 
        u.id_number, u.first_name || ' ' || u.last_name as name,
        k.name as kindergarten, k.address,
        a.assignment_date, a.start_time, a.end_time,
        a.hours_worked, a.hourly_rate, a.total_pay
      FROM assignments a
      JOIN substitutes s ON a.substitute_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN kindergartens k ON a.kindergarten_id = k.id
      WHERE k.authority_id = $1
        AND EXTRACT(MONTH FROM a.assignment_date) = $2
        AND EXTRACT(YEAR FROM a.assignment_date) = $3
        AND a.status = 'completed'
      ORDER BY a.assignment_date, u.last_name
    `, [req.user!.authority_id, month, year]);

    // Build CSV
    const headers = ['תעודת זהות', 'שם', 'גן', 'כתובת', 'תאריך', 'שעת התחלה', 'שעת סיום', 'שעות', 'תעריף לשעה', 'סה"כ לתשלום'];
    const rows = result.rows.map(r => [
      r.id_number, r.name, r.kindergarten, r.address,
      r.assignment_date, r.start_time, r.end_time,
      r.hours_worked || '', r.hourly_rate || '', r.total_pay || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    // Log export
    await query(`
      INSERT INTO madganet_exports (authority_id, exported_by, export_month, export_year, assignments_count)
      VALUES ($1, $2, $3, $4, $5)
    `, [req.user!.authority_id, req.user!.id, month, year, result.rows.length]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=madganet_${year}_${month}.csv`);
    res.write('\uFEFF'); // BOM for Hebrew
    return res.end(csv);
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

export default router;
