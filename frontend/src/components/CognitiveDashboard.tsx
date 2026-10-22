/**
 * CognitiveDashboard
 * Estado de los 5 patrones neurodigitales del turno actual.
 *
 * Fuente única: `metadata.pattern_status` y `metadata.engine` de
 * /chat/message (backend/app/ai/cognitive/pattern_status.py). El panel NO
 * recalcula puntuaciones propias: muestra los valores medidos con su unidad, o
 * el estado real cuando no hay medición (no disponible, no aplica, error,
 * desactualizado o procesando). Un dato inexistente nunca se muestra como 0.
 */
import type { ChatMessageResponse } from '../types';
import type { FacialSnapshot } from '../hooks/useFacialDetection';
import type { VoiceSnapshot } from '../hooks/useVoiceProsody';
import { Brain, Activity, Eye, Mic, Keyboard, MousePointerClick, Zap, X } from 'lucide-react';

type PatternKey = 'facial' | 'voice' | 'keyboard' | 'interaction' | 'performance';
type PatternState = 'available' | 'pending' | 'unavailable' | 'not_applicable' | 'error' | 'stale';

interface PatternEntry {
  status: PatternState;
  reason?: string | null;
  measured_at?: string | null;
  values?: Record<string, unknown>;
  units?: Record<string, string>;
  source?: string;
  notes?: string | null;
  engine?: { used: boolean; weight: number | null };
}

interface EngineSummary {
  status?: PatternState;
  reason?: string | null;
  state?: string | null;
  confidence?: number | null;
  engagement_score?: number | null;
  attention_level?: number | null;
  error_risk?: number | null;
  label?: string;
}

interface Props {
  response: ChatMessageResponse | null;
  isVisible: boolean;
  /** Cierra el panel (botón visible solo en móvil, donde el panel es un cajón) */
  onClose?: () => void;
  /** true mientras se envía el turno: los patrones están "procesando" */
  pending?: boolean;
  facialSnapshot?: FacialSnapshot | null;
  facialActive?: boolean;
  voiceSnapshot?: VoiceSnapshot | null;
  voiceActive?: boolean;
}

const PATTERNS: { id: PatternKey; label: string; icon: typeof Eye; tint: string; text: string }[] = [
  { id: 'facial',      label: 'Facial',       icon: Eye,               tint: 'bg-[#FCF6E5]', text: 'text-[#9F6B00]' },
  { id: 'voice',       label: 'Voz',          icon: Mic,               tint: 'bg-[#EEF7F4]', text: 'text-[#0F7B6C]' },
  { id: 'keyboard',    label: 'Teclado',      icon: Keyboard,          tint: 'bg-[#E5F3FF]', text: 'text-[#0B6E99]' },
  { id: 'interaction', label: 'Interacción',  icon: MousePointerClick, tint: 'bg-[#F4EFFB]', text: 'text-[#6940A5]' },
  { id: 'performance', label: 'Rendimiento',  icon: Activity,          tint: 'bg-[#FDEEEE]', text: 'text-[#E03E3E]' },
];

/** Mensajes por estado (solo se muestran cuando el estado es real). */
const STATE_MESSAGE: Record<Exclude<PatternState, 'available'>, string> = {
  pending: 'Procesando medición…',
  unavailable: 'No hay mediciones disponibles para este patrón en la actividad seleccionada.',
  not_applicable: 'Este patrón no se mide en esta actividad.',
  error: 'No fue posible obtener la medición. Puedes intentarlo nuevamente.',
  stale: 'Dato desactualizado.',
};

const BADGE: Record<PatternState, { label: string; cls: string }> = {
  available:      { label: 'Medido',        cls: 'bg-[#EEF7F4] text-[#0F7B6C]' },
  pending:        { label: 'Procesando',    cls: 'bg-[#E5F3FF] text-[#0B6E99]' },
  unavailable:    { label: 'Sin datos',     cls: 'bg-[#F7F6F3] text-[#9B9A97]' },
  not_applicable: { label: 'No aplica',     cls: 'bg-[#F7F6F3] text-[#9B9A97]' },
  error:          { label: 'Error',         cls: 'bg-[#FDEEEE] text-[#E03E3E]' },
  stale:          { label: 'Desactualizado', cls: 'bg-[#FCF6E5] text-[#9F6B00]' },
};

const pct = (v: unknown) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : null);
const num = (v: unknown, unit = '', d = 0) => (typeof v === 'number' ? `${v.toFixed(d)}${unit}` : null);
const sec = (v: unknown) => (typeof v === 'number' ? `${(v / 1000).toFixed(1)} s` : null);
const GAZE: Record<string, string> = { screen: 'Pantalla', away: 'Desviada', down: 'Abajo', up: 'Arriba' };

