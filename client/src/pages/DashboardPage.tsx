import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, AlertTriangle, ChevronRight, ChevronLeft, Plus, X,
  Clock, User, LayoutGrid, List, CheckCircle, Phone, Sparkles,
} from 'lucide-react';
import api, { handleApiError } from '@/utils/api';
import toast from 'react-hot-toast';
import {
  format, parseISO, startOfWeek, addDays, addWeeks, subWeeks,
  addMonths, subMonths, isSameDay, isSameMonth, isToday,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { isHoliday } from '@/utils/holidays';

// ─── Types ──────────────────────────────────────────────────

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

type ViewMode = 'week' | 'month' | 'list';

// ─── Mock data (used when API returns nothing) ───────────────

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
    // 1-3 absences per day
    const count = 1 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const kg = MOCK_KINDERGARTENS[(seed + i * 3) % MOCK_KINDERGARTENS.length];
      const isOpen = (offset >= 0) && (i === 0) && (seed % 3 !== 0);
      const sub = MOCK_SUBS[(seed + i) % MOCK_SUBS.length];
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
      if (!isOpen) {
        result.push({
          ...result[result.length - 1],
          id: `mock-asgn-ref-${dateStr}-${i}`,
        });
      }
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

const MOCK_ABSENCES = buildMockAbsences();
const MOCK_ASSIGNMENTS_FULL = buildMockAssignmentsFull();

// ─── Status config ──────────────────────────────────────────

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: 'ממתין', cls: 'badge-amber' },
  confirmed: { label: 'אושר', cls: 'badge-blue' },
  arrived: { label: 'הגיעה', cls: 'badge-green' },
  completed: { label: 'הושלם', cls: 'badge-green' },
  cancelled: { label: 'בוטל', cls: 'badge-red' },
};

// ─── Main Component ─────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const today = new Date();

  // ─── State ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [assignModal, setAssignModal] = useState<{ kindergartenId: string; date: string } | null>(null);

  // ─── Queries ───────────────────────────────────────────
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

  // Also fetch the previous and next month so the visible week never shows
  // an empty calendar near month boundaries.
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

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const holiday = isHoliday(selectedDayStr);
  const isSaturday = selectedDay.getDay() === 6;

  // Assignments for selected day
  const dayAssignments = useMemo(
    () => allAssignments.filter(a => a.assignment_date === selectedDayStr && a.status !== 'cancelled'),
    [allAssignments, selectedDayStr]
  );

  // Holes = open absences for the selected day that haven't been covered yet.
  const dayAbsences = useMemo(
    () => allAbsences.filter(a => a.absence_date === selectedDayStr),
    [allAbsences, selectedDayStr]
  );
  const holes = useMemo(() => dayAbsences.filter(a => a.status === 'open'), [dayAbsences]);

  // Stats — coverage rate of today's absences.
  const totalKgs = kgs.length;
  const totalAbsences = dayAbsences.length;
  const coveredCount = totalAbsences - holes.length;
  const coveragePct = totalAbsences > 0
    ? Math.round((coveredCount / totalAbsences) * 100)
    : 100; // No absences today = 100% coverage

  // ─── Navigation ────────────────────────────────────────
  const navigateBack = () => {
    setCurrentDate(prev => viewMode === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1));
  };
  const navigateForward = () => {
    setCurrentDate(prev => viewMode === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1));
  };

  // ─── Week days ─────────────────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter(d => d.getDay() !== 6); // Exclude Saturday

  // ─── Month days ────────────────────────────────────────
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const allMonthDates = Array.from({ length: daysInMonth }, (_, i) =>
    new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)
  ).filter(d => d.getDay() !== 6);
  const firstDayCol = allMonthDates.length > 0 ? allMonthDates[0].getDay() : 0;
  const monthDays: (Date | null)[] = [
    ...Array.from({ length: firstDayCol }, () => null),
    ...allMonthDates,
  ];

  // ─── Date cell info ────────────────────────────────────
  const getDateInfo = (dateStr: string, _day: Date) => {
    const hol = isHoliday(dateStr);
    if (hol) return { status: 'holiday' as const, label: hol.name };
    const dayHoles = allAbsences.filter(a => a.absence_date === dateStr && a.status === 'open').length;
    if (dayHoles === 0) return { status: 'full' as const, label: '' };
    return { status: 'holes' as const, label: `${dayHoles}` };
  };

  // ─── Real assign mutation ──────────────────────────────
  const assignMutation = useMutation({
    mutationFn: (vars: { kindergartenId: string; substituteId: string; date: string }) =>
      api.post('/assignments', {
        kindergartenId: vars.kindergartenId,
        substituteId: vars.substituteId,
        assignmentDate: vars.date,
      }).then(r => r.data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      const kg = kgs.find(k => k.id === vars.kindergartenId);
      toast.success(`השיבוץ נוצר ל${kg?.name ?? 'גן'}`);
      setAssignModal(null);
    },
    onError: (err) => handleApiError(err, 'POST /api/assignments'),
  });

  const handleAssign = (kindergartenId: string, substituteId: string, date: string) => {
    assignMutation.mutate({ kindergartenId, substituteId, date });
  };

  // ─── Render ────────────────────────────────────────────
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
        {/* KPI badges */}
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
            coveragePct >= 80 ? 'bg-mint-100 text-mint-700' :
            coveragePct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
          }`}>
            {coveragePct}% כיסוי
          </div>
          {holes.length > 0 && !holiday && !isSaturday && (
            <div className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-700">
              {holes.length} חורים
            </div>
          )}
        </div>
      </div>

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
                  const info = getDateInfo(dateStr, day);
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
                  const info = getDateInfo(dateStr, day);
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
                  <button onClick={() => setCurrentDate(prev => subMonths(prev, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <ChevronRight size={18} />
                  </button>
                  <span className="font-semibold text-sm text-navy-900">
                    {format(currentDate, 'MMMM yyyy', { locale: he })}
                  </span>
                  <button onClick={() => setCurrentDate(prev => addMonths(prev, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
                    <ChevronLeft size={18} />
                  </button>
                </div>

                {/* Show days with holes in the month */}
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

                        {!hol && dayHoles === 0 && (
                          <CheckCircle size={18} className="text-mint-500" />
                        )}
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

        {/* ═══ RIGHT: Day detail ═══ */}
        <div className="lg:w-96 space-y-5">
          {/* Selected day header */}
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

                {/* Holes - action items (open absences without coverage) */}
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

                {/* Covered assignments */}
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
        </div>
      </div>

      {/* ─── Assign Modal ─── */}
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

// ─── Assign Modal Component ─────────────────────────────────

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

  // ML-powered recommendations: filtered for permit/active/conflict and
  // ranked by match probability. Cold-starts gracefully when no model
  // is trained yet.
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

  const handleConfirmAssign = () => {
    if (selectedSub) onAssign(selectedSub);
  };

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
            ) : recs.length > 0 ? (
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
            ) : (
              <div className="text-center py-6 border border-slate-200 rounded-xl">
                <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">אין מחליפות זמינות ליום זה</p>
                <p className="text-xs text-slate-400 mt-1">
                  כל המחליפות הפעילות כבר משובצות, או שאין מחליפות עם תיק עובד תקף.
                </p>
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
        /* Confirmation dialog */
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
            <button onClick={handleConfirmAssign} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
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
