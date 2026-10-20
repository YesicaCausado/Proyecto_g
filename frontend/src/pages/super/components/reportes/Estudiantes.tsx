import { useEffect, useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { HBarChart, Legend, LineChart, type LineSeries } from './charts';
import { DataTable, Delta, EmptyState, ErrorBox, ExportButtons, KeyValue, Loading, Notice, Pagination, Panel, Pill, SubTitle } from './ui';
import { COMP_COLORS, fmtDate, fmtDuration, fmtNum, fmtPct, useKeyedPage, useReport } from './lib';
import type { CompKey, Page, StudentDetail, StudentListRow } from './types';

const STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'neutral' | 'blue' }> = {
  avance: { label: 'Muestra avance', tone: 'green' },
  refuerzo: { label: 'Podría requerir refuerzo', tone: 'amber' },
  estable: { label: 'Estable', tone: 'blue' },
  insuficiente: { label: 'Un solo resultado', tone: 'neutral' },
  sin_datos: { label: 'Sin datos', tone: 'neutral' },
};

export default function EstudiantesSection({ params, selectedId, onSelect }: {
  params: Record<string, unknown>; selectedId: string; onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  const listParams = { ...params };
  delete listParams.student_id;
  const [page, setPage] = useKeyedPage(JSON.stringify(listParams) + debounced);
  const { data: list, loading, error } = useReport<Page<StudentListRow>>(
    '/super/reports/students', { ...listParams, q: debounced, page, size: 12 });

  return (
    <Panel
      title="Reporte individual del estudiante"
      description="Busca un estudiante para ver su ficha académica, la evolución de sus resultados y su historial de evaluaciones."
      actions={selectedId ? <ExportButtons section="estudiante" params={{ ...params, student_id: selectedId }} /> : undefined}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9B9A97]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o usuario"
              aria-label="Buscar estudiante"
              className="w-full pl-8 pr-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:ring-1 focus:ring-[#0B6E99] outline-none" />
          </div>
          {loading && !list && <Loading />}
          {error && <ErrorBox message={error} />}
          {list && (
            <>
              <ul className="border border-[#E9E9E7] rounded-lg divide-y divide-[#F1F1EF] max-h-[520px] overflow-y-auto">
                {list.items.length === 0 && <li className="p-4 text-xs text-[#9B9A97] text-center">Sin estudiantes que coincidan</li>}
                {list.items.map(s => (
                  <li key={s.id}>
                    <button onClick={() => onSelect(String(s.id))}
                      className={`w-full text-left px-3 py-2 hover:bg-[#F4FAFD] ${selectedId === String(s.id) ? 'bg-[#E7F1FB]' : ''}`}>
                      <span className="flex justify-between gap-2">
                        <span className="text-sm font-medium text-[#37352F] truncate">{s.name}</span>
                        <span className={`text-xs tabular-nums ${s.average === null ? 'text-[#9B9A97]' : 'font-semibold text-[#191919]'}`}>{fmtPct(s.average)}</span>
                      </span>
                      <span className="block text-[11px] text-[#9B9A97] truncate">
                        @{s.username} · {s.groups.join(', ') || 'Sin grupo'} · {s.results} resultado(s)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={list.page} pages={list.pages} total={list.total} onChange={setPage} />
            </>
          )}
        </div>
        <div className="min-w-0">
          {selectedId ? <StudentCard key={selectedId} id={selectedId} params={params} />
            : <EmptyState icon={UserRound} title="Selecciona un estudiante" text="La ficha usa el período, la competencia y la fuente elegidos en los filtros." />}
        </div>
      </div>
    </Panel>
  );
}

function StudentCard({ id, params }: { id: string; params: Record<string, unknown> }) {
  const p = { ...params };
  delete p.student_id;
  const { data, loading, error } = useReport<StudentDetail>(`/super/reports/students/${id}`, p);
  const [comp, setComp] = useState<'todas' | CompKey>('todas');

  const series: LineSeries[] = useMemo(() => {
    if (!data) return [];
    const keys = Array.from(new Set(data.points.map(pt => pt.competency).filter(Boolean))) as CompKey[];
    return keys.filter(k => comp === 'todas' || k === comp).map(k => ({
      key: k, name: data.competencies.find(c => c.key === k)?.name ?? k, color: COMP_COLORS[k],
      points: data.points.filter(pt => pt.competency === k).map(pt => ({
        x: new Date(pt.date).getTime(), y: pt.pct,
        detail: `${pt.title} · ${pt.source === 'quiz' ? 'Quiz adaptativo' : 'Evaluación docente'}`,
      })),
    }));
  }, [data, comp]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const s = data.summary;
  const xs = series.flatMap(se => se.points.map(pt => pt.x)).sort((a, b) => a - b);
  const ticks = xs.length ? [xs[0], ...(xs.length > 2 ? [xs[Math.floor(xs.length / 2)]] : []), xs[xs.length - 1]] : [];
  const nPoints = series.reduce((a, se) => a + se.points.length, 0);
  const unclassified = data.points.filter(pt => !pt.competency).length;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-bold text-[#191919]">{data.student.name}</h4>
        <p className="text-xs text-[#787774]">@{data.student.username} · {data.student.groups.join(', ') || 'Sin grupo'}
          {data.student.grade && ` · grado ${data.student.grade}`} · {data.meta.period.label}</p>
      </div>
      <KeyValue items={[
        { label: 'Evaluaciones', value: s.results },
        { label: 'Promedio', value: fmtPct(s.average) },
        { label: 'Última evaluación', value: fmtDate(s.last_result) },
        { label: 'Competencias', value: s.competencies_evaluated.length },
        { label: 'Seguimiento', value: data.followup.length ? <Pill tone="amber">{data.followup.length} regla(s)</Pill> : 'No' },
      ]} />
      {s.results === 0 ? (
        <EmptyState title="Sin resultados en el período" text="No tener evaluaciones en el período no indica bajo rendimiento." />
      ) : (
        <>
          <section className="border border-[#E9E9E7] rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <SubTitle>Evolución del rendimiento</SubTitle>
              <select value={comp} onChange={e => setComp(e.target.value as 'todas' | CompKey)} aria-label="Competencia de la gráfica"
                className="px-2 py-1 border border-[#E9E9E7] rounded-lg text-xs bg-white">
                <option value="todas">Todas las competencias (una línea por competencia)</option>
                {data.competencies.filter(c => c.results).map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </div>
            {nPoints === 0 ? <p className="text-xs text-[#9B9A97]">Sin resultados clasificados en esta competencia.</p> : (
              <>
                <Legend items={series.map(se => ({ key: se.key, name: se.name, color: se.color }))} />
                <LineChart series={series} xTicks={ticks.map(x => ({ x, label: fmtDate(new Date(x).toISOString()) }))}
                  formatX={x => fmtDate(new Date(x).toISOString(), true)} height={240} />
                <p className="text-[11px] text-[#9B9A97]">
                  Cada punto es una evaluación real con su fecha y hora; si hay varias el mismo día se muestran por separado.
                  Las líneas no unen competencias distintas.{nPoints === 1 && ' Solo hay un resultado: aún no hay datos para analizar una tendencia.'}
                  {unclassified > 0 && ` ${unclassified} resultado(s) sin competencia identificada aparecen solo en el historial.`}
                </p>
              </>
            )}
          </section>
          <section className="border border-[#E9E9E7] rounded-xl p-4">
            <SubTitle>Por competencia</SubTitle>
            <HBarChart rows={data.competencies.map(c => ({
              key: c.key, label: c.name, value: c.average, color: COMP_COLORS[c.key],
              sub: c.results ? `${c.results} resultado(s) · ${STATUS[c.status].label}${c.change !== null ? ` · ${c.change > 0 ? '+' : ''}${fmtNum(c.change)} pp del primero al último` : ''}` : 'Sin datos',
            }))} />
            <p className="text-[11px] text-[#9B9A97] mt-2">
              «Muestra avance»: el último resultado supera al primero en 5 pp o más. «Podría requerir refuerzo»: promedio bajo el umbral o caída de 5 pp o más.
            </p>
          </section>
          {data.followup.length > 0 && (
            <Notice tone="warn">
              Cumple criterios de seguimiento: {data.followup.map(f => `${f.rule_label} (${f.competency_name})`).join(' · ')}.
            </Notice>
          )}
          <section>
            <SubTitle>Historial de evaluaciones</SubTitle>
            <DataTable rows={data.history} rowKey={h => `${h.source}-${h.date}-${h.title}`}
              columns={[
                { key: 'd', header: 'Fecha y hora', render: h => fmtDate(h.date, true), sortValue: h => h.date },
                { key: 'c', header: 'Competencia', render: h => h.competency_name, sortValue: h => h.competency_name },
                { key: 't', header: 'Actividad', render: h => <>{h.title}<span className="block text-[11px] text-[#9B9A97]">{h.source_label}{h.attempts > 1 ? ` · ${h.attempts} intentos (mejor)` : ''}</span></> },
                { key: 'r', header: 'Resultado', align: 'right', render: h => fmtPct(h.pct), sortValue: h => h.pct },
                { key: 'p', header: 'Puntaje / máx.', align: 'right', render: h => h.score !== null && h.max_score !== null ? `${fmtNum(h.score)} / ${fmtNum(h.max_score)}` : 'No registrado' },
                { key: 'm', header: 'Tiempo', align: 'right', render: h => fmtDuration(h.seconds), sortValue: h => h.seconds },
                { key: 's', header: 'Estado', render: h => h.status },
                { key: 'e', header: 'vs. anterior comparable', align: 'right', render: h => <Delta value={h.change_vs_previous} label="Primera" />, sortValue: h => h.change_vs_previous },
              ]} />
            <p className="text-[11px] text-[#9B9A97] mt-2">Comparable = misma competencia y mismo tipo de instrumento (quiz o evaluación).</p>
          </section>
        </>
      )}
    </div>
  );
}
