import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Calendar, AlertTriangle, CheckCircle, Clock,
  User, ArrowLeftRight, Zap, MapPin,
} from 'lucide-react';
import api from '@/utils/api';
import { formatDistanceToNow, parseISO, format, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { isHoliday } from '@/utils/holidays';

// ─── Types ──────────────────────────────────────────────────

interface ActivityEvent {
  event_type: 'assignment' | 'absence' | 'system';
  id: string;
  status: string;
  event_time: string;
  details: {
    kindergarten: string;
    substitute?: string;
    employee?: string;
    date: string;
    reason?: string;
    assignedBy?: string;
  };
}

interface LiveStats {
  assignmentsToday: Record<string, number>;
  absencesToday: Record<string, number>;
  availableSubstitutes: number;
  lastActivity: string | null;
}

// ─── Mock data ──────────────────────────────────────────────

const MOCK_KINDERGARTENS = [
  'גן חבצלת', 'גן נרקיס', 'גן רקפת', 'גן כלנית', 'גן דליה',
  'גן שושנה', 'גן תמר', 'גן אורית', 'גן ענבל', 'גן שקמה',
  'גן אביבית', 'גן צבעוני',
];

const MOCK_SUBS = [
  'מרים אברהם', 'רחל לוי', 'שרה כהן', 'לאה דוד',
  'נועה פרידמן', 'דנה שמעוני', 'יעל ברק', 'תמר מזרחי',
];

function generateMockFeed(): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = new Date();

  // Generate recent assignment events
  const actions: { status: string; verb: string }[] = [
    { status: 'pending', verb: 'שובצה' },
    { status: 'confirmed', verb: 'אישרה' },
    { status: 'arrived', verb: 'הגיעה' },
    { status: 'completed', verb: 'הושלם' },
  ];

  for (let i = 0; i < 25; i++) {
    const minutesAgo = i * 12 + Math.floor(Math.random() * 10);
    const eventTime = new Date(now.getTime() - minutesAgo * 60_000);
    const action = actions[i % actions.length];
    const sub = MOCK_SUBS[i % MOCK_SUBS.length];
    const kg = MOCK_KINDERGARTENS[i % MOCK_KINDERGARTENS.length];

    events.push({
      event_type: 'assignment',
      id: `mock-event-${i}`,
      status: action.status,
      event_time: eventTime.toISOString(),
      details: {
        kindergarten: kg,
        substitute: sub,
        date: format(now, 'yyyy-MM-dd'),
        assignedBy: 'מנהלת',
      },
    });
  }

  // Add some absence events
  for (let i = 0; i < 3; i++) {
    const minutesAgo = (i + 5) * 20;
    const eventTime = new Date(now.getTime() - minutesAgo * 60_000);
    events.push({
      event_type: 'absence',
      id: `mock-absence-${i}`,
      status: i === 0 ? 'open' : 'assigned',
      event_time: eventTime.toISOString(),
      details: {
        kindergarten: MOCK_KINDERGARTENS[(i + 2) % MOCK_KINDERGARTENS.length],
        employee: ['דנה שמעוני', 'יעל פרידמן', 'נועה ברק'][i],
        date: format(now, 'yyyy-MM-dd'),
        reason: ['sick', 'vacation', 'personal'][i],
      },
    });
  }

  // Add system/hole events
  const today = new Date();
  for (let dayOff = 0; dayOff <= 2; dayOff++) {
    const date = addDays(today, dayOff);
    const dateStr = format(date, 'yyyy-MM-dd');
    if (date.getDay() === 6 || isHoliday(dateStr)) continue;
    // Check for holes (using same logic as dashboard mock)
    const holesCount = dayOff === 0 ? 2 : dayOff === 1 ? 1 : 3;
    if (holesCount > 0) {
      events.push({
        event_type: 'system',
        id: `mock-hole-${dayOff}`,
        status: 'holes',
        event_time: new Date(now.getTime() - dayOff * 3600_000).toISOString(),
        details: {
          kindergarten: `${holesCount} גנים`,
          date: dateStr,
        },
      });
    }
  }

  return events.sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());
}

