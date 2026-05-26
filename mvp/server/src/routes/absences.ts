import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireMadriga } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { sendSms, buildAbsenceMessage } from '../lib/sms';

const router = Router();

interface AbsenceRow {
  id: string;
  created_by: string;
  kindergarten_name: string;
  date: string;
  notes: string | null;
  status: 'open' | 'assigned' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface AvailabilityRow {
  substitute_id: string;
  is_available: boolean;
}

interface UserRow {
  id: string;
  phone: string;
}

// GET /api/absences
// Madriga: all absences ordered by date desc.
// Substitute: only open absences.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let query = supabase
      .from('absences')
      .select('*')
      .order('date', { ascending: false });

    if (user.role === 'substitute') {
      query = query.eq('status', 'open');
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/absences
// Madriga only. Creates absence and sends SMS to available substitutes.
router.post('/', requireMadriga, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kindergarten_name, date, notes } = req.body as {
      kindergarten_name?: unknown;
      date?: unknown;
      notes?: unknown;
    };

    if (
      typeof kindergarten_name !== 'string' ||
      !kindergarten_name.trim() ||
      typeof date !== 'string' ||
      !date.trim()
    ) {
      res.status(400).json({ error: 'שם הגן ותאריך הם שדות חובה' });
      return;
    }

    const { data: absence, error: insertError } = await supabase
      .from('absences')
      .insert({
        created_by: req.user!.id,
        kindergarten_name: kindergarten_name.trim(),
        date: date.trim(),
        notes: typeof notes === 'string' ? notes.trim() || null : null,
        status: 'open',
      })
      .select()
      .single();

    if (insertError || !absence) {
      throw insertError ?? new Error('Failed to create absence');
    }

    const absenceRow = absence as AbsenceRow;

    // Fetch all users with role='substitute'
    const { data: allSubs, error: subsError } = await supabase
      .from('users')
      .select('id, phone')
      .eq('role', 'substitute');

    if (subsError) throw subsError;
    const substitutes = (allSubs ?? []) as UserRow[];

    if (substitutes.length > 0) {
      // Fetch availability rows for this date
      const subIds = substitutes.map((s) => s.id);
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

      const claimUrl = `${process.env.CLIENT_URL ?? ''}/claim/${absenceRow.id}`;

      const smsPromises = substitutes
        .filter((sub) => {
          // No row means available by default
          const available = availMap.has(sub.id) ? availMap.get(sub.id) : true;
          return available === true;
        })
        .map((sub) =>
          sendSms({
            absenceId: absenceRow.id,
            userId: sub.id,
            phone: sub.phone,
            message: buildAbsenceMessage({
              kindergartenName: absenceRow.kindergarten_name,
              date: absenceRow.date,
              claimUrl,
            }),
          })
        );

      await Promise.allSettled(smsPromises);
    }

    res.status(201).json(absenceRow);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/absences/:id
// Madriga only. Update fields and optionally assign a specific substitute.
router.patch('/:id', requireMadriga, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { kindergarten_name, date, notes, status, substitute_id } = req.body as {
      kindergarten_name?: unknown;
      date?: unknown;
      notes?: unknown;
      status?: unknown;
      substitute_id?: unknown;
    };

    const VALID_STATUSES = ['open', 'assigned', 'cancelled'];

    if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
      res.status(400).json({ error: 'סטטוס לא חוקי' });
      return;
    }

    // Verify absence exists
    const { data: existing, error: fetchError } = await supabase
      .from('absences')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'היעדרות לא נמצאה' });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof kindergarten_name === 'string') updates.kindergarten_name = kindergarten_name.trim();
    if (typeof date === 'string') updates.date = date.trim();
    if (typeof notes === 'string') updates.notes = notes.trim() || null;
    if (typeof status === 'string') updates.status = status;

    // Handle explicit substitute assignment
    if (typeof substitute_id === 'string' && substitute_id.trim()) {
      // Cancel any existing active assignment
      await supabase
        .from('assignments')
        .update({ status: 'cancelled' })
        .eq('absence_id', id)
        .eq('status', 'active');

      // Create new assignment
      const { error: assignError } = await supabase
        .from('assignments')
        .insert({
          absence_id: id,
          substitute_id: substitute_id.trim(),
          claimed_at: new Date().toISOString(),
          status: 'active',
        });

      if (assignError) throw assignError;

      updates.status = 'assigned';
    }

    const { data: updated, error: updateError } = await supabase
      .from('absences')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/absences/:id
// Madriga only. Sets status='cancelled' and cancels active assignment.
router.delete('/:id', requireMadriga, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('absences')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'היעדרות לא נמצאה' });
      return;
    }

    // Cancel active assignment if any
    await supabase
      .from('assignments')
      .update({ status: 'cancelled' })
      .eq('absence_id', id)
      .eq('status', 'active');

    const { error: updateError } = await supabase
      .from('absences')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
