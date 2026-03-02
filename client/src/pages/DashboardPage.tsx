import { useQuery } from '@tanstack/react-query';
import { 
  Users, CheckCircle, AlertTriangle, Clock, 
  TrendingUp, RefreshCw, FileText
} from 'lucide-react';
import api from '../../utils/api';
import { useAuthStore } from '../../context/authStore';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardStats {
  totalSubstitutes: number;
  todayCovered: number;
  todayTotal: number;
  openAbsences: number;
  expiringPermits: number;
  weekCoverage: { date: string; assignments: number; open_absences: number }[];
}

interface Alert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface NeighborhoodCoverage {
  neighborhood: string;
  coverage_pct: number;
  total_assignments: number;
  uncovered_absences: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const today = format(new Date(), 'EEEE, d בMMMM yyyy', { locale: he });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.get('/dashboard/alerts').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: neighborhoods } = useQuery<NeighborhoodCoverage[]>({
    queryKey: ['coverage-neighborhoods'],
    queryFn: () => api.get('/dashboard/coverage-by-neighborhood').then(r => r.data),
  });

  const coveragePct = stats 
    ? stats.todayTotal > 0 ? Math.round(stats.todayCovered / stats.todayTotal * 100) : 100
    : 0;

  const kpiCards = [
    {
      label: 'מחליפות פעילות',
      value: stats?.totalSubstitutes ?? '—',
      icon: <Users size={20} />,
      color: 'text-sky-500',
      bg: 'bg-sky-50',
    },
    {
      label: 'כיסוי היום',
      value: stats ? `${coveragePct}%` : '—',
      sub: stats ? `${stats.todayCovered}/${stats.todayTotal} שיבוצים` : '',
      icon: <CheckCircle size={20} />,
      color: coveragePct >= 80 ? 'text-mint-500' : 'text-amber-500',
      bg: coveragePct >= 80 ? 'bg-mint-100' : 'bg-amber-50',
    },
    {
      label: 'היעדרויות פתוחות',
      value: stats?.openAbsences ?? '—',
      icon: <AlertTriangle size={20} />,
      color: (stats?.openAbsences ?? 0) > 0 ? 'text-red-500' : 'text-slate-400',
      bg: (stats?.openAbsences ?? 0) > 0 ? 'bg-red-50' : 'bg-slate-50',
    },
    {
      label: 'תיקי עובד שפגים',
      sub: 'ב-30 יום הקרובים',
      value: stats?.expiringPermits ?? '—',
      icon: <Clock size={20} />,
      color: (stats?.expiringPermits ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400',
      bg: (stats?.expiringPermits ?? 0) > 0 ? 'bg-amber-50' : 'bg-slate-50',
    },
  ];

  if (statsLoading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 skeleton" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 skeleton" />
          <div className="h-64 skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">לוח בקרה</h1>
          <p className="text-slate-500 text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={15} />
            רענן
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <FileText size={15} />
            ייצוא CSV
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.filter(a => a.severity === 'high').map((alert, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm font-medium">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-xl ${kpi.bg}`}>
                <span className={kpi.color}>{kpi.icon}</span>
              </div>
            </div>
            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-slate-600 text-sm font-medium mt-0.5">{kpi.label}</div>
            {kpi.sub && <div className="text-slate-400 text-xs mt-0.5">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Week coverage chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-mint-500" />
            <h3 className="font-bold text-navy-900">כיסוי השבוע</h3>
          </div>
          {stats?.weekCoverage && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.weekCoverage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={d => format(new Date(d), 'EEE', { locale: he })}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(v, n) => [v, n === 'assignments' ? 'שיבוצים' : 'ללא כיסוי']}
                  labelFormatter={d => format(new Date(d), 'EEEE d/M', { locale: he })}
                />
                <Bar dataKey="assignments" fill="#17C98A" radius={[4,4,0,0]} name="שיבוצים" />
                <Bar dataKey="open_absences" fill="#EF4444" radius={[4,4,0,0]} name="ללא כיסוי" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Coverage by neighborhood */}
        <div className="card p-6">
          <h3 className="font-bold text-navy-900 mb-4">כיסוי לפי שכונה</h3>
          <div className="space-y-3">
            {neighborhoods?.map(n => (
              <div key={n.neighborhood}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-navy-700">{n.neighborhood}</span>
                  <span className={`font-bold ${
                    (n.coverage_pct || 0) >= 80 ? 'text-mint-500' : 
                    (n.coverage_pct || 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {n.coverage_pct || 0}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      (n.coverage_pct || 0) >= 80 ? 'bg-mint-500' : 
                      (n.coverage_pct || 0) >= 50 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(n.coverage_pct || 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!neighborhoods?.length && (
              <p className="text-slate-400 text-sm text-center py-4">אין נתונים</p>
            )}
          </div>
        </div>
      </div>

      {/* Medium alerts */}
      {alerts && alerts.filter(a => a.severity === 'medium' || a.severity === 'low').length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-3">התראות</h3>
          <div className="space-y-2">
            {alerts.filter(a => a.severity !== 'high').map((alert, i) => (
              <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${
                alert.severity === 'medium' ? 'bg-amber-50' : 'bg-slate-50'
              }`}>
                <AlertTriangle size={15} className={alert.severity === 'medium' ? 'text-amber-500 mt-0.5' : 'text-slate-400 mt-0.5'} />
                <p className="text-sm text-slate-700">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
