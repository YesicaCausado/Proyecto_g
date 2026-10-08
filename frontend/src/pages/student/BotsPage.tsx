import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import NeuronAvatar from '../../components/NeuronAvatar';
import { COMPETENCIES } from '../../data/competencies';
import api from '../../services/api';
import { AlertCircle, Bot, Loader2, RotateCcw } from 'lucide-react';
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
 * «Mis NeuroBots»: los NeuroBots que los profesores asignaron al estudiante
 * (por grupo o individualmente) con su estado y progreso reales, más los bots
 * públicos de su institución y las competencias generales con Neuron.
 */
export default function BotsPage() {
  const SKILLS = COMPETENCIES;
  const [assigned, setAssigned] = useState<AssignedBot[]>([]);
  const [publicBots, setPublicBots] = useState<SharedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex items-center gap-4 bg-[#1a1a1a] rounded-md p-5 mb-6 text-white">
        <NeuronAvatar size={52} online variant="gradient" />
        <div>
          <p className="text-[#9B9A97] text-[10px] uppercase tracking-widest font-semibold mb-0.5">Tu asistente inteligente</p>
          <h2 className="text-base font-bold text-white leading-tight">
            Neuron <span className="text-[#60C8FF] font-normal text-sm">· NeuroLearn AI</span>
          </h2>
          <p className="text-[#787774] text-xs mt-1">Practica con los NeuroBots de tus profesores o con las competencias del Saber 11</p>
        </div>
      </div>

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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {assigned.map(bot => (
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
      {!loading && !error && publicBots.length > 0 && (
        <>
          <div className="pb-3 mb-4 border-b border-[#E9E9E7]">
            <h2 className="text-lg font-semibold text-[#37352F]">Explorar NeuroBots de tu institución</h2>
            <p className="text-[#787774] text-sm mt-1">Bots públicos de tus profesores. No tienen meta ni seguimiento.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {publicBots.map(bot => (
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

      {/* ── Competencias generales con Neuron ──────────────────────────── */}
      <div className="pb-3 mb-4 border-b border-[#E9E9E7]">
        <h2 className="text-lg font-semibold text-[#37352F]">Competencias Generales</h2>
        <p className="text-[#787774] text-sm mt-1">
          5 competencias clave para el Saber 11. Selecciona una para practicar con Neuron.
        </p>
      </div>
      <div className="space-y-3 mb-10">
        {SKILLS.map((skill) => (
          <Link
            key={skill.key}
            to={`/chat/${skill.slug}`}
            className="flex items-start gap-4 bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors group"
          >
            <div className={`w-12 h-12 ${skill.bg} border border-[#E9E9E7] rounded-md flex items-center justify-center text-2xl flex-shrink-0`}>
              {skill.iconEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[#37352F] text-[15px]">{skill.name}</h3>
              <p className="text-sm text-[#787774] mt-0.5">{skill.desc}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {skill.topics.map((topic) => (
                  <span key={topic} className="text-xs bg-[#F7F6F3] text-[#787774] px-2.5 py-1 rounded-md border border-[#E9E9E7]">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden sm:flex items-center text-[#9B9A97] opacity-0 group-hover:opacity-100 transition-opacity text-sm">
              Practicar →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
