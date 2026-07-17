import { useState, useEffect } from 'react';
import api from '../../../services/api';

type EventType = 'examen' | 'tarea' | 'clase' | 'anuncio' | 'evento';

interface CalEvent {
  id: string;
  title: string;
  date: string;
  type: EventType;
  group?: string;
}

const EVENT_COLORS: Record<EventType, { bg: string; dot: string; label: string }> = {
  examen:   { bg: 'bg-red-100 text-[#E03E3E]',      dot: 'bg-[#E03E3E]',  label: 'Examen'    },
  tarea:    { bg: 'bg-orange-100 text-[#D9730D]',    dot: 'bg-[#D9730D]',  label: 'Tarea'     },
  clase:    { bg: 'bg-[#EEF3FD] text-[#2E6FDB]',    dot: 'bg-[#2E6FDB]',  label: 'Clase'     },
  anuncio:  { bg: 'bg-emerald-100 text-[#0F7B6C]',  dot: 'bg-[#0F7B6C]',  label: 'Anuncio'   },
  evento:   { bg: 'bg-purple-100 text-[#6940A5]',   dot: 'bg-[#6940A5]',  label: 'Evento'    },
};

const today = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (y: number, m: number, d: number) => `${y}-${pad(m+1)}-${pad(d)}`;
const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const GROUPS = ['Matemáticas 9A','Física 10B','Álgebra 8C','Cálculo 11A','Todos'];

function mapEvent(raw: any): CalEvent {
  return {
    id:    String(raw.id),
    title: raw.title,
    date:  raw.event_date ?? raw.date,
    type:  (raw.event_type ?? raw.type ?? 'clase') as EventType,
    group: raw.classroom_name ?? raw.group,
  };
}

export default function CalendarioTab() {
  const [month,    setMonth]    = useState(today.getMonth());
  const [year,     setYear]     = useState(today.getFullYear());
  const [events,   setEvents]   = useState<CalEvent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', type:'clase' as EventType, group:'Todos', date:'' });

  const monthStr = `${year}-${pad(month + 1)}`;

  useEffect(() => {
    api.get(`/events?month=${monthStr}`)
      .then(r => setEvents((r.data.events ?? r.data ?? []).map(mapEvent)))
      .catch(() => setEvents([]));
  }, [monthStr]);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const eventsOnDay = (d: number) => events.filter(e => e.date === dateStr(year, month, d));
  const selectedEvents = selected ? events.filter(e => e.date === selected) : [];

  const addEvent = async () => {
    if (!form.title.trim() || !form.date) return;
    try {
      const res = await api.post('/events', {
        title:      form.title.trim(),
        event_type: form.type,
        event_date: form.date,
      });
      setEvents(prev => [...prev, mapEvent(res.data)]);
    } catch {
      const ev: CalEvent = { id: Date.now().toString(), title: form.title.trim(), type: form.type, date: form.date, group: form.group !== 'Todos' ? form.group : undefined };
      setEvents(prev => [...prev, ev]);
    }
    setForm({ title:'', type:'clase', group:'Todos', date:'' });
    setShowForm(false);
  };

  const deleteEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    try { await api.delete(`/events/${id}`); } catch { /* already removed */ }
  };

  const prev = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const upcomingEvents = [...events]
    .filter(e => e.date >= todayStr)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* ── Calendario grid ──────────────────────────────────── */}
      <div className="xl:col-span-2 space-y-4">
        <div className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden">
          {/* Nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9E9E7]">
            <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F6F3] text-[#787774] text-lg transition-colors">‹</button>
            <h3 className="font-bold text-[#191919]">{MONTHS[month]} {year}</h3>
            <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F6F3] text-[#787774] text-lg transition-colors">›</button>
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
              const ds = day ? dateStr(year, month, day) : '';
              const isToday = ds === todayStr;
              const isSelected = ds === selected;
              const evs = day ? eventsOnDay(day) : [];

              return (
                <div key={i}
                  onClick={() => day && setSelected(isSelected ? null : ds)}
                  className={`min-h-[72px] border-r border-b border-[#F7F6F3] p-1.5 cursor-pointer transition-colors
                    ${!day ? 'bg-[#F7F6F3]/40' : isSelected ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]/60'}
                  `}
                >
                  {day && (
                    <>
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1 mx-auto font-medium
                        ${isToday ? 'bg-[#2E6FDB] text-white font-bold' : 'text-[#37352F]'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {evs.slice(0, 2).map(ev => (
                          <div key={ev.id} className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${EVENT_COLORS[ev.type].bg}`}>
                            {ev.title}
                          </div>
                        ))}
                        {evs.length > 2 && <div className="text-[9px] text-[#AEADAB] pl-1">+{evs.length - 2}</div>}
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
          <div className="bg-white border border-[#E9E9E7] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#191919] text-sm">Eventos del {selected}</h3>
              <button onClick={() => { setForm(p=>({...p,date:selected})); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6FDB] text-white rounded-lg text-xs font-medium hover:bg-[#255DC0] transition-colors">
                + Agregar
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-[#AEADAB] text-center py-4">No hay eventos este día.</p>
            ) : (
              selectedEvents.map(ev => (
                <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-lg ${EVENT_COLORS[ev.type].bg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_COLORS[ev.type].dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.title}</p>
                    {ev.group && <p className="text-[11px] opacity-70">{ev.group}</p>}
                  </div>
                  <button onClick={() => deleteEvent(ev.id)} className="opacity-50 hover:opacity-100 text-xs transition-opacity">×</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 px-1">
          {(Object.entries(EVENT_COLORS) as [EventType, typeof EVENT_COLORS[EventType]][]).map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-[#787774]">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />{cfg.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel derecho: próximos eventos ──────────────────── */}
      <div className="space-y-4">
        <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#191919] text-sm">Próximos eventos</h3>
            <button onClick={() => { setForm(p=>({...p,date:todayStr})); setShowForm(true); }}
              className="text-xs text-[#2E6FDB] hover:underline font-medium">+ Nuevo</button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-[#AEADAB] text-center py-4">Sin eventos próximos.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${EVENT_COLORS[ev.type].dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#191919] truncate">{ev.title}</p>
                    <p className="text-[10px] text-[#AEADAB]">{ev.date} {ev.group ? `· ${ev.group}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal agregar evento */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-[#191919]">Agregar evento</h3>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Título *</label>
              <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
                placeholder="ej. Examen parcial — Física"
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Tipo</label>
                <select value={form.type} onChange={e => setForm(p=>({...p,type:e.target.value as EventType}))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none bg-white">
                  {(Object.entries(EVENT_COLORS) as [EventType, any][]).map(([t,c]) => <option key={t} value={t}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Grupo (opcional)</label>
              <select value={form.group} onChange={e => setForm(p=>({...p,group:e.target.value}))}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none bg-white">
                {GROUPS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={addEvent} disabled={!form.title.trim() || !form.date}
                className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
