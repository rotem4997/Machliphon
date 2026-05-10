import { Router, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError, ConflictError } from '../errors/AppError';
import { upload } from '../middleware/upload';

const createSubstituteSchema = z.object({
  firstName: z.string().min(1, 'שם פרטי נדרש'),
  lastName: z.string().min(1, 'שם משפחה נדרש'),
  phone: z.string().regex(/^\d{10}$/, 'מספר טלפון חייב להכיל 10 ספרות'),
  email: z.string().email('כתובת אימייל לא תקינה'),
  idNumber: z.string().regex(/^\d{9}$/, 'תעודת זהות חייבת להכיל 9 ספרות'),
  street: z.string().optional().default(''),
  city: z.string().optional().default(''),
  zipCode: z.string().optional().default(''),
  educationLevel: z.string().optional().default(''),
});

const router = Router();
router.use(authenticate);

// GET /api/substitutes - list substitutes for authority (paginated)
router.get('/', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  // super_admin can override via query param; falls back to own authority_id
  const authorityId = req.user!.role === 'super_admin'
    ? (req.query.authorityId ?? req.user!.authority_id)
    : req.user!.authority_id;

  const { status, neighborhood, permitValid, search } = req.query;
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = ['s.authority_id = $1'];
  const params: unknown[] = [authorityId];
  let paramIdx = 2;

  if (status) {
    whereClauses.push(`s.status = $${paramIdx++}`);
    params.push(status);
  }
  if (neighborhood) {
    whereClauses.push(`s.neighborhood = $${paramIdx++}`);
    params.push(neighborhood);
  }
  if (permitValid === 'true') {
    whereClauses.push(`s.work_permit_valid = true AND s.work_permit_expiry > CURRENT_DATE`);
  } else if (permitValid === 'false') {
    whereClauses.push(`(s.work_permit_valid = false OR s.work_permit_expiry <= CURRENT_DATE)`);
  }
  if (search) {
    whereClauses.push(`(u.first_name ILIKE $${paramIdx} OR u.last_name ILIKE $${paramIdx} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIdx} OR u.phone ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = whereClauses.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*) FROM substitutes s JOIN users u ON s.user_id = u.id WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query(`
    SELECT
      s.*,
      u.first_name, u.last_name, u.email, u.phone,
      u.is_active as user_active,
      EXISTS(
        SELECT 1 FROM assignments a
        WHERE a.substitute_id = s.id
        AND a.assignment_date = CURRENT_DATE
        AND a.status NOT IN ('cancelled')
      ) as has_assignment_today,
      (SELECT COUNT(*) FROM assignments a WHERE a.substitute_id = s.id
       AND DATE_TRUNC('month', a.assignment_date) = DATE_TRUNC('month', CURRENT_DATE)
       AND a.status = 'completed') as assignments_this_month
    FROM substitutes s
    JOIN users u ON s.user_id = u.id
    WHERE ${where}
    ORDER BY u.last_name, u.first_name
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `, [...params, limit, offset]);

  return res.json({
    data: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// GET /api/substitutes/available - available for a specific date
router.get('/available', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, neighborhood } = req.query;
  const authorityId = req.user!.authority_id;

  if (!date) {
    throw new ValidationError('תאריך נדרש.', {
      source: 'GET /api/substitutes/available',
      detail: 'Missing required query param: date',
    });
  }

  const result = await query(`
    SELECT
      s.id, s.neighborhood, s.work_permit_valid, s.work_permit_expiry,
      s.education_level, s.total_assignments,
      u.first_name, u.last_name, u.phone,
      NOT EXISTS(
        SELECT 1 FROM substitute_availability sa
        WHERE sa.substitute_id = s.id AND sa.date = $2 AND sa.is_available = false
      ) as is_available,
      NOT EXISTS(
        SELECT 1 FROM assignments a
        WHERE a.substitute_id = s.id AND a.assignment_date = $2
        AND a.status NOT IN ('cancelled')
      ) as not_assigned
    FROM substitutes s
    JOIN users u ON s.user_id = u.id
    WHERE s.authority_id = $1
      AND s.status = 'active'
      AND s.work_permit_valid = true
      AND (s.work_permit_expiry IS NULL OR s.work_permit_expiry > $2::date)
      ${neighborhood ? "AND s.neighborhood = $3" : ""}
    ORDER BY s.total_assignments ASC, u.last_name, u.first_name
  `, neighborhood ? [authorityId, date, neighborhood] : [authorityId, date]);

  const available = result.rows.filter(r => r.is_available && r.not_assigned);
  return res.json(available);
}));

// GET /api/substitutes/me - substitute views own profile
router.get('/me', requireRole('substitute'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    SELECT s.*, u.first_name, u.last_name, u.email, u.phone
    FROM substitutes s
    JOIN users u ON s.user_id = u.id
    WHERE s.user_id = $1
  `, [req.user!.id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('פרופיל לא נמצא.', {
      source: 'GET /api/substitutes/me',
      detail: `No substitute profile found for user ${req.user!.id}`,
    });
  }

  const upcoming = await query(`
    SELECT a.*, k.name as kindergarten_name, k.address as kindergarten_address
    FROM assignments a
    JOIN kindergartens k ON a.kindergarten_id = k.id
    WHERE a.substitute_id = $1
      AND a.assignment_date >= CURRENT_DATE
      AND a.status NOT IN ('cancelled', 'completed')
    ORDER BY a.assignment_date
    LIMIT 10
  `, [result.rows[0].id]);

  return res.json({
    ...result.rows[0],
    upcomingAssignments: upcoming.rows,
  });
}));

