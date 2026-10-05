import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLicense } from '../../context/LicenseContext';
import api from '../../services/api';

import DashboardTab from './components/DashboardTab';
import MisGruposTab from './components/MisGruposTab';
import NeuroBotsTab from './components/NeuroBotsTab';
import NeuroAlertasTab from './components/NeuroAlertasTab';
import TableroTab from './components/TableroTab';
import EvaluacionesTab from './components/EvaluacionesTab';
import MaterialesTab from './components/MaterialesTab';
import MensajesTab from './components/MensajesTab';
import CalendarioTab from './components/CalendarioTab';
import ConfiguracionTab from './components/ConfiguracionTab';
import AnaliticaTab from './components/AnaliticaTab';
import IAGenerativaTab from './components/IAGenerativaTab';
import IntegracionesTab from './components/IntegracionesTab';
import AutomatizacionesTab from './components/AutomatizacionesTab';

import LicenseBanner from '../../components/LicenseBanner';
import SuspendedScreen from '../../components/SuspendedScreen';

import {
  LayoutDashboard,
  BookOpen,
  Bot,
  BrainCircuit,
  LayoutList,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  Calendar,
  Settings,
  LogOut,
  Bell,
  ChevronRight,
  Zap,
  Menu,
  X,
  BarChart2,
  FlaskConical,
  Link2,
  Cpu,
} from 'lucide-react';

import { navItemStyle } from '../../styles/sidebar';
import { planColor } from '../../styles/plan';

// ============================================================
// TIPOS
// ============================================================

type LicensePlan = 'basica' | 'premium' | 'pro';

interface TeacherLicense {
  plan: LicensePlan;
  groups_limit: number;
  students_limit: number;
  bots_limit: number | 'unlimited';
  expiry_date: string;
}

interface NavItemDef {
  label: string;
  icon: any;
  badge?: string;
  module: string;
  feature?: string;
  id?: string;
}

// ============================================================
// MENÚ COMPLETO
// ============================================================

const ALL_NAV_ITEMS: Record<string, NavItemDef> = {
  dashboard: {
    label: 'Dashboard',
    icon: LayoutDashboard,
    module: 'dashboard',
    feature: 'dashboard',
  },

  grupos: {
    label: 'Mis Grupos',
    icon: BookOpen,
    module: 'grupos',
    feature: 'gestion_grupos',
  },

  neurobots: {
    label: 'NeuroBots',
    icon: Bot,
    module: 'neurobots',
    feature: 'neurobots',
    badge: 'alert',
  },

  alertas: {
    label: 'NeuroAlertas',
    icon: BrainCircuit,
    module: 'alertas',
    feature: 'neuroalertas',
    badge: 'alert',
  },

  tablero: {
    label: 'Tablero',
    icon: LayoutList,
    module: 'cursos',
    feature: 'anuncios',
  },

  evaluaciones: {
    label: 'Evaluaciones',
    icon: ClipboardList,
    module: 'evaluaciones',
    feature: 'evaluaciones',
  },

  materiales: {
    label: 'Materiales',
    icon: FolderOpen,
    module: 'recursos',
    feature: 'recursos',
  },

  mensajes: {
    label: 'Mensajes',
    icon: MessageSquare,
    module: 'mensajes',
    feature: 'mensajes',
    badge: 'msg',
  },

  calendario: {
    label: 'Calendario',
    icon: Calendar,
    module: 'calendario',
    feature: 'calendario',
  },

  analitica: {
    label: 'Analítica',
    icon: BarChart2,
    module: 'analitica',
    feature: 'advanced_analytics',
  },

  ia: {
    label: 'IA Generativa',
    icon: Cpu,
    module: 'ia',
    feature: 'teacher_ai',
  },

  integraciones: {
    label: 'Integraciones',
    icon: Link2,
    module: 'integraciones',
    feature: 'integrations',
  },

  automatizaciones: {
    label: 'Automatizaciones',
    icon: FlaskConical,
    module: 'automatizaciones',
    feature: 'automation',
  },

  configuracion: {
    label: 'Configuración',
    icon: Settings,
    module: 'configuracion',
    feature: 'perfil',
  },
};

