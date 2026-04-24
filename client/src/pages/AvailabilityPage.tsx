import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { isHoliday } from '@/utils/holidays';

interface AvailabilityRecord {
  id: string;
  date: string;
  is_available: boolean;
  reason: string | null;
}

const reasonOptions = [
  { value: 'vacation', label: 'חופשה' },
  { value: 'sick', label: 'מחלה' },
  { value: 'personal', label: 'אישי' },
  { value: 'training', label: 'הדרכה' },
  { value: 'other', label: 'אחר' },
];

export default function AvailabilityPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reason, setReason] = useState('vacation');
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: availability = [], isError } = useQuery<AvailabilityRecord[]>({
    queryKey: ['my-availability', format(currentMonth, 'yyyy-MM')],
    queryFn: () => api.get('/substitutes/availability', {
      params: {
        month: currentMonth.getMonth() + 1,
        year: currentMonth.getFullYear(),
      },
    }).then(r => r.data).catch(() => []),
  });

  const unavailableDates = new Set(
    availability.filter(a => !a.is_available).map(a => a.date)
  );

  const setAvailability = useMutation({
    mutationFn: ({ date, isAvailable, reason: r }: { date: string; isAvailable: boolean; reason: string }) =>
      api.put('/substitutes/availability', { date, isAvailable, reason: r }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      setSelectedDate(null);
      toast.success('זמינות עודכנה');
    },
    onError: () => toast.error('שגיאה בעדכון הזמינות'),
  });

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const handleDayClick = (dateStr: string) => {
    if (isBefore(new Date(dateStr), today) && dateStr !== todayStr) return; // can't change past
    setSelectedDate(dateStr === selectedDate ? null : dateStr);
  };

  const getDayClass = (dateStr: string, inMonth: boolean) => {
    if (!inMonth) return 'opacity-0 pointer-events-none';
    const holiday = isHoliday(dateStr);
    if (holiday) return 'bg-amber-50 text-amber-600 border border-amber-200 cursor-not-allowed';
    const dayOfWeek = new Date(dateStr).getDay();
    if (dayOfWeek === 6) return 'bg-slate-100 text-slate-400 cursor-not-allowed'; // Saturday
    if (isBefore(new Date(dateStr), today) && dateStr !== todayStr) return 'bg-slate-50 text-slate-300 cursor-not-allowed';
    if (unavailableDates.has(dateStr)) return 'bg-red-100 text-red-700 border border-red-200 cursor-pointer hover:bg-red-200';
    return 'bg-mint-50 text-mint-800 border border-mint-200 cursor-pointer hover:bg-mint-100';
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle size={24} className="text-red-400" />
        <p>שגיאה בטעינת הזמינות</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-black text-navy-900">ניהול זמינות</h1>
        <p className="text-slate-500 text-sm mt-1">סמני ימים בהם אינך זמינה לקבל שיבוצים</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-mint-100 border border-mint-200" /><span>זמינה</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-red-100 border border-red-200" /><span>לא זמינה</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" /><span>חג / שבת</span></div>
      </div>

      {/* Calendar navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-bold text-navy-900 text-lg">
            {format(currentMonth, 'MMMM yyyy', { locale: he })}
          </h2>
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 rounded-lg hover:bg-slate-100">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day-of-week headers (Sun–Fri) */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Days grid — start from Sunday */}
        <div className="grid grid-cols-7 gap-1">
          {/* Pad to start on correct weekday (0=Sun) */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const holiday = isHoliday(dateStr);
            const isSat = day.getDay() === 6;
            const isPast = isBefore(day, today) && dateStr !== todayStr;
            return (
              <button
                key={dateStr}
                onClick={() => !holiday && !isSat && !isPast && handleDayClick(dateStr)}
                className={`
                  relative rounded-lg p-2 text-center text-sm transition-all
                  ${getDayClass(dateStr, isSameMonth(day, currentMonth))}
                  ${selectedDate === dateStr ? 'ring-2 ring-navy-500' : ''}
                  ${isToday(day) ? 'font-bold' : ''}
                `}
                title={holiday?.name || undefined}
              >
                {day.getDate()}
                {unavailableDates.has(dateStr) && (
                  <div className="absolute top-0.5 left-0.5">
                    <XCircle size={8} className="text-red-500" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Update panel for selected date */}
      {selectedDate && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-navy-900">
              {format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: he })}
            </h3>
            {unavailableDates.has(selectedDate) ? (
              <span className="badge-red flex items-center gap-1 text-xs"><XCircle size={12} />לא זמינה</span>
            ) : (
              <span className="badge-green flex items-center gap-1 text-xs"><CheckCircle size={12} />זמינה</span>
            )}
          </div>

          {!unavailableDates.has(selectedDate) ? (
            <div className="space-y-3">
              <div>
                <label className="label">סיבת אי-זמינות</label>
                <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                  {reasonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <button
                onClick={() => setAvailability.mutate({ date: selectedDate, isAvailable: false, reason })}
                disabled={setAvailability.isPending}
                className="btn-primary text-sm w-full disabled:opacity-50"
              >
                {setAvailability.isPending ? 'שומר...' : 'סמן כלא זמינה'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAvailability.mutate({ date: selectedDate, isAvailable: true, reason: '' })}
              disabled={setAvailability.isPending}
              className="btn-secondary text-sm w-full disabled:opacity-50"
            >
              {setAvailability.isPending ? 'שומר...' : 'סמן כזמינה שוב'}
            </button>
          )}
        </div>
      )}

      {/* Monthly summary */}
      <div className="card p-4">
        <h3 className="font-semibold text-navy-900 mb-3">סיכום חודשי</h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-mint-600">{days.filter(d => d.getDay() !== 6 && !isHoliday(format(d, 'yyyy-MM-dd')) && !unavailableDates.has(format(d, 'yyyy-MM-dd'))).length}</p>
            <p className="text-xs text-slate-500">ימים זמינים</p>
          </div>
          <div>
            <p className="text-2xl font-black text-red-500">{unavailableDates.size}</p>
            <p className="text-xs text-slate-500">ימים לא זמינים</p>
          </div>
        </div>
      </div>
    </div>
  );
}
