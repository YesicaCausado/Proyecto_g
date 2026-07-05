/**
 * LiveModeView — Experiencia inmersiva de clase en vivo
 *
 * - Avatar VRM animado centrado (habla + gesticula)
 * - Subtítulos sincronizados debajo del avatar
 * - PTT: mantén el botón para hablar, suelta para enviar
 * - Panel derecho con patrones neuroconductuales activos
 * - Opción de encender cámara dentro del modo
 */
import React, { useRef, useEffect, useState } from 'react';
import { X, Camera, CameraOff, Mic } from 'lucide-react';
import VRMTutor, { type VRMTutorHandle } from './VRMTutor';
import type { VoiceTutorControls } from '../hooks/useVoiceTutor';
import type { ChatMessageResponse } from '../types';
import QuizPanel, { parseQuizFromMessage, type QuizData } from './QuizPanel';

// ── Video preview (espejo de cámara) ─────────────────────────────────────────
function VideoPreviewLive({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const previewRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const src = videoRef.current?.srcObject;
    if (previewRef.current && src) {
      previewRef.current.srcObject = src as MediaStream;
      previewRef.current.play().catch(() => {});
    }
  }, [videoRef]);
  return (
    <video
      ref={previewRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover scale-x-[-1] rounded-md"
    />
  );
}

// ── Etiquetas de estado para fondo oscuro ─────────────────────────────────────
const STATE_LABELS_DARK: Record<string, { label: string; color: string }> = {
  normal:      { label: 'Normal',      color: 'bg-[#37352F] text-[#9B9A97]' },
  fatigue:     { label: 'Fatiga',      color: 'bg-[#2F2D2B]/60 text-[#D9730D]' },
  overload:    { label: 'Sobrecarga',  color: 'bg-[#2F2D2B]/60 text-[#E03E3E]' },
  doubt:       { label: 'Duda',        color: 'bg-[#2F2D2B]/60 text-[#DFAB01]' },
  mastery:     { label: 'Dominio',     color: 'bg-[#1A2F2D]/60 text-[#0F7B6C]' },
  flow:        { label: 'Flujo ✨',    color: 'bg-[#0A2E40]/60 text-[#0B6E99]' },
  frustration: { label: 'Frustración', color: 'bg-[#2F2D2B]/60 text-[#E03E3E]' },
  curiosity:   { label: 'Curiosidad',  color: 'bg-[#2F2D2B]/60 text-[#6940A5]' },
  focused:     { label: 'Enfocado',    color: 'bg-[#1A2F2D]/60 text-[#0F7B6C]' },
  learning:    { label: 'Aprendiendo', color: 'bg-[#0A2E40]/60 text-[#0B6E99]' },
  struggling:  { label: 'Dificultad',  color: 'bg-[#2F2D2B]/60 text-[#D9730D]' },
  confused:    { label: 'Confundido',  color: 'bg-[#2F2D2B]/60 text-[#E03E3E]' },
  mastering:   { label: 'Dominando',   color: 'bg-[#1A2F2D]/60 text-[#0F7B6C]' },
};

