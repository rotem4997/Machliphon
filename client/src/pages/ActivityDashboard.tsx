import { useQuery } from '@tanstack/react-query';
import {
  Activity, Users, Calendar, AlertTriangle, CheckCircle, Clock,
  MapPin, User, ArrowLeftRight, Zap
} from 'lucide-react';
import api from '@/utils/api';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ActivityEvent {
  event_type: 'assignment' | 'absence';
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

const REFETCH_INTERVAL = 10_000; // 10 seconds for real-time feel

export default function ActivityDashboard() {
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

  const totalAssignments = liveStats
    ? Object.values(liveStats.assignmentsToday).reduce((a, b) => a + b, 0)
    : 0;
  const totalAbsences = liveStats
    ? Object.values(liveStats.absencesToday).reduce((a, b) => a + b, 0)
    : 0;
  const openAbsences = liveStats?.absencesToday?.open ?? 0;
  const completedAssignments = liveStats?.assignmentsToday?.completed ?? 0;
  const arrivedAssignments = liveStats?.assignmentsToday?.arrived ?? 0;

  return (
    <div className="space-y-6 fade-in">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900 flex items-center gap-2">
            <Activity size={24} className="text-mint-500" />
            פעילות בזמן אמת
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
          {liveStats?.lastActivity && (
            <span className="text-xs text-slate-400 mr-2">
              עדכון אחרון: {formatDistanceToNow(parseISO(liveStats.lastActivity), { addSuffix: true, locale: he })}
            </span>
          )}
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
          label="היעדרויות היום"
          value={totalAbsences}
          sub={openAbsences > 0 ? `${openAbsences} פתוחות` : 'הכל מכוסה'}
          icon={<AlertTriangle size={20} />}
          color={openAbsences > 0 ? 'text-red-500' : 'text-mint-500'}
          bg={openAbsences > 0 ? 'bg-red-50' : 'bg-mint-50'}
        />
        <LiveCard
          label="מחליפות זמינות"
          value={liveStats?.availableSubstitutes ?? 0}
          sub="פנויות לשיבוץ"
          icon={<Users size={20} />}
          color="text-violet-500"
          bg="bg-violet-50"
        />
        <LiveCard
          label="אחוז כיסוי"
          value={totalAbsences > 0 ? `${Math.round(((totalAbsences - openAbsences) / totalAbsences) * 100)}%` : '100%'}
          sub="מהיעדרויות מכוסות"
          icon={<CheckCircle size={20} />}
          color={openAbsences === 0 ? 'text-mint-500' : 'text-amber-500'}
          bg={openAbsences === 0 ? 'bg-mint-50' : 'bg-amber-50'}
        />
      </div>

      {/* Assignment status breakdown */}
      {liveStats && totalAssignments > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            סטטוס שיבוצים היום
          </h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(liveStats.assignmentsToday).map(([status, count]) => (
              <StatusPill key={status} status={status} count={count} />
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="card p-5">
        <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          פעילות אחרונה
        </h3>
        <div className="space-y-1">
          {feed && feed.length > 0 ? (
            feed.map((event, i) => (
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
  };

  return (
    <div className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
      <div className={`mt-0.5 p-1.5 rounded-lg ${isAssignment ? 'bg-sky-50' : 'bg-red-50'}`}>
        {isAssignment ? (
          <ArrowLeftRight size={14} className="text-sky-500" />
        ) : (
          <AlertTriangle size={14} className="text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy-900">
          {isAssignment ? (
            <>
              <span className="font-semibold">{event.details.substitute}</span>
              {' '}{statusLabels[event.status] || event.status}{' '}
              ל<span className="font-medium">{event.details.kindergarten}</span>
            </>
          ) : (
            <>
              היעדרות של <span className="font-semibold">{event.details.employee}</span>
              {' '}ב<span className="font-medium">{event.details.kindergarten}</span>
              {event.details.reason && <span className="text-slate-400"> ({event.details.reason === 'sick' ? 'מחלה' : event.details.reason === 'vacation' ? 'חופשה' : event.details.reason})</span>}
            </>
          )}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{timeAgo}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        event.status === 'completed' || event.status === 'covered' ? 'bg-green-100 text-green-700' :
        event.status === 'cancelled' || event.status === 'uncovered' ? 'bg-red-100 text-red-700' :
        event.status === 'open' ? 'bg-amber-100 text-amber-700' :
        'bg-slate-100 text-slate-600'
      }`}>
        {statusLabels[event.status] || event.status}
      </span>
    </div>
  );
}
