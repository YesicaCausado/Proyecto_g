/**
 * CognitiveDashboard
 * Visualización en tiempo real de los 5 Patrones Neuroconductuales Digitales
 */
import type { ChatMessageResponse } from '../types';
import type { FacialSnapshot } from '../hooks/useFacialDetection';
import type { VoiceSnapshot } from '../hooks/useVoiceProsody';
import { Brain, Activity, Eye, Mic, AlertTriangle, Zap } from 'lucide-react';

interface Props {
  response: ChatMessageResponse | null;
  isVisible: boolean;
  facialSnapshot?: FacialSnapshot | null;
  facialActive?: boolean;
  voiceSnapshot?: VoiceSnapshot | null;
  voiceActive?: boolean;
}

const PATTERN_CONFIG = [
  {
    id: 'interaction_rhythm',
    label: 'Ritmo de Interacción',
    icon: Activity,
    color: 'blue',
    description: 'Velocidad y regularidad de respuestas',
  },
  {
    id: 'decision_sequence',
    label: 'Secuencia de Decisión',
    icon: Brain,
    color: 'purple',
    description: 'Confianza y patrones de decisión',
  },
  {
    id: 'facial_microexpression',
    label: 'Microexpresión Facial',
    icon: Eye,
    color: 'amber',
    description: 'Atención visual y estado emocional',
  },
  {
    id: 'voice_prosody',
    label: 'Prosodia de Voz',
    icon: Mic,
    color: 'green',
    description: 'Tono y fluidez en respuestas de voz',
  },
  {
    id: 'error_prediction',
    label: 'Predicción de Error',
    icon: AlertTriangle,
    color: 'red',
    description: 'Riesgo probabilístico de error',
  },
];

const STATE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  normal:       { label: 'Normal',       color: 'bg-[#F7F6F3] text-[#37352F] border-[#E9E9E7]',       emoji: '😐' },
  fatigue:      { label: 'Fatiga',       color: 'bg-[#FCF6E5] text-[#DFAB01] border-[#EDD88A]',    emoji: '😴' },
  overload:     { label: 'Sobrecarga',   color: 'bg-[#FDEEEE] text-[#E03E3E] border-[#F4BDBD]',          emoji: '🤯' },
  doubt:        { label: 'Duda',         color: 'bg-[#FCF6E5] text-[#DFAB01] border-[#EDD88A]', emoji: '🤔' },
  mastery:      { label: 'Dominio',      color: 'bg-[#EEF7F4] text-[#0F7B6C] border-[#B7DDD6]', emoji: '🌟' },
  flow:         { label: 'Flujo',        color: 'bg-[#E5F3FF] text-[#0B6E99] border-[#BFDFF0]',       emoji: '✨' },
  frustration:  { label: 'Frustración',  color: 'bg-[#FDEEEE] text-[#E03E3E] border-[#F4BDBD]',          emoji: '😤' },
  curiosity:    { label: 'Curiosidad',   color: 'bg-[#F4EFFB] text-[#6940A5] border-[#D9CCE9]', emoji: '🔍' },
  // legacy labels
  focused:      { label: 'Enfocado',     color: 'bg-[#E5F3FF] text-[#0B6E99] border-[#BFDFF0]',       emoji: '🎯' },
  learning:     { label: 'Aprendiendo',  color: 'bg-[#E5F3FF] text-[#0B6E99] border-[#BFDFF0]', emoji: '📚' },
  struggling:   { label: 'Dificultad',   color: 'bg-[#FCF6E5] text-[#DFAB01] border-[#EDD88A]',    emoji: '💪' },
  confused:     { label: 'Confundido',   color: 'bg-[#FDF4EC] text-[#D9730D] border-[#F2D2B7]', emoji: '😕' },
  mastering:    { label: 'Dominando',    color: 'bg-[#EEF7F4] text-[#0F7B6C] border-[#B7DDD6]', emoji: '🏆' },
};

