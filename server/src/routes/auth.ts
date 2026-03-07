import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError, AuthenticationError } from '../errors/AppError';

const router = Router();

const LoginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להיות לפחות 6 תווים'),
});

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError(result.error.errors[0].message, {
      source: 'POST /api/auth/login',
      detail: `Zod validation failed: ${result.error.errors.map(e => e.message).join(', ')}`,
      meta: { fields: result.error.errors.map(e => e.path.join('.')) },
    });
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
    throw new AuthenticationError('אימייל או סיסמה שגויים.', {
      source: 'POST /api/auth/login',
      detail: `No active user found for email: ${email}`,
    });
  }

  const user = userResult.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    throw new AuthenticationError('אימייל או סיסמה שגויים.', {
      source: 'POST /api/auth/login',
      detail: `Invalid password for user ${user.id}`,
    });
  }

  const secret = process.env.JWT_SECRET!;
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, secret, { expiresIn: '30d' });

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

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
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ValidationError('חסר refresh token.', {
      source: 'POST /api/auth/refresh',
      detail: 'Missing refreshToken in request body',
    });
  }

  const secret = process.env.JWT_SECRET!;
  const decoded = jwt.verify(refreshToken, secret) as { userId: string; type: string };

  if (decoded.type !== 'refresh') {
    throw new AuthenticationError('טוקן לא תקין.', {
      source: 'POST /api/auth/refresh',
      detail: 'Token type is not refresh',
    });
  }

  const userResult = await query(
    'SELECT id FROM users WHERE id = $1 AND is_active = true',
    [decoded.userId]
  );

  if (userResult.rows.length === 0) {
    throw new AuthenticationError('משתמש לא נמצא.', {
      source: 'POST /api/auth/refresh',
      detail: `User ${decoded.userId} not found or inactive`,
    });
  }

  const newToken = jwt.sign({ userId: decoded.userId }, secret, { expiresIn: '7d' });
  return res.json({ token: newToken });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone,
            u.authority_id, a.name as authority_name, u.last_login
     FROM users u
     LEFT JOIN authorities a ON u.authority_id = a.id
     WHERE u.id = $1`,
    [req.user!.id]
  );
  return res.json(result.rows[0]);
}));

// POST /api/auth/change-password
router.post('/change-password', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    throw new ValidationError('סיסמה חדשה חייבת להיות לפחות 8 תווים.', {
      source: 'POST /api/auth/change-password',
      detail: 'New password too short or missing',
    });
  }

  const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

  if (!isValid) {
    throw new ValidationError('הסיסמה הנוכחית שגויה.', {
      source: 'POST /api/auth/change-password',
      detail: `Invalid current password for user ${req.user!.id}`,
    });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.id]);

  return res.json({ message: 'הסיסמה שונתה בהצלחה.' });
}));

export default router;
