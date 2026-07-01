import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Brain,
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
} from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isTeacher = user?.role === 'profesor';

  const navItems = isTeacher
    ? [
        { to: '/dashboard', icon: Home,    label: 'Inicio'    },
        { to: '/classrooms', icon: Users,  label: 'Mis Clases'},
      ]
    : [
        { to: '/dashboard',   icon: Home,         label: 'Inicio'      },
        { to: '/bots',        icon: BookOpen,      label: 'Habilidades' },
        { to: '/chat',        icon: MessageSquare, label: 'Aprender'    },
        { to: '/quizzes',     icon: BookOpen,      label: 'Desafíos'    },
        { to: '/performance', icon: TrendingUp,    label: 'Desempeño'   },
        { to: '/material',    icon: BookMarked,    label: 'Material'    },
        { to: '/my-classes',  icon: Users,         label: 'Mis Clases'  },
      ];

  const isActive = (path: string) => location.pathname === path;

  const initials = (user?.full_name || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // ─── Sidebar inner ─────────────────────────────────────────────────────────
  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-[#E9E9E7]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#37352F] rounded-md flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#37352F] leading-tight tracking-tight">
              NeuroLearn
            </p>
            <p className="text-[10px] text-[#787774] font-medium tracking-wide">Saber 11 ICFES</p>
          </div>
        </div>
      </div>

      {/* Nav section */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-2 mb-1.5 text-[10px] font-semibold text-[#787774] uppercase tracking-widest">
          Navegación
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => mobile && setSidebarOpen(false)}
                className={`group flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13.5px] font-medium transition-colors duration-100 ${
                  active
                    ? 'bg-[#F1F1EF] text-[#37352F]'
                    : 'text-[#787774] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                }`}
              >
                <item.icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    active ? 'text-[#37352F]' : 'text-[#9B9A97] group-hover:text-[#37352F]'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#9B9A97] ml-auto flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Progreso — solo estudiante */}
        {!isTeacher && (
          <div className="mt-5">
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-[#787774] uppercase tracking-widest">
              Mi progreso
            </p>
            <div className="px-2 space-y-1.5">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[12px] text-[#787774]">Nivel</span>
                <span className="text-[12px] font-semibold text-[#37352F]">Intermedio</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-t border-[#E9E9E7]">
                <span className="text-[12px] text-[#787774]">Puntos</span>
                <span className="text-[12px] font-semibold text-[#37352F]">2 450 pts</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-[#E9E9E7] p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#F1F1EF] flex items-center justify-center text-[#37352F] text-[11px] font-bold flex-shrink-0 select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-[#37352F] truncate leading-tight">
              {user?.full_name || user?.username}
            </p>
            <p className="text-[10px] text-[#787774] capitalize truncate">{user?.role}</p>
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
        style={{ background: '#F7F6F3' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-[#E9E9E7] z-40 h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#37352F] rounded-md flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            className="text-[14px] font-semibold text-[#37352F] tracking-tight"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            NeuroLearn
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
            style={{ background: '#F7F6F3' }}
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="pt-12 md:pt-0 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