// GET /api/substitutes/availability — get own availability records for a month
router.get('/availability', requireRole('substitute'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month, year } = req.query;
  const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
  if (subResult.rows.length === 0) return res.json([]);

  let sql = 'SELECT * FROM substitute_availability WHERE substitute_id = $1';
  const params: unknown[] = [subResult.rows[0].id];
  if (month && year) {
    sql += ' AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3';
    params.push(month, year);
  }
  sql += ' ORDER BY date';
  const result = await query(sql, params);
  return res.json(result.rows);
}));

// PUT /api/substitutes/availability - substitute sets availability
router.put('/availability', requireRole('substitute'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, isAvailable, reason } = req.body;

  if (!date) {
    throw new ValidationError('תאריך נדרש.', {
      source: 'PUT /api/substitutes/availability',
      detail: 'Missing date in request body',
    });
  }

  const subResult = await query('SELECT id FROM substitutes WHERE user_id = $1', [req.user!.id]);
  if (subResult.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה.', {
      source: 'PUT /api/substitutes/availability',
      detail: `No substitute profile for user ${req.user!.id}`,
    });
  }

  const substituteId = subResult.rows[0].id;

  await query(`
    INSERT INTO substitute_availability (substitute_id, date, is_available, reason)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (substitute_id, date) DO UPDATE SET is_available = $3, reason = $4
  `, [substituteId, date, isAvailable, reason || null]);

  return res.json({ message: 'זמינות עודכנה בהצלחה.' });
}));

// POST /api/substitutes - create new substitute (creates user + substitute record)
router.post('/', requireRole('manager', 'authority_admin', 'super_admin'), upload.single('teachingLicense'), asyncHandler(async (req: AuthRequest, res: Response) => {
  // Validate with Zod
  const parsed = createSubstituteSchema.safeParse(req.body);
  if (!parsed.success) {
    // Clean up uploaded file if validation fails
    if (req.file) fs.unlinkSync(req.file.path);
    const firstError = parsed.error.errors[0]?.message || 'שדות לא תקינים';
    throw new ValidationError(firstError, {
      source: 'POST /api/substitutes',
      detail: JSON.stringify(parsed.error.errors),
    });
  }

  const { firstName, lastName, phone, email, idNumber, street, city, zipCode, educationLevel } = parsed.data;
  const authorityId = req.user!.authority_id;

  // Check for duplicate email or ID number
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    if (req.file) fs.unlinkSync(req.file.path);
    throw new ConflictError('כתובת אימייל כבר קיימת במערכת.', {
      source: 'POST /api/substitutes',
      detail: `Email ${email} already exists`,
    });
  }
  const existingSub = await query('SELECT id FROM substitutes WHERE id_number = $1', [idNumber]);
  if (existingSub.rows.length > 0) {
    if (req.file) fs.unlinkSync(req.file.path);
    throw new ConflictError('מספר תעודת זהות כבר קיים במערכת.', {
      source: 'POST /api/substitutes',
      detail: `ID number ${idNumber} already exists`,
    });
  }

  // Generate a cryptographically random temporary password
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Build address string
  const addressParts = [street, city, zipCode].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;
  const teachingLicenseUrl = req.file ? `/uploads/${req.file.filename}` : null;

  // Wrap both inserts in a transaction
  await query('BEGIN');
  try {
    const userResult = await query(`
      INSERT INTO users (authority_id, email, password_hash, role, first_name, last_name, phone)
      VALUES ($1, $2, $3, 'substitute', $4, $5, $6) RETURNING id
    `, [authorityId, email, passwordHash, firstName, lastName, phone]);
    const userId = userResult.rows[0].id;

    const subResult = await query(`
      INSERT INTO substitutes (user_id, authority_id, id_number, address, education_level, teaching_license_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending_approval') RETURNING id
    `, [userId, authorityId, idNumber, address, educationLevel || null, teachingLicenseUrl]);

    await query('COMMIT');

    return res.status(201).json({
      id: subResult.rows[0].id,
      message: 'מחליפה נוצרה בהצלחה וממתינה לאישור.',
    });
  } catch (err) {
    await query('ROLLBACK');
    if (req.file) fs.unlinkSync(req.file.path);
    throw err;
  }
}));

