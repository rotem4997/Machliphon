import { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Globe, Database, ChevronLeft, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/context/authStore';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/utils/api';

interface SettingRow {
  label: string;
  description: string;
  defaultValue: boolean;
}

const notificationSettings: SettingRow[] = [
  { label: 'התראה על היעדרות חדשה', description: 'קבלי התראה כאשר נוצרת היעדרות חדשה בגן שלך', defaultValue: true },
  { label: 'התראה על שיבוץ שאושר', description: 'קבלי התראה כאשר מחליפה מאשרת שיבוץ', defaultValue: true },
  { label: 'תזכורת בוקר', description: 'קבלי סיכום יומי בכל בוקר ב-07:00', defaultValue: false },
  { label: 'התראה על ביטול שיבוץ', description: 'קבלי התראה כאשר מחליפה מבטלת שיבוץ', defaultValue: true },
];

const systemSettings: SettingRow[] = [
  { label: 'שפת ממשק עברית', description: 'הצג את הממשק בעברית (RTL)', defaultValue: true },
  { label: 'מצב נגישות', description: 'הגדל גופנים ושפר ניגוד צבעים', defaultValue: false },
];

const PREF_KEYS: Record<string, string> = {
  'התראה על היעדרות חדשה': 'notif_new_absence',
  'התראה על שיבוץ שאושר': 'notif_assignment_confirmed',
  'תזכורת בוקר': 'notif_morning_summary',
  'התראה על ביטול שיבוץ': 'notif_assignment_cancelled',
  'שפת ממשק עברית': 'lang_hebrew',
  'מצב נגישות': 'accessibility_mode',
};

const PREF_DEFAULTS: Record<string, boolean> = {
  notif_new_absence: true,
  notif_assignment_confirmed: true,
  notif_morning_summary: false,
  notif_assignment_cancelled: true,
  lang_hebrew: true,
  accessibility_mode: false,
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        on ? 'bg-mint-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          on ? '-translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function SettingSection({
  title, icon, rows, values, onChange,
}: {
  title: string;
  icon: React.ReactNode;
  rows: SettingRow[];
  values: Record<string, boolean>;
  onChange: (label: string, v: boolean) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <span className="text-navy-600">{icon}</span>
        <h2 className="font-bold text-navy-900 text-sm">{title}</h2>
      </div>
      <ul className="divide-y divide-slate-50">
        {rows.map(row => (
          <li key={row.label} className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-900">{row.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>
            </div>
            <Toggle
              on={values[row.label] ?? row.defaultValue}
              onChange={v => onChange(row.label, v)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isDemoMode } = useAuthStore();

  const queryClient = useQueryClient();

  const { data: savedPrefs, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: !isDemoMode,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('הגדרות נשמרו');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error('שגיאה בשמירת ההגדרות'),
  });

  const buildFromPrefs = (rows: SettingRow[]) =>
    Object.fromEntries(
      rows.map(r => [r.label, savedPrefs?.[PREF_KEYS[r.label]] ?? r.defaultValue])
    );

  const [notifValues, setNotifValues] = useState<Record<string, boolean>>({});
  const [sysValues, setSysValues] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  // Sync local state when prefs load from API
  useEffect(() => {
    setNotifValues(buildFromPrefs(notificationSettings));
    setSysValues(buildFromPrefs(systemSettings));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPrefs]);

  const handleSave = () => {
    if (isDemoMode) {
      toast('הגדרות נשמרו (מצב דמו — לא נשמרות בשרת)', { icon: '⚠️' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return;
    }
    const allPrefs: Record<string, boolean> = {};
    [...notificationSettings, ...systemSettings].forEach(row => {
      const key = PREF_KEYS[row.label];
      const val = row.label in notifValues ? notifValues[row.label] : sysValues[row.label];
      if (key) allPrefs[key] = val ?? PREF_DEFAULTS[key];
    });
    mutation.mutate(allPrefs);
  };

  const isAdmin = user?.role === 'authority_admin' || user?.role === 'super_admin';

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-black text-navy-900 flex items-center gap-2">
          <Settings size={24} className="text-navy-600" />
          הגדרות
        </h1>
        <p className="text-slate-500 text-sm mt-1">התאמה אישית של המערכת</p>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-slate-400 text-sm">טוען הגדרות...</div>
      )}

      {!isLoading && (
        <>
          {/* Authority info (admin only) */}
          {isAdmin && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <Database size={18} className="text-navy-600" />
                <h2 className="font-bold text-navy-900 text-sm">פרטי הרשות</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">שם הרשות</p>
                  <p className="font-medium text-navy-900">{user?.authorityName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">תפקיד</p>
                  <p className="font-medium text-navy-900">
                    {user?.role === 'authority_admin' ? 'מנהל רשות' : 'מנהל ראשי'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">אימייל</p>
                  <p className="font-medium text-navy-900 dir-ltr">{user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">מזהה משתמש</p>
                  <p className="font-mono text-xs text-slate-500 truncate">{user?.id}</p>
                </div>
              </div>
            </div>
          )}

          <SettingSection
            title="התראות"
            icon={<Bell size={18} />}
            rows={notificationSettings}
            values={notifValues}
            onChange={(label, v) => setNotifValues(prev => ({ ...prev, [label]: v }))}
          />

          <SettingSection
            title="מערכת"
            icon={<Globe size={18} />}
            rows={systemSettings}
            values={sysValues}
            onChange={(label, v) => setSysValues(prev => ({ ...prev, [label]: v }))}
          />

          {/* Security section */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <Shield size={18} className="text-navy-600" />
              <h2 className="font-bold text-navy-900 text-sm">אבטחה</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <a
                href="/profile"
                className="flex items-center justify-between text-sm text-navy-700 hover:text-mint-600 transition-colors"
              >
                <span>שינוי סיסמה</span>
                <ChevronLeft size={16} className="text-slate-400" />
              </a>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">פרוטוקול אבטחה</span>
                <span className="flex items-center gap-1 text-mint-600 font-medium text-xs">
                  <CheckCircle size={14} />
                  JWT + HTTPS
                </span>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className={`btn-primary flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${saved ? 'bg-mint-600' : ''}`}
            >
              {mutation.isPending ? 'שומר...' : saved ? <><CheckCircle size={16} /> נשמר!</> : 'שמור הגדרות'}
            </button>
          </div>
        </>
      )}

      <p className="text-center text-xs text-slate-400 pb-4">
        מחליפון {new Date().getFullYear()} — גרסה 1.0.0-mvp
      </p>
    </div>
  );
}
