import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, FileText, Download, TrendingUp, Award,
} from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { format, getDaysInMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
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

// ─── Mock data ────────────────────────────────────────────────

const KG_NAMES = [
  'גן חבצלת', 'גן נרקיס', 'גן רקפת', 'גן כלנית', 'גן דליה',
  'גן שושנה', 'גן תמר', 'גן אורית', 'גן ענבל', 'גן שקמה',
  'גן אביבית', 'גן צבעוני',
];

const SUB_NAMES = [
  ['מרים', 'אברהם'], ['רחל', 'לוי'], ['שרה', 'כהן'],
  ['לאה', 'דוד'], ['נועה', 'פרידמן'],
];

const STATUSES = ['completed', 'completed', 'completed', 'arrived', 'confirmed', 'cancelled'];

function buildMockReportAssignments(month: number, year: number): Assignment[] {
  const result: Assignment[] = [];
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  let idx = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 6 || date.getDay() === 5) continue;
    const dateStr = format(date, 'yyyy-MM-dd');
    const count = 8 + (idx % 4);
    for (let a = 0; a < count; a++) {
      const status = STATUSES[(idx + a) % STATUSES.length];
      const hours = status === 'completed' || status === 'arrived' ? 6.5 : null;
      const sub = SUB_NAMES[(idx + a) % SUB_NAMES.length];
      result.push({
        id: `mock-rpt-${d}-${a}`,
        assignment_date: dateStr,
        status,
        hours_worked: hours,
        total_pay: hours ? hours * 55 : null,
        kindergarten_name: KG_NAMES[a % KG_NAMES.length],
        substitute_first_name: sub[0],
        substitute_last_name: sub[1],
      });
    }
    idx++;
  }
  return result;
}

const MOCK_NEIGHBORHOODS: NeighborhoodCoverage[] = [
  { neighborhood: 'מרכז',  coverage_pct: 94, total_assignments: 87,  uncovered_absences: 5,  kindergartens_count: 3 },
  { neighborhood: 'צפון',  coverage_pct: 88, total_assignments: 71,  uncovered_absences: 8,  kindergartens_count: 3 },
  { neighborhood: 'דרום',  coverage_pct: 82, total_assignments: 63,  uncovered_absences: 11, kindergartens_count: 2 },
  { neighborhood: 'מזרח',  coverage_pct: 79, total_assignments: 58,  uncovered_absences: 13, kindergartens_count: 2 },
  { neighborhood: 'מערב',  coverage_pct: 91, total_assignments: 76,  uncovered_absences: 6,  kindergartens_count: 2 },
];

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: assignmentsRaw } = useQuery<Assignment[]>({
    queryKey: ['report-assignments', month, year],
    queryFn: () => api.get('/assignments', { params: { month, year } }).then(r => r.data).catch(() => []),
  });

  const { data: neighborhoodsRaw } = useQuery<NeighborhoodCoverage[]>({
    queryKey: ['coverage-neighborhoods'],
    queryFn: () => api.get('/dashboard/coverage-by-neighborhood').then(r => r.data).catch(() => []),
  });

  const assignments = assignmentsRaw && assignmentsRaw.length > 0
    ? assignmentsRaw
    : buildMockReportAssignments(month, year);

  const neighborhoods = neighborhoodsRaw && neighborhoodsRaw.length > 0
    ? neighborhoodsRaw
    : MOCK_NEIGHBORHOODS;

  // Derived stats
  const totalAssignments = assignments.length;
  const completed = assignments.filter(a => a.status === 'completed');
  const cancelled = assignments.filter(a => a.status === 'cancelled');
  const totalHours = completed.reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);
  const totalPay = completed.reduce((sum, a) => sum + (Number(a.total_pay) || 0), 0);
  const completionRate = totalAssignments > 0
    ? Math.round((completed.length / totalAssignments) * 100)
    : 0;

  // Status distribution for pie
  const statusCounts = assignments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const byDate: Record<string, { total: number; completed: number }> = {};
    assignments.forEach(a => {
      if (!byDate[a.assignment_date]) byDate[a.assignment_date] = { total: 0, completed: 0 };
      byDate[a.assignment_date].total++;
      if (a.status === 'completed' || a.status === 'arrived') byDate[a.assignment_date].completed++;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        label: format(new Date(date + 'T00:00:00'), 'd/M'),
        total: v.total,
        completed: v.completed,
      }));
  }, [assignments]);

  // Substitute leaderboard
  const subLeaderboard = useMemo(() => {
    const byName: Record<string, { name: string; total: number; completed: number }> = {};
    assignments.forEach(a => {
      const name = `${a.substitute_first_name} ${a.substitute_last_name}`;
      if (!byName[name]) byName[name] = { name, total: 0, completed: 0 };
      byName[name].total++;
      if (a.status === 'completed' || a.status === 'arrived') byName[name].completed++;
    });
    return Object.values(byName)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);
  }, [assignments]);

  const handleExport = async () => {
    try {
      const response = await api.get(`/assignments/export/csv?month=${month}&year=${year}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `madganet_${year}_${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('קובץ מדגנט הורד בהצלחה');
    } catch {
      toast.error('שגיאה בייצוא הקובץ');
    }
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
          <div className="text-2xl font-black text-mint-500">{completionRate}%</div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">אחוז השלמה</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-black text-navy-900">{totalHours.toFixed(1)}</div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">שעות עבודה</div>
        </div>
        <div className="card p-5">
          <div className="text-2xl font-black text-violet-500">
            {totalPay > 0 ? `₪${Math.round(totalPay).toLocaleString()}` : '—'}
          </div>
          <div className="text-slate-600 text-sm font-medium mt-0.5">סה"כ לתשלום</div>
        </div>
      </div>

      {/* Daily trend + status pie */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily trend line chart */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-mint-500" />
            מגמה יומית
          </h3>
          {dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={Math.floor(dailyTrend.length / 6)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip formatter={(v, name) => [v, name === 'total' ? 'סה"כ' : 'הושלמו']} />
                <Legend formatter={n => n === 'total' ? 'סה"כ שיבוצים' : 'הושלמו'} />
                <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} name="total" />
                <Line type="monotone" dataKey="completed" stroke="#17C98A" strokeWidth={2} dot={false} name="completed" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-12">אין נתונים</p>
          )}
        </div>

        {/* Status pie */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-sky-500" />
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
      </div>

      {/* Substitute leaderboard + per-kindergarten bar */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <Award size={16} className="text-amber-500" />
            מחליפות מובילות
          </h3>
          <div className="space-y-3">
            {subLeaderboard.map((sub, i) => (
              <div key={sub.name} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-slate-100 text-slate-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-slate-50 text-slate-500'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy-900 truncate">{sub.name}</p>
                    <span className="text-xs text-slate-500 flex-shrink-0">{sub.completed}/{sub.total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-mint-500 rounded-full"
                      style={{ width: `${sub.total > 0 ? (sub.completed / sub.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-kindergarten bar */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-sky-500" />
            שיבוצים לפי גן
          </h3>
          {(() => {
            const perKg = assignments.reduce((acc, a) => {
              acc[a.kindergarten_name] = (acc[a.kindergarten_name] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const kgBarData = Object.entries(perKg).map(([name, count]) => ({ name, count })).slice(0, 10);
            return kgBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kgBarData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'שיבוצים']} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="שיבוצים" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-12">אין נתונים</p>
            );
          })()}
        </div>
      </div>

      {/* Neighborhood coverage table */}
      {neighborhoods.length > 0 && (
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
