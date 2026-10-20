import { useState, useEffect, useCallback } from 'react';
import { Shield, Search, Download, Filter, RefreshCw, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import api from '../../../services/api';

// GET /super/audit (backend/app/api/super_stats.py). Los filtros se aplican
// en el servidor sobre todos los registros de la institución; antes se
// filtraban en el navegador solo los 50 más recientes.

type Category = 'create' | 'update' | 'delete' | 'login' | 'security' | 'broadcast' | 'other';

interface AuditLog {
  id: number;
  user: string;
  role: string;
  category: Category;
  action: string;
  description: string;
  date: string;
  time: string;
  ip: string;
}

const CATEGORY_CONFIG: Record<Category, { label: string; color: string; bg: string }> = {
  create:    { label: 'Creación',       color: 'text-[#0B6E99]', bg: 'bg-blue-50 border-blue-200' },
  update:    { label: 'Actualización',  color: 'text-[#D9730D]', bg: 'bg-orange-50 border-orange-200' },
  delete:    { label: 'Desactivación',  color: 'text-[#E03E3E]', bg: 'bg-red-50 border-red-200' },
  login:     { label: 'Inicio sesión',  color: 'text-[#0F7B6C]', bg: 'bg-emerald-50 border-emerald-200' },
  security:  { label: 'Seguridad',      color: 'text-[#6940A5]', bg: 'bg-purple-50 border-purple-200' },
  broadcast: { label: 'Comunicado',     color: 'text-[#2E6FDB]', bg: 'bg-blue-50 border-blue-200' },
  other:     { label: 'Otra',           color: 'text-[#787774]', bg: 'bg-[#F7F6F3] border-[#E9E9E7]' },
};

const ROLE_LABEL: Record<string, string> = {
  super_profesor: 'Súper Profesor', profesor: 'Profesor', estudiante: 'Estudiante', admin: 'Administrador',
};

const PAGE = 100;

function toLog(l: any): AuditLog {
  return {
    id:          l.id,
    user:        l.performed_by ?? '—',
    role:        ROLE_LABEL[l.performed_by_role] ?? l.performed_by_role ?? '—',
    category:    (l.category in CATEGORY_CONFIG ? l.category : 'other') as Category,
    action:      l.action ?? '',
    description: l.description ?? l.action ?? '—',
    date:        (l.created_at ?? '').slice(0, 10),
    time:        (l.created_at ?? '').slice(11, 19) || '—',
    ip:          l.ip_address ?? '—',
  };
}

const csvCell = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function downloadCSV(logs: AuditLog[]) {
  const headers = ['ID', 'Usuario', 'Rol', 'Categoría', 'Acción', 'Descripción', 'Fecha', 'Hora (UTC)', 'IP'];
  const rows = logs.map(l => [l.id, l.user, l.role, CATEGORY_CONFIG[l.category].label, l.action, l.description, l.date, l.time, l.ip]
    .map(csvCell).join(','));
  const blob = new Blob(['﻿' + [headers.map(csvCell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AuditoriaTab() {
  const [search,       setSearch]       = useState('');
  const [debounced,    setDebounced]    = useState('');
  const [category,     setCategory]     = useState<Category | 'todas'>('todas');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [logs,         setLogs]         = useState<AuditLog[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = useCallback((offset: number, limit: number) => ({
    limit, offset,
    ...(category !== 'todas' ? { category } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(debounced ? { q: debounced } : {}),
  }), [category, dateFrom, dateTo, debounced]);

  const load = useCallback(async (append: boolean, offset = 0) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/super/audit', { params: params(offset, PAGE) });
      const page = (data.logs ?? []).map(toLog);
      setLogs(prev => (append ? [...prev, ...page] : page));
      setTotal(data.total ?? page.length);
    } catch (err: any) {
      if (!append) setLogs([]);
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No fue posible cargar los registros de auditoría.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(false); }, [load]);

  // Exporta todos los registros que cumplen el filtro, no solo los cargados.
  const exportAll = async () => {
    setExporting(true);
    setError('');
    try {
      const all: AuditLog[] = [];
      for (let offset = 0; offset < total; offset += 200) {
        const { data } = await api.get('/super/audit', { params: params(offset, 200) });
        all.push(...(data.logs ?? []).map(toLog));
      }
      downloadCSV(all);
    } catch {
      setError('No fue posible exportar los registros.');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => { setSearch(''); setCategory('todas'); setDateFrom(''); setDateTo(''); };

  return (
    <div className="space-y-5">

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[#FDEEEE] border border-[#F5C7C7] text-[#E03E3E] rounded-md px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</span>
          <button onClick={() => load(false)} className="font-medium hover:underline">Reintentar</button>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEADAB]" />
          <input type="text" placeholder="Buscar por usuario o descripción..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white" />
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm transition-colors ${showFilters ? 'bg-[#37352F] text-white border-[#37352F]' : 'bg-white text-[#787774] border-[#E9E9E7] hover:bg-[#F7F6F3]'}`}>
          <Filter className="w-4 h-4" /> Filtros <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={exportAll} disabled={exporting || total === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#0F7B6C] text-white text-sm font-medium rounded-md hover:bg-[#0A6357] transition-colors shadow-sm disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar CSV ({total})
        </button>
      </div>

      {/* Filtros expandibles */}
      {showFilters && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Tipo de acción</label>
            <select value={category} onChange={e => setCategory(e.target.value as Category | 'todas')}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#37352F]">
              <option value="todas">Todas las acciones</option>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#37352F]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#37352F]" />
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              {['Usuario', 'Rol', 'Acción', 'Descripción', 'Fecha', 'Hora (UTC)', 'IP'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {logs.map(log => {
              const cfg = CATEGORY_CONFIG[log.category];
              return (
                <tr key={log.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-[#191919] font-semibold">{log.user}</td>
                  <td className="px-4 py-3 text-xs text-[#787774]">{log.role}</td>
                  <td className="px-4 py-3">
                    <span title={log.action} className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                      {log.action === 'login_failed' ? 'Inicio fallido' : cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#787774] max-w-xs truncate" title={log.description}>{log.description}</td>
                  <td className="px-4 py-3 text-xs text-[#787774] whitespace-nowrap">{log.date}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[#787774] whitespace-nowrap">{log.time}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[#787774]">{log.ip}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-[#787774]">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando registros de auditoría…
          </div>
        )}
        {logs.length === 0 && !loading && (
          <div className="text-center py-12 text-[#787774]"><Shield className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>{error ? 'Sin datos: no se pudo cargar.' : 'No se encontraron registros'}</p></div>
        )}
        <div className="px-4 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3] flex justify-between items-center gap-3">
          <p className="text-xs text-[#787774]">{logs.length} de {total} registros</p>
          <div className="flex items-center gap-3">
            {logs.length < total && !loading && (
              <button onClick={() => load(true, logs.length)} className="text-xs font-medium text-[#37352F] hover:underline">
                Cargar más
              </button>
            )}
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] transition-colors">
              <RefreshCw className="w-3 h-3" /> Limpiar filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
