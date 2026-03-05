import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/absences - list absence reports
router.get('/', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { date, status, kindergartenId, month, year } = req.query;
    const authorityId = req.user!.authority_id;

    let sql = `
      SELECT
        ar.*,
        k.name as kindergarten_name, k.address as kindergarten_address, k.neighborhood,
        u.first_name as reporter_first_name, u.last_name as reporter_last_name
      FROM absence_reports ar
      JOIN kindergartens k ON ar.kindergarten_id = k.id
      JOIN users u ON ar.reported_by = u.id
      WHERE k.authority_id = $1
    `;
    const params: unknown[] = [authorityId];
    let paramIdx = 2;

    if (date) {
      sql += ` AND ar.absence_date = $${paramIdx++}`;
      params.push(date);
    } else if (month && year) {
      sql += ` AND EXTRACT(MONTH FROM ar.absence_date) = $${paramIdx++} AND EXTRACT(YEAR FROM ar.absence_date) = $${paramIdx++}`;
      params.push(month, year);
    }

    if (status) {
      sql += ` AND ar.status = $${paramIdx++}`;
      params.push(status);
    }

    if (kindergartenId) {
      sql += ` AND ar.kindergarten_id = $${paramIdx++}`;
      params.push(kindergartenId);
    }

    sql += ` ORDER BY ar.absence_date DESC, ar.created_at DESC`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get absences error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// POST /api/absences - create absence report
router.post('/', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { kindergartenId, absentEmployeeName, absentEmployeeRole, absenceDate, absenceReason, notes } = req.body;

    if (!kindergartenId || !absentEmployeeName || !absenceDate) {
      return res.status(400).json({ error: 'חסרים שדות חובה: גן, שם עובדת, תאריך.' });
    }

    // Verify kindergarten belongs to authority
    const kgCheck = await query(
      'SELECT id FROM kindergartens WHERE id = $1 AND authority_id = $2',
      [kindergartenId, req.user!.authority_id]
    );
    if (kgCheck.rows.length === 0) {
      return res.status(400).json({ error: 'גן ילדים לא נמצא.' });
    }

    const result = await query(`
      INSERT INTO absence_reports (kindergarten_id, reported_by, absent_employee_name, absent_employee_role, absence_date, absence_reason, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
      RETURNING *
    `, [kindergartenId, req.user!.id, absentEmployeeName, absentEmployeeRole || 'teacher', absenceDate, absenceReason || null, notes || null]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create absence error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// PATCH /api/absences/:id - update absence report
router.patch('/:id', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIdx++}`);
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'אין שדות לעדכון.' });
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE absence_reports SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'דיווח היעדרות לא נמצא.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update absence error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// DELETE /api/absences/:id - delete absence report
router.delete('/:id', requireRole('manager', 'authority_admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM absence_reports WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'דיווח היעדרות לא נמצא.' });
    }

    return res.json({ message: 'דיווח נמחק.' });
  } catch (error) {
    console.error('Delete absence error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

export default router;
