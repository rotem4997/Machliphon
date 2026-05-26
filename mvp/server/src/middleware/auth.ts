import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }

    const token = authHeader.slice(7);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ error: 'טוקן לא תקין' });
      return;
    }

    const { data: userRow, error: dbError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (dbError || !userRow) {
      res.status(401).json({ error: 'משתמש לא נמצא' });
      return;
    }

    req.user = { id: userRow.id as string, role: userRow.role as string };
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireMadriga(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, async () => {
    if (req.user?.role !== 'madriga') {
      res.status(403).json({ error: 'אין הרשאה לפעולה זו' });
      return;
    }
    next();
  });
}
