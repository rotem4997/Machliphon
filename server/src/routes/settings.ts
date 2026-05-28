import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { query } from '../db/pool';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../errors/AppError';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

const DEFAULT_PREFERENCES = {
  notif_new_absence: true,
  notif_assignment_confirmed: true,
  notif_morning_summary: false,
  notif_assignment_cancelled: true,
  lang_hebrew: true,
  accessibility_mode: false,
};

const preferencesSchema = z.object({
  notif_new_absence: z.boolean().optional(),
  notif_assignment_confirmed: z.boolean().optional(),
  notif_morning_summary: z.boolean().optional(),
  notif_assignment_cancelled: z.boolean().optional(),
  lang_hebrew: z.boolean().optional(),
  accessibility_mode: z.boolean().optional(),
});

// GET / — return current user's preferences merged with defaults
router.get(
  '/',
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const userId = req.user!.id;

    const result = await query('SELECT preferences FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('משתמש לא נמצא', {
        source: 'GET /api/settings',
        detail: `User ${userId} not found`,
      });
    }

    const stored: Record<string, boolean> = result.rows[0].preferences ?? {};
    const preferences = { ...DEFAULT_PREFERENCES, ...stored };

    res.json({ preferences });
  }),
);

// PATCH / — merge new preference keys into existing JSONB
router.patch(
  '/',
  asyncHandler<AuthRequest>(async (req, res: Response) => {
    const userId = req.user!.id;

    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('נתונים לא תקינים', {
        source: 'PATCH /api/settings',
        detail: parsed.error.message,
      });
    }

    const updates = parsed.data;

    // Nothing to update — return current preferences
    if (Object.keys(updates).length === 0) {
      const current = await query('SELECT preferences FROM users WHERE id = $1', [userId]);
      const stored: Record<string, boolean> = current.rows[0]?.preferences ?? {};
      const preferences = { ...DEFAULT_PREFERENCES, ...stored };
      return res.json({ preferences });
    }

    const result = await query(
      `UPDATE users SET preferences = preferences || $1::jsonb WHERE id = $2 RETURNING preferences`,
      [JSON.stringify(updates), userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('משתמש לא נמצא', {
        source: 'PATCH /api/settings',
        detail: `User ${userId} not found`,
      });
    }

    const stored: Record<string, boolean> = result.rows[0].preferences ?? {};
    const preferences = { ...DEFAULT_PREFERENCES, ...stored };

    res.json({ preferences });
  }),
);

export default router;
