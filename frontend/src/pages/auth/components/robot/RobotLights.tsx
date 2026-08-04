/**
 * RobotLights.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: renderizar y controlar la iluminación
 * de la escena 3D en función del estado del robot.
 *
 * Principio: Single Responsibility — solo gestiona luces.
 * No sabe nada de animaciones ni de formularios.
 * ─────────────────────────────────────────────────────────────
 */
import type { Vector3Tuple } from './RobotAnimations';
import type { RobotState } from './RobotStates';
import { LIGHT_CONFIG } from './RobotConfig';

// ── Tipos de luz soportados ───────────────────────────────────

export interface AmbientLightProps {
  color:     string;
  intensity: number;
}

export interface DirectionalLightProps {
  color:     string;
  intensity: number;
  position:  Vector3Tuple;
  castShadow?: boolean;
}

export interface PointLightProps {
  color:     string;
  intensity: number;
  position:  Vector3Tuple;
  distance?: number;
  decay?:    number;
}

export interface SpotLightProps {
  color:     string;
  intensity: number;
  position:  Vector3Tuple;
  angle:     number;
  penumbra:  number;
  castShadow?: boolean;
}

// ── Preset completo de iluminación ────────────────────────────

export interface LightingPreset {
  ambient:      AmbientLightProps;
  directional:  DirectionalLightProps;
  pointLights:  PointLightProps[];
  spotLights?:  SpotLightProps[];
}

export type LightingPresetMap = Partial<Record<RobotState, LightingPreset>>;

export interface RobotLightsProps {
  robotState?:      RobotState;
  presetOverrides?: LightingPresetMap;
  intensityScale?:  number;
}

// ── Preset por defecto derivado de RobotConfig ───────────────
const DEFAULT_PRESET: LightingPreset = {
  ambient: {
    color:     LIGHT_CONFIG.ambientColor,
    intensity: LIGHT_CONFIG.ambientIntensity,
  },
  directional: {
    color:      LIGHT_CONFIG.directionalColor,
    intensity:  LIGHT_CONFIG.directionalIntensity,
    position:   LIGHT_CONFIG.directionalPosition,
    castShadow: true,
  },
  pointLights: [
    {
      color:     LIGHT_CONFIG.pointLight1Color,
      intensity: LIGHT_CONFIG.pointLight1Intensity,
      position:  LIGHT_CONFIG.pointLight1Position,
      distance:  10,
      decay:     2,
    },
    {
      color:     LIGHT_CONFIG.pointLight2Color,
      intensity: LIGHT_CONFIG.pointLight2Intensity,
      position:  LIGHT_CONFIG.pointLight2Position,
      distance:  10,
      decay:     2,
    },
  ],
};

// ── Componente ────────────────────────────────────────────────
export default function RobotLights({
  robotState,
  presetOverrides,
  intensityScale = 1,
}: RobotLightsProps) {
  // Selecciona el preset: override por estado > default
  const preset: LightingPreset =
    (robotState && presetOverrides?.[robotState]) ?? DEFAULT_PRESET;

  const scale = intensityScale;

  return (
    <>
      {/* Luz ambiental — ilumina toda la escena uniformemente */}
      <ambientLight
        color={preset.ambient.color}
        intensity={preset.ambient.intensity * scale}
      />

      {/* Luz direccional — simula el sol / fuente principal */}
      <directionalLight
        color={preset.directional.color}
        intensity={preset.directional.intensity * scale}
        position={preset.directional.position}
        castShadow={preset.directional.castShadow ?? false}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
      />

      {/* Luces de punto — relleno de color para el robot */}
      {preset.pointLights.map((pl, i) => (
        <pointLight
          key={i}
          color={pl.color}
          intensity={pl.intensity * scale}
          position={pl.position}
          distance={pl.distance ?? 0}
          decay={pl.decay ?? 2}
        />
      ))}

      {/* Spots opcionales */}
      {preset.spotLights?.map((sl, i) => (
        <spotLight
          key={`spot-${i}`}
          color={sl.color}
          intensity={sl.intensity * scale}
          position={sl.position}
          angle={sl.angle}
          penumbra={sl.penumbra}
          castShadow={sl.castShadow ?? false}
        />
      ))}
    </>
  );
}
