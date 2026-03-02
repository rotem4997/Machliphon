import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Calendar, MapPin, Clock, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
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

export default function SubstituteDashboard() {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/substitutes/me').then(r => r.data),
  });

  const { data: todayAssignment } = useQuery<Assignment>({
    queryKey: ['today-assignment'],
    queryFn: async () => {
      const res = await api.get('/assignments', { params: { date: today } });
      return res.data[0] || null;
    },
  });

  const confirmAssignment = useMutation({
    mutationFn: (id: string) => api.patch(`/assignments/${id}/confirm`),
    onSuccess: () => {
      toast.success('✅ אישרת את השיבוץ!');
      queryClient.invalidateQueries({ queryKey: ['today-assignment'] });
    },
  });

  const markArrived = useMutation({
    mutationFn: (id: string) => api.patch(`/assignments/${id}/arrive`),
    onSuccess: () => {
      toast.success('👋 הגעתך אושרה!');
      queryClient.invalidateQueries({ queryKey: ['today-assignment'] });
    },
  });

  const setAvailability = useMutation({
    mutationFn: ({ date, available }: { date: string; available: boolean }) =>
      api.put('/substitutes/availability', { date, isAvailable: available }),
    onSuccess: (_, vars) => {
      toast.success(vars.available ? 'סומנת כזמינה' : 'סומנת כלא זמינה');
    },
  });

  const permitOk = profile?.work_permit_valid && 
    new Date(profile.work_permit_expiry) > new Date();

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'בוקר טוב' : greetingHour < 17 ? 'צהריים טובים' : 'ערב טוב';

  return (
    <div className="max-w-lg mx-auto space-y-5 fade-in">
      {/* Greeting */}
      <div className="text-center pt-2">
        <h1 className="text-xl font-bold text-navy-900">
          {greeting}, {profile?.first_name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {format(new Date(), 'EEEE, d בMMMM', { locale: he })}
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
      {todayAssignment ? (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-mint-500" />
            <h2 className="font-bold text-navy-900">שיבוץ להיום</h2>
          </div>
          
          <div className="bg-navy-900 rounded-xl p-5 text-white mb-4">
            <p className="text-mint-400 text-sm font-medium mb-1">גן ילדים</p>
            <p className="text-lg font-bold">{todayAssignment.kindergarten_name}</p>
            <div className="flex items-center gap-4 mt-3 text-navy-300 text-sm">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} />
                {todayAssignment.kindergarten_address}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                {todayAssignment.start_time} — {todayAssignment.end_time}
              </div>
            </div>
          </div>

          {/* Action buttons based on status */}
          {todayAssignment.status === 'pending' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => confirmAssignment.mutate(todayAssignment.id)}
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

          {todayAssignment.status === 'confirmed' && (
            <button
              onClick={() => markArrived.mutate(todayAssignment.id)}
              disabled={markArrived.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              <CheckCircle size={20} />
              הגעתי לגן ✓
            </button>
          )}

          {todayAssignment.status === 'arrived' && (
            <div className="bg-mint-100 rounded-xl p-4 text-center">
              <CheckCircle size={24} className="text-mint-500 mx-auto mb-2" />
              <p className="text-mint-700 font-semibold">הגעתך אושרה. עבודה טובה! 🌟</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-6 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Calendar size={28} className="text-slate-400" />
          </div>
          <p className="font-semibold text-navy-900">אין שיבוץ להיום</p>
          <p className="text-slate-500 text-sm mt-1">נעדכן אותך כשיהיה שיבוץ זמין</p>
        </div>
      )}

      {/* Quick availability for tomorrow */}
      <div className="card p-5">
        <h3 className="font-bold text-navy-900 mb-3">זמינות מחר</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAvailability.mutate({ date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'), available: true })}
            className="btn-secondary flex items-center justify-center gap-2 py-3 border-mint-200 text-mint-600 hover:bg-mint-50"
          >
            <CheckCircle size={18} />
            זמינה מחר
          </button>
          <button
            onClick={() => setAvailability.mutate({ date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'), available: false })}
            className="btn-secondary flex items-center justify-center gap-2 py-3 border-red-200 text-red-500 hover:bg-red-50"
          >
            <XCircle size={18} />
            לא זמינה
          </button>
        </div>
      </div>

      {/* Upcoming assignments */}
      {profile?.upcomingAssignments?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-3">שיבוצים קרובים</h3>
          <div className="space-y-2">
            {profile.upcomingAssignments.map((a: Assignment) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 px-3 bg-slate-50 rounded-xl">
                <div className="text-center bg-navy-900 rounded-lg px-2.5 py-1.5">
                  <p className="text-mint-400 text-xs font-bold">
                    {format(parseISO(a.assignment_date), 'EEE', { locale: he })}
                  </p>
                  <p className="text-white text-sm font-bold">
                    {format(parseISO(a.assignment_date), 'd/M')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy-900">{a.kindergarten_name}</p>
                  <p className="text-xs text-slate-500">{a.start_time} — {a.end_time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {profile && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-black text-navy-900">{profile.total_assignments}</p>
            <p className="text-xs text-slate-500 mt-0.5">שיבוצים סה"כ</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-black text-mint-500">{profile.rating?.toFixed(1) || '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">דירוג</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-black text-navy-900">{profile.years_experience}</p>
            <p className="text-xs text-slate-500 mt-0.5">שנות ניסיון</p>
          </div>
        </div>
      )}
    </div>
  );
}
