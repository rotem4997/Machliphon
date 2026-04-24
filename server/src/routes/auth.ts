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
  // Short-lived access token (1 h). Clients must use /auth/refresh to renew.
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });
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

  const newToken = jwt.sign({ userId: decoded.userId }, secret, { expiresIn: '1h' });
  return res.json({ token: newToken });
}));

// POST /api/auth/logout
// The server cannot blacklist tokens without a DB-backed token store (not implemented for MVP).
// The client MUST discard both the access token and refresh token on logout.
router.post('/logout', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  return res.json({ message: 'התנתקות בוצעה בהצלחה.' });
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

// PATCH /api/auth/me — A5: update own profile (name, phone; address for substitutes)
router.patch('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, phone, address } = req.body;
  if (firstName) {
    await query(
      'UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW() WHERE id = $4',
      [firstName, lastName || req.user!.last_name, phone || null, req.user!.id]
    );
  }
  if (address && req.user!.role === 'substitute') {
    await query('UPDATE substitutes SET address = $1, updated_at = NOW() WHERE user_id = $2', [address, req.user!.id]);
  }
  const updated = await query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone,
            u.authority_id, a.name as authority_name
     FROM users u LEFT JOIN authorities a ON u.authority_id = a.id WHERE u.id = $1`,
    [req.user!.id]
  );
  return res.json(updated.rows[0]);
}));

// POST /api/auth/forgot-password — C3: generate reset token (dev: returns token in response; prod: send email)
router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw new ValidationError('נדרש כתובת אימייל.', { source: 'POST /auth/forgot-password', detail: 'No email provided' });

  const userResult = await query('SELECT id, first_name FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
  // Always return 200 to avoid user enumeration
  if (userResult.rows.length === 0) {
    return res.json({ message: 'אם כתובת האימייל קיימת במערכת, קישור לאיפוס סיסמה ישלח בקרוב.' });
  }

  const secret = process.env.JWT_SECRET!;
  const resetToken = jwt.sign({ userId: userResult.rows[0].id, type: 'password_reset' }, secret, { expiresIn: '1h' });

  // In production: send email via nodemailer. For MVP, return token directly.
  // TODO: integrate nodemailer for production
  return res.json({
    message: 'קישור לאיפוס סיסמה נוצר. בסביבת פיתוח הטוקן מוחזר ישירות.',
    resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
  });
}));

// POST /api/auth/reset-password — C3: use reset token to set new password
router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) throw new ValidationError('חסרים שדות חובה.', { source: 'POST /auth/reset-password', detail: 'Missing resetToken or newPassword' });
  if (newPassword.length < 8) throw new ValidationError('סיסמה חדשה חייבת להיות לפחות 8 תווים.', { source: 'POST /auth/reset-password', detail: 'New password too short' });

  const secret = process.env.JWT_SECRET!;
  const decoded = jwt.verify(resetToken, secret) as { userId: string; type: string };
  if (decoded.type !== 'password_reset') throw new AuthenticationError('טוקן לא תקין.', { source: 'POST /auth/reset-password', detail: 'Token type mismatch' });

  const newHash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, decoded.userId]);

  return res.json({ message: 'הסיסמה אופסה בהצלחה. ניתן כעת להתחבר עם הסיסמה החדשה.' });
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
