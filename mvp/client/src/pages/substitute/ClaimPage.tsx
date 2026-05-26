import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { Absence } from '../../lib/types';
import { Layout } from '../../components/Layout';

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'פתוחה',
  assigned: 'שובצה',
  cancelled: 'בוטלה',
};

export function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: absence, isLoading, isError } = useQuery<Absence>({
    queryKey: ['absences', id],
    queryFn: () => api.get<Absence>(`/api/absences/${id}`),
    enabled: !!id,
  });

  const claimMutation = useMutation({
    mutationFn: () => api.post(`/api/assignments/claim/${id}`, {}),
    onSuccess: () => {
      toast.success('תפסת את המשמרת בהצלחה!');
      qc.invalidateQueries({ queryKey: ['absences'] });
      qc.invalidateQueries({ queryKey: ['assignments', 'mine'] });
      navigate('/substitute', { replace: true });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'שגיאה בתפיסת המשמרת');
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-center py-20">טוען...</p>
      </Layout>
    );
  }

  if (isError || !absence) {
    return (
      <Layout>
        <div className="max-w-sm mx-auto text-center py-20 space-y-4">
          <p className="text-gray-600 font-medium">ההיעדרות לא נמצאה</p>
          <button
            onClick={() => navigate('/substitute', { replace: true })}
            className="text-mint text-sm hover:underline"
          >
            חזרה לדף הבית
          </button>
        </div>
      </Layout>
    );
  }

  const isTaken = absence.status !== 'open';

  return (
    <Layout>
      <div className="max-w-sm mx-auto space-y-6 py-8">
        <h1 className="text-xl font-bold text-navy text-center">פרטי משמרת</h1>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">גן ילדים</span>
            <span className="font-semibold text-gray-900">
              {absence.kindergarten_name}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">תאריך</span>
            <span className="font-semibold text-gray-900">
              {formatDate(absence.date)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">סטטוס</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                absence.status === 'open'
                  ? 'bg-yellow-100 text-yellow-800'
                  : absence.status === 'assigned'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABEL[absence.status] ?? absence.status}
            </span>
          </div>

          {absence.notes && (
            <div className="pt-1 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">הערות</p>
              <p className="text-sm text-gray-700">{absence.notes}</p>
            </div>
          )}
        </div>

        {isTaken ? (
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 text-center space-y-2">
            <p className="font-semibold text-gray-700">
              {absence.status === 'assigned'
                ? 'המשמרת כבר נתפסה'
                : 'המשמרת בוטלה'}
            </p>
            <p className="text-sm text-gray-500">
              {absence.status === 'assigned'
                ? 'מחליפה אחרת תפסה את המשמרת לפניך.'
                : 'המשמרת הזו אינה זמינה יותר.'}
            </p>
            <button
              onClick={() => navigate('/substitute', { replace: true })}
              className="mt-3 text-mint text-sm hover:underline"
            >
              חזרה למשמרות פתוחות
            </button>
          </div>
        ) : (
          <button
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            className="w-full bg-mint text-white rounded-xl py-3 font-semibold text-base hover:bg-mint/90 transition-colors disabled:opacity-60"
          >
            {claimMutation.isPending ? 'תופסת...' : 'תפסי משמרת'}
          </button>
        )}
      </div>
    </Layout>
  );
}
