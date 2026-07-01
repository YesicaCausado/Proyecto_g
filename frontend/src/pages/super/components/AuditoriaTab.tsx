import { useState } from 'react';
import { Shield, Search, Download, Filter, RefreshCw, ChevronDown } from 'lucide-react';

type ActionType = 'login' | 'logout' | 'create' | 'delete' | 'update' | 'export' | 'upload';

interface AuditLog {
  id: number;
  user: string;
  role: string;
  action: ActionType;
  description: string;
  date: string;
  time: string;
  ip: string;
  browser: string;
}

const ACTION_CONFIG: Record<ActionType, { label: string; color: string; bg: string }> = {
  login:   { label: 'Inicio sesión',   color: 'text-[#0F7B6C]', bg: 'bg-emerald-50 border-emerald-200' },
  logout:  { label: 'Cierre sesión',   color: 'text-[#787774]', bg: 'bg-[#F7F6F3] border-[#E9E9E7]' },
  create:  { label: 'Creación',        color: 'text-[#0B6E99]', bg: 'bg-blue-50 border-blue-200' },
  delete:  { label: 'Eliminación',     color: 'text-[#E03E3E]', bg: 'bg-red-50 border-red-200' },
  update:  { label: 'Actualización',   color: 'text-[#D9730D]', bg: 'bg-orange-50 border-orange-200' },
  export:  { label: 'Exportación',     color: 'text-[#6940A5]', bg: 'bg-purple-50 border-purple-200' },
  upload:  { label: 'Carga archivo',   color: 'text-[#0B6E99]', bg: 'bg-blue-50 border-blue-200' },
};

const MOCK_LOGS: AuditLog[] = [
  { id:  1, user: 'superprofesor', role: 'Rector',   action: 'create',  description: 'Creó credencial para profesor Carlos Martínez (doc: 12345)',       date: '2026-07-01', time: '09:15:32', ip: '192.168.1.10', browser: 'Chrome 126' },
  { id:  2, user: 'superprofesor', role: 'Rector',   action: 'export',  description: 'Exportó reporte institucional — Período 1 2026',                   date: '2026-07-01', time: '09:02:11', ip: '192.168.1.10', browser: 'Chrome 126' },
  { id:  3, user: 'superprofesor', role: 'Rector',   action: 'login',   description: 'Inicio de sesión exitoso desde Windows 11',                        date: '2026-07-01', time: '08:58:01', ip: '192.168.1.10', browser: 'Chrome 126' },
  { id:  4, user: 'carlos.m',     role: 'Profesor',  action: 'create',  description: 'Creó NeuroBots "MateBot 8A" con 3 documentos',                     date: '2026-06-30', time: '15:44:20', ip: '192.168.1.22', browser: 'Firefox 127' },
  { id:  5, user: 'superprofesor', role: 'Rector',   action: 'delete',  description: 'Eliminó grupo "Inglés 6A (Copia)"',                                date: '2026-06-30', time: '11:30:05', ip: '192.168.1.10', browser: 'Chrome 126' },
  { id:  6, user: 'admin',        role: 'Admin',     action: 'update',  description: 'Actualizó límite de licencia de 50 a 60 profesores',                date: '2026-06-29', time: '10:12:44', ip: '10.0.0.1',     browser: 'Edge 125' },
  { id:  7, user: 'laura.g',      role: 'Profesor',  action: 'upload',  description: 'Subió archivo CSV con 28 estudiantes al grupo Ciencias 9B',         date: '2026-06-28', time: '08:25:17', ip: '192.168.1.35', browser: 'Chrome 125' },
  { id:  8, user: 'superprofesor', role: 'Rector',   action: 'create',  description: 'Creó 15 credenciales en lote para estudiantes de grado 8°',         date: '2026-06-27', time: '14:05:33', ip: '192.168.1.10', browser: 'Chrome 126' },
  { id:  9, user: 'carlos.m',     role: 'Profesor',  action: 'logout',  description: 'Cierre de sesión',                                                  date: '2026-06-27', time: '17:00:00', ip: '192.168.1.22', browser: 'Firefox 127' },
  { id: 10, user: 'superprofesor', role: 'Rector',   action: 'update',  description: 'Actualizó datos institucionales: teléfono y dirección',             date: '2026-06-26', time: '09:45:12', ip: '192.168.1.10', browser: 'Chrome 126' },
];

// ── Generador de CSV real ──────────────────────────────────────────────────
function exportLogsAsCSV(logs: AuditLog[]) {
  const headers = 'ID,Usuario,Rol,Acción,Descripción,Fecha,Hora,IP,Navegador';
  const rows = logs.map(l =>
    `${l.id},"${l.user}","${l.role}","${ACTION_CONFIG[l.action].label}","${l.description}","${l.date}","${l.time}","${l.ip}","${l.browser}"`
  ).join('\n');
  const content = `${headers}\n${rows}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `auditoria_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AuditoriaTab() {
  const [search,      setSearch]      = useState('');
  const [filterAction, setFilterAction] = useState<ActionType | 'todas'>('todas');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = MOCK_LOGS.filter(l => {
    const matchSearch  = l.user.includes(search) || l.description.toLowerCase().includes(search.toLowerCase());
    const matchAction  = filterAction === 'todas' || l.action === filterAction;
    const matchDateFrom = !dateFrom || l.date >= dateFrom;
    const matchDateTo   = !dateTo   || l.date <= dateTo;
    return matchSearch && matchAction && matchDateFrom && matchDateTo;
  });

  return (
    <div className="space-y-5">

      {/* Banner DEMO */}
      <div className="bg-[#FCF6E5] border border-[#EDD88A] rounded-md px-4 py-2.5 flex items-center gap-2 text-xs text-[#D9730D] font-medium">
        <span className="bg-[#D9730D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">DEMO</span>
        Los registros mostrados son de demostración. Con el backend activo se registrarán todas las acciones reales del sistema.
      </div>

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
        <button onClick={() => exportLogsAsCSV(filtered)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0F7B6C] text-white text-sm font-medium rounded-md hover:bg-[#0A6357] transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Filtros expandibles */}
      {showFilters && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">Tipo de acción</label>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#37352F]">
              <option value="todas">Todas las acciones</option>
              {Object.entries(ACTION_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
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
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              {['Usuario','Rol','Acción','Descripción','Fecha','Hora','IP','Navegador'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-[#191919] font-semibold">{log.user}</td>
                <td className="px-4 py-3 text-xs text-[#787774]">{log.role}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ACTION_CONFIG[log.action].bg} ${ACTION_CONFIG[log.action].color}`}>
                    {ACTION_CONFIG[log.action].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#787774] max-w-xs truncate" title={log.description}>{log.description}</td>
                <td className="px-4 py-3 text-xs text-[#787774] whitespace-nowrap">{log.date}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#787774] whitespace-nowrap">{log.time}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#787774]">{log.ip}</td>
                <td className="px-4 py-3 text-xs text-[#787774]">{log.browser}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#787774]"><Shield className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No se encontraron registros</p></div>
        )}
        <div className="px-4 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3] flex justify-between items-center">
          <p className="text-xs text-[#787774]">{filtered.length} de {MOCK_LOGS.length} registros</p>
          <button onClick={() => { setSearch(''); setFilterAction('todas'); setDateFrom(''); setDateTo(''); }}
            className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] transition-colors">
            <RefreshCw className="w-3 h-3" /> Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
