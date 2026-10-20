/**
 * Hook: useBehavioralMetrics — Patrón de teclado
 *
 * Mide, para cada turno del chat (desde la respuesta del tutor hasta el envío):
 *   - response_time_ms: tiempo hasta el envío
 *   - pause_before_ms:  tiempo hasta la primera pulsación
 *   - typing_speed_cpm: caracteres escritos / minuto entre la primera
 *                        pulsación y el envío
 *   - corrections:      caracteres borrados (no son errores ortográficos)
 *   - typing_bursts:    ráfagas separadas por pausas > 800 ms
 *   - keystrokes:       cambios de texto producidos al escribir
 *
 * Privacidad: solo se guardan tiempos y conteos, nunca el texto tecleado.
 *
 * Reglas de medición (auditoría): si el texto se dictó por voz o se pegó, no
 * hay ritmo de escritura: las métricas de teclado son null (no 0). Antes se
 * asumía 1 s de escritura y un dictado de 50 caracteres aparecía como
 * 1000 cpm. Tampoco se devuelve un tiempo de respuesta sin una respuesta del
 * tutor que marque el inicio del turno.
 */
import { useRef, useCallback, useState, useEffect } from 'react';

/** Umbral para considerar que el estudiante está bloqueado (3 segundos) */
const LONG_PAUSE_MS = 3000;
const BURST_GAP_MS = 800;
/** Escritura mínima para calcular una velocidad fiable */
const MIN_TYPING_MS = 300;

export type InputMode = 'typed' | 'voice' | 'pasted';

export interface BehavioralMetrics {
  input_mode: InputMode;
  response_time_ms: number | null;
  typing_speed_cpm: number | null;
  corrections: number | null;
  pause_before_ms: number | null;
  typing_bursts: number | null;
  keystrokes: number;
  is_question: boolean;
  message_length: number;
}

export interface MetricsTracker {
  onBotMessageReceived: () => void;
  /** Llamar en cada cambio del campo con el valor nuevo y el ANTERIOR real */
  onInputChange: (val: string, prev: string) => void;
  onPaste: (pastedLength: number) => void;
  markVoiceInput: () => void;
  getMetrics: (finalMessage: string) => BehavioralMetrics;
  reset: () => void;
  isLongPause: boolean;
  realTimePauseMs: number;
}

export function useBehavioralMetrics(): MetricsTracker {
  const botResponseTime = useRef<number>(0);
  const typingStartTime = useRef<number>(0);
  const lastKeystrokeTime = useRef<number>(0);
  const corrections = useRef<number>(0);
  const typedChars = useRef<number>(0);
  const keystrokes = useRef<number>(0);
  const burstCount = useRef<number>(0);
  const pastedChars = useRef<number>(0);
  const voiceInput = useRef<boolean>(false);

  const [isLongPause, setIsLongPause] = useState(false);
  const [realTimePauseMs, setRealTimePauseMs] = useState(0);
  const pauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = useCallback(() => {
    if (pauseIntervalRef.current) clearInterval(pauseIntervalRef.current);
    pauseIntervalRef.current = null;
  }, []);

  useEffect(() => stopTicker, [stopTicker]);

  const resetTurn = useCallback(() => {
    typingStartTime.current = 0;
    lastKeystrokeTime.current = 0;
    corrections.current = 0;
    typedChars.current = 0;
    keystrokes.current = 0;
    burstCount.current = 0;
    pastedChars.current = 0;
    voiceInput.current = false;
    setIsLongPause(false);
    setRealTimePauseMs(0);
  }, []);

  const startPauseTicker = useCallback(() => {
    stopTicker();
    pauseIntervalRef.current = setInterval(() => {
      if (botResponseTime.current === 0 || typingStartTime.current > 0) {
        setIsLongPause(false);
        setRealTimePauseMs(0);
        stopTicker();
        return;
      }
      const elapsed = Date.now() - botResponseTime.current;
      setRealTimePauseMs(elapsed);
      setIsLongPause(elapsed >= LONG_PAUSE_MS);
    }, 500);
  }, [stopTicker]);

  const onBotMessageReceived = useCallback(() => {
    botResponseTime.current = Date.now();
    resetTurn();
    startPauseTicker();
  }, [resetTurn, startPauseTicker]);

  const onInputChange = useCallback((val: string, prev: string) => {
    const now = Date.now();
    const delta = val.length - prev.length;
    if (delta < 0) {
      corrections.current += -delta;
    } else if (delta > 0 && delta <= 2) {
      // 1–2 caracteres por evento = escritura (más es pegado o autocompletado)
      typedChars.current += delta;
    } else if (delta === 0) {
      return;
    }
    keystrokes.current += 1;
    if (typingStartTime.current === 0) {
      typingStartTime.current = now;
      burstCount.current = 1;
      setIsLongPause(false);
      stopTicker();
    } else if (now - lastKeystrokeTime.current > BURST_GAP_MS) {
      burstCount.current += 1;
    }
    lastKeystrokeTime.current = now;
  }, [stopTicker]);

  const onPaste = useCallback((pastedLength: number) => {
    pastedChars.current += Math.max(0, pastedLength);
  }, []);

  const markVoiceInput = useCallback(() => {
    voiceInput.current = true;
  }, []);

  const getMetrics = useCallback((finalMessage: string): BehavioralMetrics => {
    const sendTime = Date.now();
    const len = finalMessage.length;
    const turnStarted = botResponseTime.current > 0;

    let input_mode: InputMode = 'typed';
    if (voiceInput.current && typedChars.current === 0) input_mode = 'voice';
    else if (pastedChars.current > 0 && pastedChars.current >= typedChars.current) input_mode = 'pasted';

    const response_time_ms = turnStarted ? Math.max(0, sendTime - botResponseTime.current) : null;

    const typed = input_mode === 'typed' && keystrokes.current > 0 && typingStartTime.current > 0;
    const typingDuration = typed ? sendTime - typingStartTime.current : 0;
    const typing_speed_cpm = typed && typingDuration >= MIN_TYPING_MS && typedChars.current > 0
      ? Math.round((typedChars.current / typingDuration) * 60000 * 10) / 10
      : null;
    const pause_before_ms = typed && turnStarted
      ? Math.max(0, typingStartTime.current - botResponseTime.current)
      : null;

    return {
      input_mode,
      response_time_ms,
      typing_speed_cpm,
      corrections: typed ? corrections.current : null,
      pause_before_ms,
      typing_bursts: typed ? burstCount.current : null,
      keystrokes: keystrokes.current,
      is_question: finalMessage.trim().endsWith('?'),
      message_length: len,
    };
  }, []);

  const reset = useCallback(() => {
    botResponseTime.current = 0;
    resetTurn();
    stopTicker();
  }, [resetTurn, stopTicker]);

  return {
    onBotMessageReceived,
    onInputChange,
    onPaste,
    markVoiceInput,
    getMetrics,
    reset,
    isLongPause,
    realTimePauseMs,
  };
}
