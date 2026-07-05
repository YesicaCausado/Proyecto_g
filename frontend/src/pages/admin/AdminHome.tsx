import { Link } from 'react-router-dom';
import { School, Users, BookOpen, ShieldCheck, Plus, ArrowRight } from 'lucide-react';

// Tarjetas de estadísticas — los valores vendrán del backend (fase siguiente)
const STATS = [
  {
    label: 'Instituciones activas',
    value: '—',
    sub: 'colegios registrados',
    icon: School,
    color: 'bg-[#0B6E99]',
    light: 'bg-[#E5F3FF] text-[#0B6E99]',
  },
  {
    label: 'Super Profesores',
    value: '—',
    sub: 'rectores con acceso',
    icon: ShieldCheck,
    color: 'bg-[#0B6E99]',
    light: 'bg-[#E5F3FF] text-[#0B6E99]',
  },
  {
    label: 'Profesores totales',
    value: '—',
    sub: 'docentes activos',
    icon: Users,
    color: 'bg-[#6940A5]',
    light: 'bg-[#F7F3FB] text-[#6940A5]',
  },
  {
    label: 'Estudiantes totales',
    value: '—',
    sub: 'alumnos registrados',
    icon: BookOpen,
    color: 'bg-[#0F7B6C]',
    light: 'bg-[#EEF7F4] text-[#0F7B6C]',
  },
];

// Acciones rápidas del panel
const QUICK_ACTIONS = [
  {
    to: '/admin/instituciones/nueva',
    icon: School,
    title: 'Registrar institución',
    description: 'Crear nuevo colegio y generar credenciales del rector (Super Profesor)',
    color: 'border-[#BFDFF0] hover:border-[#0B6E99] hover:bg-[#E5F3FF]',
    iconBg: 'bg-[#E5F3FF] group-hover:bg-[#E5F3FF] text-[#0B6E99]',
  },
  {
    to: '/admin/usuarios',
    icon: Users,
    title: 'Gestionar usuarios',
    description: 'Ver, activar o desactivar cuentas de administradores del sistema',
    color: 'border-[#D9CCE9] hover:border-[#6940A5] hover:bg-[#F7F3FB]',
    iconBg: 'bg-[#F4EFFB] group-hover:bg-[#D9CCE9] text-[#6940A5]',
  },
];

export default function AdminHome() {
  return (
    <div className="p-8 max-w-6xl">

      {/* ── Encabezado ─────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#191919]">
          Bienvenido al panel de administración
        </h1>
        <p className="text-[#787774] mt-1 text-sm">
          Gestión global de instituciones, licencias y usuarios de NeuroLearn IA.
        </p>
      </div>

      {/* ── Flujo de roles (visual informativo) ────────────── */}
      <div className="bg-[#E5F3FF] border border-[#BFDFF0] rounded-md p-5 mb-8 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-[#37352F]">Flujo de creación de cuentas:</span>
        <RoleBadge label="Administrador" color="bg-[#37352F]" />
        <ArrowRight className="w-4 h-4 text-[#0B6E99]" />
        <RoleBadge label="Super Profesor (rector)" color="bg-[#6940A5]" />
        <ArrowRight className="w-4 h-4 text-[#0B6E99]" />
        <RoleBadge label="Profesor" color="bg-[#0B6E99]" />
        <ArrowRight className="w-4 h-4 text-[#0B6E99]" />
        <RoleBadge label="Estudiante" color="bg-[#0F7B6C]" />
        <span className="text-[#0B6E99] ml-2">
          — Cada nivel crea al nivel siguiente dentro de su institución
        </span>
      </div>

      {/* ── Estadísticas ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-md p-5 border border-[#E9E9E7] flex items-start gap-4"
          >
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center shrink-0`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#191919] leading-tight">{s.value}</p>
              <p className="text-sm font-medium text-[#37352F] leading-tight">{s.label}</p>
              <p className="text-xs text-[#9B9A97] mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Acciones rápidas ───────────────────────────────── */}
      <div className="bg-white rounded-md p-6 border border-[#E9E9E7]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#191919]">Acciones rápidas</h2>
          <Link
            to="/admin/instituciones"
            className="text-xs text-[#0B6E99] hover:text-[#37352F] flex items-center gap-1"
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`group flex items-start gap-4 p-4 border-2 border-dashed rounded-md transition-all duration-150 ${action.color}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${action.iconBg}`}>
                <action.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[#191919] text-sm">{action.title}</p>
                  <Plus className="w-3 h-3 text-[#9B9A97] group-hover:text-[#787774] shrink-0" />
                </div>
                <p className="text-xs text-[#787774] mt-0.5 leading-relaxed">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Nota sobre flujo de cuentas ────────────────────── */}
      <div className="mt-6 bg-[#FCF6E5] border border-[#EDD88A] rounded-md p-4 text-sm text-[#D9730D]">
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