import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, FileText, Download, TrendingUp
} from 'lucide-react';
import api from '@/utils/api';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface Assignment {
  id: string;
  assignment_date: string;
  status: string;
  hours_worked: number | null;
  total_pay: number | null;
  kindergarten_name: string;
  substitute_first_name: string;
  substitute_last_name: string;
}

interface NeighborhoodCoverage {
  neighborhood: string;
  coverage_pct: number;
  total_assignments: number;
  uncovered_absences: number;
  kindergartens_count: number;
}

const COLORS = ['#17C98A', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ['report-assignments', month, year],
    queryFn: () => api.get('/assignments', { params: { month, year } }).then(r => r.data),
  });

  const { data: neighborhoods } = useQuery<NeighborhoodCoverage[]>({
    queryKey: ['coverage-neighborhoods'],
    queryFn: () => api.get('/dashboard/coverage-by-neighborhood').then(r => r.data),
  });

  // Compute stats
  const totalAssignments = assignments?.length ?? 0;
  const completed = assignments?.filter(a => a.status === 'completed') ?? [];
  const cancelled = assignments?.filter(a => a.status === 'cancelled') ?? [];
  const totalHours = completed.reduce((sum, a) => sum + (a.hours_worked ?? 0), 0);
  const totalPay = completed.reduce((sum, a) => sum + (a.total_pay ?? 0), 0);

  // Status distribution for pie chart
  const statusCounts = assignments?.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const statusLabels: Record<string, string> = {
    pending: 'ממתין',
    confirmed: 'אושר',
    arrived: 'הגיעה',
    completed: 'הושלם',
    cancelled: 'בוטל',
    no_show: 'לא הגיעה',
  };

  const pieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
  }));

  // Assignments per kindergarten for bar chart
  const perKg = assignments?.reduce((acc, a) => {
    acc[a.kindergarten_name] = (acc[a.kindergarten_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};
  const kgBarData = Object.entries(perKg).map(([name, count]) => ({ name, count }));

  const handleExport = () => {
    window.open(`/api/assignments/export/csv?month=${month}&year=${year}`, '_blank');
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">דוחות</h1>
          <p className="text-slate-500 text-sm mt-0.5">ניתוח שיבוצים והיעדרויות</p>
        </div>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2 text-sm">
          <Download size={16} />
          ייצוא למדגנט
        </button>
      </div>

      {/* Month filter */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <BarChart3 size={16} className="text-slate-400" />
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input py-2.5 text-sm w-auto">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {format(new Date(2024, i, 1), 'MMMM', { locale: he })}
            </option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input py-2.5 text-sm w-auto">
          {[2024, 2025, 2026].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-2xl font-black text-sky-500">{totalAssignments}</div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">סה"כ שיבוצים</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-black text-mint-500">{completed.length}</div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">הושלמו</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-black text-navy-900">{totalHours.toFixed(1)}</div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">שעות עבודה</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-black text-violet-500">{totalPay > 0 ? `₪${totalPay.toLocaleString()}` : '—'}</div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">סה"כ לתשלום</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Status pie chart */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-mint-500" />
            התפלגות סטטוסים
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-12">אין נתונים</p>
          )}
        </div>

        {/* Assignments per kindergarten */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-sky-500" />
            שיבוצים לפי גן
          </h3>
          {kgBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kgBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(v) => [v, 'שיבוצים']} />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="שיבוצים" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-12">אין נתונים</p>
          )}
        </div>
      </div>

      {/* Neighborhood coverage table */}
      {neighborhoods && neighborhoods.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-navy-900">כיסוי לפי שכונה</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">שכונה</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">גנים</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">שיבוצים</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">ללא כיסוי</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">אחוז כיסוי</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {neighborhoods.map(n => (
                  <tr key={n.neighborhood} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-sm font-semibold text-navy-900">{n.neighborhood}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{n.kindergartens_count}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{n.total_assignments}</td>
                    <td className="px-4 py-3.5 text-sm text-red-500 font-medium">{n.uncovered_absences}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-20">
                          <div
                            className={`h-full rounded-full ${
                              (n.coverage_pct || 0) >= 80 ? 'bg-mint-500' :
                              (n.coverage_pct || 0) >= 50 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(n.coverage_pct || 0, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${
                          (n.coverage_pct || 0) >= 80 ? 'text-mint-500' :
                          (n.coverage_pct || 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          {n.coverage_pct || 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
