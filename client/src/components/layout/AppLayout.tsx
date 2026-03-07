import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, ClipboardList,
  BarChart3, Settings, LogOut, Bell, Menu, X, Activity
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore, UserRole } from '@/context/authStore';

const navItems: Record<UserRole, { href: string; label: string; icon: React.ReactNode }[]> = {
  authority_admin: [
    { href: '/dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} /> },
    { href: '/activity', label: 'פעילות חיה', icon: <Activity size={18} /> },
    { href: '/substitutes', label: 'מחליפות', icon: <Users size={18} /> },
    { href: '/assignments', label: 'שיבוצים', icon: <Calendar size={18} /> },
    { href: '/absences', label: 'היעדרויות', icon: <ClipboardList size={18} /> },
    { href: '/reports', label: 'דוחות ומדגנט', icon: <BarChart3 size={18} /> },
    { href: '/settings', label: 'הגדרות', icon: <Settings size={18} /> },
  ],
  manager: [
    { href: '/dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} /> },
    { href: '/activity', label: 'פעילות חיה', icon: <Activity size={18} /> },
    { href: '/substitutes', label: 'מחליפות', icon: <Users size={18} /> },
    { href: '/assignments', label: 'שיבוצים', icon: <Calendar size={18} /> },
    { href: '/absences', label: 'היעדרויות', icon: <ClipboardList size={18} /> },
    { href: '/reports', label: 'דוחות', icon: <BarChart3 size={18} /> },
  ],
  substitute: [
    { href: '/dashboard', label: 'שיבוצים שלי', icon: <Calendar size={18} /> },
  ],
  super_admin: [
    { href: '/dashboard', label: 'לוח בקרה', icon: <LayoutDashboard size={18} /> },
    { href: '/authorities', label: 'רשויות', icon: <BarChart3 size={18} /> },
    { href: '/substitutes', label: 'מחליפות', icon: <Users size={18} /> },
    { href: '/settings', label: 'הגדרות', icon: <Settings size={18} /> },
  ],
};

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;
  const links = navItems[user.role] || navItems.manager;

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-mint-500 flex items-center justify-center text-lg shadow-sm">
            🔄
          </div>
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
          <span className="font-black text-navy-900">מחליפון</span>
          <button className="text-slate-600 relative">
            <Bell size={22} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
