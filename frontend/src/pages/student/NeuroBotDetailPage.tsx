/**
 * Detalle de un NeuroBot asignado al estudiante (destino de la notificación
 * «Nuevo NeuroBot asignado»): quién lo asignó, meta, estado y progreso reales,
 * y acceso al chat para empezar o retomar la última conversación.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Bot, CheckCircle, FileText, Loader2, MessageSquare, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import {
  ProgressBar, StatusBadge, chatLink, formatDateTime, type AssignedBot,
} from '../../components/neurobots/progress';

export default function NeuroBotDetailPage() {
  const { botId } = useParams();
  const [bot, setBot] = useState<AssignedBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notAssigned, setNotAssigned] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotAssigned(false);
    try {
      const res = await api.get<AssignedBot>(`/bots/assigned-to-me/${botId}`, { params: { _t: Date.now() } });
      setBot(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) setNotAssigned(true);
      else setError('No fue posible cargar este NeuroBot.');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-5" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Link to="/bots" className="inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F]">
        <ArrowLeft className="w-4 h-4" /> Mis NeuroBots
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#9B9A97]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando NeuroBot…
        </div>
      ) : notAssigned ? (
        <div className="text-center py-12 border border-dashed border-[#E9E9E7] rounded-md">
          <Bot className="w-8 h-8 text-[#E9E9E7] mx-auto mb-2" />
          <p className="text-sm text-[#787774]">Este NeuroBot ya no está asignado a ti.</p>
          <p className="text-xs text-[#AEADAB] mt-1">Puede que tu profesor haya quitado la asignación.</p>
        </div>
      ) : error || !bot ? (
        <div className="flex items-center justify-between gap-3 bg-[#FDEEEE] border border-[#F5C7C7] text-[#E03E3E] rounded-md p-4 text-sm">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error || 'No fue posible cargar este NeuroBot.'}</span>
          <button onClick={load} className="flex items-center gap-1 font-medium hover:underline">
            <RotateCcw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#EEF3FD] border border-[#C5D9F7] rounded-xl flex items-center justify-center flex-shrink-0">
                <Bot className="w-6 h-6 text-[#2E6FDB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-[#191919]">{bot.name}</h1>
                  <StatusBadge progress={bot.progress} />
                </div>
                <p className="text-sm text-[#787774]">{bot.subject || 'General'}{bot.creator_name ? ` · Creado por ${bot.creator_name}` : ''}</p>
                {bot.description && <p className="text-sm text-[#37352F] mt-2">{bot.description}</p>}
              </div>
            </div>

            <div className="mt-5">
              <ProgressBar progress={bot.progress} />
            </div>

            {bot.progress.status === 'completado' && (
              <p className="mt-3 flex items-center gap-2 text-sm text-[#0F7B6C]">
                <CheckCircle className="w-4 h-4" /> Completaste este NeuroBot el {formatDateTime(bot.progress.completed_at)}. Puedes seguir practicando.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {bot.last_conversation_id && (
                <Link to={chatLink(bot, bot.last_conversation_id)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0]">
                  <MessageSquare className="w-4 h-4" /> Continuar conversación
                </Link>
              )}
              <Link to={chatLink(bot)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  bot.last_conversation_id
                    ? 'border border-[#E9E9E7] text-[#37352F] hover:bg-[#F7F6F3]'
                    : 'bg-[#2E6FDB] text-white hover:bg-[#255DC0]'}`}>
                <MessageSquare className="w-4 h-4" /> {bot.progress.status === 'asignado' ? 'Empezar' : 'Nueva conversación'}
              </Link>
            </div>
          </div>

          <div className="bg-white border border-[#E9E9E7] rounded-lg divide-y divide-[#F7F6F3] text-sm">
            <Row label="Asignado por">
              {bot.sources.map((s, i) => (
                <span key={i} className="block">
                  {s.teacher_name || 'Tu profesor'}{s.type === 'aula' ? ` · grupo ${s.classroom_name}` : ' · asignación individual'}
                </span>
              ))}
            </Row>
            <Row label="Asignado el">{formatDateTime(bot.assigned_at)}</Row>
            <Row label="Meta">{bot.progress.goal_interactions} interacciones con el NeuroBot</Row>
            <Row label="Empezaste">{formatDateTime(bot.progress.started_at)}</Row>
            <Row label="Última actividad">{formatDateTime(bot.progress.last_activity_at)}</Row>
            <Row label="Base de conocimiento">
              <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-[#787774]" /> {bot.document_count} documento(s)</span>
            </Row>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <span className="w-40 flex-shrink-0 text-[#787774]">{label}</span>
      <span className="flex-1 text-[#37352F]">{children}</span>
    </div>
  );
}
