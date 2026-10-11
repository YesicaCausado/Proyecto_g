import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { AlertCircle, Bot, Loader2, RotateCcw, Search, BookOpen } from 'lucide-react';
import {
  ProgressBar, StatusBadge, chatLink, sourceLabel, type AssignedBot,
} from '../../components/neurobots/progress';

interface SharedBot {
  id: number;
  name: string;
  description: string;
  subject: string;
  creator_name: string;
  source: string;
}

/**
 * «Mis NeuroBots»: módulo independiente con los NeuroBots que los profesores
 * asignaron al estudiante (por grupo o individualmente), con su estado y
 * progreso reales, y los NeuroBots públicos de su institución. Los chats de
 * competencias del Saber 11 están en su propio módulo («Competencias»).
 */
export default function BotsPage() {
  const [assigned, setAssigned] = useState<AssignedBot[]>([]);
  const [publicBots, setPublicBots] = useState<SharedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, shared] = await Promise.all([
        api.get('/bots/assigned-to-me', { params: { _t: Date.now() } }),
        api.get('/bots/shared-with-me'),
      ]);
      const list: AssignedBot[] = mine.data?.bots ?? [];
      const ids = new Set(list.map(b => b.id));
      setAssigned(list);
      setPublicBots((shared.data?.bots ?? []).filter((b: SharedBot) => b.source === 'public' && !ids.has(b.id)));
    } catch {
      setError('No fue posible cargar tus NeuroBots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = assigned.filter(b => b.progress.status !== 'completado').length;
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = (b: { name: string; subject?: string; description?: string; creator_name?: string }) => {
    const q = norm(query.trim());
    return !q || [b.name, b.subject, b.description, b.creator_name].some(v => v && norm(v).includes(q));
  };
  const shownAssigned = assigned.filter(matches);
  const shownPublic = publicBots.filter(matches);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Mis NeuroBots (asignados) ─────────────────────────────────── */}
      <div className="pb-3 mb-4 border-b border-[#E9E9E7] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#37352F]">Mis NeuroBots</h1>
          <p className="text-[#787774] text-sm mt-1">
            NeuroBots que tus profesores te asignaron. Completa la meta de interacciones de cada uno.
          </p>
        </div>
        {!loading && !error && assigned.length > 0 && (
          <span className="text-xs text-[#787774] whitespace-nowrap">{pending} pendiente(s) de {assigned.length}</span>
        )}
      </div>

      {!loading && !error && (assigned.length + publicBots.length) > 0 && (
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-[#9B9A97] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre, materia o profesor…"
            className="w-full pl-9 pr-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:outline-none focus:border-[#2E6FDB]" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[#9B9A97]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando tus NeuroBots…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 bg-[#FDEEEE] border border-[#F5C7C7] text-[#E03E3E] rounded-md p-4 mb-10 text-sm">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</span>
          <button onClick={load} className="flex items-center gap-1 font-medium hover:underline">
            <RotateCcw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : assigned.length === 0 ? (
        <div className="text-center py-8 mb-10 border border-dashed border-[#E9E9E7] rounded-md">
          <Bot className="w-8 h-8 text-[#E9E9E7] mx-auto mb-2" />
          <p className="text-sm text-[#787774]">Tus profesores todavía no te han asignado NeuroBots.</p>
          <p className="text-xs text-[#AEADAB] mt-1">Cuando lo hagan, recibirás una notificación.</p>
        </div>
      ) : shownAssigned.length === 0 ? (
        <p className="text-sm text-[#787774] text-center py-6 mb-10">Ningún NeuroBot asignado coincide con «{query}».</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {shownAssigned.map(bot => (
            <Link key={bot.id} to={`/bots/${bot.id}`}
              className="flex flex-col bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-[#EEF3FD] border border-[#C5D9F7] rounded-md flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-[#2E6FDB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#37352F] text-[15px] truncate">{bot.name}</h3>
                  <p className="text-[11px] text-[#9B9A97] truncate">{bot.subject || 'General'} · {sourceLabel(bot)}</p>
                </div>
                <StatusBadge progress={bot.progress} />
              </div>
              <p className="text-sm text-[#787774] flex-1 mb-4 line-clamp-2">{bot.description || 'Sin descripción'}</p>
              <ProgressBar progress={bot.progress} compact />
            </Link>
          ))}
        </div>
      )}

      {/* ── Otros NeuroBots públicos de la institución ─────────────────── */}
      {!loading && !error && shownPublic.length > 0 && (
        <>
          <div className="pb-3 mb-4 border-b border-[#E9E9E7]">
            <h2 className="text-lg font-semibold text-[#37352F]">Explorar NeuroBots de tu institución</h2>
            <p className="text-[#787774] text-sm mt-1">Bots públicos de tus profesores. No tienen meta ni seguimiento.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {shownPublic.map(bot => (
              <Link key={bot.id} to={chatLink(bot)}
                className="flex flex-col bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-[#787774]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#37352F] text-[15px] truncate">{bot.name}</h3>
                    <p className="text-[11px] text-[#9B9A97] truncate">{bot.subject}</p>
                  </div>
                </div>
                <p className="text-sm text-[#787774] flex-1 mb-3 line-clamp-2">{bot.description || 'Sin descripción'}</p>
                <span className="text-xs text-[#9B9A97]">Por: {bot.creator_name || 'Profesor'}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Los chats de competencias tienen su propio módulo. */}
      <Link to="/chat" className="flex items-center gap-2 text-sm text-[#787774] hover:text-[#37352F] mb-10">
        <BookOpen className="w-4 h-4" /> ¿Buscas practicar las competencias del Saber 11? Ve a Competencias →
      </Link>
    </div>
  );
}
