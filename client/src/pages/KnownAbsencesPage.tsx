import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Calendar, AlertCircle, Trash2 } from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface KnownAbsence {
  id: string;
  kindergarten_id: string;
  kindergarten_name: string;
  neighborhood: string;
  employee_name: string;
  employee_role: 'teacher' | 'assistant';
  start_date: string;
  end_date: string;
  reason: string | null;
  notes: string | null;
  creator_first_name: string | null;
  creator_last_name: string | null;
  created_at: string;
}

interface Kindergarten {
  id: string;
  name: string;
  neighborhood: string;
}

const reasonLabels: Record<string, string> = {
  vacation: 'חופשה שנתית',
  maternity: 'חופשת לידה',
  sabbatical: 'שנת שבתון',
  military: 'מילואים',
  other: 'אחר',
};

const roleLabels = { teacher: 'גננת', assistant: 'סייעת' };

export default function KnownAbsencesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    kindergartenId: '', employeeName: '', employeeRole: 'teacher',
    startDate: '', endDate: '', reason: 'vacation', notes: '',
  });
  const queryClient = useQueryClient();

  const { data: knownAbsences = [], isLoading, isError } = useQuery<KnownAbsence[]>({
    queryKey: ['known-absences'],
    queryFn: () => api.get('/known-absences').then(r => r.data),
  });

  const { data: kindergartens = [] } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens-my'],
    queryFn: () => api.get('/manager-kindergartens/my').then(r => r.data).catch(() =>
      api.get('/kindergartens').then(r => r.data)
    ),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/known-absences', {
      kindergartenId: form.kindergartenId,
      employeeName: form.employeeName,
      employeeRole: form.employeeRole,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('חופש מתוכנן נוצר');
      setShowCreate(false);
      setForm({ kindergartenId: '', employeeName: '', employeeRole: 'teacher', startDate: '', endDate: '', reason: 'vacation', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['known-absences'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'שגיאה ביצירת החופש'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/known-absences/${id}`),
    onSuccess: () => {
      toast.success('חופש מתוכנן נמחק');
      queryClient.invalidateQueries({ queryKey: ['known-absences'] });
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle size={24} className="text-red-400" />
        <p>שגיאה בטעינת החופשים המתוכננים</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">חופשים מתוכננים</h1>
          <p className="text-slate-500 text-sm mt-0.5">ניהול היעדרויות ידועות מראש</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          הוסף חופש
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 h-16 skeleton" />
          ))
        ) : knownAbsences.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <Calendar size={32} className="mx-auto mb-3 opacity-40" />
            <p>אין חופשים מתוכננים</p>
          </div>
        ) : (
          knownAbsences.map(ka => (
            <div key={ka.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-navy-900 text-sm">{ka.employee_name}</p>
                  <span className="text-xs text-slate-400">({roleLabels[ka.employee_role]})</span>
                  <span className="badge-blue text-xs">{ka.kindergarten_name}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span>
                    {format(new Date(ka.start_date), 'd MMM', { locale: he })} –{' '}
                    {format(new Date(ka.end_date), 'd MMM yyyy', { locale: he })}
                  </span>
                  {ka.reason && <span className="text-slate-400">· {reasonLabels[ka.reason] || ka.reason}</span>}
                </div>
                {ka.notes && <p className="text-xs text-slate-400 mt-1">{ka.notes}</p>}
              </div>
              <button
                onClick={() => { if (confirm('למחוק חופש זה?')) deleteMutation.mutate(ka.id); }}
                className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy-900 text-lg">הוספת חופש מתוכנן</h3>
              <button onClick={() => setShowCreate(false)}><X size={20} className="text-slate-400" /></button>
            </div>

            <div>
              <label className="label">גן ילדים</label>
              <select className="input" value={form.kindergartenId} onChange={e => setForm(p => ({ ...p, kindergartenId: e.target.value }))}>
                <option value="">בחר גן...</option>
                {kindergartens.map(kg => <option key={kg.id} value={kg.id}>{kg.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">שם העובדת</label>
                <input className="input" value={form.employeeName} onChange={e => setForm(p => ({ ...p, employeeName: e.target.value }))} />
              </div>
              <div>
                <label className="label">תפקיד</label>
                <select className="input" value={form.employeeRole} onChange={e => setForm(p => ({ ...p, employeeRole: e.target.value }))}>
                  <option value="teacher">גננת</option>
                  <option value="assistant">סייעת</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">תאריך התחלה</label>
                <input className="input" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="label">תאריך סיום</label>
                <input className="input" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="label">סיבה</label>
              <select className="input" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}>
                {Object.entries(reasonLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="label">הערות (אופציונלי)</label>
              <textarea className="input resize-none h-16" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">ביטול</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.kindergartenId || !form.employeeName || !form.startDate || !form.endDate || createMutation.isPending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {createMutation.isPending ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
