import { useState } from 'react';
import {
  Search, Plus, X, Phone, Mail, MapPin, CheckCircle, XCircle,
  Clock, ChevronRight, Send, User, GraduationCap, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────
interface Substitute {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  idNumber: string;
  address: string;
  education: string;
  hasWorkLicense: boolean;
  status: 'active' | 'inactive' | 'pending_approval';
  assignmentsThisMonth: number;
  totalAssignments: number;
  hasAssignmentToday: boolean;
}

// ─── Mock Data ───────────────────────────────────────────────
const INITIAL_SUBSTITUTES: Substitute[] = [
  {
    id: 'sub-1', firstName: 'נועה', lastName: 'ישראלי', phone: '054-1111111',
    email: 'noa@email.com', idNumber: '123456789', address: 'רחוב הרצל 5, תל אביב',
    education: 'תואר ראשון בחינוך', hasWorkLicense: true, status: 'active',
    assignmentsThisMonth: 8, totalAssignments: 42, hasAssignmentToday: true,
  },
  {
    id: 'sub-2', firstName: 'שירה', lastName: 'לוי', phone: '054-2222222',
    email: 'shira@email.com', idNumber: '234567890', address: 'רחוב ויצמן 12, רמת גן',
    education: 'תעודת הוראה', hasWorkLicense: true, status: 'active',
    assignmentsThisMonth: 5, totalAssignments: 28, hasAssignmentToday: false,
  },
  {
    id: 'sub-3', firstName: 'מיה', lastName: 'כהן', phone: '054-3333333',
    email: 'maya@email.com', idNumber: '345678901', address: 'שדרות בן גוריון 8, חולון',
    education: 'תואר שני בגיל הרך', hasWorkLicense: true, status: 'active',
    assignmentsThisMonth: 12, totalAssignments: 67, hasAssignmentToday: true,
  },
  {
    id: 'sub-4', firstName: 'רוני', lastName: 'דוד', phone: '054-4444444',
    email: 'roni@email.com', idNumber: '456789012', address: 'רחוב סוקולוב 3, הרצליה',
    education: 'סמינר למורות', hasWorkLicense: false, status: 'pending_approval',
    assignmentsThisMonth: 0, totalAssignments: 0, hasAssignmentToday: false,
  },
  {
    id: 'sub-5', firstName: 'הדס', lastName: 'פרידמן', phone: '054-5555555',
    email: 'hadas@email.com', idNumber: '567890123', address: 'רחוב הגפן 15, גבעתיים',
    education: 'תואר ראשון בפסיכולוגיה', hasWorkLicense: true, status: 'active',
    assignmentsThisMonth: 3, totalAssignments: 15, hasAssignmentToday: false,
  },
  {
    id: 'sub-6', firstName: 'תמר', lastName: 'אברהם', phone: '054-6666666',
    email: 'tamar@email.com', idNumber: '678901234', address: 'רחוב העצמאות 22, בת ים',
    education: 'תעודת הוראה', hasWorkLicense: true, status: 'inactive',
    assignmentsThisMonth: 0, totalAssignments: 19, hasAssignmentToday: false,
  },
];

const statusLabels: Record<string, { label: string; cls: string }> = {
  active: { label: 'פעילה', cls: 'bg-mint-100 text-mint-700' },
  inactive: { label: 'לא פעילה', cls: 'bg-slate-100 text-slate-600' },
  pending_approval: { label: 'ממתינה', cls: 'bg-amber-100 text-amber-700' },
};

export default function SubstitutesPage() {
  const [substitutes, setSubstitutes] = useState<Substitute[]>(INITIAL_SUBSTITUTES);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Substitute | null>(null);

  const filtered = substitutes.filter(s => {
    if (search && !`${s.firstName} ${s.lastName} ${s.phone} ${s.email}`.includes(search)) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const handleCreate = (sub: Omit<Substitute, 'id' | 'status' | 'assignmentsThisMonth' | 'totalAssignments' | 'hasAssignmentToday'>) => {
    const newSub: Substitute = {
      ...sub,
      id: `sub-local-${Date.now()}`,
      status: 'pending_approval',
      assignmentsThisMonth: 0,
      totalAssignments: 0,
      hasAssignmentToday: false,
    };
    setSubstitutes(prev => [newSub, ...prev]);
    setShowCreate(false);
    toast.success('מחליפה נוצרה בהצלחה! אימייל ברוכים הבאים נשלח.');
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-900">מחליפות</h1>
          <p className="text-slate-500 text-sm mt-0.5">{substitutes.length} מחליפות ברשות</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          הוסף מחליפה
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון, אימייל..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pr-9 py-2.5 text-sm w-full"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input py-2.5 text-sm w-full sm:w-auto">
          <option value="">כל הסטטוסים</option>
          <option value="active">פעילה</option>
          <option value="inactive">לא פעילה</option>
          <option value="pending_approval">ממתינה לאישור</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-right text-xs font-semibold text-slate-500 px-4 sm:px-5 py-3.5">שם</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden md:table-cell">טלפון</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden lg:table-cell">השכלה</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden md:table-cell">שיבוצים</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">סטטוס</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 sm:px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-sm font-bold text-navy-700 flex-shrink-0">
                        {sub.firstName[0]}{sub.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-navy-900 text-sm truncate">{sub.firstName} {sub.lastName}</p>
                        <p className="text-slate-400 text-xs truncate md:hidden">{sub.phone}</p>
                      </div>
                      {sub.hasAssignmentToday && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hidden sm:inline">משובצת היום</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <a href={`tel:${sub.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-600">
                      <Phone size={13} />
                      {sub.phone}
                    </a>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 hidden lg:table-cell">{sub.education}</td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="font-semibold text-navy-900 text-sm">{sub.assignmentsThisMonth}</span>
                    <span className="text-slate-400 text-xs"> החודש</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusLabels[sub.status]?.cls}`}>
                      {statusLabels[sub.status]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                    >
                      פרטים
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">לא נמצאו מחליפות</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && <CreateSubstituteModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}

      {/* Detail Modal */}
      {selectedSub && <SubstituteDetailModal sub={selectedSub} onClose={() => setSelectedSub(null)} />}
    </div>
  );
}

/* ────── Create Substitute Modal ────── */
function CreateSubstituteModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (s: Omit<Substitute, 'id' | 'status' | 'assignmentsThisMonth' | 'totalAssignments' | 'hasAssignmentToday'>) => void;
}) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    idNumber: '', address: '', education: '', hasWorkLicense: false,
  });

  const update = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.idNumber) {
      toast.error('יש למלא את כל שדות החובה');
      return;
    }
    onCreate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-lg slide-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900 text-lg">הוספת מחליפה חדשה</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">שם פרטי *</label>
              <input className="input" value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
            </div>
            <div>
              <label className="label">שם משפחה *</label>
              <input className="input" value={form.lastName} onChange={e => update('lastName', e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">תעודת זהות *</label>
            <input className="input" value={form.idNumber} onChange={e => update('idNumber', e.target.value)} placeholder="123456789" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input className="input" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="054-1234567" required />
            </div>
            <div>
              <label className="label">אימייל *</label>
              <input className="input" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@email.com" required />
            </div>
          </div>

          <div>
            <label className="label">כתובת</label>
            <input className="input" value={form.address} onChange={e => update('address', e.target.value)} placeholder="רחוב, עיר" />
          </div>

          <div>
            <label className="label">השכלה</label>
            <select className="input" value={form.education} onChange={e => update('education', e.target.value)}>
              <option value="">בחר...</option>
              <option value="תעודת הוראה">תעודת הוראה</option>
              <option value="סמינר למורות">סמינר למורות</option>
              <option value="תואר ראשון בחינוך">תואר ראשון בחינוך</option>
              <option value="תואר שני בגיל הרך">תואר שני בגיל הרך</option>
              <option value="תואר ראשון אחר">תואר ראשון אחר</option>
              <option value="אחר">אחר</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="workLicense"
              checked={form.hasWorkLicense}
              onChange={e => update('hasWorkLicense', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-mint-500 focus:ring-mint-400"
            />
            <label htmlFor="workLicense" className="text-sm text-navy-900">בעלת רישיון לעבודה</label>
          </div>

          {/* Welcome email notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <Send size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              לאחר היצירה, יישלח אימייל ברוכים הבאים לכתובת שהוזנה עם קישור לאיפוס סיסמה וכניסה למערכת.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Plus size={16} />
              צור מחליפה
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────── Substitute Detail Modal ────── */
function SubstituteDetailModal({ sub, onClose }: { sub: Substitute; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card p-6 w-full max-w-md slide-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900 text-lg">פרטי מחליפה</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Avatar + Name */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-mint-400">{sub.firstName[0]}{sub.lastName[0]}</span>
          </div>
          <h2 className="text-lg font-bold text-navy-900">{sub.firstName} {sub.lastName}</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium mt-1 ${statusLabels[sub.status]?.cls}`}>
            {statusLabels[sub.status]?.label}
          </span>
        </div>

        {/* Info */}
        <div className="divide-y divide-slate-100 space-y-0">
          <DetailRow icon={Phone} label="טלפון" value={sub.phone} />
          <DetailRow icon={Mail} label="אימייל" value={sub.email} />
          <DetailRow icon={CreditCard} label="ת.ז." value={sub.idNumber} />
          <DetailRow icon={MapPin} label="כתובת" value={sub.address} />
          <DetailRow icon={GraduationCap} label="השכלה" value={sub.education} />
          <div className="flex items-center gap-3 py-3">
            {sub.hasWorkLicense ? (
              <CheckCircle size={16} className="text-mint-500 flex-shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-xs text-slate-500">רישיון לעבודה</p>
              <p className={`text-sm font-medium ${sub.hasWorkLicense ? 'text-mint-600' : 'text-red-600'}`}>
                {sub.hasWorkLicense ? 'יש' : 'אין'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-navy-900">{sub.assignmentsThisMonth}</p>
            <p className="text-xs text-slate-500">שיבוצים החודש</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-navy-900">{sub.totalAssignments}</p>
            <p className="text-xs text-slate-500">שיבוצים סה"כ</p>
          </div>
        </div>

        <button onClick={onClose} className="btn-secondary w-full mt-4">סגור</button>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon size={16} className="text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-navy-900 truncate">{value}</p>
      </div>
    </div>
  );
}
