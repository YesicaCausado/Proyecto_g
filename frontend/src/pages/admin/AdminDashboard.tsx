import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  School,
  Users,
  GraduationCap,
  Settings,
  LogOut,
  Brain,
  ChevronRight,
} from 'lucide-react';
import AdminHome from './AdminHome';
import CreateInstitution from './CreateInstitution';
import InstitutionList from './InstitutionList';

// Ítems del menú lateral
const NAV_ITEMS = [
  {
    to: '/admin',
    end: true,
    icon: LayoutDashboard,
    label: 'Inicio',
    description: 'Resumen general',
  },
  {
    to: '/admin/instituciones',
    end: false,
    icon: School,
    label: 'Instituciones',
    description: 'Colegios y super profesores',
  },
  {
    to: '/admin/usuarios',
    end: false,
    icon: Users,
    label: 'Usuarios',
    description: 'Gestión de cuentas',
  },
  {
    to: '/admin/configuracion',
    end: false,
    icon: Settings,
    label: 'Configuración',
    description: 'Ajustes del sistema',
  },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Inicial del nombre para el avatar
  const inicial = user?.full_name?.charAt(0)?.toUpperCase()
    ?? user?.username?.charAt(0)?.toUpperCase()
    ?? 'A';

  return (
    <div className="flex h-screen bg-[#F7F6F3] overflow-hidden">

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="w-64 bg-[#191919] text-white flex flex-col shrink-0">

        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#37352F]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#37352F] rounded-md flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">NeuroLearn IA</p>
              <p className="text-xs text-[#0B6E99] leading-tight">Panel Administrador</p>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-[#37352F] text-white'
                    : 'text-[#9B9A97] hover:text-white hover:bg-[#2F2D2B]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#787774] group-hover:text-[#9B9A97]'}`} />
                  <span className="flex-1 font-medium">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-[#BFDFF0]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Perfil y logout */}
        <div className="px-3 py-4 border-t border-[#37352F]/60 space-y-2">
          {/* Info del usuario */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-[#37352F] rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {user?.full_name ?? user?.username}
              </p>
              <p className="text-xs text-[#9B9A97] truncate">{user?.email}</p>
            </div>
          </div>

          {/* Botón cerrar sesión */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#9B9A97] hover:text-white hover:bg-[#E03E3E]/20 hover:border-[#E03E3E]/30 border border-transparent transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[#E9E9E7] flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-[#787774]">
            <GraduationCap className="w-4 h-4" />
            <span>Administración del Sistema</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#191919] font-medium">NeuroLearn IA</span>
          </div>
        </header>

        {/* Área de contenido scrolleable */}
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<AdminHome />} />
            <Route path="instituciones"        element={<InstitutionList />} />
            <Route path="instituciones/nueva"  element={<CreateInstitution />} />
            {/* Rutas futuras */}
            <Route path="usuarios"             element={<PlaceholderPage title="Gestión de Usuarios" />} />
            <Route path="configuracion"        element={<PlaceholderPage title="Configuración del Sistema" />} />
            <Route path="*"                    element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

// Placeholder para rutas aún no desarrolladas
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <div className="bg-white rounded-md border border-[#E9E9E7] p-12 text-center">
        <div className="w-12 h-12 bg-[#F7F6F3] rounded-md flex items-center justify-center mx-auto mb-4">
          <Settings className="w-6 h-6 text-[#9B9A97]" />
        </div>
        <h2 className="text-lg font-semibold text-[#191919]">{title}</h2>
        <p className="text-[#9B9A97] text-sm mt-1">Módulo en desarrollo — próximamente disponible</p>
      </div>
    </div>
  );
}