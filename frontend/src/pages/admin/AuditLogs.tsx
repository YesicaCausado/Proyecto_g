/**
 * NeuroLearn AI — Admin: Logs de Auditoría
 * Tabla paginada de todos los eventos del sistema, filtrable por acción,
 * institución y rango de fecha.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  ClipboardList, Calendar, AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';

interface LogEntry {
  id: number;
  action: string;
  performed_by: string;
  performed_by_id: number | null;
  target_user: string;
  target_user_id: number | null;
  institution_name: string;
  institution_id: number | null;
  user_type: string;
  ip_address: string;
  notes: string;
  created_at: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  create:   'bg-[#EEF7F4] text-[#0F7B6C]',
  delete:   'bg-[#FDECEA] text-[#D44C47]',
  login:    'bg-[#E5F3FF] text-[#0B6E99]',
  logout:   'bg-[#F7F6F3] text-[#787774]',
  update:   'bg-[#FEF9ED] text-[#D9730D]',
  reset:    'bg-[#F4EFFB] text-[#6940A5]',
  block:    'bg-[#FDECEA] text-[#D44C47]',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-[#F7F6F3] text-[#37352F]';
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page: p, page_size: PAGE_SIZE };
      if (actionFilter) params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/admin/audit-logs', { params });
      setLogs(res.data.logs ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setError('No se pudieron cargar los logs de auditoría.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">

      {/* ── Encabezado ─────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#191919] flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#0B6E99]" />
            Logs de Auditoría
          </h1>
          <p className="text-sm text-[#787774] mt-1">
            Registro de todas las acciones del sistema ({total} eventos)
          </p>
        </div>
        <button
          onClick={() => fetchLogs(page)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] text-[#37352F]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* ── Filtros ────────────────────────────── */}
      <div className="bg-white rounded-md border border-[#E9E9E7] p-4 mb-5 flex flex-wrap gap-3 items-end shadow-sm">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[#787774] mb-1">Acción</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
            <input
              type="text"
              placeholder="Ej: create_teacher"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#787774] mb-1">
            <Calendar className="inline w-3 h-3 mr-1" />Desde
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-[#E9E9E7] rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#787774] mb-1">
            <Calendar className="inline w-3 h-3 mr-1" />Hasta
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-[#E9E9E7] rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
          />
        </div>
        <button
          onClick={handleSearch}
          className="bg-[#0B6E99] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#095a7e] flex items-center gap-2"
        >
          <Search className="w-4 h-4" />Filtrar
        </button>
        <button
          onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1); fetchLogs(1); }}
          className="text-sm text-[#787774] hover:text-[#37352F] px-3 py-2 border border-[#E9E9E7] rounded-md"
        >
          Limpiar
        </button>
      </div>

      {/* ── Error ──────────────────────────────── */}
      {error && (
        <div className="bg-[#FDECEA] border border-[#D44C47]/30 text-[#D44C47] rounded-md p-3 mb-4 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Tabla ──────────────────────────────── */}
      <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9B9A97] gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#9B9A97]">
            <ClipboardList className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">No hay logs que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F] whitespace-nowrap">Fecha y hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F] whitespace-nowrap">Acción</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F] whitespace-nowrap">Realizado por</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F] whitespace-nowrap">Usuario afectado</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F] whitespace-nowrap">Institución</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F] whitespace-nowrap">IP</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F3F1]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-[#787774] whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#37352F] whitespace-nowrap">
                      {log.performed_by !== '—' ? (
                        <span className="font-medium">{log.performed_by}</span>
                      ) : <span className="text-[#9B9A97]">Sistema</span>}
                    </td>
                    <td className="px-4 py-3 text-[#787774] whitespace-nowrap">
                      {log.target_user !== '—' ? log.target_user : <span className="text-[#9B9A97]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#787774] whitespace-nowrap">
                      {log.institution_name !== '—' ? log.institution_name : <span className="text-[#9B9A97]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#9B9A97] text-xs whitespace-nowrap">
                      {log.ip_address !== '—' ? log.ip_address : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#787774] max-w-[220px] truncate" title={log.notes}>
                      {log.notes || <span className="text-[#9B9A97]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginación ─────────────────────────── */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm text-[#787774]">
          <span>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} logs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded border border-[#E9E9E7] hover:bg-[#F7F6F3] disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-[#F7F6F3] rounded border border-[#E9E9E7]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded border border-[#E9E9E7] hover:bg-[#F7F6F3] disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
