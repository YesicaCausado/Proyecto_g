import { useCallback, useMemo, useState } from 'react';
import {
  BarChart3, Building2, ClipboardList, Database, GraduationCap, LifeBuoy, RefreshCw,
  TrendingUp, UserRound, Users,
} from 'lucide-react';
import FiltersBar from './reportes/Filtros';
import ResumenCards from './reportes/Resumen';
import CompetenciasSection from './reportes/Competencias';
import GruposSection from './reportes/Grupos';
import ProfesoresSection from './reportes/Profesores';
import EstudiantesSection from './reportes/Estudiantes';
import EvaluacionesSection from './reportes/Evaluaciones';
import SeguimientoSection from './reportes/Seguimiento';
import EvolucionSection from './reportes/Evolucion';
import CalidadSection from './reportes/Calidad';
import { EmptyState, ErrorBox, ExportButtons, Loading, Notice } from './reportes/ui';
import { defaultFilters, fmtDate, presetRange, refreshReports, toParams, useReport, type PresetKey } from './reportes/lib';
import type { FilterOptions, Filters, Overview } from './reportes/types';

// Módulo Reportes del Súper Profesor. Todos los datos vienen de
// /api/v1/super/reports/* (backend/app/services/super_report_service.py),
// filtrados y aislados por institución en el backend.

const SECTIONS = [
  { id: 'competencias', label: 'Competencias', icon: BarChart3, export: 'competencias' },
  { id: 'grupos', label: 'Grupos', icon: Users, export: 'grupos' },
  { id: 'profesores', label: 'Profesores', icon: GraduationCap, export: 'profesores' },
  { id: 'estudiantes', label: 'Estudiante', icon: UserRound, export: 'estudiante' },
  { id: 'evaluaciones', label: 'Evaluaciones', icon: ClipboardList, export: 'evaluaciones' },
  { id: 'seguimiento', label: 'Seguimiento', icon: LifeBuoy, export: 'seguimiento' },
  { id: 'evolucion', label: 'Evolución', icon: TrendingUp, export: 'evolucion' },
  { id: 'calidad', label: 'Calidad de datos', icon: Database, export: 'calidad' },
] as const;
type SectionId = typeof SECTIONS[number]['id'];

