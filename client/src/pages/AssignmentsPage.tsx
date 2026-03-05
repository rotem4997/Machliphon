import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Plus, CheckCircle, XCircle, Clock, MapPin,
  ChevronRight, ChevronLeft, User, Phone, X
} from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isSameDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  kindergarten_name: string;
  kindergarten_address: string;
  neighborhood: string;
  substitute_first_name: string;
  substitute_last_name: string;
  substitute_phone: string;
  manager_first_name: string;
  manager_last_name: string;
  hours_worked: number | null;
  hourly_rate: number | null;
  total_pay: number | null;
  notes: string | null;
  substitute_confirmed_at: string | null;
  substitute_arrived_at: string | null;
}

interface AvailableSub {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  neighborhood: string;
  education_level: string;
  years_experience: number;
  rating: number;
  total_assignments: number;
}

interface Kindergarten {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  age_group: string;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: 'ממתין', cls: 'badge-amber' },
  confirmed: { label: 'אושר', cls: 'badge-blue' },
  arrived: { label: 'הגיעה', cls: 'badge-green' },
  completed: { label: 'הושלם', cls: 'badge-green' },
  cancelled: { label: 'בוטל', cls: 'badge-red' },
  no_show: { label: 'לא הגיעה', cls: 'badge-red' },
};

