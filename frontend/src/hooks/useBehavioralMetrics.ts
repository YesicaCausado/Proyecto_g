/**
 * Hook: useBehavioralMetrics
 * Captura métricas conductuales en tiempo real para los 5 patrones neuroconductuales:
 *   Patrón 1 - Ritmo de Interacción: response_time_ms, pause_before_ms
 *   Patrón 2 - Secuencia de Decisión: corrections (backspace count), depth
 *   Patrones 3-4 - Facial/Voz: placeholders (datos opcionales desde cámara/micrófono)
 *   Patrón 5 - Predicción de Error: calculado en backend con los anteriores
 *
 * Novedad Sprint 2:
 *   - isLongPause: true cuando el usuario lleva >LONG_PAUSE_MS sin escribir nada
 *   - realTimePauseMs: duración actual de la pausa (actualizado cada segundo)
 */
import { useRef, useCallback, useState, useEffect } from 'react';

/** Umbral para considerar que el estudiante está bloqueado (3 segundos) */
const LONG_PAUSE_MS = 3000;

export interface BehavioralMetrics {
  response_time_ms: number;   // Tiempo desde respuesta del bot hasta envío del usuario
  typing_speed_cpm: number;   // Caracteres por minuto
  corrections: number;        // Backspaces / correcciones
  pause_before_ms: number;    // Pausa antes de empezar a escribir
}

export interface MetricsTracker {
  onBotMessageReceived: () => void;       // Llamar cuando el bot responde
  onUserStartedTyping: () => void;        // Llamar al primer keystroke
  onInputChange: (val: string, prev: string) => void; // Trackea correcciones
  getMetrics: (finalMessage: string) => BehavioralMetrics;
  reset: () => void;
  /** true cuando el usuario lleva ≥ LONG_PAUSE_MS sin escribir tras recibir mensaje */
  isLongPause: boolean;
  /** duración de pausa actual en ms (se actualiza en tiempo real cada 500ms) */
  realTimePauseMs: number;
}

export function useBehavioralMetrics(): MetricsTracker {
  const botResponseTime = useRef<number>(0);    // Cuando el bot respondió
  const typingStartTime = useRef<number>(0);    // Primer keystroke del usuario
  const sendTime = useRef<number>(0);           // Cuando el usuario envía
  const corrections = useRef<number>(0);        // Backspaces detectados
  const hasStartedTyping = useRef<boolean>(false);
  const lastLength = useRef<number>(0);

  // Estado de pausa en tiempo real
  const [isLongPause, setIsLongPause] = useState(false);
  const [realTimePauseMs, setRealTimePauseMs] = useState(0);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ticker que actualiza la pausa cada 500ms mientras el usuario no ha escrito
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
    setIsLongPause(false);
    setRealTimePauseMs(0);
    startPauseTicker();
  }, [startPauseTicker]);

  const onUserStartedTyping = useCallback(() => {
    if (!hasStartedTyping.current) {
      typingStartTime.current = Date.now();
      hasStartedTyping.current = true;
      // Detener el ticker: el usuario ya empezó a escribir
      setIsLongPause(false);
      if (pauseIntervalRef.current) {
        clearInterval(pauseIntervalRef.current);
        pauseIntervalRef.current = null;
      }
    }
  }, []);

  const onInputChange = useCallback((val: string, prev: string) => {
    // Detecta correcciones: si el nuevo valor es más corto que el anterior
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
    };
  }, []);

  const reset = useCallback(() => {
    botResponseTime.current = 0;
    typingStartTime.current = 0;
    sendTime.current = 0;
    corrections.current = 0;
    hasStartedTyping.current = false;
    lastLength.current = 0;
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
