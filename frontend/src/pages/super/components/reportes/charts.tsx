import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BAND_COLORS, fmtPct } from './lib';

// Gráficas propias (sin dependencias): escala común 0-100 % de aciertos,
// marcas delgadas, rejilla tenue, tooltip al pasar el cursor y etiquetas
// visibles para no depender solo del color.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

// ── Barras horizontales ─────────────────────────────────────────────────────
export interface HBarRow {
  key: string | number;
  label: string;
  value: number | null;
  sub?: string;
  color?: string;
  tooltip?: ReactNode;
}

export function HBarChart({ rows, reference, referenceLabel, onSelect, selected, valueSuffix = ' %' }: {
  rows: HBarRow[]; reference?: number; referenceLabel?: string;
  onSelect?: (row: HBarRow) => void; selected?: string | number | null; valueSuffix?: string;
}) {
  const [hover, setHover] = useState<string | number | null>(null);
  return (
    <div className="space-y-1" role="list">
      <div className="grid grid-cols-[minmax(110px,32%)_1fr_auto] gap-3 items-end text-[10.5px] text-[#9B9A97] pb-1">
        <span />
        <div className="relative h-4">
          {[0, 25, 50, 75, 100].map(t => (
            <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${t}%` }}>{t}</span>
          ))}
        </div>
        <span className="w-[72px]" />
      </div>
      {rows.map(r => {
        const active = hover === r.key || selected === r.key;
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag key={r.key} role="listitem"
            onClick={onSelect ? () => onSelect(r) : undefined}
            onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(r.key)} onBlur={() => setHover(null)}
            className={`relative w-full grid grid-cols-[minmax(110px,32%)_1fr_auto] gap-3 items-center text-left rounded-lg px-1 py-1.5
              ${onSelect ? 'hover:bg-[#F4FAFD] focus:bg-[#F4FAFD] outline-none cursor-pointer' : ''} ${selected === r.key ? 'bg-[#F4FAFD]' : ''}`}>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13px] text-[#37352F] font-medium leading-tight">
                {r.color && <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: r.color }} aria-hidden />}
                <span className="truncate">{r.label}</span>
              </span>
              {r.sub && <span className="block text-[11px] text-[#9B9A97] truncate mt-0.5">{r.sub}</span>}
            </span>
            <span className="relative h-3 rounded bg-[#F1F1EF]">
              {[25, 50, 75].map(t => (
                <span key={t} className="absolute top-0 bottom-0 w-px bg-white" style={{ left: `${t}%` }} aria-hidden />
              ))}
              {r.value !== null && (
                <span className="absolute left-0 top-0 bottom-0 rounded-r"
                  style={{ width: `${Math.max(0.8, Math.min(100, r.value))}%`, background: r.color ?? '#0B6E99',
                           opacity: hover !== null && !active ? 0.55 : 1 }} />
              )}
              {reference !== undefined && (
                <span className="absolute -top-1 -bottom-1 border-l-2 border-dashed border-[#787774]" style={{ left: `${reference}%` }} aria-hidden />
              )}
            </span>
            <span className={`w-[72px] text-right text-[13px] tabular-nums ${r.value === null ? 'text-[#9B9A97]' : 'font-semibold text-[#191919]'}`}>
              {r.value === null ? 'Sin datos' : `${r.value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${valueSuffix}`}
            </span>
            {hover === r.key && r.tooltip && (
              <span className="absolute z-20 left-[32%] top-full mt-1 bg-[#191919] text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap">
                {r.tooltip}
              </span>
            )}
          </Tag>
        );
      })}
      {reference !== undefined && (
        <p className="text-[11px] text-[#787774] pt-1 flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed border-[#787774]" aria-hidden />
          {referenceLabel ?? `Referencia ${reference} %`}
        </p>
      )}
    </div>
  );
}

// ── Líneas ──────────────────────────────────────────────────────────────────
export interface LinePoint { x: number; y: number | null; detail?: ReactNode }
export interface LineSeries { key: string; name: string; color: string; points: LinePoint[]; dashed?: boolean }

export function LineChart({ series, xTicks, height = 260, xLabel, connectGaps = false, formatX }: {
  series: LineSeries[]; xTicks: { x: number; label: string }[]; height?: number; xLabel?: string;
  connectGaps?: boolean; formatX?: (x: number) => string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const pad = { l: 34, r: 14, t: 12, b: 30 };
  const allX = useMemo(() => Array.from(new Set(series.flatMap(s => s.points.filter(p => p.y !== null).map(p => p.x))))
    .sort((a, b) => a - b), [series]);
  const domain = useMemo(() => {
    const xs = [...xTicks.map(t => t.x), ...allX];
    if (!xs.length) return [0, 1];
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
  }, [xTicks, allX]);
  const w = Math.max(width, 280);
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const sx = (x: number) => pad.l + ((x - domain[0]) / (domain[1] - domain[0])) * iw;
  const sy = (y: number) => pad.t + (1 - y / 100) * ih;

  const paths = series.map(s => {
    const segs: string[] = [];
    let cur = '';
    s.points.forEach(p => {
      if (p.y === null) { if (!connectGaps && cur) { segs.push(cur); cur = ''; } return; }
      cur += `${cur ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
    });
    if (cur) segs.push(cur);
    return { s, d: segs.join(' ') };
  });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!allX.length) return;
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left + pad.l;
    let best = allX[0];
    allX.forEach(x => { if (Math.abs(sx(x) - px) < Math.abs(sx(best) - px)) best = x; });
    setHoverX(best);
  };

  const hoverItems = hoverX === null ? [] : series
    .map(s => ({ s, p: s.points.find(p => p.x === hoverX && p.y !== null) }))
    .filter(i => i.p);
  const tickEvery = Math.max(1, Math.ceil(xTicks.length / Math.max(2, Math.floor(iw / 70))));

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={w} height={height} role="img" aria-label="Gráfica de evolución" className="block">
        {[0, 25, 50, 75, 100].map(t => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} stroke="#EFEFED" strokeWidth={1} />
            <text x={pad.l - 6} y={sy(t) + 3.5} textAnchor="end" fontSize={10} fill="#9B9A97">{t}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (i % tickEvery === 0 || i === xTicks.length - 1) && (
          <text key={`${t.x}-${i}`} x={sx(t.x)} y={height - 10} textAnchor="middle" fontSize={10} fill="#9B9A97">{t.label}</text>
        ))}
        {hoverX !== null && <line x1={sx(hoverX)} x2={sx(hoverX)} y1={pad.t} y2={pad.t + ih} stroke="#C8C7C5" strokeWidth={1} />}
        {paths.map(({ s, d }) => (
          <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.dashed ? '5 4' : undefined} />
        ))}
        {series.map(s => s.points.filter(p => p.y !== null).map(p => (
          <circle key={`${s.key}-${p.x}`} cx={sx(p.x)} cy={sy(p.y!)} r={hoverX === p.x ? 5 : 4}
            fill={s.color} stroke="#fff" strokeWidth={2} />
        )))}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent"
          onMouseMove={onMove} onMouseLeave={() => setHoverX(null)} />
      </svg>
      {xLabel && <p className="text-[10.5px] text-[#9B9A97] text-center -mt-1">{xLabel}</p>}
      {hoverX !== null && hoverItems.length > 0 && (
        <div className="absolute z-20 pointer-events-none bg-[#191919] text-white text-[11px] rounded-lg px-2.5 py-2 shadow-lg max-w-[260px]"
          style={{ left: Math.min(Math.max(sx(hoverX) + 10, 0), w - 240), top: 8 }}>
          <p className="font-semibold mb-1">{formatX ? formatX(hoverX) : xTicks.find(t => t.x === hoverX)?.label}</p>
          {hoverItems.map(({ s, p }) => (
            <div key={s.key} className="flex items-start gap-1.5 py-0.5">
              <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: s.color }} />
              <div>
                <span className="opacity-80">{s.name}: </span><b>{fmtPct(p!.y)}</b>
                {p!.detail && <div className="opacity-70">{p!.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items, onToggle, hidden }: {
  items: { key: string; name: string; color: string }[]; onToggle?: (key: string) => void; hidden?: Set<string>;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map(i => {
        const off = hidden?.has(i.key);
        const Tag = onToggle ? 'button' : 'span';
        return (
          <Tag key={i.key} onClick={onToggle ? () => onToggle(i.key) : undefined} aria-pressed={onToggle ? !off : undefined}
            className={`inline-flex items-center gap-1.5 text-[11.5px] ${off ? 'text-[#B5B4B1] line-through' : 'text-[#37352F]'} ${onToggle ? 'hover:underline' : ''}`}>
            <span className="w-3 h-[3px] rounded-full" style={{ background: off ? '#D3D2CF' : i.color }} aria-hidden />
            {i.name}
          </Tag>
        );
      })}
    </div>
  );
}

// ── Distribución por niveles (barra apilada) ────────────────────────────────

export function DistributionBar({ bands }: { bands: { key: string; label: string; count: number; min?: number; max?: number }[] }) {
  const total = bands.reduce((a, b) => a + b.count, 0);
  const [hover, setHover] = useState<string | null>(null);
  if (!total) return <p className="text-xs text-[#9B9A97]">Sin estudiantes con resultados.</p>;
  return (
    <div>
      <div className="flex h-5 w-full gap-[2px] rounded overflow-hidden">
        {bands.filter(b => b.count > 0).map(b => (
          <div key={b.key} className="relative h-full" style={{ width: `${(b.count / total) * 100}%`, background: BAND_COLORS[b.key] ?? '#9B9A97' }}
            onMouseEnter={() => setHover(b.key)} onMouseLeave={() => setHover(null)} title={`${b.label}: ${b.count}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
        {bands.map(b => (
          <div key={b.key} className={`text-xs rounded-md px-2 py-1 ${hover === b.key ? 'bg-[#F4FAFD]' : ''}`}>
            <span className="inline-flex items-center gap-1.5 font-medium text-[#37352F]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: BAND_COLORS[b.key] }} aria-hidden />{b.label}
            </span>
            <span className="block text-[#787774] tabular-nums">
              {b.count} ({total ? Math.round((b.count / total) * 1000) / 10 : 0} %)
              {b.min !== undefined && b.max !== undefined && <span className="text-[#9B9A97]"> · {b.min}–{b.max >= 100 ? 100 : b.max} %</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Columnas (conteos en el tiempo) ─────────────────────────────────────────
export function ColumnChart({ data, height = 140, unit = '' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="text-xs text-[#9B9A97]">Sin datos en el período.</p>;
  const every = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div>
      <div className="relative flex items-end gap-[2px] border-b border-[#E9E9E7]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="relative flex-1 h-full flex items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="w-full rounded-t" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0,
              background: hover === i ? '#095E85' : '#0B6E99' }} />
            {hover === i && (
              <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#191919] text-white text-[11px] rounded px-2 py-1 whitespace-nowrap z-10">
                {d.label}: {d.value}{unit}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-[10px] text-[#9B9A97] text-center truncate">{i % every === 0 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  );
}
