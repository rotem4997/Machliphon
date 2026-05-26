import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireMadriga } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

// GET /api/availability
// Substitute: their own availability rows.
// Madriga: all rows, with optional ?substitute_id= and ?date= filters.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    if (user.role === 'substitute') {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('substitute_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;
      res.json(data);
      return;
    }

    // Madriga: full list with optional filters
    let query = supabase.from('availability').select('*');

    const { substitute_id, date } = req.query;

    if (typeof substitute_id === 'string' && substitute_id.trim()) {
      query = query.eq('substitute_id', substitute_id.trim());
    }
    if (typeof date === 'string' && date.trim()) {
      query = query.eq('date', date.trim());
    }

    query = query.order('date', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/availability/:date
// Substitute only. Upsert availability for a specific date.
router.put(
  '/:date',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'substitute') {
        res.status(403).json({ error: 'רק מחליפות יכולות לעדכן זמינות' });
        return;
      }

      const { date } = req.params;
      const { is_available } = req.body as { is_available?: unknown };

      if (typeof is_available !== 'boolean') {
        res.status(400).json({ error: 'is_available חייב להיות ערך בוליאני' });
        return;
      }

      const { data, error } = await supabase
        .from('availability')
        .upsert(
          {
            substitute_id: user.id,
            date,
            is_available,
          },
          { onConflict: 'substitute_id,date' }
        )
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/availability/substitutes
// Madriga only. Returns all substitutes with their availability for a given ?date=.
router.get(
  '/substitutes',
  requireMadriga,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date } = req.query;

      if (typeof date !== 'string' || !date.trim()) {
        res.status(400).json({ error: 'פרמטר date הוא חובה' });
        return;
      }

      // Fetch all substitutes
      const { data: subs, error: subsError } = await supabase
        .from('users')
        .select('id, full_name, phone')
        .eq('role', 'substitute');

      if (subsError) throw subsError;

      interface SubstituteUser {
        id: string;
        full_name: string;
        phone: string;
      }

      interface AvailabilityRow {
        substitute_id: string;
        is_available: boolean;
      }

      const substitutes = (subs ?? []) as SubstituteUser[];

      if (substitutes.length === 0) {
        res.json([]);
        return;
      }

      const subIds = substitutes.map((s) => s.id);

      // Fetch availability for the given date
      const { data: availRows, error: availError } = await supabase
        .from('availability')
        .select('substitute_id, is_available')
        .in('substitute_id', subIds)
        .eq('date', date.trim());

      if (availError) throw availError;

      const availMap = new Map<string, boolean>();
      for (const row of (availRows ?? []) as AvailabilityRow[]) {
        availMap.set(row.substitute_id, row.is_available);
      }

      const result = substitutes.map((sub) => ({
        id: sub.id,
        full_name: sub.full_name,
        phone: sub.phone,
        // No row → available by default
        is_available: availMap.has(sub.id) ? availMap.get(sub.id) : true,
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
