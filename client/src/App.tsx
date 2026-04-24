import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import SubstituteDashboard from './pages/SubstituteDashboard';
import SubstitutesPage from './pages/SubstitutesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AbsencesPage from './pages/AbsencesPage';
import ActivityDashboard from './pages/ActivityDashboard';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import AvailabilityPage from './pages/AvailabilityPage';
import KnownAbsencesPage from './pages/KnownAbsencesPage';
import ManagerKindergartensPage from './pages/ManagerKindergartensPage';
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
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
              <Route path="/assignments" element={<AssignmentsPage />} />
              <Route path="/absences" element={<AbsencesPage />} />
              <Route path="/known-absences" element={<KnownAbsencesPage />} />
              <Route path="/manager-kindergartens" element={
                <ProtectedRoute allowedRoles={['authority_admin', 'super_admin']} />
              }>
                <Route index element={<ManagerKindergartensPage />} />
              </Route>
              <Route path="/activity" element={<ActivityDashboard />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<div className="text-slate-400 text-center py-20">בפיתוח...</div>} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/availability" element={<AvailabilityPage />} />
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
    </ErrorBoundary>
    </QueryClientProvider>
  );
}
