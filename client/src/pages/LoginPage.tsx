import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../context/authStore';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error: unknown) {
      const raw = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      const msg = typeof raw === 'string' ? raw : undefined;
      toast.error(msg || 'שגיאה בכניסה. נסה שנית.');
    }
  };

  // Quick demo logins
  const demoLogins = [
    { label: 'מנהל רשות', email: 'director@yokneam.muni.il', color: 'bg-navy-900' },
    { label: 'מדריכה', email: 'manager@yokneam.muni.il', color: 'bg-sky-500' },
    { label: 'מחליפה', email: 'miriam@example.com', color: 'bg-mint-500' },
  ];

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
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> מתחבר...</>
              ) : (
                'כניסה'
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3 text-center">כניסה מהירה לדמו (סיסמה: Demo1234!)</p>
            <div className="grid grid-cols-3 gap-2">
              {demoLogins.map(d => (
                <button
                  key={d.email}
                  onClick={() => { setEmail(d.email); setPassword('Demo1234!'); }}
                  className={`${d.color} text-white text-xs font-medium py-2 px-3 rounded-xl hover:opacity-90 transition-opacity`}
                >
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
