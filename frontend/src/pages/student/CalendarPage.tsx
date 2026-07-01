import { useState } from 'react';
import { Clock, BookOpen, ClipboardList, Megaphone, Calendar, Info } from 'lucide-react';

type EventType = 'examen' | 'tarea' | 'clase' | 'anuncio' | 'evento' | 'feriado';

interface CalEvent {
  id: string;
  title: string;
  date: string;
  type: EventType;
  group?: string;
  teacherName?: string;
  description?: string;
  time?: string;
}

const EVENT_COLORS: Record<EventType, { bg: string; dot: string; textBg: string; label: string; icon: any }> = {
  examen:   { bg: 'bg-red-50 border-red-100',      dot: 'bg-[#E03E3E]', textBg: 'bg-red-100 text-[#E03E3E]',       label: 'Examen',        icon: ClipboardList },
  tarea:    { bg: 'bg-orange-50 border-orange-100', dot: 'bg-[#D9730D]', textBg: 'bg-orange-100 text-[#D9730D]',     label: 'Tarea',         icon: BookOpen      },
  clase:    { bg: 'bg-[#EEF3FD] border-[#C5D9F7]', dot: 'bg-[#2E6FDB]', textBg: 'bg-[#EEF3FD] text-[#2E6FDB]',    label: 'Clase',         icon: Calendar      },
  anuncio:  { bg: 'bg-emerald-50 border-emerald-100',dot:'bg-[#0F7B6C]', textBg: 'bg-emerald-100 text-[#0F7B6C]',  label: 'Anuncio',       icon: Megaphone     },
  evento:   { bg: 'bg-purple-50 border-purple-100', dot: 'bg-[#6940A5]', textBg: 'bg-purple-100 text-[#6940A5]',    label: 'Evento',        icon: Calendar      },
  feriado:  { bg: 'bg-[#F7F6F3] border-[#E9E9E7]', dot: 'bg-[#787774]', textBg: 'bg-[#F7F6F3] text-[#787774]',    label: 'Feriado',       icon: Info          },
};

const today = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const fmt  = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayStr = fmt(today.getFullYear(), today.getMonth(), today.getDate());

