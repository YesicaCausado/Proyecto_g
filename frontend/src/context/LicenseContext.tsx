/**
 * LicenseContext — NeuroLearn AI
 * ================================
 * Carga la licencia institucional del usuario autenticado desde el backend.
 * Expone:
 *   - licenseInfo: datos completos
 *   - hasTeacherModule(mod): boolean
 *   - hasStudentModule(mod): boolean
 *   - licenseStatus: "active" | "expiring_soon" | "expired" | "suspended"
 *   - daysLeft: number | null
 *   - loading: boolean
 *
 * Uso:
 *   const { hasTeacherModule, licenseStatus } = useLicense();
 *   if (!hasTeacherModule("neurobots")) return null;
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

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type LicenseType   = 'basica' | 'premium' | 'pro';
export type LicenseStatus = 'active' | 'expiring_soon' | 'expired' | 'suspended';

export interface LicenseInfo {
  license_type:           LicenseType;
  license_status:         LicenseStatus;
  days_left:              number | null;
  teacher_modules:        string[];
  student_modules:        string[];
  teacher_dashboard_kpis: string[];
  neurobot_limit:         number;
  export_formats:         string[];
  institution_name:       string;
}

interface LicenseContextType {
  licenseInfo:       LicenseInfo | null;
  loading:           boolean;
  licenseType:       LicenseType;
  licenseStatus:     LicenseStatus;
  daysLeft:          number | null;
  hasTeacherModule:  (mod: string) => boolean;
  hasStudentModule:  (mod: string) => boolean;
  hasKpi:            (kpi: string) => boolean;
  hasExport:         (fmt: string) => boolean;
  neurobotLimit:     number;
  institutionName:   string;
  refetch:           () => void;
}

// ─── Fallback: licencia básica activa ─────────────────────────────────────────

const BASIC_ACTIVE: LicenseInfo = {
  license_type:           'basica',
  license_status:         'active',
  days_left:              null,
  teacher_modules:        [
    'dashboard', 'cursos', 'grupos', 'estudiantes',
    'evaluaciones', 'recursos', 'calendario', 'mensajes', 'perfil',
  ],
  student_modules:        [
    'inicio', 'mis_cursos', 'mis_tareas', 'evaluaciones',
    'recursos', 'calendario', 'mensajes', 'perfil',
  ],
  teacher_dashboard_kpis: [
    'cursos_activos', 'estudiantes', 'evaluaciones_creadas', 'actividades_pendientes',
  ],
  neurobot_limit:         1,
  export_formats:         ['csv'],
  institution_name:       '',
};

// ─── Context ──────────────────────────────────────────────────────────────────

const LicenseContext = createContext<LicenseContextType | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading]         = useState(false);

  const fetchLicense = async () => {
    if (!token || !user) return;
    // Admin no tiene institución — usar básica activa
    if (user.role === 'admin') {
      setLicenseInfo(BASIC_ACTIVE);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<LicenseInfo>('/license/my-license');
      setLicenseInfo(res.data);
    } catch {
      // Si el endpoint falla (backend sin licencia implementada) → básica activa
      setLicenseInfo(BASIC_ACTIVE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicense();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const info = licenseInfo ?? BASIC_ACTIVE;

  const hasTeacherModule = (mod: string): boolean => {
    if (info.license_status === 'suspended') return false;
    if (info.license_status === 'expired') {
      return ['dashboard', 'cursos', 'grupos', 'estudiantes', 'recursos'].includes(mod);
    }
    return info.teacher_modules.includes(mod);
  };

  const hasStudentModule = (mod: string): boolean => {
    if (info.license_status === 'suspended') return false;
    if (info.license_status === 'expired') {
      return ['inicio', 'mis_cursos', 'recursos'].includes(mod);
    }
    return info.student_modules.includes(mod);
  };

  const hasKpi = (kpi: string): boolean =>
    info.teacher_dashboard_kpis.includes(kpi);

  const hasExport = (fmt: string): boolean =>
    info.export_formats.includes(fmt);

  return (
    <LicenseContext.Provider
      value={{
        licenseInfo:     info,
        loading,
        licenseType:     info.license_type,
        licenseStatus:   info.license_status,
        daysLeft:        info.days_left,
        hasTeacherModule,
        hasStudentModule,
        hasKpi,
        hasExport,
        neurobotLimit:   info.neurobot_limit,
        institutionName: info.institution_name,
        refetch:         fetchLicense,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLicense(): LicenseContextType {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside <LicenseProvider>');
  return ctx;
}
