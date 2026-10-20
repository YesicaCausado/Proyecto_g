import { useState } from 'react';
import { CheckCircle2, CircleDashed, HelpCircle, TrendingDown, TrendingUp, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { HBarChart, DistributionBar } from './charts';
import { DataTable, Delta, Drawer, EmptyState, ErrorBox, ExportButtons, KeyValue, Loading, Notice, Panel, Pill, SubTitle, ViewToggle } from './ui';
import { EvolutionView } from './Evolucion';
import { COMP_COLORS, fmtDate, fmtPct, useReport } from './lib';
import type { CompKey, CompetencyDetail, Overview } from './types';

const INTERP = {
  alta: { icon: ArrowUpCircle, label: 'Relativamente alta', tone: 'green' },
  baja: { icon: ArrowDownCircle, label: 'Relativamente baja', tone: 'amber' },
  mejora: { icon: TrendingUp, label: 'Evolución positiva', tone: 'green' },
  descenso: { icon: TrendingDown, label: 'Descenso', tone: 'red' },
  insuficiente: { icon: HelpCircle, label: 'Faltan evaluaciones', tone: 'neutral' },
  sin_datos: { icon: CircleDashed, label: 'Sin datos', tone: 'neutral' },
} as const;

export default function CompetenciasSection({ data, params }: { data: Overview; params: Record<string, unknown> }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [open, setOpen] = useState<CompKey | null>(null);
  const comps = data.competencies;
  const threshold = data.meta.reference_threshold;

  return (
    <Panel
      title="Rendimiento por competencia"
      description={<>Promedio de cada competencia en <b>% de aciertos (0-100)</b>. Quizzes y evaluaciones ya usan esa escala, así que no hay conversión. Selecciona una competencia para ver su detalle.</>}
      actions={<><ViewToggle value={view} onChange={setView} /><ExportButtons section="competencias" params={params} /></>}
    >
      <div className="space-y-5">
        {view === 'chart' ? (
          <HBarChart
            reference={threshold} referenceLabel={`Umbral de referencia: ${threshold} % (límite entre desempeño Bajo y Básico)`}
            onSelect={r => setOpen(r.key as CompKey)} selected={open}
            rows={comps.map(c => ({
              key: c.key, label: c.name, value: c.average, color: COMP_COLORS[c.key],
              sub: c.results ? `${c.students} estudiante(s) · ${c.results} resultado(s)${!c.sufficient ? ' · muestra pequeña' : ''}` : 'Sin resultados en el período',
              tooltip: c.results ? <>Período anterior: {fmtPct(c.previous_average)} · cambio {c.change === null ? '—' : `${c.change > 0 ? '+' : ''}${c.change} pp`}</> : undefined,
            }))}
          />
        ) : (
          <DataTable
            rows={comps} rowKey={c => c.key} onRowClick={c => setOpen(c.key)} caption="Comparación de competencias"
            columns={[
              { key: 'n', header: 'Competencia', render: c => (
                <span className="flex items-center gap-2 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COMP_COLORS[c.key] }} aria-hidden />{c.name}
                  {!c.sufficient && c.results > 0 && <Pill>muestra pequeña</Pill>}
                </span>), sortValue: c => c.name },
              { key: 'a', header: 'Promedio', align: 'right', render: c => fmtPct(c.average), sortValue: c => c.average },
              { key: 's', header: 'Estudiantes evaluados', align: 'right', render: c => c.students, sortValue: c => c.students },
              { key: 'r', header: 'Evaluaciones', align: 'right', render: c => c.results, sortValue: c => c.results },
              { key: 'd', header: 'Cambio frente al período anterior', align: 'right', render: c => <Delta value={c.change} label="—" />, sortValue: c => c.change },
            ]}
          />
        )}

        <div>
          <SubTitle>Interpretación de resultados</SubTitle>
          {data.interpretation.length === 0 ? (
            <p className="text-xs text-[#787774]">Las competencias con datos suficientes tienen resultados similares entre sí (diferencias menores a 5 pp).</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.interpretation.map((i, n) => {
                const meta = INTERP[i.type as keyof typeof INTERP] ?? INTERP.insuficiente;
                const Icon = meta.icon;
                return (
                  <li key={n} className="flex items-start gap-2 border border-[#E9E9E7] rounded-lg px-3 py-2 bg-[#FCFCFB]">
                    <Icon className="w-4 h-4 mt-0.5 text-[#787774] flex-shrink-0" aria-hidden />
                    <div className="text-xs text-[#37352F] leading-relaxed">
                      <Pill tone={meta.tone}>{meta.label}</Pill> <span className="ml-1">{i.text}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[11px] text-[#9B9A97] mt-2 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            Reglas: «relativamente alta/baja» = 5 pp o más sobre/bajo la media de las competencias con al menos {data.meta.min_students_comparison} estudiantes;
            «evolución» = variación de 3 pp o más frente al período anterior. No se infieren causas ni diagnósticos.
          </p>
        </div>
      </div>
      <CompetencyDrawer compKey={open} params={params} onClose={() => setOpen(null)} />
    </Panel>
  );
}

function CompetencyDrawer({ compKey, params, onClose }: { compKey: CompKey | null; params: Record<string, unknown>; onClose: () => void }) {
  const p = { ...params };
  delete p.competency;
  const { data, loading, error } = useReport<CompetencyDetail>(compKey ? `/super/reports/competencies/${compKey}` : null, p);
  const c = data?.competency;
  return (
    <Drawer open={!!compKey} onClose={onClose} title={c?.name ?? 'Competencia'}
      subtitle={data ? `${data.meta.period.label} · ${data.meta.institution.name}` : undefined}
      actions={compKey ? <ExportButtons section="competencias" params={{ ...p, competency: compKey }} /> : undefined}>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && c && (
        <>
          <KeyValue items={[
            { label: 'Promedio', value: fmtPct(c.average) },
            { label: 'Estudiantes', value: c.students },
            { label: 'Resultados', value: c.results },
            { label: 'Período anterior', value: fmtPct(c.previous_average) },
            { label: 'Cambio', value: <Delta value={c.change} label="—" /> },
          ]} />
          {!c.sufficient && c.results > 0 && <Notice tone="warn">Muestra pequeña: menos de {data.meta.min_students_comparison} estudiantes evaluados.</Notice>}
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Distribución por nivel de desempeño</SubTitle>
            <DistributionBar bands={data.distribution.map(b => ({ ...b, count: b.students }))} />
          </section>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Evolución</SubTitle>
            <EvolutionView evo={data.evolution} />
          </section>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Grupos con resultados en esta competencia</SubTitle>
            <DataTable rows={data.groups} rowKey={g => g.id}
              columns={[
                { key: 'n', header: 'Grupo', render: g => g.name, sortValue: g => g.name },
                { key: 't', header: 'Profesor', render: g => g.teacher?.name ?? '—' },
                { key: 'e', header: 'Evaluados', align: 'right', render: g => `${g.evaluated} / ${g.enrolled}`, sortValue: g => g.evaluated },
                { key: 'a', header: 'Promedio', align: 'right', render: g => fmtPct(g.average), sortValue: g => g.average },
              ]} />
          </section>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Resultados individuales</SubTitle>
            <DataTable rows={data.students} rowKey={s => s.id} initialSort={{ key: 'a', dir: 'asc' }}
              empty={<EmptyState title="Sin estudiantes evaluados en esta competencia" />}
              columns={[
                { key: 'n', header: 'Estudiante', render: s => <><span className="font-medium">{s.name}</span><span className="block text-[11px] text-[#9B9A97]">@{s.username}</span></>, sortValue: s => s.name },
                { key: 'g', header: 'Grupo(s)', render: s => s.groups.join(', ') || 'Sin grupo' },
                { key: 'a', header: 'Promedio', align: 'right', render: s => fmtPct(s.average), sortValue: s => s.average },
                { key: 'r', header: 'Resultados', align: 'right', render: s => s.results, sortValue: s => s.results },
                { key: 'l', header: 'Último', render: s => fmtDate(s.last_result), sortValue: s => s.last_result },
              ]} />
          </section>
        </>
      )}
    </Drawer>
  );
}
