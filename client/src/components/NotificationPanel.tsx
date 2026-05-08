import { X, Bell, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import api from '@/utils/api';
import { useAuthStore } from '@/context/authStore';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  related_id?: string;
}

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: 'n-1',
    type: 'assignment',
    title: 'שיבוץ חדש',
    body: 'שובצת לגן חבצלת ב-09:00',
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'n-2',
    type: 'info',
    title: 'ברוכה הבאה למחליפון',
    body: 'המערכת מוכנה לשימוש',
    is_read: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const queryClient = useQueryClient();
  const { isDemoMode } = useAuthStore();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<Notification[]>('/notifications')
        .then(r => r.data)
        .catch(() => isDemoMode ? DEMO_NOTIFICATIONS : []),
    staleTime: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      toast.success('כל ההתראות סומנו כנקראו');
    },
    onError: () => {
      toast.error('שגיאה בסימון ההתראות');
    },
  });

  const markOneRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read && !notification.id.startsWith('n-')) {
      markOneRead.mutate(notification.id);
    }
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from the left (visual right in RTL) */}
      <div
        className="fixed top-0 left-0 bottom-0 z-50 w-80 bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-label="התראות"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-navy-900">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-mint-400" />
            <h2 className="text-white font-bold text-base">התראות</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-xs text-mint-400 hover:text-mint-300 disabled:opacity-50 transition-colors"
                title="סמן הכל כנקרא"
              >
                <CheckCheck size={15} />
                <span>סמן הכל כנקרא</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-navy-400 hover:text-white transition-colors p-1 rounded"
              aria-label="סגור"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-16">
              <Bell size={40} strokeWidth={1.5} />
              <p className="text-sm font-medium">אין התראות</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map(notification => (
                <li key={notification.id}>
                  <button
                    className={`w-full text-right px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 items-start ${
                      !notification.is_read ? 'bg-mint-100/60' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Unread dot */}
                    <span
                      className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${
                        notification.is_read ? 'bg-transparent' : 'bg-mint-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          notification.is_read
                            ? 'text-slate-600 font-normal'
                            : 'text-navy-900 font-semibold'
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {notification.body}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: he,
                        })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
