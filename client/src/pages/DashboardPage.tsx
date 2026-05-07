import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, AlertTriangle, ChevronRight, ChevronLeft, Plus, X,
  Clock, User, LayoutGrid, List, CheckCircle, Sparkles,
  Users, Bell, TrendingUp, ShieldAlert,
} from 'lucide-react';
import api, { handleApiError } from '@/utils/api';
import toast from 'react-hot-toast';
import {
  format, parseISO, startOfWeek, addDays, addWeeks, subWeeks,
  addMonths, subMonths, isSameDay, isSameMonth, isToday,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { isHoliday } from '@/utils/holidays';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────

interface Kindergarten {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  age_group: string;
}

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  kindergarten_id: string;
  kindergarten_name: string;
  kindergarten_address: string;
  neighborhood: string;
  substitute_first_name: string;
  substitute_last_name: string;
  substitute_phone: string;
  notes: string | null;
}

interface AbsenceReport {
  id: string;
  kindergarten_id: string;
  kindergarten_name: string;
  kindergarten_address: string;
  absent_employee_name: string;
  absent_employee_role: string;
  absence_date: string;
  absence_reason: string | null;
  status: 'open' | 'assigned' | 'covered' | 'uncovered';
}

interface Recommendation {
  substituteId: string;
  userId: string;
  fullName: string;
  score: number;
  reasons: string[];
  features: Record<string, number>;
}

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
  data: Record<string, unknown>;
}

type ViewMode = 'week' | 'month' | 'list';

// ─── Mock data ────────────────────────────────────────────────

const MOCK_KINDERGARTENS: Kindergarten[] = [
  { id: 'kg-1',  name: 'גן חבצלת',  address: 'רחוב הרצל 15',        neighborhood: 'מרכז',  age_group: 'גן ילדים'  },
  { id: 'kg-2',  name: 'גן נרקיס',  address: 'רחוב ויצמן 8',         neighborhood: 'צפון',  age_group: 'גן ילדים'  },
  { id: 'kg-3',  name: 'גן רקפת',   address: 'שדרות בן גוריון 22',    neighborhood: 'דרום',  age_group: 'טרום חובה' },
  { id: 'kg-4',  name: 'גן כלנית',  address: 'רחוב סוקולוב 3',        neighborhood: 'מרכז',  age_group: 'גן ילדים'  },
  { id: 'kg-5',  name: 'גן דליה',   address: 'רחוב ז׳בוטינסקי 11',    neighborhood: 'מזרח',  age_group: 'טרום חובה' },
  { id: 'kg-6',  name: 'גן שושנה',  address: 'שדרות רוטשילד 5',       neighborhood: 'צפון',  age_group: 'גן ילדים'  },
  { id: 'kg-7',  name: 'גן תמר',    address: 'רחוב אחד העם 17',       neighborhood: 'מערב',  age_group: 'גן ילדים'  },
  { id: 'kg-8',  name: 'גן אורית',  address: 'רחוב ביאליק 9',         neighborhood: 'דרום',  age_group: 'גן ילדים'  },
  { id: 'kg-9',  name: 'גן ענבל',   address: 'רחוב העצמאות 33',       neighborhood: 'מזרח',  age_group: 'טרום חובה' },
  { id: 'kg-10', name: 'גן שקמה',   address: 'שדרות ירושלים 44',      neighborhood: 'מרכז',  age_group: 'גן ילדים'  },
  { id: 'kg-11', name: 'גן אביבית', address: 'רחוב פינסקר 6',         neighborhood: 'מערב',  age_group: 'טרום חובה' },
  { id: 'kg-12', name: 'גן צבעוני', address: 'רחוב האגוז 2',          neighborhood: 'צפון',  age_group: 'גן ילדים'  },
];

