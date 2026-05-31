/**
 * Hook: useFacialDetection
 * Patron 3 - Microexpresion Facial
 *
 * Crea el elemento <video> programaticamente para garantizar que
 * el stream siempre tenga un elemento de reproduccion listo,
 * independientemente del ciclo de render de React.
 *
 * Tecnologia: MediaStream API + Canvas API (sin librerias externas)
 */
import { useRef, useState, useCallback, useEffect } from 'react';

export interface FacialSnapshot {
  attention_score: number;
  valence: number;
  arousal: number;
  blink_rate: number;
  gaze_direction: string;
  brow_furrow: number;
  smile_intensity: number;
  motion_level: number;
  is_active: boolean;
}

export interface FacialDetectionControls {
  snapshot: FacialSnapshot;
  isStreaming: boolean;
  permissionDenied: boolean;
  errorMessage: string | null;
  hardwareAvailable: boolean;        // false si el dispositivo no tiene cámara
  videoRef: React.RefObject<HTMLVideoElement | null>;  // para mostrar el preview
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  resetError: () => void;
}

const DEFAULT_SNAPSHOT: FacialSnapshot = {
  attention_score: 0, valence: 0, arousal: 0,
  blink_rate: 0, gaze_direction: 'screen',
  brow_furrow: 0, smile_intensity: 0, motion_level: 0,
  is_active: false,
};

