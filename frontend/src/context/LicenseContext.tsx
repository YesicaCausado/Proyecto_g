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
 * 
 * NOTA: Este contexto ha sido modificado para eliminar el sistema de licencias.
 * Ahora obtiene toda la información basada en el rol del usuario.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthContext';

// ============================================================
// TIPOS
// ============================================================

export type LicenseType = 'basica';

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

// EMPTY_LICENSE no se usa realmente, pero lo mantenemos comentado por si acaso se necesita en el futuro
// const EMPTY_LICENSE: LicenseInfo = {
//   license_type: 'basica',
//   
//   license_status: 'suspended',
//   
//   days_left: null,
//   
//   role: undefined,
//   
//   features: [],
//   
//   super_modules: [],
//   
//   teacher_modules: [],
//   
//   student_modules: [],
//   
//   teacher_dashboard_kpis: [],
//   
//   neurobot_limit: 0,
//   
//   groups_limit: 0,
//   
//   students_limit: 0,
//   
//   export_formats: [],
//   
//   institution_name: '',
// };

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
  const { user } = useAuth();

  const [licenseInfo, setLicenseInfo] =
    useState<LicenseInfo | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================================================
  // OBTENER INFORMACIÓN DE LICENCIA BASADA EN ROL
  // ==========================================================================

  const fetchLicense = async (): Promise<void> => {
    /*
     * Si no hay sesión:
     * no existe información que consultar.
     */

    if (!user) {
      setLicenseInfo(null);
      setError(null);
      setLoading(false);

      return;
    }

    setLoading(true);
    setError(null);

    try {
      // En lugar de llamar al backend, calculamos todo basado en el rol del usuario
      const role = user.role;
      
      // Mapeo de roles a características disponibles (basado en nuestro permission service)
      const FEATURE_ROLES: Record<string, string[]> = {
        // FUNCIONES TRANSVERSALES
        perfil: ['super_profesor', 'profesor', 'estudiante'],
        mensajes: ['super_profesor', 'profesor', 'estudiante'],
        calendario: ['super_profesor', 'profesor', 'estudiante'],
        
        // SUPER PROFESOR
        configuracion: ['super_profesor'],
        licencia: ['super_profesor'],
        gestion_profesores: ['super_profesor'],
        gestion_estudiantes: ['super_profesor'],
        gestion_grupos: ['super_profesor', 'profesor'],
        
        // DASHBOARD Y ANALÍTICA
        dashboard: ['super_profesor', 'profesor', 'estudiante'],
        basic_analytics: ['super_profesor', 'profesor', 'estudiante'],
        advanced_analytics: ['super_profesor', 'profesor'],
        predictive_analytics: ['super_profesor', 'profesor'],
        groups_compare: ['super_profesor', 'profesor'],
        risk_indicators: ['super_profesor', 'profesor'],
        
        // CONTENIDO ACADÉMICO
        recursos: ['profesor', 'estudiante'],
        evaluaciones: ['profesor', 'estudiante'],
        tareas: ['estudiante'],
        anuncios: ['profesor'],
        
        // NEUROBOTS / NEUROALERTAS
        neurobots: ['super_profesor', 'profesor'],
        neurobots_advanced: ['super_profesor', 'profesor'],
        neuroalertas: ['super_profesor', 'profesor'],
        
        // NEURODIGITAL
        neurodigital: ['profesor', 'estudiante'],
        
        // REPORTES
        reportes: ['super_profesor', 'profesor'],
        reportes_avanzados: ['super_profesor', 'profesor'],
        
        // IA PARA ESTUDIANTES
        tutor_ia: ['estudiante'],
        tutor_ia_adaptive: ['estudiante'],
        chat_history: ['estudiante'],
        recommendations: ['estudiante'],
        adaptive_feedback: ['estudiante'],
        difficulty_detection: ['estudiante'],
        skill_tracking: ['estudiante'],
        learning_analytics: ['estudiante'],
        tutor_ia_advanced: ['estudiante'],
        personal_reports: ['estudiante'],
        personal_analytics: ['estudiante'],
        personalized_plans: ['estudiante'],
        
        // IA PARA PROFESORES
        teacher_ai: ['profesor'],
        
        // AUTOMATIZACIÓN / INTEGRACIONES
        automation: ['super_profesor', 'profesor'],
        integrations: ['super_profesor', 'profesor'],
      };
      
      // Módulos y sus características correspondientes
      const MODULE_ALIASES: Record<string, string> = {
        inicio: 'dashboard',
        mis_cursos: 'dashboard',
        estadisticas: 'basic_analytics',
        cursos: 'dashboard',
        grupos: 'gestion_grupos',
        estudiantes: 'gestion_estudiantes',
        profesores: 'gestion_profesores',
        recursos: 'recursos',
        evaluaciones: 'evaluaciones',
        tareas: 'tareas',
        mensajes: 'mensajes',
        mensajeria: 'mensajes',
        calendario: 'calendario',
        perfil: 'perfil',
        reportes: 'reportes',
        licencia: 'licencia',
        configuracion: 'configuracion',
        neurobots: 'neurobots',
        neuroalertas: 'neuroalertas',
        neurodigital: 'neurodigital',
      };
      
      // Obtener características disponibles para este rol
      const features: string[] = Object.keys(FEATURE_ROLES)
        .filter(feature => FEATURE_ROLES[feature].includes(role))
        .sort();
      
      // Obtener módulos disponibles para este rol
      const modules: string[] = Object.keys(MODULE_ALIASES)
        .filter(module => {
          const feature = MODULE_ALIASES[module];
          return FEATURE_ROLES[feature] && FEATURE_ROLES[feature].includes(role);
        })
        .sort();
      
      // Separar módulos por tipo de rol
      const super_modules: string[] = modules.filter(module => {
        const feature = MODULE_ALIASES[module];
        return FEATURE_ROLES[feature]?.includes('super_profesor') ?? false;
      });
      
      const teacher_modules: string[] = modules.filter(module => {
        const feature = MODULE_ALIASES[module];
        return FEATURE_ROLES[feature]?.includes('profesor') ?? false;
      });
      
      const student_modules: string[] = modules.filter(module => {
        const feature = MODULE_ALIASES[module];
        return FEATURE_ROLES[feature]?.includes('estudiante') ?? false;
      });
      
      // KPIs para profesores (todos los KPIs avanzados están disponibles para profesores y super profesores)
      const teacher_dashboard_kpis: string[] = [
        "cursos_activos",
        "estudiantes",
        "evaluaciones_creadas",
        "actividades_pendientes",
        "neurobots_creados",
        "uso_ia",
        "promedio_academico",
        "participacion",
        "estudiantes_riesgo",
        "estado_licencia",
        "consumo_ia",
        "usuarios_activos",
        "riesgo_academico",
        "prediccion_abandono",
      ];
      
      // Límites ilimitados (ya que eliminamos las restricciones de licencia)
      const UNLIMITED = 999999;
      
      setLicenseInfo({
        license_type: 'basica', // Mantener para compatibilidad pero sin significado
        license_status: 'active', // Siempre activo
        days_left: null, // Sin vencimiento
        role: role as UserRole,
        features,
        super_modules,
        teacher_modules,
        student_modules,
        teacher_dashboard_kpis,
        neurobot_limit: UNLIMITED,
        groups_limit: UNLIMITED,
        students_limit: UNLIMITED,
        teachers_limit: UNLIMITED,
        export_formats: ['csv', 'pdf', 'excel'],
        institution_name: 'Sin institución', // TODO: Obtener nombre de institución desde institution_id
      } as LicenseInfo);
    } catch (err) {
      /*
       * FAIL CLOSED
       *
       * Si ocurre un error, NO otorgamos permisos.
       */

      console.error(
        'Error obteniendo información de licencia basada en rol:',
        err
      );

      setLicenseInfo(null);

      setError(
        'No se pudo obtener la información de licencia basada en rol.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // CARGA INICIAL / CAMBIO DE SESIÓN
  // ==========================================================================

  useEffect(() => {
    void fetchLicense();
  }, [user]);

  // ==========================================================================
  // INFORMACIÓN ACTUAL
  // ==========================================================================

  const info = licenseInfo;

  /*
   * Estados que permiten consultar información.
   *
   * La decisión exacta de qué funcionalidades siguen
   * disponibles debe venir del rol del usuario.
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

  // ==========================================================================
  // FEATURES
  // ==========================================================================

  const hasFeature = (
    feature: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.features.includes(feature);
  };

  // ==========================================================================
  // PERMISOS
  // ==========================================================================

  const hasPermission = (
    permission: string
  ): boolean => {
    return hasFeature(permission);
  };

  // ==========================================================================
  // MÓDULOS PROFESOR
  // ==========================================================================

  const hasTeacherModule = (
    module: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.teacher_modules.includes(module);
  };

  // ==========================================================================
  // MÓDULOS ESTUDIANTE
  // ==========================================================================

  const hasStudentModule = (
    module: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.student_modules.includes(module);
  };

  // ==========================================================================
  // MÓDULOS SUPER PROFESOR
  // ==========================================================================

  const hasSuperModule = (
    module: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.super_modules.includes(module);
  };

  // ==========================================================================
  // KPIs
  // ==========================================================================

  const hasKpi = (
    kpi: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.teacher_dashboard_kpis.includes(kpi);
  };

  // ==========================================================================
  // EXPORTACIONES
  // ==========================================================================

  const hasExport = (
    format: string
  ): boolean => {
    if (!canUseLicenseFeatures()) {
      return false;
    }

    return info!.export_formats.includes(format);
  };

  // ==========================================================================
  // VALORES SEGUROS
  // ==========================================================================

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

  // ==========================================================================
  // PROVIDER
  // ==========================================================================

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