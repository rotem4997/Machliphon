import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Plus, X, Calendar, MapPin, User, Trash2
} from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Absence {
  id: string;
  kindergarten_id: string;
  kindergarten_name: string;
  kindergarten_address: string;
  neighborhood: string;
  absent_employee_name: string;
  absent_employee_role: string;
  absence_date: string;
  absence_reason: string | null;
  notes: string | null;
  status: string;
  reporter_first_name: string;
  reporter_last_name: string;
  created_at: string;
}

interface Kindergarten {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  age_group: string;
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  open: { label: 'פתוח', cls: 'badge-red' },
  assigned: { label: 'שובץ', cls: 'badge-blue' },
  covered: { label: 'מכוסה', cls: 'badge-green' },
  uncovered: { label: 'לא מכוסה', cls: 'badge-red' },
};

const reasonLabels: Record<string, string> = {
  sick: 'מחלה',
  vacation: 'חופשה',
  emergency: 'חירום',
  known: 'ידוע מראש',
};

export default function AbsencesPage() {
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: absences, isLoading } = useQuery<Absence[]>({
    queryKey: ['absences', filterStatus],
    queryFn: () => api.get('/absences', { params: { status: filterStatus || undefined } }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/absences/${id}`),
    onSuccess: () => {
      toast.success('דיווח נמחק');
      queryClient.invalidateQueries({ queryKey: ['absences'] });
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  const openCount = absences?.filter(a => a.status === 'open').length ?? 0;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">היעדרויות</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {absences?.length ?? 0} דיווחים
            {openCount > 0 && <span className="text-red-500 font-medium"> • {openCount} פתוחים</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          דיווח חדש
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input py-2.5 text-sm w-auto">
          <option value="">כל הסטטוסים</option>
          <option value="open">פתוח</option>
          <option value="assigned">שובץ</option>
          <option value="covered">מכוסה</option>
          <option value="uncovered">לא מכוסה</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-20 skeleton" />)
        ) : absences && absences.length > 0 ? (
          absences.map(a => (
            <div key={a.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={statusConfig[a.status]?.cls || 'badge-gray'}>
                      {statusConfig[a.status]?.label || a.status}
                    </span>
                    {a.absence_reason && (
                      <span className="badge-gray">{reasonLabels[a.absence_reason] || a.absence_reason}</span>
                    )}
                    <span className="text-xs text-slate-400">
                      <Calendar size={11} className="inline ml-1" />
                      {format(parseISO(a.absence_date), 'EEEE d/M/yyyy', { locale: he })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="font-semibold text-navy-900 text-sm">{a.kindergarten_name}</span>
                    <span className="text-slate-400 text-xs hidden sm:inline">• {a.neighborhood}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700">
                      {a.absent_employee_name}
                      <span className="text-slate-400"> ({a.absent_employee_role === 'teacher' ? 'גננת' : 'עוזרת'})</span>
                    </span>
                  </div>

                  {a.notes && <p className="text-xs text-slate-400 mt-1.5">{a.notes}</p>}
                </div>

                {a.status === 'open' && (
                  <button
                    onClick={() => {
                      if (confirm('למחוק דיווח זה?')) deleteMutation.mutate(a.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="card p-12 text-center">
            <AlertTriangle size={40} className="text-slate-300 mx-auto mb-3" />
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

/* ────── Create Absence Modal ────── */
function CreateAbsenceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [kindergartenId, setKindergartenId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState('teacher');
  const [absenceDate, setAbsenceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('sick');
  const [notes, setNotes] = useState('');

  const { data: kindergartens } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/absences', body),
    onSuccess: () => {
      toast.success('דיווח היעדרות נוצר');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'שגיאה ביצירת דיווח'),
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
      <div className="card p-6 w-full max-w-md slide-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900 text-lg">דיווח היעדרות חדש</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">גן ילדים</label>
            <select value={kindergartenId} onChange={e => setKindergartenId(e.target.value)} className="input" required>
              <option value="">בחר גן...</option>
              {kindergartens?.map(k => (
                <option key={k.id} value={k.id}>{k.name} — {k.neighborhood}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">שם העובד/ת הנעדר/ת</label>
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
              <select value={employeeRole} onChange={e => setEmployeeRole(e.target.value)} className="input">
                <option value="teacher">גננת</option>
                <option value="assistant">עוזרת</option>
              </select>
            </div>
            <div>
              <label className="label">תאריך היעדרות</label>
              <input type="date" value={absenceDate} onChange={e => setAbsenceDate(e.target.value)} className="input" required />
            </div>
          </div>

          <div>
            <label className="label">סיבת היעדרות</label>
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
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? 'שולח...' : 'שלח דיווח'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
