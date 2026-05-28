import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle, X, AlertTriangle, Clock, Info,
  CheckCheck, Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import api, { handleApiError } from '@/utils/api';
import { useAuthStore } from '@/context/authStore';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────
type NotificationType =
  | 'assignment_request'
  | 'assignment_confirmed'
  | 'assignment_cancelled'
  | 'absence_uncovered'
  | 'permit_expiring'
  | 'general';

interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  assignment_request:   'שיבוץ חדש',
  assignment_confirmed: 'שיבוץ אושר',
  assignment_cancelled: 'שיבוץ בוטל',
  absence_uncovered:    'היעדרות ללא כיסוי',
  permit_expiring:      'תיק עובד פג',
  general:              'כללי',
};

const TYPE_ICON: Record<string, typeof Bell> = {
  assignment_request:   Bell,
  assignment_confirmed: CheckCircle,
  assignment_cancelled: X,
  absence_uncovered:    AlertTriangle,
  permit_expiring:      Clock,
  general:              Info,
};

const TYPE_ICON_COLOR: Record<string, string> = {
  assignment_request:   'text-sky-500',
  assignment_confirmed: 'text-mint-500',
  assignment_cancelled: 'text-red-400',
  absence_uncovered:    'text-amber-500',
  permit_expiring:      'text-orange-500',
  general:              'text-slate-400',
};

const TYPE_BG: Record<string, string> = {
  assignment_request:   'bg-sky-50',
  assignment_confirmed: 'bg-mint-50',
  assignment_cancelled: 'bg-red-50',
  absence_uncovered:    'bg-amber-50',
  permit_expiring:      'bg-orange-50',
  general:              'bg-slate-50',
};

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: 'demo-1',
    type: 'assignment_request',
    title: 'שיבוץ חדש זמין',
    message: 'גן חבצלת ב-09:00 מחפש מחליפה לתאריך 01/06/2026',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'demo-2',
    type: 'assignment_confirmed',
    title: 'שיבוץ אושר',
    message: 'שיבוצך לגן הדסה ביום שני אושר בהצלחה',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'demo-3',
    type: 'absence_uncovered',
    title: 'היעדרות ללא כיסוי',
    message: 'גן הדסה ביום ג\' 03/06 עדיין ללא כיסוי',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'demo-4',
    type: 'permit_expiring',
    title: 'תיק עובד פג תוקף',
    message: 'תיק המחליפה רחל לוי פג תוקף בעוד 7 ימים',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: 'demo-5',
    type: 'general',
    title: 'עדכון מערכת',
    message: 'המערכת תעבור תחזוקה ביום שישי 06/06 בין 22:00-23:00',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
];

const ALL_FILTER = 'all';

// ─── Skeleton Card ────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-2/5" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/4" />
        </div>
        <div className="w-2 h-2 rounded-full bg-slate-200 mt-2 flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { isDemoMode } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);

  // Fetch all notifications (optional type filter passed to API)
  const { data: notifications = [], isLoading, isError } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<Notification[]>('/notifications')
        .then(r => r.data)
        .catch(() => isDemoMode ? DEMO_NOTIFICATIONS : []),
    staleTime: 30_000,
  });

  const { data: unreadCountData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      api.get<{ count: number }>('/notifications/unread-count')
        .then(r => r.data)
        .catch(() => ({ count: notifications.filter(n => !n.is_read).length })),
    staleTime: 30_000,
  });

  const unreadCount = unreadCountData?.count ?? notifications.filter(n => !n.is_read).length;
  const allUnread = notifications.filter(n => !n.is_read).length;

  const markOneRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
    onError: (err) => handleApiError(err, 'PATCH /api/notifications/:id/read'),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('כל ההתראות סומנו כנקראו');
    },
    onError: (err) => handleApiError(err, 'POST /api/notifications/mark-all-read'),
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read && !notification.id.startsWith('demo-')) {
      markOneRead.mutate(notification.id);
    }
  };

  // Filter notifications by selected type tab
  const filtered = activeFilter === ALL_FILTER
    ? notifications
    : notifications.filter(n => n.type === activeFilter);

  // Tab counts
  const countForType = (type: string) =>
    notifications.filter(n => n.type === type).length;

  const tabs = [
    { key: ALL_FILTER, label: 'הכל', count: notifications.length },
    ...Object.entries(TYPE_LABELS).map(([key, label]) => ({
      key,
      label,
      count: countForType(key),
    })),
  ];

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">שגיאה בטעינת ההתראות</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
          className="btn-secondary mt-3 text-sm"
        >
          נסה שנית
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-navy-900">התראות</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => markAllRead.mutate()}
          disabled={allUnread === 0 || markAllRead.isPending}
          className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {markAllRead.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <CheckCheck size={14} />
          }
          סמן הכל כנקרא
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              activeFilter === tab.key
                ? 'bg-navy-900 text-white border-navy-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:text-navy-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                activeFilter === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length > 0 ? (
          filtered.map(notification => {
            const TypeIcon = TYPE_ICON[notification.type] ?? Bell;
            const iconColor = TYPE_ICON_COLOR[notification.type] ?? 'text-slate-400';
            const iconBg = TYPE_BG[notification.type] ?? 'bg-slate-50';
            const typeLabel = TYPE_LABELS[notification.type] ?? notification.type;

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`card w-full p-4 text-right hover:shadow-md transition-shadow cursor-pointer ${
                  !notification.is_read ? 'border-r-4 border-r-mint-400' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Type icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full ${iconBg} flex items-center justify-center`}>
                    <TypeIcon size={18} className={iconColor} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span
                        className={`text-sm leading-snug ${
                          notification.is_read
                            ? 'text-slate-700 font-normal'
                            : 'text-navy-900 font-bold'
                        }`}
                      >
                        {notification.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                        {typeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: he,
                      })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  <div className="flex-shrink-0 mt-2">
                    {!notification.is_read ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-mint-500 block" />
                    ) : (
                      <span className="w-2.5 h-2.5 block" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="card p-12 text-center">
            <Bell size={40} className="text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-slate-500 font-medium">אין התראות</p>
            {activeFilter !== ALL_FILTER && (
              <button
                onClick={() => setActiveFilter(ALL_FILTER)}
                className="text-mint-600 hover:text-mint-700 text-sm font-medium mt-2"
              >
                הצג את כל ההתראות
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
