import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

type AllowedRole = 'estudiante' | 'profesor' | 'super_profesor' | 'admin';

interface Props {
  children: React.ReactNode;
  role?: AllowedRole;
  roles?: AllowedRole[];
}

export default function ProtectedRoute({ children, role, roles }: Props) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admin tiene acceso total
  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles && !roles.includes(user?.role as AllowedRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}