import { useState, useEffect, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { Absence, SubstituteWithAvailability } from '../../lib/types';

interface AbsenceFormProps {
  absence: Absence | null;
  onClose: () => void;
}

export function AbsenceForm({ absence, onClose }: AbsenceFormProps) {
  const isEdit = absence !== null;
  const qc = useQueryClient();

  const [kindergartenName, setKindergartenName] = useState(
    absence?.kindergarten_name ?? ''
  );
  const [date, setDate] = useState(absence?.date?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(absence?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const [substitutes, setSubstitutes] = useState<SubstituteWithAvailability[]>(
    []
  );
  const [overrideSubId, setOverrideSubId] = useState('');

  useEffect(() => {
    if (!isEdit || !date) return;
    api
      .get<SubstituteWithAvailability[]>(
        `/api/availability/substitutes?date=${date}`
      )
      .then(setSubstitutes)
      .catch(() => {});
  }, [isEdit, date]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isEdit) {
        const body: Record<string, string> = {
          kindergarten_name: kindergartenName,
          date,
          notes,
        };
        if (overrideSubId) body.override_substitute_id = overrideSubId;
        await api.patch(`/api/absences/${absence.id}`, body);
        toast.success('ההיעדרות עודכנה');
      } else {
        await api.post('/api/absences', {
          kindergarten_name: kindergartenName,
          date,
          notes,
        });
        toast.success('ההיעדרות נוצרה ונשלחו הודעות SMS');
      }
      await qc.invalidateQueries({ queryKey: ['absences'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-navy mb-5">
          {isEdit ? 'עריכת היעדרות' : 'היעדרות חדשה'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם הגן
            </label>
            <input
              type="text"
              required
              value={kindergartenName}
              onChange={(e) => setKindergartenName(e.target.value)}
              placeholder="גן הילדים"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="פרטים נוספים..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint resize-none"
            />
          </div>

          {isEdit && substitutes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שינוי שיבוץ (דריסה)
              </label>
              <select
                value={overrideSubId}
                onChange={(e) => setOverrideSubId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint bg-white"
              >
                <option value="">ללא שינוי שיבוץ</option>
                {substitutes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                    {s.is_available ? ' (זמינה)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-navy text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-60"
            >
              {submitting ? 'שומר...' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
