import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useUser();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success('התנתקת בהצלחה');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold tracking-wide">מחליפון</span>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-sky hidden sm:block">
                {user.full_name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-md"
            >
              יציאה
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
