import { type ReactNode } from 'react';
import { useLicense } from '../context/LicenseContext';

interface ProtectedFeatureProps {
  children: ReactNode;
  /** Nombre canónico de la funcionalidad (FEATURE_MATRIX), ej. "neurobots", "advanced_analytics". */
  feature: string;
  fallback?: ReactNode;
}

/**
 * Renderiza `children` solo si el usuario (rol + licencia de su institución)
 * tiene la `feature` indicada. Usa la API centralizada `hasFeature` del
 * LicenseContext (misma lógica que el backend usa en `require_feature`).
 *
 * Ejemplo:
 *   <ProtectedFeature feature="advanced_analytics" fallback={<DisponibleEnPremium />}>
 *     <AnalyticsPanel />
 *   </ProtectedFeature>
 */
export default function ProtectedFeature({
  children,
  feature,
  fallback = null
}: ProtectedFeatureProps) {
  const { hasFeature } = useLicense();

  if (!hasFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}