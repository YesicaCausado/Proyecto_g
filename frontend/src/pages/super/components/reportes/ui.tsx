import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown,
  Download, FileSpreadsheet, FileText, Info, Loader2, Minus, X, type LucideIcon,
} from 'lucide-react';
import { downloadExport, fmtPP } from './lib';

// ── Contenedores ────────────────────────────────────────────────────────────
export function Panel({
  title, description, actions, children, id,
}: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="bg-white border border-[#E9E9E7] rounded-xl shadow-sm">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-[#F1F1EF]">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#191919] text-[15px]">{title}</h3>
          {description && <p className="text-xs text-[#787774] mt-0.5 leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-[#787774] mb-2">{children}</h4>;
}

// ── Estados ─────────────────────────────────────────────────────────────────
export function EmptyState({ title, text, icon: Icon = Info }: { title: string; text?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <span className="w-10 h-10 rounded-full bg-[#F7F6F3] flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#9B9A97]" />
      </span>
      <p className="text-sm font-semibold text-[#37352F]">{title}</p>
      {text && <p className="text-xs text-[#787774] mt-1 max-w-md">{text}</p>}
    </div>
  );
}

export function Loading({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#787774]" role="status">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-4" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700">No se pudieron cargar los datos</p>
          <p className="text-xs text-red-600 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry}
          className="text-xs font-semibold text-red-700 border border-red-300 bg-white hover:bg-red-50 rounded-lg px-3 py-1.5 flex-shrink-0">
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const cls = tone === 'warn'
    ? 'bg-[#FBF3DB] border-[#F1E2B3] text-[#7A5B00]'
    : 'bg-[#F1F7FB] border-[#D6E8F3] text-[#0B4F6E]';
  const Icon = tone === 'warn' ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-xs leading-relaxed ${cls}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

// ── Indicadores ─────────────────────────────────────────────────────────────
/**
 * Variación con significado según la métrica: `goodWhenUp=false` para métricas
 * donde subir es negativo (p. ej. estudiantes con dificultades).
 */
export function Delta({ value, goodWhenUp = true, unit = 'pp', label }: {
  value: number | null | undefined; goodWhenUp?: boolean; unit?: 'pp' | '%'; label?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] text-[#9B9A97]">{label ?? 'Sin período comparable'}</span>;
  }
  const up = value > 0;
  const flat = value === 0;
  const good = flat ? null : (up === goodWhenUp);
  const cls = good === null ? 'text-[#787774] bg-[#F7F6F3]' : good ? 'text-[#0F7B6C] bg-[#EEF8F6]' : 'text-[#C4302B] bg-[#FDEEEE]';
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const txt = unit === 'pp' ? fmtPP(value) : `${up ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      <Icon className="w-3 h-3" aria-hidden />
      {txt}
      <span className="sr-only">{good === null ? 'sin cambio' : good ? '(favorable)' : '(desfavorable)'}</span>
    </span>
  );
}

export function StatCard({ title, value, unit, context, footer, icon: Icon, onClick, muted }: {
  title: string; value: ReactNode; unit?: string; context?: ReactNode; footer?: ReactNode;
  icon: LucideIcon; onClick?: () => void; muted?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick}
      className={`bg-white border border-[#E9E9E7] rounded-xl p-4 flex flex-col gap-2 text-left shadow-sm min-w-0
        ${onClick ? 'hover:border-[#B9D7E8] hover:shadow-md transition-all cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#787774] font-semibold uppercase tracking-wide leading-tight">{title}</p>
        <span className="p-1.5 rounded-lg bg-[#E7F1FB] flex-shrink-0"><Icon className="w-3.5 h-3.5 text-[#0B6E99]" /></span>
      </div>
      <p className={`font-bold tracking-tight leading-tight ${muted ? 'text-base text-[#9B9A97]' : 'text-[26px] text-[#191919]'}`}>
        {value}{unit && !muted && <span className="text-sm font-semibold text-[#787774] ml-1">{unit}</span>}
      </p>
      {context && <div className="text-xs text-[#787774] leading-relaxed">{context}</div>}
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </Tag>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'red' | 'green' | 'amber' }) {
  const cls = {
    neutral: 'bg-[#F7F6F3] text-[#5F5E5B] border-[#E9E9E7]',
    blue: 'bg-[#E7F1FB] text-[#0B6E99] border-[#CFE3F2]',
    red: 'bg-[#FDEEEE] text-[#C4302B] border-[#F6D5D3]',
    green: 'bg-[#EEF8F6] text-[#0F7B6C] border-[#CDEAE4]',
    amber: 'bg-[#FBF3DB] text-[#7A5B00] border-[#F1E2B3]',
  }[tone];
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{children}</span>;
}

// ── Exportar ────────────────────────────────────────────────────────────────
export function ExportButtons({ section, params, disabled }: {
  section: string; params: Record<string, unknown>; disabled?: boolean;
}) {
  const [busy, setBusy] = useState<'' | 'pdf' | 'csv'>('');
  const [error, setError] = useState('');
  const run = async (format: 'pdf' | 'csv') => {
    setBusy(format);
    setError('');
    try { await downloadExport(section, format, params); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {(['pdf', 'csv'] as const).map(f => (
          <button key={f} onClick={() => run(f)} disabled={!!busy || disabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#E9E9E7] bg-white text-[#37352F] hover:bg-[#F7F6F3] disabled:opacity-50"
            title={f === 'pdf' ? 'Exportar PDF' : 'Exportar CSV (Excel)'}>
            {busy === f ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : f === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            {f === 'pdf' ? 'PDF' : 'Excel/CSV'}
          </button>
        ))}
      </div>
      {error && <p className="text-[11px] text-red-600 max-w-xs text-right" role="alert">{error}</p>}
    </div>
  );
}

export function ExportMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#0B6E99] text-white hover:bg-[#095E85] shadow-sm">
      <Download className="w-3.5 h-3.5" /> Exportar
    </button>
  );
}

// ── Tabla ordenable ─────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string | null;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, initialSort, empty, caption }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void; initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode; caption?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const val = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      // Los valores ausentes siempre al final (no son ceros).
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(String(vb), 'es') : (va as number) - (vb as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  if (!rows.length) return <>{empty ?? <EmptyState title="Sin datos para los filtros seleccionados" />}</>;

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 border-y sm:border border-[#E9E9E7] sm:rounded-lg">
      <table className="w-full text-sm min-w-[640px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-[#FAFAF9] text-[11px] uppercase tracking-wide text-[#787774]">
          <tr>
            {columns.map(c => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} scope="col"
                  className={`px-3 py-2 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortValue ? (
                    <button className="inline-flex items-center gap-1 hover:text-[#37352F]"
                      onClick={() => setSort(active && sort!.dir === 'desc' ? { key: c.key, dir: 'asc' } : { key: c.key, dir: 'desc' })}>
                      {c.header}
                      {active ? (sort!.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F1EF]">
          {sorted.map(row => (
            <tr key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? e => { if (e.key === 'Enter') onRowClick(row); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-[#F4FAFD] focus:bg-[#F4FAFD] outline-none' : ''}>
              {columns.map(c => (
                <td key={c.key}
                  className={`px-3 py-2.5 text-[#37352F] ${c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''} ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return <p className="text-xs text-[#9B9A97] mt-2">{total} resultado(s)</p>;
  return (
    <div className="flex items-center justify-between mt-3 text-xs text-[#787774]">
      <span>{total} resultado(s) · página {page} de {pages}</span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior"
          className="p-1.5 rounded border border-[#E9E9E7] bg-white disabled:opacity-40 hover:bg-[#F7F6F3]"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Página siguiente"
          className="p-1.5 rounded border border-[#E9E9E7] bg-white disabled:opacity-40 hover:bg-[#F7F6F3]"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

// ── Panel lateral de detalle ────────────────────────────────────────────────
export function Drawer({ open, title, subtitle, onClose, children, actions }: {
  open: boolean; title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:w-[min(920px,92vw)] h-full bg-[#FBFBFA] shadow-2xl flex flex-col">
        <header className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 bg-white border-b border-[#E9E9E7]">
          <div className="min-w-0">
            <h3 className="font-semibold text-[#191919] text-base truncate">{title}</h3>
            {subtitle && <div className="text-xs text-[#787774] mt-0.5">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-[#F7F6F3] text-[#787774]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(i => (
        <div key={i.label} className="bg-white border border-[#E9E9E7] rounded-lg px-3 py-2.5 min-w-0">
          <dt className="text-[10.5px] uppercase tracking-wide text-[#787774] font-semibold">{i.label}</dt>
          <dd className="text-base font-bold text-[#191919] mt-0.5 truncate">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ViewToggle({ value, onChange }: { value: 'chart' | 'table'; onChange: (v: 'chart' | 'table') => void }) {
  return (
    <div className="inline-flex gap-0.5 bg-[#F7F6F3] p-0.5 rounded-lg border border-[#E9E9E7]" role="group" aria-label="Vista">
      {(['chart', 'table'] as const).map(v => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md ${value === v ? 'bg-white shadow-sm text-[#191919]' : 'text-[#787774]'}`}>
          {v === 'chart' ? 'Gráfica' : 'Tabla'}
        </button>
      ))}
    </div>
  );
}