const MOCK_EVENTS: CalEvent[] = [
  { id:'e1', title:'Parcial Física — Unidad 2', date: fmt(today.getFullYear(), today.getMonth(), 5),  type:'examen',  group:'Física 10B',     teacherName:'Prof. María López',    time:'8:00 AM',  description:'Cubre Termodinámica y Ondas. Traer calculadora.' },
  { id:'e2', title:'Entrega Tarea #4 — Ecuaciones', date: fmt(today.getFullYear(), today.getMonth(), 7),  type:'tarea',   group:'Matemáticas 9A', teacherName:'Prof. Carlos Martínez',time:'11:59 PM', description:'Subir en plataforma antes de medianoche.'       },
  { id:'e3', title:'Feria de Ciencias',          date: fmt(today.getFullYear(), today.getMonth(), 10), type:'evento',  group:'Todos',          teacherName:'Institución',          time:'9:00 AM',  description:'Participación obligatoria para grados 9° y 10°.' },
  { id:'e4', title:'Reunión padres de familia',  date: fmt(today.getFullYear(), today.getMonth(), 12), type:'anuncio', group:'Todos',          teacherName:'Coordinación',         time:'6:00 PM',  description:'Informes académicos primer semestre.'            },
  { id:'e5', title:'Quiz — Funciones lineales',  date: fmt(today.getFullYear(), today.getMonth(), 14), type:'examen',  group:'Álgebra 8C',     teacherName:'Prof. Ana Torres',     time:'9:30 AM',  description:'Temas: funciones lineales y cuadráticas.'        },
  { id:'e6', title:'Clase de recuperación Física',date: fmt(today.getFullYear(), today.getMonth(), 17), type:'clase',   group:'Física 10B',     teacherName:'Prof. María López',    time:'2:00 PM',  description:'Repaso termodinámica para los que tuvieron dificultades.' },
  { id:'e7', title:'Día cívico — Festividades',  date: fmt(today.getFullYear(), today.getMonth(), 20), type:'feriado'                                                                                                                                                   },
  { id:'e8', title:'Entrega proyecto Sociales',  date: fmt(today.getFullYear(), today.getMonth(), 22), type:'tarea',   group:'Ciencias Sociales', teacherName:'Prof. Pedro Ramírez',time:'8:00 AM',  description:'Proyecto en grupo sobre historia de Colombia.'   },
  { id:'e9', title:'Examen final Matemáticas',   date: fmt(today.getFullYear(), today.getMonth(), 28), type:'examen',  group:'Matemáticas 9A', teacherName:'Prof. Carlos Martínez',time:'7:00 AM',  description:'Examen integral. Toda la materia del semestre.'  },
];

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CalendarPage() {
  const [month,    setMonth]    = useState(today.getMonth());
  const [year,     setYear]     = useState(today.getFullYear());
  const [selected, setSelected] = useState<string | null>(null);
  const [detailEv, setDetailEv] = useState<CalEvent | null>(null);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const eventsOn  = (d: number) => MOCK_EVENTS.filter(e => e.date === fmt(year, month, d));
  const selEvents = selected ? MOCK_EVENTS.filter(e => e.date === selected) : [];
  const upcoming  = [...MOCK_EVENTS]
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#37352F]">Calendario Escolar</h1>
          <p className="text-[#787774] text-sm mt-1">Exámenes, tareas y eventos de tus clases — solo lectura</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-[#F7F6F3] border border-[#E9E9E7] px-3 py-1.5 rounded-lg text-xs text-[#787774]">
          <Info className="w-3.5 h-3.5" />
          Los eventos son publicados por tus profesores
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Calendario principal ──────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden shadow-sm">
            {/* Nav del mes */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7]">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F6F3] text-[#787774] text-lg transition-colors">‹</button>
              <h2 className="font-bold text-[#191919] text-base">{MONTHS[month]} {year}</h2>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F6F3] text-[#787774] text-lg transition-colors">›</button>
            </div>

            {/* Cabecera días */}
            <div className="grid grid-cols-7 border-b border-[#E9E9E7]">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold text-[#AEADAB] uppercase tracking-wide">{d}</div>
              ))}
            </div>

            {/* Celdas */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const ds   = day ? fmt(year, month, day) : '';
                const isToday    = ds === todayStr;
                const isSel      = ds === selected;
                const evs        = day ? eventsOn(day) : [];
                const hasCritical= evs.some(e => e.type === 'examen' || e.type === 'tarea');

                return (
                  <div key={i}
                    onClick={() => day && setSelected(isSel ? null : ds)}
                    className={`min-h-[80px] border-r border-b border-[#F7F6F3] p-1.5 transition-colors cursor-pointer
                      ${!day ? 'bg-[#F7F6F3]/30 cursor-default' : isSel ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]/70'}
                    `}
                  >
                    {day && (
                      <>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1 mx-auto font-medium relative
                          ${isToday ? 'bg-[#37352F] text-white font-bold' : 'text-[#37352F]'}`}>
                          {day}
                          {hasCritical && !isToday && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E03E3E] border border-white" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {evs.slice(0, 2).map(ev => (
                            <button key={ev.id} onClick={e => { e.stopPropagation(); setDetailEv(ev); }}
                              className={`w-full text-[9px] px-1 py-0.5 rounded font-medium truncate text-left ${EVENT_COLORS[ev.type].textBg}`}>
                              {ev.title}
                            </button>
                          ))}
                          {evs.length > 2 && (
                            <p className="text-[9px] text-[#AEADAB] pl-1">+{evs.length - 2}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Eventos del día seleccionado */}
          {selected && (
            <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
              <h3 className="font-semibold text-[#191919] text-sm mb-3">
                Eventos del {selected}
              </h3>
              {selEvents.length === 0 ? (
                <p className="text-sm text-[#AEADAB] text-center py-4">No hay eventos este día.</p>
              ) : (
                <div className="space-y-2">
                  {selEvents.map(ev => {
                    const ec  = EVENT_COLORS[ev.type];
                    const Ico = ec.icon;
                    return (
                      <button key={ev.id} onClick={() => setDetailEv(ev)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left hover:shadow-sm transition-all ${ec.bg}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          <Ico className="w-4 h-4" style={{ color: ev.type === 'examen' ? '#E03E3E' : ev.type === 'tarea' ? '#D9730D' : ev.type === 'clase' ? '#2E6FDB' : ev.type === 'anuncio' ? '#0F7B6C' : ev.type === 'evento' ? '#6940A5' : '#787774' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#191919] truncate">{ev.title}</p>
                          {ev.group && <p className="text-[11px] text-[#787774] mt-0.5">{ev.group} · {ev.teacherName}</p>}
                          {ev.time && (
                            <p className="text-[11px] text-[#787774] flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />{ev.time}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ec.textBg}`}>{ec.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Leyenda */}
          <div className="flex flex-wrap gap-3">
            {(Object.entries(EVENT_COLORS) as [EventType, typeof EVENT_COLORS[EventType]][]).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs text-[#787774]">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel derecho: próximos ───────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
            <h3 className="font-semibold text-[#191919] text-sm mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#787774]" /> Próximos eventos
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-[#AEADAB] text-center py-4">Sin eventos próximos.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map(ev => {
                  const ec  = EVENT_COLORS[ev.type];
                  const diffDays = Math.ceil((new Date(ev.date).getTime() - new Date(todayStr).getTime()) / 86400000);
                  return (
                    <button key={ev.id} onClick={() => setDetailEv(ev)}
                      className="w-full flex items-start gap-3 text-left hover:bg-[#F7F6F3] rounded-lg p-2 -mx-2 transition-colors">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${ec.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#191919] truncate">{ev.title}</p>
                        <p className="text-[10px] text-[#AEADAB] mt-0.5">{ev.date} {ev.group ? `· ${ev.group}` : ''}</p>
                      </div>
                      <span className={`text-[10px] font-semibold flex-shrink-0 ${diffDays === 0 ? 'text-[#E03E3E]' : diffDays <= 3 ? 'text-[#D9730D]' : 'text-[#787774]'}`}>
                        {diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Mañana' : `En ${diffDays}d`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumen del mes */}
          <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
            <h3 className="font-semibold text-[#191919] text-sm mb-3">Este mes</h3>
            {(['examen','tarea','evento','anuncio'] as EventType[]).map(type => {
              const count = MOCK_EVENTS.filter(e =>
                e.type === type &&
                e.date.startsWith(`${year}-${pad(month + 1)}`)
              ).length;
              if (count === 0) return null;
              const ec = EVENT_COLORS[type];
              return (
                <div key={type} className="flex items-center justify-between py-1.5 border-b border-[#F7F6F3] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ec.dot}`} />
                    <span className="text-xs text-[#787774]">{ec.label}s</span>
                  </div>
                  <span className="text-xs font-semibold text-[#191919]">{count}</span>
                </div>
              );
            })}
            {MOCK_EVENTS.filter(e => e.date.startsWith(`${year}-${pad(month + 1)}`)).length === 0 && (
              <p className="text-xs text-[#AEADAB]">Sin eventos este mes.</p>
            )}
          </div>

          {/* Recordatorio próximo */}
          {(() => {
            const next = upcoming.find(e => e.type === 'examen' || e.type === 'tarea');
            if (!next) return null;
            const ec = EVENT_COLORS[next.type];
            return (
              <div className={`border rounded-xl p-4 ${ec.bg}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${ec.dot.replace('bg-','text-')}`}>
                  ⚡ Próximo {ec.label}
                </p>
                <p className="text-sm font-semibold text-[#191919]">{next.title}</p>
                <p className="text-xs text-[#787774] mt-0.5">{next.date} {next.time ? `· ${next.time}` : ''}</p>
                {next.description && (
                  <p className="text-xs text-[#37352F] mt-2 leading-relaxed">{next.description}</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Modal detalle evento */}
      {detailEv && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setDetailEv(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${EVENT_COLORS[detailEv.type].textBg}`}>
                  {EVENT_COLORS[detailEv.type].label}
                </span>
                <h3 className="text-base font-bold text-[#191919] mt-2">{detailEv.title}</h3>
              </div>
              <button onClick={() => setDetailEv(null)} className="text-[#787774] hover:text-[#37352F] text-xl leading-none mt-1">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#787774]">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{detailEv.date}{detailEv.time ? ` · ${detailEv.time}` : ''}</span>
              </div>
              {detailEv.group && (
                <div className="flex items-center gap-2 text-[#787774]">
                  <BookOpen className="w-4 h-4 flex-shrink-0" />
                  <span>{detailEv.group}</span>
                </div>
              )}
              {detailEv.teacherName && (
                <div className="flex items-center gap-2 text-[#787774]">
                  <Megaphone className="w-4 h-4 flex-shrink-0" />
                  <span>{detailEv.teacherName}</span>
                </div>
              )}
              {detailEv.description && (
                <p className="text-[#37352F] bg-[#F7F6F3] rounded-lg p-3 text-xs leading-relaxed mt-2">
                  {detailEv.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
