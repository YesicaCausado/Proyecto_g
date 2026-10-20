import { useState } from 'react';
import { LifeBuoy, ShieldAlert } from 'lucide-react';
import { LineChart } from './charts';
import { DataTable, Drawer, EmptyState, ErrorBox, ExportButtons, Loading, Notice, Pagination, Panel, Pill, SubTitle } from './ui';
import { COMP_COLORS, fmtDate, fmtPct, useKeyedPage, useReport } from './lib';
import type { FollowupCase, FollowupReport, Filters } from './types';

export default function SeguimientoSection({ params, filters, onCriteria }: {
  params: Record<string, unknown>; filters: Filters; onCriteria: (patch: Partial<Filters>) => void;
}) {
  const [rule, setRule] = useState('');
  const [page, setPage] = useKeyedPage(JSON.stringify(params) + rule);
  const [open, setOpen] = useState<FollowupCase | null>(null);
  const { data, loading, error } = useReport<FollowupReport>('/super/reports/followup', { ...params, rule, page, size: 15 });

  return (
    <Panel
      title="Seguimiento académico"
      description="Estudiantes que podrían necesitar apoyo pedagógico según reglas académicas verificables. Son observaciones para revisar, no diagnósticos."
      actions={<ExportButtons section="seguimiento" params={params} disabled={!data?.total && !rule} />}
    >
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <div className="border border-[#E9E9E7] rounded-xl p-4 bg-[#FCFCFB]">
              <SubTitle>Reglas aplicadas</SubTitle>
              <ul className="space-y-2">
                {data.rules.map(r => (
                  <li key={r.key} className="text-xs text-[#37352F] leading-relaxed">
                    <span className="font-semibold">{r.label}</span>{' '}
                    <Pill tone={r.category === 'rendimiento' ? 'amber' : 'neutral'}>{r.category === 'rendimiento' ? 'Rendimiento' : 'Actividad'}</Pill>
                    <span className="block text-[#787774]">{r.definition} Observación: {r.observation}. Mínimo de datos: {r.min_data}.</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-[#E9E9E7] rounded-xl p-4">
              <SubTitle>Criterios configurables</SubTitle>
              <label className="block text-xs text-[#37352F] mb-3">
                Umbral de bajo desempeño: <b>{filters.threshold} %</b>
                <input type="range" min={30} max={80} step={5} value={filters.threshold} className="w-full accent-[#0B6E99] mt-1"
                  onChange={e => onCriteria({ threshold: Number(e.target.value) })} aria-label="Umbral de bajo desempeño" />
              </label>
              <label className="block text-xs text-[#37352F]">
                Resultados comparables mínimos (N)
                <select value={filters.min_results} onChange={e => onCriteria({ min_results: Number(e.target.value) })}
                  className="mt-1 w-full px-2 py-1.5 border border-[#E9E9E7] rounded-lg text-sm bg-white">
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <p className="text-[11px] text-[#9B9A97] mt-2">Por defecto: 60 % (límite Bajo/Básico) y 3 resultados. Ningún estudiante se marca por una sola respuesta.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por regla">
            <button onClick={() => setRule('')} aria-pressed={!rule}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${!rule ? 'bg-[#0B6E99] text-white border-[#0B6E99]' : 'bg-white text-[#37352F] border-[#E9E9E7]'}`}>
              Todas ({Object.values(data.totals).reduce((a, b) => a + b, 0)})
            </button>
            {data.rules.map(r => (
              <button key={r.key} onClick={() => setRule(r.key)} aria-pressed={rule === r.key}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${rule === r.key ? 'bg-[#0B6E99] text-white border-[#0B6E99]' : 'bg-white text-[#37352F] border-[#E9E9E7]'}`}>
                {r.label} ({data.totals[r.key] ?? 0})
              </button>
            ))}
          </div>

          <DataTable rows={data.items} rowKey={c => c.id} onRowClick={setOpen} caption="Casos de seguimiento"
            empty={<EmptyState icon={LifeBuoy} title="Ningún estudiante cumple los criterios con los filtros actuales" />}
            columns={[
              { key: 'n', header: 'Estudiante', render: c => <><span className="font-medium">{c.student.name}</span><span className="block text-[11px] text-[#9B9A97]">@{c.student.username}</span></>, sortValue: c => c.student.name },
              { key: 'g', header: 'Grupo', render: c => c.groups.join(', ') || 'Sin grupo' },
              { key: 'c', header: 'Competencia', render: c => c.competency_name, sortValue: c => c.competency_name },
              { key: 'm', header: 'Motivo', render: c => <Pill tone={c.category === 'rendimiento' ? 'amber' : 'neutral'}>{c.rule_label}</Pill>, sortValue: c => c.rule_label },
              { key: 'e', header: 'Evidencia académica', render: c => <span className="text-xs">{c.reason}</span> },
              { key: 'd', header: 'Detección', render: c => fmtDate(c.detected_at), sortValue: c => c.detected_at },
              { key: 'v', header: 'Evolución', align: 'right', render: c => c.evolution ? `${fmtPct(c.evolution.first, 0)} → ${fmtPct(c.evolution.last, 0)}` : '—' },
            ]} />
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          <p className="text-[11px] text-[#9B9A97]">El sistema no tiene todavía un flujo para gestionar el estado de cada caso (abierto, en seguimiento, cerrado), por eso esa columna no se muestra.</p>
          <Notice><ShieldAlert className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />{data.neurodigital_note}</Notice>
        </div>
      )}
      <CaseDrawer c={open} onClose={() => setOpen(null)} />
    </Panel>
  );
}

