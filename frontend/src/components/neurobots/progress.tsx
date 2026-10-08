/**
 * Tipos y piezas visuales compartidas del progreso del estudiante con un
 * NeuroBot asignado (respuestas de /bots/assigned-to-me y del chat).
 */
export type NeuroBotStatus = 'asignado' | 'iniciado' | 'en_progreso' | 'completado';

export interface NeuroBotProgress {
  status: NeuroBotStatus;
  status_label: string;
  percent: number;
  interactions: number;
  goal_interactions: number;
  started_at: string | null;
  last_activity_at: string | null;
  completed_at: string | null;
  just_completed?: boolean;
}

export interface AssignedBotSource {
  type: 'aula' | 'individual';
  teacher_name: string;
  classroom_id?: number;
  classroom_name?: string;
}

export interface AssignedBot {
  id: number;
  name: string;
  description: string;
  subject: string;
  creator_name: string;
  is_required: boolean;
  assigned_at: string | null;
  sources: AssignedBotSource[];
  document_count: number;
  progress: NeuroBotProgress;
  last_conversation_id?: number | null;
}

export const STATUS_STYLE: Record<NeuroBotStatus, string> = {
  asignado:    'bg-[#F7F6F3] text-[#787774] border-[#E9E9E7]',
  iniciado:    'bg-[#FBF3DB] text-[#9F6B00] border-[#F0DDA4]',
  en_progreso: 'bg-[#EEF3FD] text-[#2E6FDB] border-[#C5D9F7]',
  completado:  'bg-[#EDF7F5] text-[#0F7B6C] border-[#B7E1D9]',
};

export function StatusBadge({ progress }: { progress: NeuroBotProgress }) {
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[progress.status]}`}>
      {progress.status_label}
    </span>
  );
}

export function ProgressBar({ progress, compact = false }: { progress: NeuroBotProgress; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 ${compact ? 'h-1.5' : 'h-2'} bg-[#E9E9E7] rounded-full overflow-hidden`}>
          <div className={`h-full ${progress.status === 'completado' ? 'bg-[#0F7B6C]' : 'bg-[#2E6FDB]'}`}
            style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-xs text-[#787774] whitespace-nowrap">{progress.percent}%</span>
      </div>
      <p className="text-[11px] text-[#9B9A97] mt-1">
        {progress.interactions} / {progress.goal_interactions} interacciones
      </p>
    </div>
  );
}

export function sourceLabel(bot: AssignedBot): string {
  return bot.sources.map(s => (s.type === 'aula'
    ? `Grupo ${s.classroom_name}`
    : `Asignado por ${s.teacher_name || 'tu profesor'}`)).join(' · ');
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Ruta del chat con el bot (opcionalmente retomando una conversación guardada). */
export function chatLink(bot: { id: number; name: string }, conversationId?: number | null): string {
  const base = `/chat/custom?bot_id=${bot.id}&bot_name=${encodeURIComponent(bot.name)}`;
  return conversationId ? `${base}&conversation_id=${conversationId}` : base;
}
