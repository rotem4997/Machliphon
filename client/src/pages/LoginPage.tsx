import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';
import axios from 'axios';
import type { UserRole } from '../context/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [waking, setWaking] = useState(false);
  const { login, loginDemo, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState<UserRole | null>(null);
  const retryToastRef = useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error: unknown) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status && status >= 500) {
        // Render free-tier cold start — server is waking up, retry automatically
        setWaking(true);
        if (retryToastRef.current) toast.dismiss(retryToastRef.current);
        retryToastRef.current = toast.loading('השרת מתעורר, ננסה שנית בעוד כמה שניות...', { duration: Infinity });
        setTimeout(async () => {
          try {
            await login(email, password);
            toast.dismiss(retryToastRef.current!);
            navigate('/dashboard');
          } catch (retryErr: unknown) {
            toast.dismiss(retryToastRef.current!);
            const raw = (retryErr as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
            const msg = typeof raw === 'string' ? raw : 'שגיאת שרת. נסה שנית.';
            toast.error(msg);
          } finally {
            setWaking(false);
          }
        }, 8000);
        return;
      }
      const raw = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      const msg = typeof raw === 'string' ? raw : 'שגיאה בכניסה. נסה שנית.';
      toast.error(msg);
    }
  };

  // Quick demo logins — bypass API entirely
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
      const msg = err instanceof Error ? err.message : 'שגיאה בכניסת דמו';
      toast.error(msg);
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-mint-500 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-sky-500 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size={64} className="mx-auto shadow-lg" />
          <h1 className="text-3xl font-black text-white tracking-tight">מחליפון</h1>
          <p className="text-navy-300 mt-1 font-medium">ניהול חכם של מחליפות בגני ילדים</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-navy-900 mb-6">כניסה למערכת</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
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
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-12"
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
              disabled={isLoading || waking}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              {isLoading || waking ? (
                <><Loader2 size={18} className="animate-spin" /> {waking ? 'מתחבר לשרת...' : 'מתחבר...'}</>
              ) : (
                'כניסה'
              )}
            </button>
          </form>

          {/* Forgot password */}
          <div className="mt-3 text-center">
            <Link to="/forgot-password" className="text-xs text-sky-500 hover:text-sky-700">שכחתי סיסמה</Link>
          </div>

          {/* Demo accounts */}
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