/** Valores que se muestran por patrón: [clave, etiqueta, formato]. */
const FIELDS: Record<PatternKey, [string, string, (v: unknown) => string | null][]> = {
  facial: [
    ['attention_score', 'Atención visual (heurística)', pct],
    ['valence', 'Valencia', (v) => num(v, '', 2)],
    ['gaze_direction', 'Mirada predominante', (v) => (typeof v === 'string' ? GAZE[v] ?? v : null)],
    ['blink_rate', 'Parpadeo', (v) => num(v, '/min', 1)],
    ['brow_furrow', 'Ceño', pct],
    ['valid_frame_ratio', 'Fotogramas con rostro', pct],
  ],
  voice: [
    ['voiced_ms', 'Voz analizada', sec],
    ['speech_rate_wpm', 'Ritmo de habla (est.)', (v) => num(v, ' ppm')],
    ['pause_ratio', 'Tiempo en pausa', pct],
    ['pause_count', 'Pausas', (v) => num(v)],
    ['volume_dbfs', 'Volumen', (v) => num(v, ' dBFS', 1)],
    ['spectral_centroid_hz', 'Centroide espectral', (v) => num(v, ' Hz')],
  ],
  keyboard: [
    ['typing_speed_cpm', 'Velocidad de escritura', (v) => num(v, ' cpm')],
    ['response_time_ms', 'Tiempo de respuesta', sec],
    ['pause_before_ms', 'Pausa antes de escribir', sec],
    ['deleted_chars', 'Caracteres borrados', (v) => num(v)],
    ['typing_bursts', 'Ráfagas de escritura', (v) => num(v)],
  ],
  interaction: [
    ['window_ms', 'Permanencia en el turno', sec],
    ['tab_hidden_count', 'Cambios de pestaña', (v) => num(v)],
    ['hidden_ms', 'Tiempo con pestaña oculta', sec],
    ['suggestion_clicks', 'Sugerencias usadas', (v) => num(v)],
    ['pointer_clicks', 'Clics en el chat', (v) => num(v)],
  ],
  performance: [
    ['last_answer_correct', 'Última respuesta', (v) => (v === true ? 'Correcta' : v === false ? 'Incorrecta' : null)],
    ['chat_eval_count', 'Respuestas calificadas', (v) => num(v)],
    ['chat_error_rate', 'Errores en el chat', pct],
    ['quiz_count', 'Quizzes considerados', (v) => num(v)],
    ['quiz_error_rate', 'Errores en quizzes', pct],
    ['error_risk', 'Riesgo de error (experimental)', pct],
  ],
};

const STATE_LABEL: Record<string, string> = {
  normal: 'Normal', fatigue: 'Fatiga', overload: 'Sobrecarga', doubt: 'Duda',
  mastery: 'Dominio', flow: 'Flujo', frustration: 'Frustración', curiosity: 'Curiosidad',
};

function formatTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function PatternCard({ cfg, entry, pending }: { cfg: (typeof PATTERNS)[number]; entry: PatternEntry | undefined; pending: boolean }) {
  const Icon = cfg.icon;
  const status: PatternState = pending ? 'pending' : entry?.status ?? 'error';
  const rows = status === 'available' || status === 'stale'
    ? FIELDS[cfg.id]
        .map(([key, label, fmt]) => [label, fmt(entry?.values?.[key])] as const)
        .filter((r): r is readonly [string, string] => r[1] != null)
    : [];
  const when = formatTime(entry?.measured_at);
  const weight = entry?.engine?.used && typeof entry.engine.weight === 'number' ? entry.engine.weight : null;

  return (
    <div className={`rounded-md p-2.5 ${cfg.tint}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
          <Icon className="w-3.5 h-3.5" /> {cfg.label}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${BADGE[status].cls}`}>{BADGE[status].label}</span>
      </div>
      {rows.length > 0 && (
        <dl className="text-xs text-[#37352F] space-y-0.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-[#787774]">{label}</dt>
              <dd className="font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {status !== 'available' && (
        <p className="text-xs text-[#787774]">
          {status === 'stale' && when ? `Última medición válida: ${when}.` : STATE_MESSAGE[status]}
        </p>
      )}
      {!pending && entry?.reason && <p className="text-[11px] text-[#9B9A97] mt-0.5">{entry.reason}</p>}
      {status === 'available' && (
        <p className="text-[10px] text-[#9B9A97] mt-1">
          {when ? `Medido: ${when}` : ''}
          {weight != null ? ` · Peso en la estimación: ${Math.round(weight * 100)}%` : ' · No participa en la estimación'}
        </p>
      )}
    </div>
  );
}

