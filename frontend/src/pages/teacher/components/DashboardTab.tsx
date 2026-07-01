import { useState } from 'react';
import {
  BookOpen, Users, TrendingUp, ClipboardList, Bot, AlertTriangle,
  ChevronRight, Star, Clock, Calendar, Zap,
} from 'lucide-react';

interface Props {
  license: any;
  onNavigate: (tab: string) => void;
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const KPI = [
  { id: 'grupos',      label: 'Mis Grupos',          value: '6',   sub: '2 activos hoy',           icon: BookOpen,     color: 'text-[#2E6FDB]', bg: 'bg-[#EEF3FD]', nav: 'grupos'      },
  { id: 'estudiantes', label: 'Estudiantes',          value: '187', sub: '+5 esta semana',           icon: Users,        color: 'text-[#0F7B6C]', bg: 'bg-emerald-50', nav: 'grupos'     },
  { id: 'promedio',    label: 'Promedio General',     value: '7.8', sub: '+0.3 vs mes anterior',    icon: TrendingUp,   color: 'text-[#D9730D]', bg: 'bg-orange-50',  nav: 'alertas'    },
  { id: 'pendientes',  label: 'Actividades Pendientes',value: '8',  sub: 'por revisar',             icon: ClipboardList,color: 'text-[#E03E3E]', bg: 'bg-red-50',     nav: 'evaluaciones'},
  { id: 'bots',        label: 'NeuroBots Activos',    value: '3',   sub: '520 consultas este mes',  icon: Bot,          color: 'text-[#6940A5]', bg: 'bg-purple-50',  nav: 'neurobots'  },
  { id: 'alertas',     label: 'Alertas Académicas',   value: '4',   sub: '1 alta prioridad',        icon: AlertTriangle,color: 'text-[#E03E3E]', bg: 'bg-red-50',     nav: 'alertas'    },
];

const WEEK_DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb'];
const WEEK_DATA = [72, 85, 68, 91, 78, 45];

const GROUPS_PERF = [
  { name: 'Matemáticas 9A', avg: 8.2, color: 'bg-[#2E6FDB]' },
  { name: 'Física 10B',     avg: 7.6, color: 'bg-[#0F7B6C]' },
  { name: 'Algebra 8C',     avg: 6.9, color: 'bg-[#D9730D]' },
  { name: 'Cálculo 11A',    avg: 8.8, color: 'bg-[#6940A5]' },
  { name: 'Geometría 7A',   avg: 7.1, color: 'bg-[#0B6E99]' },
];

const AI_USAGE = [
  { name: 'MateBot 9A', pct: 87, color: 'bg-[#2E6FDB]' },
  { name: 'FísicaBot',  pct: 72, color: 'bg-[#0F7B6C]' },
  { name: 'AlgebraBot', pct: 58, color: 'bg-[#6940A5]' },
];

const today = new Date();
const UPCOMING = [
  { type: 'tarea',   label: 'Ecuaciones cuadráticas — 9A', date: 'Hoy',     color: 'bg-[#E03E3E]' },
  { type: 'examen',  label: 'Parcial Física — 10B',        date: 'Mañana',  color: 'bg-[#D9730D]' },
  { type: 'anuncio', label: 'Reunión padres de familia',   date: '4 Jul',   color: 'bg-[#2E6FDB]' },
  { type: 'evento',  label: 'Feria de ciencias',           date: '8 Jul',   color: 'bg-[#0F7B6C]' },
  { type: 'clase',   label: 'Cálculo diferencial 11A',     date: '10 Jul',  color: 'bg-[#6940A5]' },
];

const RANKING = [
  { name: 'Valentina Torres', group: '9A', avg: 9.4, trend: '+0.3' },
  { name: 'Carlos Silva',     group: '10B', avg: 9.1, trend: '+0.1' },
  { name: 'María González',   group: '11A', avg: 8.9, trend: '+0.5' },
  { name: 'Andrés Mora',      group: '8C',  avg: 8.7, trend: '-0.2' },
];

// ── Mini calendario ───────────────────────────────────────────────────────────
function MiniCalendar() {
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
  const eventDays = [3, 8, 12, 15, 22, 28];
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
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const maxWeek = Math.max(...WEEK_DATA);

  return (
    <div className="space-y-6">

      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#191919]">{greeting} 👋</h2>
          <p className="text-sm text-[#787774]">Tienes <span className="font-semibold text-[#E03E3E]">8 actividades</span> pendientes y <span className="font-semibold text-[#2E6FDB]">4 alertas</span> activas.</p>
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

          {/* Progreso semanal */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#191919] text-sm">Progreso semanal — participación (%)</h3>
              <span className="text-xs text-[#787774]">Semana actual</span>
            </div>
            <div className="flex items-end gap-3 h-28">
              {WEEK_DAYS.map((d, i) => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-[#787774]">{WEEK_DATA[i]}%</span>
                  <div className="w-full rounded-t-sm transition-all"
                    style={{ height: `${(WEEK_DATA[i] / maxWeek) * 80}px`, background: WEEK_DATA[i] >= 80 ? '#2E6FDB' : WEEK_DATA[i] >= 65 ? '#0F7B6C' : '#D9730D' }}
                  />
                  <span className="text-[10px] text-[#AEADAB]">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2 columnas dentro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Desempeño por grupo */}
            <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
              <h3 className="font-semibold text-[#191919] text-sm mb-4">Desempeño por grupo</h3>
              <div className="space-y-3">
                {GROUPS_PERF.map(g => (
                  <div key={g.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#37352F] truncate max-w-[70%]">{g.name}</span>
                      <span className="text-xs font-semibold text-[#191919]">{g.avg}</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${g.color}`} style={{ width: `${(g.avg / 10) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Uso de IA */}
            <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
              <h3 className="font-semibold text-[#191919] text-sm mb-4">Uso de NeuroBots</h3>
              <div className="space-y-3">
                {AI_USAGE.map(a => (
                  <div key={a.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#37352F]">{a.name}</span>
                      <span className="text-xs font-semibold text-[#191919]">{a.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${a.color}`} style={{ width: `${a.pct}%` }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#E9E9E7]">
                  <p className="text-xs text-[#787774]">Total: <span className="font-semibold text-[#6940A5]">1,439 consultas</span> este mes</p>
                </div>
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
              {RANKING.map((s, i) => (
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
                    <p className={`text-[10px] font-medium ${s.trend.startsWith('+') ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>{s.trend}</p>
                  </div>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Columna Derecha: Calendario + Próximos (1/3) ──────── */}
        <div className="space-y-4">
          <MiniCalendar />

          {/* Próximas fechas */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <h3 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#787774]" /> Próximamente
            </h3>
            <div className="space-y-2">
              {UPCOMING.map((ev, i) => (
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
              ))}
            </div>
          </div>

          {/* NeuroInsight destacado */}
          <div className="bg-gradient-to-br from-[#EEF3FD] to-[#F0F7FF] border border-[#C5D9F7] rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <Zap className="w-4 h-4 text-[#2E6FDB] flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-[#2E6FDB]">NeuroInsight del día</p>
            </div>
            <p className="text-xs text-[#37352F] leading-relaxed">
              "Juan Pérez presenta dificultades en <strong>Álgebra Lineal</strong>. Se recomienda reforzar ecuaciones cuadráticas con ejercicios prácticos."
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
