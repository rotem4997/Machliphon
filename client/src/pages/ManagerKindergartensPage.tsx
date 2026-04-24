import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, User, Building } from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';

interface MappingRow {
  manager_id: string;
  kindergarten_id: string;
  manager_name: string;
  manager_email: string;
  region: string;
  kindergarten_name: string;
  neighborhood: string;
  address: string;
}

interface Manager {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  region: string;
  managed_kindergartens_count: number;
}

interface Kindergarten {
  id: string;
  name: string;
  neighborhood: string;
}

export default function ManagerKindergartensPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ managerId: '', kindergartenId: '' });
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading, isError } = useQuery<MappingRow[]>({
    queryKey: ['manager-kindergartens'],
    queryFn: () => api.get('/manager-kindergartens').then(r => r.data),
  });

  const { data: managers = [] } = useQuery<Manager[]>({
    queryKey: ['managers-list'],
    queryFn: () => api.get('/manager-kindergartens/managers').then(r => r.data),
  });

  const { data: kindergartens = [] } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: () => api.post('/manager-kindergartens', { managerId: form.managerId, kindergartenId: form.kindergartenId }),
    onSuccess: () => {
      toast.success('גן שויך למנהלת');
      setShowAdd(false);
      setForm({ managerId: '', kindergartenId: '' });
      queryClient.invalidateQueries({ queryKey: ['manager-kindergartens'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'שגיאה בשיוך'),
  });

  const removeMutation = useMutation({
    mutationFn: ({ managerId, kindergartenId }: { managerId: string; kindergartenId: string }) =>
      api.delete('/manager-kindergartens', { data: { managerId, kindergartenId } }),
    onSuccess: () => {
      toast.success('שיוך הוסר');
      queryClient.invalidateQueries({ queryKey: ['manager-kindergartens'] });
    },
    onError: () => toast.error('שגיאה בהסרת השיוך'),
  });

  // Group mappings by manager
  const byManager = mappings.reduce<Record<string, { manager: Pick<MappingRow, 'manager_name' | 'manager_email' | 'region'>; kindergartens: Pick<MappingRow, 'kindergarten_id' | 'kindergarten_name' | 'neighborhood'>[] }>>((acc, m) => {
    if (!acc[m.manager_id]) {
      acc[m.manager_id] = { manager: { manager_name: m.manager_name, manager_email: m.manager_email, region: m.region }, kindergartens: [] };
    }
    acc[m.manager_id].kindergartens.push({ kindergarten_id: m.kindergarten_id, kindergarten_name: m.kindergarten_name, neighborhood: m.neighborhood });
    return acc;
  }, {});

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle size={24} className="text-red-400" />
        <p>שגיאה בטעינת השיוכים</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">שיוך מנהלות לגנים</h1>
          <p className="text-slate-500 text-sm mt-0.5">ניהול אחריות מנהלות על גני ילדים</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          הוסף שיוך
        </button>
      </div>

      {/* Manager cards */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="card p-6 h-32 skeleton" />)
        ) : Object.entries(byManager).length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <User size={32} className="mx-auto mb-3 opacity-40" />
            <p>אין שיוכים מוגדרים</p>
          </div>
        ) : (
          Object.entries(byManager).map(([managerId, { manager, kindergartens: kgs }]) => (
            <div key={managerId} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400" />
                    <p className="font-bold text-navy-900">{manager.manager_name}</p>
                    {manager.region && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{manager.region}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{manager.manager_email}</p>
                </div>
                <span className="text-xs text-slate-500">{kgs.length} גנים</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {kgs.map(kg => (
                  <div key={kg.kindergarten_id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building size={13} className="text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900 truncate">{kg.kindergarten_name}</p>
                        {kg.neighborhood && <p className="text-xs text-slate-400">{kg.neighborhood}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm('להסיר שיוך זה?')) removeMutation.mutate({ managerId, kindergartenId: kg.kindergarten_id }); }}
                      className="text-slate-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-navy-900 text-lg">הוספת שיוך</h3>

            <div>
              <label className="label">מנהלת</label>
              <select className="input" value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}>
                <option value="">בחר מנהלת...</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.region || 'ללא אזור'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">גן ילדים</label>
              <select className="input" value={form.kindergartenId} onChange={e => setForm(p => ({ ...p, kindergartenId: e.target.value }))}>
                <option value="">בחר גן...</option>
                {kindergartens.map(kg => (
                  <option key={kg.id} value={kg.id}>{kg.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm">ביטול</button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.managerId || !form.kindergartenId || addMutation.isPending}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {addMutation.isPending ? 'שומר...' : 'שייך'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
