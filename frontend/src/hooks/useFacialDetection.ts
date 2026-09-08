/**
 * Hook: useFacialDetection
 * Patron 3 - Microexpresion Facial
 *
 * Deteccion facial REAL basada en MediaPipe Face Landmarker
 * (modelo FaceMesh, 478 landmarks + blendshapes ARKit).
 * Sustituye a la antigua heuristica de luminancia por analisis real de:
 *  - Mirada (posicion de iris + centroide del rostro)
 *  - Emocion / valencia (blendshape mouthSmile + mouthFrown + browDown)
 *  - Ceno fruncido (browDown)
 *  - Parpadeo (Eye Aspect Ratio -> evto de cierre/aperura)
 *  - Movimiento (desplazamiento medio de landmarks entre frames)
 *  - Atencion visual (rostro presente + mirada a pantalla + estabilidad)
 *
 * Assets servidos localmente en /mediapipe (wasm + modelo face_landmarker.task).
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

// Rutas servidas desde public/ (ver vite.config / public/mediapipe)
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/face_landmarker.task';

type Landmark = { x: number; y: number; z?: number };
type LandmarkerLike = {
  detectForVideo(video: HTMLVideoElement, ts: number): any;
  close(): void;
};

// Indices MediaPipe FaceMesh (478)
const IDX = {
  // esquinas / parpados del ojo izquierdo y derecho
  lOuter: 33,  lInner: 133, lUp1: 159, lUp2: 158, lLo1: 145, lLo2: 153,
  rOuter: 362, rInner: 263, rUp1: 386, rUp2: 385, rLo1: 374, rLo2: 380,
  lIris: 468,  rIris: 473,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

export function useFacialDetection(): FacialDetectionControls {
  // Video creado una sola vez, fuera del DOM de React (para preview)
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<LandmarkerLike | null>(null);
  const animRef     = useRef<number>(0);
  const runningRef  = useRef(false);
  const startTimeRef = useRef(0);
  // estado para movimiento entre frames
  const prevLmRef   = useRef<Landmark[] | null>(null);
  // estado para parpadeos (deteccion de transicion cerrado->abierto)
  const blinkLogRef = useRef<number[]>([]);
  const wasClosedRef = useRef<boolean | null>(null);

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

  // ── Carga perezosa del modelo MediaPipe (GPU -> CPU por fallback) ──
  const ensureLandmarker = useCallback(async (): Promise<LandmarkerLike> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    let lastErr: unknown;
    for (const delegate of ['GPU', 'CPU'] as const) {
      try {
        const lm: LandmarkerLike = await FaceLandmarker.createFromOptions(fileset as never, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });
        landmarkerRef.current = lm;
        return lm;
      } catch (e) {
        lastErr = e;
        if (delegate === 'GPU') {
          console.warn('[FacialDetection] Delegado GPU fallo, uso CPU:', e);
        }
      }
    }
    throw lastErr;
  }, []);

  const analyzeFrame = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current!;
    const landmarker = landmarkerRef.current;

    if (!landmarker || video.readyState < 2 || video.videoWidth === 0) {
      animRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    let result: { faceLandmarks?: Landmark[][]; faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] };
    try {
      result = landmarker.detectForVideo(video, performance.now()) as never;
    } catch (e) {
      console.warn('[FacialDetection] detectForVideo:', e);
      animRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const face = result.faceLandmarks?.[0] ?? null;
    const hasFace = !!face;

    // Blendshapes ARKit (score 0..1 por expresion)
    const bs: Record<string, number> = {};
    const cats = result.faceBlendshapes?.[0]?.categories;
    if (cats) for (const c of cats) bs[c.categoryName] = c.score;

    const now = Date.now();
    let valence = 0, arousal = 0, smile_intensity = 0, brow_furrow = 0;
    let motion_level = 0, blink_rate = 0, attention_score = 0;
    let gaze_direction: string = 'away';

    if (face) {
      const earL = (dist(face[IDX.lUp1], face[IDX.lLo1]) + dist(face[IDX.lUp2], face[IDX.lLo2])) / (2 * dist(face[IDX.lOuter], face[IDX.lInner]) + 1e-6);
      const earR = (dist(face[IDX.rUp1], face[IDX.rLo1]) + dist(face[IDX.rUp2], face[IDX.rLo2])) / (2 * dist(face[IDX.rOuter], face[IDX.rInner]) + 1e-6);
      const ear = (earL + earR) / 2;

      // Centroide del bounding-box del rostro (posicion en la toma)
      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (const p of face) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // Movimiento: desplazamiento medio de landmarks entre frames
      let motion = 0;
      const prev = prevLmRef.current;
      if (prev && prev.length === face.length) {
        let s = 0;
        for (let i = 0; i < face.length; i++) s += dist(face[i] as Landmark, prev[i] as Landmark);
        motion = Math.min((s / face.length) / 0.03, 1);
      }
      prevLmRef.current = face.map((p) => ({ x: p.x, y: p.y }));
      motion_level = +motion.toFixed(3);

      // Mirada: posicion del iris (separar eje), + apertura del ojo
      const tL = ((face[IDX.lIris].x - face[IDX.lOuter].x) * (face[IDX.lInner].x - face[IDX.lOuter].x)
               + (face[IDX.lIris].y - face[IDX.lOuter].y) * (face[IDX.lInner].y - face[IDX.lOuter].y))
               / (Math.pow(dist(face[IDX.lOuter], face[IDX.lInner]), 2) + 1e-6);
      const tR = ((face[IDX.rIris].x - face[IDX.rOuter].x) * (face[IDX.rInner].x - face[IDX.rOuter].x)
               + (face[IDX.rIris].y - face[IDX.rOuter].y) * (face[IDX.rInner].y - face[IDX.rOuter].y))
               / (Math.pow(dist(face[IDX.rOuter], face[IDX.rInner]), 2) + 1e-6);
      const lateral = (tL + tR) / 2; // ~0.5 pupilas centradas
      const offCenter = Math.abs(cx - 0.5);

      if (ear < 0.16)                        gaze_direction = 'down';      // ojos cerrados
      else if (lateral < 0.32 || lateral > 0.68 || offCenter > 0.22) gaze_direction = 'away';
      else if (cy > 0.80)                    gaze_direction = 'down';
      else if (cy < 0.25)                    gaze_direction = 'up';
      else                                   gaze_direction = 'screen';

      // Parpadeo: transicion cerrado -> abierto (EAR)
      const closed = ear < 0.18;
      if (closed && wasClosedRef.current === false) blinkLogRef.current.push(now);
      wasClosedRef.current = closed;
      blinkLogRef.current = blinkLogRef.current.filter((t) => now - t < 60000);
      const mins = Math.max((now - startTimeRef.current) / 60000, 0.1);
      blink_rate = Math.min(blinkLogRef.current.length / mins, 40);

      // Emocion: valencia por sonrisa vs ceño/fruncimiento
      const smile = Math.max(bs.mouthSmileLeft ?? 0, bs.mouthSmileRight ?? 0);
      const frown = Math.max(bs.mouthFrownLeft ?? 0, bs.mouthFrownRight ?? 0);
      const browDown = Math.max(bs.browDownLeft ?? 0, bs.browDownRight ?? 0);
      smile_intensity = +clamp(smile, 0, 1).toFixed(3);
      brow_furrow     = +clamp(browDown * 0.9 + frown * 0.3, 0, 1).toFixed(3);
      valence         = +clamp(smile - 0.5 * frown - 0.8 * browDown, -1, 1).toFixed(3);

      const mouthOpen = Math.max(bs.mouthOpen ?? 0, bs.jawOpen ?? 0);
      arousal = +clamp(motion_level * 0.5 + mouthOpen * 0.5 + 0.1, 0, 1).toFixed(3);

      // Atencion: rostro presente + mirada a pantalla + estabilidad
      const onScreen = gaze_direction === 'screen';
      const stability = 1 - Math.min(motion_level * 2.5, 1);
      attention_score = +clamp(0.35 + (onScreen ? 0.35 : 0.05) + 0.3 * stability, 0.05, 1).toFixed(3);
    } else {
      prevLmRef.current = null;
      wasClosedRef.current = null;
    }

    setSnapshot({
      attention_score,
      valence,
      arousal,
      blink_rate: +blink_rate.toFixed(1),
      gaze_direction,
      brow_furrow,
      smile_intensity,
      motion_level,
      is_active: hasFace,
    });

    // ~15 fps (MediaPipe es pesado; se limita la cadencia sin bloquear la UI)
    setTimeout(() => {
      if (runningRef.current)
        animRef.current = requestAnimationFrame(analyzeFrame);
    }, 66);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      runningRef.current = true;
      blinkLogRef.current = [];
      wasClosedRef.current = null;
      prevLmRef.current = null;
      startTimeRef.current = Date.now();
      setPermissionDenied(false);

      const video = videoRef.current!;
      video.srcObject = stream;
      await new Promise<void>((resolve, reject) => {
        video.oncanplay = () => resolve();
        video.onerror = reject;
        video.play().catch(reject);
      });

      // Cargar el modelo antes de empezar el bucle (muestra error si falla)
      await ensureLandmarker();

      setIsStreaming(true);
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
  }, [analyzeFrame, ensureLandmarker]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    prevLmRef.current = null;
    blinkLogRef.current = [];
    wasClosedRef.current = null;
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // Liberar WASM de MediaPipe
      try { landmarkerRef.current?.close(); } catch { /* noop */ }
      landmarkerRef.current = null;
      if (videoRef.current && document.body.contains(videoRef.current)) {
        document.body.removeChild(videoRef.current);
        videoRef.current = null;
      }
    };
  }, []);

  return { snapshot, isStreaming, permissionDenied, errorMessage, hardwareAvailable, videoRef, startCamera, stopCamera, resetError };
}