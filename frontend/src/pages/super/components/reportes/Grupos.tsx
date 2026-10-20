import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { DistributionBar, HBarChart } from './charts';
import { DataTable, Delta, Drawer, EmptyState, ErrorBox, ExportButtons, KeyValue, Loading, Notice, Panel, Pill, SubTitle, ViewToggle } from './ui';
import { EvolutionView } from './Evolucion';
import { BRAND, COMP_COLORS, fmtDate, fmtPct, useReport } from './lib';
import type { GroupDetail, GroupRow, Overview } from './types';

type SortKey = 'average' | 'participation' | 'evaluated';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'average', label: 'Promedio' },
  { key: 'participation', label: 'Participación' },
  { key: 'evaluated', label: 'Estudiantes evaluados' },
];

export default function GruposSection({ data, params }: { data: Overview; params: Record<string, unknown> }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [sortKey, setSortKey] = useState<SortKey>('average');
  const [open, setOpen] = useState<number | null>(null);
  const groups = data.groups;
  const sorted = useMemo(() => [...groups].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    if (va === null) return 1;
    if (vb === null) return -1;
    return (vb as number) - (va as number);
  }), [groups, sortKey]);
  const bar = sortKey === 'average';

  return (
    <Panel
      title="Comparativo por grupos"
      description="Resultados de las evaluaciones publicadas en cada grupo más los quizzes adaptativos de sus estudiantes. Un grupo con más evaluaciones no tiene por eso mejor rendimiento: cada estudiante pesa lo mismo."
      actions={<>
        <label className="text-xs text-[#787774] flex items-center gap-1.5">Ordenar por
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
            className="px-2 py-1 border border-[#E9E9E7] rounded-lg text-xs bg-white">
            {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <ViewToggle value={view} onChange={setView} />
        <ExportButtons section="grupos" params={params} disabled={!groups.length} />
      </>}
    >
      {!groups.length ? (
        <EmptyState icon={Users} title="No hay grupos activos en el alcance seleccionado" />
      ) : view === 'chart' ? (
        <HBarChart
          valueSuffix={sortKey === 'evaluated' ? '' : ' %'}
          onSelect={r => setOpen(Number(r.key))}
          rows={sorted.map(g => ({
            key: g.id, label: g.name, color: BRAND,
            value: bar ? g.average : sortKey === 'participation' ? g.participation
              : g.enrolled ? (g.evaluated / g.enrolled) * 100 : null,
            sub: `${g.teacher?.name ?? 'Sin profesor'} · ${g.evaluated}/${g.enrolled} evaluados${g.small_sample ? ' · muestra pequeña' : ''}`,
            tooltip: <>Promedio {fmtPct(g.average)} · participación {fmtPct(g.participation)}
              {g.best_competency && <> · mejor: {g.best_competency.name}</>}</>,
          }))}
        />
      ) : (
        <GroupTable rows={sorted} onOpen={setOpen} />
      )}
      {view === 'chart' && sortKey === 'evaluated' && (
        <p className="text-[11px] text-[#9B9A97] mt-2">Barra = estudiantes evaluados como % de los inscritos del grupo.</p>
      )}
      <GroupDrawer id={open} params={params} onClose={() => setOpen(null)} />
    </Panel>
  );
}

export function GroupTable({ rows, onOpen }: { rows: GroupRow[]; onOpen?: (id: number) => void }) {
  return (
    <DataTable rows={rows} rowKey={g => g.id} onRowClick={onOpen ? g => onOpen(g.id) : undefined} caption="Grupos"
      columns={[
        { key: 'n', header: 'Grupo', render: g => <><span className="font-medium">{g.name}</span>{g.small_sample && g.evaluated > 0 && <span className="ml-1.5"><Pill>muestra pequeña</Pill></span>}</>, sortValue: g => g.name },
        { key: 't', header: 'Profesor', render: g => g.teacher?.name ?? '—', sortValue: g => g.teacher?.name ?? '' },
        { key: 'i', header: 'Inscritos', align: 'right', render: g => g.enrolled, sortValue: g => g.enrolled },
        { key: 'e', header: 'Evaluados', align: 'right', render: g => g.evaluated, sortValue: g => g.evaluated },
        { key: 'p', header: 'Participación', align: 'right', render: g => fmtPct(g.participation), sortValue: g => g.participation },
        { key: 'a', header: 'Promedio', align: 'right', render: g => fmtPct(g.average), sortValue: g => g.average },
        { key: 'b', header: 'Mejor competencia', render: g => g.best_competency ? `${g.best_competency.name} (${fmtPct(g.best_competency.average)})` : '—' },
        { key: 'w', header: 'Menor competencia', render: g => g.worst_competency ? `${g.worst_competency.name} (${fmtPct(g.worst_competency.average)})` : '—' },
        { key: 'd', header: 'Cambio', align: 'right', render: g => <Delta value={g.change} label="—" />, sortValue: g => g.change },
      ]} />
  );
}

