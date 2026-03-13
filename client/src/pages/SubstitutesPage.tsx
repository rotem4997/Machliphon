import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Phone, Mail, MapPin, CheckCircle, XCircle,
  Clock, User, GraduationCap, CreditCard, Download, X,
} from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';

// ─── Types (matches API response from GET /api/substitutes) ──
interface Substitute {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  id_number: string;
  address: string | null;
  neighborhood: string | null;
  education_level: string | null;
  years_experience: number;
  work_permit_valid: boolean;
  work_permit_expiry: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'pending_approval';
  total_assignments: number;
  rating: number;
  has_assignment_today: boolean;
  assignments_this_month: number;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  active: { label: 'פעילה', cls: 'bg-mint-100 text-mint-700' },
  inactive: { label: 'לא פעילה', cls: 'bg-slate-100 text-slate-600' },
  suspended: { label: 'מושעית', cls: 'bg-red-100 text-red-600' },
  pending_approval: { label: 'ממתינה', cls: 'bg-amber-100 text-amber-700' },
};

// ─── CSV Export ──────────────────────────────────────────────
function exportToCSV(subs: Substitute[]) {
  const BOM = '\uFEFF';
  const headers = ['שם פרטי', 'שם משפחה', 'טלפון', 'אימייל', 'ת.ז.', 'כתובת', 'שכונה', 'השכלה', 'תיק עובד', 'סטטוס', 'שיבוצים החודש', 'סה"כ שיבוצים'];
  const rows = subs.map(s => [
    s.first_name, s.last_name, s.phone, s.email, s.id_number,
    s.address || '', s.neighborhood || '',
    s.education_level || '', s.work_permit_valid ? 'תקף' : 'לא תקף',
    statusLabels[s.status]?.label || s.status,
    s.assignments_this_month.toString(), s.total_assignments.toString(),
  ]);

  const csvContent = BOM + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `מחליפות_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('קובץ CSV הורד בהצלחה');
}

export default function SubstitutesPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selectedSub, setSelectedSub] = useState<Substitute | null>(null);

  const { data: substitutes = [], isLoading } = useQuery<Substitute[]>({
    queryKey: ['substitutes'],
    queryFn: () => api.get('/substitutes').then(r => r.data),
  });

  const filtered = substitutes.filter(s => {
    if (search && !`${s.first_name} ${s.last_name} ${s.phone} ${s.email}`.includes(search)) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-900">מחליפות</h1>
          <p className="text-slate-500 text-sm mt-0.5">{substitutes.length} מחליפות ברשות</p>
        </div>
        <button
          onClick={() => exportToCSV(filtered)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Download size={16} />
          ייצוא CSV
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
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">זמינות היום</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-5 py-4"><div className="h-10 skeleton rounded" /></td>
                  </tr>
                ))
              ) : filtered.length > 0 ? (
                filtered.map(sub => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 sm:px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-sm font-bold text-navy-700 flex-shrink-0">
                          {sub.first_name[0]}{sub.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-navy-900 text-sm truncate">{sub.first_name} {sub.last_name}</p>
                          <p className="text-slate-400 text-xs truncate md:hidden">{sub.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <a href={`tel:${sub.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-600">
                        <Phone size={13} />
                        {sub.phone}
                      </a>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 hidden lg:table-cell">{sub.education_level || '—'}</td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="font-semibold text-navy-900 text-sm">{sub.assignments_this_month}</span>
                      <span className="text-slate-400 text-xs"> החודש</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusLabels[sub.status]?.cls}`}>
                        {statusLabels[sub.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {sub.status !== 'active' ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : sub.has_assignment_today ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                          <Clock size={12} />
                          משובצת
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-mint-100 text-mint-700">
                          <CheckCircle size={12} />
                          זמינה
                        </span>
                      )}
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
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">לא נמצאו מחליפות</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSub && <SubstituteDetailModal sub={selectedSub} onClose={() => setSelectedSub(null)} />}
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
            <span className="text-2xl font-bold text-mint-400">{sub.first_name[0]}{sub.last_name[0]}</span>
          </div>
          <h2 className="text-lg font-bold text-navy-900">{sub.first_name} {sub.last_name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusLabels[sub.status]?.cls}`}>
              {statusLabels[sub.status]?.label}
            </span>
            {sub.status === 'active' && (
              sub.has_assignment_today ? (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                  <Clock size={12} />
                  משובצת היום
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-mint-100 text-mint-700">
                  <CheckCircle size={12} />
                  זמינה היום
                </span>
              )
            )}
          </div>
        </div>

        {/* Info */}
        <div className="divide-y divide-slate-100 space-y-0">
          <DetailRow icon={Phone} label="טלפון" value={sub.phone} />
          <DetailRow icon={Mail} label="אימייל" value={sub.email} />
          <DetailRow icon={CreditCard} label="ת.ז." value={sub.id_number} />
          <DetailRow icon={MapPin} label="כתובת" value={sub.address || ''} />
          {sub.neighborhood && <DetailRow icon={MapPin} label="שכונה" value={sub.neighborhood} />}
          <DetailRow icon={GraduationCap} label="השכלה" value={sub.education_level || ''} />
          <div className="flex items-center gap-3 py-3">
            {sub.work_permit_valid ? (
              <CheckCircle size={16} className="text-mint-500 flex-shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-xs text-slate-500">תיק עובד</p>
              <p className={`text-sm font-medium ${sub.work_permit_valid ? 'text-mint-600' : 'text-red-600'}`}>
                {sub.work_permit_valid ? 'תקף' : 'לא תקף'}
                {sub.work_permit_expiry && (
                  <span className="text-slate-400 font-normal text-xs mr-2">
                    עד {new Date(sub.work_permit_expiry).toLocaleDateString('he-IL')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-navy-900">{sub.assignments_this_month}</p>
            <p className="text-xs text-slate-500">שיבוצים החודש</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-navy-900">{sub.total_assignments}</p>
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
