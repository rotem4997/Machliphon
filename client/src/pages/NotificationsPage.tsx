import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2, Filter } from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
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
  assignment_request: 'bg-sky-100 text-sky-700 border-sky-200',
  assignment_confirmed: 'bg-mint-100 text-mint-700 border-mint-200',
  assignment_cancelled: 'bg-red-100 text-red-700 border-red-200',
  permit_expiring: 'bg-amber-100 text-amber-700 border-amber-200',
  uncovered_absence: 'bg-red-100 text-red-700 border-red-200',
  system: 'bg-slate-100 text-slate-600 border-slate-200',
};

const typeLabels: Record<string, string> = {
  assignment_request: 'שיבוץ חדש',
  assignment_confirmed: 'אושר',
  assignment_cancelled: 'בוטל',
  permit_expiring: 'תיק עובד',
  uncovered_absence: 'חוסר כיסוי',
  system: 'מערכת',
};

const filterOptions = [
  { value: '', label: 'הכל' },
  { value: 'assignment_request', label: 'שיבוצים' },
  { value: 'permit_expiring', label: 'תיקי עובד' },
  { value: 'uncovered_absence', label: 'חוסרים' },
  { value: 'system', label: 'מערכת' },
];

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications-page', typeFilter],
    queryFn: () =>
      api.get('/notifications', { params: typeFilter ? { type: typeFilter } : {} })
        .then(r => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('כל ההתראות סומנו כנקראות');
    },
  });

  const filtered = notifications
    ? showUnreadOnly ? notifications.filter(n => !n.is_read) : notifications
    : [];

  const unreadCount = notifications?.filter(n => !n.is_read).length ?? 0;

  return (
    <div className="space-y-5 fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">התראות</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} לא נקראו` : 'הכל נקרא'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <CheckCheck size={15} />
            סמן הכל כנקרא
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400" />
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === opt.value
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowUnreadOnly(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all mr-auto ${
            showUnreadOnly ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Bell size={12} />
          לא נקראו בלבד
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Bell size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">אין התראות</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-slate-50">
          {filtered.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50/50 ${
                !n.is_read ? 'bg-blue-50/20' : ''
              }`}
            >
              {/* Unread dot */}
              <div className="mt-2 flex-shrink-0">
                {!n.is_read
                  ? <div className="w-2 h-2 rounded-full bg-blue-500" />
                  : <div className="w-2 h-2 rounded-full bg-transparent" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    typeColors[n.type] ?? typeColors.system
                  }`}>
                    {typeLabels[n.type] ?? 'מערכת'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatDistanceToNow(parseISO(n.created_at), { locale: he, addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-navy-900 mb-0.5">{n.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!n.is_read && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-mint-500 transition-colors"
                    title="סמן כנקרא"
                  >
                    <Check size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
