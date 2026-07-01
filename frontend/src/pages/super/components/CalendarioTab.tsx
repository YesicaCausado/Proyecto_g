import { useState } from 'react';
import { Calendar, Plus, X, ChevronLeft, ChevronRight, Clock, Tag } from 'lucide-react';

type EventType = 'examen' | 'reunion' | 'feriado' | 'capacitacion' | 'importante';

interface CalEvent {
  id: number;
  date: string;   // YYYY-MM-DD
  title: string;
  type: EventType;
  time?: string;
  description?: string;
}

const TYPE_CONFIG: Record<EventType, { label: string; color: string; bg: string; dot: string }> = {
  examen:        { label: 'Examen',         color: 'text-[#E03E3E]', bg: 'bg-red-50 border-red-200',     dot: 'bg-[#E03E3E]' },
  reunion:       { label: 'Reunión',        color: 'text-[#6940A5]', bg: 'bg-purple-50 border-purple-200', dot: 'bg-[#6940A5]' },
  feriado:       { label: 'Feriado',        color: 'text-[#0F7B6C]', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-[#0F7B6C]' },
  capacitacion:  { label: 'Capacitación',   color: 'text-[#0B6E99]', bg: 'bg-blue-50 border-blue-200',   dot: 'bg-[#0B6E99]' },
  importante:    { label: 'Fecha importante', color: 'text-[#D9730D]', bg: 'bg-orange-50 border-orange-200', dot: 'bg-[#D9730D]' },
};

const INITIAL_EVENTS: CalEvent[] = [
  { id: 1,  date: '2026-07-05', title: 'Reunión de docentes',          type: 'reunion',      time: '08:00' },
  { id: 2,  date: '2026-07-10', title: 'Exámenes Período 2 — Grado 8', type: 'examen',       time: '07:00' },
  { id: 3,  date: '2026-07-20', title: 'Día del Docente',               type: 'feriado' },
  { id: 4,  date: '2026-07-15', title: 'Capacitación NeuroLearn',       type: 'capacitacion', time: '14:00' },
  { id: 5,  date: '2026-07-28', title: 'Cierre primer semestre',        type: 'importante',   time: '12:00' },
  { id: 6,  date: '2026-07-03', title: 'Entrega calificaciones período', type: 'importante',  time: '17:00' },
];

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CalendarioTab() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents]     = useState<CalEvent[]>(INITIAL_EVENTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'reunion' as EventType, time: '', description: '' });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, (): null => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const dateStr = (d: number) => `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const eventsOn = (d: number) => events.filter(e => e.date === dateStr(d));
  const todayStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const handleAddEvent = () => {
    if (!form.title.trim() || !selected) return;
    const ev: CalEvent = { id: Date.now(), date: selected, title: form.title, type: form.type, time: form.time || undefined, description: form.description || undefined };
    setEvents(prev => [...prev, ev]);
    setForm({ title: '', type: 'reunion', time: '', description: '' });
    setShowForm(false);
  };

  const handleDelete = (id: number) => setEvents(prev => prev.filter(e => e.id !== id));

  const selectedEvents = selected ? events.filter(e => e.date === selected) : [];
  const upcomingEvents = events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Calendario ── */}
        <div className="lg:col-span-2 bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
          {/* Header del mes */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9E9E7]">
            <button onClick={prevMonth} className="p-1.5 hover:bg-[#F7F6F3] rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-[#787774]" /></button>
            <h3 className="font-semibold text-[#191919]">{MONTHS_ES[month]} {year}</h3>
            <button onClick={nextMonth} className="p-1.5 hover:bg-[#F7F6F3] rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-[#787774]" /></button>
          </div>

          {/* Cabecera días */}
          <div className="grid grid-cols-7 border-b border-[#E9E9E7]">
            {DAYS_ES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-[#787774]">{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="h-20 border-r border-b border-[#F7F6F3]" />;
              const ds = dateStr(day);
              const dayEvents = eventsOn(day);
              const isToday = ds === todayStr;
              const isSelected = ds === selected;
              return (
                <div
                  key={ds}
                  onClick={() => setSelected(isSelected ? null : ds)}
                  className={`h-20 p-1.5 border-r border-b border-[#F7F6F3] cursor-pointer transition-colors overflow-hidden ${isSelected ? 'bg-purple-50' : 'hover:bg-[#F7F6F3]/50'}`}
                >
                  <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold mb-1 ${isToday ? 'bg-[#6940A5] text-white' : 'text-[#37352F]'}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div key={ev.id} className={`text-[9px] font-medium px-1 py-0.5 rounded truncate flex items-center gap-0.5 ${TYPE_CONFIG[ev.type].bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_CONFIG[ev.type].dot}`} />
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <p className="text-[9px] text-[#787774] pl-1">+{dayEvents.length - 2} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div className="space-y-4">

          {/* Próximos eventos */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <h4 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#787774]" /> Próximos eventos
            </h4>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-[#787774]">Sin eventos próximos.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className={`flex items-start gap-2 p-2.5 rounded-md border text-xs ${TYPE_CONFIG[ev.type].bg}`}>
                    <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${TYPE_CONFIG[ev.type].dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${TYPE_CONFIG[ev.type].color}`}>{ev.title}</p>
                      <p className="text-[#787774] mt-0.5">{ev.date}{ev.time ? ` — ${ev.time}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detalle del día seleccionado */}
          {selected && (
            <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-[#191919] text-sm">{selected}</h4>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs text-[#6940A5] hover:underline font-medium">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-[#787774]">Sin eventos en este día.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(ev => (
                    <div key={ev.id} className={`flex items-start justify-between p-2.5 rounded-md border text-xs ${TYPE_CONFIG[ev.type].bg}`}>
                      <div>
                        <p className={`font-semibold ${TYPE_CONFIG[ev.type].color}`}>{ev.title}</p>
                        {ev.time && <p className="text-[#787774] flex items-center gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" />{ev.time}</p>}
                        <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_CONFIG[ev.type].bg} ${TYPE_CONFIG[ev.type].color}`}>
                          {TYPE_CONFIG[ev.type].label}
                        </span>
                      </div>
                      <button onClick={() => handleDelete(ev.id)} className="text-[#787774] hover:text-[#E03E3E] transition-colors ml-2 flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Leyenda de tipos */}
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <h4 className="font-semibold text-[#191919] text-sm mb-2 flex items-center gap-2"><Tag className="w-4 h-4 text-[#787774]" /> Tipos de evento</h4>
            <div className="space-y-1.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-[#37352F]">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal agregar evento */}
      {showForm && selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#191919]">Nuevo evento — {selected}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#787774] hover:text-[#37352F]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Título</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ej: Examen de Matemáticas" autoFocus
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Tipo</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value as EventType})}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#6940A5]">
                    {Object.entries(TYPE_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Hora</label>
                  <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Descripción (opcional)</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5] resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E9E9E7]">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-[#F7F6F3]">Cancelar</button>
              <button onClick={handleAddEvent} disabled={!form.title.trim()}
                className="px-5 py-2 bg-[#6940A5] text-white text-sm font-medium rounded-md hover:bg-[#5A358F] disabled:opacity-50 transition-colors">
                Guardar evento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
