import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, X, Calendar, MapPin, User, Filter,
  AlertTriangle, Clock, CheckCircle, Loader2, Sparkles, Phone,
} from 'lucide-react';
import api, { handleApiError } from '@/utils/api';
import { useAuthStore } from '@/context/authStore';
import { DEMO_ABSENCES, DEMO_KINDERGARTENS } from '@/utils/demoData';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
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
interface Recommendation {
  substituteId: string;
  userId: string;
  fullName: string;
  score: number;
  reasons: string[];
}

export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const { isDemoMode } = useAuthStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignModal, setAssignModal] = useState<{ absenceId: string; kindergartenId: string; kindergartenName: string; date: string } | null>(null);

  const { data: absences = [], isLoading, isError } = useQuery<AbsenceReport[]>({
    queryKey: ['absences'],
    queryFn: () => api.get('/absences').then(r => r.data)
      .catch(() => isDemoMode ? DEMO_ABSENCES as AbsenceReport[] : []),
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

  const assignMutation = useMutation({
    mutationFn: ({ substituteId, kindergartenId, absenceId, date }: { substituteId: string; kindergartenId: string; absenceId: string; date: string }) =>
      api.post('/assignments', { substituteId, kindergartenId, absenceId, assignmentDate: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      toast.success('המחליפה שובצה בהצלחה!');
      setAssignModal(null);
    },
    onError: (err) => handleApiError(err, 'POST /api/assignments'),
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
                        {format(parseISO(a.absence_date), 'EEEE d/M/yyyy', { locale: he })}
                      </span>
                    </div>

                    {a.notes && <p className="text-xs text-slate-400 mt-1.5">{a.notes}</p>}
                  </div>

                  {/* Actions */}
                  {a.status === 'open' && (
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => setAssignModal({ absenceId: a.id, kindergartenId: a.kindergarten_id, kindergartenName: a.kindergarten_name, date: a.absence_date })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-mint-500 text-white hover:bg-mint-600 border border-mint-500 transition-colors font-medium flex items-center gap-1"
                      >
                        <Sparkles size={12} />
                        שבצי מחליפה
                      </button>
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

      {/* Assign Modal */}
      {assignModal && (
        <AbsenceAssignModal
          absenceId={assignModal.absenceId}
          kindergartenId={assignModal.kindergartenId}
          kindergartenName={assignModal.kindergartenName}
          date={assignModal.date}
          submitting={assignMutation.isPending}
          onClose={() => setAssignModal(null)}
          onAssign={(substituteId) => assignMutation.mutate({ substituteId, kindergartenId: assignModal.kindergartenId, absenceId: assignModal.absenceId, date: assignModal.date })}
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
  const { isDemoMode } = useAuthStore();
  const [kindergartenId, setKindergartenId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState<'teacher' | 'assistant'>('teacher');
  const [absenceDate, setAbsenceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('sick');
  const [notes, setNotes] = useState('');

  const { data: kindergartens = [], isLoading: kgsLoading } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data)
      .catch(() => isDemoMode ? DEMO_KINDERGARTENS : []),
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

// ─── Absence Assign Modal ─────────────────────────────────────
function AbsenceAssignModal({
  absenceId,
  kindergartenId,
  kindergartenName,
  date,
  submitting,
  onClose,
  onAssign,
}: {
  absenceId: string;
  kindergartenId: string;
  kindergartenName: string;
  date: string;
  submitting: boolean;
  onClose: () => void;
  onAssign: (substituteId: string) => void;
}) {
  const { isDemoMode } = useAuthStore();
  const [selectedSub, setSelectedSub] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading } = useQuery<{ count: number; recommendations: Recommendation[] }>({
    queryKey: ['ml-recommend', kindergartenId, date],
    queryFn: () =>
      api.get('/ml/recommend', { params: { kindergartenId, date, topK: 20 } })
        .then(r => r.data)
        .catch(() => isDemoMode ? {
          count: 3,
          recommendations: [
            { substituteId: 'sub-1', userId: 'u1', fullName: 'מרים אברהם', score: 0.92, reasons: ['זמינה', 'מרחק קרוב', 'דירוג גבוה'] },
            { substituteId: 'sub-2', userId: 'u2', fullName: 'רחל לוי', score: 0.85, reasons: ['זמינה', 'ניסיון רב'] },
            { substituteId: 'sub-3', userId: 'u3', fullName: 'שרה כהן', score: 0.78, reasons: ['זמינה'] },
          ],
        } : null),
  });

  const recs = data?.recommendations ?? [];
  const selectedRec = recs.find(r => r.substituteId === selectedSub);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {!showConfirm ? (
        <div className="card p-6 w-full max-w-lg slide-in max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900 text-lg">שיבוץ מחליפה</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div className="bg-navy-900 rounded-xl p-4 mb-4 text-white">
            <p className="text-mint-400 text-xs font-medium">גן ילדים</p>
            <p className="font-bold text-lg">{kindergartenName}</p>
            <p className="text-navy-300 text-sm mt-1">
              {format(parseISO(date), 'EEEE, d בMMMM yyyy', { locale: he })}
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-mint-500" />
              המלצות חכמות ({recs.length})
            </label>
            {isLoading ? (
              <div className="text-center py-6 text-sm text-slate-500 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />טוען...
              </div>
            ) : recs.length > 0 ? (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {recs.map((r, idx) => {
                  const initials = r.fullName.split(' ').map(s => s[0]).slice(0, 2).join('');
                  return (
                    <label
                      key={r.substituteId}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                        selectedSub === r.substituteId ? 'bg-mint-50 border-mint-300' : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="substitute"
                        value={r.substituteId}
                        checked={selectedSub === r.substituteId}
                        onChange={() => setSelectedSub(r.substituteId)}
                        className="accent-mint-500 mt-1"
                      />
                      <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-xs font-bold text-mint-400 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-navy-900 truncate">{r.fullName}</p>
                          <span className="text-[10px] font-bold bg-mint-100 text-mint-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {idx === 0 && '⭐ '}{Math.round(r.score * 100)}%
                          </span>
                        </div>
                        {r.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {r.reasons.map(reason => (
                              <span key={reason} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{reason}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 border border-slate-200 rounded-xl">
                <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">אין מחליפות זמינות ליום זה</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => selectedSub && setShowConfirm(true)}
              disabled={!selectedSub || submitting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              שבצי מחליפה
            </button>
            <button onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </div>
      ) : (
        <div className="card p-6 w-full max-w-sm slide-in text-center">
          <div className="w-14 h-14 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-mint-500" />
          </div>
          <h3 className="font-bold text-navy-900 text-lg mb-2">אישור שיבוץ</h3>
          <p className="text-slate-600 text-sm mb-1">לשבץ את <span className="font-bold text-navy-900">{selectedRec?.fullName}</span></p>
          <p className="text-slate-600 text-sm mb-1">ל<span className="font-bold text-navy-900">{kindergartenName}</span></p>
          <p className="text-slate-500 text-xs mb-5">{format(parseISO(date), 'EEEE, d בMMMM yyyy', { locale: he })}</p>
          <div className="flex gap-2">
            <button onClick={() => onAssign(selectedSub)} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? 'שולח...' : 'אישור'}
            </button>
            <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">חזרה</button>
          </div>
        </div>
      )}
    </div>
  );
}
