import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Login } from './pages/Login';
import { MadrigaDashboard } from './pages/madriga/Dashboard';
import { SubstituteDashboard } from './pages/substitute/Dashboard';
import { Availability } from './pages/substitute/Availability';
import { ClaimPage } from './pages/substitute/ClaimPage';
import { ProtectedRoute } from './components/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute requiredRole="madriga">
                <MadrigaDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/substitute"
            element={
              <ProtectedRoute requiredRole="substitute">
                <SubstituteDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/availability"
            element={
              <ProtectedRoute requiredRole="substitute">
                <Availability />
              </ProtectedRoute>
            }
          />

          <Route
            path="/claim/:id"
            element={
              <ProtectedRoute>
                <ClaimPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: { fontFamily: 'Heebo, sans-serif', direction: 'rtl' },
        }}
      />
    </QueryClientProvider>
  );
}
