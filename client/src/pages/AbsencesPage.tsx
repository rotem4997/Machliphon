import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, X, Calendar, MapPin, User, Filter,
  AlertTriangle, Clock, CheckCircle, Loader2,
} from 'lucide-react';
import api, { handleApiError } from '@/utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────
interface Kindergarten {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
}

interface AbsenceReport {
  id: string;
  kindergarten_id: string;
  kindergarten_name: string;
  kindergarten_address: string;
  absent_employee_name: string;
  absent_employee_role: 'teacher' | 'assistant';
  absence_date: string;
  absence_reason: string | null;
  status: 'open' | 'assigned' | 'covered' | 'uncovered';
  notes: string | null;
  created_at: string;
}

interface CreateAbsenceBody {
  kindergartenId: string;
  absentEmployeeName: string;
  absentEmployeeRole: 'teacher' | 'assistant';
  absenceDate: string;
  absenceReason: string;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────
const reasonLabels: Record<string, string> = {
  sick: 'מחלה', vacation: 'חופשה', emergency: 'חירום', known: 'ידוע מראש',
};

const statusConfig: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  open: { label: 'פתוח', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  assigned: { label: 'מוקצה', cls: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  covered: { label: 'מכוסה', cls: 'bg-mint-100 text-mint-700', icon: CheckCircle },
  uncovered: { label: 'לא מכוסה', cls: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

// ─── Main Component ───────────────────────────────────────────
export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: absences = [], isLoading, isError } = useQuery<AbsenceReport[]>({
    queryKey: ['absences'],
    queryFn: () => api.get('/absences').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/absences/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast.success('דיווח נמחק');
    },
    onError: (err) => handleApiError(err, 'DELETE /api/absences/:id'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/absences/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast.success('סטטוס עודכן');
    },
    onError: (err) => handleApiError(err, 'PATCH /api/absences/:id'),
  });

  const filtered = absences.filter(a => {
    if (search && !`${a.absent_employee_name} ${a.kindergarten_name}`.includes(search)) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterReason && a.absence_reason !== filterReason) return false;
    return true;
  }).sort((a, b) => b.absence_date.localeCompare(a.absence_date));

  const openCount = absences.filter(a => a.status === 'open').length;
  const coveredCount = absences.filter(a => a.status === 'covered' || a.status === 'assigned').length;
  const uncoveredCount = absences.filter(a => a.status === 'uncovered').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-mint-500" size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">שגיאה בטעינת הנתונים</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['absences'] })}
          className="btn-secondary mt-3 text-sm"
        >
          נסה שנית
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-900">היעדרויות</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {absences.length} דיווחים
            {openCount > 0 && <span className="text-amber-600 font-medium"> · {openCount} פתוחים</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          דיווח חדש
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-amber-600">{openCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">פתוחים</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-mint-600">{coveredCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">מכוסים</p>
        </div>
        <div className="card p-4 text-center hidden sm:block">
          <p className="text-2xl font-black text-red-600">{uncoveredCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">לא מכוסים</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם עובד או גן..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pr-9 py-2.5 text-sm w-full"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input py-2.5 text-sm w-full sm:w-auto">
          <option value="">כל הסטטוסים</option>
          <option value="open">פתוח</option>
          <option value="assigned">מוקצה</option>
          <option value="covered">מכוסה</option>
          <option value="uncovered">לא מכוסה</option>
        </select>
        <select value={filterReason} onChange={e => setFilterReason(e.target.value)} className="input py-2.5 text-sm w-full sm:w-auto">
          <option value="">כל הסיבות</option>
          <option value="sick">מחלה</option>
          <option value="vacation">חופשה</option>
          <option value="emergency">חירום</option>
          <option value="known">ידוע מראש</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map(a => {
            const sc = statusConfig[a.status] ?? statusConfig.open;
            const StatusIcon = sc.icon;
            return (
              <div key={a.id} className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${sc.cls}`}>
                        <StatusIcon size={12} />
                        {sc.label}
                      </span>
                      {a.absence_reason && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {reasonLabels[a.absence_reason] ?? a.absence_reason}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      <User size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-navy-900 text-sm">{a.absent_employee_name}</span>
                      <span className="text-slate-400 text-xs">
                        ({a.absent_employee_role === 'teacher' ? 'גננת' : 'עוזרת'})
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {a.kindergarten_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(a.absence_date), 'EEEE d/M/yyyy', { locale: he })}
                      </span>
                    </div>

                    {a.notes && <p className="text-xs text-slate-400 mt-1.5">{a.notes}</p>}
                  </div>

                  {/* Actions */}
                  {a.status === 'open' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: a.id, status: 'uncovered' })}
                        disabled={updateStatusMutation.isPending}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                      >
                        לא מכוסה
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('למחוק דיווח זה?')) deleteMutation.mutate(a.id);
                        }}
                        disabled={deleteMutation.isPending}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
                      >
                        מחיקה
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="card p-12 text-center">
            <Filter size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {search || filterStatus || filterReason ? 'אין תוצאות לפילטר זה' : 'אין דיווחי היעדרות'}
            </p>
            {!search && !filterStatus && !filterReason && (
              <button
                onClick={() => setShowCreate(true)}
                className="text-mint-600 hover:text-mint-700 text-sm font-medium mt-2"
              >
                + דיווח חדש
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateAbsenceModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['absences'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Create Absence Modal ─────────────────────────────────────
function CreateAbsenceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kindergartenId, setKindergartenId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState<'teacher' | 'assistant'>('teacher');
  const [absenceDate, setAbsenceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('sick');
  const [notes, setNotes] = useState('');

  const { data: kindergartens = [], isLoading: kgsLoading } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateAbsenceBody) => api.post('/absences', body),
    onSuccess: () => {
      toast.success('דיווח היעדרות נוצר בהצלחה');
      onSuccess();
    },
    onError: (err) => handleApiError(err, 'POST /api/absences'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kindergartenId || !employeeName || !absenceDate) {
      toast.error('יש למלא את כל שדות החובה');
      return;
    }
    createMutation.mutate({
      kindergartenId,
      absentEmployeeName: employeeName,
      absentEmployeeRole: employeeRole,
      absenceDate,
      absenceReason: reason,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-md slide-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900 text-lg">דיווח היעדרות חדש</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">גן ילדים *</label>
            {kgsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 size={14} className="animate-spin" />
                טוען גנים...
              </div>
            ) : (
              <select
                value={kindergartenId}
                onChange={e => setKindergartenId(e.target.value)}
                className="input"
                required
              >
                <option value="">בחר גן...</option>
                {kindergartens.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">שם העובד/ת הנעדר/ת *</label>
            <input
              type="text"
              value={employeeName}
              onChange={e => setEmployeeName(e.target.value)}
              className="input"
              placeholder="שם מלא"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תפקיד</label>
              <select
                value={employeeRole}
                onChange={e => setEmployeeRole(e.target.value as 'teacher' | 'assistant')}
                className="input"
              >
                <option value="teacher">גננת</option>
                <option value="assistant">עוזרת</option>
              </select>
            </div>
            <div>
              <label className="label">תאריך *</label>
              <input
                type="date"
                value={absenceDate}
                onChange={e => setAbsenceDate(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">סיבה</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input">
              <option value="sick">מחלה</option>
              <option value="vacation">חופשה</option>
              <option value="emergency">חירום</option>
              <option value="known">ידוע מראש</option>
            </select>
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input min-h-[60px] resize-y"
              placeholder="פרטים נוספים..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              שלח דיווח
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
