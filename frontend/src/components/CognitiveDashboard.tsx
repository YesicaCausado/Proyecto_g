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
  normal:       { label: 'Normal',       color: 'bg-gray-100 text-gray-700 border-gray-200',       emoji: '😐' },
  fatigue:      { label: 'Fatiga',       color: 'bg-amber-100 text-amber-700 border-amber-200',    emoji: '😴' },
  overload:     { label: 'Sobrecarga',   color: 'bg-red-100 text-red-700 border-red-200',          emoji: '🤯' },
  doubt:        { label: 'Duda',         color: 'bg-yellow-100 text-yellow-700 border-yellow-200', emoji: '🤔' },
  mastery:      { label: 'Dominio',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', emoji: '🌟' },
  flow:         { label: 'Flujo',        color: 'bg-blue-100 text-blue-700 border-blue-200',       emoji: '✨' },
  frustration:  { label: 'Frustración',  color: 'bg-red-100 text-red-700 border-red-200',          emoji: '😤' },
  curiosity:    { label: 'Curiosidad',   color: 'bg-violet-100 text-violet-700 border-violet-200', emoji: '🔍' },
  // legacy labels
  focused:      { label: 'Enfocado',     color: 'bg-blue-100 text-blue-700 border-blue-200',       emoji: '🎯' },
  learning:     { label: 'Aprendiendo',  color: 'bg-indigo-100 text-indigo-700 border-indigo-200', emoji: '📚' },
  struggling:   { label: 'Dificultad',   color: 'bg-amber-100 text-amber-700 border-amber-200',    emoji: '💪' },
  confused:     { label: 'Confundido',   color: 'bg-orange-100 text-orange-700 border-orange-200', emoji: '😕' },
  mastering:    { label: 'Dominando',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200', emoji: '🏆' },
};

const COLOR_CLASSES: Record<string, { bar: string; bg: string; text: string; ring: string }> = {
  blue:   { bar: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-200' },
  purple: { bar: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-200' },
  amber:  { bar: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-600',  ring: 'ring-amber-200' },
  green:  { bar: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-600',  ring: 'ring-green-200' },
  red:    { bar: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-600',    ring: 'ring-red-200' },
};

function MetricBar({ value, color, label }: { value: number; color: string; label?: string }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const colorClass = COLOR_CLASSES[color]?.bar || 'bg-gray-400';
  return (
    <div>
      {label && <span className="text-xs text-gray-500">{label}: {pct}%</span>}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
  const stateInfo = STATE_CONFIG[state] || { label: state, color: 'bg-gray-100 text-gray-700 border-gray-200', emoji: '🧠' };
  const activeModalities = response.active_modalities || [];
  const engagement = response.engagement_score ?? 0.5;
  const attention = response.attention_level ?? 1.0;
  const errorRisk = response.error_risk ?? 0.0;
  const confidence = response.confidence ?? 0;

  // Valores por patrón: usar datos reales de cámara/mic cuando estén activos
  const facialAttention = facialActive && facialSnapshot?.is_active
    ? facialSnapshot.attention_score
    : (activeModalities.includes('facial_microexpression') ? attention : 0);

  const voiceEnergy = voiceActive && voiceSnapshot
    ? voiceSnapshot.energy_level
    : (activeModalities.includes('voice_prosody') ? 0.6 : 0);

  const patternValues: Record<string, number> = {
    interaction_rhythm:     Math.min(1, engagement * 1.1),
    decision_sequence:      Math.min(1, confidence),
    facial_microexpression: facialAttention,
    voice_prosody:          voiceEnergy,
    error_prediction:       Math.min(1, 1 - errorRisk),
  };

  const isFacialLive = !!(facialActive && facialSnapshot?.is_active);
  const isVoiceLive  = !!(voiceActive && voiceSnapshot?.is_active);

  return (
    <div className="bg-white border-l border-gray-100 w-72 flex-shrink-0 overflow-y-auto p-4 space-y-4">
      {/* Estado Cognitivo */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-accent-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado Cognitivo</span>
        </div>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${stateInfo.color}`}>
          <span className="text-2xl">{stateInfo.emoji}</span>
          <div>
            <p className="font-semibold text-sm">{stateInfo.label}</p>
            <p className="text-xs opacity-70">Confianza: {Math.round(confidence * 100)}%</p>
          </div>
        </div>
        {response.emotional_state && (
          <p className="text-xs text-gray-400 mt-1 ml-1">Estado emocional: {response.emotional_state}</p>
        )}
      </div>

      {/* Métricas Globales */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center bg-blue-50 rounded-xl p-2">
          <CircleGauge value={engagement} color="blue" size={44} />
          <p className="text-xs text-blue-600 font-medium mt-1">Engagement</p>
          <p className="text-xs text-blue-500">{Math.round(engagement * 100)}%</p>
        </div>
        <div className="text-center bg-green-50 rounded-xl p-2">
          <CircleGauge value={attention} color="green" size={44} />
          <p className="text-xs text-green-600 font-medium mt-1">Atención</p>
          <p className="text-xs text-green-500">{Math.round(attention * 100)}%</p>
        </div>
        <div className="text-center bg-red-50 rounded-xl p-2">
          <CircleGauge value={errorRisk} color="red" size={44} />
          <p className="text-xs text-red-600 font-medium mt-1">Riesgo</p>
          <p className="text-xs text-red-500">{Math.round(errorRisk * 100)}%</p>
        </div>
      </div>

      {/* 5 Patrones Neuroconductuales */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          5 Patrones Neuroconductuales
        </p>
        <div className="space-y-2.5">
          {PATTERN_CONFIG.map((p, i) => {
            const Icon = p.icon;
            const val = patternValues[p.id] ?? 0;
            const isBackendActive = activeModalities.includes(p.id) || ['interaction_rhythm', 'decision_sequence', 'error_prediction'].includes(p.id);
            const isSensorLive = (p.id === 'facial_microexpression' && isFacialLive)
                               || (p.id === 'voice_prosody' && isVoiceLive);
            const isActive = isBackendActive || isSensorLive;
            const colors = COLOR_CLASSES[p.color];
            return (
              <div key={p.id} className={`rounded-xl p-2.5 ${colors.bg}`}>
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
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isSensorLive ? `🔴 ${Math.round(val * 100)}%` : isActive ? `${Math.round(val * 100)}%` : '—'}
                  </span>
                </div>
                {isActive && (
                  <MetricBar value={val} color={p.color} />
                )}
                {!isActive && (
                  <p className="text-xs text-gray-400">Datos insuficientes</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recomendaciones */}
      {response.suggestions && response.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Recomendaciones IA
          </p>
          <div className="space-y-1.5">
            {response.suggestions.slice(0, 3).map((sug, i) => (
              <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed">
                {sug}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modalidades Activas */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">Canales activos</p>
        <div className="flex flex-wrap gap-1">
          {['interaction_rhythm', 'decision_sequence', 'error_prediction'].map((mod) => (
            <span key={mod} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              {mod === 'interaction_rhythm' ? 'Ritmo' :
               mod === 'decision_sequence' ? 'Decisión' : 'Predicción'}
            </span>
          ))}
          {(activeModalities.includes('facial_microexpression') || isFacialLive) && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isFacialLive ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}>
              {isFacialLive ? '🔴 Facial' : 'Facial'}
            </span>
          )}
          {!isFacialLive && !activeModalities.includes('facial_microexpression') && (
            <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">📷 Facial inactivo</span>
          )}
          {(activeModalities.includes('voice_prosody') || isVoiceLive) && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${isVoiceLive ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600'}`}>
              {isVoiceLive ? '🔴 Voz' : 'Voz'}
            </span>
          )}
          {!isVoiceLive && !activeModalities.includes('voice_prosody') && (
            <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">🎤 Voz inactiva</span>
          )}
        </div>
        {/* Detalles en vivo de facial */}
        {isFacialLive && facialSnapshot && (
          <div className="mt-2 text-xs text-gray-500 space-y-0.5 bg-amber-50 rounded-lg px-2 py-1.5">
            <p>👁 Gaze: <span className="font-medium text-amber-700">{facialSnapshot.gaze_direction}</span></p>
            <p>😊 Sonrisa: {Math.round(facialSnapshot.smile_intensity * 100)}% · Parpadeo: {facialSnapshot.blink_rate.toFixed(0)}/min</p>
          </div>
        )}
        {/* Detalles en vivo de voz */}
        {isVoiceLive && voiceSnapshot && (
          <div className="mt-2 text-xs text-gray-500 space-y-0.5 bg-green-50 rounded-lg px-2 py-1.5">
            <p>🎵 Tono: {voiceSnapshot.pitch_mean_hz.toFixed(0)} Hz · Vol: {voiceSnapshot.volume_db.toFixed(0)} dB</p>
            <p>⚡ Velocidad: {voiceSnapshot.speech_rate_wpm.toFixed(0)} ppm · Silencio: {(voiceSnapshot.silence_duration_ms / 1000).toFixed(1)}s</p>
          </div>
        )}
      </div>
    </div>
  );
}
