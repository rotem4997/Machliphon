import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, Calendar, MapPin, Clock, AlertCircle,
  ChevronRight, ChevronLeft, Camera, Edit3, List, LayoutGrid, Save, X,
} from 'lucide-react';
import api, { handleApiError } from '@/utils/api';
import { useAuthStore } from '@/context/authStore';
import toast from 'react-hot-toast';
import { format, parseISO, startOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isSameMonth } from 'date-fns';
import { he } from 'date-fns/locale';

interface Assignment {
  id: string;
  assignment_date: string;
  start_time: string;
  end_time: string;
  kindergarten_name: string;
  kindergarten_address: string;
  neighborhood: string;
  status: string;
}

// ─── Mock Data ───────────────────────────────────────────────
const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: 'mock-1',
    assignment_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '07:30',
    end_time: '14:00',
    kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15',
    neighborhood: 'מרכז',
    status: 'confirmed',
  },
  {
    id: 'mock-2',
    assignment_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    start_time: '07:30',
    end_time: '13:00',
    kindergarten_name: 'גן נרקיס',
    kindergarten_address: 'רחוב ויצמן 8',
    neighborhood: 'צפון',
    status: 'pending',
  },
  {
    id: 'mock-3',
    assignment_date: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '14:00',
    kindergarten_name: 'גן רקפת',
    kindergarten_address: 'שדרות בן גוריון 22',
    neighborhood: 'דרום',
    status: 'pending',
  },
  {
    id: 'mock-4',
    assignment_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    start_time: '07:30',
    end_time: '14:00',
    kindergarten_name: 'גן כלנית',
    kindergarten_address: 'רחוב סוקולוב 3',
    neighborhood: 'מרכז',
    status: 'pending',
  },
  {
    id: 'mock-5',
    assignment_date: format(addDays(new Date(), 10), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '13:30',
    kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15',
    neighborhood: 'מרכז',
    status: 'pending',
  },
  {
    id: 'mock-6',
    assignment_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    start_time: '07:30',
    end_time: '14:00',
    kindergarten_name: 'גן דליה',
    kindergarten_address: 'רחוב ז׳בוטינסקי 11',
    neighborhood: 'מזרח',
    status: 'pending',
  },
  {
    id: 'mock-7',
    assignment_date: format(addDays(new Date(), 17), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '13:00',
    kindergarten_name: 'גן שושנה',
    kindergarten_address: 'רחוב הגפן 5',
    neighborhood: 'צפון',
    status: 'pending',
  },
  {
    id: 'mock-8',
    assignment_date: format(addDays(new Date(), 21), 'yyyy-MM-dd'),
    start_time: '07:30',
    end_time: '14:00',
    kindergarten_name: 'גן יסמין',
    kindergarten_address: 'רחוב העצמאות 19',
    neighborhood: 'דרום',
    status: 'pending',
  },
  {
    id: 'mock-past-1',
    assignment_date: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
    start_time: '07:30',
    end_time: '14:00',
    kindergarten_name: 'גן חבצלת',
    kindergarten_address: 'רחוב הרצל 15',
    neighborhood: 'מרכז',
    status: 'completed',
  },
  {
    id: 'mock-past-2',
    assignment_date: format(addDays(new Date(), -5), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '13:30',
    kindergarten_name: 'גן נרקיס',
    kindergarten_address: 'רחוב ויצמן 8',
    neighborhood: 'צפון',
    status: 'completed',
  },
];

// Mock availability: dates the substitute marked as unavailable
const MOCK_UNAVAILABLE_DATES = [
  format(addDays(new Date(), 2), 'yyyy-MM-dd'),
  format(addDays(new Date(), 5), 'yyyy-MM-dd'),
  format(addDays(new Date(), 8), 'yyyy-MM-dd'),
  format(addDays(new Date(), 12), 'yyyy-MM-dd'),
  format(addDays(new Date(), 19), 'yyyy-MM-dd'),
];

const MOCK_PROFILE = {
  first_name: 'שרה',
  last_name: 'כהן',
  email: 'sarah.cohen@email.com',
  phone: '054-1234567',
  photo_url: '',
  work_permit_valid: true,
  work_permit_expiry: '2027-01-01',
  total_assignments: 24,
};

type ViewMode = 'week' | 'month' | 'list';

export default function SubstituteDashboard() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuthStore();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // ─── State ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [editingProfile, setEditingProfile] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState<string[]>(MOCK_UNAVAILABLE_DATES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    first_name: MOCK_PROFILE.first_name,
    last_name: MOCK_PROFILE.last_name,
    email: MOCK_PROFILE.email,
    phone: MOCK_PROFILE.phone,
    photo_url: MOCK_PROFILE.photo_url,
  });

  // ─── Queries (fall back to mock data) ─────────────────────
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/substitutes/me').then(r => r.data),
  });

  // Sync profile form when real profile data or auth user loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        photo_url: profile.photo_url || '',
      });
    } else if (authUser) {
      setProfileForm(prev => ({
        ...prev,
        first_name: authUser.firstName,
        last_name: authUser.lastName,
        email: authUser.email,
        phone: authUser.phone || prev.phone,
      }));
    }
  }, [profile, authUser]);

  const { data: todayAssignment } = useQuery<Assignment>({
    queryKey: ['today-assignment'],
    queryFn: async () => {
      const res = await api.get('/assignments', { params: { date: todayStr } });
      return res.data[0] || null;
    },
  });

  // Use real data if available, else auth store user, else mock
  const p = profile || (authUser ? {
    first_name: authUser.firstName,
    last_name: authUser.lastName,
    email: authUser.email,
    phone: authUser.phone || '',
    photo_url: '',
    work_permit_valid: true,
    work_permit_expiry: '2027-01-01',
    total_assignments: 0,
  } : MOCK_PROFILE);
  const allAssignments = MOCK_ASSIGNMENTS.map(a =>
    mockStatusOverrides[a.id] ? { ...a, status: mockStatusOverrides[a.id] } : a
  );
  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayAsgn = todayAssignment ?? allAssignments.find(a => a.assignment_date === selectedDayStr) ?? null;

  // Track mock assignment status changes locally
  const [mockStatusOverrides, setMockStatusOverrides] = useState<Record<string, string>>({});

  const confirmAssignment = useMutation({
    mutationFn: async (id: string) => {
      // Handle mock assignments locally instead of calling the API
      if (id.startsWith('mock-')) {
        setMockStatusOverrides(prev => ({ ...prev, [id]: 'confirmed' }));
        return { data: { message: 'ok' } };
      }
      return api.patch(`/assignments/${id}/confirm`);
    },
    onSuccess: () => {
      toast.success('✅ אישרת את השיבוץ!');
      queryClient.invalidateQueries({ queryKey: ['today-assignment'] });
    },
    onError: (err) => handleApiError(err, 'confirmAssignment'),
  });

  const markArrived = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('mock-')) {
        setMockStatusOverrides(prev => ({ ...prev, [id]: 'arrived' }));
        return { data: { message: 'ok' } };
      }
      return api.patch(`/assignments/${id}/arrive`);
    },
    onSuccess: () => {
      toast.success('הגעתך אושרה!');
      queryClient.invalidateQueries({ queryKey: ['today-assignment'] });
    },
    onError: (err) => handleApiError(err, 'markArrived'),
  });

  const permitOk = p?.work_permit_valid &&
    new Date(p.work_permit_expiry) > new Date();

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'בוקר טוב' : greetingHour < 17 ? 'צהריים טובים' : 'ערב טוב';

  // ─── Availability toggle ──────────────────────────────────
  const toggleAvailability = (dateStr: string) => {
    // Block if assigned to a kindergarten
    const assignment = allAssignments.find(a => a.assignment_date === dateStr);
    if (assignment) return;

    const isCurrentlyUnavailable = unavailableDates.includes(dateStr);
    const confirmMsg = isCurrentlyUnavailable
      ? 'האם את בטוחה שברצונך לסמן את עצמך כזמינה?'
      : 'האם את בטוחה שברצונך לסמן את עצמך כלא זמינה?';

    if (!window.confirm(confirmMsg)) return;

    setUnavailableDates(prev =>
      isCurrentlyUnavailable
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    );
    toast.success(isCurrentlyUnavailable ? 'סומנת כזמינה' : 'סומנת כלא זמינה');
  };

  const getDateStatus = (dateStr: string) => {
    const assignment = allAssignments.find(a => a.assignment_date === dateStr);
    if (assignment) return 'assigned';
    if (unavailableDates.includes(dateStr)) return 'unavailable';
    return 'available';
  };

  // ─── Calendar navigation (RTL: ChevronLeft = forward, ChevronRight = back) ──
  const navigateBack = () => {
    setCurrentDate(prev => viewMode === 'week' ? subWeeks(prev, 1) : subMonths(prev, 1));
  };
  const navigateForward = () => {
    setCurrentDate(prev => viewMode === 'week' ? addWeeks(prev, 1) : addMonths(prev, 1));
  };

  // If today is Saturday, default selectedDay to closest Sunday (tomorrow)
  useEffect(() => {
    if (today.getDay() === 6) {
      const closestSunday = addDays(today, 1);
      setSelectedDay(closestSunday);
      setCurrentDate(closestSunday);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Photo upload handler ─────────────────────────────────
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileForm(prev => ({ ...prev, photo_url: url }));
      toast.success('תמונה הועלתה בהצלחה');
    }
  };

  const saveProfile = () => {
    setEditingProfile(false);
    toast.success('הפרופיל עודכן בהצלחה');
  };

  // ─── Week days for calendar ───────────────────────────────
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    .filter(day => day.getDay() !== 6); // Exclude Saturday

  // Month days (6-column grid: Sun-Fri, no Saturday)
  const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const allMonthDates = Array.from({ length: daysInMonth }, (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1))
    .filter(d => d.getDay() !== 6); // Exclude Saturdays
  // Padding for first row: map day-of-week to 6-col index (Sun=0..Fri=5)
  const firstDayCol = allMonthDates.length > 0 ? allMonthDates[0].getDay() : 0;
  const monthDays: (Date | null)[] = [
    ...Array.from({ length: firstDayCol }, () => null),
    ...allMonthDates,
  ];

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* ═══ LEFT COLUMN: Calendar + Assignments ═══ */}
        <div className="flex-1 space-y-5">
          {/* Greeting */}
          <div className="pt-2">
            <h1 className="text-xl font-bold text-navy-900">
              {greeting}, {p?.first_name} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {format(today, 'EEEE, d בMMMM', { locale: he })}
            </p>
          </div>

          {/* Work permit warning */}
          {!permitOk && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">תיק עובד לא תקף</p>
                <p className="text-red-600 text-xs mt-0.5">אי אפשר לשבץ אותך ללא תיק עובד תקף. פני למדריכת הגנים שלך.</p>
              </div>
            </div>
          )}

          {/* Today's assignment */}
          {selectedDayAsgn ? (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-mint-500" />
                <h2 className="font-bold text-navy-900">
                  {isSameDay(selectedDay, today) ? 'שיבוץ להיום' : `שיבוץ ל${format(selectedDay, 'EEEE d/M', { locale: he })}`}
                </h2>
              </div>

              <div className="bg-navy-900 rounded-xl p-5 text-white mb-4">
                <p className="text-mint-400 text-sm font-medium mb-1">גן ילדים</p>
                <p className="text-lg font-bold">{selectedDayAsgn.kindergarten_name}</p>
                <div className="flex items-center gap-4 mt-3 text-navy-300 text-sm">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {selectedDayAsgn.kindergarten_address}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    {selectedDayAsgn.start_time} — {selectedDayAsgn.end_time}
                  </div>
                </div>
              </div>

              {selectedDayAsgn.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => confirmAssignment.mutate(selectedDayAsgn.id)}
                    disabled={confirmAssignment.isPending}
                    className="btn-primary flex items-center justify-center gap-2 py-4 text-base"
                  >
                    <CheckCircle size={20} />
                    אני מגיעה ✓
                  </button>
                  <button
                    onClick={() => toast.error('פנה/י למדריכה לביטול')}
                    className="btn-secondary flex items-center justify-center gap-2 py-4 text-base text-red-500 border-red-200"
                  >
                    <XCircle size={20} />
                    לא יכולה
                  </button>
                </div>
              )}

              {selectedDayAsgn.status === 'confirmed' && (
                <div className="bg-mint-100 rounded-xl p-4 text-center">
                  <CheckCircle size={24} className="text-mint-500 mx-auto mb-2" />
                  <p className="text-mint-700 font-semibold">השיבוץ אושר</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Calendar size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-navy-900">
                {isSameDay(selectedDay, today) ? 'אין שיבוץ להיום' : `אין שיבוץ ל${format(selectedDay, 'EEEE d/M', { locale: he })}`}
              </p>
              <p className="text-slate-500 text-sm mt-1">נעדכן אותך כשיהיה שיבוץ זמין</p>

              {/* Availability toggle for unassigned days */}
              {selectedDay >= today && (
                <div className="mt-4">
                  {unavailableDates.includes(selectedDayStr) ? (
                    <button
                      onClick={() => toggleAvailability(selectedDayStr)}
                      className="btn-primary flex items-center justify-center gap-2 py-3 w-full text-base"
                    >
                      <CheckCircle size={20} />
                      סמני כזמינה
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAvailability(selectedDayStr)}
                      className="btn-secondary flex items-center justify-center gap-2 py-3 w-full text-base text-red-500 border-red-200"
                    >
                      <XCircle size={20} />
                      סמני כלא זמינה
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ View Mode Toggle ═══ */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy-900">לוח זמנים</h3>
              <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
                {([
                  { mode: 'week' as ViewMode, label: 'שבועי', icon: LayoutGrid },
                  { mode: 'month' as ViewMode, label: 'חודשי', icon: Calendar },
                  { mode: 'list' as ViewMode, label: 'רשימה', icon: List },
                ]).map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      viewMode === mode
                        ? 'bg-white text-navy-900 shadow-sm'
                        : 'text-slate-500 hover:text-navy-700'
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
                {/* Day headers (Sun-Fri, no Saturday) */}
                {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-slate-400 pb-1">{d}</div>
                ))}
                {/* Day cells */}
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const status = getDateStatus(dateStr);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDay);
                  const assignment = allAssignments.find(a => a.assignment_date === dateStr);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(day)}
                      className={`relative rounded-xl p-2 text-center transition-all min-h-[80px] flex flex-col items-center justify-start gap-1 border-2 ${
                        isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                      } ${
                        isToday ? 'ring-2 ring-mint-400 ring-offset-1' : ''
                      } ${
                        status === 'assigned'
                          ? 'bg-mint-100 border-mint-300 text-mint-700'
                          : status === 'unavailable'
                          ? 'bg-red-50 border-red-200 text-red-400'
                          : 'bg-white border-slate-100 hover:border-mint-200 text-navy-900'
                      }`}
                    >
                      <span className={`text-sm font-bold ${isToday ? 'text-mint-500' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {status === 'assigned' && assignment && (
                        <span className="text-[10px] leading-tight font-medium">{assignment.kindergarten_name}</span>
                      )}
                      {status === 'unavailable' && (
                        <XCircle size={14} className="text-red-300" />
                      )}
                      {status === 'available' && (
                        <CheckCircle size={14} className="text-mint-300" />
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
                  const status = getDateStatus(dateStr);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selectedDay);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(day)}
                      className={`rounded-lg p-1.5 text-center text-xs transition-all ${
                        isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                      } ${
                        isToday ? 'ring-2 ring-mint-400 ring-offset-1' : ''
                      } ${
                        status === 'assigned'
                          ? 'bg-mint-100 text-mint-700 font-bold'
                          : status === 'unavailable'
                          ? 'bg-red-50 text-red-400'
                          : 'hover:bg-mint-50 text-navy-900'
                      }`}
                    >
                      {format(day, 'd')}
                      {status === 'assigned' && <div className="w-1.5 h-1.5 bg-mint-500 rounded-full mx-auto mt-0.5" />}
                      {status === 'unavailable' && <div className="w-1.5 h-1.5 bg-red-400 rounded-full mx-auto mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ─── LIST VIEW (Monthly) ─── */}
            {viewMode === 'list' && (
              <div className="space-y-2">
                {/* Navigation for list view */}
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

                {/* Monthly assignments list */}
                {allAssignments
                  .filter(a => isSameMonth(parseISO(a.assignment_date), currentDate))
                  .sort((a, b) => a.assignment_date.localeCompare(b.assignment_date))
                  .map(assignment => {
                  const day = parseISO(assignment.assignment_date);
                  const dateStr = assignment.assignment_date;
                  const isToday = isSameDay(day, today);

                  return (
                    <div
                      key={dateStr}
                      className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all ${
                        isToday ? 'bg-mint-50 border border-mint-200' : 'bg-slate-50'
                      }`}
                    >
                      {/* Date badge */}
                      <div className="text-center rounded-lg px-2.5 py-1.5 min-w-[48px] bg-navy-900">
                        <p className="text-xs font-bold text-mint-400">
                          {format(day, 'EEE', { locale: he })}
                        </p>
                        <p className="text-sm font-bold text-white">
                          {format(day, 'd/M')}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-900">{assignment.kindergarten_name}</p>
                        <p className="text-xs text-slate-500">{assignment.kindergarten_address} · {assignment.start_time}—{assignment.end_time}</p>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          assignment.status === 'confirmed' ? 'badge-green' :
                          assignment.status === 'completed' ? 'badge-blue' : 'badge-amber'
                        }`}>
                          {assignment.status === 'confirmed' ? 'מאושר' :
                           assignment.status === 'completed' ? 'הושלם' : 'ממתין'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {allAssignments.filter(a => isSameMonth(parseISO(a.assignment_date), currentDate)).length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    אין שיבוצים לחודש זה
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full bg-mint-400" />
                זמינה
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                לא זמינה
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded-full bg-navy-900" />
                שיבוץ
              </div>
            </div>
          </div>

          {/* Stats (without rating and experience) */}
          <button
            onClick={() => { setViewMode('list'); }}
            className="card p-4 text-center w-full hover:bg-slate-50 transition-all cursor-pointer"
          >
            <p className="text-2xl font-black text-navy-900">{p.total_assignments || 24}</p>
            <p className="text-xs text-slate-500 mt-0.5">שיבוצים סה"כ</p>
          </button>
        </div>

        {/* ═══ RIGHT COLUMN: Profile + Availability sidebar ═══ */}
        <div className="lg:w-80 space-y-5">
          {/* Profile Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy-900">פרופיל</h3>
              {!editingProfile ? (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="text-mint-500 hover:text-mint-600 p-1.5 rounded-lg hover:bg-mint-50"
                >
                  <Edit3 size={16} />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={saveProfile} className="text-mint-500 hover:text-mint-600 p-1.5 rounded-lg hover:bg-mint-50">
                    <Save size={16} />
                  </button>
                  <button onClick={() => setEditingProfile(false)} className="text-red-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Photo */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center overflow-hidden">
                  {profileForm.photo_url ? (
                    <img src={profileForm.photo_url} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-mint-400">
                      {(p.first_name || 'ש')[0]}
                    </span>
                  )}
                </div>
                {editingProfile && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -left-1 bg-mint-500 text-white rounded-full p-1.5 shadow-md hover:bg-mint-600"
                    >
                      <Camera size={12} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Profile fields */}
            <div className="space-y-3">
              {editingProfile ? (
                <>
                  <div>
                    <label className="text-xs text-slate-500">שם פרטי</label>
                    <input
                      className="input mt-0.5"
                      value={profileForm.first_name}
                      onChange={e => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">שם משפחה</label>
                    <input
                      className="input mt-0.5"
                      value={profileForm.last_name}
                      onChange={e => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">אימייל</label>
                    <input
                      className="input mt-0.5"
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">טלפון</label>
                    <input
                      className="input mt-0.5"
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="font-bold text-navy-900 text-lg">{profileForm.first_name} {profileForm.last_name}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">אימייל</span>
                      <span className="text-navy-900 font-medium">{profileForm.email}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">טלפון</span>
                      <span className="text-navy-900 font-medium">{profileForm.phone}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">תיק עובד</span>
                      <span className={`font-medium ${permitOk ? 'text-mint-500' : 'text-red-500'}`}>
                        {permitOk ? 'תקף' : 'לא תקף'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Availability Panel */}
          <div className="card p-5">
            <h3 className="font-bold text-navy-900 mb-3">זמינות מהירה</h3>
            <p className="text-xs text-slate-500 mb-3">לחצי על יום כדי לשנות זמינות</p>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => addDays(today, i + 1)).map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const status = getDateStatus(dateStr);
                const assignment = allAssignments.find(a => a.assignment_date === dateStr);

                return (
                  <button
                    key={dateStr}
                    onClick={() => !assignment && toggleAvailability(dateStr)}
                    disabled={!!assignment}
                    className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-sm transition-all ${
                      assignment
                        ? 'bg-mint-50 border border-mint-200 cursor-default'
                        : status === 'unavailable'
                        ? 'bg-red-50 border border-red-200 hover:bg-red-100'
                        : 'bg-slate-50 border border-slate-100 hover:border-mint-200 hover:bg-mint-50'
                    }`}
                  >
                    <span className="font-medium text-navy-900">
                      {format(day, 'EEEE d/M', { locale: he })}
                    </span>
                    {assignment ? (
                      <span className="text-xs text-mint-600 font-medium">{assignment.kindergarten_name}</span>
                    ) : status === 'unavailable' ? (
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle size={14} />
                        <span className="text-xs">לא זמינה</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-mint-500">
                        <CheckCircle size={14} />
                        <span className="text-xs">זמינה</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
