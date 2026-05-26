import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { Absence, Assignment } from '../../lib/types';
import { Layout } from '../../components/Layout';

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

interface AbsenceWithAssignment extends Absence {
  assignment?: Assignment;
}

export function SubstituteDashboard() {
  const qc = useQueryClient();

  const { data: openAbsences = [], isLoading: loadingOpen } = useQuery<
    Absence[]
  >({
    queryKey: ['absences', 'open'],
    queryFn: () => api.get<Absence[]>('/api/absences'),
  });

  const { data: myAssignments = [], isLoading: loadingMine } = useQuery<
    AbsenceWithAssignment[]
  >({
    queryKey: ['assignments', 'mine'],
    queryFn: () => api.get<AbsenceWithAssignment[]>('/api/assignments/mine'),
  });

  const claimMutation = useMutation({
    mutationFn: (absenceId: string) =>
      api.post(`/api/assignments/claim/${absenceId}`, {}),
    onSuccess: () => {
      toast.success('תפסת את המשמרת!');
      qc.invalidateQueries({ queryKey: ['absences'] });
      qc.invalidateQueries({ queryKey: ['assignments', 'mine'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'שגיאה בתפיסת המשמרת');
    },
  });

  const available = openAbsences.filter((a) => a.status === 'open');

  return (
    <Layout>
      <div className="space-y-8 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-navy">משמרות פתוחות</h1>
          <Link
            to="/availability"
            className="text-sm text-mint font-medium hover:underline"
          >
            הזמינות שלי
          </Link>
        </div>

        {loadingOpen ? (
          <p className="text-gray-400 text-center py-10">טוען...</p>
        ) : available.length === 0 ? (
          <p className="text-gray-400 text-center py-10">אין משמרות פתוחות</p>
        ) : (
          <div className="space-y-3">
            {available.map((absence) => (
              <div
                key={absence.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {absence.kindergarten_name}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(absence.date)}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
                    פתוחה
                  </span>
                </div>

                {absence.notes && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    {absence.notes}
                  </p>
                )}

                <button
                  onClick={() => claimMutation.mutate(absence.id)}
                  disabled={claimMutation.isPending}
                  className="w-full bg-mint text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-mint/90 transition-colors disabled:opacity-60"
                >
                  {claimMutation.isPending ? 'שומר...' : 'תפסי משמרת'}
                </button>
              </div>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-navy">המשמרות שלי</h2>

          {loadingMine ? (
            <p className="text-gray-400 text-sm">טוען...</p>
          ) : myAssignments.length === 0 ? (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          ) : (
            <div className="space-y-3">
              {myAssignments.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.kindergarten_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatDate(item.date)}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                      שובצת
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-gray-600 mt-2">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
