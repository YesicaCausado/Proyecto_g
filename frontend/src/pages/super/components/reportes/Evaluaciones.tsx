import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { ColumnChart, DistributionBar } from './charts';
import { DataTable, Drawer, EmptyState, ErrorBox, ExportButtons, KeyValue, Loading, Notice, Pagination, Panel, Pill, SubTitle } from './ui';
import { fmtDate, fmtPct, useKeyedPage, useReport } from './lib';
import type { EvaluationDetail, EvaluationRow, EvaluationsReport } from './types';

const STATUS_TONE: Record<string, 'neutral' | 'blue' | 'green'> = { borrador: 'neutral', publicada: 'blue', cerrada: 'green' };

export function EvaluationTable({ rows, onOpen }: { rows: EvaluationRow[]; onOpen?: (id: number) => void }) {
  return (
    <DataTable rows={rows} rowKey={e => e.id} onRowClick={onOpen ? e => onOpen(e.id) : undefined} caption="Evaluaciones"
      empty={<EmptyState icon={ClipboardList} title="No hay evaluaciones en el período con los filtros seleccionados" />}
      columns={[
        { key: 't', header: 'Evaluación', render: e => <><span className="font-medium">{e.title}</span><span className="block text-[11px] text-[#9B9A97]">{e.competency_name}</span></>, sortValue: e => e.title },
        { key: 'g', header: 'Grupo', render: e => e.group.name, sortValue: e => e.group.name },
        { key: 'p', header: 'Profesor', render: e => e.teacher.name, sortValue: e => e.teacher.name },
        { key: 'f', header: 'Fechas', render: e => (
          <span className="text-xs leading-relaxed block whitespace-nowrap">
            Creada {fmtDate(e.created_at)}{e.published_at && <><br />Publicada {fmtDate(e.published_at)}</>}
            {e.deadline && <><br />Límite {e.deadline}</>}{e.closed_at && <><br />Cerrada {fmtDate(e.closed_at)}</>}
          </span>), sortValue: e => e.published_at ?? e.created_at },
        { key: 'a', header: 'Asignados', align: 'right', render: e => e.assigned, sortValue: e => e.assigned },
        { key: 'i', header: 'Iniciaron', align: 'right', render: e => e.started, sortValue: e => e.started },
        { key: 'c', header: 'Completaron', align: 'right', render: e => e.completed, sortValue: e => e.completed },
        { key: 'r', header: 'Finalización', align: 'right', render: e => fmtPct(e.completion_rate), sortValue: e => e.completion_rate },
        { key: 'm', header: 'Promedio', align: 'right', render: e => <>{fmtPct(e.average)}{e.pending_review > 0 && <span className="block text-[11px] text-[#9B9A97]">{e.pending_review} por calificar</span>}</>, sortValue: e => e.average },
        { key: 's', header: 'Estado', render: e => <Pill tone={STATUS_TONE[e.status] ?? 'neutral'}>{e.status_label}</Pill>, sortValue: e => e.status },
      ]} />
  );
}

