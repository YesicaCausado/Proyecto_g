/**
 * Hook: useBehavioralMetrics
 * Captura métricas conductuales en tiempo real para los 5 patrones neuroconductuales:
 *   Patrón 1 - Ritmo de Interacción: response_time_ms, pause_before_ms, typing_speed_cpm
 *   Patrón 2 - Secuencia de Decisión: corrections (backspace count real), hesitations
 *   Patrones 3-4 - Facial/Voz: datos desde cámara/micrófono (hooks separados)
 *   Patrón 5 - Predicción de Error: calculado en backend con historial de quizzes real
 *
 * v3.0: Métricas enriquecidas — hesitaciones, burst typing, contenido del mensaje
 */
import { useRef, useCallback, useState, useEffect } from 'react';

/** Umbral para considerar que el estudiante está bloqueado (3 segundos) */
const LONG_PAUSE_MS = 3000;

export interface BehavioralMetrics {
  response_time_ms: number;   // Tiempo desde respuesta del bot hasta envío del usuario
  typing_speed_cpm: number;   // Caracteres por minuto (velocidad real de escritura)
  corrections: number;        // Backspaces/correcciones — señal de indecisión (Patrón 2)
  pause_before_ms: number;    // Pausa antes de empezar a escribir (Patrón 1)
  typing_bursts: number;      // Número de ráfagas de escritura separadas por pausas (Patrón 2)
  is_question: boolean;       // El mensaje termina en '?' — señal de duda
  message_length: number;     // Longitud del mensaje enviado
}

export interface MetricsTracker {
  onBotMessageReceived: () => void;
  onUserStartedTyping: () => void;
  onInputChange: (val: string, prev: string) => void;
  getMetrics: (finalMessage: string) => BehavioralMetrics;
  reset: () => void;
  isLongPause: boolean;
  realTimePauseMs: number;
}

export function useBehavioralMetrics(): MetricsTracker {
  const botResponseTime = useRef<number>(0);
  const typingStartTime = useRef<number>(0);
  const sendTime = useRef<number>(0);
  const corrections = useRef<number>(0);
  const hasStartedTyping = useRef<boolean>(false);
  const lastLength = useRef<number>(0);
  // Patrón 2 — burst typing: cuenta ráfagas separadas por pausas > 800ms
  const burstCount = useRef<number>(0);
  const lastKeystrokeTime = useRef<number>(0);
  const BURST_GAP_MS = 800;

  const [isLongPause, setIsLongPause] = useState(false);
  const [realTimePauseMs, setRealTimePauseMs] = useState(0);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current);
    };
  }, []);

  const startPauseTicker = useCallback(() => {
    if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current);
    pauseIntervalRef.current = setInterval(() => {
      if (botResponseTime.current === 0 || hasStartedTyping.current) {
        setIsLongPause(false);
        setRealTimePauseMs(0);
        clearInterval(pauseIntervalRef.current!);
        pauseIntervalRef.current = null;
        return;
      }
      const elapsed = Date.now() - botResponseTime.current;
      setRealTimePauseMs(elapsed);
      setIsLongPause(elapsed >= LONG_PAUSE_MS);
    }, 500);
  }, []);

  const onBotMessageReceived = useCallback(() => {
    botResponseTime.current = Date.now();
    hasStartedTyping.current = false;
    typingStartTime.current = 0;
    corrections.current = 0;
    lastLength.current = 0;
    burstCount.current = 0;
    lastKeystrokeTime.current = 0;
    setIsLongPause(false);
    setRealTimePauseMs(0);
    startPauseTicker();
  }, [startPauseTicker]);

  const onUserStartedTyping = useCallback(() => {
    const now = Date.now();
    if (!hasStartedTyping.current) {
      typingStartTime.current = now;
      hasStartedTyping.current = true;
      burstCount.current = 1;
      setIsLongPause(false);
      if (pauseIntervalRef.current) {
        clearInterval(pauseIntervalRef.current);
        pauseIntervalRef.current = null;
      }
    }
    // Detectar nueva ráfaga si hubo pausa larga entre keystrokes
    if (lastKeystrokeTime.current > 0 && now - lastKeystrokeTime.current > BURST_GAP_MS) {
      burstCount.current += 1;
    }
    lastKeystrokeTime.current = now;
  }, []);

  const onInputChange = useCallback((val: string, prev: string) => {
    if (val.length < prev.length) {
      corrections.current += prev.length - val.length;
    }
    lastLength.current = val.length;
  }, []);

  const getMetrics = useCallback((finalMessage: string): BehavioralMetrics => {
    sendTime.current = Date.now();

    const response_time_ms = botResponseTime.current > 0
      ? sendTime.current - botResponseTime.current
      : 0;

    const pause_before_ms = botResponseTime.current > 0 && typingStartTime.current > 0
      ? typingStartTime.current - botResponseTime.current
      : 0;

    const typing_duration_ms = typingStartTime.current > 0
      ? sendTime.current - typingStartTime.current
      : 1000;

    const typing_speed_cpm = finalMessage.length > 0
      ? (finalMessage.length / typing_duration_ms) * 60000
      : 0;

    return {
      response_time_ms: Math.max(0, response_time_ms),
      typing_speed_cpm: Math.min(Math.max(0, typing_speed_cpm), 1000),
      corrections: corrections.current,
      pause_before_ms: Math.max(0, pause_before_ms),
      typing_bursts: burstCount.current,
      is_question: finalMessage.trim().endsWith('?'),
      message_length: finalMessage.length,
    };
  }, []);

  const reset = useCallback(() => {
    botResponseTime.current = 0;
    typingStartTime.current = 0;
    sendTime.current = 0;
    corrections.current = 0;
    hasStartedTyping.current = false;
    lastLength.current = 0;
    burstCount.current = 0;
    lastKeystrokeTime.current = 0;
    setIsLongPause(false);
    setRealTimePauseMs(0);
    if (pauseIntervalRef.current) {
      clearInterval(pauseIntervalRef.current);
      pauseIntervalRef.current = null;
    }
  }, []);

  return {
    onBotMessageReceived,
    onUserStartedTyping,
    onInputChange,
    getMetrics,
    reset,
    isLongPause,
    realTimePauseMs,
  };
}
