import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import api from '../../../../services/api';
import { PRESETS, type PresetKey } from './lib';
import type { FilterOptions, Filters, Page, StudentListRow, Source } from './types';

const selectCls = 'w-full px-2.5 py-1.5 border border-[#E9E9E7] rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#0B6E99] focus:border-[#0B6E99] outline-none';
const labelCls = 'block text-[10.5px] font-semibold uppercase tracking-wide text-[#787774] mb-1';

export default function FiltersBar({ filters, options, preset, onPreset, onChange, onClear, showEvalStatus, studentLabel }: {
  filters: Filters; options: FilterOptions | null; preset: PresetKey;
  onPreset: (p: PresetKey) => void; onChange: (patch: Partial<Filters>) => void; onClear: () => void;
  showEvalStatus: boolean; studentLabel?: string | null;
}) {
  // Grupos dependientes del profesor seleccionado
  const groups = useMemo(() => (options?.groups ?? []).filter(
    g => !filters.teacher_id || String(g.teacher_id) === filters.teacher_id), [options, filters.teacher_id]);

  const active = [filters.classroom_id, filters.teacher_id, filters.student_id, filters.competency,
    filters.eval_status].some(Boolean) || filters.source !== 'todas' || preset !== '30d';

  return (
    <div className="bg-white border border-[#E9E9E7] rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
        <div className="xl:col-span-1">
          <label className={labelCls} htmlFor="rf-periodo">Período</label>
          <select id="rf-periodo" className={selectCls} value={preset} onChange={e => onPreset(e.target.value as PresetKey)}>
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        {preset === 'custom' && (
          <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="rf-desde">Desde</label>
              <input id="rf-desde" type="date" className={selectCls} value={filters.start_date}
                max={filters.end_date || undefined} onChange={e => onChange({ start_date: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="rf-hasta">Hasta</label>
              <input id="rf-hasta" type="date" className={selectCls} value={filters.end_date}
                min={filters.start_date || undefined} onChange={e => onChange({ end_date: e.target.value })} />
            </div>
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="rf-profesor">Profesor</label>
          <select id="rf-profesor" className={selectCls} value={filters.teacher_id}
            onChange={e => {
              const teacher = e.target.value;
              const keepGroup = !teacher || (options?.groups ?? []).some(
                g => String(g.id) === filters.classroom_id && String(g.teacher_id) === teacher);
              onChange({ teacher_id: teacher, classroom_id: keepGroup ? filters.classroom_id : '', student_id: '' });
            }}>
            <option value="">Todos los profesores</option>
            {(options?.teachers ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="rf-grupo">Grupo</label>
          <select id="rf-grupo" className={selectCls} value={filters.classroom_id}
            onChange={e => onChange({ classroom_id: e.target.value, student_id: '' })}>
            <option value="">{filters.teacher_id ? 'Todos sus grupos' : 'Todos los grupos'}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.grade ? ` · ${g.grade}°` : ''}</option>)}
          </select>
        </div>
        <StudentPicker filters={filters} label={studentLabel} onPick={id => onChange({ student_id: id })} />
        <div>
          <label className={labelCls} htmlFor="rf-competencia">Competencia</label>
          <select id="rf-competencia" className={selectCls} value={filters.competency}
            onChange={e => onChange({ competency: e.target.value })}>
            <option value="">Las cinco competencias</option>
            {(options?.competencies ?? []).map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="rf-fuente">Fuente de resultados</label>
          <select id="rf-fuente" className={selectCls} value={filters.source}
            onChange={e => onChange({ source: e.target.value as Source })}>
            {(options?.sources ?? [{ key: 'todas', name: 'Todas las fuentes' }]).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </div>
        {showEvalStatus && (
          <div>
            <label className={labelCls} htmlFor="rf-estado">Estado de evaluación</label>
            <select id="rf-estado" className={selectCls} value={filters.eval_status}
              onChange={e => onChange({ eval_status: e.target.value })}>
              <option value="">Todos los estados</option>
              {(options?.eval_statuses ?? []).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-end">
          <button onClick={onClear} disabled={!active}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E9E9E7] text-[#37352F] bg-white hover:bg-[#F7F6F3] disabled:opacity-40 w-full justify-center">
            <RotateCcw className="w-3.5 h-3.5" /> Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  );
}

/** Buscador de estudiantes limitado al profesor/grupo seleccionados. */
function StudentPicker({ filters, onPick, label }: { filters: Filters; onPick: (id: string) => void; label?: string | null }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StudentListRow[]>([]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const selectedName = picked && picked.id === filters.student_id ? picked.name : '';

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get<Page<StudentListRow>>('/super/reports/students', {
        params: { q, size: 15, classroom_id: filters.classroom_id || undefined, teacher_id: filters.teacher_id || undefined },
      }).then(r => setItems(r.data.items)).catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, filters.classroom_id, filters.teacher_id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={box} className="relative">
      <label className={labelCls} htmlFor="rf-estudiante">Estudiante</label>
      {filters.student_id ? (
        <div className="flex items-center gap-1 px-2.5 py-1.5 border border-[#0B6E99] bg-[#F4FAFD] rounded-lg text-sm">
          <span className="truncate flex-1 text-[#0B4F6E] font-medium">{selectedName || label || 'Estudiante seleccionado'}</span>
          <button onClick={() => onPick('')} aria-label="Quitar estudiante" className="text-[#0B6E99] hover:text-[#074D6E]"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9B9A97]" />
          <input id="rf-estudiante" className={`${selectCls} pl-8`} placeholder="Todos · buscar por nombre"
            value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            role="combobox" aria-expanded={open} aria-controls="rf-estudiante-lista" autoComplete="off" />
        </div>
      )}
      {open && !filters.student_id && (
        <ul id="rf-estudiante-lista" role="listbox"
          className="absolute z-30 mt-1 w-full min-w-[240px] max-h-64 overflow-y-auto bg-white border border-[#E9E9E7] rounded-lg shadow-lg py-1">
          {items.length === 0 && <li className="px-3 py-2 text-xs text-[#9B9A97]">Sin coincidencias en el alcance seleccionado</li>}
          {items.map(s => (
            <li key={s.id} role="option" aria-selected={false}>
              <button className="w-full text-left px-3 py-1.5 hover:bg-[#F4FAFD]"
                onClick={() => { onPick(String(s.id)); setPicked({ id: String(s.id), name: s.name }); setQ(''); setOpen(false); }}>
                <span className="block text-sm text-[#37352F]">{s.name}</span>
                <span className="block text-[11px] text-[#9B9A97] truncate">@{s.username} · {s.groups.join(', ') || 'Sin grupo'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

