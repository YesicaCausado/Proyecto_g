import { Link } from 'react-router-dom';
import { School, Users, BookOpen, ShieldCheck, Plus, ArrowRight } from 'lucide-react';

// Tarjetas de estadísticas — los valores vendrán del backend (fase siguiente)
const STATS = [
  {
    label: 'Instituciones activas',
    value: '—',
    sub: 'colegios registrados',
    icon: School,
    color: 'bg-blue-500',
    light: 'bg-blue-50 text-blue-700',
  },
  {
    label: 'Super Profesores',
    value: '—',
    sub: 'rectores con acceso',
    icon: ShieldCheck,
    color: 'bg-indigo-500',
    light: 'bg-indigo-50 text-indigo-700',
  },
  {
    label: 'Profesores totales',
    value: '—',
    sub: 'docentes activos',
    icon: Users,
    color: 'bg-violet-500',
    light: 'bg-violet-50 text-violet-700',
  },
  {
    label: 'Estudiantes totales',
    value: '—',
    sub: 'alumnos registrados',
    icon: BookOpen,
    color: 'bg-emerald-500',
    light: 'bg-emerald-50 text-emerald-700',
  },
];

// Acciones rápidas del panel
const QUICK_ACTIONS = [
  {
    to: '/admin/instituciones/nueva',
    icon: School,
    title: 'Registrar institución',
    description: 'Crear nuevo colegio y generar credenciales del rector (Super Profesor)',
    color: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50',
    iconBg: 'bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600',
  },
  {
    to: '/admin/usuarios',
    icon: Users,
    title: 'Gestionar usuarios',
    description: 'Ver, activar o desactivar cuentas de administradores del sistema',
    color: 'border-violet-200 hover:border-violet-400 hover:bg-violet-50',
    iconBg: 'bg-violet-100 group-hover:bg-violet-200 text-violet-600',
  },
];

export default function AdminHome() {
  return (
    <div className="p-8 max-w-6xl">

      {/* ── Encabezado ─────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido al panel de administración
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Gestión global de instituciones, licencias y usuarios de NeuroLearn IA.
        </p>
      </div>

      {/* ── Flujo de roles (visual informativo) ────────────── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-8 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-indigo-800">Flujo de creación de cuentas:</span>
        <RoleBadge label="Administrador" color="bg-indigo-600" />
        <ArrowRight className="w-4 h-4 text-indigo-400" />
        <RoleBadge label="Super Profesor (rector)" color="bg-violet-600" />
        <ArrowRight className="w-4 h-4 text-indigo-400" />
        <RoleBadge label="Profesor" color="bg-blue-600" />
        <ArrowRight className="w-4 h-4 text-indigo-400" />
        <RoleBadge label="Estudiante" color="bg-emerald-600" />
        <span className="text-indigo-500 ml-2">
          — Cada nivel crea al nivel siguiente dentro de su institución
        </span>
      </div>

      {/* ── Estadísticas ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4"
          >
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center shrink-0`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 leading-tight">{s.value}</p>
              <p className="text-sm font-medium text-gray-700 leading-tight">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Acciones rápidas ───────────────────────────────── */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Acciones rápidas</h2>
          <Link
            to="/admin/instituciones"
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`group flex items-start gap-4 p-4 border-2 border-dashed rounded-xl transition-all duration-150 ${action.color}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${action.iconBg}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{action.title}</p>
                  <Plus className="w-3 h-3 text-gray-400 group-hover:text-gray-600 shrink-0" />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Nota sobre flujo de cuentas ────────────────────── */}
      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
        <strong className="font-semibold">Nota importante:</strong> El registro de nuevas cuentas
        está cerrado al público. Solo el administrador puede crear Super Profesores. El Super Profesor
        crea profesores dentro de su institución, y el profesor crea o invita a sus estudiantes.
      </div>
    </div>
  );
}

function RoleBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`${color} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
      {label}
    </span>
  );
}