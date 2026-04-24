import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.use(authenticate);

// GET /api/notifications
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type } = req.query; // C4: filter by notification type
  let sql = 'SELECT * FROM notifications WHERE user_id = $1';
  const params: unknown[] = [req.user!.id];
  if (type) { sql += ' AND type = $2'; params.push(type); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  const result = await query(sql, params);
  return res.json(result.rows);
}));

// GET /api/notifications/unread-count
router.get('/unread-count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query('SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false', [req.user!.id]);
  return res.json({ count: parseInt(result.rows[0].count) });
}));

// PATCH /api/notifications/:id/read
router.patch('/:id/read', asyncHandler(async (req: AuthRequest, res: Response) => {
  await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
  return res.json({ message: 'סומן כנקרא.' });
}));

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', asyncHandler(async (req: AuthRequest, res: Response) => {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [req.user!.id]);
  return res.json({ message: 'כל ההתראות סומנו כנקראות.' });
}));

export default router;
