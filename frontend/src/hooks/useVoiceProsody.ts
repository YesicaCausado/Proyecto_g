/**
 * Hook: useVoiceProsody
 * Patrón 4 - Prosodia de Voz
 *
 * Captura audio del micrófono usando Web Audio API.
 * Sin librerías externas. Analiza:
 *  - Volumen RMS → volume_db
 *  - Distribución de frecuencias FFT → pitch_mean_hz (centroide espectral)
 *  - Energía total → energy_level
 *  - Temblor de voz → varianza de amplitud (voice_tremor)
 *  - Silencio acumulado → silence_duration_ms
 *  - Velocidad de habla estimada → speech_rate_wpm (por eventos de actividad)
 *  - Palabras de relleno → heurístico sin STT: cuenta short low-pitch utterances
 *    (filled pauses tipo "eh"/"um") rodeadas de silencio. Es una ESTIMACIÓN,
 *    no un conteo literal de palabras.
 *
 * Unidades reales: volume_db en dBFS (−60..0); pitch_mean_hz es el centroide
 * espectral (proxy de tono, NO frecuencia fundamental).
 *
 * Agregado por turno (auditoría): `beginTurn()` al llegar la respuesta del
 * tutor y `getTurnSummary()` al enviar. El resumen promedia SOLO los frames con
 * voz y solo es válido con ≥ MIN_VOICED_MS de voz; si no, el estado es
 * 'insufficient' y no se envían valores (antes se enviaba el valor instantáneo
 * del momento del envío aunque el estudiante no hubiera hablado).
 * El audio nunca sale del navegador: solo se envían estos números.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

export interface VoiceSnapshot {
  pitch_mean_hz: number;       // Hz estimado (centroide espectral)
  volume_db: number;           // dB RMS
  speech_rate_wpm: number;     // palabras/min estimadas
  voice_tremor: number;        // 0-1: varianza de amplitud normalizada
  energy_level: number;        // 0-1: energía espectral normalizada
  filler_words_count: number;  // estimación heurística de muletillas (sin STT)
  silence_duration_ms: number; // ms de silencio acumulado en ventana
  is_active: boolean;          // hay voz en este momento
}

export interface VoiceTurnData {
  voiced_ms: number;
  window_ms: number;
  pitch_mean_hz: number | null;
  volume_db: number | null;
  speech_rate_wpm: number | null;
  voice_tremor: number | null;
  energy_level: number | null;
  filler_words_count: number;
  silence_duration_ms: number;
  pause_ratio: number;
  pause_count: number;
}

export type VoiceSensorState = 'active' | 'off' | 'denied' | 'unavailable' | 'insufficient' | 'error';

export interface VoiceTurnSummary {
  status: VoiceSensorState;
  data: VoiceTurnData | null;
}

export interface VoiceProsodyControls {
  snapshot: VoiceSnapshot;
  beginTurn: () => void;
  getTurnSummary: () => VoiceTurnSummary;
  isStreaming: boolean;
  permissionDenied: boolean;
  errorMessage: string | null;
  hardwareAvailable: boolean;        // false si el dispositivo no tiene micrófono
  startMic: () => Promise<void>;
  stopMic: () => void;
  resetError: () => void;
}

const DEFAULT_SNAPSHOT: VoiceSnapshot = {
  pitch_mean_hz: 0, volume_db: 0, speech_rate_wpm: 0,
  voice_tremor: 0, energy_level: 0, filler_words_count: 0,
  silence_duration_ms: 0, is_active: false,
};

const FFT_SIZE = 2048;
const ANALYSIS_INTERVAL_MS = 150; // actualizar ~7 veces/seg
const SILENCE_THRESHOLD = 0.01;   // RMS por debajo = silencio
const SPEECH_WINDOW_MS = 5000;    // ventana para speech rate

// ── Detección heurística de muletillas ("eh"/"um") ──
// Un "filled pause" es un segmento de voz MUY corto (entre UTT_MIN y UTT_MAX ms)
// rodeado de silencio. Sin reconocimiento de voz no podemos distinguir la
// palabra exacta, pero la duración de la emisión + su baja energía distinguen
// una muletilla de una palabra con contenido. Es una ESTIMACIÓN honesta: se
// etiqueta como "heurístico", no como conteo de palabras real.
const UTT_MIN_MS = 60;      // descarta chasquidos/ruidos de micrófono
const UTT_MAX_MS = 450;     // una palabra con contenido suele superar esto
const FILLER_PITCH_HZ = 220; // energía espectral baja → sonido vocálico sostenido
const FILLER_WINDOW_MS = 15000; // ventana acumulada (reinicio al arrancar)
const MAX_CONSEC_FILLERS = 8;    // techo para no inflar el conteo por ruido
/** Voz mínima en el turno para una muestra válida (igual que el backend) */
export const MIN_VOICED_MS = 1000;
/** Silencio mínimo entre emisiones para contarlo como pausa */
const PAUSE_MIN_MS = 250;

