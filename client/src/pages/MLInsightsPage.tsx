import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain, TrendingUp, AlertTriangle, Star, Users,
  RefreshCw, CheckCircle, XCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import api, { handleApiError } from '@/utils/api';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────

interface ModelSummary {
  kind: string;
  training_samples: number;
  metric_name: string | null;
  metric_value: number | null;
  feature_names: string[];
  trained_at: string;
}

interface ModelsResponse {
  match: ModelSummary | null;
  no_show: ModelSummary | null;
  demand: ModelSummary | null;
}

interface Insights {
  topRated: { id: string; name: string; rating: number; total_assignments: number }[];
  atRisk: { id: string; name: string; no_shows: number; cancels: number; total: number }[];
  openAbsences: number;
}

interface ForecastPoint {
  date: string;
  expected: number;
  low: number;
  high: number;
}

interface ForecastResponse {
  kindergartenId: string;
  horizon: number;
  predictions: ForecastPoint[];
}

interface Kindergarten {
  id: string;
  name: string;
}

interface IntegrityFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  detail: string;
  count: number;
  sampleIds?: string[];
}

interface IntegrityReport {
  authorityId: string;
  generatedAt: string;
  ok: boolean;
  findings: IntegrityFinding[];
}

// ─── Helpers ─────────────────────────────────────────────────

function bandColor(score: number) {
  if (score >= 0.5) return 'text-red-600 bg-red-50';
  if (score >= 0.2) return 'text-amber-600 bg-amber-50';
  return 'text-emerald-600 bg-emerald-50';
}

function bandLabel(score: number) {
  if (score >= 0.5) return 'סיכון גבוה';
  if (score >= 0.2) return 'סיכון בינוני';
  return 'סיכון נמוך';
}

function metricLabel(kind: string) {
  if (kind === 'demand') return 'MAE';
  return 'AUC';
}

// ─── Model Card ──────────────────────────────────────────────