function CaseDrawer({ c, onClose }: { c: FollowupCase | null; onClose: () => void }) {
  const evid = c?.evidence ?? [];
  const scored = evid.filter(e => e.pct !== null && e.date);
  return (
    <Drawer open={!!c} onClose={onClose} title={c ? `${c.student.name} · ${c.rule_label}` : ''}
      subtitle={c ? `${c.groups.join(', ') || 'Sin grupo'} · ${c.competency_name}` : undefined}>
      {c && (
        <>
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4 space-y-1">
            <SubTitle>Qué regla activó el seguimiento</SubTitle>
            <p className="text-sm text-[#37352F]">{c.reason}</p>
            <p className="text-xs text-[#787774]">Fecha de detección: {fmtDate(c.detected_at)}</p>
          </section>
          {scored.length > 0 && (
            <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
              <SubTitle>Evolución de los resultados</SubTitle>
              <LineChart height={200}
                series={[{ key: 'r', name: c.competency_name, color: c.competency ? COMP_COLORS[c.competency] : '#37352F',
                  points: scored.map(e => ({ x: new Date(e.date!).getTime(), y: e.pct, detail: `${e.title} · ${e.source_label}` })) }]}
                xTicks={scored.map(e => ({ x: new Date(e.date!).getTime(), label: fmtDate(e.date).replace(/ de /g, ' ') }))}
                formatX={x => fmtDate(new Date(x).toISOString(), true)} />
            </section>
          )}
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Resultados que sustentan la observación</SubTitle>
            {evid.length === 0 ? <p className="text-xs text-[#787774]">Esta regla se basa en la ausencia de resultados en el período.</p> : (
              <DataTable rows={evid.map((e, i) => ({ ...e, i, used: c.considered.some(k => k.date === e.date && k.title === e.title) }))}
                rowKey={e => e.i}
                columns={[
                  { key: 'd', header: 'Fecha', render: e => fmtDate(e.date, true) },
                  { key: 't', header: 'Actividad', render: e => e.title },
                  { key: 's', header: 'Fuente', render: e => e.source_label },
                  { key: 'p', header: 'Resultado', align: 'right', render: e => fmtPct(e.pct) },
                  { key: 'u', header: 'Considerado por la regla', render: e => e.used ? <Pill tone="blue">Sí</Pill> : <span className="text-xs text-[#9B9A97]">—</span> },
                ]} />
            )}
          </section>
          {c.missing.length > 0 && (
            <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
              <SubTitle>Información que falta para una conclusión más sólida</SubTitle>
              <ul className="list-disc pl-5 text-xs text-[#37352F] space-y-1">{c.missing.map(m => <li key={m}>{m}</li>)}</ul>
            </section>
          )}
          <section className="bg-white border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Recomendaciones pedagógicas generales</SubTitle>
            <ul className="list-disc pl-5 text-xs text-[#37352F] space-y-1">{c.recommendations.map(r => <li key={r}>{r}</li>)}</ul>
            <p className="text-[11px] text-[#9B9A97] mt-2">Orientaciones generales según la competencia; no reemplazan el criterio del docente.</p>
          </section>
        </>
      )}
    </Drawer>
  );
}
