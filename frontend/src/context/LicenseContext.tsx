/**
 * LicenseContext — NeuroLearn AI
 * =================================
 *
 * El frontend NO calcula la licencia.
 *
 * El backend es la única fuente de verdad para:
 * - Rol
 * - Tipo de licencia
 * - Estado de licencia
 * - Features
 * - Módulos
 * - KPIs
 * - Límites
 * - Exportaciones
 *
 * El frontend únicamente consume esos permisos.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import api from '../services/api';
import { useAuth } from './AuthContext';

// ============================================================
// TIPOS
// ============================================================

export type LicenseType = 'basica' | 'premium' | 'pro';

export type LicenseStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended';

export type UserRole =
  | 'estudiante'
  | 'profesor'
  | 'super_profesor'
  | 'admin';

// ============================================================
// INFORMACIÓN DE LICENCIA
// ============================================================

export interface LicenseInfo {
  license_type: LicenseType;

  license_status: LicenseStatus;

  days_left: number | null;

  role?: UserRole;

  features: string[];

  super_modules: string[];

  teacher_modules: string[];

  student_modules: string[];

  teacher_dashboard_kpis: string[];

  neurobot_limit: number;

  groups_limit: number;

  students_limit: number;

  export_formats: string[];

  institution_name: string;
}

// ============================================================
// CONTEXTO
// ============================================================

interface LicenseContextType {
  licenseInfo: LicenseInfo | null;

  loading: boolean;

  error: string | null;

  licenseType: LicenseType | null;

  licenseStatus: LicenseStatus | null;

  daysLeft: number | null;

  role: UserRole | null;

  hasFeature: (feature: string) => boolean;

  hasPermission: (permission: string) => boolean;

  hasTeacherModule: (module: string) => boolean;

  hasStudentModule: (module: string) => boolean;

  hasSuperModule: (module: string) => boolean;

  hasKpi: (kpi: string) => boolean;

  hasExport: (format: string) => boolean;

  neurobotLimit: number;

  groupsLimit: number;

  studentsLimit: number;

  institutionName: string;

  refetch: () => Promise<void>;
}

// ============================================================
// VALORES VACÍOS
// ============================================================

const EMPTY_LICENSE: LicenseInfo = {
  license_type: 'basica',

  license_status: 'suspended',

  days_left: null,

  role: undefined,

  features: [],

  super_modules: [],

  teacher_modules: [],

  student_modules: [],

  teacher_dashboard_kpis: [],

  neurobot_limit: 0,

  groups_limit: 0,

  students_limit: 0,

  export_formats: [],

  institution_name: '',
};

// ============================================================
// CONTEXTO
// ============================================================

const LicenseContext =
  createContext<LicenseContextType | null>(null);

// ============================================================
// PROVIDER
// ============================================================

export function LicenseProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, token } = useAuth();

  const [licenseInfo, setLicenseInfo] =
    useState<LicenseInfo | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================================
  // OBTENER LICENCIA
  // ==========================================================

  const fetchLicense = async (): Promise<void> => {
    /*
     * Si no hay sesión:
     * no existe licencia que consultar.
     */

    if (!token || !user) {
      setLicenseInfo(null);
      setError(null);
      setLoading(false);

      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await api.get<LicenseInfo>(
          '/license/my-license'
        );

      const data = response.data;

      /*
       * El backend es la fuente de verdad.
       *
       * No hacemos fallback a una licencia Básica real.
       * EMPTY_LICENSE solamente sirve para mantener
       * una estructura segura.
       */

      setLicenseInfo({
        ...EMPTY_LICENSE,

        ...data,

        features: Array.isArray(data.features)
          ? data.features
          : [],

        super_modules: Array.isArray(
          data.super_modules
        )
          ? data.super_modules
          : [],

        teacher_modules: Array.isArray(
          data.teacher_modules
        )
          ? data.teacher_modules
          : [],

        student_modules: Array.isArray(
          data.student_modules
        )
          ? data.student_modules
          : [],

        teacher_dashboard_kpis:
          Array.isArray(
            data.teacher_dashboard_kpis
          )
            ? data.teacher_dashboard_kpis
            : [],

        export_formats: Array.isArray(
          data.export_formats
        )
          ? data.export_formats
          : [],
      });
    } catch (err) {
      /*
       * FAIL CLOSED
       *
       * Si el backend no puede verificar la licencia,
       * NO otorgamos permisos.
       */

      console.error(
        'Error obteniendo licencia institucional:',
        err
      );

      setLicenseInfo(null);

      setError(
        'No se pudo verificar la licencia institucional.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // CARGA INICIAL / CAMBIO DE SESIÓN
  // ==========================================================

  useEffect(() => {
    void fetchLicense();

    /*
     * user.id identifica al usuario.
     * token identifica la sesión.
     */

  }, [token, user?.id]);

  // ==========================================================
  // INFORMACIÓN ACTUAL
  // ==========================================================

  const info = licenseInfo;

  /*
   * Estados que permiten consultar información.
   *
   * La decisión exacta de qué funcionalidades siguen
   * disponibles debe venir del backend.
   */

  const canUseLicenseFeatures = (): boolean => {
    if (!info) {
      return false;
    }

    if (info.license_status === 'suspended') {
      return false;
    }

    return true;
  };

  // ==========================================================
  // FEATURES
  // ==========================================================

  const hasFeature = (
    feature: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.features.includes(feature);
  };

  // ==========================================================
  // PERMISOS
  // ==========================================================

  const hasPermission = (
    permission: string
  ): boolean => {
    return hasFeature(permission);
  };

  // ==========================================================
  // MÓDULOS PROFESOR
  // ==========================================================

  const hasTeacherModule = (
    module: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.teacher_modules.includes(module);
  };

  // ==========================================================
  // MÓDULOS ESTUDIANTE
  // ==========================================================

  const hasStudentModule = (
    module: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.student_modules.includes(module);
  };

  // ==========================================================
  // MÓDULOS SUPER PROFESOR
  // ==========================================================

  const hasSuperModule = (
    module: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.super_modules.includes(module);
  };

  // ==========================================================
  // KPIs
  // ==========================================================

  const hasKpi = (
    kpi: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.teacher_dashboard_kpis.includes(kpi);
  };

  // ==========================================================
  // EXPORTACIONES
  // ==========================================================

  const hasExport = (
    format: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.export_formats.includes(format);
  };

  // ==========================================================
  // VALORES SEGUROS
  // ==========================================================

  /*
   * IMPORTANTE:
   *
   * No utilizamos EMPTY_LICENSE para decir que el usuario
   * realmente tiene licencia Básica.
   *
   * Cuando no hay licencia:
   *
   * licenseType = null
   * licenseStatus = null
   *
   * Esto evita que la UI muestre accidentalmente:
   *
   * "Plan Básico"
   *
   * cuando en realidad todavía no se ha podido verificar.
   */

  const licenseType =
    info?.license_type ?? null;

  const licenseStatus =
    info?.license_status ?? null;

  const daysLeft =
    info?.days_left ?? null;

  const role =
    info?.role ?? null;

  const neurobotLimit =
    info?.neurobot_limit ?? 0;

  const groupsLimit =
    info?.groups_limit ?? 0;

  const studentsLimit =
    info?.students_limit ?? 0;

  const institutionName =
    info?.institution_name ?? '';

  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <LicenseContext.Provider
      value={{
        licenseInfo: info,

        loading,

        error,

        licenseType,

        licenseStatus,

        daysLeft,

        role,

        hasFeature,

        hasPermission,

        hasTeacherModule,

        hasStudentModule,

        hasSuperModule,

        hasKpi,

        hasExport,

        neurobotLimit,

        groupsLimit,

        studentsLimit,

        institutionName,

        refetch: fetchLicense,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useLicense(): LicenseContextType {
  const context =
    useContext(LicenseContext);

  if (!context) {
    throw new Error(
      'useLicense must be used inside <LicenseProvider>'
    );
  }

  return context;
}