export default function CognitiveDashboard({ response, isVisible, onClose, pending = false, facialSnapshot, facialActive, voiceSnapshot, voiceActive }: Props) {
  if (!isVisible || !response) return null;

  const meta = (response.metadata ?? {}) as Record<string, unknown>;
  const patterns = meta.pattern_status as Record<PatternKey, PatternEntry> | undefined;
  const engine = (meta.engine ?? {}) as EngineSummary;
  const engineOk = !pending && engine.status === 'available';

  const globals = [
    { label: 'Engagement', val: engine.engagement_score },
    { label: 'Atención', val: engine.attention_level },
    { label: 'Riesgo de error', val: engine.error_risk },
  ];

  const isFacialLive = !!(facialActive && facialSnapshot?.is_active);
  const isVoiceLive = !!(voiceActive && voiceSnapshot?.is_active);

  return (
    <>
    {/* Fondo del cajón en móvil: tocar fuera lo cierra */}
    {onClose && (
      <div className="md:hidden fixed inset-0 z-30 bg-black/20" onClick={onClose} aria-hidden="true" />
    )}
    <aside className="fixed md:static right-0 top-12 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:top-auto md:bottom-auto z-40 bg-white border-l border-[#E9E9E7] w-[min(20rem,calc(100vw-1rem))] md:w-72 flex-shrink-0 overflow-y-auto p-4 space-y-4 shadow-[-8px_0_24px_rgba(55,53,47,0.08)] md:shadow-none">
      {/* Estimación del motor */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-accent-500" />
          <span className="text-xs font-semibold text-[#787774] uppercase tracking-wide">Estado estimado</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel neuroconductual"
              className="md:hidden ml-auto -mr-1 p-2 rounded-md text-[#787774] hover:bg-[#F1F1EF]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-3 py-2.5 rounded-md border border-[#E9E9E7] bg-[#F7F6F3]">
          {pending ? (
            <p className="text-sm text-[#787774]">Procesando medición…</p>
          ) : engineOk ? (
            <>
              <p className="font-semibold text-sm text-[#37352F]">
                <Brain className="inline w-4 h-4 mr-1" />
                {STATE_LABEL[engine.state ?? ''] ?? engine.state}
              </p>
              <p className="text-xs text-[#787774]">
                Confianza: {typeof engine.confidence === 'number' ? `${Math.round(engine.confidence * 100)}%` : '—'}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#787774]">
              {engine.status === 'error' ? STATE_MESSAGE.error : engine.reason ?? 'Evidencia insuficiente para una estimación.'}
            </p>
          )}
        </div>
        <p className="text-[10px] text-[#9B9A97] mt-1">
          {engine.label ?? 'Estimación experimental del sistema; no es un diagnóstico.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {globals.map((g) => (
          <div key={g.label} className="text-center bg-[#F7F6F3] rounded-md p-2">
            <p className="text-sm font-semibold text-[#37352F]">
              {!pending && typeof g.val === 'number' ? `${Math.round(g.val * 100)}%` : '—'}
            </p>
            <p className="text-[10px] text-[#787774]">{g.label}</p>
          </div>
        ))}
      </div>

      {/* 5 patrones */}
      <div>
        <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mb-2">5 patrones neurodigitales</p>
        {!patterns && !pending ? (
          <p className="text-xs text-[#E03E3E]">El servidor no informó el estado de los patrones. {STATE_MESSAGE.error}</p>
        ) : (
          <div className="space-y-2">
            {PATTERNS.map((cfg) => (
              <PatternCard key={cfg.id} cfg={cfg} entry={patterns?.[cfg.id]} pending={pending} />
            ))}
          </div>
        )}
      </div>

      {/* Sensores locales en vivo: aún no forman parte de ninguna medición enviada */}
      {(facialActive || voiceActive) && (
        <div className="pt-2 border-t border-[#E9E9E7] text-xs text-[#787774] space-y-1">
          <p className="text-[#9B9A97]">Sensores en vivo (se procesan en tu dispositivo)</p>
          {facialActive && (
            <p>📷 {isFacialLive
              ? `Rostro detectado · mirada ${GAZE[facialSnapshot!.gaze_direction] ?? facialSnapshot!.gaze_direction}`
              : 'Cámara activa · no se detecta un rostro'}</p>
          )}
          {voiceActive && <p>🎤 {isVoiceLive ? 'Detectando voz' : 'Micrófono activo · sin voz'}</p>}
        </div>
      )}
    </aside>
    </>
  );
}
