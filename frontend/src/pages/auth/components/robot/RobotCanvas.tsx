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
import { Suspense, useCallback } from 'react';
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

  if (!enabled) return null;

  return (
    <div
      className={`relative w-full h-full ${className}`}
      aria-hidden="true"
    >
      <Canvas
        shadows={CANVAS_CONFIG.shadows}
        dpr={CANVAS_CONFIG.dpr}
        gl={{
          antialias:             true,
          alpha:                 transparent,
          powerPreference:       'high-performance',
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