// PATCH /api/substitutes/:id/approve - approve a pending substitute
router.patch('/:id/approve', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const isSuperAdmin = req.user!.role === 'super_admin';
  const sql = `
    UPDATE substitutes SET status = 'active', updated_at = NOW()
    WHERE id = $1 ${isSuperAdmin ? '' : 'AND authority_id = $2'} AND status = 'pending_approval'
    RETURNING id, user_id
  `;
  const params = isSuperAdmin ? [req.params.id] : [req.params.id, req.user!.authority_id];
  const result = await query(sql, params);

  if (result.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה או כבר אושרה.', {
      source: 'PATCH /api/substitutes/:id/approve',
      detail: `Substitute ${req.params.id} not found or not pending`,
    });
  }

  // Send notification to the substitute
  await query(`
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES ($1, 'account_approved', 'החשבון אושר', 'החשבון שלך אושר על ידי המדריכה. כעת ניתן לקבל שיבוצים.', $2)
  `, [result.rows[0].user_id, JSON.stringify({ substituteId: req.params.id })]);

  return res.json({ message: 'מחליפה אושרה בהצלחה.' });
}));

// PATCH /api/substitutes/:id/reject — A7: reject a pending substitute with reason
router.patch('/:id/reject', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const isSuperAdmin = req.user!.role === 'super_admin';
  const sql = `
    UPDATE substitutes SET status = 'inactive', updated_at = NOW()
    WHERE id = $1 ${isSuperAdmin ? '' : 'AND authority_id = $2'} AND status = 'pending_approval'
    RETURNING id, user_id
  `;
  const params = isSuperAdmin ? [req.params.id] : [req.params.id, req.user!.authority_id];
  const result = await query(sql, params);

  if (result.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה או כבר טופלה.', {
      source: 'PATCH /api/substitutes/:id/reject',
      detail: `Substitute ${req.params.id} not found or not pending`,
    });
  }

  const notifMsg = reason
    ? `בקשתך נדחתה. סיבה: ${reason}`
    : 'בקשתך נדחתה על ידי המדריכה.';

  await query(`
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES ($1, 'account_rejected', 'בקשה נדחתה', $2, $3)
  `, [result.rows[0].user_id, notifMsg, JSON.stringify({ substituteId: req.params.id, reason: reason || null })]);

  return res.json({ message: 'מחליפה נדחתה.' });
}));

// ── Shared Zod schemas for unavailability endpoints ──────────────────────────

const dateRangeSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fromDate חייב להיות בפורמט YYYY-MM-DD'),
  toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'toDate חייב להיות בפורמט YYYY-MM-DD'),
});

const unavailabilityBodySchema = dateRangeSchema.extend({
  reason: z.enum(['vacation', 'sick', 'personal', 'training', 'other']).optional(),
});

/** Returns every date from fromDate to toDate (inclusive) as 'YYYY-MM-DD' strings. */
function expandDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(fromDate);
  const end     = new Date(toDate);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Resolves the substitute record, enforcing that it belongs to req.user's authority.
 * Throws NotFoundError (404) when the substitute does not exist or is from a different authority.
 */