// ============================================================
// CONSTRUCCIÓN DEL MENÚ
// ============================================================

function buildNavSections(
  hasFeature: (feature: string) => boolean
) {
  const sections: {
    label: string;
    items: NavItemDef[];
  }[] = [];

  // ----------------------------------------------------------
  // PRINCIPAL
  // ----------------------------------------------------------

  const principal = [
    'dashboard',
    'grupos',
  ].filter((id) =>
    hasFeature(
      ALL_NAV_ITEMS[id].feature ??
        ALL_NAV_ITEMS[id].module
    )
  );

  if (principal.length > 0) {
    sections.push({
      label: 'PRINCIPAL',
      items: principal.map((id) => ({
        ...ALL_NAV_ITEMS[id],
        id,
      })),
    });
  }

  // ----------------------------------------------------------
  // INTELIGENCIA IA
  // ----------------------------------------------------------

  const ia = [
    'neurobots',
    'alertas',
  ].filter((id) =>
    hasFeature(
      ALL_NAV_ITEMS[id].feature ??
        ALL_NAV_ITEMS[id].module
    )
  );

  if (ia.length > 0) {
    sections.push({
      label: 'INTELIGENCIA IA',
      items: ia.map((id) => ({
        ...ALL_NAV_ITEMS[id],
        id,
      })),
    });
  }

  // ----------------------------------------------------------
  // AULA
  // ----------------------------------------------------------

  const aula = [
    'tablero',
    'evaluaciones',
    'materiales',
  ].filter((id) =>
    hasFeature(
      ALL_NAV_ITEMS[id].feature ??
        ALL_NAV_ITEMS[id].module
    )
  );

  if (aula.length > 0) {
    sections.push({
      label: 'AULA',
      items: aula.map((id) => ({
        ...ALL_NAV_ITEMS[id],
        id,
      })),
    });
  }

  // ----------------------------------------------------------
  // ANALÍTICA E IA
  // ----------------------------------------------------------

  const analytics = [
    'analitica',
    'ia',
  ].filter((id) =>
    hasFeature(
      ALL_NAV_ITEMS[id].feature ??
        ALL_NAV_ITEMS[id].module
    )
  );

  if (analytics.length > 0) {
    sections.push({
      label: 'ANALÍTICA & IA',
      items: analytics.map((id) => ({
        ...ALL_NAV_ITEMS[id],
        id,
      })),
    });
  }

  // ----------------------------------------------------------
  // AVANZADO
  // ----------------------------------------------------------

  const advanced = [
    'integraciones',
    'automatizaciones',
  ].filter((id) =>
    hasFeature(
      ALL_NAV_ITEMS[id].feature ??
        ALL_NAV_ITEMS[id].module
    )
  );

  if (advanced.length > 0) {
    sections.push({
      label: 'AVANZADO',
      items: advanced.map((id) => ({
        ...ALL_NAV_ITEMS[id],
        id,
      })),
    });
  }

  // ----------------------------------------------------------
  // COMUNICACIÓN
  // ----------------------------------------------------------

  const comms = [
    'mensajes',
    'calendario',
  ].filter((id) =>
    hasFeature(
      ALL_NAV_ITEMS[id].feature ??
        ALL_NAV_ITEMS[id].module
    )
  );

  if (comms.length > 0) {
    sections.push({
      label: 'COMUNICACIÓN',
      items: comms.map((id) => ({
        ...ALL_NAV_ITEMS[id],
        id,
      })),
    });
  }

  // ----------------------------------------------------------
  // CUENTA
  // ----------------------------------------------------------

  sections.push({
    label: 'CUENTA',
    items: [
      {
        ...ALL_NAV_ITEMS.configuracion,
        id: 'configuracion',
      },
    ],
  });

  return sections;
}