// ── Props ─────────────────────────────────────────────────────────────────────
export interface LiveModeViewProps {
  vrmRef: React.MutableRefObject<VRMTutorHandle | null>;
  voiceTutor: VoiceTutorControls;
  lastResponse: ChatMessageResponse | null;
  /** Enviar un mensaje a la IA desde dentro del Modo Live */
  onSendMessage: (text: string) => void;
  facial: {
    isStreaming: boolean;
    hardwareAvailable: boolean;
    startCamera: () => void;
    stopCamera: () => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    snapshot: {
      is_active: boolean;
      valence: number;
      attention_score: number;
      arousal: number;
    };
    errorMessage: string | null;
  };
  voice: {
    isStreaming: boolean;
    snapshot: {
      is_active: boolean;
      energy_level: number;
      speech_rate_wpm: number;
    };
  };
  onExit: () => void;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LiveModeView({
  vrmRef,
  voiceTutor,
  lastResponse,
  onSendMessage,
  facial,
  voice,
  onExit,
}: LiveModeViewProps) {
  const stateKey  = lastResponse?.cognitive_state || '';
  const stateInfo = STATE_LABELS_DARK[stateKey] || { label: stateKey || 'Normal', color: 'bg-[#37352F] text-[#9B9A97]' };

  // Quiz dentro del Modo Live
  const [liveQuiz, setLiveQuiz] = useState<QuizData | null>(null);

  // Detectar quiz cuando llega nueva respuesta
  useEffect(() => {
    if (lastResponse?.message) {
      const q = parseQuizFromMessage(lastResponse.message);
      setLiveQuiz(q);
    }
  }, [lastResponse?.message]);

  // Recomendación contextual basada en estado cognitivo
  const getTip = () => {
    const r = lastResponse;
    if (!r) return null;
    if (r.cognitive_state === 'fatigue') return { icon: '😴', text: 'Detectamos fatiga. El tutor está simplificando las explicaciones.' };
    if (r.cognitive_state === 'overload') return { icon: '🧠', text: 'Hay sobrecarga cognitiva. Repasando el concepto paso a paso.' };
    if (r.cognitive_state === 'confusion' || r.cognitive_state === 'doubt') return { icon: '🤔', text: 'El tutor detectó confusión y está usando ejemplos más concretos.' };
    if (r.cognitive_state === 'mastery' || r.cognitive_state === 'mastering') return { icon: '🏆', text: '¡Excelente dominio! Aumentando la dificultad para seguir progresando.' };
    if (r.cognitive_state === 'flow') return { icon: '🌊', text: 'Estás en estado de flujo. ¡Rendimiento óptimo de aprendizaje!' };
    if ((r.engagement_score ?? 0.5) < 0.4) return { icon: '💡', text: 'El tutor está adaptando el contenido para mantener tu interés.' };
    if ((r.error_risk ?? 0) > 0.65) return { icon: '⚠️', text: 'Alto riesgo de error detectado. Reforzando con ejemplos adicionales.' };
    if (r.should_pause) return { icon: '⏸️', text: 'Recomendamos una pausa corta para consolidar el aprendizaje.' };
    return null;
  };

  const tip = getTip();

  const PATTERNS = [
    { key: 'P1', name: 'Tipeo',          active: true,                    desc: 'Velocidad y correcciones' },
    { key: 'P2', name: 'Comportamiento', active: true,                    desc: 'Pausas y patrones' },
    { key: 'P3', name: 'Facial',         active: facial.isStreaming,       desc: 'Microexpresiones' },
    { key: 'P4', name: 'Voz',            active: voice.isStreaming,        desc: 'Prosodia y energía' },
    { key: 'P5', name: 'Contexto IA',    active: !!lastResponse,           desc: 'Adaptación cognitiva' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#191919] flex flex-col">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#191919]/90 backdrop-blur border-b border-[#37352F] flex-shrink-0">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-[#9B9A97] hover:text-white transition-colors text-sm font-medium"
        >
          <X className="w-4 h-4" />
          Salir
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#E03E3E] rounded-full animate-pulse" />
          <span className="text-white font-bold text-sm tracking-widest">🎬 MODO LIVE</span>
        </div>

        <span className="text-[#787774] text-xs">NeuroLearn AI</span>
      </div>

      {/* ── Área principal ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Centro: Avatar + subtítulos */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 relative">

          {/* Avatar VRM grande */}
          <div className="w-full max-w-sm" style={{ height: '58vh' }}>
            <VRMTutor
              ref={vrmRef}
              className="w-full h-full"
              vrmPath="/tutor.vrm"
            />
          </div>

          {/* Subtítulos sincronizados */}
          <div className="w-full max-w-lg mt-3 min-h-[64px] flex items-center justify-center">
            {voiceTutor.isSpeaking && voiceTutor.lastBotText ? (
              <div className="bg-black/80 text-white text-base rounded-md px-6 py-3 text-center leading-relaxed backdrop-blur-sm border border-[#37352F]">
                <span className="mr-2 text-[#6940A5]">🔊</span>
                {voiceTutor.lastBotText}
              </div>
            ) : voiceTutor.isListening && voiceTutor.liveTranscript ? (
              <div className="bg-[#191919]/80 text-[#D9CCE9] text-sm rounded-md px-5 py-3 text-center italic backdrop-blur-sm border border-[#D9CCE9]">
                <span className="mr-2">🎤</span>
                &ldquo;{voiceTutor.liveTranscript}&rdquo;
              </div>
            ) : voiceTutor.isListening ? (
              <div className="flex items-center gap-2 text-[#6940A5] text-sm">
                <span className="w-2 h-2 bg-[#6940A5] rounded-full animate-ping" />
                <span>Escuchando… habla ahora</span>
              </div>
            ) : (
              <p className="text-[#787774] text-sm text-center">
                Mantén presionado el micrófono para hablar con tu tutor
              </p>
            )}
          </div>

          {/* Preview cámara — esquina inferior izquierda */}
          {facial.isStreaming && (
            <div className="absolute bottom-4 left-6">
              <div className="w-28 h-20 rounded-md overflow-hidden border-2 border-[#0F7B6C] bg-black">
                <VideoPreviewLive videoRef={facial.videoRef} />
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-[#E03E3E] rounded-full animate-pulse" />
                <span className="text-[10px] text-[#787774]">cámara activa</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel derecho: Patrones activos ──────────────────────────────── */}
        <div className="w-72 bg-[#191919] border-l border-[#37352F] flex flex-col p-4 gap-3 overflow-y-auto flex-shrink-0">

          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            📊 Panel en Vivo
          </h3>

          {/* Recomendación contextual IA */}
          {tip && (
            <div className="bg-[#191919]/70 border border-[#D9CCE9] rounded-md p-3">
              <div className="flex items-start gap-2">
                <span className="text-base">{tip.icon}</span>
                <p className="text-[#6940A5] text-xs leading-relaxed">{tip.text}</p>
              </div>
            </div>
          )}

          {/* Estado cognitivo */}
          <div className="bg-[#2F2D2B] rounded-md p-3">
            <p className="text-[#787774] text-xs mb-2">Estado cognitivo</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stateInfo.color}`}>
              {stateInfo.label}
            </span>
            {lastResponse?.confidence !== undefined && (
              <p className="text-[#787774] text-[10px] mt-2">
                Confianza IA: {Math.round(lastResponse.confidence * 100)}%
              </p>
            )}
          </div>

          {/* Métricas en tiempo real */}
          {lastResponse && (
            <div className="bg-[#2F2D2B] rounded-md p-3 space-y-3">
              <p className="text-[#787774] text-xs font-medium">Métricas en tiempo real</p>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[#9B9A97] text-xs">Engagement</p>
                  <span className="text-[#0B6E99] text-xs font-semibold">
                    {Math.round((lastResponse.engagement_score ?? 0.5) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#37352F] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0B6E99] rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((lastResponse.engagement_score ?? 0.5) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[#9B9A97] text-xs">Atención</p>
                  <span className="text-[#0F7B6C] text-xs font-semibold">
                    {Math.round((lastResponse.attention_level ?? 0.5) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#37352F] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0F7B6C] rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((lastResponse.attention_level ?? 0.5) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[#9B9A97] text-xs">Riesgo de error</p>
                  <span className={`text-xs font-semibold ${(lastResponse.error_risk ?? 0) > 0.5 ? 'text-[#E03E3E]' : 'text-[#0F7B6C]'}`}>
                    {Math.round((lastResponse.error_risk ?? 0) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#37352F] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${(lastResponse.error_risk ?? 0) > 0.5 ? 'bg-[#E03E3E]' : 'bg-[#0F7B6C]'}`}
                    style={{ width: `${Math.round((lastResponse.error_risk ?? 0) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Lista de patrones */}
          <div className="bg-[#2F2D2B] rounded-md p-3">
            <p className="text-[#787774] text-xs mb-3">
              Modalidades activas ({PATTERNS.filter(p => p.active).length}/5)
            </p>
            <div className="space-y-2">
              {PATTERNS.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.active ? 'bg-[#0F7B6C]' : 'bg-[#37352F]'}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs ${p.active ? 'text-[#E9E9E7]' : 'text-[#787774]'}`}>
                      {p.key} · {p.name}
                    </span>
                    {p.active && (
                      <p className="text-[10px] text-[#787774] leading-none mt-0.5">{p.desc}</p>
                    )}
                  </div>
                  {p.active && <span className="text-[#0F7B6C] text-[10px] flex-shrink-0">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Análisis facial en vivo */}
          {facial.isStreaming && facial.snapshot?.is_active && (
            <div className="bg-[#2F2D2B] rounded-md p-3">
              <p className="text-[#787774] text-xs mb-2 font-medium">Análisis facial</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#787774]">Emoción</span>
                  <span className={facial.snapshot.valence > 0.2 ? 'text-[#0F7B6C]' : facial.snapshot.valence < -0.2 ? 'text-[#E03E3E]' : 'text-[#9B9A97]'}>
                    {facial.snapshot.valence > 0.2 ? '😊 Positivo' : facial.snapshot.valence < -0.2 ? '😟 Preocupado' : '😐 Neutro'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#787774]">Atención visual</span>
                  <span className="text-[#0B6E99]">{Math.round((facial.snapshot.attention_score ?? 0) * 100)}%</span>
                </div>
                <div className="h-1 bg-[#37352F] rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-[#0B6E99] rounded-full transition-all"
                    style={{ width: `${Math.round((facial.snapshot.attention_score ?? 0) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Análisis de voz en vivo */}
          {voice.isStreaming && voice.snapshot?.is_active && (
            <div className="bg-[#2F2D2B] rounded-md p-3">
              <p className="text-[#787774] text-xs mb-2 font-medium">Análisis de voz</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#787774]">Energía</span>
                  <span className="text-[#6940A5]">
                    {(voice.snapshot.energy_level ?? 0) > 0.6 ? '🔥 Alta' : (voice.snapshot.energy_level ?? 0) > 0.3 ? '⚡ Media' : '💤 Baja'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#787774]">Velocidad</span>
                  <span className="text-[#0B6E99]">{Math.round(voice.snapshot.speech_rate_wpm ?? 0)} wpm</span>
                </div>
              </div>
            </div>
          )}

          {/* Quiz en Modo Live */}
          {liveQuiz && (
            <div>
              <QuizPanel
                quiz={liveQuiz}
                dark={true}
                onAnswer={(key, text) => {
                  setLiveQuiz(null);
                  onSendMessage(`Mi respuesta es ${key}) ${text}`);
                }}
              />
            </div>
          )}

          {/* Botón quiz rápido */}
          {!liveQuiz && lastResponse && (
            <button
              onClick={() => onSendMessage("Dame un quiz de opción múltiple (A, B, C, D) sobre lo que acabamos de ver.")}
              className="w-full py-2 rounded-md text-xs font-medium text-[#6940A5] border border-[#D9CCE9] hover:bg-[#2F2D2B]/40 transition-colors"
            >
              🧠 Quiz de verificación
            </button>
          )}
        </div>
      </div>

      {/* ── Controles inferiores ───────────────────────────────────────────── */}
      <div className="bg-[#191919] border-t border-[#37352F] px-6 py-5 flex items-center justify-center gap-8 flex-shrink-0">

        {/* Cámara (opcional) */}
        {facial.hardwareAvailable && (
          <button
            onClick={() => facial.isStreaming ? facial.stopCamera() : facial.startCamera()}
            className={`p-3 rounded-full transition-all ${
              facial.isStreaming
                ? 'bg-[#0F7B6C] text-white shadow-green-500/30 hover:bg-[#C23232]'
                : 'bg-[#2F2D2B] text-[#9B9A97] hover:bg-[#37352F] hover:text-white'
            }`}
            title={facial.isStreaming ? 'Apagar cámara' : 'Encender cámara'}
          >
            {facial.isStreaming ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </button>
        )}

        {/* PTT — Mantén para hablar */}
        <button
          onMouseDown={() => voiceTutor.startPTT()}
          onMouseUp={() => voiceTutor.stopPTT()}
          onTouchStart={(e) => { e.preventDefault(); voiceTutor.startPTT(); }}
          onTouchEnd={(e) => { e.preventDefault(); voiceTutor.stopPTT(); }}
          disabled={voiceTutor.isSpeaking}
          className={`px-8 py-4 rounded-md font-semibold text-base transition-all select-none flex items-center gap-3 ${
            voiceTutor.isListening
              ? 'bg-[#6940A5] text-white scale-105 shadow-violet-500/40 ring-4 ring-violet-500/20'
              : voiceTutor.isSpeaking
              ? 'bg-[#2F2D2B] text-[#787774] cursor-not-allowed opacity-60'
              : 'bg-[#2F2D2B] text-[#D9CCE9] hover:bg-[#5A358F] hover:scale-105'
          }`}
        >
          <Mic className={`w-5 h-5 ${voiceTutor.isListening ? 'animate-pulse' : ''}`} />
          {voiceTutor.isListening
            ? 'Escuchando…'
            : voiceTutor.isSpeaking
            ? 'Tutor hablando…'
            : 'Mantén para hablar'}
        </button>

        {/* Salir */}
        <button
          onClick={onExit}
          className="p-3 rounded-full bg-[#2F2D2B] text-[#9B9A97] hover:bg-[#2F2D2B] hover:text-[#E03E3E] transition-all"
          title="Salir del Modo Live"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
