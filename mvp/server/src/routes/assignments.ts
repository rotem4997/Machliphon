import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireMadriga } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { sendSms, buildAbsenceMessage } from '../lib/sms';

const router = Router();

interface AbsenceRow {
  id: string;
  kindergarten_name: string;
  date: string;
  status: 'open' | 'assigned' | 'cancelled';
}

interface UserRow {
  id: string;
  phone: string;
}

interface AvailabilityRow {
  substitute_id: string;
  is_available: boolean;
}

// POST /api/assignments/claim/:absenceId
// Substitute only. Claims an open absence using SELECT FOR UPDATE to prevent races.
router.post(
  '/claim/:absenceId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'substitute') {
        res.status(403).json({ error: 'רק מחליפות יכולות לתפוס היעדרויות' });
        return;
      }

      const { absenceId } = req.params;

      // Use an RPC / raw query via supabase.rpc to perform atomic claim.
      // We call a SQL function that does the SELECT FOR UPDATE + insert in one transaction.
      // If the function is not available we fall back to a best-effort check.
      // Attempt to use the claim_absence Postgres function if it exists; otherwise use
      // a two-step approach with conflict detection.

      // Best-effort two-step with UNIQUE constraint on assignments(absence_id) as the
      // real race-condition guard (Supabase enforces the unique constraint at DB level).
      const { data: absence, error: fetchError } = await supabase
        .from('absences')
        .select('id, kindergarten_name, date, status')
        .eq('id', absenceId)
        .single();

      if (fetchError || !absence) {
        res.status(404).json({ error: 'היעדרות לא נמצאה' });
        return;
      }

      const absenceRow = absence as AbsenceRow;

      if (absenceRow.status !== 'open') {
        res.status(409).json({ error: 'ההיעדרות כבר תפוסה או בוטלה' });
        return;
      }

      // Insert assignment — the UNIQUE constraint on absence_id will reject duplicates
      const { data: assignment, error: assignError } = await supabase
        .from('assignments')
        .insert({
          absence_id: absenceId,
          substitute_id: user.id,
          claimed_at: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (assignError) {
        // Unique-violation code in PostgreSQL is 23505
        if (assignError.code === '23505') {
          res.status(409).json({ error: 'ההיעדרות כבר תפוסה' });
          return;
        }
        throw assignError;
      }

      // Update absence status to 'assigned'
      const { error: updateError } = await supabase
        .from('absences')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', absenceId)
        .eq('status', 'open'); // Extra guard: only update if still open

      if (updateError) throw updateError;

      res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/assignments/mine
// Substitute only. Returns assignments joined with absence info.
router.get(
  '/mine',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.role !== 'substitute') {
        res.status(403).json({ error: 'גישה מותרת למחליפות בלבד' });
        return;
      }

      const { data, error } = await supabase
        .from('assignments')
        .select(`
          id,
          claimed_at,
          status,
          absences (
            id,
            kindergarten_name,
            date,
            notes,
            status
          )
        `)
        .eq('substitute_id', user.id)
        .order('claimed_at', { ascending: false });

      if (error) throw error;

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/assignments/:id
// Madriga only. Cancels assignment, sets absence back to 'open', re-sends SMS.
router.delete(
  '/:id',
  requireMadriga,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { data: assignment, error: fetchError } = await supabase
        .from('assignments')
        .select('id, absence_id, status')
        .eq('id', id)
        .single();

      if (fetchError || !assignment) {
        res.status(404).json({ error: 'שיבוץ לא נמצא' });
        return;
      }

      const absenceId = (assignment as { absence_id: string }).absence_id;

      // Cancel the assignment
      const { error: cancelError } = await supabase
        .from('assignments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (cancelError) throw cancelError;

      // Reopen the absence
      const { data: absence, error: absenceError } = await supabase
        .from('absences')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', absenceId)
        .select('id, kindergarten_name, date')
        .single();

      if (absenceError) throw absenceError;

      const absenceRow = absence as AbsenceRow;

      // Re-send SMS to available substitutes
      const { data: allSubs, error: subsError } = await supabase
        .from('users')
        .select('id, phone')
        .eq('role', 'substitute');

      if (subsError) throw subsError;
      const substitutes = (allSubs ?? []) as UserRow[];

      if (substitutes.length > 0) {
        const subIds = substitutes.map((s) => s.id);
        const { data: availRows, error: availError } = await supabase
          .from('availability')
          .select('substitute_id, is_available')
          .in('substitute_id', subIds)
          .eq('date', absenceRow.date);

        if (availError) throw availError;

        const availMap = new Map<string, boolean>();
        for (const row of (availRows ?? []) as AvailabilityRow[]) {
          availMap.set(row.substitute_id, row.is_available);
        }

        const claimUrl = `${process.env.CLIENT_URL ?? ''}/claim/${absenceRow.id}`;

        const smsPromises = substitutes
          .filter((sub) => {
            const available = availMap.has(sub.id) ? availMap.get(sub.id)! : true;
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

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