async function resolveSubstituteForAuthority(
  substituteId: string,
  authorityId: string,
  source: string,
): Promise<string> {
  const result = await query(
    'SELECT id FROM substitutes WHERE id = $1 AND authority_id = $2',
    [substituteId, authorityId],
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה.', {
      source,
      detail: `Substitute ${substituteId} not found in authority ${authorityId}`,
      meta: { substituteId, authorityId },
    });
  }
  return result.rows[0].id as string;
}

// ── t006: Manager-managed unavailability for a substitute ─────────────────────

// GET /api/substitutes/:id/unavailability
router.get(
  '/:id/unavailability',
  requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const source = 'GET /api/substitutes/:id/unavailability';
    await resolveSubstituteForAuthority(req.params.id, req.user!.authority_id!, source);

    const { month, year } = req.query;

    const whereClauses: string[] = [
      'substitute_id = $1',
      'is_available = false',
    ];
    const params: unknown[] = [req.params.id];
    let paramIdx = 2;

    if (month !== undefined) {
      const m = parseInt(month as string, 10);
      if (isNaN(m) || m < 1 || m > 12) {
        throw new ValidationError('חודש חייב להיות מספר בין 1 ל-12.', {
          source,
          detail: `Invalid month query param: "${month}"`,
        });
      }
      whereClauses.push(`EXTRACT(MONTH FROM date) = $${paramIdx++}`);
      params.push(m);
    }

    if (year !== undefined) {
      const y = parseInt(year as string, 10);
      if (isNaN(y) || y < 2000 || y > 2100) {
        throw new ValidationError('שנה לא תקינה.', {
          source,
          detail: `Invalid year query param: "${year}"`,
        });
      }
      whereClauses.push(`EXTRACT(YEAR FROM date) = $${paramIdx++}`);
      params.push(y);
    }

    const result = await query(
      `SELECT id, date, reason
       FROM substitute_availability
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY date`,
      params,
    );

    return res.json(result.rows);
  }),
);

// POST /api/substitutes/:id/unavailability
router.post(
  '/:id/unavailability',
  requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const source = 'POST /api/substitutes/:id/unavailability';

    const parsed = unavailabilityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors[0]?.message || 'נתונים לא תקינים.',
        { source, detail: JSON.stringify(parsed.error.errors) },
      );
    }

    const { fromDate, toDate, reason } = parsed.data;

    if (fromDate > toDate) {
      throw new ValidationError('תאריך התחלה חייב להיות לפני תאריך הסיום.', {
        source,
        detail: `fromDate (${fromDate}) is after toDate (${toDate})`,
      });
    }

    await resolveSubstituteForAuthority(req.params.id, req.user!.authority_id!, source);

    const dates = expandDateRange(fromDate, toDate);

    if (dates.length > 90) {
      throw new ValidationError('טווח התאריכים לא יכול לעלות על 90 יום.', {
        source,
        detail: `Date range ${fromDate} – ${toDate} spans ${dates.length} days (max 90)`,
      });
    }

    // Upsert each date in a single transaction
    await query('BEGIN');
    try {
      for (const date of dates) {
        await query(
          `INSERT INTO substitute_availability (substitute_id, date, is_available, reason)
           VALUES ($1, $2, false, $3)
           ON CONFLICT (substitute_id, date)
           DO UPDATE SET is_available = false, reason = EXCLUDED.reason`,
          [req.params.id, date, reason ?? null],
        );
      }
      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

    return res.json({
      message: 'זמינות עודכנה בהצלחה',
      datesUpdated: dates.length,
    });
  }),
);