function ModelCard({ model, label }: { model: ModelSummary | null; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!model) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Brain size={20} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-400">לא אומן עדיין</p>
        </div>
      </div>
    );
  }

  const metricVal = model.metric_value != null
    ? model.metric_value.toFixed(3)
    : '—';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-mint-100 flex items-center justify-center">
            <Brain size={20} className="text-mint-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-500">
              {model.training_samples.toLocaleString()} דגימות ·{' '}
              {metricLabel(model.kind)} {metricVal}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-400 hover:text-slate-600"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        אומן: {format(new Date(model.trained_at), 'dd/MM/yyyy HH:mm', { locale: he })}
      </p>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-1">פיצ'רים:</p>
          <div className="flex flex-wrap gap-1">
            {model.feature_names.map(f => (
              <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function MLInsightsPage() {
  const qc = useQueryClient();
  const [selectedKg, setSelectedKg] = useState('');
  const [forecastDays, setForecastDays] = useState(14);

  const { data: models, isLoading: modelsLoading } = useQuery<ModelsResponse>({
    queryKey: ['ml-models'],
    queryFn: () => api.get('/api/ml/models').then(r => r.data),
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<Insights>({
    queryKey: ['ml-insights'],
    queryFn: () => api.get('/api/ml/insights').then(r => r.data),
  });

  const { data: kgs } = useQuery<Kindergarten[]>({
    queryKey: ['kindergartens-list'],
    queryFn: () => api.get('/api/kindergartens').then(r => r.data),
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery<ForecastResponse>({
    queryKey: ['ml-forecast', selectedKg, forecastDays],
    queryFn: () =>
      api
        .get('/api/ml/forecast', { params: { kindergartenId: selectedKg, days: forecastDays } })
        .then(r => r.data),
    enabled: !!selectedKg,
  });

  const { data: integrity, isLoading: integrityLoading } = useQuery<IntegrityReport>({
    queryKey: ['ml-integrity'],
    queryFn: () => api.get('/api/ml/integrity-report').then(r => r.data),
  });

  const trainMutation = useMutation({
    mutationFn: (kinds?: string[]) =>
      api.post('/api/ml/train', { kinds, force: true }).then(r => r.data),
    onSuccess: () => {
      toast.success('האימון הושלם בהצלחה');
      qc.invalidateQueries({ queryKey: ['ml-models'] });
      qc.invalidateQueries({ queryKey: ['ml-insights'] });
      qc.invalidateQueries({ queryKey: ['ml-forecast'] });
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const forecastChartData = forecast?.predictions.map(p => ({
    date: format(new Date(p.date), 'dd/MM', { locale: he }),
    צפוי: parseFloat(p.expected.toFixed(2)),
    נמוך: parseFloat(p.low.toFixed(2)),
    גבוה: parseFloat(p.high.toFixed(2)),
  })) ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy-900">תובנות AI</h1>
          <p className="text-slate-500 text-sm mt-1">
            מודלי למידת מכונה, חיזוי ביקוש, וסיכוני אי-הגעה
          </p>
        </div>
        <button
          onClick={() => trainMutation.mutate(undefined)}
          disabled={trainMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-mint-500 text-white rounded-xl font-medium text-sm
                     hover:bg-mint-600 disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={16} className={trainMutation.isPending ? 'animate-spin' : ''} />
          {trainMutation.isPending ? 'מאמן...' : 'אמן מחדש'}
        </button>
      </div>

      {/* Open absences banner */}
      {!insightsLoading && insights && (
        <div className={`rounded-2xl px-6 py-4 flex items-center gap-4 ${
          insights.openAbsences > 0
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-emerald-50 border border-emerald-200'
        }`}>
          <AlertTriangle size={22} className={insights.openAbsences > 0 ? 'text-amber-500' : 'text-emerald-500'} />
          <div>
            <p className="font-semibold text-slate-800">
              {insights.openAbsences > 0
                ? `${insights.openAbsences} היעדרויות פתוחות ממתינות לשיבוץ`
                : 'כל ההיעדרויות מטופלות'}
            </p>
          </div>
        </div>
      )}

      {/* Models */}
      <section>
        <h2 className="text-lg font-bold text-navy-900 mb-3 flex items-center gap-2">
          <Brain size={18} className="text-mint-500" />
          מצב מודלים
        </h2>
        {modelsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ModelCard model={models?.match ?? null} label="התאמת מחליפות" />
            <ModelCard model={models?.no_show ?? null} label="סיכון אי-הגעה" />
            <ModelCard model={models?.demand ?? null} label="חיזוי ביקוש" />
          </div>
        )}
      </section>

      {/* Integrity */}
      <section>
        <h2 className="text-lg font-bold text-navy-900 mb-3 flex items-center gap-2">
          <CheckCircle size={18} className="text-mint-500" />
          תקינות נתונים
        </h2>
        {integrityLoading ? (
          <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ) : integrity ? (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {integrity.findings.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-3">
                <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                <p className="text-sm font-medium text-slate-700">כל הבדיקות עברו בהצלחה</p>
              </div>
            ) : (
              integrity.findings.map(f => (
                <div key={f.code} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {f.severity === 'error'
                      ? <XCircle size={16} className="text-red-500 flex-shrink-0" />
                      : <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-slate-700">{f.message}</p>
                      <p className={`text-xs ${f.severity === 'error' ? 'text-red-500' : 'text-amber-600'}`}>
                        {f.detail}
                      </p>
                    </div>
                  </div>
                  {f.count > 0 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      f.severity === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {f.count}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      {/* Top-rated + At-risk substitutes */}
      {!insightsLoading && insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top rated */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
              <Star size={16} className="text-amber-400" />
              מחליפות מובילות
            </h2>
            {insights.topRated.length === 0 ? (
              <p className="text-slate-400 text-sm">אין נתונים עדיין</p>
            ) : (
              <ul className="space-y-3">
                {insights.topRated.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 font-bold text-xs
                                     flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{s.name}</span>
                    <span className="text-xs text-slate-400">{s.total_assignments} שיבוצים</span>
                    <span className="text-sm font-bold text-amber-500">
                      {s.rating != null ? s.rating.toFixed(1) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* At risk */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              מחליפות בסיכון (ביטולים גבוהים)
            </h2>
            {insights.atRisk.length === 0 ? (
              <p className="text-slate-400 text-sm">אין מחליפות בסיכון</p>
            ) : (
              <ul className="space-y-3">
                {insights.atRisk.map(s => {
                  const rate = s.total > 0 ? (s.no_shows + s.cancels) / s.total : 0;
                  return (
                    <li key={s.id} className="flex items-center gap-3">
                      <Users size={16} className="text-slate-400 flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-slate-700">{s.name}</span>
                      <span className="text-xs text-slate-400">{s.total} שיבוצים</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bandColor(rate)}`}>
                        {bandLabel(rate)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Demand forecast */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="font-bold text-navy-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-sky-500" />
            חיזוי ביקוש לגן
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={selectedKg}
              onChange={e => setSelectedKg(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 bg-white"
            >
              <option value="">בחר גן...</option>
              {kgs?.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <select
              value={forecastDays}
              onChange={e => setForecastDays(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 bg-white"
            >
              <option value={7}>7 ימים</option>
              <option value={14}>14 ימים</option>
              <option value={30}>30 ימים</option>
            </select>
          </div>
        </div>

        {!selectedKg ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            בחר גן ילדים לצפות בתחזית הביקוש
          </div>
        ) : forecastLoading ? (
          <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />
        ) : forecastChartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            אין נתוני תחזית
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecastChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#17C98A" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#17C98A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="גבוה"
                stroke="none"
                fill="#e0f9f1"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="נמוך"
                stroke="none"
                fill="#fff"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="צפוי"
                stroke="#17C98A"
                strokeWidth={2}
                fill="url(#gradExpected)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