const MOCK_FEED = generateMockFeed();

const MOCK_LIVE_STATS: LiveStats = {
  assignmentsToday: { pending: 3, confirmed: 4, arrived: 2, completed: 3 },
  absencesToday: { open: 1, assigned: 5 },
  availableSubstitutes: 4,
  lastActivity: new Date().toISOString(),
};

const REFETCH_INTERVAL = 300_000; // 5 minutes

// ─── Main Component ─────────────────────────────────────────

export default function ActivityDashboard() {
  const [filter, setFilter] = useState<'all' | 'assignments' | 'absences' | 'holes'>('all');

  const { data: liveStats } = useQuery<LiveStats>({
    queryKey: ['live-stats'],
    queryFn: () => api.get('/activity/live-stats').then(r => r.data),
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: feed } = useQuery<ActivityEvent[]>({
    queryKey: ['activity-feed'],
    queryFn: () => api.get('/activity/feed', { params: { limit: 30 } }).then(r => r.data),
    refetchInterval: REFETCH_INTERVAL,
  });

  const stats = liveStats || MOCK_LIVE_STATS;
  const allEvents = feed && feed.length > 0 ? feed : MOCK_FEED;

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return allEvents;
    if (filter === 'assignments') return allEvents.filter(e => e.event_type === 'assignment');
    if (filter === 'absences') return allEvents.filter(e => e.event_type === 'absence');
    if (filter === 'holes') return allEvents.filter(e => e.event_type === 'system');
    return allEvents;
  }, [allEvents, filter]);

  const totalAssignments = Object.values(stats.assignmentsToday).reduce((a, b) => a + b, 0);
  const totalAbsences = Object.values(stats.absencesToday).reduce((a, b) => a + b, 0);
  const openAbsences = stats.absencesToday?.open ?? 0;
  const completedAssignments = stats.assignmentsToday?.completed ?? 0;
  const arrivedAssignments = stats.assignmentsToday?.arrived ?? 0;

  return (
    <div className="space-y-6 fade-in max-w-5xl mx-auto">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900 flex items-center gap-2">
            <Activity size={24} className="text-mint-500" />
            פעילות חיה
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {format(new Date(), 'EEEE, d בMMMM yyyy', { locale: he })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-mint-500"></span>
          </span>
          <span className="text-xs text-mint-600 font-medium">LIVE</span>
          <span className="text-xs text-slate-400 mr-2">
            רענון כל 5 דקות
          </span>
        </div>
      </div>

      {/* Live KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiveCard
          label="שיבוצים היום"
          value={totalAssignments}
          sub={`${completedAssignments} הושלמו • ${arrivedAssignments} הגיעו`}
          icon={<Calendar size={20} />}
          color="text-sky-500"
          bg="bg-sky-50"
        />
        <LiveCard
          label="היעדרויות"
          value={totalAbsences}
          sub={openAbsences > 0 ? `${openAbsences} פתוחות` : 'הכל מכוסה'}
          icon={<AlertTriangle size={20} />}
          color={openAbsences > 0 ? 'text-red-500' : 'text-mint-500'}
          bg={openAbsences > 0 ? 'bg-red-50' : 'bg-mint-50'}
        />
        <LiveCard
          label="מחליפות פנויות"
          value={stats.availableSubstitutes}
          sub="זמינות לשיבוץ"
          icon={<User size={20} />}
          color="text-violet-500"
          bg="bg-violet-50"
        />
        <LiveCard
          label="כיסוי"
          value={totalAbsences > 0 ? `${Math.round(((totalAbsences - openAbsences) / totalAbsences) * 100)}%` : '100%'}
          sub="מהיעדרויות מכוסות"
          icon={<CheckCircle size={20} />}
          color={openAbsences === 0 ? 'text-mint-500' : 'text-amber-500'}
          bg={openAbsences === 0 ? 'bg-mint-50' : 'bg-amber-50'}
        />
      </div>

      {/* Status breakdown */}
      {totalAssignments > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            סטטוס שיבוצים היום
          </h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(stats.assignmentsToday).map(([status, count]) => (
              <StatusPill key={status} status={status} count={count} />
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-900 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            יומן פעילות
          </h3>
          {/* Filter tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {([
              { key: 'all' as const, label: 'הכל' },
              { key: 'assignments' as const, label: 'שיבוצים' },
              { key: 'absences' as const, label: 'היעדרויות' },
              { key: 'holes' as const, label: 'חורים' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  filter === key ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, i) => (
              <ActivityRow key={`${event.id}-${i}`} event={event} />
            ))
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">אין פעילות עדיין</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function LiveCard({ label, value, sub, icon, color, bg }: {
  label: string; value: number | string; sub: string;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${bg}`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-slate-600 text-sm font-medium mt-0.5">{label}</div>
      <div className="text-slate-400 text-xs mt-0.5">{sub}</div>
    </div>
  );
}

function StatusPill({ status, count }: { status: string; count: number }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: 'ממתין', cls: 'bg-amber-100 text-amber-700' },
    confirmed: { label: 'אושר', cls: 'bg-blue-100 text-blue-700' },
    arrived: { label: 'הגיעה', cls: 'bg-green-100 text-green-700' },
    completed: { label: 'הושלם', cls: 'bg-mint-100 text-green-800' },
    cancelled: { label: 'בוטל', cls: 'bg-red-100 text-red-700' },
    no_show: { label: 'לא הגיעה', cls: 'bg-red-100 text-red-700' },
  };
  const c = config[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <div className={`px-4 py-2 rounded-xl text-sm font-medium ${c.cls}`}>
      <span className="text-lg font-black ml-1">{count}</span>
      {c.label}
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const isAssignment = event.event_type === 'assignment';
  const isSystem = event.event_type === 'system';
  const timeAgo = formatDistanceToNow(parseISO(event.event_time), { addSuffix: true, locale: he });

  const statusLabels: Record<string, string> = {
    pending: 'שובצה',
    confirmed: 'אישרה',
    arrived: 'הגיעה',
    completed: 'הושלם',
    cancelled: 'בוטל',
    open: 'דווחה',
    assigned: 'שובצה',
    covered: 'כוסתה',
    uncovered: 'לא כוסתה',
    holes: 'חורים',
  };

  const reasonLabels: Record<string, string> = {
    sick: 'מחלה',
    vacation: 'חופשה',
    personal: 'אישי',
  };

  return (
    <div className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
      <div className={`mt-0.5 p-1.5 rounded-lg ${
        isSystem ? 'bg-red-50' :
        isAssignment ? 'bg-sky-50' : 'bg-amber-50'
      }`}>
        {isSystem ? (
          <AlertTriangle size={14} className="text-red-500" />
        ) : isAssignment ? (
          <ArrowLeftRight size={14} className="text-sky-500" />
        ) : (
          <MapPin size={14} className="text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy-900">
          {isSystem ? (
            <>
              <span className="font-bold text-red-600">{event.details.kindergarten}</span>
              {' '}ללא כיסוי ב{format(parseISO(event.details.date), 'EEEE d/M', { locale: he })}
            </>
          ) : isAssignment ? (
            <>
              <span className="font-semibold">{event.details.substitute}</span>
              {' '}{statusLabels[event.status] || event.status}{' '}
              ל<span className="font-medium">{event.details.kindergarten}</span>
            </>
          ) : (
            <>
              היעדרות של <span className="font-semibold">{event.details.employee}</span>
              {' '}ב<span className="font-medium">{event.details.kindergarten}</span>
              {event.details.reason && (
                <span className="text-slate-400"> ({reasonLabels[event.details.reason] || event.details.reason})</span>
              )}
            </>
          )}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{timeAgo}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
        event.status === 'completed' || event.status === 'covered' ? 'bg-green-100 text-green-700' :
        event.status === 'cancelled' || event.status === 'uncovered' || event.status === 'holes' ? 'bg-red-100 text-red-700' :
        event.status === 'open' ? 'bg-amber-100 text-amber-700' :
        event.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
        'bg-slate-100 text-slate-600'
      }`}>
        {statusLabels[event.status] || event.status}
      </span>
    </div>
  );
}
