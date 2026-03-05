import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/notifications - get user's notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user!.id]);

    return res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user!.id]
    );
    return res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// PATCH /api/notifications/:id/read - mark as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    return res.json({ message: 'סומן כנקרא.' });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user!.id]
    );
    return res.json({ message: 'כל ההתראות סומנו כנקראות.' });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

export default router;
