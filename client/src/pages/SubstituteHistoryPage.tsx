import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, AlertCircle } from 'lucide-react';
import api from '@/utils/api';

interface Substitute {
  id: string;
  first_name: string;
  last_name: string;
}

interface Assignment {
  id: string;
  assignment_date: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  start_time: string | null;
  end_time: string | null;
  hours_worked: number | null;
  total_pay: number | null;
  notes: string | null;
  kindergarten_name: string;
  kindergarten_address: string | null;
}

interface PaginatedAssignments {
  data: Assignment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_META: Record<Assignment['status'], { label: string; cls: string }> = {
  completed: { label: 'הושלם', cls: 'bg-mint-100 text-mint-700' },
  confirmed: { label: 'אושר', cls: 'bg-blue-100 text-blue-700' },
  pending: { label: 'ממתין', cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'בוטל', cls: 'bg-slate-100 text-slate-500' },
  no_show: { label: 'לא הגיע', cls: 'bg-red-100 text-red-600' },
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'pending', label: 'ממתין' },
  { value: 'confirmed', label: 'אושר' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
  { value: 'no_show', label: 'לא הגיע' },
];

export default function SubstituteHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');

  const { data: sub, isLoading: subLoading } = useQuery<Substitute | null>({
    queryKey: ['substitute', id],
    queryFn: () => api.get(`/substitutes/${id}`).then(r => r.data).catch(() => null),
    enabled: Boolean(id),
  });

  const {
    data: result,
    isLoading: assignmentsLoading,
    isError,
  } = useQuery<PaginatedAssignments>({
    queryKey: ['substitute-assignments', id, page, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterStatus) params.set('status', filterStatus);
      return api.get(`/substitutes/${id}/assignments?${params}`).then(r => r.data).catch(() => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }));
    },
    enabled: Boolean(id),
  });

  const assignments = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const isLoading = subLoading || assignmentsLoading;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('he-IL');

  const formatCurrency = (amount: number | null) =>
    amount != null
      ? new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
      : '—';

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>שגיאה בטעינת ההיסטוריה. אנא נסה שנית.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/substitutes')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="חזרה למחליפות"
        >
          <ArrowRight size={18} className="text-slate-500 rtl:rotate-180" />
        </button>
        <div>
          {subLoading ? (
            <div className="h-7 w-40 skeleton rounded" />
          ) : (
            <h1 className="text-2xl font-black text-navy-900">
              {sub ? `${sub.first_name} ${sub.last_name}` : 'מחליפה'}
            </h1>
          )}
          <p className="text-slate-500 text-sm mt-0.5">היסטוריית שיבוצים</p>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="input py-2.5 text-sm w-full sm:w-auto"
        >
          {STATUS_FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-right text-xs font-semibold text-slate-500 px-4 sm:px-5 py-3.5">תאריך</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">גן ילדים</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden sm:table-cell">שעות</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden md:table-cell">תשלום</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">סטטוס</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden lg:table-cell">הערות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-8 skeleton rounded" />
                    </td>
                  </tr>
                ))
              ) : assignments.length > 0 ? (
                assignments.map(a => {
                  const meta = STATUS_META[a.status] ?? { label: a.status, cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 sm:px-5 py-4 text-sm font-medium text-navy-900 whitespace-nowrap">
                        {formatDate(a.assignment_date)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-navy-900">{a.kindergarten_name}</p>
                        {a.kindergarten_address && (
                          <p className="text-xs text-slate-400 mt-0.5">{a.kindergarten_address}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-sm text-slate-600">
                        {a.hours_worked != null ? `${a.hours_worked}` : (
                          a.start_time && a.end_time ? `${a.start_time}–${a.end_time}` : '—'
                        )}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell text-sm text-slate-600">
                        {formatCurrency(a.total_pay)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-sm text-slate-500 max-w-[200px]">
                        <span className="truncate block">{a.notes || '—'}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    לא נמצאו שיבוצים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">מציג {assignments.length} מתוך {total} שיבוצים</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              הקודם
            </button>
            <span className="text-sm text-slate-600 px-2">עמוד {page} מתוך {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              הבא
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
