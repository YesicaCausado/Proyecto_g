import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ExportButtons, Panel, SubTitle } from './ui';
import { fmtDate } from './lib';
import type { Overview } from './types';

export default function CalidadSection({ data, params }: { data: Overview; params: Record<string, unknown> }) {
  const q = data.quality;
  const coverage = q.registered_students ? Math.round((q.students_with_results / q.registered_students) * 1000) / 10 : null;
  const items: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Estudiantes registrados', value: q.registered_students, hint: 'Activos en el alcance de los filtros' },
    { label: 'Con resultados en el período', value: q.students_with_results, hint: coverage === null ? undefined : `${coverage.toLocaleString('es-CO')} % de cobertura` },
    { label: 'Sin resultados', value: q.students_without_results, hint: 'Sin datos: no equivale a bajo rendimiento' },
    { label: 'Sin grupo asignado', value: q.students_without_group },
    { label: 'Resultados de quizzes', value: q.quiz_results },
    { label: 'Evaluaciones calificadas (oficiales)', value: q.graded_results },
    { label: 'Entregas por calificar', value: q.pending_review, hint: 'Sin nota final: fuera de los promedios' },
    { label: 'Intentos en curso', value: q.open_submissions },
    { label: 'Quizzes sin completar', value: q.pending_quizzes, hint: 'Generados pero no respondidos' },
    { label: 'Sin competencia identificada', value: q.unclassified_results, hint: 'Cuentan solo en el promedio general' },
  ];
  return (
    <Panel title="Calidad y cobertura de los datos"
      description={<>Qué tan completos son los datos de estos reportes. Última actualización: {fmtDate(data.meta.generated_at, true)} · último registro: {fmtDate(q.latest_record, true)}.</>}
      actions={<ExportButtons section="calidad" params={params} />}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.map(i => (
            <div key={i.label} className="border border-[#E9E9E7] rounded-lg px-3 py-2.5">
              <dt className="text-[10.5px] uppercase tracking-wide text-[#787774] font-semibold leading-tight">{i.label}</dt>
              <dd className="text-xl font-bold text-[#191919] mt-1 tabular-nums">{i.value}</dd>
              {i.hint && <dd className="text-[11px] text-[#9B9A97] leading-tight mt-0.5">{i.hint}</dd>}
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-[#E9E9E7] rounded-lg p-3">
            <SubTitle>Competencias con datos</SubTitle>
            <p className="text-sm text-[#37352F]">{q.competencies_with_data.join(' · ') || 'Ninguna'}</p>
          </div>
          <div className="border border-[#E9E9E7] rounded-lg p-3">
            <SubTitle>Competencias sin datos</SubTitle>
            <p className="text-sm text-[#37352F]">{q.competencies_without_data.join(' · ') || 'Ninguna'}</p>
          </div>
        </div>
        <div>
          <SubTitle>Advertencias</SubTitle>
          {q.warnings.length === 0 ? (
            <p className="text-sm text-[#0F7B6C] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Sin advertencias para estos filtros.</p>
          ) : (
            <ul className="space-y-1.5">
              {q.warnings.map(w => (
                <li key={w} className="flex items-start gap-2 text-xs text-[#7A5B00] bg-[#FBF3DB] border border-[#F1E2B3] rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{w}
                </li>
              ))}
            </ul>
          )}
        </div>
        <details className="text-xs text-[#787774] border border-[#E9E9E7] rounded-lg px-3 py-2">
          <summary className="cursor-pointer font-semibold text-[#37352F]">Notas metodológicas</summary>
          <ul className="list-disc pl-5 mt-2 space-y-1">{data.meta.methodology.map(m => <li key={m}>{m}</li>)}</ul>
        </details>
      </div>
    </Panel>
  );
}