export default function EvaluacionesSection({ params }: { params: Record<string, unknown> }) {
  const [page, setPage] = useKeyedPage(JSON.stringify(params));
  const [open, setOpen] = useState<number | null>(null);
  const { data, loading, error } = useReport<EvaluationsReport>('/super/reports/evaluations', { ...params, page, size: 15 });
  const ind = data?.indicators;

  return (
    <Panel
      title="Evaluaciones y actividades académicas"
      description="Evaluaciones docentes activas durante el período, con su estado real (borrador, publicada, cerrada) y la participación de los estudiantes."
      actions={<ExportButtons section="evaluaciones" params={params} disabled={!data?.total} />}
    >
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && ind && (
        <div className="space-y-5">
          <KeyValue items={[
            { label: 'Evaluaciones', value: ind.evaluations },
            { label: 'Tasa de finalización', value: fmtPct(ind.completion_rate) },
            { label: 'Tasa de abandono', value: fmtPct(ind.abandonment_rate) },
            { label: 'Promedio de resultados', value: fmtPct(ind.average) },
            { label: 'Asignaciones', value: `${ind.completed} / ${ind.assigned}` },
          ]} />
          <details className="text-xs text-[#787774] bg-[#FAFAF9] border border-[#E9E9E7] rounded-lg px-3 py-2">
            <summary className="cursor-pointer font-semibold text-[#37352F]">¿Cómo se calculan estos indicadores?</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><b>Finalización:</b> {ind.definitions.completion_rate}</li>
              <li><b>Abandono:</b> {ind.definitions.abandonment_rate}</li>
              <li><b>Promedio:</b> {ind.definitions.average}</li>
              <li>{ind.definitions.counts}</li>
            </ul>
          </details>
          {ind.evaluations > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="border border-[#E9E9E7] rounded-xl p-4">
                <SubTitle>Distribución de resultados oficiales</SubTitle>
                <DistributionBar bands={ind.distribution} />
              </section>
              <section className="border border-[#E9E9E7] rounded-xl p-4">
                <SubTitle>Finalización por grupo</SubTitle>
                <ul className="space-y-1.5">
                  {ind.by_group.map(g => (
                    <li key={g.id} className="text-xs">
                      <div className="flex justify-between gap-2"><span className="truncate text-[#37352F]">{g.name}</span>
                        <span className="tabular-nums font-semibold">{fmtPct(g.completion_rate)}</span></div>
                      <div className="h-1.5 rounded bg-[#F1F1EF] mt-1">
                        <div className="h-full rounded bg-[#0B6E99]" style={{ width: `${g.completion_rate ?? 0}%` }} />
                      </div>
                      <span className="text-[10.5px] text-[#9B9A97]">{g.completed} de {g.assigned} asignaciones · {g.evaluations} evaluación(es)</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="border border-[#E9E9E7] rounded-xl p-4">
                <SubTitle>Resultados oficiales calificados en el tiempo</SubTitle>
                <ColumnChart data={ind.completed_over_time.map(d => ({ label: d.bucket, value: d.results }))} />
              </section>
            </div>
          )}
          <div>
            <EvaluationTable rows={data.items} onOpen={setOpen} />
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </div>
        </div>
      )}
      <EvaluationDrawer id={open} params={params} onClose={() => setOpen(null)} />
    </Panel>
  );
}

function EvaluationDrawer({ id, params, onClose }: { id: number | null; params: Record<string, unknown>; onClose: () => void }) {
  const p = { ...params };
  delete p.classroom_id; delete p.teacher_id; delete p.student_id; delete p.competency; delete p.eval_status;
  const { data, loading, error } = useReport<EvaluationDetail>(id ? `/super/reports/evaluations/${id}` : null, p);
  const e = data?.evaluation;
  return (
    <Drawer open={id !== null} onClose={onClose} title={e?.title ?? 'Evaluación'}
      subtitle={e ? `${e.group.name} · ${e.teacher.name} · ${e.competency_name} · ${e.status_label}` : undefined}>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && e && (
        <>
          <KeyValue items={[
            { label: 'Asignados', value: e.assigned },
            { label: 'Iniciaron', value: e.started },
            { label: 'Completaron', value: e.completed },
            { label: 'Finalización', value: fmtPct(e.completion_rate) },
            { label: 'Promedio', value: fmtPct(e.average) },
          ]} />
          {e.pending_review > 0 && <Notice tone="warn">{e.pending_review} entrega(s) esperan que el docente califique preguntas abiertas: no cuentan en el promedio.</Notice>}
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Resultados por estudiante</SubTitle>
            <DataTable rows={data.students} rowKey={s => s.id}
              columns={[
                { key: 'n', header: 'Estudiante', render: s => s.name, sortValue: s => s.name },
                { key: 's', header: 'Estado', render: s => <Pill tone={s.status === 'Calificada' ? 'green' : s.status === 'Sin iniciar' ? 'neutral' : 'amber'}>{s.status}</Pill>, sortValue: s => s.status },
                { key: 'i', header: 'Intentos', align: 'right', render: s => s.attempts, sortValue: s => s.attempts },
                { key: 'p', header: 'Resultado oficial', align: 'right', render: s => fmtPct(s.pct), sortValue: s => s.pct },
                { key: 'd', header: 'Entregada', render: s => fmtDate(s.submitted_at, true), sortValue: s => s.submitted_at },
              ]} />
          </section>
        </>
      )}
    </Drawer>
  );
}