export default function ReportesTab() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [preset, setPreset] = useState<PresetKey>('30d');
  const [section, setSection] = useState<SectionId>('competencias');
  const [reload, setReload] = useState(0);

  const options = useReport<FilterOptions>('/super/reports/filters', {}, reload);

  // Un rango personalizado incompleto no se consulta hasta tener ambas fechas válidas.
  const customIncomplete = preset === 'custom' && (!filters.start_date || !filters.end_date || filters.start_date > filters.end_date);
  const params = useMemo(() => toParams(filters), [filters]);
  const overviewParams = useMemo(() => { const p = { ...params }; delete p.eval_status; return p; }, [params]);
  const overview = useReport<Overview>(customIncomplete ? null : '/super/reports/overview', overviewParams, reload);
  const data = overview.data ?? overview.stale;

  const patch = useCallback((p: Partial<Filters>) => {
    setFilters(f => ({ ...f, ...p }));
    // Al elegir un estudiante en los filtros, abrir su reporte individual.
    if (p.student_id) setSection('estudiantes');
  }, []);
  const onPreset = (key: PresetKey) => {
    setPreset(key);
    const r = presetRange(key);
    if (r) patch({ start_date: r.start, end_date: r.end });
  };
  const clear = () => { setPreset('30d'); setFilters(defaultFilters()); };
  const refresh = () => { refreshReports(); setReload(n => n + 1); };

  const current = SECTIONS.find(s => s.id === section)!;
  const exportSection = current.export === 'estudiante' && !filters.student_id ? 'completo' : current.export;

  return (
    <div className="space-y-4">
      {/* ── Encabezado: institución, actualización y acciones ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#E9E9E7] rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-[#E7F1FB] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4.5 h-4.5 text-[#0B6E99]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#191919] truncate">
              {data?.meta.institution.name ?? options.data?.institution.name ?? 'Institución'}
              {data?.meta.institution.dane_code && <span className="font-normal text-[#787774]"> · DANE {data.meta.institution.dane_code}</span>}
            </p>
            <p className="text-xs text-[#787774]">
              {overview.loading ? 'Actualizando datos…'
                : data ? <>Datos actualizados: {fmtDate(data.meta.generated_at, true)} · {data.meta.period.label}</>
                : 'Sin datos cargados'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={refresh} disabled={overview.loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E9E9E7] bg-white hover:bg-[#F7F6F3] text-xs font-semibold text-[#37352F] disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${overview.loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#787774] hidden sm:inline">
              Exportar {exportSection === 'completo' ? 'reporte completo' : `«${current.label}»`}:
            </span>
            <ExportButtons section={exportSection} params={params} disabled={!data} />
          </div>
        </div>
      </div>

      <FiltersBar filters={filters} options={options.data} preset={preset} onPreset={onPreset} onChange={patch}
        onClear={clear} showEvalStatus={section === 'evaluaciones'} studentLabel={data?.meta.filters.student} />

      {customIncomplete && <Notice tone="warn">Elige una fecha inicial y una final válidas para consultar el rango personalizado.</Notice>}
      {overview.error && <ErrorBox message={overview.error} onRetry={refresh} />}
      {overview.loading && !data && <Loading label="Calculando reportes con los datos de la institución…" />}

      {data && (
        <div className={`space-y-4 transition-opacity ${overview.loading ? 'opacity-60' : ''}`}>
          {/* ── Resumen ejecutivo ── */}
          <section aria-labelledby="rep-resumen">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
              <div>
                <h3 id="rep-resumen" className="font-semibold text-[#191919] text-[15px]">Resumen ejecutivo institucional</h3>
                <p className="text-xs text-[#787774]">
                  {data.meta.period.label}
                  {data.meta.previous_period && <> · comparado con {data.meta.previous_period.start} a {data.meta.previous_period.end}</>}
                  {' '}· Escala: {data.meta.scale}
                </p>
              </div>
              <ExportButtons section="resumen" params={params} disabled={!data.quality.students_with_results} />
            </div>
            {data.cards.evaluated_students.registered === 0 ? (
              <EmptyState title="No hay estudiantes en el alcance seleccionado" text="Cambia o limpia los filtros." />
            ) : (
              <ResumenCards data={data} onGo={id => setSection(id as SectionId)} />
            )}
          </section>

          {/* ── Secciones ── */}
          <nav className="flex gap-1 overflow-x-auto bg-white border border-[#E9E9E7] rounded-xl p-1 shadow-sm" aria-label="Secciones de reportes">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = s.id === section;
              return (
                <button key={s.id} onClick={() => setSection(s.id)} aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                    ${active ? 'bg-[#E7F1FB] text-[#0B6E99]' : 'text-[#787774] hover:bg-[#F7F6F3]'}`}>
                  <Icon className="w-3.5 h-3.5" /> {s.label}
                </button>
              );
            })}
          </nav>

          {section === 'competencias' && <CompetenciasSection data={data} params={params} />}
          {section === 'grupos' && <GruposSection data={data} params={params} />}
          {section === 'profesores' && <ProfesoresSection data={data} params={params} />}
          {section === 'estudiantes' && (
            <EstudiantesSection params={params} selectedId={filters.student_id} onSelect={id => patch({ student_id: id })} />
          )}
          {section === 'evaluaciones' && <EvaluacionesSection params={params} />}
          {section === 'seguimiento' && <SeguimientoSection params={params} filters={filters} onCriteria={patch} />}
          {section === 'evolucion' && <EvolucionSection data={data} params={params} />}
          {section === 'calidad' && <CalidadSection data={data} params={params} />}
        </div>
      )}
    </div>
  );
}
