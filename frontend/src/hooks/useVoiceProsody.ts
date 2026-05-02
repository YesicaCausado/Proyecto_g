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
 *  - Palabras de relleno → no detectables sin STT; valor fijo=0
 */
import { useRef, useState, useCallback, useEffect } from 'react';

export interface VoiceSnapshot {
  pitch_mean_hz: number;       // Hz estimado (centroide espectral)
  volume_db: number;           // dB RMS
  speech_rate_wpm: number;     // palabras/min estimadas
  voice_tremor: number;        // 0-1: varianza de amplitud normalizada
  energy_level: number;        // 0-1: energía espectral normalizada
  filler_words_count: number;  // 0 (sin STT)
  silence_duration_ms: number; // ms de silencio acumulado en ventana
  is_active: boolean;          // hay voz en este momento
}

export interface VoiceProsodyControls {
  snapshot: VoiceSnapshot;
  isStreaming: boolean;
  permissionDenied: boolean;
  startMic: () => Promise<void>;
  stopMic: () => void;
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

  const [snapshot, setSnapshot] = useState<VoiceSnapshot>(DEFAULT_SNAPSHOT);
  const [isStreaming, setIsStreaming] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

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
    wasActiveRef.current = isVoiceActive;

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

    setSnapshot({
      pitch_mean_hz: parseFloat(pitch_mean_hz.toFixed(1)),
      volume_db: parseFloat(volume_db.toFixed(1)),
      speech_rate_wpm: parseFloat(speech_rate_wpm.toFixed(1)),
      voice_tremor: parseFloat(voice_tremor.toFixed(3)),
      energy_level: parseFloat(energy_level.toFixed(3)),
      filler_words_count: 0,
      silence_duration_ms: Math.round(silenceAccumRef.current),
      is_active: isVoiceActive,
    });
  }, []);

  const startMic = useCallback(async () => {
    try {
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

      intervalRef.current = setInterval(analyzeAudio, ANALYSIS_INTERVAL_MS);
      setIsStreaming(true);
      setPermissionDenied(false);
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      console.warn('Micrófono no disponible:', err);
    }
  }, [analyzeAudio]);

  const stopMic = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    sourceRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    intervalRef.current = null;
    rmsHistory.current = [];
    activityLog.current = [];

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

  return { snapshot, isStreaming, permissionDenied, startMic, stopMic };
}
