import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { Availability as AvailabilityType } from '../../lib/types';
import { Layout } from '../../components/Layout';

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function buildNext14Days(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return toISODate(d);
  });
}

export function Availability() {
  const qc = useQueryClient();
  const dates = buildNext14Days();

  const { data: records = [], isLoading } = useQuery<AvailabilityType[]>({
    queryKey: ['availability', 'mine'],
    queryFn: () => api.get<AvailabilityType[]>('/api/availability/mine'),
  });

  const availabilityMap = new Map<string, boolean>(
    records.map((r) => [r.date.slice(0, 10), r.is_available])
  );

  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const toggleMutation = useMutation({
    mutationFn: ({ date, is_available }: { date: string; is_available: boolean }) =>
      api.put<AvailabilityType>(`/api/availability/${date}`, { is_available }),
    onMutate: ({ date }) => setPendingDate(date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability', 'mine'] });
      toast.success('הזמינות עודכנה');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'שגיאה בעדכון זמינות');
    },
    onSettled: () => setPendingDate(null),
  });

  function handleToggle(date: string) {
    const current = availabilityMap.get(date) ?? false;
    toggleMutation.mutate({ date, is_available: !current });
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-navy">הזמינות שלי</h1>
          <Link
            to="/substitute"
            className="text-sm text-mint font-medium hover:underline"
          >
            חזרה
          </Link>
        </div>

        <p className="text-sm text-gray-500">
          לחצי על יום לשינוי הזמינות שלך לאותו יום.
        </p>

        {isLoading ? (
          <p className="text-gray-400 text-center py-10">טוען...</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {HEBREW_DAYS.map((label) => (
              <div
                key={label}
                className="text-center text-xs font-medium text-gray-400 pb-1"
              >
                {label}
              </div>
            ))}

            {dates.map((date) => {
              const dayOfWeek = new Date(date).getDay();
              const isAvailable = availabilityMap.get(date) ?? false;
              const isPending = pendingDate === date;

              const isFirst = date === dates[0];
              const colStartClass = isFirst
                ? `col-start-${dayOfWeek + 1}`
                : '';

              return (
                <button
                  key={date}
                  onClick={() => handleToggle(date)}
                  disabled={isPending}
                  title={date}
                  className={[
                    colStartClass,
                    'rounded-xl py-2 flex flex-col items-center gap-0.5 transition-colors text-xs font-medium',
                    isPending ? 'opacity-50' : '',
                    isAvailable
                      ? 'bg-mint text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span>{formatDisplay(date)}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-mint inline-block" />
            זמינה
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
            לא זמינה
          </span>
        </div>
      </div>
    </Layout>
  );
}