interface TurnAcc {
  start: number; voicedMs: number; frames: number; voicedFrames: number;
  dbSum: number; centroidSum: number; energySum: number; tremorSum: number;
  onsets: number; fillers: number; pauses: number; silenceRun: number;
}
const newTurn = (): TurnAcc => ({
  start: Date.now(), voicedMs: 0, frames: 0, voicedFrames: 0, dbSum: 0,
  centroidSum: 0, energySum: 0, tremorSum: 0, onsets: 0, fillers: 0, pauses: 0, silenceRun: 0,
});

export function useVoiceProsody(): VoiceProsodyControls {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Historial para calcular tremor y speech rate
  const rmsHistory = useRef<number[]>([]);
  const activityLog = useRef<number[]>([]); // timestamps de actividad de voz
  const silenceAccumRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const wasActiveRef = useRef<boolean>(false);

  // ── Estado para detección de muletillas (filled pauses) ──
  const utteranceStartRef = useRef<number>(0);       // inicio de la emisión actual
  const lastUtterPitchRef = useRef<number>(0);       // pitch de la última emisión
  const fillerLogRef = useRef<number[]>([]);         // timestamps de muletillas detectadas
  const consecFillerRef = useRef<number>(0);         // racha de muletillas (anti-ruido)

  const turnRef = useRef<TurnAcc>(newTurn());

  const [snapshot, setSnapshot] = useState<VoiceSnapshot>(DEFAULT_SNAPSHOT);
  const [isStreaming, setIsStreaming] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hardwareAvailable, setHardwareAvailable] = useState(true);

  const resetError = useCallback(() => {
    setPermissionDenied(false);
    setErrorMessage(null);
  }, []);

  const analyzeAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLen = analyser.frequencyBinCount; // FFT_SIZE / 2
    const timeData = new Float32Array(FFT_SIZE);
    const freqData = new Uint8Array(bufferLen);
    analyser.getFloatTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    // --- RMS (volumen) ---
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) sumSq += timeData[i] * timeData[i];
    const rms = Math.sqrt(sumSq / timeData.length);
    const volume_db = rms > 0 ? Math.max(-60, 20 * Math.log10(rms)) : -60;

    // --- Silencio ---
    const now = Date.now();
    const dt = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const isVoiceActive = rms > SILENCE_THRESHOLD;

    if (!isVoiceActive) {
      silenceAccumRef.current += dt;
    } else {
      silenceAccumRef.current = Math.max(0, silenceAccumRef.current - dt * 0.5);
    }

    // --- Actividad de voz para speech rate ---
    if (isVoiceActive && !wasActiveRef.current) {
      // onset de voz
      activityLog.current.push(now);
    }

    // limpiar actividad vieja
    const cutoff = now - SPEECH_WINDOW_MS;
    activityLog.current = activityLog.current.filter((t) => t > cutoff);
    // estimación: cada onset ≈ una sílaba; ~1.5 sílabas/palabra
    const onsets = activityLog.current.length;
    const windowSec = SPEECH_WINDOW_MS / 1000;
    const syllablesPerSec = onsets / windowSec;
    const speech_rate_wpm = Math.min(syllablesPerSec * 60 / 1.5, 250);

    // --- Centroide espectral (pitch proxy) ---
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const nyquist = sampleRate / 2;
    let weightedSum = 0; let totalPower = 0;
    for (let i = 0; i < bufferLen; i++) {
      const freq = (i / bufferLen) * nyquist;
      const power = freqData[i] / 255;
      weightedSum += freq * power;
      totalPower += power;
    }
    const pitch_mean_hz = totalPower > 0 ? Math.min(weightedSum / totalPower, 4000) : 0;

    // --- Detección de muletillas (filled pauses) ---
    // Seguimos las transiciones de voz activa→silencio: cuando termina una
    // emisión de voz, evaluamos su duración y pitch para decidir si fue una
    // muletilla ("eh"/"um") o una palabra con contenido.
    if (isVoiceActive && !wasActiveRef.current) {
      // onset de la emisión
      utteranceStartRef.current = now;
      lastUtterPitchRef.current = pitch_mean_hz > 0 ? pitch_mean_hz : 0;
    } else if (!isVoiceActive && wasActiveRef.current) {
      // offset de la emisión → evaluar duración
      const dur = now - utteranceStartRef.current;
      if (dur >= UTT_MIN_MS && dur <= UTT_MAX_MS) {
        // Emisión corta. Si además tiene pitch bajo (sonido vocálico sostenido),
        // la tratamos como muletilla. Un techo anti-ruido evita inflar el conteo.
        const isFillerPitch = lastUtterPitchRef.current > 0 && lastUtterPitchRef.current <= FILLER_PITCH_HZ;
        if (isFillerPitch && consecFillerRef.current < MAX_CONSEC_FILLERS) {
          fillerLogRef.current.push(now);
          consecFillerRef.current += 1;
          turnRef.current.fillers += 1;
        }
      } else if (dur > UTT_MAX_MS) {
        // Emisión larga → palabra con contenido, reinicia la racha anti-ruido.
        consecFillerRef.current = 0;
      }
      utteranceStartRef.current = 0;
      lastUtterPitchRef.current = 0;
    }
    wasActiveRef.current = isVoiceActive;

    // limpiar muletillas viejas (ventana de 15 s)
    const fillerCutoff = now - FILLER_WINDOW_MS;
    fillerLogRef.current = fillerLogRef.current.filter((t) => t > fillerCutoff);
    const filler_words_count = fillerLogRef.current.length;

    // --- Energía (suma normalizada de frecuencias relevantes 80-4000 Hz) ---
    const minBin = Math.floor(80 / (nyquist / bufferLen));
    const maxBin = Math.floor(4000 / (nyquist / bufferLen));
    let energySum = 0;
    for (let i = minBin; i < Math.min(maxBin, bufferLen); i++) {
      energySum += freqData[i] / 255;
    }
    const energy_level = Math.min(energySum / Math.max(maxBin - minBin, 1), 1);

    // --- Tremor (varianza de RMS en ventana de 20 muestras) ---
    rmsHistory.current.push(rms);
    if (rmsHistory.current.length > 20) rmsHistory.current.shift();
    const mean = rmsHistory.current.reduce((a, b) => a + b, 0) / rmsHistory.current.length;
    const variance = rmsHistory.current.reduce((s, v) => s + (v - mean) ** 2, 0) / rmsHistory.current.length;
    const voice_tremor = Math.min(Math.sqrt(variance) * 20, 1);

    // --- Agregado del turno (solo frames con voz) ---
    const t = turnRef.current;
    t.frames += 1;
    if (isVoiceActive) {
      if (t.silenceRun >= PAUSE_MIN_MS && t.voicedFrames > 0) t.pauses += 1;
      if (t.silenceRun > 0 || t.voicedFrames === 0) t.onsets += 1;
      t.silenceRun = 0;
      t.voicedMs += dt;
      t.voicedFrames += 1;
      t.dbSum += volume_db;
      t.centroidSum += pitch_mean_hz;
      t.energySum += energy_level;
      t.tremorSum += voice_tremor;
    } else {
      t.silenceRun += dt;
    }

    setSnapshot({
      pitch_mean_hz: parseFloat(pitch_mean_hz.toFixed(1)),
      volume_db: parseFloat(volume_db.toFixed(1)),
      speech_rate_wpm: parseFloat(speech_rate_wpm.toFixed(1)),
      voice_tremor: parseFloat(voice_tremor.toFixed(3)),
      energy_level: parseFloat(energy_level.toFixed(3)),
      filler_words_count: filler_words_count,
      silence_duration_ms: Math.round(silenceAccumRef.current),
      is_active: isVoiceActive,
    });
  }, []);

  const beginTurn = useCallback(() => {
    turnRef.current = newTurn();
  }, []);

  const getTurnSummary = useCallback((): VoiceTurnSummary => {
    if (!isStreaming || !analyserRef.current) {
      const status: VoiceSensorState = permissionDenied ? 'denied'
        : !hardwareAvailable ? 'unavailable'
        : errorMessage ? 'error' : 'off';
      return { status, data: null };
    }
    const t = turnRef.current;
    if (t.voicedMs < MIN_VOICED_MS || t.voicedFrames === 0) return { status: 'insufficient', data: null };
    const windowMs = Math.max(Date.now() - t.start, t.voicedMs);
    const n = t.voicedFrames;
    const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
    return {
      status: 'active',
      data: {
        voiced_ms: Math.round(t.voicedMs),
        window_ms: Math.round(windowMs),
        pitch_mean_hz: round(t.centroidSum / n),
        volume_db: round(Math.max(-100, Math.min(0, t.dbSum / n))),
        // ~1,5 sílabas (inicios de voz) por palabra, sobre el tiempo con voz
        speech_rate_wpm: round(Math.min((t.onsets / 1.5) / (t.voicedMs / 60000), 400)),
        voice_tremor: round(t.tremorSum / n, 3),
        energy_level: round(t.energySum / n, 3),
        filler_words_count: t.fillers,
        silence_duration_ms: Math.round(windowMs - t.voicedMs),
        pause_ratio: round(1 - t.voicedMs / windowMs, 3),
        pause_count: t.pauses,
      },
    };
  }, [isStreaming, permissionDenied, hardwareAvailable, errorMessage]);

  const startMic = useCallback(async () => {
    if (streamRef.current) return; // evita capturas duplicadas
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setHardwareAvailable(false);
        throw new Error('El navegador no permite acceder al micrófono.');
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some((d) => d.kind === 'audioinput');
      if (!hasMic) {
        setHardwareAvailable(false);
        throw new DOMException('No se encontró ningún micrófono.', 'NotFoundError');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      silenceAccumRef.current = 0;
      lastFrameTimeRef.current = Date.now();
      activityLog.current = [];
      rmsHistory.current = [];

      turnRef.current = newTurn();
      intervalRef.current = setInterval(analyzeAudio, ANALYSIS_INTERVAL_MS);
      setIsStreaming(true);
      setPermissionDenied(false);
      setErrorMessage(null);
    } catch (err: unknown) {
      // Liberar lo que se haya alcanzado a abrir: no dejar el micrófono activo.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close().catch(() => { /* noop */ });
      audioCtxRef.current = null;
      analyserRef.current = null;
      const error = err as { name?: string; message?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setErrorMessage('Permiso de micrófono denegado. Haz clic en el candado de la barra de dirección y permite el micrófono.');
      } else if (error?.name === 'NotFoundError') {
        setHardwareAvailable(false);
        setErrorMessage('No se encontró ningún micrófono en este dispositivo.');
      } else if (error?.name === 'NotReadableError') {
        setErrorMessage('El micrófono está siendo usado por otra aplicación. Ciérrala e intenta de nuevo.');
      } else {
        setErrorMessage(`Error al activar micrófono: ${error?.message || 'desconocido'}`);
      }
      console.warn('Micrófono no disponible:', err);
    }
  }, [analyzeAudio]);

  const stopMic = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => { /* ya cerrado */ });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    sourceRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    intervalRef.current = null;
    rmsHistory.current = [];
    activityLog.current = [];
    fillerLogRef.current = [];
    utteranceStartRef.current = 0;
    lastUtterPitchRef.current = 0;
    consecFillerRef.current = 0;
    turnRef.current = newTurn();

    setIsStreaming(false);
    setSnapshot(DEFAULT_SNAPSHOT);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sourceRef.current?.disconnect();
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { snapshot, beginTurn, getTurnSummary, isStreaming, permissionDenied, errorMessage, hardwareAvailable, startMic, stopMic, resetError };
}
