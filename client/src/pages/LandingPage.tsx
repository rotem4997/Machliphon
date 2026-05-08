import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Bell,
  BarChart3,
  Brain,
  Shield,
  Users,
  LayoutDashboard,
  ClipboardList,
  Calendar,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import Logo from '../components/Logo';

// ─── Feature cards data ───────────────────────────────────────────────────────
const features = [
  {
    icon: CalendarCheck,
    title: 'שיבוץ מהיר',
    description: 'שיבוץ מחליפה תוך דקות, לא שעות',
    accent: 'text-mint-500',
    bg: 'bg-mint-100',
  },
  {
    icon: Bell,
    title: 'התראות אוטומטיות',
    description: 'SMS ואימייל לכל שינוי בשיבוץ',
    accent: 'text-sky-500',
    bg: 'bg-blue-50',
  },
  {
    icon: BarChart3,
    title: 'דוחות ותובנות',
    description: 'נתוני היעדרות, כיסוי וביצועים בזמן אמת',
    accent: 'text-mint-500',
    bg: 'bg-mint-100',
  },
  {
    icon: Brain,
    title: 'בינה מלאכותית',
    description: 'המלצות חכמות למחליפה המתאימה ביותר',
    accent: 'text-sky-500',
    bg: 'bg-blue-50',
  },
  {
    icon: Shield,
    title: 'אבטחה ופרטיות',
    description: 'עמידה בדרישות משרד החינוך',
    accent: 'text-mint-500',
    bg: 'bg-mint-100',
  },
  {
    icon: Users,
    title: 'ניהול צוות',
    description: 'ממשק נפרד לגננות, מנהלות ומחליפות',
    accent: 'text-sky-500',
    bg: 'bg-blue-50',
  },
] as const;

// ─── How it works steps ───────────────────────────────────────────────────────
const steps = [
  {
    number: '1',
    title: 'דיווח היעדרות',
    description: 'הגננת מדווחת על היעדרות בלחיצה אחת דרך הממשק הנוח',
  },
  {
    number: '2',
    title: 'המלצת AI',
    description: 'המערכת מנתחת זמינות ומיומנות ומציעה את המחליפה האידיאלית',
  },
  {
    number: '3',
    title: 'שיבוץ אוטומטי',
    description: 'אישור בלחיצה אחת — המחליפה מקבלת התראה מיידית',
  },
] as const;

// ─── Role cards data ──────────────────────────────────────────────────────────
const roles = [
  {
    icon: LayoutDashboard,
    title: 'מנהל/ת רשות',
    description: 'שקיפות מלאה על כל גני הרשות',
    bullets: ['דוחות כלל-רשותיים', 'ניהול תקציב שעות', 'מעקב אחר מגמות היעדרות'],
    bg: 'bg-navy-900',
    iconBg: 'bg-navy-700',
    textColor: 'text-white',
    descColor: 'text-slate-300',
    bulletColor: 'text-slate-300',
    checkColor: 'text-mint-500',
  },
  {
    icon: ClipboardList,
    title: 'מנהל/ת גן',
    description: 'דיווח היעדרויות וניהול שיבוצים בקלות',
    bullets: ['דיווח מהיר על היעדרות', 'אישור מחליפה מוצעת', 'יומן שיבוצים שוטף'],
    bg: 'bg-sky-500',
    iconBg: 'bg-blue-400',
    textColor: 'text-white',
    descColor: 'text-blue-100',
    bulletColor: 'text-blue-100',
    checkColor: 'text-white',
  },
  {
    icon: Calendar,
    title: 'מחליפה',
    description: 'שיבוצים, זמינות ותלושי שכר במקום אחד',
    bullets: ['קבלת שיבוצים בהתראה', 'עדכון זמינות עצמאי', 'היסטוריית שיבוצים ושכר'],
    bg: 'bg-mint-500',
    iconBg: 'bg-mint-400',
    textColor: 'text-white',
    descColor: 'text-green-100',
    bulletColor: 'text-green-100',
    checkColor: 'text-white',
  },
] as const;

