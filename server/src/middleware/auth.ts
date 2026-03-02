import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    authority_id: string | null;
    first_name: string;
    last_name: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'אין הרשאה. נדרשת כניסה למערכת.' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const decoded = jwt.verify(token, secret) as { userId: string };

    const result = await query(
      'SELECT id, email, role, authority_id, first_name, last_name FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'משתמש לא נמצא או אינו פעיל.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'טוקן לא תקין.' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'פג תוקף הכניסה. נדרשת כניסה מחדש.' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'שגיאת שרת.' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'לא מחובר.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'אין הרשאה לבצע פעולה זו.' });
    }
    next();
  };
};

export const requireSameAuthority = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Super admin bypasses authority check
  if (req.user?.role === 'super_admin') return next();

  const targetAuthorityId = req.params.authorityId || req.body.authorityId;
  if (targetAuthorityId && targetAuthorityId !== req.user?.authority_id) {
    return res.status(403).json({ error: 'אין הרשאה לגשת למידע של רשות אחרת.' });
  }
  next();
};
