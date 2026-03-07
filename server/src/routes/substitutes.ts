import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, NotFoundError } from '../errors/AppError';

const router = Router();
router.use(authenticate);

// GET /api/substitutes - list substitutes for authority
router.get('/', requireRole('manager', 'authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const authorityId = req.user!.role === 'super_admin'
    ? req.query.authorityId
    : req.user!.authority_id;

  const { status, neighborhood, permitValid } = req.query;

  let sql = `
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
    WHERE s.authority_id = $1
  `;
  const params: unknown[] = [authorityId];
  let paramIdx = 2;

  if (status) {
    sql += ` AND s.status = $${paramIdx++}`;
    params.push(status);
  }
  if (neighborhood) {
    sql += ` AND s.neighborhood = $${paramIdx++}`;
    params.push(neighborhood);
  }
  if (permitValid === 'true') {
    sql += ` AND s.work_permit_valid = true AND s.work_permit_expiry > CURRENT_DATE`;
  } else if (permitValid === 'false') {
    sql += ` AND (s.work_permit_valid = false OR s.work_permit_expiry <= CURRENT_DATE)`;
  }

  sql += ` ORDER BY u.last_name, u.first_name`;

  const result = await query(sql, params);
  return res.json(result.rows);
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

export default router;
