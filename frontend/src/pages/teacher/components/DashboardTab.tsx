import { useState, useEffect } from 'react';
import {
  BookOpen, Users, TrendingUp, Bot, AlertTriangle,
  ChevronRight, Star, Clock, Calendar, Zap,
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

interface Props {
  license: any;
  onNavigate: (tab: string) => void;
}

interface TeacherStats {
  total_groups: number;
  total_students: number;
  avg_global: number;
  active_bots: number;
  alert_count: number;
  has_data: boolean;
  groups_perf: { name: string; avg: number; count: number; color: string }[];
  top_students: { name: string; group: string; avg: number; trend: string | null }[];
  upcoming: { type: string; label: string; date: string; color: string }[];
  ai_usage: { name: string; pct: number; color: string }[];
  topics_perf: { topic: string; avg: number; attempts: number; color: string }[];
  weekly_activity: { label: string; count: number; pct: number }[];
}

const today = new Date();

// ── Mini calendario ───────────────────────────────────────────────────────────
function MiniCalendar({ eventDays }: { eventDays: number[] }) {
  const [month, setMonth] = useState(today.getMonth());
  const [year,  setYear]  = useState(today.getFullYear());
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth= new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthName = new Date(year, month).toLocaleString('es-CO', { month: 'long' });
  const DAYS = ['D','L','M','M','J','V','S'];
  const todayDay  = today.getDate();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);}}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774] text-xs">‹</button>
        <span className="text-sm font-semibold text-[#191919] capitalize">{monthName} {year}</span>
        <button onClick={() => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);}}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774] text-xs">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[9px] font-semibold text-[#AEADAB] py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => (
          <div key={i} className={`aspect-square flex items-center justify-center rounded text-[11px] relative cursor-pointer transition-colors
            ${day === null ? '' : eventDays.includes(day ?? 0) ? 'font-semibold' : 'hover:bg-[#F7F6F3]'}
            ${isCurrentMonth && day === todayDay ? 'bg-[#2E6FDB] text-white rounded-full' : 'text-[#37352F]'}
          `}>
            {day}
            {day !== null && eventDays.includes(day) && !(isCurrentMonth && day === todayDay) && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#E03E3E]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardTab({ onNavigate }: Props) {
  useAuth(); // provides context; user not needed directly here
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  useEffect(() => {
    api.get('/teacher/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasData = stats?.has_data ?? false;

  // KPI cards — todos derivados de datos reales del endpoint
  const KPI = [
    { id:'grupos',      label:'Mis Grupos',            value: String(stats?.total_groups ?? '…'),    sub: `${stats?.total_groups ?? 0} activos`,       icon:BookOpen,     color:'text-[#2E6FDB]', bg:'bg-[#EEF3FD]', nav:'grupos'      },
    { id:'estudiantes', label:'Estudiantes',            value: String(stats?.total_students ?? '…'),  sub: 'inscritos en mis grupos',                    icon:Users,        color:'text-[#0F7B6C]', bg:'bg-emerald-50', nav:'grupos'     },
    { id:'promedio',    label:'Promedio General',       value: stats?.avg_global != null ? `${stats.avg_global}` : '…',  sub: 'sobre 10 puntos',  icon:TrendingUp,   color:'text-[#D9730D]', bg:'bg-orange-50',  nav:'alertas'    },
    { id:'bots',        label:'NeuroBots Activos',      value: String(stats?.active_bots ?? '…'),     sub: 'creados por ti',                             icon:Bot,          color:'text-[#6940A5]', bg:'bg-purple-50',  nav:'neurobots'  },
    { id:'alertas',     label:'Alertas Académicas',     value: String(stats?.alert_count ?? '…'),     sub: 'en riesgo medio/alto',                       icon:AlertTriangle,color:'text-[#E03E3E]', bg:'bg-red-50',     nav:'alertas'    },
  ];

  // Participación semanal real (conteos del backend)
  const WEEK_DATA = stats?.weekly_activity ?? [];
  const maxWeek = Math.max(1, ...WEEK_DATA.map(d => d.count));

  // Total de intentos de evaluación del mes (real, sumado de topics_perf)
  const totalQuizzes = (stats?.topics_perf ?? []).reduce((acc, t) => acc + (t.attempts || 0), 0);

  // Eventos reales del mes corriente (proximos) → marcar en el mini calendario
  const realEventDays = (stats?.upcoming ?? [])
    .map(ev => {
      if (ev.date === 'Hoy') return today.getDate();
      if (ev.date === 'Mañana') return today.getDate() + 1;
      return null;
    })
    .filter((d): d is number => d != null && d <= 31);

  return (
    <div className="space-y-6">

      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#191919]">{greeting} 👋</h2>
          <p className="text-sm text-[#787774]">
          {!loading && stats
            ? <>Tienes <span className="font-semibold text-[#E03E3E]">{stats.alert_count} alertas</span> activas y <span className="font-semibold text-[#2E6FDB]">{stats.total_groups} grupos</span>.</>
            : 'Cargando estadísticas…'
          }
        </p>
        </div>
        <button
          onClick={() => onNavigate('alertas')}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm"
        >
          <Zap className="w-4 h-4" /> NeuroInsights
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {KPI.map(k => {
          const Icon = k.icon;
          return (
            <button key={k.id} onClick={() => onNavigate(k.nav)}
              className="bg-white border border-[#E9E9E7] rounded-lg p-4 text-left hover:shadow-sm hover:border-[#9B9A97] transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 ${k.bg} rounded-md flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#AEADAB] group-hover:text-[#787774] mt-1" />
              </div>
              <p className="text-2xl font-bold text-[#191919]">{k.value}</p>
              <p className="text-xs font-medium text-[#787774] mt-0.5">{k.label}</p>
              <p className="text-[11px] text-[#AEADAB] mt-1">{k.sub}</p>
            </button>
          );
        })}
      </div>

      {/* ── 2 Columnas: Gráficas + Derecha ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Columna Izquierda: Gráficos (2/3) ─────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Participación semanal (real) */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#191919] text-sm">Participación semanal — evaluaciones por día</h3>
              <span className="text-xs text-[#787774]">últimos 6 días</span>
            </div>
            {WEEK_DATA.length > 0 && maxWeek > 0 ? (
              <div className="flex items-end gap-3 h-28">
                {WEEK_DATA.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium text-[#787774]">{d.count}</span>
                    <div className="w-full rounded-t-sm transition-all"
                      style={{ height: `${(d.count / maxWeek) * 80}px`, background: d.count >= 70 ? '#2E6FDB' : '#0F7B6C' }}
                    />
                    <span className="text-[10px] text-[#AEADAB]">{d.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#AEADAB] py-6 text-center">Sin actividad de aprendizaje registrada en los últimos días.</p>
            )}
          </div>

          {/* 2 columnas dentro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Desempeño por grupo */}
            <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
              <h3 className="font-semibold text-[#191919] text-sm mb-4">Desempeño por grupo</h3>
              <div className="space-y-3">
                {(stats?.groups_perf ?? []).length > 0 ? (stats?.groups_perf ?? []).map(g => (
                  <div key={g.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#37352F] truncate max-w-[70%]">{g.name}</span>
                      <span className="text-xs font-semibold text-[#191919]">{g.count} evaluaciones · {g.avg}</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${g.color}`} style={{ width: `${(g.avg / 10) * 100}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-[#AEADAB]">{loading ? 'Cargando…' : 'Los grupos aún no tienen evaluaciones.'}</p>
                )}
              </div>
            </div>

            {/* Uso de IA */}
            <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
              <h3 className="font-semibold text-[#191919] text-sm mb-4">Uso de NeuroBots</h3>
              <div className="space-y-3">
                {(stats?.ai_usage ?? []).length > 0 ? (stats?.ai_usage ?? []).map(a => (
                  <div key={a.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#37352F]">{a.name}</span>
                      <span className="text-xs font-semibold text-[#191919]">{a.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${a.color}`} style={{ width: `${a.pct}%` }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-[#AEADAB]">Sin bots creados o sin uso registrado.</p>
                )}
                {stats?.topics_perf && stats.topics_perf.length > 0 && (
                  <div className="pt-2 border-t border-[#E9E9E7]">
                    <p className="text-xs text-[#787774]">Total de evaluaciones: <span className="font-semibold text-[#6940A5]">{totalQuizzes}</span></p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ranking estudiantes */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#191919] text-sm">Top Estudiantes</h3>
              <button onClick={() => onNavigate('alertas')} className="text-xs text-[#2E6FDB] hover:underline">Ver todos</button>
            </div>
            <div className="space-y-2">
              {hasData && (stats?.top_students ?? []).length > 0 ? (stats?.top_students ?? []).map((s, i) => {
                const trendClass = s.trend == null
                  ? 'text-[#AEADAB]'
                  : (s.trend.startsWith('-') ? 'text-[#E03E3E]' : 'text-[#0F7B6C]');
                return (
                  <div key={s.name} className="flex items-center gap-3 py-2 border-b border-[#F7F6F3] last:border-0">
                    <span className="text-xs font-bold text-[#AEADAB] w-4">{i+1}</span>
                    <div className="w-7 h-7 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#37352F] truncate">{s.name}</p>
                      <p className="text-[10px] text-[#AEADAB]">Grupo {s.group}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#191919]">{s.avg}</p>
                      <p className={`text-[10px] font-medium ${trendClass}`}>{s.trend ?? '—'}</p>
                    </div>
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                  </div>
                );
              }) : (
                <p className="text-xs text-[#AEADAB] py-4 text-center">{loading ? 'Cargando…' : 'Sin datos suficientes aún.'}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Columna Derecha: Calendario + Próximos (1/3) ──────── */}
        <div className="space-y-4">
          <MiniCalendar eventDays={realEventDays} />

          {/* Próximas fechas */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <h3 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#787774]" /> Próximamente
            </h3>
            <div className="space-y-2">
              {(stats?.upcoming ?? []).length > 0 ? (stats?.upcoming ?? []).map((ev, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-[#F7F6F3] last:border-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#37352F] truncate">{ev.label}</p>
                    <p className="text-[10px] text-[#AEADAB] capitalize">{ev.type}</p>
                  </div>
                  <span className="text-[10px] font-medium text-[#787774] flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{ev.date}
                  </span>
                </div>
              )) : (
                <p className="text-xs text-[#AEADAB] py-2">No hay eventos próximos.</p>
              )}
            </div>
          </div>

          {/* NeuroInsight destacado */}
          <div className="bg-gradient-to-br from-[#EEF3FD] to-[#F0F7FF] border border-[#C5D9F7] rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#2E6FDB] flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-[#2E6FDB]">NeuroInsight del día</p>
            </div>
            <p className="text-xs text-[#37352F] leading-relaxed">
              {hasData && (stats?.alert_count ?? 0) > 0
                ? `Hay ${stats?.alert_count ?? 0} alertas activas en tus grupos; revisa primero a los estudiantes con mayor riesgo y fortalece los temas con menor rendimiento.`
                : hasData
                  ? 'Tu actividad está estable. Sigue reforzando prácticas breves y revisa la evolución semanal para detectar cambios tempranos.'
                  : 'Aún no hay suficientes datos de aprendizaje registrados para generar un análisis.'}
            </p>
            <button
              onClick={() => onNavigate('alertas')}
              className="mt-3 text-xs text-[#2E6FDB] hover:underline font-medium"
            >
              Ver análisis completo →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}