// DELETE /api/substitutes/:id/unavailability
router.delete(
  '/:id/unavailability',
  requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const source = 'DELETE /api/substitutes/:id/unavailability';

    const parsed = dateRangeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors[0]?.message || 'נתונים לא תקינים.',
        { source, detail: JSON.stringify(parsed.error.errors) },
      );
    }

    const { fromDate, toDate } = parsed.data;

    if (fromDate > toDate) {
      throw new ValidationError('תאריך התחלה חייב להיות לפני תאריך הסיום.', {
        source,
        detail: `fromDate (${fromDate}) is after toDate (${toDate})`,
      });
    }

    await resolveSubstituteForAuthority(req.params.id, req.user!.authority_id!, source);

    const result = await query(
      `DELETE FROM substitute_availability
       WHERE substitute_id = $1
         AND date BETWEEN $2::date AND $3::date
       RETURNING id`,
      [req.params.id, fromDate, toDate],
    );

    return res.json({
      message: 'זמינות שוחזרה בהצלחה',
      datesCleared: result.rowCount ?? result.rows.length,
    });
  }),
);

// ── t007: Paginated assignment history for a substitute ───────────────────────

// GET /api/substitutes/:id/assignments
router.get(
  '/:id/assignments',
  requireRole('manager', 'authority_admin', 'super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const source = 'GET /api/substitutes/:id/assignments';
    await resolveSubstituteForAuthority(req.params.id, req.user!.authority_id!, source);

    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const whereClauses: string[] = ['a.substitute_id = $1'];
    const params: unknown[] = [req.params.id];
    let paramIdx = 2;

    if (status) {
      whereClauses.push(`a.status = $${paramIdx++}`);
      params.push(status);
    }

    const where = whereClauses.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM assignments a WHERE ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await query(
      `SELECT
         a.id,
         a.assignment_date,
         a.status,
         a.start_time,
         a.end_time,
         a.hours_worked,
         a.total_pay,
         a.notes,
         k.name    AS kindergarten_name,
         k.address AS kindergarten_address
       FROM assignments a
       JOIN kindergartens k ON a.kindergarten_id = k.id
       WHERE ${where}
       ORDER BY a.assignment_date DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    return res.json({
      data: dataResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

// GET /api/substitutes/:id - get single substitute
router.get('/:id', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    SELECT s.*, u.first_name, u.last_name, u.email, u.phone
    FROM substitutes s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = $1 AND s.authority_id = $2
  `, [req.params.id, req.user!.authority_id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('מחליפה לא נמצאה.', {
      source: 'GET /api/substitutes/:id',
      detail: `Substitute ${req.params.id} not found in authority ${req.user!.authority_id}`,
      meta: { substituteId: req.params.id },
    });
  }

  const recentAssignments = await query(`
    SELECT a.*, k.name as kindergarten_name
    FROM assignments a
    JOIN kindergartens k ON a.kindergarten_id = k.id
    WHERE a.substitute_id = $1
    ORDER BY a.assignment_date DESC
    LIMIT 20
  `, [req.params.id]);

  return res.json({
    ...result.rows[0],
    recentAssignments: recentAssignments.rows,
  });
}));

// PATCH /api/substitutes/:id/permit - update work permit
router.patch('/:id/permit', requireRole('manager', 'authority_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { workPermitValid, workPermitExpiry, workPermitNumber } = req.body;

  await query(`
    UPDATE substitutes SET
      work_permit_valid = $1,
      work_permit_expiry = $2,
      work_permit_number = $3,
      updated_at = NOW()
    WHERE id = $4 AND authority_id = $5
  `, [workPermitValid, workPermitExpiry || null, workPermitNumber || null, req.params.id, req.user!.authority_id]);

  return res.json({ message: 'תיק עובד עודכן בהצלחה.' });
}));

// POST /api/substitutes/:id/upload-license — upload teaching license / work permit document
router.post('/:id/upload-license', requireRole('manager', 'authority_admin'), upload.single('licenseFile'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    throw new ValidationError('לא נמצא קובץ להעלאה.', { source: 'POST /substitutes/:id/upload-license', detail: 'No file in request' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  const result = await query(
    `UPDATE substitutes SET teaching_license_url = $1, updated_at = NOW()
     WHERE id = $2 AND authority_id = $3 RETURNING id`,
    [fileUrl, req.params.id, req.user!.authority_id]
  );
  if (result.rows.length === 0) {
    // Remove orphaned uploaded file
    fs.unlink(req.file.path, () => {});
    throw new NotFoundError('מחליפה לא נמצאה.', { source: 'POST /substitutes/:id/upload-license', detail: `Substitute ${req.params.id} not found` });
  }
  return res.json({ message: 'קובץ הועלה בהצלחה.', url: fileUrl });
}));

export default router;