const MOCK_SUBS = [
  { id: 'sub-1', first_name: 'מרים',  last_name: 'אברהם',  phone: '054-1234567' },
  { id: 'sub-2', first_name: 'רחל',   last_name: 'לוי',    phone: '052-9876543' },
  { id: 'sub-3', first_name: 'שרה',   last_name: 'כהן',    phone: '050-5551234' },
  { id: 'sub-4', first_name: 'לאה',   last_name: 'דוד',    phone: '053-7778899' },
  { id: 'sub-5', first_name: 'נועה',  last_name: 'פרידמן', phone: '054-6661234' },
  { id: 'sub-6', first_name: 'דנה',   last_name: 'שמעוני', phone: '052-3334455' },
  { id: 'sub-7', first_name: 'יעל',   last_name: 'ברק',    phone: '050-9990011' },
  { id: 'sub-8', first_name: 'תמר',   last_name: 'מזרחי',  phone: '053-1112233' },
];

const MOCK_ABSENT_EMPLOYEES = [
  'דנה שמעוני', 'יעל פרידמן', 'נועה ברק', 'רינה גולן',
  'אורנה לוי', 'מיכל כץ', 'תמר עמית', 'שרית דור',
];

function buildMockAbsences(): AbsenceReport[] {
  const today = new Date();
  const result: AbsenceReport[] = [];
  for (let offset = -5; offset <= 20; offset++) {
    const date = addDays(today, offset);
    if (date.getDay() === 6) continue;
    const dateStr = format(date, 'yyyy-MM-dd');
    const seed = Math.abs(offset * 7 + 3);
    const count = 1 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const kg = MOCK_KINDERGARTENS[(seed + i * 3) % MOCK_KINDERGARTENS.length];
      const isOpen = (offset >= 0) && (i === 0) && (seed % 3 !== 0);
      result.push({
        id: `mock-abs-${dateStr}-${i}`,
        kindergarten_id: kg.id,
        kindergarten_name: kg.name,
        kindergarten_address: kg.address,
        absent_employee_name: MOCK_ABSENT_EMPLOYEES[(seed + i) % MOCK_ABSENT_EMPLOYEES.length],
        absent_employee_role: 'גננת',
        absence_date: dateStr,
        absence_reason: ['מחלה', 'חופשה', 'אישי'][i % 3],
        status: isOpen ? 'open' : 'assigned',
      });
    }
  }
  return result;
}

function buildMockAssignmentsFull(): Assignment[] {
  const today = new Date();
  const result: Assignment[] = [];
  for (let offset = -5; offset <= 20; offset++) {
    const date = addDays(today, offset);
    if (date.getDay() === 6) continue;
    const dateStr = format(date, 'yyyy-MM-dd');
    const seed = Math.abs(offset * 7 + 3);
    const count = 1 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const kg = MOCK_KINDERGARTENS[(seed + i * 3) % MOCK_KINDERGARTENS.length];
      const isOpen = (offset >= 0) && (i === 0) && (seed % 3 !== 0);
      if (isOpen) continue;
      const sub = MOCK_SUBS[(seed + i) % MOCK_SUBS.length];
      result.push({
        id: `mock-asgn-${dateStr}-${i}`,
        assignment_date: dateStr,
        start_time: '07:30',
        end_time: '14:00',
        status: offset < 0 ? 'completed' : 'confirmed',
        kindergarten_id: kg.id,
        kindergarten_name: kg.name,
        kindergarten_address: kg.address,
        neighborhood: kg.neighborhood,
        substitute_first_name: sub.first_name,
        substitute_last_name: sub.last_name,
        substitute_phone: sub.phone,
        notes: null,
      });
    }
  }
  return result;
}

function buildMockWeekCoverage() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const isSat = d.getDay() === 6;
    return {
      date: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE', { locale: he }),
      assignments: isSat ? 0 : 8 + (i * 2) % 5,
      open_absences: isSat ? 0 : (i % 3 === 1 ? 2 : i % 4 === 3 ? 3 : 0),
    };
  }).filter(d => new Date(d.date).getDay() !== 6);
}

const MOCK_ABSENCES = buildMockAbsences();
const MOCK_ASSIGNMENTS_FULL = buildMockAssignmentsFull();
const MOCK_WEEK_COVERAGE = buildMockWeekCoverage();

