import { useState } from 'react';
import {
  Search, Plus, X, Calendar, MapPin, User, Filter,
  AlertTriangle, Clock, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';
import { he } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────
interface TeacherAbsence {
  id: string;
  kindergartenName: string;
  employeeName: string;
  employeeRole: 'teacher' | 'assistant';
  absenceDate: string;
  reason: 'sick' | 'vacation' | 'emergency' | 'known';
  status: 'open' | 'covered' | 'uncovered';
  notes?: string;
  createdAt: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const MOCK_KINDERGARTENS = [
  'גן חבצלת', 'גן נרקיס', 'גן רקפת', 'גן כלנית', 'גן דליה',
];

const MOCK_TEACHERS: { name: string; role: 'teacher' | 'assistant'; kg: string }[] = [
  { name: 'רונית לוי', role: 'teacher', kg: 'גן חבצלת' },
  { name: 'מיכל אברהם', role: 'assistant', kg: 'גן חבצלת' },
  { name: 'יעל כהן', role: 'teacher', kg: 'גן נרקיס' },
  { name: 'אורית דוד', role: 'teacher', kg: 'גן רקפת' },
  { name: 'שרון בן עמי', role: 'assistant', kg: 'גן כלנית' },
  { name: 'דנה פרידמן', role: 'teacher', kg: 'גן דליה' },
];

const today = new Date();
const INITIAL_ABSENCES: TeacherAbsence[] = [
  {
    id: 'abs-1', kindergartenName: 'גן חבצלת', employeeName: 'רונית לוי',
    employeeRole: 'teacher', absenceDate: format(today, 'yyyy-MM-dd'),
    reason: 'sick', status: 'open', createdAt: format(today, 'yyyy-MM-dd HH:mm'),
  },
  {
    id: 'abs-2', kindergartenName: 'גן נרקיס', employeeName: 'יעל כהן',
    employeeRole: 'teacher', absenceDate: format(addDays(today, 1), 'yyyy-MM-dd'),
    reason: 'known', status: 'open', createdAt: format(today, 'yyyy-MM-dd HH:mm'),
  },
  {
    id: 'abs-3', kindergartenName: 'גן רקפת', employeeName: 'אורית דוד',
    employeeRole: 'teacher', absenceDate: format(addDays(today, -1), 'yyyy-MM-dd'),
    reason: 'sick', status: 'covered', createdAt: format(addDays(today, -1), 'yyyy-MM-dd HH:mm'),
  },
  {
    id: 'abs-4', kindergartenName: 'גן כלנית', employeeName: 'שרון בן עמי',
    employeeRole: 'assistant', absenceDate: format(addDays(today, 2), 'yyyy-MM-dd'),
    reason: 'vacation', status: 'open', createdAt: format(today, 'yyyy-MM-dd HH:mm'),
  },
  {
    id: 'abs-5', kindergartenName: 'גן חבצלת', employeeName: 'מיכל אברהם',
    employeeRole: 'assistant', absenceDate: format(addDays(today, -3), 'yyyy-MM-dd'),
    reason: 'emergency', status: 'uncovered', createdAt: format(addDays(today, -3), 'yyyy-MM-dd HH:mm'),
  },
  {
    id: 'abs-6', kindergartenName: 'גן דליה', employeeName: 'דנה פרידמן',
    employeeRole: 'teacher', absenceDate: format(addDays(today, 3), 'yyyy-MM-dd'),
    reason: 'known', status: 'open', notes: 'אירוע משפחתי', createdAt: format(today, 'yyyy-MM-dd HH:mm'),
  },
];

const reasonLabels: Record<string, string> = {
  sick: 'מחלה', vacation: 'חופשה', emergency: 'חירום', known: 'ידוע מראש',
};

const statusConfig: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  open: { label: 'פתוח', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  covered: { label: 'מכוסה', cls: 'bg-mint-100 text-mint-700', icon: CheckCircle },
  uncovered: { label: 'לא מכוסה', cls: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<TeacherAbsence[]>(INITIAL_ABSENCES);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = absences.filter(a => {
    if (search && !`${a.employeeName} ${a.kindergartenName}`.includes(search)) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterReason && a.reason !== filterReason) return false;
    return true;
  }).sort((a, b) => b.absenceDate.localeCompare(a.absenceDate));

  const openCount = absences.filter(a => a.status === 'open').length;

  const handleCreate = (absence: Omit<TeacherAbsence, 'id' | 'createdAt' | 'status'>) => {
    const newAbsence: TeacherAbsence = {
      ...absence,
      id: `abs-local-${Date.now()}`,
      status: 'open',
      createdAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
    };
    setAbsences(prev => [newAbsence, ...prev]);
    setShowCreate(false);
    toast.success('דיווח היעדרות נוצר בהצלחה');
  };

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
          <p className="text-2xl font-black text-mint-600">{absences.filter(a => a.status === 'covered').length}</p>
          <p className="text-xs text-slate-500 mt-0.5">מכוסים</p>
        </div>
        <div className="card p-4 text-center hidden sm:block">
          <p className="text-2xl font-black text-red-600">{absences.filter(a => a.status === 'uncovered').length}</p>
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
            const sc = statusConfig[a.status];
            const StatusIcon = sc?.icon || Clock;
            return (
              <div key={a.id} className="card p-4 sm:p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${sc?.cls}`}>
                        <StatusIcon size={12} />
                        {sc?.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {reasonLabels[a.reason]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      <User size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-navy-900 text-sm">{a.employeeName}</span>
                      <span className="text-slate-400 text-xs">({a.employeeRole === 'teacher' ? 'גננת' : 'עוזרת'})</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {a.kindergartenName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(a.absenceDate), 'EEEE d/M/yyyy', { locale: he })}
                      </span>
                    </div>

                    {a.notes && <p className="text-xs text-slate-400 mt-1.5">{a.notes}</p>}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="card p-12 text-center">
            <Filter size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">אין דיווחי היעדרות</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-mint-600 hover:text-mint-700 text-sm font-medium mt-2"
            >
              + דיווח חדש
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && <CreateAbsenceModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}

/* ────── Create Absence Modal ────── */
function CreateAbsenceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (a: Omit<TeacherAbsence, 'id' | 'createdAt' | 'status'>) => void;
}) {
  const [kindergartenName, setKindergartenName] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState<'teacher' | 'assistant'>('teacher');
  const [absenceDate, setAbsenceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState<'sick' | 'vacation' | 'emergency' | 'known'>('sick');
  const [notes, setNotes] = useState('');

  // Auto-fill teachers for selected kindergarten
  const teachersForKg = MOCK_TEACHERS.filter(t => t.kg === kindergartenName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kindergartenName || !employeeName) {
      toast.error('יש למלא את כל שדות החובה');
      return;
    }
    const teacher = MOCK_TEACHERS.find(t => t.name === employeeName);
    onCreate({
      kindergartenName,
      employeeName,
      employeeRole: teacher?.role || employeeRole,
      absenceDate,
      reason,
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
            <label className="label">גן ילדים</label>
            <select
              value={kindergartenName}
              onChange={e => { setKindergartenName(e.target.value); setEmployeeName(''); }}
              className="input"
              required
            >
              <option value="">בחר גן...</option>
              {MOCK_KINDERGARTENS.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">שם העובד/ת הנעדר/ת</label>
            {teachersForKg.length > 0 ? (
              <select value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="input" required>
                <option value="">בחר עובד/ת...</option>
                {teachersForKg.map(t => (
                  <option key={t.name} value={t.name}>{t.name} ({t.role === 'teacher' ? 'גננת' : 'עוזרת'})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={employeeName}
                onChange={e => setEmployeeName(e.target.value)}
                className="input"
                placeholder="שם מלא"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תפקיד</label>
              <select value={employeeRole} onChange={e => setEmployeeRole(e.target.value as 'teacher' | 'assistant')} className="input">
                <option value="teacher">גננת</option>
                <option value="assistant">עוזרת</option>
              </select>
            </div>
            <div>
              <label className="label">תאריך</label>
              <input type="date" value={absenceDate} onChange={e => setAbsenceDate(e.target.value)} className="input" required />
            </div>
          </div>

          <div>
            <label className="label">סיבה</label>
            <select value={reason} onChange={e => setReason(e.target.value as 'sick' | 'vacation' | 'emergency' | 'known')} className="input">
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
            <button type="submit" className="btn-primary flex-1">שלח דיווח</button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
