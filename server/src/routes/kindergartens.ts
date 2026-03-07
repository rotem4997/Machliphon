import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.use(authenticate);

// GET /api/kindergartens
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const authorityId = req.user!.authority_id;
  const result = await query(`
    SELECT id, name, address, neighborhood, principal_name, phone, age_group, capacity, is_active
    FROM kindergartens WHERE authority_id = $1 AND is_active = true ORDER BY name
  `, [authorityId]);
  return res.json(result.rows);
}));

export default router;
