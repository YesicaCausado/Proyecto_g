import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLoader from './AppLoader';

type AllowedRole = 'estudiante' | 'profesor' | 'super_profesor' | 'admin';

interface Props {
  children: React.ReactNode;
  role?: AllowedRole;
  roles?: AllowedRole[];
}

export default function ProtectedRoute({ children, role, roles }: Props) {
  const { user, token, loading, sessionError, retrySession, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppLoader message="Comprobando tus permisos de acceso" />;
  }

  if (sessionError && token) {
    return (
      <AppLoader
        message="No se pudo validar tu sesión"
        error={sessionError}
        onRetry={() => { void retrySession(); }}
        onSignOut={logout}
      />
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

  // El cambio obligatorio de contraseña tiene prioridad; el aviso se presenta
  // después de que el estudiante vuelva a iniciar sesión.
  if (
    !user?.must_change_password &&
    user?.role === 'estudiante' &&
    user.privacy_notice_required_version &&
    user.privacy_notice_acknowledged_version !== user.privacy_notice_required_version &&
    location.pathname !== '/privacy-notice'
  ) {
    return <Navigate to="/privacy-notice" replace />;
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