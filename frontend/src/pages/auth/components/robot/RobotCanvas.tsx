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

import { CAMERA_CONFIG, CANVAS_CONFIG } from './RobotConfig';
import type { RobotState }  from './RobotStates';
import RobotLights          from './RobotLights';
import type { LightingPresetMap } from './RobotLights';
import RobotEffects         from './RobotEffects';
import type { EffectsPresetMap } from './RobotEffects';
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
  /**
   * Si false, NO se monta el <Environment preset="city"> (que descarga un HDR
   * desde un CDN externo). Desactivarlo elimina una dependencia de red innecesaria
   * y un punto de fallo cuando no hay internet / hay proxy corporativo.
   * Default: true (comportamiento anterior).
   */
  environment?:  boolean;
  /**
   * Si false, NO se aplica post-proceso (Bloom/Vignette/Noise). Ahorra GPU y
   * evita el crash potencial de EffectComposer en contextos WebGL débiles.
   * Default: true.
   */
  effects?:      boolean;
  /**
   * Si false, el canvas no renderiza sombras (más ligero).
   * Default: true.
   */
  shadows?:      boolean;
  /**
   * Presets de iluminación para sobrescribir el DEFAULT de RobotConfig,
   * indexados por RobotState. Opcional y 100% compatible hacia atrás:
   * si se omite, las escenas existentes (login, welcome) conservan su
   * iluminación azul/violeta actual.
   */
  lightingPresets?: LightingPresetMap;
  /** Presets de post-procesado (Bloom/Vignette/Noise), indexados por estado. */
  effectsPresets?:  EffectsPresetMap;
}

// ── Componente interno de la escena ──────────────────────────

interface SceneContentProps {
  robotState:        RobotState;
  onModelLoaded:     (clips: AnimationClip[]) => void;
  lightingPresets?:  LightingPresetMap;
  effectsPresets?:   EffectsPresetMap;
  environment?:      boolean;
  effects?:          boolean;
}

function SceneContent({
  robotState,
  onModelLoaded,
  lightingPresets,
  effectsPresets,
  environment = true,
  effects = true,
}: SceneContentProps) {
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

      <RobotLights robotState={robotState} presetOverrides={lightingPresets} />

      {environment && (
        <Environment
          preset="city"
          environmentIntensity={0.3}
          backgroundBlurriness={1}
        />
      )}

      {/*
       * Suspense: mientras el GLB carga no se muestra ningún robot falso.
       * El splash de carga del layout cubre toda la pantalla con un spinner
       * neutro. Solo se usa robot.glb real.
       */}
      <Suspense fallback={null}>
        <RobotAnimatedScene
          robotState={robotState}
          onReady={onModelLoaded}
        />
      </Suspense>

      <RobotEffects robotState={robotState} presets={effectsPresets} disabled={!effects} />
    </>
  );
}

// ── Componente principal exportado ────────────────────────────

export default function RobotCanvas({
  robotState: robotStateProp,
  className     = '',
  enabled       = true,
  transparent   = false,
  onSceneReady,
  lightingPresets,
  effectsPresets,
  environment   = true,
  effects       = true,
  shadows       = true,
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
        shadows={shadows ? CANVAS_CONFIG.shadows : false}
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
          lightingPresets={lightingPresets}
          effectsPresets={effectsPresets}
          environment={environment}
          effects={effects}
        />
      </Canvas>
    </div>
  );
}