const MOCK_STATS: DashboardStats = {
  totalSubstitutes: 24,
  todayCovered: 8,
  todayTotal: 10,
  openAbsences: 2,
  expiringPermits: 3,
  weekCoverage: MOCK_WEEK_COVERAGE,
};

const MOCK_ALERTS: Alert[] = [
  { type: 'uncovered_absence', severity: 'high', message: 'גן חבצלת: דנה שמעוני נעדרת ואין מחליפה', data: {} },
  { type: 'permit_expiring', severity: 'medium', message: 'תיק עובד של מרים אברהם פג תוקפו בעוד 5 ימים', data: {} },
  { type: 'unplanned_known_absence', severity: 'low', message: 'חופש מתוכנן בגן נרקיס ב-15/05 — אין שיבוץ עדיין', data: {} },
];

// ─── Status config ────────────────────────────────────────────

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: 'ממתין', cls: 'badge-amber' },
  confirmed: { label: 'אושר', cls: 'badge-blue' },
  arrived: { label: 'הגיעה', cls: 'badge-green' },
  completed: { label: 'הושלם', cls: 'badge-green' },
  cancelled: { label: 'בוטל', cls: 'badge-red' },
};

const alertColors: Record<string, string> = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-blue-50 border-blue-200 text-blue-700',
};

