import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { AuthenticationError, ForbiddenError, InternalError } from '../errors/AppError';

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
      throw new AuthenticationError('אין הרשאה. נדרשת כניסה למערכת.', {
        source: `${req.method} ${req.path}`,
        detail: 'Missing or malformed Authorization header',
      });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalError({
        source: 'authenticate middleware',
        detail: 'JWT_SECRET not configured on server',
      });
    }

    const decoded = jwt.verify(token, secret) as { userId: string };

    const result = await query(
      'SELECT id, email, role, authority_id, first_name, last_name FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('משתמש לא נמצא או אינו פעיל.', {
        source: `${req.method} ${req.path}`,
        detail: `User ${decoded.userId} not found or inactive`,
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError('טוקן לא תקין.', {
        source: `${req.method} ${req.path}`,
        detail: `JWT error: ${error.message}`,
      }));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('פג תוקף הכניסה. נדרשת כניסה מחדש.', {
        source: `${req.method} ${req.path}`,
        detail: 'Token expired',
      }));
    }
    next(error);
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('לא מחובר.', {
        source: `${req.method} ${req.path}`,
        detail: 'No user on request (authenticate middleware missing?)',
      }));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('אין הרשאה לבצע פעולה זו.', {
        source: `${req.method} ${req.path}`,
        detail: `User role "${req.user.role}" not in allowed roles: ${roles.join(', ')}`,
        meta: { userId: req.user.id, userRole: req.user.role, requiredRoles: roles },
      }));
    }
    next();
  };
};

export const requireSameAuthority = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role === 'super_admin') return next();

  const targetAuthorityId = req.params.authorityId || req.body.authorityId;
  if (targetAuthorityId && targetAuthorityId !== req.user?.authority_id) {
    return next(new ForbiddenError('אין הרשאה לגשת למידע של רשות אחרת.', {
      source: `${req.method} ${req.path}`,
      detail: `Authority mismatch: user=${req.user?.authority_id}, target=${targetAuthorityId}`,
    }));
  }
  next();
};
