import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, AlertTriangle, ChevronRight, ChevronLeft, Plus, X,
  MapPin, Clock, User, LayoutGrid, List, CheckCircle, Phone,
} from 'lucide-react';
import api, { handleApiError } from '@/utils/api';
import { useAuthStore } from '@/context/authStore';
import toast from 'react-hot-toast';
import {
  format, parseISO, startOfWeek, addDays, addWeeks, subWeeks,
  addMonths, subMonths, isSameDay, isSameMonth, isToday,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { isHoliday, Holiday } from '@/utils/holidays';

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

interface AvailableSub {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  neighborhood: string;
  education_level: string;
  years_experience: number;
  total_assignments: number;
}

// ─── Mock data ──────────────────────────────────────────────

const MOCK_KINDERGARTENS: Kindergarten[] = [
  { id: 'kg-1', name: 'גן חבצלת', address: 'רחוב הרצל 15', neighborhood: 'מרכז', age_group: 'גן ילדים' },
  { id: 'kg-2', name: 'גן נרקיס', address: 'רחוב ויצמן 8', neighborhood: 'צפון', age_group: 'גן ילדים' },
  { id: 'kg-3', name: 'גן רקפת', address: 'שדרות בן גוריון 22', neighborhood: 'דרום', age_group: 'טרום חובה' },
  { id: 'kg-4', name: 'גן כלנית', address: 'רחוב סוקולוב 3', neighborhood: 'מרכז', age_group: 'גן ילדים' },
  { id: 'kg-5', name: 'גן דליה', address: 'רחוב ז׳בוטינסקי 11', neighborhood: 'מזרח', age_group: 'טרום חובה' },
];

const MOCK_AVAILABLE_SUBS: AvailableSub[] = [
  { id: 'sub-1', first_name: 'מרים', last_name: 'אברהם', phone: '054-1234567', neighborhood: 'מרכז', education_level: 'תואר ראשון', years_experience: 3, total_assignments: 24 },
  { id: 'sub-2', first_name: 'רחל', last_name: 'לוי', phone: '052-9876543', neighborhood: 'צפון', education_level: 'תואר שני', years_experience: 5, total_assignments: 42 },
  { id: 'sub-3', first_name: 'שרה', last_name: 'כהן', phone: '050-5551234', neighborhood: 'דרום', education_level: 'סמינר', years_experience: 2, total_assignments: 15 },
  { id: 'sub-4', first_name: 'לאה', last_name: 'דוד', phone: '053-7778899', neighborhood: 'מזרח', education_level: 'תואר ראשון', years_experience: 4, total_assignments: 31 },
];

function generateMockAssignments(): Assignment[] {
  const today = new Date();
  const assignments: Assignment[] = [];
  const kgs = MOCK_KINDERGARTENS;
  const subs = MOCK_AVAILABLE_SUBS;

  // Deterministic pseudo-random based on day offset for consistent display
  // Some days are fully covered, others have 1-2 holes
  for (let dayOffset = -5; dayOffset <= 20; dayOffset++) {
    const date = addDays(today, dayOffset);
    if (date.getDay() === 6) continue; // Skip Saturday
    const dateStr = format(date, 'yyyy-MM-dd');
    if (isHoliday(dateStr)) continue;

    const usedSubIds = new Set<string>();

    // Decide which pattern this day gets:
    // ~40% of days = fully covered, ~40% have 1 hole, ~20% have 2 holes
    const seed = Math.abs(dayOffset * 7 + 3);
    const pattern = seed % 5; // 0,1 = full; 2,3 = 1 hole; 4 = 2 holes
    const holeCount = pattern <= 1 ? 0 : pattern <= 3 ? 1 : 2;

    // Pick which kindergarten indices will have holes
    const holeIndices = new Set<number>();
    if (holeCount >= 1) holeIndices.add(seed % kgs.length);
    if (holeCount >= 2) holeIndices.add((seed + 2) % kgs.length);

    kgs.forEach((kg, ki) => {
      if (holeIndices.has(ki)) return; // This kg has a hole today
      const availSub = subs.find(s => !usedSubIds.has(s.id)) || subs[ki % subs.length];
      usedSubIds.add(availSub.id);
      assignments.push({
        id: `mock-asgn-${dateStr}-${kg.id}`,
        assignment_date: dateStr,
        start_time: '07:30',
        end_time: '14:00',
        status: dayOffset < 0 ? 'completed' : dayOffset === 0 ? 'confirmed' : 'pending',
        kindergarten_id: kg.id,
        kindergarten_name: kg.name,
        kindergarten_address: kg.address,
        neighborhood: kg.neighborhood,
        substitute_first_name: availSub.first_name,
        substitute_last_name: availSub.last_name,
        substitute_phone: availSub.phone,
        notes: null,
      });
    });
  }
  return assignments;
}

const MOCK_ASSIGNMENTS = generateMockAssignments();

type ViewMode = 'week' | 'month' | 'list';

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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const today = new Date();

  // ─── State ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [assignModal, setAssignModal] = useState<{ kindergartenId: string; date: string } | null>(null);
  const [localAssignments, setLocalAssignments] = useState<Assignment[]>([]);

  // ─── Queries ───────────────────────────────────────────
  const { data: kindergartens } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens'],
    queryFn: () => api.get('/kindergartens').then(r => r.data),
  });

  // Always use mock kindergartens since assignments are mock data
  const kgs = MOCK_KINDERGARTENS;

  // All assignments for the visible range
  const allAssignments = useMemo(() => [...MOCK_ASSIGNMENTS, ...localAssignments], [localAssignments]);

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const holiday = isHoliday(selectedDayStr);
  const isSaturday = selectedDay.getDay() === 6;

  // Assignments for selected day
  const dayAssignments = useMemo(
    () => allAssignments.filter(a => a.assignment_date === selectedDayStr),
    [allAssignments, selectedDayStr]
  );

  // Which kindergartens have holes (no assignment) on selected day
  const coveredKgIds = new Set(dayAssignments.map(a => a.kindergarten_id));
  const holes = kgs.filter(kg => !coveredKgIds.has(kg.id));

  // Stats
  const totalKgs = kgs.length;
  const coveredCount = totalKgs - holes.length;
  const coveragePct = totalKgs > 0 ? Math.round((coveredCount / totalKgs) * 100) : 100;

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
  const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
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
  const getDateInfo = (dateStr: string, day: Date) => {
    const hol = isHoliday(dateStr);
    if (hol) return { status: 'holiday' as const, label: hol.name };
    const dayAsgns = allAssignments.filter(a => a.assignment_date === dateStr);
    const dayHoles = totalKgs - dayAsgns.length;
    if (dayHoles === 0) return { status: 'full' as const, label: '' };
    if (dayHoles > 0) return { status: 'holes' as const, label: `${dayHoles}` };
    return { status: 'full' as const, label: '' };
  };

  // ─── Mock assign handler ───────────────────────────────
  const handleAssign = (kindergartenId: string, substituteId: string, date: string) => {
    const kg = kgs.find(k => k.id === kindergartenId)!;
    const sub = MOCK_AVAILABLE_SUBS.find(s => s.id === substituteId)!;
    const newAssignment: Assignment = {
      id: `local-${Date.now()}`,
      assignment_date: date,
      start_time: '07:30',
      end_time: '14:00',
      status: 'pending',
      kindergarten_id: kindergartenId,
      kindergarten_name: kg.name,
      kindergarten_address: kg.address,
      neighborhood: kg.neighborhood,
      substitute_first_name: sub.first_name,
      substitute_last_name: sub.last_name,
      substitute_phone: sub.phone,
      notes: null,
    };
    setLocalAssignments(prev => [...prev, newAssignment]);
    setAssignModal(null);
    toast.success(`${sub.first_name} ${sub.last_name} שובצה ל${kg.name}`);
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
                    const dayAsgns = allAssignments.filter(a => a.assignment_date === dateStr);
                    const dayHoles = totalKgs - dayAsgns.length;
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
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-navy-900">
                                {dayAsgns.length}/{totalKgs} גנים מכוסים
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
                  {coveredCount}/{totalKgs} גנים מכוסים
                  {holes.length > 0 && <span className="text-red-500 font-semibold"> • {holes.length} חורים</span>}
                </p>

                {/* Holes - action items */}
                {holes.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      גנים ללא מחליפה
                    </h4>
                    <div className="space-y-2">
                      {holes.map(kg => (
                        <div
                          key={kg.id}
                          className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-red-50 border border-red-200"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-navy-900">{kg.name}</p>
                            <p className="text-xs text-slate-500">{kg.address}</p>
                          </div>
                          <button
                            onClick={() => setAssignModal({ kindergartenId: kg.id, date: selectedDayStr })}
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

                {holes.length === 0 && dayAssignments.length > 0 && (
                  <div className="bg-mint-50 rounded-xl p-3 text-center mt-4">
                    <CheckCircle size={20} className="text-mint-500 mx-auto mb-1" />
                    <p className="text-mint-700 text-sm font-semibold">כל הגנים מכוסים!</p>
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
      {assignModal && (() => {
        // Filter out subs already assigned on this date
        const dateAsgns = allAssignments.filter(a => a.assignment_date === assignModal.date);
        const assignedSubNames = new Set(dateAsgns.map(a => `${a.substitute_first_name} ${a.substitute_last_name}`));
        const freeSubs = MOCK_AVAILABLE_SUBS.filter(s => !assignedSubNames.has(`${s.first_name} ${s.last_name}`));
        return (
          <AssignModal
            kindergartenId={assignModal.kindergartenId}
            kindergartenName={kgs.find(k => k.id === assignModal.kindergartenId)?.name || ''}
            date={assignModal.date}
            availableSubs={freeSubs}
            onClose={() => setAssignModal(null)}
            onAssign={(subId) => handleAssign(assignModal.kindergartenId, subId, assignModal.date)}
          />
        );
      })()}
    </div>
  );
}

// ─── Assign Modal Component ─────────────────────────────────

function AssignModal({
  kindergartenName,
  date,
  availableSubs,
  onClose,
  onAssign,
}: {
  kindergartenId: string;
  kindergartenName: string;
  date: string;
  availableSubs: AvailableSub[];
  onClose: () => void;
  onAssign: (subId: string) => void;
}) {
  const [selectedSub, setSelectedSub] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedSubObj = availableSubs.find(s => s.id === selectedSub);

  const handleConfirmAssign = () => {
    if (selectedSub) {
      onAssign(selectedSub);
    }
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
            <label className="text-sm font-semibold text-navy-900 mb-2 block">
              בחרי מחליפה ({availableSubs.length} זמינות)
            </label>
            {availableSubs.length > 0 ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {availableSubs.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                      selectedSub === s.id
                        ? 'bg-mint-50 border-mint-300'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="substitute"
                      value={s.id}
                      checked={selectedSub === s.id}
                      onChange={() => setSelectedSub(s.id)}
                      className="accent-mint-500"
                    />
                    <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-xs font-bold text-mint-400 flex-shrink-0">
                      {s.first_name[0]}{s.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400">
                        {s.education_level} • {s.years_experience} שנות ניסיון • {s.total_assignments} שיבוצים
                      </p>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Phone size={10} />
                      {s.phone}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-slate-200 rounded-xl">
                <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">כל המחליפות כבר משובצות ליום זה</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => selectedSub && setShowConfirm(true)}
              disabled={!selectedSub}
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
            לשבץ את <span className="font-bold text-navy-900">{selectedSubObj?.first_name} {selectedSubObj?.last_name}</span>
          </p>
          <p className="text-slate-600 text-sm mb-1">
            ל<span className="font-bold text-navy-900">{kindergartenName}</span>
          </p>
          <p className="text-slate-500 text-xs mb-5">
            {format(parseISO(date), 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
          <div className="flex gap-2">
            <button onClick={handleConfirmAssign} className="btn-primary flex-1">
              אישור
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
