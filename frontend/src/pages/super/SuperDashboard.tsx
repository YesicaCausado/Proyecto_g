import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import DashboardGeneral from './components/DashboardGeneral';
import { TeachersTab, StudentsTab } from './components/UsersTabs';
import NeuroAlertasTab from './components/NeuroAlertasTab';
import GruposTab from './components/GruposTab';
import ConfiguracionTab from './components/ConfiguracionTab';
import LicenciaTab from './components/LicenciaTab';
import ReportesTab from './components/ReportesTab';
import NeuroBots from './components/NeuroBots';
import MensajeriaTab from './components/MensajeriaTab';
import CalendarioTab from './components/CalendarioTab';
import AuditoriaTab from './components/AuditoriaTab';
import SeguridadTab from './components/SeguridadTab';
import {
  ShieldCheck, LogOut, Users, GraduationCap, LayoutDashboard,
  BrainCircuit, Settings, Bell, BookOpen, Bot, FileText,
  MessageSquare, Calendar, Shield, CreditCard, Lock, ChevronRight,
  Brain, Menu, X
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'PRINCIPAL',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { id: 'profesores',   label: 'Profesores',   icon: Users },
      { id: 'estudiantes',  label: 'Estudiantes',  icon: GraduationCap },
      { id: 'grupos',       label: 'Grupos',       icon: BookOpen },
      { id: 'neurobots',    label: 'NeuroBots',    icon: Bot },
      { id: 'alertas',      label: 'NeuroAlertas', icon: BrainCircuit, badge: 'red' },
    ],
  },
  {
    label: 'INFORMES',
    items: [
      { id: 'reportes',     label: 'Reportes',     icon: FileText },
      { id: 'mensajeria',   label: 'Mensajería',   icon: MessageSquare },
      { id: 'calendario',   label: 'Calendario',   icon: Calendar },
      { id: 'auditoria',    label: 'Auditoría',    icon: Shield },
    ],
  },
  {
    label: 'INSTITUCIÓN',
    items: [
      { id: 'configuracion', label: 'Configuración', icon: Settings },
      { id: 'licencia',      label: 'Licencia',      icon: CreditCard },
      { id: 'seguridad',     label: 'Seguridad',     icon: Lock },
    ],
  },
];

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard:     { title: 'Dashboard',            subtitle: 'Resumen ejecutivo de la institución' },
  profesores:    { title: 'Gestión de Profesores', subtitle: 'Crea y administra credenciales docentes' },
  estudiantes:   { title: 'Gestión de Estudiantes', subtitle: 'Administra los estudiantes y sus accesos' },
  grupos:        { title: 'Grupos & Aulas',        subtitle: 'Visualiza todos los grupos activos' },
  neurobots:     { title: 'NeuroBots',             subtitle: 'Bots de aprendizaje creados en la institución' },
  alertas:       { title: 'NeuroAlertas IA',       subtitle: 'Alertas inteligentes generadas por el sistema' },
  reportes:      { title: 'Reportes',              subtitle: 'Genera reportes institucionales en PDF' },
  mensajeria:    { title: 'Mensajería',            subtitle: 'Comunicación con profesores y estudiantes' },
  calendario:    { title: 'Calendario Institucional', subtitle: 'Eventos, exámenes y fechas importantes' },
  auditoria:     { title: 'Auditoría',             subtitle: 'Registro de todas las acciones del sistema' },
  configuracion: { title: 'Configuración',         subtitle: 'Datos y personalización de la institución' },
  licencia:      { title: 'Gestión de Licencia',   subtitle: 'Plan, uso y renovación de licencia' },
  seguridad:     { title: 'Seguridad',             subtitle: 'Sesiones, 2FA e historial de accesos' },
};

