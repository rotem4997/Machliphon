import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import LoginPage from './pages/LoginPage';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import SubstituteDashboard from './pages/SubstituteDashboard';
import SubstitutesPage from './pages/SubstitutesPage';
import { useAuthStore } from './context/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 min
      retry: 1,
    },
  },
});

function SmartDashboard() {
  const { user } = useAuthStore();
  if (user?.role === 'substitute') return <SubstituteDashboard />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<SmartDashboard />} />
              <Route
                path="/substitutes"
                element={
                  <ProtectedRoute allowedRoles={['manager', 'authority_admin', 'super_admin']} />
                }
              >
                <Route index element={<SubstitutesPage />} />
              </Route>
              {/* More pages will be added here */}
              <Route path="/assignments" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
              <Route path="/absences" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
              <Route path="/reports" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
              <Route path="/settings" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
              <Route path="/profile" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
              <Route path="/availability" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Heebo, sans-serif',
            direction: 'rtl',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#17C98A', secondary: 'white' } },
        }}
      />
    </QueryClientProvider>
  );
}
