import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { LineChart, Legend, type LineSeries } from './charts';
import { DataTable, Delta, EmptyState, ExportButtons, Notice, Panel, ViewToggle } from './ui';
import { COMP_COLORS, fmtPct } from './lib';
import type { Evolution, Overview } from './types';

const GRAN_LABEL = { day: 'por día', week: 'por semana (lunes a domingo)', month: 'por mes' } as const;

/** Gráfica de líneas por competencia + tabla; reutilizable en los detalles. */
export function EvolutionView({ evo, defaultHidden = [] }: { evo: Evolution; defaultHidden?: string[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hidden, setHidden] = useState<Set<string>>(new Set(defaultHidden));
  const idx = useMemo(() => new Map(evo.buckets.map((b, i) => [b.key, i])), [evo]);

  const series: LineSeries[] = evo.series.filter(s => !hidden.has(s.key)).map(s => ({
    key: s.key, name: s.name, color: COMP_COLORS[s.key], dashed: s.key === 'general',
    points: s.points.map(p => ({
      x: idx.get(p.bucket)!, y: p.average,
      detail: p.average !== null ? `${p.students} estudiante(s) · ${p.results} resultado(s)` : undefined,
    })),
  }));
  const points = evo.series.flatMap(s => s.points).filter(p => p.average !== null);
  const bucketsWithData = new Set(points.map(p => p.bucket)).size;

  if (!evo.series.length) {
    return <EmptyState icon={TrendingUp} title="Sin resultados en el período" text="No hay datos para construir una evolución con los filtros actuales." />;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend items={evo.series.map(s => ({ key: s.key, name: s.name, color: COMP_COLORS[s.key] }))}
          hidden={hidden} onToggle={k => setHidden(prev => {
            const n = new Set(prev);
            if (n.has(k)) n.delete(k); else n.add(k);
            return n;
          })} />
        <ViewToggle value={view} onChange={setView} />
      </div>
      {bucketsWithData < 2 && (
        <Notice tone="warn">Solo hay datos en un intervalo: todavía no es posible analizar una tendencia.</Notice>
      )}
      {view === 'chart' ? (
        <>
          <LineChart series={series} xTicks={evo.buckets.map((b, i) => ({ x: i, label: b.label }))}
            xLabel={evo.granularity ? `Promedio (% de aciertos) agrupado ${GRAN_LABEL[evo.granularity]}` : undefined} />
          <p className="text-[11px] text-[#9B9A97]">
            Haz clic en la leyenda para mostrar u ocultar líneas. Los intervalos sin resultados quedan en blanco (no se interpolan).
          </p>
        </>
      ) : (
        <DataTable
          rows={evo.table} rowKey={r => `${r.bucket}-${r.competency}`}
          columns={[
            { key: 'p', header: 'Período', render: r => r.period, sortValue: r => r.bucket },
            { key: 'c', header: 'Competencia', render: r => r.competency_name, sortValue: r => r.competency_name },
            { key: 'a', header: 'Promedio', align: 'right', render: r => fmtPct(r.average), sortValue: r => r.average },
            { key: 's', header: 'Estudiantes', align: 'right', render: r => r.students, sortValue: r => r.students },
            { key: 'n', header: 'Evaluaciones', align: 'right', render: r => r.results, sortValue: r => r.results },
            { key: 'd', header: 'Cambio vs. intervalo anterior', align: 'right', render: r => <Delta value={r.change} label="—" />, sortValue: r => r.change },
          ]}
        />
      )}
    </div>
  );
}

export default function EvolucionSection({ data, params }: { data: Overview; params: Record<string, unknown> }) {
  const comps = data.competencies;
  return (
    <Panel
      title="Evolución institucional"
      description="¿Está mejorando el rendimiento académico? Promedio por competencia en el tiempo, en la misma escala (% de aciertos)."
      actions={<ExportButtons section="evolucion" params={params} />}
    >
      <div className="space-y-4">
        <EvolutionView evo={data.evolution} />
        {data.meta.previous_period && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#787774] mb-2">
              Comparación con el período anterior ({data.meta.previous_period.start} a {data.meta.previous_period.end})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {comps.map(c => (
                <div key={c.key} className="border border-[#E9E9E7] rounded-lg p-3 bg-white">
                  <p className="text-xs font-medium text-[#37352F] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COMP_COLORS[c.key] }} aria-hidden />{c.name}
                  </p>
                  <p className="text-sm mt-1 tabular-nums"><span className="text-[#9B9A97]">{fmtPct(c.previous_average)}</span> → <b>{fmtPct(c.average)}</b></p>
                  <div className="mt-1"><Delta value={c.change} label="Sin datos comparables" /></div>
                </div>
              ))}
            </div>
          </div>
        )}
        <Notice>
          Los períodos se comparan con la misma duración. Si cambia la población evaluada (otros estudiantes o grupos)
          o el tipo de instrumento (quiz o evaluación), la diferencia puede deberse a ese cambio y no a una mejora real:
          revisa la columna de estudiantes y usa el filtro de fuente.
        </Notice>
      </div>
    </Panel>
  );
}
