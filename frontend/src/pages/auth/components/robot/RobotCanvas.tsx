/**
 * RobotCanvas.tsx
 * ─────────────────────────────────────────────────────────────
 * Punto de entrada de toda la escena 3D.
 * Ensambla: Canvas → Camera → Lights → Model → Effects → Environment
 *
 * Completamente reutilizable — no depende del login.
 * El estado del robot (idle, typing, success…) se inyecta por props.
 * ─────────────────────────────────────────────────────────────
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas }       from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import type { AnimationClip } from 'three';

import { CAMERA_CONFIG, CANVAS_CONFIG } from './RobotConfig';
import { RobotCanvasFallbackUI, RobotErrorBoundary } from './RobotErrorBoundary';
import type { RobotState }  from './RobotStates';
import RobotLights          from './RobotLights';
import RobotEffects         from './RobotEffects';
import RobotAnimatedScene   from './RobotAnimatedScene';
import { useRobotContextSafe } from '../../../../context/RobotContext';

// Resolución máxima en modo liviano: suficiente para un robot decorativo.
const LOW_POWER_DPR: [number, number] = [1, 1.5];

// ── Props públicas ────────────────────────────────────────────

export interface RobotCanvasProps {
  robotState?:   RobotState;
  className?:    string;
  enabled?:      boolean;
  /** Si true, el canvas renderiza con fondo transparente (útil en banners con gradiente) */
  transparent?:  boolean;
  onSceneReady?: () => void;
  /**
   * Modo liviano: menos resolución, sin sombras, entorno ni postproceso.
   * Reduce memoria GPU cuando la escena es decorativa.
   */
  lowPower?:     boolean;
  /** Si true, deja de dibujar cuadros (el robot queda quieto, sin gastar GPU). */
  paused?:       boolean;
}

// ── Componente interno de la escena ──────────────────────────

interface SceneContentProps {
  robotState:    RobotState;
  onModelLoaded: (clips: AnimationClip[]) => void;
  lowPower:      boolean;
}

function SceneContent({ robotState, onModelLoaded, lowPower }: SceneContentProps) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={CAMERA_CONFIG.position}
        fov={CAMERA_CONFIG.fov}
        near={CAMERA_CONFIG.near}
        far={CAMERA_CONFIG.far}
        lookAt={CAMERA_CONFIG.lookAt as unknown as [number, number, number]}
      />

      <RobotLights robotState={robotState} />

      {!lowPower && (
        <Environment
          preset="city"
          environmentIntensity={0.3}
          backgroundBlurriness={1}
        />
      )}

      <Suspense fallback={null}>
        <RobotAnimatedScene
          robotState={robotState}
          onReady={onModelLoaded}
        />
      </Suspense>

      <RobotEffects robotState={robotState} disabled={lowPower} />
    </>
  );
}

// ── Componente principal exportado ────────────────────────────

