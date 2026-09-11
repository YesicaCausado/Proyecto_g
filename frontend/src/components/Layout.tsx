import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { planColor } from '../styles/plan';
import LicenseBanner from './LicenseBanner';
import SuspendedScreen from './SuspendedScreen';
import { COMPETENCIES } from '../data/competencies';
import {
  LogOut,
  Home,
  MessageSquare,
  BookOpen,
  Users,
  Menu,
  X,
  TrendingUp,
  BookMarked,
  ChevronRight,
  LayoutList,
  Calendar,
  Settings,
  Trophy,
  History,
  Play,
  Target,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { navItemStyle } from '../styles/sidebar';

type NavModule =
  | 'mis_cursos'
  | 'tutor_ia'
  | 'evaluaciones'
  | 'estadisticas'
  | 'recursos'
  | 'mensajes'
  | 'calendario'
  | 'perfil';

interface NavLinkItem {
  id: string;
  type: 'link';
  to: string;
  label: string;
  icon: string; // nombre de icono resuelto en render
  module?: NavModule;
}

interface NavGroupItem {
  id: string;
  type: 'group';
  label: string;
  icon: string;
  module?: NavModule;
  children: NavLinkItem[];
}

type NavItem = NavLinkItem | NavGroupItem;

interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Estado visual diferenciado de cada opción del menú.
 * Paleta NeuroLearn: blanco / gris / negro / azul (#0B6E99).
 */
const iconMap: Record<string, ReactNode> = {
  home: <Home className="w-4 h-4" />,
  compe: <BookOpen className="w-4 h-4" />,
  desafios: <Trophy className="w-4 h-4" />,
  material: <BookMarked className="w-4 h-4" />,
  clases: <Users className="w-4 h-4" />,
  tablero: <LayoutList className="w-4 h-4" />,
  calendario: <Calendar className="w-4 h-4" />,
  mensajes: <MessageSquare className="w-4 h-4" />,
  perfil: <Settings className="w-4 h-4" />,
  play: <Play className="w-4 h-4" />,
  historial: <History className="w-4 h-4" />,
  desempeno: <TrendingUp className="w-4 h-4" />,
  meta: <Target className="w-4 h-4" />,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { hasStudentModule, licenseStatus, licenseType } = useLicense();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isTeacher = user?.role === 'profesor';
  const plan = planColor(licenseType);

  // Pantalla de suspensión
  if (licenseStatus === 'suspended' && user?.role === 'estudiante') {
    return <SuspendedScreen role="estudiante" />;
  }

  const exact = (path: string) => location.pathname === path;

  const navSections = (isTeacher
    ? [
        {
          label: 'PRINCIPAL',
          items: [
            { id: 'inicio', type: 'link', to: '/dashboard', label: 'Inicio', icon: 'home' },
            { id: 'mis-clases', type: 'link', to: '/classrooms', label: 'Mis Clases', icon: 'clases' },
          ],
        },
      ]
    : [
        {
          label: 'INICIO',
          items: [
            { id: 'inicio', type: 'link', to: '/dashboard', label: 'Inicio', icon: 'home' },
          ],
        },
        {
          label: 'APRENDIZAJE',
          items: [
            {
              id: 'competencias',
              type: 'group',
              label: 'Competencias',
              icon: 'compe',
              module: 'tutor_ia',
              children: COMPETENCIES.map((c) => ({
                id: `comp-${c.slug}`,
                type: 'link' as const,
                to: `/chat/${c.slug}`,
                label: c.name,
                icon: c.key,
              })),
            },
            {
              id: 'desafios',
              type: 'group',
              label: 'Desafíos',
              icon: 'desafios',
              children: [
                { id: 'realizar', type: 'link', to: '/quizzes', label: 'Realizar quiz', icon: 'play', module: 'evaluaciones' },
                { id: 'historial', type: 'link', to: '/quizzes/history', label: 'Historial de quizzes', icon: 'historial', module: 'evaluaciones' },
                { id: 'desempeno', type: 'link', to: '/performance', label: 'Desempeño', icon: 'desempeno', module: 'estadisticas' },
              ],
            },
            { id: 'material', type: 'link', to: '/material', label: 'Material de Apoyo', icon: 'material', module: 'recursos' },
          ].filter((i: any) => !i.module || hasStudentModule(i.module)),
        },
        {
          label: 'MI INSTITUCIÓN',
          items: [
            { id: 'mis-clases', type: 'link', to: '/my-classes', label: 'Mis Clases', icon: 'clases', module: 'mis_cursos' },
            { id: 'tablero', type: 'link', to: '/tablero', label: 'Tablero', icon: 'tablero', module: 'mis_cursos' },
            { id: 'calendario', type: 'link', to: '/calendar', label: 'Calendario', icon: 'calendario', module: 'calendario' },
          ].filter((i: any) => !i.module || hasStudentModule(i.module)),
        },
        {
          label: 'COMUNICACIÓN',
          items: [
            { id: 'mensajes', type: 'link', to: '/messages', label: 'Mensajes', icon: 'mensajes', module: 'mensajes' },
          ].filter((i: any) => !i.module || hasStudentModule(i.module)),
        },
        {
          label: 'CUENTA',
          items: [
            { id: 'perfil', type: 'link', to: '/settings', label: 'Mi Perfil', icon: 'perfil' },
          ],
        },
      ].filter((sec) => sec.items.length > 0)) as NavSection[];

  // ── Estado activo de una opción ──────────────────────────────────────
  const linkActive = (item: NavLinkItem): boolean => exact(item.to);
  const groupActive = (group: NavGroupItem): boolean =>
    group.children.some((c) => linkActive(c));

  // Mostrar grupos abiertos según la ruta actual (para mantener coherencia).
  const defaultOpenGroups = (): Set<string> => {
    const s = new Set<string>();
    for (const section of navSections) {
      for (const item of section.items) {
        if (item.type === 'group' && groupActive(item)) s.add(item.id);
      }
    }
    return s;
  };
  const [openGroups, setOpenGroups] = useState<Set<string>>(defaultOpenGroups);
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Mantener coherencia: al navegar, abre automáticamente el grupo activo
  // (p. ej. "Competencias" al entrar a /chat/matematicas, "Desafíos" en
  // /quizzes o /performance).
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const section of navSections) {
        for (const item of section.items) {
          if (item.type === 'group' && groupActive(item)) next.add(item.id);
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const initials = (user?.full_name || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // ─── Estilos reutilizables por estado (compartidos con todos los paneles) ──
  const linkClass = (active: boolean) =>
    `group flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13.5px] font-medium transition-all duration-150 ${navItemStyle('light', active, { planType: licenseType }).stateClass}`;
  const skipModule = (item: NavItem): boolean =>
    !!item.module && !hasStudentModule(item.module);

  // ─── Sidebar inner ─────────────────────────────────────────────────────────
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-[#E9E9E7]">
        <div className="flex items-center gap-2.5">
          <img
            src="/2d.png"
            alt="NeuroLearn"
            className="w-8 h-8 object-contain rounded-md bg-white flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#37352F] leading-tight tracking-tight">
              NeuroLearn
            </p>
            <p className="text-[10px] text-[#787774] font-medium tracking-wide">Saber 11 ICFES</p>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1 text-[10px] font-semibold text-[#AEADAB] uppercase tracking-widest">
              {section.label}
            </p>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                if (item.type === 'link') {
                  if (skipModule(item)) return null;
                  const active = linkActive(item);
                  const icon = iconMap[item.icon] ?? null;
                  const st = navItemStyle('light', active, { planType: licenseType });
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      onClick={() => mobile && setSidebarOpen(false)}
                      className={linkClass(active)}
                      style={st.style}
                    >
                      <span className={st.iconClass}>{icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && (
                        <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: plan.accent }} />
                      )}
                    </Link>
                  );
                }

                // ── Grupo con submenú (Competencias / Desafíos) ──
                const open = openGroups.has(item.id);
                const groupIsActive = groupActive(item);
                const visibleChildren = item.children.filter((c) => !skipModule(c));
                if (visibleChildren.length === 0) return null;

                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.id)}
                      className={`group w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13.5px] font-medium transition-all duration-150 ${navItemStyle('light', groupIsActive, { planType: licenseType }).stateClass}`}
                      style={navItemStyle('light', groupIsActive, { planType: licenseType }).style}
                      aria-expanded={open}
                    >
                      <span className={navItemStyle('light', groupIsActive, { planType: licenseType }).iconClass}>
                        {iconMap[item.icon]}
                      </span>
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 ml-auto flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''} ${
                          groupIsActive ? '' : 'text-[#AEADAB]'
                        }`}
                        style={groupIsActive ? { color: plan.accent } : undefined}
                      />
                    </button>

                    {/* Submenú */}
                    {open && (
                      <div className="mt-0.5 ml-3 pl-2.5 border-l border-[#E3E6EA] space-y-0.5 animate-fadeIn">
                        {visibleChildren.map((child) => {
                          const cActive = linkActive(child);
                          const cIcon = iconMap[child.icon] ?? null;
                          return (
                            <Link
                              key={child.id}
                              to={child.to}
                              onClick={() => mobile && setSidebarOpen(false)}
                              className={`group flex items-center gap-2.5 pl-2 pr-2.5 py-[6px] rounded-md text-[13px] font-medium transition-all duration-150 ${navItemStyle('light', cActive, { planType: licenseType }).stateClass}`}
                              style={navItemStyle('light', cActive, { planType: licenseType }).style}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                                  cActive ? '' : 'bg-[#C4C8CC] group-hover:bg-[#2F5B80]'
                                }`}
                                style={cActive ? { background: plan.accent } : undefined}
                              />
                              <span className="flex-1 truncate">{child.label}</span>
                              {cIcon && (
                                <span className={navItemStyle('light', cActive, { planType: licenseType }).iconClass}>{cIcon}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="border-t border-[#E9E9E7] p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#F1F1EF] flex items-center justify-center text-[#37352F] text-[11px] font-bold flex-shrink-0 select-none overflow-hidden">
            {user?.photo
              ? <img src={user.photo} alt="foto de perfil" className="w-full h-full object-cover" />
              : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-[#37352F] truncate leading-tight">
              {user?.full_name || user?.username}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-[#787774] capitalize truncate">{user?.role}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${plan.className}`}>
                {plan.label}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-md text-[#9B9A97] hover:text-[#37352F] hover:bg-[#F1F1EF] transition-colors flex-shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex h-screen bg-white text-[#37352F]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Sidebar Desktop ── */}
      <aside
        className="hidden md:flex md:flex-col md:w-[240px] flex-shrink-0 border-r border-[#E9E9E7]"
        style={{ background: plan.background }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-[#E9E9E7] z-40 h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img
            src="/2d.png"
            alt="NeuroLearn"
            className="w-7 h-7 object-contain rounded-md bg-white"
          />
          <span
            className="text-[14px] font-semibold text-[#37352F] tracking-tight"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            NeuroLearn
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${plan.className}`}>
            {plan.label}
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-md text-[#787774] hover:bg-[#F1F1EF] transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/20"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-12 bottom-0 w-[240px] border-r border-[#E9E9E7]"
            style={{ background: plan.background }}
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Banner de licencia para estudiante */}
        {!isTeacher && <LicenseBanner showContactButton={false} />}
        <div className="pt-12 md:pt-0 pb-16 md:pb-0 min-h-full flex-1">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav (estudiante) ── */}
      {!isTeacher && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E9E9E7] flex items-center justify-around px-1 h-16 safe-area-pb">
          {(() => {
            const items: { to: string; label: string; icon: ReactNode; module: NavModule; active: boolean }[] = [
              { to: '/dashboard', label: 'Inicio', icon: <Home className="w-5 h-5" />, module: 'inicio' as NavModule, active: exact('/dashboard') },
              { to: '/chat', label: 'Competencias', icon: <BookOpen className="w-5 h-5" />, module: 'tutor_ia' as NavModule, active: location.pathname.startsWith('/chat') },
              { to: '/quizzes', label: 'Desafíos', icon: <Trophy className="w-5 h-5" />, module: 'evaluaciones' as NavModule, active: location.pathname.startsWith('/quizzes') || exact('/performance') },
              { to: '/my-classes', label: 'Clases', icon: <Users className="w-5 h-5" />, module: 'mis_cursos' as NavModule, active: location.pathname.startsWith('/my-classes') },
              { to: '/settings', label: 'Perfil', icon: <Settings className="w-5 h-5" />, module: 'perfil' as NavModule, active: exact('/settings') },
            ].filter((i) => !i.module || hasStudentModule(i.module));
            return items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className="flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px]"
              >
                <span className={`transition-colors ${item.active ? '' : 'text-[#AEADAB]'}`} style={item.active ? { color: plan.accent } : undefined}>{item.icon}</span>
                <span className={`text-[10px] font-medium transition-colors ${item.active ? '' : 'text-[#AEADAB]'}`} style={item.active ? { color: plan.accent } : undefined}>{item.label}</span>
              </Link>
            ));
          })()}
        </nav>
      )}
    </div>
  );
}