// ─── Main Component ───────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const today = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [assignModal, setAssignModal] = useState<{ kindergartenId: string; date: string } | null>(null);

  // ─── Queries ──────────────────────────────────────────────
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data).catch(() => null),
    refetchInterval: 60_000,
  });

  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.get('/dashboard/alerts').then(r => r.data).catch(() => null),
    refetchInterval: 120_000,
  });

  const { data: kindergartens } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data),
  });

  const visibleMonth = currentDate.getMonth() + 1;
  const visibleYear = currentDate.getFullYear();

  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ['assignments', visibleYear, visibleMonth],
    queryFn: () => api.get('/assignments', { params: { month: visibleMonth, year: visibleYear } }).then(r => r.data),
  });

  const prev = subMonths(currentDate, 1);
  const next = addMonths(currentDate, 1);

  const { data: prevMonthAssignments } = useQuery<Assignment[]>({
    queryKey: ['assignments', prev.getFullYear(), prev.getMonth() + 1],
    queryFn: () => api.get('/assignments', { params: { month: prev.getMonth() + 1, year: prev.getFullYear() } }).then(r => r.data),
  });
  const { data: nextMonthAssignments } = useQuery<Assignment[]>({
    queryKey: ['assignments', next.getFullYear(), next.getMonth() + 1],
    queryFn: () => api.get('/assignments', { params: { month: next.getMonth() + 1, year: next.getFullYear() } }).then(r => r.data),
  });
  const { data: absences } = useQuery<AbsenceReport[]>({
    queryKey: ['absences', visibleYear, visibleMonth],
    queryFn: () => api.get('/absences', { params: { month: visibleMonth, year: visibleYear } }).then(r => r.data),
  });
  const { data: prevMonthAbsences } = useQuery<AbsenceReport[]>({
    queryKey: ['absences', prev.getFullYear(), prev.getMonth() + 1],
    queryFn: () => api.get('/absences', { params: { month: prev.getMonth() + 1, year: prev.getFullYear() } }).then(r => r.data),
  });
  const { data: nextMonthAbsences } = useQuery<AbsenceReport[]>({
    queryKey: ['absences', next.getFullYear(), next.getMonth() + 1],
    queryFn: () => api.get('/absences', { params: { month: next.getMonth() + 1, year: next.getFullYear() } }).then(r => r.data),
  });

  const kgs = useMemo(
    () => kindergartens && kindergartens.length > 0 ? kindergartens : MOCK_KINDERGARTENS,
    [kindergartens],
  );
  const allAssignments = useMemo(() => {
    const fromApi = [...(prevMonthAssignments ?? []), ...(assignments ?? []), ...(nextMonthAssignments ?? [])];
    return fromApi.length > 0 ? fromApi : MOCK_ASSIGNMENTS_FULL;
  }, [prevMonthAssignments, assignments, nextMonthAssignments]);
  const allAbsences = useMemo(() => {
    const fromApi = [...(prevMonthAbsences ?? []), ...(absences ?? []), ...(nextMonthAbsences ?? [])];
    return fromApi.length > 0 ? fromApi : MOCK_ABSENCES;
  }, [prevMonthAbsences, absences, nextMonthAbsences]);

  const liveStats = stats ?? MOCK_STATS;
  const liveAlerts = alerts ?? MOCK_ALERTS;

  const weekCoverageData = useMemo(() => {
    const raw = liveStats.weekCoverage ?? MOCK_WEEK_COVERAGE;
    return raw.map(r => ({
      ...r,
      label: format(parseISO(r.date), 'EEE', { locale: he }),
    }));
  }, [liveStats]);

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const holiday = isHoliday(selectedDayStr);
  const isSaturday = selectedDay.getDay() === 6;

  const dayAssignments = useMemo(
    () => allAssignments.filter(a => a.assignment_date === selectedDayStr && a.status !== 'cancelled'),
    [allAssignments, selectedDayStr],
  );

  const dayAbsences = useMemo(
    () => allAbsences.filter(a => a.absence_date === selectedDayStr),
    [allAbsences, selectedDayStr],
  );
  const holes = useMemo(() => dayAbsences.filter(a => a.status === 'open'), [dayAbsences]);

  const totalKgs = kgs.length;
  const totalAbsences = dayAbsences.length;
  const coveredCount = totalAbsences - holes.length;
  const coveragePct = totalAbsences > 0
    ? Math.round((coveredCount / totalAbsences) * 100)
    : 100;

  // ─── Navigation ───────────────────────────────────────────
  const navigateBack = () => {
    setCurrentDate(p => viewMode === 'week' ? subWeeks(p, 1) : subMonths(p, 1));
  };
  const navigateForward = () => {
    setCurrentDate(p => viewMode === 'week' ? addWeeks(p, 1) : addMonths(p, 1));
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter(d => d.getDay() !== 6);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const allMonthDates = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)
  ).filter(d => d.getDay() !== 6);
  const firstDayCol = allMonthDates.length > 0 ? allMonthDates[0].getDay() : 0;
  const monthDays: (Date | null)[] = [
    ...Array.from({ length: firstDayCol }, () => null),
    ...allMonthDates,
  ];

  const getDateInfo = (dateStr: string) => {
    const hol = isHoliday(dateStr);
    if (hol) return { status: 'holiday' as const, label: hol.name };
    const dayHoles = allAbsences.filter(a => a.absence_date === dateStr && a.status === 'open').length;
    if (dayHoles === 0) return { status: 'full' as const, label: '' };
    return { status: 'holes' as const, label: `${dayHoles}` };
  };

  // ─── Assign mutation ──────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: (vars: { kindergartenId: string; substituteId: string; date: string }) =>
      api.post('/assignments', {
        kindergartenId: vars.kindergartenId,
        substituteId: vars.substituteId,
        assignmentDate: vars.date,
      }).then(r => r.data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      const kg = kgs.find(k => k.id === vars.kindergartenId);
      toast.success(`השיבוץ נוצר ל${kg?.name ?? 'גן'}`);
      setAssignModal(null);
    },
    onError: (err) => handleApiError(err, 'POST /api/assignments'),
  });

  const handleAssign = (kindergartenId: string, substituteId: string, date: string) => {
    assignMutation.mutate({ kindergartenId, substituteId, date });
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-5 fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">לוח בקרה</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(today, 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
            coveragePct >= 80 ? 'bg-mint-100 text-mint-700' :
            coveragePct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
          }`}>
            {coveragePct}% כיסוי היום
          </div>
          {liveAlerts.filter(a => a.severity === 'high').length > 0 && (
            <div className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-700 flex items-center gap-1.5">
              <Bell size={14} />
              {liveAlerts.filter(a => a.severity === 'high').length} התראות
            </div>
          )}
        </div>
      </div>

      {/* ─── KPI Bar ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">מחליפות פעילות</p>
            <Users size={16} className="text-sky-400" />
          </div>
          <p className="text-2xl font-black text-navy-900">{liveStats.totalSubstitutes}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">כיסוי היום</p>
            <CheckCircle size={16} className="text-mint-400" />
          </div>
          <p className={`text-2xl font-black ${liveStats.todayTotal > 0 && liveStats.todayCovered < liveStats.todayTotal ? 'text-amber-500' : 'text-mint-500'}`}>
            {liveStats.todayCovered}/{liveStats.todayTotal}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">חורים פתוחים</p>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className={`text-2xl font-black ${liveStats.openAbsences > 0 ? 'text-red-500' : 'text-mint-500'}`}>
            {liveStats.openAbsences}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">תיקי עובד פגים</p>
            <ShieldAlert size={16} className="text-amber-400" />
          </div>
          <p className={`text-2xl font-black ${liveStats.expiringPermits > 0 ? 'text-amber-500' : 'text-navy-900'}`}>
            {liveStats.expiringPermits}
          </p>
        </div>
      </div>

      {/* ─── Week Coverage Chart ─── */}
      {weekCoverageData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-mint-500" />
            כיסוי השבוע
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={weekCoverageData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="assignGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#17C98A" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#17C98A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="holeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip
                formatter={(v, name) => [v, name === 'assignments' ? 'שיבוצים' : 'חורים']}
                labelFormatter={l => `יום ${l}`}
              />
              <Area type="monotone" dataKey="assignments" stroke="#17C98A" strokeWidth={2} fill="url(#assignGrad)" name="assignments" />
              <Area type="monotone" dataKey="open_absences" stroke="#EF4444" strokeWidth={2} fill="url(#holeGrad)" name="open_absences" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-3 h-0.5 bg-mint-500 rounded" />
              שיבוצים
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-3 h-0.5 bg-red-400 rounded" />
              חורים פתוחים
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ═══ LEFT: Calendar ═══ */}
        <div className="flex-1 space-y-5">
          <div className="card p-4">
            {/* View mode toggle + nav */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy-900">לוח זמנים</h3>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
                {([
                  { mode: 'week' as ViewMode, label: 'שבועי', icon: LayoutGrid },
                  { mode: 'month' as ViewMode, label: 'חודשי', icon: Calendar },
                  { mode: 'list' as ViewMode, label: 'רשימה', icon: List },
                ] as const).map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      viewMode === mode ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            {viewMode !== 'list' && (
              <div className="flex items-center justify-between mb-3">
                <button onClick={navigateBack} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <ChevronRight size={18} />
                </button>
                <span className="font-semibold text-sm text-navy-900">
                  {viewMode === 'week'
                    ? `${format(weekDays[0], 'd/M')} — ${format(weekDays[weekDays.length - 1], 'd/M')}`
                    : format(currentDate, 'MMMM yyyy', { locale: he })
                  }
                </span>
                <button onClick={navigateForward} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <ChevronLeft size={18} />
                </button>
              </div>
            )}

            {/* ─── WEEK VIEW ─── */}
            {viewMode === 'week' && (
              <div className="grid grid-cols-6 gap-1.5">
                {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-slate-400 pb-1">{d}</div>
                ))}
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const info = getDateInfo(dateStr);
                  const isSelected = isSameDay(day, selectedDay);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(day)}
                      className={`relative rounded-xl p-2 text-center transition-all min-h-[80px] flex flex-col items-center justify-start gap-1 border-2 ${
                        isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                      } ${isTodayDate ? 'ring-2 ring-mint-400 ring-offset-1' : ''} ${
                        info.status === 'holiday'
                          ? 'bg-purple-50 border-purple-200 text-purple-600'
                          : info.status === 'holes'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-mint-50 border-mint-200'
                      }`}
                    >
                      <span className={`text-sm font-bold ${isTodayDate ? 'text-mint-500' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {info.status === 'holiday' && (
                        <span className="text-[9px] leading-tight font-medium text-purple-500">{info.label}</span>
                      )}
                      {info.status === 'holes' && (
                        <span className="text-[10px] font-bold text-red-500">{info.label} חורים</span>
                      )}
                      {info.status === 'full' && (
                        <CheckCircle size={14} className="text-mint-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ─── MONTH VIEW ─── */}
            {viewMode === 'month' && (
              <div className="grid grid-cols-6 gap-1">
                {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-slate-400 pb-1">{d}</div>
                ))}
                {monthDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const info = getDateInfo(dateStr);
                  const isSelected = isSameDay(day, selectedDay);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(day)}
                      className={`rounded-lg p-1.5 text-center text-xs transition-all ${
                        isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                      } ${isTodayDate ? 'ring-2 ring-mint-400 ring-offset-1' : ''} ${
                        info.status === 'holiday'
                          ? 'bg-purple-50 text-purple-600'
                          : info.status === 'holes'
                          ? 'bg-red-50 text-red-500 font-bold'
                          : 'bg-mint-50 text-mint-700'
                      }`}
                    >
                      {format(day, 'd')}
                      {info.status === 'holes' && <div className="w-1.5 h-1.5 bg-red-400 rounded-full mx-auto mt-0.5" />}
                      {info.status === 'full' && <div className="w-1.5 h-1.5 bg-mint-500 rounded-full mx-auto mt-0.5" />}
                      {info.status === 'holiday' && <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mx-auto mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ─── LIST VIEW ─── */}
            {viewMode === 'list' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setCurrentDate(p => subMonths(p, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <ChevronRight size={18} />
                  </button>
                  <span className="font-semibold text-sm text-navy-900">
                    {format(currentDate, 'MMMM yyyy', { locale: he })}
                  </span>
                  <button onClick={() => setCurrentDate(p => addMonths(p, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <ChevronLeft size={18} />
                  </button>
                </div>

                {allMonthDates
                  .filter(day => isSameMonth(day, currentDate))
                  .map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const hol = isHoliday(dateStr);
                    const dayAbs = allAbsences.filter(a => a.absence_date === dateStr);
                    const dayHoles = dayAbs.filter(a => a.status === 'open').length;
                    const dayCovered = dayAbs.length - dayHoles;
                    const isTodayDate = isToday(day);

                    return (
                      <button
                        key={dateStr}
                        onClick={() => { setSelectedDay(day); setCurrentDate(day); setViewMode('week'); }}
                        className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all text-right ${
                          hol ? 'bg-purple-50 border border-purple-200' :
                          dayHoles > 0 ? 'bg-red-50 border border-red-200' :
                          isTodayDate ? 'bg-mint-50 border border-mint-200' : 'bg-slate-50'
                        }`}
                      >
                        <div className={`text-center rounded-lg px-2.5 py-1.5 min-w-[48px] ${
                          hol ? 'bg-purple-600' : dayHoles > 0 ? 'bg-red-500' : 'bg-navy-900'
                        }`}>
                          <p className="text-xs font-bold text-white opacity-80">
                            {format(day, 'EEE', { locale: he })}
                          </p>
                          <p className="text-sm font-bold text-white">{format(day, 'd/M')}</p>
                        </div>

                        <div className="flex-1 min-w-0">
                          {hol ? (
                            <p className="text-sm font-semibold text-purple-700">{hol.name}</p>
                          ) : dayAbs.length === 0 ? (
                            <p className="text-sm text-slate-500">אין היעדרויות</p>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-navy-900">
                                {dayCovered}/{dayAbs.length} היעדרויות מכוסות
                              </p>
                              {dayHoles > 0 && (
                                <p className="text-xs text-red-500">{dayHoles} חורים לאיוש</p>
                              )}
                            </>
                          )}
                        </div>

                        {!hol && dayHoles === 0 && <CheckCircle size={18} className="text-mint-500" />}
                        {!hol && dayHoles > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-600">
                            {dayHoles}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full bg-mint-400" />
                מכוסה
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                חורים
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full bg-purple-400" />
                חג
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Day detail + Alerts ═══ */}
        <div className="lg:w-96 space-y-5">
          {/* Selected day card */}
          <div className="card p-5">
            <h3 className="font-bold text-navy-900 mb-1">
              {isSameDay(selectedDay, today) ? 'היום' : format(selectedDay, 'EEEE d/M', { locale: he })}
            </h3>
            {holiday ? (
              <div className="bg-purple-50 rounded-xl p-4 text-center mt-3">
                <span className="text-2xl mb-2 block">🏖️</span>
                <p className="font-bold text-purple-700">{holiday.name}</p>
                <p className="text-purple-500 text-xs mt-1">אין שיבוצים ביום חג</p>
              </div>
            ) : isSaturday ? (
              <div className="bg-slate-50 rounded-xl p-4 text-center mt-3">
                <span className="text-2xl mb-2 block">🕊️</span>
                <p className="font-semibold text-slate-500">שבת</p>
                <p className="text-slate-400 text-xs mt-1">אין שיבוצים בשבת</p>
              </div>
            ) : (
              <>
                <p className="text-slate-500 text-sm">
                  {totalAbsences === 0
                    ? 'אין היעדרויות מדווחות היום'
                    : <>{coveredCount}/{totalAbsences} היעדרויות מכוסות
                        {holes.length > 0 && <span className="text-red-500 font-semibold"> • {holes.length} חורים</span>}
                      </>}
                </p>

                {holes.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      היעדרויות ללא מחליפה
                    </h4>
                    <div className="space-y-2">
                      {holes.map(absence => (
                        <div
                          key={absence.id}
                          className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-50 border border-red-200"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy-900">{absence.kindergarten_name}</p>
                            <p className="text-xs text-slate-500">
                              {absence.absent_employee_name}
                              {absence.kindergarten_address && ` • ${absence.kindergarten_address}`}
                            </p>
                          </div>
                          <button
                            onClick={() => setAssignModal({ kindergartenId: absence.kindergarten_id, date: selectedDayStr })}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 flex-shrink-0"
                          >
                            <Plus size={12} />
                            שבצי
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dayAssignments.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-bold text-navy-900 mb-2">שיבוצים פעילים</h4>
                    <div className="space-y-2">
                      {dayAssignments.map(a => (
                        <div key={a.id} className="py-2.5 px-3 rounded-xl bg-mint-50 border border-mint-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-navy-900">{a.kindergarten_name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusConfig[a.status]?.cls || 'badge-gray'}`}>
                              {statusConfig[a.status]?.label || a.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <User size={11} />
                              {a.substitute_first_name} {a.substitute_last_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {a.start_time?.slice(0, 5)}—{a.end_time?.slice(0, 5)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {holes.length === 0 && totalAbsences > 0 && (
                  <div className="bg-mint-50 rounded-xl p-3 text-center mt-4">
                    <CheckCircle size={20} className="text-mint-500 mx-auto mb-1" />
                    <p className="text-mint-700 text-sm font-semibold">כל ההיעדרויות מכוסות!</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center">
              <p className="text-2xl font-black text-navy-900">{totalKgs}</p>
              <p className="text-xs text-slate-500 mt-0.5">גנים בניהולך</p>
            </div>
            <div className="card p-4 text-center">
              <p className={`text-2xl font-black ${coveragePct >= 80 ? 'text-mint-500' : 'text-red-500'}`}>
                {coveragePct}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">כיסוי היום</p>
            </div>
          </div>

          {/* Alerts panel */}
          {liveAlerts.length > 0 && (
            <div className="card p-4">
              <h4 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
                <Bell size={15} className="text-amber-500" />
                התראות ({liveAlerts.length})
              </h4>
              <div className="space-y-2">
                {liveAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`text-xs rounded-xl px-3 py-2.5 border font-medium ${alertColors[alert.severity]}`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <AssignModal
          kindergartenId={assignModal.kindergartenId}
          kindergartenName={kgs.find(k => k.id === assignModal.kindergartenId)?.name || ''}
          date={assignModal.date}
          onClose={() => setAssignModal(null)}
          onAssign={(subId) => handleAssign(assignModal.kindergartenId, subId, assignModal.date)}
          submitting={assignMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────

function AssignModal({
  kindergartenId,
  kindergartenName,
  date,
  onClose,
  onAssign,
  submitting,
}: {
  kindergartenId: string;
  kindergartenName: string;
  date: string;
  onClose: () => void;
  onAssign: (subId: string) => void;
  submitting: boolean;
}) {
  const [selectedSub, setSelectedSub] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading } = useQuery<{
    count: number;
    recommendations: Recommendation[];
  }>({
    queryKey: ['ml-recommend', kindergartenId, date],
    queryFn: () =>
      api.get('/ml/recommend', { params: { kindergartenId, date, topK: 20 } })
        .then(r => r.data)
        .catch(() => null),
  });

  const mockRecs: Recommendation[] = MOCK_SUBS.map((s, i) => ({
    substituteId: s.id,
    userId: s.id,
    fullName: `${s.first_name} ${s.last_name}`,
    score: Math.max(0.5, 0.97 - i * 0.07),
    reasons: [['ניסיון רב', 'שכונה קרובה', 'זמינה', 'מועדפת', 'ביצועים גבוהים'][i % 5]],
    features: {},
  }));

  const recs = (data?.recommendations && data.recommendations.length > 0)
    ? data.recommendations
    : mockRecs;
  const selectedRec = recs.find(r => r.substituteId === selectedSub);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {!showConfirm ? (
        <div className="card p-6 w-full max-w-lg slide-in max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900 text-lg">שיבוץ מחליפה</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div className="bg-navy-900 rounded-xl p-4 mb-4 text-white">
            <p className="text-mint-400 text-xs font-medium">גן ילדים</p>
            <p className="font-bold text-lg">{kindergartenName}</p>
            <p className="text-navy-300 text-sm mt-1">
              {format(parseISO(date), 'EEEE, d בMMMM yyyy', { locale: he })}
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-navy-900 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-mint-500" />
              המלצות חכמות ({recs.length})
            </label>
            {isLoading ? (
              <div className="text-center py-6 text-sm text-slate-500">טוען...</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {recs.map((r, idx) => {
                  const initials = r.fullName.split(' ').map(s => s[0]).slice(0, 2).join('');
                  return (
                    <label
                      key={r.substituteId}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                        selectedSub === r.substituteId
                          ? 'bg-mint-50 border-mint-300'
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="substitute"
                        value={r.substituteId}
                        checked={selectedSub === r.substituteId}
                        onChange={() => setSelectedSub(r.substituteId)}
                        className="accent-mint-500 mt-1"
                      />
                      <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-xs font-bold text-mint-400 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-navy-900 truncate">{r.fullName}</p>
                          <span className="text-[10px] font-bold bg-mint-100 text-mint-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                            {idx === 0 && '⭐ '}
                            {Math.round(r.score * 100)}%
                          </span>
                        </div>
                        {r.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {r.reasons.map(reason => (
                              <span key={reason} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => selectedSub && setShowConfirm(true)}
              disabled={!selectedSub || submitting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              שבצי מחליפה
            </button>
            <button onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </div>
      ) : (
        <div className="card p-6 w-full max-w-sm slide-in text-center">
          <div className="w-14 h-14 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-mint-500" />
          </div>
          <h3 className="font-bold text-navy-900 text-lg mb-2">אישור שיבוץ</h3>
          <p className="text-slate-600 text-sm mb-1">
            לשבץ את <span className="font-bold text-navy-900">{selectedRec?.fullName}</span>
          </p>
          <p className="text-slate-600 text-sm mb-1">
            ל<span className="font-bold text-navy-900">{kindergartenName}</span>
          </p>
          <p className="text-slate-500 text-xs mb-5">
            {format(parseISO(date), 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
          <div className="flex gap-2">
            <button onClick={() => onAssign(selectedSub)} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? 'שולח...' : 'אישור'}
            </button>
            <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">
              חזרה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