export default function RobotCanvas({
  robotState: robotStateProp,
  className    = '',
  enabled      = true,
  transparent  = false,
  onSceneReady,
  lowPower     = false,
  paused       = false,
}: RobotCanvasProps) {
  const robotCtx   = useRobotContextSafe();
  const robotState: RobotState = robotStateProp ?? robotCtx?.state ?? 'idle';

  const handleModelLoaded = useCallback(
    (clips: AnimationClip[]) => {
      if (import.meta.env.DEV) {
        console.info('[RobotCanvas] GLB cargado. Clips:', clips.map(c => c.name));
      }
      onSceneReady?.();
    },
    [onSceneReady],
  );

  // ── Recuperación de pérdida de contexto WebGL ────────────────
  const [webglEpoch, setWebglEpoch] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);
  // Guardamos el renderer en ESTADO (no en ref) para que el useEffect
  // de abajo se re-ejecute justo cuando R3F lo instancia vía onCreated
  // (que ocurre DESPUÉS del primer render del <Canvas>).
  const [gl, setGl]         = useState<import('three').WebGLRenderer | null>(null);

  const handleCreated = useCallback(
    ({ gl }: { gl: import('three').WebGLRenderer }) => {
      setGl(gl);
    },
    [],
  );

  // ── Listeners de pérdida/restauración de contexto ────────────
  // NOTA: R3F invoca `onCreated(state)` y DESCARTA su valor de retorno,
  // por lo que no se pueden devolver cleanup functions desde ahí. En su
  // lugar, gestionamos el ciclo de vida aquí con useEffect sobre `gl`,
  // que sí recibe el cleanup real al desmontar o al remontar.
  useEffect(() => {
    if (!gl) return;
    const dom = gl.domElement;
    if (!dom) return;

    let lostHandled = false;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;

    // IMPORTANTE: NO llamar a e.preventDefault() en `webglcontextlost`.
    // Hacerlo bloquea la restauración automática del contexto que Three.js
    // ya gestiona, dejando el canvas en negro (el robot "no aparece" y se
    // registra "Context Lost").
    const onLost = () => {
      if (import.meta.env.DEV) {
        console.warn('[RobotCanvas] WebGL context lost — esperando restauración…');
      }
      lostHandled = true;
      // Si en 4s no llega 'webglcontextrestored', el contexto está muerto de
      // forma permanente (GPU saturada, driver crash o pestaña en segundo plano).
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        if (!lostHandled) return;
        const ctx = gl.getContext?.() as WebGLRenderingContext | WebGL2RenderingContext | null;
        if (ctx && typeof ctx.isContextLost === 'function' && !ctx.isContextLost()) {
          return; // ya se recuperó
        }
        if (import.meta.env.DEV) {
          console.warn('[RobotCanvas] Contexto nunca se restauró — usando fallback.');
        }
        setWebglFailed(true);
      }, 4000);
    };

    const onRestored = () => {
      if (import.meta.env.DEV) {
        console.info('[RobotCanvas] WebGL context restored.');
      }
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = null;
      lostHandled = false;
      setWebglFailed(false);
      // Reinstanciar la escena vuelve a conectar el modelo y sus animaciones
      // con el contexto restaurado, como hacía la versión estable anterior.
      setWebglEpoch((epoch) => epoch + 1);
    };

    dom.addEventListener('webglcontextlost', onLost, false);
    dom.addEventListener('webglcontextrestored', onRestored, false);

    return () => {
      dom.removeEventListener('webglcontextlost', onLost, false);
      dom.removeEventListener('webglcontextrestored', onRestored, false);
      if (restoreTimer) clearTimeout(restoreTimer);
    };
  }, [gl, webglEpoch]);

  if (!enabled) return null;

  return (
    <div
      className={`relative w-full h-full ${className}`}
      aria-hidden="true"
    >
      {webglFailed ? (
        <RobotCanvasFallbackUI error={new Error('WebGL no disponible')} />
      ) : (
        <RobotErrorBoundary key={webglEpoch}>
          <Canvas
            key={webglEpoch}
            className="robot-canvas-surface"
            shadows={lowPower ? false : CANVAS_CONFIG.shadows}
            dpr={lowPower ? LOW_POWER_DPR : CANVAS_CONFIG.dpr}
            onCreated={handleCreated}
            gl={{
              antialias:             !lowPower,
              alpha:                 transparent,
              // 'high-performance' puede fallar en GPUs integradas/remotas.
              // Con failIfMajorPerformanceCaveat:false permitimos que el navegador
              // use el renderer por software (swiftshader) en vez de negar el
              // contexto → evita "Context Lost" silencioso en hardware débil.
              powerPreference:       lowPower ? 'default' : 'high-performance',
              failIfMajorPerformanceCaveat: false,
              preserveDrawingBuffer: false,
              stencil:               false,
              depth:                 true,
              logarithmicDepthBuffer: !lowPower,
            }}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              ...(transparent ? {} : { background: CANVAS_CONFIG.backgroundColor }),
            }}
            frameloop={paused ? 'never' : 'always'}
            performance={{ min: 0.8 }}
          >
            <SceneContent
              robotState={robotState}
              onModelLoaded={handleModelLoaded}
              lowPower={lowPower}
            />
          </Canvas>
        </RobotErrorBoundary>
      )}
    </div>
  );
}