// ─── Stats data ────────────────────────────────────────────────────────────────
const stats = [
  { value: '500+', label: 'מחליפות רשומות' },
  { value: '98%', label: 'כיסוי יומי' },
  { value: '15 דקות', label: 'בממוצע לשיבוץ' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 min-h-screen flex flex-col">
        {/* Floating background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-mint-500 opacity-10 blur-3xl" />
          <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-sky-500 opacity-10 blur-3xl" />
          <div className="absolute -bottom-24 right-1/3 w-80 h-80 rounded-full bg-mint-300 opacity-10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-sky-500 opacity-5 blur-2xl" />
        </div>

        {/* Nav bar */}
        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Logo size={40} className="shadow-lg" />
            <span className="text-white font-black text-xl tracking-tight">מחליפון</span>
          </div>
          <Link
            to="/login"
            className="bg-white text-navy-900 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-slate-100 transition-colors duration-200 shadow-sm"
          >
            כניסה למערכת
          </Link>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-24 pt-12 fade-in">
          <div className="mb-8">
            <Logo size={80} className="mx-auto shadow-2xl" />
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-tight mb-6">
            מחליפון
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 font-medium mb-4 max-w-xl">
            ניהול חכם של מחליפות בגני ילדים
          </p>

          <p className="text-slate-400 text-base sm:text-lg mb-12 max-w-lg leading-relaxed">
            פלטפורמת SaaS לרשויות מקומיות — שיבוץ מהיר, התראות אוטומטיות ודוחות בזמן אמת
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/login"
              className="bg-mint-500 hover:bg-mint-400 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2"
            >
              כניסה למערכת
              <ArrowLeft size={18} />
            </Link>
            <Link
              to="/login"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all duration-200 border border-white/20 hover:border-white/30 backdrop-blur-sm"
            >
              דמו חינם
            </Link>
          </div>

          {/* Trust badge */}
          <div className="mt-12 flex items-center gap-2 text-slate-400 text-sm">
            <CheckCircle2 size={16} className="text-mint-500" />
            <span>מאושר לשימוש ברשויות מקומיות בישראל</span>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16">
            <path d="M0,60 C360,0 1080,0 1440,60 L1440,60 L0,60 Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 -mt-1 px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 px-8 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center pt-8 sm:pt-0 first:pt-0">
                  <div className="text-4xl font-black text-navy-900 mb-2">{stat.value}</div>
                  <div className="text-slate-500 font-medium text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-navy-900 mb-4">
              כל מה שצריך לניהול יעיל
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              פיצ'רים מתקדמים שנבנו במיוחד עבור מערכת החינוך הישראלית
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.bg} mb-5`}>
                    <Icon size={24} className={feature.accent} />
                  </div>
                  <h3 className="text-lg font-bold text-navy-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="bg-navy-900 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              איך זה עובד?
            </h2>
            <p className="text-slate-400 text-lg">
              תהליך פשוט ויעיל — מהיעדרות לשיבוץ בדקות
            </p>
          </div>

          {/* Steps */}
          <div className="relative">
            {/* Connector line — desktop only */}
            <div className="hidden lg:block absolute top-10 right-16 left-16 h-0.5 bg-gradient-to-l from-mint-500/30 via-mint-500/60 to-mint-500/30" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {steps.map((step, index) => (
                <div key={step.number} className="relative flex flex-col items-center text-center">
                  {/* Vertical connector — mobile only */}
                  {index < steps.length - 1 && (
                    <div className="lg:hidden absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-10 bg-mint-500/40 mt-0" />
                  )}
                  <div className="relative z-10 w-20 h-20 rounded-full bg-mint-500 flex items-center justify-center shadow-lg shadow-mint-500/30 mb-6">
                    <span className="text-white font-black text-2xl">{step.number}</span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLES SECTION ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-navy-900 mb-4">
              ממשק מותאם לכל תפקיד
            </h2>
            <p className="text-slate-500 text-lg">
              כל משתמש רואה בדיוק את מה שהוא צריך
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.title}
                  className={`${role.bg} rounded-3xl p-8 hover:scale-105 transition-transform duration-200`}
                >
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${role.iconBg} mb-6`}>
                    <Icon size={28} className="text-white" />
                  </div>
                  <h3 className={`text-xl font-black mb-2 ${role.textColor}`}>{role.title}</h3>
                  <p className={`text-sm mb-6 ${role.descColor}`}>{role.description}</p>
                  <ul className="space-y-2.5">
                    {role.bullets.map((bullet) => (
                      <li key={bullet} className={`flex items-center gap-2.5 text-sm ${role.bulletColor}`}>
                        <CheckCircle2 size={16} className={`shrink-0 ${role.checkColor}`} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────────────────────────── */}
      <section className="bg-navy-900 px-6 py-24 relative overflow-hidden">
        {/* Background accent blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-mint-500 opacity-10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-sky-500 opacity-10 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
            מוכנים להתחיל?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
            הצטרפו לרשויות שכבר משתמשות במחליפון וחסכו שעות עבודה מדי יום
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-3 bg-mint-500 hover:bg-mint-400 text-white font-bold text-xl px-12 py-5 rounded-2xl transition-all duration-200 shadow-2xl shadow-mint-500/30 hover:shadow-mint-500/40 active:scale-95"
          >
            כניסה חינם לדמו
            <ArrowLeft size={22} />
          </Link>
          <p className="text-slate-500 text-sm mt-6">ללא עלות, ללא צורך בכרטיס אשראי</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-navy-900 border-t border-white/5 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <span className="text-white font-bold text-sm">מחליפון</span>
          </div>
          <p className="text-slate-500 text-sm text-center">
            מחליפון &copy; 2026 — כל הזכויות שמורות | פותח עבור רשויות מקומיות בישראל
          </p>
          <Link
            to="/login"
            className="text-mint-500 hover:text-mint-400 text-sm font-medium transition-colors"
          >
            כניסה למערכת
          </Link>
        </div>
      </footer>
    </div>
  );
}
