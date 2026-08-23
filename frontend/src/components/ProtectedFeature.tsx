import { type ReactNode } from 'react';
import { useLicense } from '../context/LicenseContext';

interface ProtectedFeatureProps {
  children: ReactNode;
  /** Nombre del módulo a comprobar (ej: "cursos", "neurobots", "alertas", "reportes"). */
  feature: string;
  fallback?: ReactNode;
}

/**
 * Renderiza `children` solo si la licencia del usuario incluye el `feature`
 * (módulo) indicado. Usa la API síncrona de LicenseContext.
 *
 * Ejemplo:
 *   <ProtectedFeature feature="neurobots" fallback={<p>No disponible en tu plan</p>}>
 *     <NeuroBotsPanel />
 *   </ProtectedFeature>
 */
export default function ProtectedFeature({
  children,
  feature,
  fallback = null
}: ProtectedFeatureProps) {
  const {
    hasTeacherModule,
    hasStudentModule,
    licenseStatus,
  } = useLicense();

  // Durante 'expiring_soon' seguimos mostrando; en 'suspended' bloqueamos todo.
  const blocked = licenseStatus === 'suspended';
  const hasAccess = !blocked && (hasTeacherModule(feature) || hasStudentModule(feature));

  if (!hasAccess && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}