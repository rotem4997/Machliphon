import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Plus, CheckCircle, XCircle, Clock, Phone } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

interface Substitute {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  neighborhood: string;
  work_permit_valid: boolean;
  work_permit_expiry: string;
  education_level: string;
  years_experience: number;
  status: string;
  rating: number;
  total_assignments: number;
  has_assignment_today: boolean;
  assignments_this_month: number;
}

export default function SubstitutesPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPermit, setFilterPermit] = useState('');
  const [selectedSub, setSelectedSub] = useState<Substitute | null>(null);

  const queryClient = useQueryClient();

  const { data: substitutes, isLoading } = useQuery<Substitute[]>({
    queryKey: ['substitutes', filterStatus, filterPermit],
    queryFn: () => api.get('/substitutes', { params: { status: filterStatus || undefined, permitValid: filterPermit || undefined } }).then(r => r.data),
  });

  const updatePermit = useMutation({
    mutationFn: ({ id, valid, expiry }: { id: string; valid: boolean; expiry: string }) =>
      api.patch(`/substitutes/${id}/permit`, { workPermitValid: valid, workPermitExpiry: expiry }),
    onSuccess: () => {
      toast.success('תיק עובד עודכן');
      queryClient.invalidateQueries({ queryKey: ['substitutes'] });
    },
  });

  const filtered = substitutes?.filter(s =>
    `${s.first_name} ${s.last_name} ${s.phone} ${s.email}`.includes(search)
  );

  const statusLabel: Record<string, { label: string; cls: string }> = {
    active: { label: 'פעילה', cls: 'badge-green' },
    inactive: { label: 'לא פעילה', cls: 'badge-gray' },
    suspended: { label: 'מושעית', cls: 'badge-red' },
    pending_approval: { label: 'ממתינה', cls: 'badge-amber' },
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">מחליפות</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {substitutes?.length ?? 0} מחליפות ברשות
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          הוסף מחליפה
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-52 relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, טלפון, אימייל..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pr-9 py-2.5 text-sm"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input py-2.5 text-sm w-auto">
          <option value="">כל הסטטוסים</option>
          <option value="active">פעילה</option>
          <option value="inactive">לא פעילה</option>
          <option value="pending_approval">ממתינה לאישור</option>
        </select>
        <select value={filterPermit} onChange={e => setFilterPermit(e.target.value)} className="input py-2.5 text-sm w-auto">
          <option value="">כל תיקי עובד</option>
          <option value="true">תיק תקף</option>
          <option value="false">תיק לא תקף</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 skeleton" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3.5 uppercase tracking-wide">שם</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden md:table-cell">טלפון</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden lg:table-cell">שכונה</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">תיק עובד</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden md:table-cell">שיבוצים</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">סטטוס</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered?.map(sub => {
                  const permitOk = sub.work_permit_valid && new Date(sub.work_permit_expiry) > new Date();
                  const permitExpiring = sub.work_permit_valid && sub.work_permit_expiry && 
                    new Date(sub.work_permit_expiry) < new Date(Date.now() + 30 * 86400000);
                  
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-sm font-bold text-navy-700 flex-shrink-0">
                            {sub.first_name[0]}{sub.last_name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-navy-900 text-sm">{sub.first_name} {sub.last_name}</p>
                            <p className="text-slate-400 text-xs">{sub.education_level} • {sub.years_experience} שנות ניסיון</p>
                          </div>
                          {sub.has_assignment_today && (
                            <span className="badge-blue hidden sm:flex">משובצת היום</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <a href={`tel:${sub.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-600">
                          <Phone size={13} />
                          {sub.phone}
                        </a>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 hidden lg:table-cell">{sub.neighborhood}</td>
                      <td className="px-4 py-4">
                        {permitOk ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={15} className={permitExpiring ? 'text-amber-500' : 'text-mint-500'} />
                            <span className={`text-xs font-medium ${permitExpiring ? 'text-amber-600' : 'text-mint-600'}`}>
                              {permitExpiring ? 'פג בקרוב' : 'תקף'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <XCircle size={15} className="text-red-500" />
                            <span className="text-xs font-medium text-red-600">לא תקף</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="text-sm">
                          <span className="font-semibold text-navy-900">{sub.assignments_this_month}</span>
                          <span className="text-slate-400 text-xs"> החודש</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={statusLabel[sub.status]?.cls || 'badge-gray'}>
                          {statusLabel[sub.status]?.label || sub.status}
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
                  );
                })}
                {filtered?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">לא נמצאו מחליפות</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