// ============================================================
// TÍTULOS DE LAS PESTAÑAS
// ============================================================

const TAB_TITLES: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {
  dashboard: {
    title: 'Dashboard',
    subtitle:
      'Resumen general de tus grupos y actividad académica',
  },

  grupos: {
    title: 'Mis Grupos',
    subtitle:
      'Crea y administra tus grupos. Genera códigos de invitación.',
  },

  neurobots: {
    title: 'NeuroBots',
    subtitle:
      'Asistentes IA personalizados para cada clase',
  },

  alertas: {
    title: 'NeuroAlertas',
    subtitle:
      'Inteligencia académica: detecta riesgos y oportunidades',
  },

  tablero: {
    title: 'Tablero',
    subtitle:
      'Publica anuncios, tareas y recursos para tus grupos',
  },

  evaluaciones: {
    title: 'Evaluaciones',
    subtitle:
      'Crea cuestionarios, exámenes y actividades de evaluación',
  },

  materiales: {
    title: 'Materiales',
    subtitle:
      'Repositorio de archivos, presentaciones y recursos',
  },

  mensajes: {
    title: 'Mensajes',
    subtitle:
      'Conversaciones con estudiantes y otros docentes',
  },

  calendario: {
    title: 'Calendario',
    subtitle:
      'Exámenes, tareas, eventos y clases programadas',
  },

  configuracion: {
    title: 'Configuración',
    subtitle:
      'Perfil, notificaciones y preferencias de la cuenta',
  },

  analitica: {
    title: 'Analítica',
    subtitle:
      'Métricas de participación, rendimiento y riesgo académico',
  },

  ia: {
    title: 'IA Generativa',
    subtitle:
      'Crea contenido, evaluaciones y materiales con IA',
  },

  integraciones: {
    title: 'Integraciones',
    subtitle:
      'Conecta NeuroLearn con otras plataformas',
  },

  automatizaciones: {
    title: 'Automatizaciones',
    subtitle:
      'Flujos automáticos basados en eventos académicos',
  },
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function TeacherPanel() {
  const { user, logout } = useAuth();

  const {
    licenseInfo,
    licenseStatus,
    licenseType,
    hasFeature,
  } = useLicense();

  const navigate = useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  // ----------------------------------------------------------
  // PESTAÑA INICIAL
  // ----------------------------------------------------------

  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab =
      searchParams.get('tab');

    const validTabs =
      Object.keys(TAB_TITLES);

    if (
      requestedTab &&
      validTabs.includes(requestedTab)
    ) {
      return requestedTab;
    }

    return 'dashboard';
  });

  // ----------------------------------------------------------
  // ESTADOS
  // ----------------------------------------------------------

  const [
    unreadMsgs,
    setUnreadMsgs,
  ] = useState(0);

  const [
    activeAlerts,
    setActiveAlerts,
  ] = useState(0);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  // ----------------------------------------------------------
  // ESTADÍSTICAS Y MENSAJES
  // ----------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    // --------------------------------------------------------
    // ESTADÍSTICAS DEL PROFESOR
    // --------------------------------------------------------

    api.get('/teacher/stats')
      .then((response) => {
        if (!mounted) return;

        console.log(
          '[TeacherPanel] Teacher stats:',
          response.data
        );

        setActiveAlerts(
          Number(
            response.data?.alert_count ?? 0
          )
        );
      })
      .catch((error) => {
        console.error(
          '[TeacherPanel] Error /teacher/stats:',
          error
        );

        if (mounted) {
          setActiveAlerts(0);
        }
      });

    // --------------------------------------------------------
    // MENSAJES NO LEÍDOS
    // --------------------------------------------------------

    api.get('/messages/conversations')
      .then((response) => {
        if (!mounted) return;

        const conversations =
          response.data?.conversations ??
          response.data ??
          [];

        if (
          !Array.isArray(conversations)
        ) {
          setUnreadMsgs(0);
          return;
        }

        const total =
          conversations.reduce(
            (
              sum: number,
              conversation: any
            ) => {
              return (
                sum +
                Number(
                  conversation?.unread_count ?? 0
                )
              );
            },
            0
          );

        setUnreadMsgs(total);
      })
      .catch((error) => {
        console.error(
          '[TeacherPanel] Error /messages/conversations:',
          error
        );

        if (mounted) {
          setUnreadMsgs(0);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // ----------------------------------------------------------
  // CALLBACK DE INTEGRACIONES
  // ----------------------------------------------------------

  useEffect(() => {
    const ok =
      searchParams.get(
        'integration_ok'
      );

    const provider =
      searchParams.get(
        'integration'
      );

    if (
      ok === '1' &&
      provider
    ) {
      setActiveTab(
        'integraciones'
      );

      setSearchParams(
        {},
        {
          replace: true,
        }
      );
    }
  }, [
    searchParams,
    setSearchParams,
  ]);

  // ----------------------------------------------------------
  // LICENCIA SUSPENDIDA
  // ----------------------------------------------------------

  if (
    licenseStatus === 'suspended'
  ) {
    return (
      <SuspendedScreen
        role="profesor"
      />
    );
  }

  // ----------------------------------------------------------
  // LICENCIA TODAVÍA NO RESUELTA
  //
  // NO usamos "basica" como fallback.
  // La licencia debe venir del backend.
  // ----------------------------------------------------------

  if (
    !licenseInfo ||
    !licenseType
  ) {
    return (
      <div
        className="
          min-h-screen
          bg-[#F7F6F3]
          flex
          items-center
          justify-center
        "
      >
        <div className="text-center">
          <div
            className="
              w-8
              h-8
              border-2
              border-[#D9D9D6]
              border-t-[#2E6FDB]
              rounded-full
              animate-spin
              mx-auto
              mb-3
            "
          />

          <p
            className="
              text-sm
              font-medium
              text-[#37352F]
            "
          >
            Cargando licencia...
          </p>

          <p
            className="
              text-xs
              text-[#787774]
              mt-1
            "
          >
            Verificando los permisos de tu institución
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // INFORMACIÓN REAL DE LICENCIA
  // ----------------------------------------------------------

  const info = licenseInfo;

  // ----------------------------------------------------------
  // LICENCIA PARA LOS COMPONENTES
  //
  // Después del guard anterior, licenseType ya no puede ser null.
  // ----------------------------------------------------------

  const license: TeacherLicense = {
    plan: licenseType,

    groups_limit:
      info.groups_limit,

    students_limit:
      info.students_limit,

    bots_limit:
      info.neurobot_limit === 999999
        ? 'unlimited'
        : info.neurobot_limit,

    expiry_date:
      info.days_left === null
        ? 'Sin fecha'
        : `${info.days_left} días`,
  };

  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ----------------------------------------------------------
  // METADATOS
  // ----------------------------------------------------------

  const meta =
    TAB_TITLES[activeTab] ?? {
      title: activeTab,
      subtitle: '',
    };

  const planStyle =
    planColor(licenseType);

  // ----------------------------------------------------------
  // MENÚ
  // ----------------------------------------------------------

  const navSections =
    buildNavSections(hasFeature);

  // ----------------------------------------------------------
  // NAVEGACIÓN
  // ----------------------------------------------------------

  const handleNav = (
    id: string
  ) => {
    setActiveTab(id);

    setSidebarOpen(false);

    if (id === 'mensajes') {
      setUnreadMsgs(0);
    }
  };

  // ==========================================================
  // BOTÓN DE NAVEGACIÓN
  // ==========================================================

  const NavButton = ({
    id,
    label,
    icon: Icon,
    badge,
  }: any) => {
    const isActive =
      activeTab === id;

    const itemStyle =
      navItemStyle(
        'light',
        isActive,
        {
          planType:
            licenseType,
        }
      );

    return (
      <button
        type="button"
        onClick={() =>
          handleNav(id)
        }
        className={`
          w-full
          flex
          items-center
          gap-2.5
          px-3
          py-[7px]
          rounded-md
          text-[13px]
          transition-colors
          group
          ${itemStyle.stateClass}
        `}
        style={itemStyle.style}
      >
        <Icon
          className={`
            w-4
            h-4
            flex-shrink-0
            ${itemStyle.iconClass}
          `}
        />

        <span
          className="
            flex-1
            text-left
            truncate
          "
        >
          {label}
        </span>

        {badge === 'alert' &&
          activeAlerts > 0 && (
            <span
              className="
                w-4
                h-4
                rounded-full
                bg-[#E03E3E]
                text-white
                text-[9px]
                font-bold
                flex
                items-center
                justify-center
                flex-shrink-0
              "
            >
              {activeAlerts}
            </span>
          )}

        {badge === 'msg' &&
          unreadMsgs > 0 && (
            <span
              className="
                w-4
                h-4
                rounded-full
                bg-[#0B6E99]
                text-white
                text-[9px]
                font-bold
                flex
                items-center
                justify-center
                flex-shrink-0
              "
            >
              {unreadMsgs}
            </span>
          )}

        {isActive && (
          <ChevronRight
            className="
              w-3
              h-3
              text-[#9B9A97]
              flex-shrink-0
            "
          />
        )}
      </button>
    );
  };

  // ==========================================================
  // SIDEBAR
  // ==========================================================

  const SidebarContent = () => (
    <>
      {/* ====================================================
          LOGO + USUARIO
      ==================================================== */}

      <div
        className="
          px-3
          pt-4
          pb-3
          border-b
          border-[#E9E9E7]
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
            mb-4
            px-1
          "
        >
          <img
            src={`${import.meta.env.BASE_URL}2d.png`}
            alt="NeuroLearn"
            className="
              w-6
              h-6
              object-contain
              rounded-md
              bg-white
              flex-shrink-0
            "
          />

          <div>
            <p
              className="
                text-[13px]
                font-bold
                text-[#191919]
                leading-tight
              "
            >
              NeuroLearn
            </p>

            <p
              className="
                text-[10px]
                text-[#787774]
              "
            >
              Panel Docente
            </p>
          </div>
        </div>

        {/* USUARIO */}

        <div
          className="
            flex
            items-center
            gap-2.5
            px-2
            py-2
            rounded-md
            hover:bg-[#EBEBEA]
            cursor-pointer
            transition-colors
          "
        >
          <div
            className="
              w-7
              h-7
              rounded-md
              bg-[#2E6FDB]
              text-white
              flex
              items-center
              justify-center
              font-bold
              text-xs
              flex-shrink-0
              overflow-hidden
            "
          >
            {user?.photo ? (
              <img
                src={user.photo}
                alt="foto de perfil"
                className="
                  w-full
                  h-full
                  object-cover
                "
              />
            ) : (
              (
                user?.full_name ||
                'P'
              )
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div
            className="
              overflow-hidden
              flex-1
            "
          >
            <p
              className="
                text-[12.5px]
                font-semibold
                text-[#37352F]
                truncate
                leading-tight
              "
            >
              {user?.full_name ||
                user?.username}
            </p>

            <p
              className="
                text-[10px]
                text-[#787774]
                truncate
              "
            >
              Docente
            </p>
          </div>

          <span
            className={`
              text-[9px]
              font-bold
              px-1.5
              py-0.5
              rounded
              ${planStyle.className}
              flex-shrink-0
            `}
          >
            {planStyle.label}
          </span>
        </div>
      </div>

      {/* ====================================================
          NAVEGACIÓN
      ==================================================== */}

      <nav
        className="
          flex-1
          overflow-y-auto
          px-2
          py-3
          space-y-4
        "
      >
        {navSections.map(
          (section) => (
            <div
              key={section.label}
            >
              <p
                className="
                  px-3
                  mb-1
                  text-[10px]
                  font-semibold
                  text-[#AEADAB]
                  uppercase
                  tracking-widest
                "
              >
                {section.label}
              </p>

              <div
                className="
                  space-y-0.5
                "
              >
                {section.items.map(
                  (item) => (
                    <NavButton
                      key={item.id}
                      {...item}
                    />
                  )
                )}
              </div>
            </div>
          )
        )}
      </nav>

      {/* ====================================================
          PIE DEL SIDEBAR
      ==================================================== */}

      <div
        className="
          px-2
          pb-3
          pt-2
          border-t
          border-[#E9E9E7]
          space-y-0.5
        "
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab(
              'configuracion'
            );

            setSidebarOpen(false);
          }}
          className="
            w-full
            flex
            items-center
            gap-2.5
            px-3
            py-[7px]
            text-[13px]
            text-[#787774]
            hover:bg-[#EBEBEA]
            hover:text-[#37352F]
            rounded-md
            transition-colors
          "
        >
          <Bell className="w-4 h-4" />

          <span>
            Notificaciones
          </span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="
            w-full
            flex
            items-center
            gap-2.5
            px-3
            py-[7px]
            text-[13px]
            text-[#787774]
            hover:bg-[#FDEEEE]
            hover:text-[#E03E3E]
            rounded-md
            transition-colors
          "
        >
          <LogOut className="w-4 h-4" />

          <span>
            Cerrar sesión
          </span>
        </button>
      </div>
    </>
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className="
        flex
        h-screen
        bg-[#F7F6F3]
        overflow-hidden
      "
    >
      {/* ====================================================
          SIDEBAR DESKTOP
      ==================================================== */}

      <aside
        className="
          hidden
          lg:flex
          lg:flex-col
          w-60
          border-r
          border-[#E9E9E7]
          flex-shrink-0
        "
        style={{
          background:
            planStyle.background,
        }}
      >
        <SidebarContent />
      </aside>

      {/* ====================================================
          HEADER MOBILE
      ==================================================== */}

      <div
        className="
          lg:hidden
          fixed
          top-0
          left-0
          right-0
          z-40
          h-12
          bg-[#F7F6F3]
          border-b
          border-[#E9E9E7]
          flex
          items-center
          justify-between
          px-4
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <img
            src={`${import.meta.env.BASE_URL}2d.png`}
            alt="NeuroLearn"
            className="
              w-6
              h-6
              object-contain
              rounded-md
              bg-white
            "
          />

          <span
            className="
              text-[13px]
              font-bold
              text-[#191919]
            "
          >
            NeuroLearn
          </span>

          <span
            className="
              text-[10px]
              text-[#787774]
              ml-1
            "
          >
            Docente
          </span>
        </div>

        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <span
            className="
              text-[11px]
              font-semibold
              text-[#787774]
              truncate
              max-w-[120px]
              hidden
              sm:block
            "
          >
            {meta.title}
          </span>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(
                (open) => !open
              )
            }
            className="
              p-1.5
              rounded-md
              text-[#787774]
              hover:bg-[#EBEBEA]
              transition-colors
            "
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* ====================================================
          SIDEBAR MOBILE
      ==================================================== */}

      {sidebarOpen && (
        <div
          className="
            lg:hidden
            fixed
            inset-0
            z-30
            bg-black/30
          "
          onClick={() =>
            setSidebarOpen(false)
          }
        >
          <div
            className="
              absolute
              left-0
              top-12
              bottom-0
              w-64
              border-r
              border-[#E9E9E7]
              flex
              flex-col
              overflow-y-auto
            "
            style={{
              background:
                planStyle.background,
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ====================================================
          CONTENIDO PRINCIPAL
      ==================================================== */}

      <div
        className="
          flex-1
          flex
          flex-col
          overflow-hidden
          bg-white
        "
      >
        {/* BANNER */}

        <LicenseBanner
          showContactButton={true}
        />

        {/* HEADER DESKTOP */}

        <header
          className="
            hidden
            lg:flex
            flex-shrink-0
            px-6
            xl:px-8
            py-4
            xl:py-5
            border-b
            border-[#E9E9E7]
            bg-white
            items-center
            justify-between
          "
        >
          <div>
            <h1
              className="
                text-xl
                font-bold
                text-[#191919]
                leading-tight
              "
            >
              {meta.title}
            </h1>

            <p
              className="
                text-sm
                text-[#787774]
                mt-0.5
              "
            >
              {meta.subtitle}
            </p>
          </div>

          {/* ------------------------------------------------
              NEUROINSIGHTS
              Solo se muestra si el plan tiene NeuroAlertas.
          ------------------------------------------------ */}

          {hasFeature('neuroalertas') && (
            <button
              type="button"
              onClick={() =>
                setActiveTab('alertas')
              }
              className="
                hidden
                sm:flex
                items-center
                gap-2
                px-3
                py-1.5
                bg-[#EEF3FD]
                text-[#2E6FDB]
                border
                border-[#C5D9F7]
                rounded-lg
                text-xs
                font-medium
                hover:bg-[#2E6FDB]
                hover:text-white
                transition-colors
              "
            >
              <Zap className="w-3.5 h-3.5" />

              NeuroInsights
            </button>
          )}
        </header>

        {/* ==================================================
            CONTENIDO
        ================================================== */}

        <main
          className="
            flex-1
            overflow-y-auto
          "
        >
          <div
            className="
              pt-12
              lg:pt-0
              p-4
              sm:p-6
              xl:p-8
              max-w-7xl
              mx-auto
            "
          >
            {/* DASHBOARD */}

            {activeTab === 'dashboard' && (
              <DashboardTab
                license={license}
                onNavigate={setActiveTab}
              />
            )}

            {/* GRUPOS */}

            {activeTab === 'grupos' &&
              hasFeature('gestion_grupos') && (
                <MisGruposTab
                  license={license}
                />
              )}

            {/* NEUROBOTS */}

            {activeTab === 'neurobots' &&
              hasFeature('neurobots') && (
                <NeuroBotsTab
                  license={license}
                />
              )}

            {/* ALERTAS */}

            {activeTab === 'alertas' &&
              hasFeature('neuroalertas') && (
                <NeuroAlertasTab />
              )}

            {/* TABLERO */}

            {activeTab === 'tablero' &&
              hasFeature('anuncios') && (
                <TableroTab />
              )}

            {/* EVALUACIONES */}

            {activeTab === 'evaluaciones' &&
              hasFeature('evaluaciones') && (
                <EvaluacionesTab
                  license={license}
                />
              )}

            {/* MATERIALES */}

            {activeTab === 'materiales' &&
              hasFeature('recursos') && (
                <MaterialesTab
                  license={license}
                />
              )}

            {/* MENSAJES */}

            {activeTab === 'mensajes' &&
              hasFeature('mensajes') && (
                <MensajesTab />
              )}

            {/* CALENDARIO */}

            {activeTab === 'calendario' &&
              hasFeature('calendario') && (
                <CalendarioTab />
              )}

            {/* CONFIGURACIÓN */}

            {activeTab === 'configuracion' && (
              <ConfiguracionTab
                user={user}
              />
            )}

            {/* ANALÍTICA */}

            {activeTab === 'analitica' &&
              hasFeature('advanced_analytics') && (
                <AnaliticaTab
                  onNavigate={setActiveTab}
                />
              )}

            {/* IA */}

            {activeTab === 'ia' &&
              hasFeature('teacher_ai') && (
                <IAGenerativaTab />
              )}

            {/* INTEGRACIONES */}

            {activeTab === 'integraciones' &&
              hasFeature('integrations') && (
                <IntegracionesTab
                  onNavigate={setActiveTab}
                />
              )}

            {/* AUTOMATIZACIONES */}

            {activeTab === 'automatizaciones' &&
              hasFeature('automation') && (
                <AutomatizacionesTab
                  onNavigate={setActiveTab}
                />
              )}
          </div>
        </main>
      </div>
    </div>
  );
}