function GroupDrawer({ id, params, onClose }: { id: number | null; params: Record<string, unknown>; onClose: () => void }) {
  const p = { ...params };
  delete p.classroom_id; delete p.teacher_id; delete p.student_id;
  const { data, loading, error } = useReport<GroupDetail>(id ? `/super/reports/groups/${id}` : null, p);
  const g = data?.group;
  return (
    <Drawer open={id !== null} onClose={onClose} title={g?.name ?? 'Grupo'}
      subtitle={g ? `${g.teacher?.name ?? 'Sin profesor'} · ${g.subject || 'Sin materia'}${g.grade ? ` · grado ${g.grade}` : ''} · ${data!.meta.period.label}` : undefined}
      actions={id ? <ExportButtons section="grupos" params={{ ...p, classroom_id: id }} /> : undefined}>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && g && (
        <>
          <KeyValue items={[
            { label: 'Estudiantes', value: data.summary.enrolled },
            { label: 'Evaluados', value: data.summary.evaluated },
            { label: 'Promedio', value: fmtPct(data.summary.average) },
            { label: 'Eval. calificadas', value: data.summary.completed_evaluations },
            { label: 'Cambio vs. anterior', value: <Delta value={data.summary.change} label="—" /> },
          ]} />
          {g.small_sample && <Notice tone="warn">Menos de {data.meta.min_students_comparison} estudiantes evaluados: interpreta los promedios con cautela.</Notice>}
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Desempeño por competencia</SubTitle>
            <HBarChart reference={data.meta.reference_threshold}
              rows={data.competencies.map(c => ({ key: c.key, label: c.name, value: c.average, color: COMP_COLORS[c.key],
                sub: c.results ? `${c.students} estudiante(s) · ${c.results} resultado(s)` : 'Sin resultados' }))} />
          </section>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Distribución del rendimiento (promedio por estudiante)</SubTitle>
            <DistributionBar bands={data.distribution.map(b => ({ ...b, count: b.students }))} />
            <p className="text-[11px] text-[#9B9A97] mt-2">
              Niveles de la escala del Decreto 1290 (Bajo, Básico, Alto, Superior) con los cortes habituales 3,0 · 4,0 · 4,6 en escala 1-5, convertidos a porcentaje.
            </p>
          </section>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Evolución temporal</SubTitle>
            <EvolutionView evo={data.evolution} />
          </section>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Estudiantes</SubTitle>
            <DataTable rows={data.students} rowKey={s => s.id}
              columns={[
                { key: 'n', header: 'Estudiante', render: s => <><span className="font-medium">{s.name}</span><span className="block text-[11px] text-[#9B9A97]">@{s.username}</span></>, sortValue: s => s.name },
                { key: 'a', header: 'Promedio', align: 'right', render: s => fmtPct(s.average), sortValue: s => s.average },
                { key: 'r', header: 'Resultados', align: 'right', render: s => s.results, sortValue: s => s.results },
                { key: 'c', header: 'Competencias evaluadas', render: s => s.competencies.join(', ') || '—' },
                { key: 'l', header: 'Última evaluación', render: s => fmtDate(s.last_result), sortValue: s => s.last_result },
                { key: 'e', header: 'Evolución', align: 'right', render: s => <Delta value={s.change} label="—" />, sortValue: s => s.change },
                { key: 'f', header: 'Seguimiento', render: s => s.followup
                    ? <Pill tone="amber">{s.followup_rules.join(' · ')}</Pill> : <span className="text-[#9B9A97] text-xs">No</span>,
                  sortValue: s => (s.followup ? 1 : 0) },
              ]} />
            <p className="text-[11px] text-[#9B9A97] mt-2">Evolución = último resultado − primer resultado del período.</p>
          </section>
        </>
      )}
    </Drawer>
  );
}
