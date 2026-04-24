import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { NotFoundError, ValidationError } from '../errors/AppError';

const router = Router();
router.use(authenticate);

// GET /api/manager-kindergartens — C1: list all manager↔kindergarten assignments for authority
router.get('/', requireRole('authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    SELECT
      mk.manager_id, mk.kindergarten_id,
      u.first_name || ' ' || u.last_name as manager_name,
      u.email as manager_email,
      m.region,
      k.name as kindergarten_name, k.neighborhood, k.address
    FROM manager_kindergartens mk
    JOIN managers m ON mk.manager_id = m.id
    JOIN users u ON m.user_id = u.id
    JOIN kindergartens k ON mk.kindergarten_id = k.id
    WHERE m.authority_id = $1
    ORDER BY u.last_name, k.name
  `, [req.user!.authority_id]);
  return res.json(result.rows);
}));

// GET /api/manager-kindergartens/my — manager sees their own assigned kindergartens
router.get('/my', requireRole('manager'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const mgr = await query('SELECT id FROM managers WHERE user_id = $1', [req.user!.id]);
  if (mgr.rows.length === 0) throw new NotFoundError('פרופיל מנהלת לא נמצא.', { source: 'GET /manager-kindergartens/my', detail: `No manager for user ${req.user!.id}` });

  const result = await query(`
    SELECT k.id, k.name, k.address, k.neighborhood, k.phone, k.principal_name, k.age_group, k.is_active
    FROM kindergartens k
    JOIN manager_kindergartens mk ON k.id = mk.kindergarten_id
    WHERE mk.manager_id = $1 AND k.is_active = true
    ORDER BY k.name
  `, [mgr.rows[0].id]);
  return res.json(result.rows);
}));

// POST /api/manager-kindergartens — C1: assign a manager to a kindergarten
router.post('/', requireRole('authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { managerId, kindergartenId } = req.body;
  if (!managerId || !kindergartenId) throw new ValidationError('חסרים managerId ו-kindergartenId.', { source: 'POST /api/manager-kindergartens', detail: 'Missing fields' });

  // Verify both belong to this authority
  const mgrCheck = await query('SELECT id FROM managers WHERE id = $1 AND authority_id = $2', [managerId, req.user!.authority_id]);
  const kgCheck = await query('SELECT id FROM kindergartens WHERE id = $1 AND authority_id = $2', [kindergartenId, req.user!.authority_id]);
  if (mgrCheck.rows.length === 0) throw new NotFoundError('מנהלת לא נמצאה.', { source: 'POST /api/manager-kindergartens', detail: `Manager ${managerId} not in authority` });
  if (kgCheck.rows.length === 0) throw new NotFoundError('גן לא נמצא.', { source: 'POST /api/manager-kindergartens', detail: `KG ${kindergartenId} not in authority` });

  await query('INSERT INTO manager_kindergartens (manager_id, kindergarten_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [managerId, kindergartenId]);

  // Update count
  await query('UPDATE managers SET managed_kindergartens_count = (SELECT COUNT(*) FROM manager_kindergartens WHERE manager_id = $1) WHERE id = $1', [managerId]);

  return res.status(201).json({ message: 'גן שויך למנהלת בהצלחה.' });
}));

// DELETE /api/manager-kindergartens — C1: remove manager↔kindergarten assignment
router.delete('/', requireRole('authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { managerId, kindergartenId } = req.body;
  if (!managerId || !kindergartenId) throw new ValidationError('חסרים managerId ו-kindergartenId.', { source: 'DELETE /api/manager-kindergartens', detail: 'Missing fields' });

  const result = await query(
    'DELETE FROM manager_kindergartens WHERE manager_id = $1 AND kindergarten_id = $2 RETURNING manager_id',
    [managerId, kindergartenId]
  );
  if (result.rows.length === 0) throw new NotFoundError('שיוך לא נמצא.', { source: 'DELETE /api/manager-kindergartens', detail: `No mapping for manager ${managerId} KG ${kindergartenId}` });

  await query('UPDATE managers SET managed_kindergartens_count = (SELECT COUNT(*) FROM manager_kindergartens WHERE manager_id = $1) WHERE id = $1', [managerId]);

  return res.json({ message: 'השיוך הוסר.' });
}));

// GET /api/manager-kindergartens/managers — list all managers for authority (for UI dropdowns)
router.get('/managers', requireRole('authority_admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    SELECT m.id, u.first_name, u.last_name, u.email, m.region, m.managed_kindergartens_count
    FROM managers m JOIN users u ON m.user_id = u.id
    WHERE m.authority_id = $1
    ORDER BY u.last_name
  `, [req.user!.authority_id]);
  return res.json(result.rows);
}));

export default router;
