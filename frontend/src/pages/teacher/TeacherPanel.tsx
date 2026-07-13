import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

import DashboardTab      from './components/DashboardTab';
import MisGruposTab      from './components/MisGruposTab';
import NeuroBotsTab      from './components/NeuroBotsTab';
import NeuroAlertasTab   from './components/NeuroAlertasTab';
import TableroTab        from './components/TableroTab';
import EvaluacionesTab   from './components/EvaluacionesTab';
import MaterialesTab     from './components/MaterialesTab';
import MensajesTab       from './components/MensajesTab';
import CalendarioTab     from './components/CalendarioTab';
import ConfiguracionTab  from './components/ConfiguracionTab';

import {
  LayoutDashboard, BookOpen, Bot, BrainCircuit, LayoutList,
  ClipboardList, FolderOpen, MessageSquare, Calendar,
  Settings, LogOut, Bell, ChevronRight, Brain, Zap, Menu, X,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type LicensePlan = 'basica' | 'premium' | 'pro';

interface TeacherLicense {
  plan: LicensePlan;
  groups_limit: number;
  students_limit: number;
  bots_limit: number | 'unlimited';
  expiry_date: string;
}

// ── Demo datos ────────────────────────────────────────────────────────────────
const DEMO_LICENSE: TeacherLicense = {
  plan: 'premium',
  groups_limit: 30,
  students_limit: 1500,
  bots_limit: 10,
  expiry_date: '2027-01-15',
};

const PLAN_COLORS: Record<LicensePlan, { bg: string; text: string; label: string }> = {
  basica:   { bg: 'bg-[#F7F6F3]',   text: 'text-[#787774]', label: 'Básica'   },
  premium:  { bg: 'bg-amber-50',    text: 'text-amber-700',  label: 'Premium'  },
  pro:      { bg: 'bg-purple-50',   text: 'text-[#6940A5]',  label: 'Pro ✦'   },
};

// ── Secciones del menú ────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'PRINCIPAL',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { id: 'grupos',       label: 'Mis Grupos',   icon: BookOpen        },
    ],
  },
  {
    label: 'INTELIGENCIA IA',
    items: [
      { id: 'neurobots',    label: 'NeuroBots',    icon: Bot                          },
      { id: 'alertas',      label: 'NeuroAlertas', icon: BrainCircuit, badge: 'alert' },
    ],
  },
  {
    label: 'AULA',
    items: [
      { id: 'tablero',      label: 'Tablero',      icon: LayoutList                   },
      { id: 'evaluaciones', label: 'Evaluaciones', icon: ClipboardList                },
      { id: 'materiales',   label: 'Materiales',   icon: FolderOpen                   },
    ],
  },
  {
    label: 'COMUNICACIÓN',
    items: [
      { id: 'mensajes',     label: 'Mensajes',     icon: MessageSquare, badge: 'msg' },
      { id: 'calendario',   label: 'Calendario',   icon: Calendar                    },
    ],
  },
  {
    label: 'CUENTA',
    items: [
      { id: 'configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard:     { title: 'Dashboard',          subtitle: 'Resumen general de tus grupos y actividad académica' },
  grupos:        { title: 'Mis Grupos',          subtitle: 'Crea y administra tus grupos. Genera códigos de invitación.' },
  neurobots:     { title: 'NeuroBots',           subtitle: 'Asistentes IA personalizados para cada clase' },
  alertas:       { title: 'NeuroAlertas',        subtitle: 'Inteligencia académica: detecta riesgos y oportunidades' },
  tablero:       { title: 'Tablero',             subtitle: 'Publica anuncios, tareas y recursos para tus grupos' },
  evaluaciones:  { title: 'Evaluaciones',        subtitle: 'Crea cuestionarios, exámenes y actividades de evaluación' },
  materiales:    { title: 'Materiales',          subtitle: 'Repositorio de archivos, presentaciones y recursos' },
  mensajes:      { title: 'Mensajes',            subtitle: 'Conversaciones con estudiantes y otros docentes' },
  calendario:    { title: 'Calendario',          subtitle: 'Exámenes, tareas, eventos y clases programadas' },
  configuracion: { title: 'Configuración',       subtitle: 'Perfil, notificaciones y preferencias de la cuenta' },
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function TeacherPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [license]  = useState<TeacherLicense>(DEMO_LICENSE);
  const [_groups, setGroups]         = useState<any[]>([]);
  const [unreadMsgs,  setUnreadMsgs] = useState(0);
  const [activeAlerts,setActiveAlerts] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.get('/classrooms/my-classes').then(r => setGroups(r.data?.classrooms || [])).catch(() => {});
    // Real alert count from teacher stats
    api.get('/teacher/stats')
      .then(r => setActiveAlerts(r.data?.alert_count ?? 0))
      .catch(() => {});
    // Real unread message count
    api.get('/messages/conversations')
      .then(r => {
        const convs = r.data?.conversations ?? r.data ?? [];
        const total = convs.reduce((sum: number, c: any) => sum + (c.unread_count ?? 0), 0);
        setUnreadMsgs(total);
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const meta = TAB_TITLES[activeTab] ?? { title: activeTab, subtitle: '' };
  const planStyle = PLAN_COLORS[license.plan];

  const handleNav = (id: string) => {
    setActiveTab(id);
    setSidebarOpen(false);
    if (id === 'mensajes') setUnreadMsgs(0);
  };

  // ── NavButton ──
  const NavButton = ({ id, label, icon: Icon, badge }: any) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => handleNav(id)}
        className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors group ${
          isActive
            ? 'bg-white font-semibold text-[#191919] shadow-sm border border-[#E9E9E7]'
            : 'text-[#787774] hover:bg-[#EBEBEA] hover:text-[#37352F] border border-transparent'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#2E6FDB]' : 'text-[#9B9A97] group-hover:text-[#37352F]'}`} />
        <span className="flex-1 text-left truncate">{label}</span>
        {badge === 'alert' && activeAlerts > 0 && (
          <span className="w-4 h-4 rounded-full bg-[#E03E3E] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
            {activeAlerts}
          </span>
        )}
        {badge === 'msg' && unreadMsgs > 0 && (
          <span className="w-4 h-4 rounded-full bg-[#0B6E99] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
            {unreadMsgs}
          </span>
        )}
        {isActive && <ChevronRight className="w-3 h-3 text-[#9B9A97] flex-shrink-0" />}
      </button>
    );
  };

  // ── Sidebar inner content ──
  const SidebarContent = () => (
    <>
      {/* Logo + usuario */}
      <div className="px-3 pt-4 pb-3 border-b border-[#E9E9E7]">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-6 h-6 bg-[#2E6FDB] rounded-md flex items-center justify-center flex-shrink-0">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#191919] leading-tight">NeuroLearn</p>
            <p className="text-[10px] text-[#787774]">Panel Docente</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[#EBEBEA] cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-md bg-[#2E6FDB] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            {(user?.full_name || 'P').charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-[12.5px] font-semibold text-[#37352F] truncate leading-tight">
              {user?.full_name || user?.username}
            </p>
            <p className="text-[10px] text-[#787774] truncate">Docente</p>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${planStyle.bg} ${planStyle.text} flex-shrink-0`}>
            {planStyle.label}
          </span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-[#AEADAB] uppercase tracking-widest">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => <NavButton key={item.id} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie */}
      <div className="px-2 pb-3 pt-2 border-t border-[#E9E9E7] space-y-0.5">
        <button
          onClick={() => { setActiveTab('configuracion'); setSidebarOpen(false); }}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-[#787774] hover:bg-[#EBEBEA] hover:text-[#37352F] rounded-md transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span>Notificaciones</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-[#787774] hover:bg-[#FDEEEE] hover:text-[#E03E3E] rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F7F6F3] overflow-hidden">

      {/* ══ SIDEBAR DESKTOP ══════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-[#F7F6F3] border-r border-[#E9E9E7] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ══ MOBILE HEADER ════════════════════════════════════════════════════ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-[#F7F6F3] border-b border-[#E9E9E7] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#2E6FDB] rounded-md flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[13px] font-bold text-[#191919]">NeuroLearn</span>
          <span className="text-[10px] text-[#787774] ml-1">Docente</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#787774] truncate max-w-[120px] hidden sm:block">
            {meta.title}
          </span>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-md text-[#787774] hover:bg-[#EBEBEA] transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ══ MOBILE SIDEBAR OVERLAY ═══════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-12 bottom-0 w-64 bg-[#F7F6F3] border-r border-[#E9E9E7] flex flex-col overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ══ CONTENT ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">

        {/* Header — desktop only */}
        <header className="hidden lg:flex flex-shrink-0 px-6 xl:px-8 py-4 xl:py-5 border-b border-[#E9E9E7] bg-white items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#191919] leading-tight">{meta.title}</h1>
            <p className="text-sm text-[#787774] mt-0.5">{meta.subtitle}</p>
          </div>
          <button
            onClick={() => setActiveTab('alertas')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#EEF3FD] text-[#2E6FDB] border border-[#C5D9F7] rounded-lg text-xs font-medium hover:bg-[#2E6FDB] hover:text-white transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            NeuroInsights
          </button>
        </header>

        {/* Contenido scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="pt-12 lg:pt-0 p-4 sm:p-6 xl:p-8 max-w-7xl mx-auto">

            {activeTab === 'dashboard'    && <DashboardTab license={license} onNavigate={setActiveTab} />}
            {activeTab === 'grupos'       && <MisGruposTab license={license} />}
            {activeTab === 'neurobots'    && <NeuroBotsTab license={license} />}
            {activeTab === 'alertas'      && <NeuroAlertasTab />}
            {activeTab === 'tablero'      && <TableroTab />}
            {activeTab === 'evaluaciones' && <EvaluacionesTab license={license} />}
            {activeTab === 'materiales'   && <MaterialesTab license={license} />}
            {activeTab === 'mensajes'     && <MensajesTab />}
            {activeTab === 'calendario'   && <CalendarioTab />}
            {activeTab === 'configuracion'&& <ConfiguracionTab user={user} />}

          </div>
        </main>
      </div>
    </div>
  );
}
