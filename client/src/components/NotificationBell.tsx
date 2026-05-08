import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import api from '@/utils/api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const typeColors: Record<string, string> = {
  assignment_request: 'bg-sky-100 text-sky-700',
  assignment_confirmed: 'bg-mint-100 text-mint-700',
  assignment_cancelled: 'bg-red-100 text-red-700',
  permit_expiring: 'bg-amber-100 text-amber-700',
  uncovered_absence: 'bg-red-100 text-red-700',
  system: 'bg-slate-100 text-slate-600',
};

const typeLabels: Record<string, string> = {
  assignment_request: 'שיבוץ',
  assignment_confirmed: 'אושר',
  assignment_cancelled: 'בוטל',
  permit_expiring: 'תיק עובד',
  uncovered_absence: 'חוסר',
  system: 'מערכת',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    enabled: open,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const unread = countData?.count ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative text-slate-600 hover:text-navy-900 transition-colors p-1"
        aria-label={unread > 0 ? `התראות, ${unread} לא נקראו` : 'התראות'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-navy-900 text-sm">
              התראות {unread > 0 && <span className="text-red-500">({unread})</span>}
            </h3>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-xs text-slate-500 hover:text-navy-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50"
                >
                  <CheckCheck size={13} />
                  סמן הכל
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">אין התראות</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    !n.is_read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 whitespace-nowrap flex-shrink-0 ${
                    typeColors[n.type] ?? typeColors.system
                  }`}>
                    {typeLabels[n.type] ?? 'מערכת'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-navy-900 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatDistanceToNow(parseISO(n.created_at), { locale: he, addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-mint-500 flex-shrink-0"
                      title="סמן כנקרא"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
