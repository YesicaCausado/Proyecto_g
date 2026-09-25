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

import { CAMERA_CONFIG, CANVAS_CONFIG, ROBOT_TRANSFORM } from './RobotConfig';
import type { RobotState }  from './RobotStates';
import RobotLights          from './RobotLights';
import RobotEffects         from './RobotEffects';
import RobotGeometric       from './RobotGeometric';
import RobotAnimatedScene   from './RobotAnimatedScene';
import { useRobotContextSafe } from '../../../../context/RobotContext';

// ── Props públicas ────────────────────────────────────────────

export interface RobotCanvasProps {
  robotState?:   RobotState;
  className?:    string;
  enabled?:      boolean;
  /** Si true, el canvas renderiza con fondo transparente (útil en banners con gradiente) */
  transparent?:  boolean;
  onSceneReady?: () => void;
}

// ── Componente interno de la escena ──────────────────────────

interface SceneContentProps {
  robotState:    RobotState;
  onModelLoaded: (clips: AnimationClip[]) => void;
}

function SceneContent({ robotState, onModelLoaded }: SceneContentProps) {
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

      <Environment
        preset="city"
        environmentIntensity={0.3}
        backgroundBlurriness={1}
      />

      {/*
       * Suspense muestra RobotGeometric mientras el GLB carga.
       * RobotAnimatedScene combina modelo + motor de animaciones.
       */}
      <Suspense fallback={
        <RobotGeometric
          robotState={robotState}
          position={ROBOT_TRANSFORM.position}
          scale={ROBOT_TRANSFORM.scale[0]}
        />
      }>
        <RobotAnimatedScene
          robotState={robotState}
          onReady={onModelLoaded}
        />
      </Suspense>

      <RobotEffects robotState={robotState} />
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
  // Estado que fuerza el re-montaje del <Canvas> cuando el contexto
  // se pierde de forma IRRECUPERABLE (GPU/reset del driver). Remontar
  // es la única forma fiable de reconstruir renderer + escena, porque
  // Three.js no re-subcarga geometrías/texturas tras un contexto perdido.
  const [webglEpoch, setWebglEpoch] = useState(0);
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
  // que sí recibe el cleanup real al desmontar o al remontar (webglEpoch).
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
      // forma permanente (GPU saturada por varios <Canvas>, driver crash,
      // pestaña en segundo plano…). Remontamos con una key nueva para forzar
      // un contexto WebGL limpio.
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        if (!lostHandled) return;
        const ctx = gl.getContext?.() as WebGLRenderingContext | WebGL2RenderingContext | null;
        if (ctx && typeof ctx.isContextLost === 'function' && !ctx.isContextLost()) {
          return; // ya se recuperó
        }
        if (import.meta.env.DEV) {
          console.warn('[RobotCanvas] Contexto nunca se restauró — remontando canvas.');
        }
        setWebglEpoch((e) => e + 1);
      }, 4000);
    };

    const onRestored = () => {
      if (import.meta.env.DEV) {
        console.info('[RobotCanvas] WebGL context restored — re-render.');
      }
      // Re-sincroniza el viewport con el tamaño real del DOM (el canvas pudo
      // quedar en 0×0 o con el tamaño viejo tras la pérdida).
      if (gl && typeof gl.setSize === 'function') {
        const w = gl.domElement?.clientWidth  || 1;
        const h = gl.domElement?.clientHeight || 1;
        gl.setSize(w, h, false);
      }
      // Remontamos para reconstruir la escena con un contexto limpio. Es lo
      // más robusto ante GPU saturadas (varios <Canvas> montados en la misma
      // página, p.ej. landing → login).
      setWebglEpoch((e) => e + 1);
    };

    dom.addEventListener('webglcontextlost', onLost, false);
    dom.addEventListener('webglcontextrestored', onRestored, false);

    return () => {
      dom.removeEventListener('webglcontextlost', onLost, false);
      dom.removeEventListener('webglcontextrestored', onRestored, false);
      if (restoreTimer) clearTimeout(restoreTimer);
      setGl(null);
    };
  }, [gl, webglEpoch]);

  if (!enabled) return null;

  return (
    <div
      className={`relative w-full h-full ${className}`}
      aria-hidden="true"
    >
      <Canvas
        key={webglEpoch}
        shadows={CANVAS_CONFIG.shadows}
        dpr={CANVAS_CONFIG.dpr}
        onCreated={handleCreated}
        gl={{
          antialias:             true,
          alpha:                 transparent,
          // 'high-performance' puede fallar en GPUs integradas/remotas.
          // Con failIfMajorPerformanceCaveat:false permitimos que el navegador
          // use el renderer por software (swiftshader) en vez de negar el
          // contexto → evita "Context Lost" silencioso en hardware débil.
          powerPreference:       'high-performance',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
          stencil:               false,
          depth:                 true,
          logarithmicDepthBuffer: true,
        }}
        style={transparent ? undefined : { background: CANVAS_CONFIG.backgroundColor }}
        frameloop="always"
        performance={{ min: 0.8 }}
      >
        <SceneContent
          robotState={robotState}
          onModelLoaded={handleModelLoaded}
        />
      </Canvas>
    </div>
  );
}
