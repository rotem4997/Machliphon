import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const LoginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להיות לפחות 6 תווים'),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }

    const { email, password } = result.data;

    const userResult = await query(
      `SELECT u.*, a.name as authority_name 
       FROM users u 
       LEFT JOIN authorities a ON u.authority_id = a.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים.' });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים.' });
    }

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, secret, { expiresIn: '30d' });

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Get extra profile data based on role
    let profile = null;
    if (user.role === 'substitute') {
      const sub = await query('SELECT * FROM substitutes WHERE user_id = $1', [user.id]);
      profile = sub.rows[0] || null;
    } else if (user.role === 'manager') {
      const mgr = await query('SELECT * FROM managers WHERE user_id = $1', [user.id]);
      profile = mgr.rows[0] || null;
    }

    return res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        authorityId: user.authority_id,
        authorityName: user.authority_name,
        profile,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'שגיאת שרת. נסה שנית.',
      debug: error?.message || String(error),
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'חסר refresh token.' });

    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(refreshToken, secret) as { userId: string; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'טוקן לא תקין.' });
    }

    const userResult = await query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'משתמש לא נמצא.' });
    }

    const newToken = jwt.sign({ userId: decoded.userId }, secret, { expiresIn: '7d' });
    return res.json({ token: newToken });
  } catch (error) {
    return res.status(401).json({ error: 'טוקן לא תקין או פג תוקף.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, 
              u.authority_id, a.name as authority_name, u.last_login
       FROM users u 
       LEFT JOIN authorities a ON u.authority_id = a.id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'סיסמה חדשה חייבת להיות לפחות 8 תווים.' });
    }

    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

    if (!isValid) {
      return res.status(400).json({ error: 'הסיסמה הנוכחית שגויה.' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.id]);

    return res.json({ message: 'הסיסמה שונתה בהצלחה.' });
  } catch (error) {
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
});

export default router;
