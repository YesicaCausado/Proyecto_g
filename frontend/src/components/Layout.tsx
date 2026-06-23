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
  TrendingUp
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
        { to: '/dashboard', icon: Home, label: 'Inicio' },
        { to: '/classrooms', icon: Users, label: 'Mis Clases' },
      ]
    : [
        { to: '/dashboard', icon: Home, label: 'Inicio' },
        { to: '/bots', icon: BookOpen, label: 'Habilidades' },
        { to: '/chat', icon: MessageSquare, label: 'Aprender' },
        { to: '/quizzes', icon: BookOpen, label: 'Desafíos' },
        { to: '/my-classes', icon: Users, label: 'Mis Clases' },
      ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-[260px] bg-white border-r border-gray-100 z-10 transition-all flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-8">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-500">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg font-heading tracking-tight leading-tight">
              NeuroLearn <span className="text-primary-500">AI</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Saber 11 Adaptativo</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all duration-200 ${
                isActive(item.to)
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive(item.to) ? 'opacity-100 text-white' : 'opacity-70 text-gray-400'}`} strokeWidth={isActive(item.to) ? 2.5 : 2} />
              {item.label}
            </Link>
          ))}
        </nav>
        
        {/* Sección de progreso en sidebar */}
        {!isTeacher && (
           <div className="px-6 mb-6">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Mi Progreso</div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 font-medium">Nivel actual</span>
                      <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
                  </div>
                  <div className="font-bold text-gray-900 text-sm">Intermedio</div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 font-medium">Puntos acumulados</span>
                      <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                          <span className="text-xs">🏆</span>
                      </div>
                  </div>
                  <div className="font-bold text-gray-900 text-sm">2,450 pts</div>
              </div>
           </div>
        )}

        {/* User Info */}
        <div className="p-4 mt-auto mb-4">
          <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.full_name || user?.username}
                </p>
                <p className="text-[11px] text-gray-500 font-medium capitalize truncate">{user?.role}</p>
                </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-40 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#e3f2fd] rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#2196f3]" />
            </div>
            <span className="font-bold text-gray-900 font-heading text-lg tracking-tight">NeuroLearn <span className="text-[#2196f3]">AI</span></span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-gray-50 rounded-lg text-gray-600 hover:text-[#2196f3] transition-colors">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setSidebarOpen(false)}>
          <div className="absolute left-0 top-14 bottom-0 w-64 bg-white border-r shadow-lg p-4 space-y-1"
            onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <hr className="my-3" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-danger-500 hover:bg-red-50 w-full"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:overflow-y-auto">
        <div className="pt-14 md:pt-0 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
