import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Phone, Mail, MapPin, CheckCircle, XCircle,
  Clock, GraduationCap, CreditCard, Download, X, Upload, UserCheck, AlertCircle,
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
  teaching_license_url: string | null;
  years_experience: number;
  work_permit_valid: boolean;
  work_permit_expiry: string | null;
  work_permit_number: string | null;
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
  pending_approval: { label: 'ממתינה לאישור', cls: 'bg-amber-100 text-amber-700' },
};

// ─── Validation ──────────────────────────────────────────────
function validateIdNumber(id: string): string | null {
  const digits = id.replace(/\D/g, '');
  if (digits.length !== 9) return 'תעודת זהות חייבת להכיל 9 ספרות';
  return null;
}

function validatePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) return 'מספר טלפון חייב להכיל 10 ספרות';
  return null;
}

function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'כתובת אימייל לא תקינה';
  return null;
}

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
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Substitute | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Substitute | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [permitTarget, setPermitTarget] = useState<Substitute | null>(null);
  const [permitForm, setPermitForm] = useState({ number: '', expiry: '', valid: true });

  const queryClient = useQueryClient();

  const { data: substitutes = [], isLoading, isError } = useQuery<Substitute[]>({
    queryKey: ['substitutes'],
    queryFn: () => api.get('/substitutes').then(r => r.data),
  });

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>שגיאה בטעינת המחליפות. אנא נסה שנית.</p>
      </div>
    );
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/substitutes/${id}/approve`),
    onSuccess: () => {
      toast.success('מחליפה אושרה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['substitutes'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error;
      toast.error(typeof msg === 'string' ? msg : 'שגיאה באישור המחליפה');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/substitutes/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('מחליפה נדחתה');
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['substitutes'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error;
      toast.error(typeof msg === 'string' ? msg : 'שגיאה בדחיית המחליפה');
    },
  });

  const permitMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch(`/substitutes/${id}/permit`, {
        workPermitValid: permitForm.valid,
        workPermitNumber: permitForm.number,
        workPermitExpiry: permitForm.expiry || null,
      }),
    onSuccess: () => {
      toast.success('תיק עובד עודכן בהצלחה');
      setPermitTarget(null);
      queryClient.invalidateQueries({ queryKey: ['substitutes'] });
    },
    onError: () => toast.error('שגיאה בעדכון תיק עובד'),
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(filtered)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            ייצוא CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            הוסף מחליפה
          </button>
        </div>
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
                      <div className="flex items-center gap-2">
                        {sub.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => { if (confirm('לאשר מחליפה זו?')) approveMutation.mutate(sub.id); }}
                              className="text-xs text-mint-600 hover:text-mint-700 font-medium flex items-center gap-1"
                            >
                              <UserCheck size={13} />
                              אשר
                            </button>
                            <button
                              onClick={() => setRejectTarget(sub)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                            >
                              <XCircle size={13} />
                              דחה
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { setPermitTarget(sub); setPermitForm({ number: sub.work_permit_number || '', expiry: sub.work_permit_expiry || '', valid: sub.work_permit_valid }); }}
                          className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                          title="עדכון תיק עובד"
                        >
                          <CreditCard size={13} />
                          תיק עובד
                        </button>
                        <button
                          onClick={() => setSelectedSub(sub)}
                          className="text-xs text-sky-600 hover:text-sky-700 font-medium"
                        >
                          פרטים
                        </button>
                      </div>
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

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-navy-900">דחיית מחליפה</h3>
            <p className="text-sm text-slate-600">
              {rejectTarget.first_name} {rejectTarget.last_name} — האם ברצונך לדחות את הבקשה?
            </p>
            <div>
              <label className="label">סיבת הדחייה (אופציונלי)</label>
              <textarea
                className="input resize-none h-20"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="הסבר מדוע הבקשה נדחתה..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectTarget(null)} className="btn-secondary text-sm">ביטול</button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason })}
                disabled={rejectMutation.isPending}
                className="btn-primary text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'שומר...' : 'דחה בקשה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permit Update Modal — C2 */}
      {permitTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-navy-900">עדכון תיק עובד</h3>
            <p className="text-sm text-slate-500">{permitTarget.first_name} {permitTarget.last_name}</p>
            <div>
              <label className="label">מספר תיק עובד</label>
              <input className="input" value={permitForm.number} onChange={e => setPermitForm(p => ({ ...p, number: e.target.value }))} />
            </div>
            <div>
              <label className="label">תאריך פקיעה</label>
              <input className="input" type="date" value={permitForm.expiry} onChange={e => setPermitForm(p => ({ ...p, expiry: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="permitValid" checked={permitForm.valid} onChange={e => setPermitForm(p => ({ ...p, valid: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="permitValid" className="text-sm text-slate-700">תיק עובד תקף</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPermitTarget(null)} className="btn-secondary text-sm">ביטול</button>
              <button
                onClick={() => permitMutation.mutate({ id: permitTarget.id })}
                disabled={permitMutation.isPending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {permitMutation.isPending ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateSubstituteModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['substitutes'] });
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedSub && (
        <SubstituteDetailModal
          sub={selectedSub}
          onClose={() => setSelectedSub(null)}
          onApprove={sub => {
            if (confirm('לאשר מחליפה זו?')) approveMutation.mutate(sub.id);
            setSelectedSub(null);
          }}
        />
      )}
    </div>
  );
}

/* ────── Create Substitute Modal ────── */
function CreateSubstituteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    idNumber: '', street: '', city: '', zipCode: '',
    educationLevel: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => api.post('/substitutes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      toast.success('מחליפה נוצרה בהצלחה וממתינה לאישור');
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error;
      toast.error(typeof msg === 'string' ? msg : 'שגיאה ביצירת מחליפה');
    },
  });

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.firstName) newErrors.firstName = 'שדה חובה';
    if (!form.lastName) newErrors.lastName = 'שדה חובה';
    const idErr = validateIdNumber(form.idNumber);
    if (idErr) newErrors.idNumber = idErr;
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) newErrors.phone = phoneErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) newErrors.email = emailErr;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('יש לתקן את השגיאות בטופס');
      return;
    }

    const formData = new FormData();
    formData.append('firstName', form.firstName);
    formData.append('lastName', form.lastName);
    formData.append('phone', form.phone);
    formData.append('email', form.email);
    formData.append('idNumber', form.idNumber);
    formData.append('street', form.street);
    formData.append('city', form.city);
    formData.append('zipCode', form.zipCode);
    formData.append('educationLevel', form.educationLevel);
    if (file) formData.append('teachingLicense', file);

    createMutation.mutate(formData);
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
          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">שם פרטי *</label>
              <input className={`input ${errors.firstName ? 'border-red-400 focus:ring-red-400' : ''}`} value={form.firstName} onChange={e => update('firstName', e.target.value)} />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="label">שם משפחה *</label>
              <input className={`input ${errors.lastName ? 'border-red-400 focus:ring-red-400' : ''}`} value={form.lastName} onChange={e => update('lastName', e.target.value)} />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>
          </div>

          {/* ID */}
          <div>
            <label className="label">תעודת זהות * (9 ספרות)</label>
            <input
              className={`input ${errors.idNumber ? 'border-red-400 focus:ring-red-400' : ''}`}
              value={form.idNumber}
              onChange={e => update('idNumber', e.target.value)}
              placeholder="123456789"
              maxLength={9}
              dir="ltr"
            />
            {errors.idNumber && <p className="text-red-500 text-xs mt-1">{errors.idNumber}</p>}
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון * (10 ספרות)</label>
              <input
                className={`input ${errors.phone ? 'border-red-400 focus:ring-red-400' : ''}`}
                type="tel"
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="0541234567"
                maxLength={10}
                dir="ltr"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="label">אימייל *</label>
              <input
                className={`input ${errors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="name@email.com"
                dir="ltr"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Address */}
          <fieldset className="border border-slate-200 rounded-xl p-3 space-y-3">
            <legend className="text-sm font-semibold text-navy-900 px-2">כתובת</legend>
            <div>
              <label className="text-xs text-slate-500">רחוב</label>
              <input className="input mt-0.5" value={form.street} onChange={e => update('street', e.target.value)} placeholder="רחוב הרצל 5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">עיר</label>
                <input className="input mt-0.5" value={form.city} onChange={e => update('city', e.target.value)} placeholder="תל אביב" />
              </div>
              <div>
                <label className="text-xs text-slate-500">מיקוד</label>
                <input className="input mt-0.5" value={form.zipCode} onChange={e => update('zipCode', e.target.value)} placeholder="6120101" maxLength={7} dir="ltr" />
              </div>
            </div>
          </fieldset>

          {/* Education */}
          <div>
            <label className="label">השכלה</label>
            <select className="input" value={form.educationLevel} onChange={e => update('educationLevel', e.target.value)}>
              <option value="">בחר...</option>
              <option value="תעודת הוראה">תעודת הוראה</option>
              <option value="סמינר למורות">סמינר למורות</option>
              <option value="תואר ראשון בחינוך">תואר ראשון בחינוך</option>
              <option value="תואר שני בגיל הרך">תואר שני בגיל הרך</option>
              <option value="תואר ראשון אחר">תואר ראשון אחר</option>
              <option value="אחר">אחר</option>
            </select>
          </div>

          {/* Teaching License Upload */}
          <div>
            <label className="label">רישיון הוראה (PDF, JPG, PNG עד 5MB)</label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="license-upload"
              />
              <label
                htmlFor="license-upload"
                className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-mint-300 hover:bg-mint-50/50 transition-colors"
              >
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm text-slate-600">
                  {file ? file.name : 'לחץ לבחירת קובץ...'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {createMutation.isPending ? 'יוצר...' : (
                <>
                  <Plus size={16} />
                  צור מחליפה
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────── Substitute Detail Modal ────── */
function SubstituteDetailModal({ sub, onClose, onApprove }: { sub: Substitute; onClose: () => void; onApprove: (sub: Substitute) => void }) {
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
          {sub.teaching_license_url && (
            <div className="flex items-center gap-3 py-3">
              <GraduationCap size={16} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">רישיון הוראה</p>
                <a
                  href={sub.teaching_license_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-sky-600 hover:text-sky-700"
                >
                  צפה בקובץ
                </a>
              </div>
            </div>
          )}
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

        <div className="flex gap-2 mt-4">
          {sub.status === 'pending_approval' && (
            <button
              onClick={() => onApprove(sub)}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <UserCheck size={16} />
              אשר מחליפה
            </button>
          )}
          <button onClick={onClose} className={`btn-secondary ${sub.status === 'pending_approval' ? '' : 'w-full'}`}>סגור</button>
        </div>
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
