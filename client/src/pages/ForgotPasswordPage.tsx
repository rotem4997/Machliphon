import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';
import toast from 'react-hot-toast';
import Logo from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [resetToken, setResetToken] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const forgotMutation = useMutation({
    mutationFn: () => api.post('/auth/forgot-password', { email }),
    onSuccess: (res) => {
      toast.success('קישור איפוס נשלח (בסביבת פיתוח — הטוקן מוצג למטה)');
      if (res.data.resetToken) {
        setResetToken(res.data.resetToken);
        setStep('reset');
      }
    },
    onError: () => toast.error('שגיאה בשליחת בקשת האיפוס'),
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post('/auth/reset-password', { resetToken, newPassword: newPwd }),
    onSuccess: () => {
      toast.success('הסיסמה אופסה בהצלחה! כעת תוכל להתחבר.');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'שגיאה באיפוס הסיסמה'),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-sky-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">איפוס סיסמה</h1>
          <p className="text-navy-200 mt-1 text-sm">מחליפון — מערכת ניהול מחליפות</p>
        </div>

        <div className="card p-8 space-y-5">
          {step === 'email' ? (
            <>
              <div className="flex items-center justify-center mb-2">
                <div className="w-14 h-14 rounded-full bg-mint-50 flex items-center justify-center">
                  <Lock size={24} className="text-mint-600" />
                </div>
              </div>
              <p className="text-sm text-slate-600 text-center">הכניסי את כתובת האימייל שלך ונשלח לך קישור לאיפוס.</p>

              <div>
                <label className="label">כתובת אימייל</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={e => e.key === 'Enter' && forgotMutation.mutate()}
                />
              </div>

              <button
                onClick={() => forgotMutation.mutate()}
                disabled={!email || forgotMutation.isPending}
                className="btn-primary w-full disabled:opacity-50"
              >
                {forgotMutation.isPending ? 'שולח...' : 'שלח קישור איפוס'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 text-center">הכניסי את הסיסמה החדשה שלך.</p>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                🔧 סביבת פיתוח — טוקן איפוס: <code className="text-xs break-all">{resetToken.substring(0, 40)}...</code>
              </p>

              <div>
                <label className="label">סיסמה חדשה (לפחות 8 תווים)</label>
                <input className="input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
              <div>
                <label className="label">אימות סיסמה</label>
                <input className="input" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
              </div>
              {newPwd && confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-red-500">הסיסמאות אינן זהות</p>
              )}

              <button
                onClick={() => resetMutation.mutate()}
                disabled={!newPwd || newPwd.length < 8 || newPwd !== confirmPwd || resetMutation.isPending}
                className="btn-primary w-full disabled:opacity-50"
              >
                {resetMutation.isPending ? 'שומר...' : 'אפס סיסמה'}
              </button>
            </>
          )}

          <div className="text-center">
            <Link to="/login" className="text-sm text-sky-600 hover:text-sky-700 flex items-center justify-center gap-1">
              <ArrowRight size={14} />
              חזרה להתחברות
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