export default function AssignmentsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completeModal, setCompleteModal] = useState<Assignment | null>(null);

  const queryClient = useQueryClient();
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments', dateStr],
    queryFn: () => api.get('/assignments', { params: { date: dateStr } }).then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assignments/${id}`, { data: { reason: 'ביטול ידני' } }),
    onSuccess: () => {
      toast.success('שיבוץ בוטל');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: () => toast.error('שגיאה בביטול השיבוץ'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, hoursWorked, hourlyRate }: { id: string; hoursWorked: number; hourlyRate: number }) =>
      api.patch(`/assignments/${id}/complete`, { hoursWorked, hourlyRate }),
    onSuccess: () => {
      toast.success('שיבוץ הושלם');
      setCompleteModal(null);
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: () => toast.error('שגיאה בעדכון'),
  });

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">שיבוצים</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(selectedDate, 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          שיבוץ חדש
        </button>
      </div>

      {/* Week navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-semibold text-navy-900">
            {format(weekStart, 'd/M', { locale: he })} — {format(addDays(weekStart, 6), 'd/M', { locale: he })}
          </span>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map(day => {
            const active = isSameDay(day, selectedDate);
            const today = isToday(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`py-2.5 px-1 rounded-xl text-center transition-all duration-150 ${
                  active
                    ? 'bg-mint-500 text-white shadow-sm'
                    : today
                    ? 'bg-mint-50 text-mint-700 border border-mint-200'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className="text-[10px] font-medium">{format(day, 'EEE', { locale: he })}</div>
                <div className={`text-lg font-bold ${active ? '' : 'text-navy-900'}`}>{format(day, 'd')}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Assignments list */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 skeleton" />)
        ) : assignments && assignments.length > 0 ? (
          assignments.map(a => (
            <div key={a.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={statusConfig[a.status]?.cls || 'badge-gray'}>
                      {statusConfig[a.status]?.label || a.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {a.start_time?.slice(0, 5)} — {a.end_time?.slice(0, 5)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-navy-900 text-sm">{a.kindergarten_name}</span>
                    <span className="text-slate-400 text-xs hidden sm:inline">• {a.kindergarten_address}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{a.substitute_first_name} {a.substitute_last_name}</span>
                    <a href={`tel:${a.substitute_phone}`} className="text-xs text-sky-600 hover:underline hidden sm:flex items-center gap-1">
                      <Phone size={11} />
                      {a.substitute_phone}
                    </a>
                  </div>

                  {a.notes && <p className="text-xs text-slate-400 mt-1">{a.notes}</p>}

                  {a.total_pay && (
                    <p className="text-xs text-mint-600 font-medium mt-1">
                      {a.hours_worked} שעות × ₪{a.hourly_rate} = ₪{a.total_pay}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5">
                  {(a.status === 'arrived' || a.status === 'confirmed') && (
                    <button
                      onClick={() => setCompleteModal(a)}
                      className="text-xs text-mint-600 hover:text-mint-700 font-medium whitespace-nowrap"
                    >
                      סיום ושעות
                    </button>
                  )}
                  {a.status !== 'completed' && a.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        if (confirm('בטוח לבטל שיבוץ זה?')) cancelMutation.mutate(a.id);
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium whitespace-nowrap"
                    >
                      ביטול
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card p-12 text-center">
            <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">אין שיבוצים ליום זה</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-mint-600 hover:text-mint-700 text-sm font-medium mt-2"
            >
              + יצירת שיבוץ חדש
            </button>
          </div>
        )}
      </div>

      {/* Complete Modal */}
      {completeModal && (
        <CompleteModal
          assignment={completeModal}
          onClose={() => setCompleteModal(null)}
          onSubmit={(hoursWorked, hourlyRate) =>
            completeMutation.mutate({ id: completeModal.id, hoursWorked, hourlyRate })
          }
          isLoading={completeMutation.isPending}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAssignmentModal
          date={dateStr}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
          }}
        />
      )}
    </div>
  );
}

/* ────── Complete Assignment Modal ────── */
function CompleteModal({
  assignment,
  onClose,
  onSubmit,
  isLoading,
}: {
  assignment: Assignment;
  onClose: () => void;
  onSubmit: (hours: number, rate: number) => void;
  isLoading: boolean;
}) {
  const [hours, setHours] = useState('6.5');
  const [rate, setRate] = useState('55');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-sm slide-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900">סיום שיבוץ</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          {assignment.substitute_first_name} {assignment.substitute_last_name} — {assignment.kindergarten_name}
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">שעות עבודה</label>
            <input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">תעריף לשעה (₪)</label>
            <input type="number" step="1" value={rate} onChange={e => setRate(e.target.value)} className="input" />
          </div>
          {hours && rate && (
            <p className="text-sm text-mint-600 font-semibold">
              סה"כ: ₪{(parseFloat(hours) * parseFloat(rate)).toFixed(2)}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={() => onSubmit(parseFloat(hours), parseFloat(rate))} disabled={isLoading} className="btn-primary flex-1">
            {isLoading ? 'שומר...' : 'סיום שיבוץ'}
          </button>
          <button onClick={onClose} className="btn-secondary">ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ────── Create Assignment Modal ────── */
function CreateAssignmentModal({
  date,
  onClose,
  onSuccess,
}: {
  date: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kindergartenId, setKindergartenId] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [startTime, setStartTime] = useState('07:30');
  const [endTime, setEndTime] = useState('14:00');
  const [notes, setNotes] = useState('');

  const { data: kindergartens } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data),
  });

  const { data: availableSubs } = useQuery<AvailableSub[]>({
    queryKey: ['available-subs', date],
    queryFn: () => api.get('/substitutes/available', { params: { date } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/assignments', body),
    onSuccess: () => {
      toast.success('שיבוץ נוצר בהצלחה');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה ביצירת שיבוץ');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kindergartenId || !substituteId) {
      toast.error('יש לבחור גן ומחליפה');
      return;
    }
    createMutation.mutate({
      kindergartenId,
      substituteId,
      assignmentDate: date,
      startTime,
      endTime,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-lg slide-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900 text-lg">שיבוץ חדש</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          תאריך: {format(parseISO(date), 'EEEE, d בMMMM yyyy', { locale: he })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kindergarten select */}
          <div>
            <label className="label">גן ילדים</label>
            <select value={kindergartenId} onChange={e => setKindergartenId(e.target.value)} className="input" required>
              <option value="">בחר גן...</option>
              {kindergartens?.map(k => (
                <option key={k.id} value={k.id}>
                  {k.name} — {k.neighborhood} ({k.age_group})
                </option>
              ))}
            </select>
          </div>

          {/* Available substitutes */}
          <div>
            <label className="label">
              מחליפה זמינה
              {availableSubs && <span className="text-slate-400 font-normal"> ({availableSubs.length} זמינות)</span>}
            </label>
            {availableSubs && availableSubs.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2">
                {availableSubs.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      substituteId === s.id ? 'bg-mint-50 border border-mint-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="substitute"
                      value={s.id}
                      checked={substituteId === s.id}
                      onChange={() => setSubstituteId(s.id)}
                      className="accent-mint-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400">
                        {s.education_level} • {s.years_experience} שנות ניסיון • {s.total_assignments} שיבוצים
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{s.neighborhood}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4 border border-slate-200 rounded-xl">
                אין מחליפות זמינות לתאריך זה
              </p>
            )}
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שעת התחלה</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">שעת סיום</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">הערות</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input min-h-[60px] resize-y"
              placeholder="הערות נוספות..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? 'יוצר שיבוץ...' : 'צור שיבוץ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