export default function SuperDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [license, setLicense] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    api.get('/super/license-usage').then(r => setLicense(r.data)).catch(() => {});
    api.get('/credentials/super/teachers').then(r => setTeachers(r.data)).catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const currentMeta = TAB_TITLES[activeTab] ?? { title: activeTab, subtitle: '' };

  const handleNav = (id: string) => { setActiveTab(id); setSidebarOpen(false); };

  const NavButton = ({ id, label, icon: Icon, badge }: any) => (
    <button
      key={id}
      onClick={() => handleNav(id)}
      className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors group ${
        activeTab === id
          ? 'bg-white font-semibold text-[#191919] shadow-sm border border-[#E9E9E7]'
          : 'text-[#787774] hover:bg-[#EBEBEA] hover:text-[#37352F] border border-transparent'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? 'text-[#6940A5]' : 'text-[#9B9A97] group-hover:text-[#37352F]'}`} />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge === 'red' && <span className="w-2 h-2 rounded-full bg-[#E03E3E] animate-pulse flex-shrink-0" />}
      {activeTab === id && <ChevronRight className="w-3 h-3 text-[#9B9A97] flex-shrink-0" />}
    </button>
  );

  const SidebarContent = () => (
    <>
      {/* Logo + usuario */}
      <div className="px-3 pt-4 pb-3 border-b border-[#E9E9E7]">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-6 h-6 bg-[#6940A5] rounded-md flex items-center justify-center flex-shrink-0">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#191919] leading-tight">NeuroLearn</p>
            <p className="text-[10px] text-[#787774]">Panel Institucional</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[#EBEBEA] cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-md bg-[#6940A5] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            {(user?.full_name || 'R').charAt(0)}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-[12.5px] font-semibold text-[#37352F] truncate leading-tight">{user?.full_name}</p>
            <p className="text-[10px] text-[#787774] truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
          <ShieldCheck className="w-3.5 h-3.5 text-[#6940A5] flex-shrink-0" />
        </div>
      </div>

      {/* Navegación por secciones */}
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

      {/* Pie del sidebar */}
      <div className="px-2 pb-3 pt-2 border-t border-[#E9E9E7] space-y-0.5">
        <button
          onClick={() => handleNav('alertas')}
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

      {/* ══ SIDEBAR DESKTOP ══ */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-[#F7F6F3] border-r border-[#E9E9E7] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ══ MOBILE HEADER ════ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-[#F7F6F3] border-b border-[#E9E9E7] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#6940A5] rounded-md flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[13px] font-bold text-[#191919]">NeuroLearn</span>
          <span className="text-[10px] text-[#787774] ml-1 hidden sm:inline">Institucional</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#787774] truncate max-w-[120px] hidden sm:block">{currentMeta.title}</span>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-md text-[#787774] hover:bg-[#EBEBEA] transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ══ MOBILE OVERLAY ═══ */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setSidebarOpen(false)}>
          <div
            className="absolute left-0 top-12 bottom-0 w-64 bg-[#F7F6F3] border-r border-[#E9E9E7] flex flex-col overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ══ MAIN CONTENT ══ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">

        {/* Top header — desktop only */}
        <header className="hidden lg:block flex-shrink-0 px-6 xl:px-8 py-4 xl:py-5 border-b border-[#E9E9E7] bg-white">
          <h1 className="text-xl font-bold text-[#191919] leading-tight">{currentMeta.title}</h1>
          <p className="text-sm text-[#787774] mt-0.5">{currentMeta.subtitle}</p>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="pt-12 lg:pt-0 p-4 sm:p-6 xl:p-8 max-w-7xl mx-auto">

            {activeTab === 'dashboard'    && <DashboardGeneral license={license} onNavigate={setActiveTab} />}
            {activeTab === 'profesores'   && <TeachersTab license={license} />}
            {activeTab === 'estudiantes'  && <StudentsTab license={license} teachers={teachers} />}
            {activeTab === 'grupos'       && <GruposTab />}
            {activeTab === 'neurobots'    && <NeuroBots />}
            {activeTab === 'alertas'      && <NeuroAlertasTab />}
            {activeTab === 'reportes'     && <ReportesTab />}
            {activeTab === 'mensajeria'   && <MensajeriaTab />}
            {activeTab === 'calendario'   && <CalendarioTab />}
            {activeTab === 'auditoria'    && <AuditoriaTab />}
            {activeTab === 'configuracion' && <ConfiguracionTab />}
            {activeTab === 'licencia'     && <LicenciaTab license={license} />}
            {activeTab === 'seguridad'    && <SeguridadTab />}

          </div>
        </main>
      </div>
    </div>
  );
}