const COLOR_CLASSES: Record<string, { bar: string; bg: string; text: string; ring: string }> = {
  blue:   { bar: 'bg-[#0B6E99]',   bg: 'bg-[#E5F3FF]',   text: 'text-[#0B6E99]',   ring: 'ring-blue-200' },
  purple: { bar: 'bg-[#6940A5]', bg: 'bg-[#F7F3FB]', text: 'text-[#6940A5]', ring: 'ring-purple-200' },
  amber:  { bar: 'bg-[#DFAB01]',  bg: 'bg-[#FCF6E5]',  text: 'text-[#DFAB01]',  ring: 'ring-amber-200' },
  green:  { bar: 'bg-[#0F7B6C]',  bg: 'bg-[#EEF7F4]',  text: 'text-[#0F7B6C]',  ring: 'ring-green-200' },
  red:    { bar: 'bg-[#E03E3E]',    bg: 'bg-[#FDEEEE]',    text: 'text-[#E03E3E]',    ring: 'ring-red-200' },
};

function MetricBar({ value, color, label }: { value: number; color: string; label?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const colorClass = COLOR_CLASSES[color]?.bar || 'bg-[#9B9A97]';
  return (
    <div>
      {label && <span className="text-xs text-[#787774]">{label}: {pct}%</span>}
      <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-700 rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CircleGauge({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const pct = Math.min(Math.max(value, 0), 1);
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const colorMap: Record<string, string> = {
    blue: '#3b82f6', purple: '#8b5cf6', amber: '#f59e0b',
    green: '#22c55e', red: '#ef4444',
  };
  const stroke = colorMap[color] || '#6b7280';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={stroke} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
    </svg>
  );
}

export default function CognitiveDashboard({ response, isVisible, facialSnapshot, facialActive, voiceSnapshot, voiceActive }: Props) {
  if (!isVisible || !response) return null;

  const state = response.cognitive_state || 'normal';
  const stateInfo = STATE_CONFIG[state] || { label: state, color: 'bg-[#F7F6F3] text-[#37352F] border-[#E9E9E7]', emoji: '🧠' };
  const activeModalities: string[] = response.active_modalities || [];
  // Métricas globales: se muestran SOLO si el backend las provee. Si no llegan
  // no se inventa un porcentaje, se muestra "—".
  const engagement = typeof response.engagement_score === 'number' ? response.engagement_score : null;
  const attention  = typeof response.attention_level === 'number' ? response.attention_level : null;
  const errorRisk  = typeof response.error_risk === 'number' ? response.error_risk
    : (typeof response.metadata?.error_risk === 'number' ? (response.metadata.error_risk as number) : null);
  const confidence = typeof response.confidence === 'number' ? response.confidence : null;

  // ── Datos reales de los 5 patrones desde metadata.patterns ──
  const patterns = (response.metadata?.patterns ?? {}) as Record<string, Record<string, unknown>>;
  const p1 = patterns.P1_interaction_rhythm ?? {};
  const p2 = patterns.P2_decision_sequence ?? {};
  const p5 = patterns.P5_error_prediction ?? {};
  const sessionStats = (response.metadata?.session_stats ?? {}) as Record<string, number>;
  const _unusedSession = sessionStats; void _unusedSession; // disponible para future use

  // Normalizar valores de patrón 1 a 0-1. Si no hay dato real, el patrón queda
  // en "Datos insuficientes" (no se inventa un 50% por defecto).
  const rtMs = typeof p1.response_time_ms === 'number' ? (p1.response_time_ms as number) : 0;
  const typingCpm = typeof p1.typing_speed_cpm === 'number' ? (p1.typing_speed_cpm as number) : 0;
  const hasP1 = rtMs > 0 || typingCpm > 0;
  const p1Score = hasP1
    ? (Math.min(1, 3200 / Math.max(rtMs, 500)) + Math.min(1, typingCpm / 200)) / 2
    : null;

  // Patrón 2: decisión — menos correcciones y más bursts = mayor confianza
  const hasCorrections = typeof p2.corrections === 'number';
  const bursts = typeof p2.typing_bursts === 'number' ? (p2.typing_bursts as number) : 0;
  const corrections = hasCorrections ? (p2.corrections as number) : 0;
  const hasP2 = hasCorrections || bursts >= 1;
  const p2Score = hasP2
    ? Math.max(0, Math.min(1, 1 - Math.min(1, corrections / 10) - (bursts >= 3 ? 0.1 : 0)))
    : null;

  // Patrón 5: predicción de error en tiempo real (chat) + historial de quizzes.
  const quizErrRate = typeof p5.quiz_error_rate === 'number' ? (p5.quiz_error_rate as number) : 0;
  const weakConcepts = ((p5.weak_concepts as string[]) || []).slice(0, 3);
  const errRiskRt = typeof p5.error_risk_realtime === 'number' ? (p5.error_risk_realtime as number) : null;
  const chatErrRate = typeof p5.chat_error_rate === 'number' ? (p5.chat_error_rate as number) : null;
  const evalCount = typeof p5.chat_eval_count === 'number' ? (p5.chat_eval_count as number) : 0;
  const lastGrade = p5.last_answer_grade as string | null | undefined;
  const hasP5 = errRiskRt != null || chatErrRate != null || quizErrRate > 0 || weakConcepts.length > 0;
  const p5Score = hasP5
    ? (errRiskRt != null ? Math.max(0, 1 - errRiskRt) : Math.max(0, 1 - quizErrRate))
    : null;

  // Facial/voz en vivo: solo se muestra un valor si hay un sensor real activo;
  // en caso contrario el patrón queda "Datos insuficientes".
  const facialAttention = facialActive && facialSnapshot?.is_active ? facialSnapshot.attention_score : null;

  const voiceEnergy = voiceActive && voiceSnapshot ? voiceSnapshot.energy_level : null;

  const patternValues: Record<string, number | null> = {
    interaction_rhythm:     p1Score,
    decision_sequence:      p2Score,
    facial_microexpression: facialAttention,
    voice_prosody:          voiceEnergy,
    error_prediction:       p5Score,
  };

  const isFacialLive = !!(facialActive && facialSnapshot?.is_active);
  const isVoiceLive  = !!(voiceActive && voiceSnapshot?.is_active);

  return (
    <div className="bg-white border-l border-[#E9E9E7] w-72 flex-shrink-0 overflow-y-auto p-4 space-y-4">
      {/* Estado Cognitivo */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-accent-500" />
          <span className="text-xs font-semibold text-[#787774] uppercase tracking-wide">Estado Cognitivo</span>
        </div>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${stateInfo.color}`}>
          <span className="text-2xl">{stateInfo.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{stateInfo.label}</p>
            <p className="text-xs opacity-70">Confianza: {confidence != null ? `${Math.round(confidence * 100)}%` : '—'}</p>
          </div>
        </div>
        {response.emotional_state && (
          <p className="text-xs text-[#9B9A97] mt-1 ml-1">Estado emocional: {response.emotional_state}</p>
        )}
      </div>

      {/* Métricas Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          { label: 'Engagement', val: engagement, color: 'blue' as const, tint: 'bg-[#E5F3FF]', text: 'text-[#0B6E99]' },
          { label: 'Atención', val: attention, color: 'green' as const, tint: 'bg-[#EEF7F4]', text: 'text-[#0F7B6C]' },
          { label: 'Riesgo', val: errorRisk, color: 'red' as const, tint: 'bg-[#FDEEEE]', text: 'text-[#E03E3E]' },
        ].map(m => (
          <div key={m.label} className={`text-center ${m.tint} rounded-md p-2`}>
            {m.val != null ? (
              <>
                <CircleGauge value={m.val} color={m.color} size={44} />
                <p className={`text-xs ${m.text} font-medium mt-1`}>{m.label}</p>
                <p className={`text-xs ${m.text}`}>{Math.round(m.val * 100)}%</p>
              </>
            ) : (
              <>
                <div className="h-11 flex items-center justify-center text-[#9B9A97] text-xs">—</div>
                <p className={`text-xs ${m.text} font-medium mt-1`}>{m.label}</p>
                <p className={`text-xs ${m.text}`}>sin datos</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 5 Patrones Neuroconductuales */}
      <div>
        <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mb-3">
          5 Patrones Neuroconductuales
        </p>
        <div className="space-y-2.5">
          {PATTERN_CONFIG.map((p, i) => {
            const Icon = p.icon;
            const val = patternValues[p.id] ?? null;
            const isBackendActive = patternValues[p.id] != null;
            const isSensorLive = (p.id === 'facial_microexpression' && isFacialLive)
                               || (p.id === 'voice_prosody' && isVoiceLive);
            const isActive = isBackendActive || isSensorLive;
            const colors = COLOR_CLASSES[p.color];
            return (
              <div key={p.id} className={`rounded-md p-2.5 ${colors.bg}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${colors.bg} ${colors.ring} ring-1`}>
                      <Icon className={`w-3 h-3 ${colors.text}`} />
                    </div>
                    <span className={`text-xs font-medium ${colors.text}`}>
                      {i + 1}. {p.label}
                    </span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    isActive
                      ? `${colors.bg} ${colors.text} ring-1 ${colors.ring}`
                      : 'bg-[#F7F6F3] text-[#9B9A97]'
                  }`}>
                    {isSensorLive ? `🔴 ${Math.round((val ?? 0) * 100)}%` : isActive ? `${Math.round((val ?? 0) * 100)}%` : '—'}
                  </span>
                </div>
                {isActive && (
                  <>
                    <MetricBar value={val ?? 0} color={p.color} />
                    {/* Patrón 1: mostrar RT y velocidad real */}
                    {p.id === 'interaction_rhythm' && rtMs > 0 && (
                      <p className="text-xs text-[#9B9A97] mt-1">
                        RT: {(rtMs/1000).toFixed(1)}s · {typingCpm.toFixed(0)} cpm
                      </p>
                    )}
                    {/* Patrón 2: mostrar correcciones reales */}
                    {p.id === 'decision_sequence' && (
                      <p className="text-xs text-[#9B9A97] mt-1">
                        {corrections} correc. · {bursts} ráfaga{bursts !== 1 ? 's' : ''}
                        {(p2.is_question as boolean) ? ' · ❓pregunta' : ''}
                      </p>
                    )}
                    {/* Patrón 5: estado en tiempo real del chat + historial */}
                    {p.id === 'error_prediction' && (
                      <p className="text-xs text-[#E03E3E] mt-1">
                        {lastGrade === 'incorrect' ? '❌ Última respuesta incorrecta en chat'
                          : lastGrade === 'correct' ? '✅ Última respuesta correcta en chat'
                          : chatErrRate != null ? `⚡ ${Math.round(chatErrRate * 100)}% de fallos en chat`
                          : ''}
                      </p>
                    )}
                    {p.id === 'error_prediction' && weakConcepts.length > 0 && (
                      <p className="text-xs text-[#E03E3E] mt-1">
                        ⚠️ Débil en: {weakConcepts.join(', ')}
                      </p>
                    )}
                    {p.id === 'error_prediction' && quizErrRate > 0 && (
                      <p className="text-xs text-[#9B9A97] mt-0.5">
                        {Math.round(quizErrRate * 100)}% errores históricos
                      </p>
                    )}
                    {p.id === 'error_prediction' && evalCount > 0 && (
                      <p className="text-xs text-[#0F7B6C] mt-0.5 font-medium">
                        ⏱ {evalCount} respuesta{evalCount !== 1 ? 's' : ''} evaluadas en tiempo real
                      </p>
                    )}
                  </>
                )}
                {!isActive && (
                  <p className="text-xs text-[#9B9A97]">Datos insuficientes</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recomendaciones */}
      {response.suggestions && response.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mb-2">
            Recomendaciones IA
          </p>
          <div className="space-y-1.5">
            {response.suggestions.slice(0, 3).map((sug, i) => (
              <div key={i} className="text-xs text-[#787774] bg-[#F7F6F3] rounded-lg px-2.5 py-2 leading-relaxed">
                {sug}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modalidades Activas */}
      <div className="pt-2 border-t border-[#E9E9E7]">
        <p className="text-xs text-[#9B9A97] mb-1.5">Canales activos</p>
        <div className="flex flex-wrap gap-1">
          {['interaction_rhythm', 'decision_sequence', 'error_prediction'].map((mod) => (
            <span key={mod} className="text-xs bg-[#E5F3FF] text-[#0B6E99] px-2 py-0.5 rounded-full">
              {mod === 'interaction_rhythm' ? 'Ritmo' :
               mod === 'decision_sequence' ? 'Decisión' : 'Predicción'}
            </span>
          ))}
          {(activeModalities.includes('facial_microexpression') || isFacialLive) && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isFacialLive ? 'bg-[#DFAB01] text-white' : 'bg-[#FCF6E5] text-[#DFAB01]'}`}>
              {isFacialLive ? '🔴 Facial' : 'Facial'}
            </span>
          )}
          {!isFacialLive && !activeModalities.includes('facial_microexpression') && (
            <span className="text-xs bg-[#F7F6F3] text-[#9B9A97] px-2 py-0.5 rounded-full">📷 Facial inactivo</span>
          )}
          {(activeModalities.includes('voice_prosody') || isVoiceLive) && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isVoiceLive ? 'bg-[#0F7B6C] text-white' : 'bg-[#EEF7F4] text-[#0F7B6C]'}`}>
              {isVoiceLive ? '🔴 Voz' : 'Voz'}
            </span>
          )}
          {!isVoiceLive && !activeModalities.includes('voice_prosody') && (
            <span className="text-xs bg-[#F7F6F3] text-[#9B9A97] px-2 py-0.5 rounded-full">🎤 Voz inactiva</span>
          )}
        </div>
        {/* Detalles en vivo de facial */}
        {isFacialLive && facialSnapshot && (
          <div className="mt-2 text-xs text-[#787774] space-y-1 bg-[#FCF6E5] rounded-lg px-2 py-2">
            <div className="flex items-center justify-between">
              <span>👁 Mirada:</span>
              <span className="font-medium text-[#DFAB01]">{facialSnapshot.gaze_direction === 'screen' ? '✅ Pantalla' : facialSnapshot.gaze_direction === 'away' ? '↗ Desviada' : facialSnapshot.gaze_direction === 'down' ? '↓ Abajo' : '↑ Arriba'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>😊 Emoción:</span>
              <span className="font-medium text-[#DFAB01]">
                {facialSnapshot.valence > 0.2 ? '😊 Positiva' : facialSnapshot.valence < -0.2 ? '😟 Negativa' : '😐 Neutral'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>🏃 Movimiento:</span>
              <span className="font-medium text-[#DFAB01]">{Math.round(facialSnapshot.motion_level * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>😌 Ceño:</span>
              <span className="font-medium text-[#DFAB01]">{facialSnapshot.brow_furrow > 0.4 ? '😠 Fruncido' : '😌 Relajado'}</span>
            </div>
            <MetricBar value={facialSnapshot.attention_score} color="amber" label="Atención visual" />
          </div>
        )}
        {/* Detalles en vivo de voz */}
        {isVoiceLive && voiceSnapshot && (
          <div className="mt-2 text-xs text-[#787774] space-y-0.5 bg-[#EEF7F4] rounded-lg px-2 py-1.5">
            <p>🎵 Tono: {voiceSnapshot.pitch_mean_hz.toFixed(0)} Hz · Vol: {voiceSnapshot.volume_db.toFixed(0)} dB</p>
            <p>⚡ Velocidad: {voiceSnapshot.speech_rate_wpm.toFixed(0)} ppm · Silencio: {(voiceSnapshot.silence_duration_ms / 1000).toFixed(1)}s</p>
          </div>
        )}
      </div>
    </div>
  );
}
