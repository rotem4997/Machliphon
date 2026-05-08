import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download, FileText, Clock, CheckCircle, BarChart3,
} from 'lucide-react';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ExportRecord {
  id: string;
  export_month: number;
  export_year: number;
  assignments_count: number;
  total_hours: string;
  file_name: string | null;
  exported_at: string;
  exported_by_name: string;
}

interface MonthSummary {
  total: number;
  completed: number;
  hours: number;
  pay: number;
}

export default function MadganetExportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);

  const { data: history, refetch: refetchHistory } = useQuery<ExportRecord[]>({
    queryKey: ['madganet-history'],
    queryFn: () => api.get('/madganet/exports').then(r => r.data).catch(() => []),
  });

  const { data: summary } = useQuery<MonthSummary>({
    queryKey: ['madganet-summary', month, year],
    queryFn: () =>
      api.get('/assignments', { params: { month, year } })
        .then(r => {
          const rows = r.data as { status: string; hours_worked: string | null; total_pay: string | null }[];
          const done = rows.filter(a => a.status === 'completed');
          return {
            total: rows.length,
            completed: done.length,
            hours: done.reduce((s, a) => s + parseFloat(a.hours_worked || '0'), 0),
            pay: done.reduce((s, a) => s + parseFloat(a.total_pay || '0'), 0),
          };
        })
        .catch(() => ({ total: 0, completed: 0, hours: 0, pay: 0 })),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/assignments/export/csv', {
        params: { month, year },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `madganet_${year}_${String(month).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`קובץ מדגנט לחודש ${format(new Date(year, month - 1), 'MMMM yyyy', { locale: he })} הורד בהצלחה`);
      refetchHistory();
    } catch {
      toast.error('שגיאה בייצוא הקובץ — ודאו שיש שיבוצים מושלמים לחודש זה');
    } finally {
      setExporting(false);
    }
  };

  const monthName = (m: number, y: number) =>
    format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: he });

  return (
    <div className="space-y-6 fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-navy-900">ייצוא למדגנט</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          הפקת קבצי CSV לדיווח שעות למערכת מדגנט
        </p>
      </div>

      {/* Period selector + export */}
      <div className="card p-6">
        <h2 className="font-bold text-navy-900 mb-4">בחר תקופה לייצוא</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">חודש</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input py-2.5 text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2024, i, 1), 'MMMM', { locale: he })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">שנה</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input py-2.5 text-sm">
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'מייצא...' : 'ייצא CSV'}
          </button>
        </div>

        {/* Month summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
            <div className="text-center">
              <p className="text-xl font-black text-navy-900">{summary.total}</p>
              <p className="text-xs text-slate-500 mt-0.5">סה"כ שיבוצים</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-mint-500">{summary.completed}</p>
              <p className="text-xs text-slate-500 mt-0.5">הושלמו</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-sky-500">{summary.hours.toFixed(1)}</p>
              <p className="text-xs text-slate-500 mt-0.5">שעות עבודה</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-violet-500">
                {summary.pay > 0 ? `₪${Math.round(summary.pay).toLocaleString()}` : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">סה"כ לתשלום</p>
            </div>
          </div>
        )}
      </div>

      {/* CSV format explanation */}
      <div className="card p-5 bg-slate-50 border border-slate-200">
        <h3 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
          <FileText size={15} className="text-slate-500" />
          מבנה קובץ מדגנט
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['תעודת זהות', 'שם מלא', 'גן ילדים', 'כתובת', 'תאריך', 'שעת התחלה', 'שעת סיום', 'שעות', 'תעריף לשעה', 'סה"כ לתשלום'].map(col => (
            <div key={col} className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 font-medium">
              {col}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          * הקובץ כולל רק שיבוצים עם סטטוס "הושלם" עם שעות עבודה מוזנות. הפורמט: UTF-8 עם BOM לתאימות Excel.
        </p>
      </div>

      {/* Export history */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h3 className="font-bold text-navy-900">היסטוריית ייצואים</h3>
        </div>
        {!history || history.length === 0 ? (
          <div className="py-12 text-center">
            <BarChart3 size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">אין ייצואים קודמים</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {history.map(rec => (
              <div key={rec.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50">
                <div className="w-9 h-9 rounded-xl bg-mint-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={18} className="text-mint-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-900">
                    {monthName(rec.export_month, rec.export_year)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rec.assignments_count} שיבוצים •{' '}
                    {format(new Date(rec.exported_at), 'dd/MM/yyyy HH:mm')}
                    {rec.exported_by_name && ` • ${rec.exported_by_name}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMonth(rec.export_month);
                    setYear(rec.export_year);
                    setTimeout(handleExport, 100);
                  }}
                  className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 flex-shrink-0"
                >
                  <Download size={13} />
                  הורד שוב
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
