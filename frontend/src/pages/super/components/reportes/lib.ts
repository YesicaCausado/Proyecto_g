import { useEffect, useState } from 'react';
import api, { invalidateApiCache } from '../../../../services/api';
import type { CompKey, Filters } from './types';

// Colores categóricos de las competencias (orden fijo; validados con la guía
// dataviz: separación para daltonismo y legibilidad). Siempre van acompañados
// de etiqueta o tabla, nunca el color solo.
export const COMP_COLORS: Record<CompKey | 'general', string> = {
  matematicas: '#2a78d6',
  lectora: '#eb6834',
  ingles: '#1baf7a',
  ciudadanas: '#eda100',
  cientifico: '#e87ba4',
  general: '#37352F',
};

export const BRAND = '#0B6E99';

export const COMP_SHORT: Record<CompKey, string> = {
  matematicas: 'Lógico-Matemático',
  lectora: 'Lectura Crítica',
  ingles: 'Inglés',
  ciudadanas: 'Ciudadanas',
  cientifico: 'Científico',
};

// ── Fechas ──────────────────────────────────────────────────────────────────
// El backend interpreta las fechas en hora de Colombia (UTC-5).
export function todayCO(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() - 300) * 60000);
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type PresetKey = '7d' | '30d' | '90d' | 'mes' | 'anio' | 'todo' | 'custom';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: '90d', label: 'Últimos 90 días' },
  { key: 'mes', label: 'Mes actual' },
  { key: 'anio', label: 'Año escolar en curso' },
  { key: 'todo', label: 'Todo el historial' },
  { key: 'custom', label: 'Rango personalizado' },
];

export function presetRange(key: PresetKey): { start: string; end: string } | null {
  const today = todayCO();
  const back = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return isoDay(d);
  };
  switch (key) {
    case '7d': return { start: back(6), end: isoDay(today) };
    case '30d': return { start: back(29), end: isoDay(today) };
    case '90d': return { start: back(89), end: isoDay(today) };
    case 'mes': return { start: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), end: isoDay(today) };
    // No hay períodos académicos configurados en el sistema: se usa el año
    // calendario en curso (calendario A colombiano, enero a diciembre).
    case 'anio': return { start: `${today.getFullYear()}-01-01`, end: isoDay(today) };
    case 'todo': return { start: '', end: '' };
    default: return null;
  }
}

export function defaultFilters(): Filters {
  const r = presetRange('30d')!;
  return {
    start_date: r.start, end_date: r.end, classroom_id: '', teacher_id: '', student_id: '',
    competency: '', source: 'todas', eval_status: '', threshold: 60, min_results: 3,
  };
}

export function toParams(f: Filters, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  (Object.keys(f) as (keyof Filters)[]).forEach(k => {
    const v = f[k];
    if (v === '' || v === null || v === undefined) return;
    if (k === 'source' && v === 'todas') return;
    if (k === 'threshold' && v === 60) return;
    if (k === 'min_results' && v === 3) return;
    p[k] = v;
  });
  Object.entries(extra).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p[k] = v; });
  return p;
}

// ── Formato ─────────────────────────────────────────────────────────────────
export const fmtPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? 'Sin datos' : `${v.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

export const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPP = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'No registrado';
  const m = Math.round(seconds / 60);
  return m < 1 ? '< 1 min' : `${m} min`;
}

export function errorMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d) return JSON.stringify(d);
  return e?.message ?? 'Error desconocido';
}

// ── Carga de datos ──────────────────────────────────────────────────────────
/**
 * GET con estado de carga/error. `data` corresponde siempre a la consulta
 * actual (nunca a una anterior); `stale` conserva el último resultado para
 * atenuarlo mientras llega el nuevo.
 */
export function useReport<T>(path: string | null, params: Record<string, unknown>, reloadKey = 0) {
  const paramsKey = JSON.stringify(params);
  const reqKey = path ? `${path}?${paramsKey}#${reloadKey}` : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string }>(
    { key: null, data: null, error: '' });

  useEffect(() => {
    if (!path || !reqKey) return;
    let cancelled = false;
    api.get<T>(path, { params: JSON.parse(paramsKey) })
      .then(r => { if (!cancelled) setState({ key: reqKey, data: r.data, error: '' }); })
      .catch(err => { if (!cancelled) setState({ key: reqKey, data: null, error: errorMessage(err) }); });
    return () => { cancelled = true; };
  }, [path, paramsKey, reqKey]);

  const current = reqKey !== null && state.key === reqKey;
  return {
    data: current ? state.data : null,
    stale: reqKey !== null ? state.data : null,
    loading: reqKey !== null && !current,
    error: current ? state.error : '',
  };
}

/** Página actual que vuelve a 1 cuando cambia `key` (filtros de la consulta). */
export function useKeyedPage(key: string): [number, (page: number) => void] {
  const [s, setS] = useState({ key, page: 1 });
  return [s.key === key ? s.page : 1, (page: number) => setS({ key, page })];
}

// Niveles de desempeño: escala ordinal de un solo tono (azul claro → oscuro).
export const BAND_COLORS: Record<string, string> = {
  bajo: '#86b6ef', basico: '#3987e5', alto: '#256abf', superior: '#104281',
};

export function refreshReports() {
  invalidateApiCache('/super/reports');
}

/** Descarga un archivo de /super/reports/export con los mismos filtros de la vista. */
export async function downloadExport(section: string, format: 'pdf' | 'csv', params: Record<string, unknown>) {
  try {
    const res = await api.get('/super/reports/export', {
      params: { ...params, section, format, _t: Date.now() },
      responseType: 'blob',
    });
    const cd = String(res.headers['content-disposition'] ?? '');
    const match = /filename\*=UTF-8''([^;]+)/.exec(cd) ?? /filename="([^"]+)"/.exec(cd);
    const name = match ? decodeURIComponent(match[1]) : `reporte_${section}.${format}`;
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    const e = err as { response?: { data?: Blob } };
    if (e?.response?.data instanceof Blob) {
      let detail: unknown = null;
      try { detail = JSON.parse(await e.response.data.text()).detail; } catch { /* respuesta no JSON */ }
      throw new Error(typeof detail === 'string' ? detail : 'No se pudo generar el archivo.');
    }
    throw new Error(errorMessage(err));
  }
}
