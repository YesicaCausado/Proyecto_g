import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { HBarChart } from './charts';
import { DataTable, Drawer, EmptyState, ErrorBox, ExportButtons, KeyValue, Loading, Notice, Panel, Pill, SubTitle } from './ui';
import { EvolutionView } from './Evolucion';
import { GroupTable } from './Grupos';
import { EvaluationTable } from './Evaluaciones';
import { BRAND, COMP_COLORS, fmtDate, fmtPct, useReport } from './lib';
import type { Overview, TeacherDetail } from './types';

export default function ProfesoresSection({ data, params }: { data: Overview; params: Record<string, unknown> }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = data.teachers;
  return (
    <Panel
      title="Desempeño y actividad de profesores"
      description="Actividad académica y resultados de los grupos de cada profesor. Selecciona un profesor para ver el detalle."
      actions={<ExportButtons section="profesores" params={params} disabled={!rows.length} />}
    >
      <div className="space-y-3">
        <Notice>
          El promedio de los estudiantes no es una medición directa de la calidad docente: depende del tamaño de los grupos,
          de cuántos estudiantes participan y de las competencias evaluadas. Por eso esta tabla no ordena ni clasifica a los profesores por defecto.
        </Notice>
        <DataTable rows={rows} rowKey={t => t.id} onRowClick={t => setOpen(t.id)} caption="Profesores"
          empty={<EmptyState icon={GraduationCap} title="No hay profesores en el alcance seleccionado" />}
          columns={[
            { key: 'n', header: 'Profesor', render: t => <><span className="font-medium">{t.name}</span>{t.subject_area && <span className="block text-[11px] text-[#9B9A97]">{t.subject_area}</span>}</>, sortValue: t => t.name },
            { key: 'g', header: 'Grupos', align: 'right', render: t => t.groups || <span className="text-[#9B9A97]">Sin grupos</span>, sortValue: t => t.groups },
            { key: 's', header: 'Estudiantes', align: 'right', render: t => t.students, sortValue: t => t.students },
            { key: 'e', header: 'Evaluados', align: 'right', render: t => t.evaluated, sortValue: t => t.evaluated },
            { key: 'p', header: 'Eval. publicadas', align: 'right', render: t => t.evaluations_published, sortValue: t => t.evaluations_published },
            { key: 'c', header: 'Entregas calificadas', align: 'right', render: t => t.evaluations_completed, sortValue: t => t.evaluations_completed },
            { key: 'a', header: 'Promedio de sus grupos', align: 'right', render: t => <>{fmtPct(t.average)}{t.small_sample && t.evaluated > 0 && <span className="block"><Pill>muestra pequeña</Pill></span>}</>, sortValue: t => t.average },
            { key: 'w', header: 'Menor competencia', render: t => t.worst_competency ? `${t.worst_competency.name} (${fmtPct(t.worst_competency.average)})` : '—' },
            { key: 'l', header: 'Última actividad', render: t => fmtDate(t.last_activity), sortValue: t => t.last_activity },
          ]} />
      </div>
      <TeacherDrawer id={open} params={params} onClose={() => setOpen(null)} />
    </Panel>
  );
}

function TeacherDrawer({ id, params, onClose }: { id: number | null; params: Record<string, unknown>; onClose: () => void }) {
  const p = { ...params };
  delete p.classroom_id; delete p.teacher_id; delete p.student_id;
  const { data, loading, error } = useReport<TeacherDetail>(id ? `/super/reports/teachers/${id}` : null, p);
  const t = data?.teacher;
  return (
    <Drawer open={id !== null} onClose={onClose} title={t?.name ?? 'Profesor'}
      subtitle={data ? `${data.meta.period.label} · ${data.meta.institution.name}` : undefined}
      actions={id ? <ExportButtons section="profesores" params={{ ...p, teacher_id: id }} /> : undefined}>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && t && (
        <>
          <KeyValue items={[
            { label: 'Grupos', value: t.groups },
            { label: 'Estudiantes', value: t.students ?? 0 },
            { label: 'Participación', value: fmtPct(t.participation ?? null) },
            { label: 'Eval. publicadas', value: t.evaluations_published ?? 0 },
            { label: 'Promedio', value: fmtPct(t.average ?? null) },
          ]} />
          {!data.groups.length ? (
            <EmptyState icon={GraduationCap} title="Este profesor no tiene grupos activos" />
          ) : (
            <>
              <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
                <SubTitle>Comparación de sus grupos</SubTitle>
                {data.comparison_note && <p className="text-[11px] text-[#787774] mb-2">{data.comparison_note}</p>}
                <HBarChart rows={data.groups.map(g => ({ key: g.id, label: g.name, value: g.average, color: BRAND,
                  sub: `${g.evaluated}/${g.enrolled} evaluados · participación ${fmtPct(g.participation)}` }))} />
                <div className="mt-3"><GroupTable rows={data.groups} /></div>
              </section>
              <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
                <SubTitle>Rendimiento por competencia</SubTitle>
                <HBarChart rows={data.competencies.map(c => ({ key: c.key, label: c.name, value: c.average, color: COMP_COLORS[c.key],
                  sub: c.results ? `${c.students} estudiante(s) · ${c.results} resultado(s)` : 'Sin resultados' }))} />
              </section>
              <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
                <SubTitle>Evolución de los resultados</SubTitle>
                <EvolutionView evo={data.evolution} />
              </section>
            </>
          )}
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Evaluaciones registradas</SubTitle>
            <EvaluationTable rows={data.evaluations} />
            <p className="text-[11px] text-[#9B9A97] mt-2">
              Solo se listan evaluaciones docentes. Las asignaciones de NeuroBots y los materiales tienen su propio seguimiento en las secciones NeuroBots y Grupos.
            </p>
          </section>
        </>
      )}
    </Drawer>
  );
}
