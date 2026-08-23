import { Navigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

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

  // Cualquier usuario con contraseña temporal pendiente DEBE cambiar su
  // contraseña antes de acceder a los paneles. Este guard se aplica en TODAS
  // las rutas protegidas (evita que un /super, /teacher o /admin escriba en la
  // URL para saltarse el primer-login). Se excluye la propia /change-password
  // para no generar un bucle de redirección.
  if (
    user?.must_change_password &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate to="/change-password" replace />;
  }

  // Admin tiene acceso total a cualquier panel (pero igual pasa por el
  // cambio de contraseña forzado de arriba si su cuenta lo requiere).
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