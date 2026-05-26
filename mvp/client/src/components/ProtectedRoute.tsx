import { Navigate } from 'react-router-dom';
import type { Role } from '../lib/types';
import { useUser } from '../hooks/useUser';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">טוען...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    const fallback = user.role === 'madriga' ? '/' : '/substitute';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
