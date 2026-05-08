import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, AlertCircle, MapPin, Phone, Mail, User,
  Users, Building, CheckCircle, Clock, Calendar,
} from 'lucide-react';
import api from '@/utils/api';

interface KindergartenDetail {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  principal_name: string | null;
  phone: string | null;
  age_group: string | null;
  capacity: number | null;
  is_active: boolean;
  manager: {
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  recentAbsences: RecentAbsence[];
  assignmentStats: AssignmentStats;
}

interface RecentAbsence {
  id: string;
  employee_name: string;
  start_date: string;
  reason: string | null;
  status: string;
}

interface AssignmentStats {
  totalAssignments: number;
  completedThisMonth: number;
  pendingToday: number;
}

const ABSENCE_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'ממתין', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'אושר', cls: 'bg-blue-100 text-blue-700' },
  covered: { label: 'מכוסה', cls: 'bg-mint-100 text-mint-700' },
  uncovered: { label: 'לא מכוסה', cls: 'bg-red-100 text-red-600' },
  cancelled: { label: 'בוטל', cls: 'bg-slate-100 text-slate-500' },
};

export default function KindergartenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: kg, isLoading, isError } = useQuery<KindergartenDetail | null>({
    queryKey: ['kindergarten', id],
    queryFn: () => api.get(`/kindergartens/${id}`).then(r => r.data).catch(() => null),
    enabled: Boolean(id),
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('he-IL');

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-red-400" />
        <p>שגיאה בטעינת פרטי הגן. אנא נסה שנית.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="חזרה"
        >
          <ArrowRight size={18} className="text-slate-500 rtl:rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-7 w-48 skeleton rounded" />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-navy-900">{kg?.name}</h1>
              {kg && (
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    kg.is_active ? 'bg-mint-100 text-mint-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {kg.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
              )}
            </div>
          )}
          <p className="text-slate-500 text-sm mt-0.5">פרטי גן ילדים</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6 h-36 skeleton" />
          ))}
        </div>
      ) : kg ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatBox
              icon={Calendar}
              iconClass="text-navy-500"
              bgClass="bg-navy-50"
              value={kg.assignmentStats.totalAssignments}
              label="סה&quot;כ שיבוצים"
            />
            <StatBox
              icon={CheckCircle}
              iconClass="text-mint-600"
              bgClass="bg-mint-50"
              value={kg.assignmentStats.completedThisMonth}
              label="הושלמו החודש"
            />
            <StatBox
              icon={Clock}
              iconClass="text-amber-600"
              bgClass="bg-amber-50"
              value={kg.assignmentStats.pendingToday}
              label="ממתינים היום"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info card */}
            <div className="card p-5 space-y-0 divide-y divide-slate-100">
              <h2 className="font-bold text-navy-900 text-base pb-3 flex items-center gap-2">
                <Building size={16} className="text-slate-400" />
                פרטי הגן
              </h2>
              {kg.address && (
                <InfoRow icon={MapPin} label="כתובת" value={kg.address} />
              )}
              {kg.neighborhood && (
                <InfoRow icon={MapPin} label="שכונה" value={kg.neighborhood} />
              )}
              {kg.principal_name && (
                <InfoRow icon={User} label="מנהלת גן" value={kg.principal_name} />
              )}
              {kg.phone && (
                <InfoRow icon={Phone} label="טלפון" value={kg.phone} />
              )}
              {kg.age_group && (
                <InfoRow icon={Users} label="גיל" value={kg.age_group} />
              )}
              {kg.capacity != null && (
                <InfoRow icon={Users} label="קיבולת" value={String(kg.capacity)} />
              )}
            </div>

            {/* Manager card */}
            <div className="card p-5 space-y-0 divide-y divide-slate-100">
              <h2 className="font-bold text-navy-900 text-base pb-3 flex items-center gap-2">
                <User size={16} className="text-slate-400" />
                מנהלת אחראית
              </h2>
              {kg.manager ? (
                <>
                  <InfoRow
                    icon={User}
                    label="שם"
                    value={`${kg.manager.first_name} ${kg.manager.last_name}`}
                  />
                  {kg.manager.phone && (
                    <InfoRow icon={Phone} label="טלפון" value={kg.manager.phone} />
                  )}
                  {kg.manager.email && (
                    <InfoRow icon={Mail} label="אימייל" value={kg.manager.email} />
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">לא שויך מנהל</p>
              )}
            </div>
          </div>

          {/* Recent absences */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">היעדרויות אחרונות</h2>
              <p className="text-xs text-slate-400 mt-0.5">10 האחרונות</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3.5">עובד</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">תאריך</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5 hidden sm:table-cell">סיבה</th>
                    <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3.5">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {kg.recentAbsences.length > 0 ? (
                    kg.recentAbsences.map(absence => {
                      const meta = ABSENCE_STATUS_META[absence.status] ?? {
                        label: absence.status,
                        cls: 'bg-slate-100 text-slate-500',
                      };
                      return (
                        <tr key={absence.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-medium text-navy-900">
                            {absence.employee_name}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {formatDate(absence.start_date)}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-600 hidden sm:table-cell">
                            {absence.reason || '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-400">
                        אין היעדרויות אחרונות
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── helpers ── */

function StatBox({
  icon: Icon,
  iconClass,
  bgClass,
  value,
  label,
}: {
  icon: typeof Calendar;
  iconClass: string;
  bgClass: string;
  value: number;
  label: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center flex-shrink-0`}>
        <Icon size={22} className={iconClass} />
      </div>
      <div>
        <p className="text-2xl font-black text-navy-900">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5" dangerouslySetInnerHTML={{ __html: label }} />
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon size={15} className="text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-navy-900 truncate">{value}</p>
      </div>
    </div>
  );
}
