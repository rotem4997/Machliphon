import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/kindergartens - list kindergartens for authority
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const authorityId = req.user!.authority_id;

    const result = await query(`
      SELECT id, name, address, neighborhood, principal_name, phone, age_group, capacity, is_active
      FROM kindergartens
      WHERE authority_id = $1 AND is_active = true
      ORDER BY name
    `, [authorityId]);

    return res.json(result.rows);
  } catch (error) {
    console.error('Get kindergartens error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

export default router;
