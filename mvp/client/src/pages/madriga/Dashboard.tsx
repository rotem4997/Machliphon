import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Absence, AbsenceStatus } from '../../lib/types';
import { Layout } from '../../components/Layout';
import { AbsenceForm } from './AbsenceForm';

const STATUS_LABEL: Record<AbsenceStatus, string> = {
  open: 'פתוחה',
  assigned: 'שובצה',
  cancelled: 'בוטלה',
};

const STATUS_CLASS: Record<AbsenceStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function MadrigaDashboard() {
  const [modalAbsence, setModalAbsence] = useState<Absence | null | 'new'>(
    null
  );

  const { data: absences = [], isLoading } = useQuery<Absence[]>({
    queryKey: ['absences'],
    queryFn: () => api.get<Absence[]>('/api/absences'),
  });

  const openModal = (absence: Absence | 'new') => setModalAbsence(absence);
  const closeModal = () => setModalAbsence(null);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-navy">ניהול היעדרויות</h1>
          <button
            onClick={() => openModal('new')}
            className="bg-mint text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-mint/90 transition-colors"
          >
            + היעדרות חדשה
          </button>
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-center py-16">טוען...</p>
        ) : absences.length === 0 ? (
          <p className="text-gray-400 text-center py-16">אין נתונים</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-right">
                  <th className="px-4 py-3 font-medium">גן</th>
                  <th className="px-4 py-3 font-medium">תאריך</th>
                  <th className="px-4 py-3 font-medium">סטטוס</th>
                  <th className="px-4 py-3 font-medium">הערות</th>
                  <th className="px-4 py-3 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {absences.map((absence) => (
                  <tr
                    key={absence.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {absence.kindergarten_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(absence.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[absence.status]}`}
                      >
                        {STATUS_LABEL[absence.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {absence.notes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openModal(absence)}
                        className="text-navy text-xs font-medium hover:underline"
                      >
                        עריכה
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbsence !== null && (
        <AbsenceForm
          absence={modalAbsence === 'new' ? null : modalAbsence}
          onClose={closeModal}
        />
      )}
    </Layout>
  );
}
