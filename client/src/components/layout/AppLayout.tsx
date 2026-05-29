import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, ClipboardList,
  BarChart3, Settings, LogOut, Bell, Menu, X, Activity,
  CalendarCheck, Building2, BookOpen, Brain,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, UserRole } from '@/context/authStore';
import api from '@/utils/api';
import Logo from '@/components/Logo';
import NotificationPanel from '@/components/NotificationPanel';

const navItems: Record<UserRole, { href: string; label: string; icon: React.ReactNode }[]> = {
  authority_admin: [
    { href: '/dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} /> },
    { href: '/activity', label: 'פעילות חיה', icon: <Activity size={18} /> },
    { href: '/substitutes', label: 'מחליפות', icon: <Users size={18} /> },
    { href: '/absences', label: 'היעדרויות', icon: <ClipboardList size={18} /> },
    { href: '/known-absences', label: 'היעדרויות ידועות', icon: <BookOpen size={18} /> },
    { href: '/manager-kindergartens', label: 'מנהלי גנים', icon: <Building2 size={18} /> },
    { href: '/ml-insights', label: 'תובנות AI', icon: <Brain size={18} /> },
    { href: '/reports', label: 'דוחות', icon: <BarChart3 size={18} /> },
    { href: '/settings', label: 'הגדרות', icon: <Settings size={18} /> },
    { href: '/profile', label: 'פרופיל', icon: <Users size={18} /> },
  ],
  manager: [
    { href: '/dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} /> },
    { href: '/activity', label: 'פעילות חיה', icon: <Activity size={18} /> },
    { href: '/substitutes', label: 'מחליפות', icon: <Users size={18} /> },
    { href: '/absences', label: 'היעדרויות', icon: <ClipboardList size={18} /> },
    { href: '/assignments', label: 'שיבוצים', icon: <Calendar size={18} /> },
    { href: '/known-absences', label: 'היעדרויות ידועות', icon: <BookOpen size={18} /> },
    { href: '/ml-insights', label: 'תובנות AI', icon: <Brain size={18} /> },
    { href: '/reports', label: 'דוחות', icon: <BarChart3 size={18} /> },
    { href: '/profile', label: 'פרופיל', icon: <Users size={18} /> },
  ],
  substitute: [
    { href: '/dashboard', label: 'שיבוצים שלי', icon: <Calendar size={18} /> },
    { href: '/availability', label: 'זמינות', icon: <CalendarCheck size={18} /> },
    { href: '/profile', label: 'פרופיל', icon: <Settings size={18} /> },
  ],
  super_admin: [
    { href: '/dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} /> },
    { href: '/authorities', label: 'רשויות', icon: <BarChart3 size={18} /> },
    { href: '/substitutes', label: 'מחליפות', icon: <Users size={18} /> },
    { href: '/known-absences', label: 'היעדרויות ידועות', icon: <BookOpen size={18} /> },
    { href: '/settings', label: 'הגדרות', icon: <Settings size={18} /> },
  ],
};

export default function AppLayout() {
  const { user, logout, isDemoMode } = useAuthStore();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = () => {
    if (!user) return;
    api.get('/notifications/unread-count')
      .then(r => setUnreadCount(r.data.count || 0))
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCloseNotifications = () => {
    setShowNotifications(false);
    fetchUnread();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  if (!user) return null;
  const links = navItems[user.role] || navItems.manager;

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <h1 className="font-black text-white text-lg leading-tight">מחליפון</h1>
            <p className="text-navy-400 text-xs">{user.authorityName || 'מערכת'}</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(link => (
          <NavLink
            key={link.href}
            to={link.href}
            end={link.href === '/dashboard'}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-navy-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-sm font-bold text-mint-400">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
            <p className="text-navy-400 text-xs truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNotifications(true)}
          className="nav-link w-full relative"
        >
          <Bell size={18} />
          התראות
          {unreadCount > 0 && (
            <span className="mr-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={logout}
          className="nav-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut size={18} />
          יציאה
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-navy-900 flex-col flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-64 bg-navy-900 flex flex-col z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute left-3 top-3 text-navy-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar - mobile */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-black text-navy-900">מחליפון</span>
          </div>
          <button
            onClick={() => setShowNotifications(true)}
            className="text-slate-600 relative"
            aria-label="התראות"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        {/* Demo mode banner */}
        {isDemoMode && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700 font-medium flex items-center justify-center gap-2">
            <span>⚠️</span>
            מצב דמו — הנתונים המוצגים הם לדוגמה בלבד. לחיבור לנתונים אמיתיים נדרשת מסד נתונים.
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Notification slide-out panel */}
      {showNotifications && (
        <NotificationPanel onClose={handleCloseNotifications} />
      )}
    </div>
  );
}
