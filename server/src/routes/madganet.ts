import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.use(authenticate);
router.use(requireRole('authority_admin', 'manager', 'super_admin'));

// GET /api/madganet/exports — list export history for this authority
router.get('/exports', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(`
    SELECT me.*, u.first_name || ' ' || u.last_name as exported_by_name
    FROM madganet_exports me
    JOIN users u ON me.exported_by = u.id
    WHERE me.authority_id = $1
    ORDER BY me.exported_at DESC
    LIMIT 50
  `, [req.user!.authority_id]);
  return res.json(result.rows);
}));

export default router;