export function useFacialDetection(): FacialDetectionControls {
  // Video creado una sola vez, fuera del DOM de React
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const animRef     = useRef<number>(0);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const blinkBuf    = useRef<number[]>([]);
  const startTimeRef = useRef(0);
  const runningRef  = useRef(false);

  const [snapshot, setSnapshot] = useState<FacialSnapshot>(DEFAULT_SNAPSHOT);
  const [isStreaming, setIsStreaming] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hardwareAvailable, setHardwareAvailable] = useState(true);

  const resetError = useCallback(() => {
    setPermissionDenied(false);
    setErrorMessage(null);
  }, []);

  // Detectar si hay cámara disponible al montar el hook
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setHardwareAvailable(false);
      return;
    }
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const hasCamera = devices.some((d) => d.kind === 'videoinput');
      setHardwareAvailable(hasCamera);
      if (!hasCamera) setErrorMessage('Este dispositivo no tiene cámara disponible.');
    }).catch(() => setHardwareAvailable(false));
  }, []);

  // Crear el elemento video una sola vez
  if (!videoRef.current) {
    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.muted = true;
    v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-1px;left:-1px;';
    document.body.appendChild(v);
    videoRef.current = v;
  }
  if (!canvasRef.current) {
    canvasRef.current = document.createElement('canvas');
  }

  const analyzeFrame = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current!;

    if (video.readyState < 2 || video.videoWidth === 0) {
      animRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const canvas = canvasRef.current!;
    const W = 64; const H = 48;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    // Luminancia por cuadrante
    const zones = [0, 0, 0, 0];
    const cnt   = [0, 0, 0, 0];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const l = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const z = (y < H/2 ? 0 : 2) + (x < W/2 ? 0 : 1);
        zones[z] += l; cnt[z]++;
      }
    }
    const avg = zones.map((s, i) => s / Math.max(cnt[i], 1));
    const totalLum = (avg[0] + avg[1] + avg[2] + avg[3]) / 4;

    // Movimiento frame a frame
    let motionSum = 0;
    if (prevFrameRef.current?.length === data.length) {
      for (let i = 0; i < data.length; i += 4)
        motionSum += Math.abs(data[i] - prevFrameRef.current[i])
                   + Math.abs(data[i+1] - prevFrameRef.current[i+1])
                   + Math.abs(data[i+2] - prevFrameRef.current[i+2]);
    }
    prevFrameRef.current = new Uint8ClampedArray(data);
    const motion = Math.min(motionSum / (W * H * 3 * 255), 1);

    // Parpadeo (caida de luminancia zona ojos)
    const eyeLum = (avg[0] + avg[1]) / 2;
    blinkBuf.current.push(eyeLum);
    if (blinkBuf.current.length > 90) blinkBuf.current.shift();
    let blinks = 0;
    for (let i = 1; i < blinkBuf.current.length; i++)
      if (blinkBuf.current[i-1] - blinkBuf.current[i] > 15) blinks++;
    const elapsed = (Date.now() - startTimeRef.current) / 60000;
    const blink_rate = elapsed > 0 ? Math.min(blinks / elapsed, 40) : 15;

    const hasFace = totalLum > 8 && totalLum < 248; // umbral amplio — solo excluye negro/blanco total
    const isStable = motion < 0.15;
    const attention_score = hasFace ? (isStable ? 0.85 : Math.max(0.4, 0.85 - motion)) : 0.3;

    // Centroide de luminancia -> gaze
    let sx = 0, sy = 0, sw = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const l = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        sx += x*l; sy += y*l; sw += l;
      }
    const cx = sw > 0 ? sx/sw : W/2;
    const cy2 = sw > 0 ? sy/sw : H/2;
    const dx = (cx - W/2) / (W/2);
    const dy2 = (cy2 - H/2) / (H/2);
    let gaze = 'screen';
    if (!hasFace)          gaze = 'away';
    else if (Math.abs(dx) > 0.3) gaze = dx > 0 ? 'away' : 'screen';
    else if (dy2 > 0.25)   gaze = 'down';
    else if (dy2 < -0.25)  gaze = 'up';

    const smileLum = (avg[2] + avg[3]) / 2;
    const smile_intensity = hasFace ? Math.min(Math.max((smileLum - totalLum * 0.9) / 30, 0), 1) : 0;
    const valence = hasFace ? Math.min(Math.max((smileLum - (avg[0]+avg[1])/2) / 40, -1), 1) : 0;
    const brow_furrow = Math.min(Math.abs(avg[0] - avg[1]) / 50, 1);
    const arousal = Math.min(motion * 4, 1);

    setSnapshot({
      attention_score: +attention_score.toFixed(3),
      valence:         +valence.toFixed(3),
      arousal:         +arousal.toFixed(3),
      blink_rate:      +blink_rate.toFixed(1),
      gaze_direction:  gaze,
      brow_furrow:     +brow_furrow.toFixed(3),
      smile_intensity: +smile_intensity.toFixed(3),
      motion_level:    +motion.toFixed(3),
      is_active:       true, // activo siempre que el video sea legible (readyState >= 2)
    });

    // ~10 fps
    setTimeout(() => {
      if (runningRef.current)
        animRef.current = requestAnimationFrame(analyzeFrame);
    }, 100);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      runningRef.current = true;
      blinkBuf.current = [];
      prevFrameRef.current = null;
      startTimeRef.current = Date.now();

      const video = videoRef.current!;
      video.srcObject = stream;
      // oncanplay garantiza que el video esta listo antes de leer frames
      await new Promise<void>((resolve, reject) => {
        video.oncanplay = () => resolve();
        video.onerror  = reject;
        video.play().catch(reject);
      });

      setIsStreaming(true);
      setPermissionDenied(false);
      animRef.current = requestAnimationFrame(analyzeFrame);
    } catch (err: unknown) {
      runningRef.current = false;
      const e = err as { name?: string; message?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setErrorMessage('Permiso de cámara denegado. Haz clic en el candado de la barra de dirección y permite la cámara.');
        console.warn('[FacialDetection] Permiso de camara denegado');
      } else if (e?.name === 'NotFoundError') {
        setErrorMessage('No se encontró ninguna cámara en este dispositivo.');
        console.warn('[FacialDetection] Cámara no encontrada');
      } else if (e?.name === 'NotReadableError') {
        setErrorMessage('La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.');
        console.warn('[FacialDetection] Cámara en uso');
      } else {
        setErrorMessage(`Error al activar cámara: ${e?.message || 'desconocido'}`);
        console.warn('[FacialDetection] Error:', err);
      }
    }
  }, [analyzeFrame]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    prevFrameRef.current = null;
    blinkBuf.current = [];
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.oncanplay = null;
    }
    setIsStreaming(false);
    setSnapshot(DEFAULT_SNAPSHOT);
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      // Limpiar el elemento del DOM al desmontar
      if (videoRef.current && document.body.contains(videoRef.current)) {
        document.body.removeChild(videoRef.current);
        videoRef.current = null;
      }
    };
  }, []);

  return { snapshot, isStreaming, permissionDenied, errorMessage, hardwareAvailable, videoRef, startCamera, stopCamera, resetError };
}