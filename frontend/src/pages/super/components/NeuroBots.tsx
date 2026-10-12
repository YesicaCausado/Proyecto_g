import { useState, useEffect, useCallback } from 'react';
import { Bot, Search, Trash2, PowerOff, BarChart2, Globe, Lock, FileText, MessageSquare, X, AlertCircle, Loader2 } from 'lucide-react';
import api, { invalidateApiCache } from '../../../services/api';
import BotResults from '../../teacher/components/neurobots/BotResults';

function apiError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
}

interface BotItem {
  id: number; name: string; teacher: string; group: string; subject: string;
  docs: number; queries: number; status: string; visibility: string; created: string;
}

type Filter = 'todos' | 'activo' | 'inactivo';

export default function NeuroBots() {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('todos');
  const [bots, setBots]       = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice]   = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy]       = useState<number | null>(null);
  const [progressBot, setProgressBot] = useState<BotItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const r = await api.get('/super/bots', { params: { _t: Date.now() } });
      setBots(r.data.bots ?? []);
    } catch {
      setLoadError('No fue posible cargar los NeuroBots de la institución.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (bot: BotItem) => {
    if (!window.confirm(`¿Eliminar el NeuroBot "${bot.name}" de ${bot.teacher}? Se quitarán sus asignaciones y documentos. Esta acción no se puede deshacer.`)) return;
    setBusy(bot.id);
    setNotice(null);
    try {
      await api.delete(`/bots/${bot.id}`);
      setBots(prev => prev.filter(b => b.id !== bot.id));
      invalidateApiCache('/bots');
      setNotice({ kind: 'ok', text: `NeuroBot "${bot.name}" eliminado.` });
    } catch (err) {
      setNotice({ kind: 'error', text: apiError(err, 'No fue posible eliminar el NeuroBot.') });
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (bot: BotItem) => {
    const activate = bot.status !== 'activo';
    setBusy(bot.id);
    setNotice(null);
    try {
      const r = await api.patch(`/bots/${bot.id}`, { is_active: activate });
      const status = (r.data?.is_active ?? activate) ? 'activo' : 'inactivo';
      setBots(prev => prev.map(b => (b.id === bot.id ? { ...b, status } : b)));
      invalidateApiCache('/bots');
      setNotice({ kind: 'ok', text: `NeuroBot "${bot.name}" ${status === 'activo' ? 'activado' : 'desactivado'}.` });
    } catch (err) {
      setNotice({ kind: 'error', text: apiError(err, 'No fue posible cambiar el estado del NeuroBot.') });
    } finally {
      setBusy(null);
    }
  };

  const filtered = bots.filter(b =>
    (filter === 'todos' || b.status === filter) &&
    (b.name.toLowerCase().includes(search.toLowerCase()) ||
     b.teacher.toLowerCase().includes(search.toLowerCase()) ||
     b.subject.toLowerCase().includes(search.toLowerCase()))
  );

  const totalQueries = bots.reduce((s, b) => s + b.queries, 0);
  const activeBots   = bots.filter(b => b.status === 'activo').length;
  const publicBots   = bots.filter(b => b.visibility === 'publico').length;

  return (
    <div className="space-y-6">

      {progressBot && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setProgressBot(null)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white rounded-t-lg border border-b-0 border-[#E9E9E7] px-5 py-3">
              <p className="text-sm font-semibold text-[#191919]">{progressBot.name} · {progressBot.teacher}</p>
              <button onClick={() => setProgressBot(null)} aria-label="Cerrar" className="text-[#787774] hover:text-[#37352F]"><X className="w-5 h-5" /></button>
            </div>
            <BotResults botId={String(progressBot.id)} refreshKey={0} />
          </div>
        </div>
      )}

      {notice && (
        <div className={`flex items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-sm ${
          notice.kind === 'ok' ? 'bg-[#EDF7F5] border-[#B7E1D9] text-[#0F7B6C]' : 'bg-[#FDEEEE] border-[#F5C7C7] text-[#E03E3E]'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Cerrar" className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-3 bg-[#FDEEEE] border border-[#F5C7C7] text-[#E03E3E] rounded-md px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {loadError}</span>
          <button onClick={load} className="font-medium hover:underline">Reintentar</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Bot,          label: 'NeuroBots activos', value: activeBots,       color: 'text-[#6940A5]', bg: 'bg-purple-50' },
          { icon: MessageSquare,label: 'Consultas totales',  value: totalQueries,     color: 'text-[#0B6E99]', bg: 'bg-blue-50' },
          { icon: Globe,        label: 'Bots públicos',     value: publicBots,       color: 'text-[#0F7B6C]', bg: 'bg-emerald-50' },
          { icon: FileText,     label: 'Total documentos',  value: bots.reduce((s,b)=>s+b.docs,0), color: 'text-[#D9730D]', bg: 'bg-orange-50' },
        ].map((k,i) => (
          <div key={i} className="bg-white border border-[#E9E9E7] rounded-lg p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-md ${k.bg} flex items-center justify-center flex-shrink-0`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xs text-[#787774]">{k.label}</p>
              <p className="text-xl font-bold text-[#191919]">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEADAB]" />
          <input type="text" placeholder="Buscar bot, profesor o materia..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white" />
        </div>
        <div className="flex gap-2">
          {(['todos','activo','inactivo'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs rounded-md border font-medium transition-colors capitalize ${filter===f ? 'bg-[#37352F] text-white border-[#37352F]' : 'bg-white text-[#787774] border-[#E9E9E7] hover:bg-[#F7F6F3]'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              {['NeuroBots','Profesor','Materia','Docs','Consultas','Visibilidad','Estado','Acciones'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider ${h==='Acciones'?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {filtered.map(bot => (
              <tr key={bot.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-purple-50 rounded-md flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-[#6940A5]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#191919] text-sm">{bot.name}</p>
                      <p className="text-[10px] text-[#787774]">{bot.group}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#F7F6F3] border border-[#E9E9E7] flex items-center justify-center text-[10px] font-bold text-[#787774]">
                      {bot.teacher.charAt(0)}
                    </div>
                    <span className="text-sm text-[#37352F]">{bot.teacher}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-[#787774]">{bot.subject}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#37352F]">
                    <FileText className="w-3.5 h-3.5 text-[#787774]" /> {bot.docs}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#37352F]">
                    <MessageSquare className="w-3.5 h-3.5 text-[#787774]" /> {bot.queries.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bot.visibility === 'publico' ? 'bg-[#E5F3FF] text-[#0B6E99]' : 'bg-[#F7F6F3] text-[#787774]'}`}>
                    {bot.visibility === 'publico' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {bot.visibility}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${bot.status === 'activo' ? 'bg-[#EEF8F6] text-[#0F7B6C]' : 'bg-[#F7F6F3] text-[#787774]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'activo' ? 'bg-[#0F7B6C]' : 'bg-[#AEADAB]'}`} />
                    {bot.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {busy === bot.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#787774]" />}
                    <button onClick={() => setProgressBot(bot)} title="Ver progreso de los estudiantes" className="p-1.5 rounded hover:bg-purple-50 text-[#787774] hover:text-[#6940A5] transition-colors"><BarChart2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToggle(bot)} disabled={busy !== null} title={bot.status === 'activo' ? 'Desactivar' : 'Activar'} className="p-1.5 rounded hover:bg-[#FCF6E5] text-[#787774] hover:text-[#D9730D] disabled:opacity-50 transition-colors"><PowerOff className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(bot)} disabled={busy !== null} title="Eliminar" className="p-1.5 rounded hover:bg-[#FDEEEE] text-[#787774] hover:text-[#E03E3E] disabled:opacity-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6940A5]" /></div>
        ) : filtered.length === 0 && !loadError && (
          <div className="text-center py-12 text-[#787774]"><Bot className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No se encontraron NeuroBots</p></div>
        )}
        <div className="px-4 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3] flex justify-between items-center">
          <p className="text-xs text-[#787774]">Mostrando {filtered.length} de {bots.length} NeuroBots</p>
        </div>
      </div>
    </div>
  );
}
