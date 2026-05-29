import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertTriangle, WifiOff, ServerCrash, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';
import axios from 'axios';
import type { UserRole } from '../context/authStore';

type LoginErrorKind = 'credentials' | 'server' | 'network' | 'waking';

interface LoginError {
  kind: LoginErrorKind;
  message: string;
}

function classifyLoginError(err: unknown): LoginError {
  if (!axios.isAxiosError(err)) {
    return { kind: 'network', message: 'אין חיבור לשרת. בדוק את חיבור האינטרנט.' };
  }
  if (!err.response) {
    return { kind: 'network', message: 'לא ניתן להגיע לשרת. בדוק את חיבור האינטרנט.' };
  }
  const status = err.response.status;
  const serverMsg = typeof err.response.data?.error === 'string' ? err.response.data.error : null;

  if (status === 401 || status === 403) {
    return { kind: 'credentials', message: serverMsg || 'אימייל או סיסמה שגויים.' };
  }
  if (status === 429) {
    return { kind: 'server', message: 'יותר מדי ניסיונות כניסה. נסה שנית בעוד מספר דקות.' };
  }
  if (status >= 500) {
    return { kind: 'waking', message: serverMsg || 'השרת אינו זמין כרגע. ננסה להתחבר שוב...' };
  }
  return { kind: 'server', message: serverMsg || 'שגיאה בכניסה. נסה שנית.' };
}

const errorIcons: Record<LoginErrorKind, React.ReactNode> = {
  credentials: <AlertTriangle size={16} className="flex-shrink-0" />,
  server:      <ServerCrash  size={16} className="flex-shrink-0" />,
  network:     <WifiOff      size={16} className="flex-shrink-0" />,
  waking:      <RefreshCw    size={16} className="flex-shrink-0 animate-spin" />,
};

const errorStyles: Record<LoginErrorKind, string> = {
  credentials: 'bg-red-50 border-red-200 text-red-700',
  server:      'bg-orange-50 border-orange-200 text-orange-700',
  network:     'bg-slate-50 border-slate-200 text-slate-600',
  waking:      'bg-amber-50 border-amber-200 text-amber-700',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<LoginError | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const { login, loginDemo, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState<UserRole | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearError = () => setLoginError(null);

  const startRetryCountdown = (seconds: number, onFire: () => void) => {
    setRetryCountdown(seconds);
    let remaining = seconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setRetryCountdown(null);
        onFire();
      } else {
        setRetryCountdown(remaining);
      }
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (countdownRef.current) { clearInterval(countdownRef.current); setRetryCountdown(null); }

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error: unknown) {
      const classified = classifyLoginError(error);
      if (classified.kind === 'waking') {
        setLoginError({ kind: 'waking', message: 'השרת מתעורר משינה... ננסה שנית בעוד 10 שניות.' });
        startRetryCountdown(10, async () => {
          setLoginError({ kind: 'waking', message: 'מנסה להתחבר שנית...' });
          try {
            await login(email, password);
            navigate('/dashboard');
          } catch (retryErr: unknown) {
            setLoginError(classifyLoginError(retryErr));
          }
        });
        return;
      }
      setLoginError(classified);
    }
  };

  const isSubmitting = isLoading || retryCountdown !== null;

  const demoLogins: { label: string; role: 'authority_admin' | 'manager' | 'substitute'; color: string }[] = [
    { label: 'מנהל רשות', role: 'authority_admin', color: 'bg-navy-900' },
    { label: 'מדריכה',    role: 'manager',          color: 'bg-sky-500'  },
    { label: 'מחליפה',    role: 'substitute',        color: 'bg-mint-500' },
  ];

  const handleDemoLogin = async (role: 'authority_admin' | 'manager' | 'substitute') => {
    setDemoLoading(role);
    try {
      await loginDemo(role);
      navigate('/dashboard');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בכניסת דמו');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-mint-500 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-sky-500 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size={64} className="mx-auto shadow-lg" />
          <h1 className="text-3xl font-black text-white tracking-tight">מחליפון</h1>
          <p className="text-navy-300 mt-1 font-medium">ניהול חכם של מחליפות בגני ילדים</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-navy-900 mb-6">כניסה למערכת</h2>

          {/* Inline error banner */}
          {loginError && (
            <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm mb-5 ${errorStyles[loginError.kind]}`}>
              {errorIcons[loginError.kind]}
              <div className="flex-1">
                <p className="font-medium">{loginError.message}</p>
                {loginError.kind === 'waking' && retryCountdown !== null && (
                  <p className="text-xs mt-0.5 opacity-75">ניסיון אוטומטי בעוד {retryCountdown} שניות</p>
                )}
                {loginError.kind === 'network' && (
                  <p className="text-xs mt-0.5 opacity-75">ניתן לנסות כניסה לדמו ללא חיבור לשרת</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError(); }}
                className={`input ${loginError?.kind === 'credentials' ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                placeholder="your@email.com"
                required
                autoFocus
                dir="ltr"
              />
            </div>

            <div>
              <label className="label">סיסמה</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  className={`input pl-12 ${loginError?.kind === 'credentials' ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {retryCountdown !== null ? `מנסה שנית בעוד ${retryCountdown}...` : 'מתחבר...'}
                </>
              ) : (
                'כניסה'
              )}
            </button>
          </form>

          <div className="mt-3 text-center">
            <Link to="/forgot-password" className="text-xs text-sky-500 hover:text-sky-700">שכחתי סיסמה</Link>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3 text-center">כניסה מהירה לדמו — עובד גם ללא מסד נתונים</p>
            <div className="grid grid-cols-3 gap-2">
              {demoLogins.map(d => (
                <button
                  key={d.role}
                  onClick={() => handleDemoLogin(d.role)}
                  disabled={!!demoLoading || isLoading}
                  className={`${d.color} text-white text-xs font-medium py-2 px-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-1 disabled:opacity-60`}
                >
                  {demoLoading === d.role && <Loader2 size={10} className="animate-spin" />}
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-navy-400 text-sm mt-6">
          מחליפון © 2025 — כל הזכויות שמורות
        </p>
      </div>
    </div>
  );
}
