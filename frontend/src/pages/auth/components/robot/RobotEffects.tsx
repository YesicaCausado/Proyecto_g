/**
 * RobotEffects.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: efectos visuales post-proceso de la escena.
 * Se monta DENTRO del Canvas de R3F.
 *
 * Principio: Open/Closed — agregar un nuevo efecto = agregar un
 * componente hijo, sin modificar los existentes.
 * ─────────────────────────────────────────────────────────────
 */
import { useMemo } from 'react';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { RobotState } from './RobotStates';
// ── Tipos de configuración ────────────────────────────────────

export interface BloomConfig {
  enabled:              boolean;
  intensity:            number;
  luminanceThreshold:   number;
  luminanceSmoothing:   number;
}

export interface VignetteConfig {
  enabled:  boolean;
  offset:   number;
  darkness: number;
}

export interface NoiseConfig {
  enabled:  boolean;
  opacity:  number;
}

export interface EffectsPreset {
  bloom:    BloomConfig;
  vignette: VignetteConfig;
  noise:    NoiseConfig;
}

export type EffectsPresetMap = Partial<Record<RobotState, EffectsPreset>>;

export const NEUTRAL_EFFECTS_PRESET: EffectsPreset = {
  bloom:    { enabled: true,  intensity: 0.3, luminanceThreshold: 0.90, luminanceSmoothing: 0.02 },
  vignette: { enabled: false, offset: 0.5,   darkness: 0 },
  noise:    { enabled: false, opacity: 0 },
};

export interface RobotEffectsProps {
  robotState?: RobotState;
  presets?:    EffectsPresetMap;
  /** Desactiva todos los efectos (útil en dispositivos de bajo rendimiento) */
  disabled?:   boolean;
}

// ── Presets por estado ────────────────────────────────────────
const STATE_PRESETS: EffectsPresetMap = {
  idle:            { ...NEUTRAL_EFFECTS_PRESET },
  greeting:        { ...NEUTRAL_EFFECTS_PRESET },
  lookingEmail:    { ...NEUTRAL_EFFECTS_PRESET },
  lookingPassword: { ...NEUTRAL_EFFECTS_PRESET },
  sleep:           { ...NEUTRAL_EFFECTS_PRESET },
  success:  { bloom: { enabled: true, intensity: 1.2, luminanceThreshold: 0.7,  luminanceSmoothing: 0.05  }, vignette: { enabled: true, offset: 0.3, darkness: 0.4 }, noise: { enabled: false, opacity: 0 } },
  error:    { bloom: { enabled: true, intensity: 0.6, luminanceThreshold: 0.8,  luminanceSmoothing: 0.025 }, vignette: { enabled: true, offset: 0.5, darkness: 0.8 }, noise: { enabled: true,  opacity: 0.05 } },
  loading:  { bloom: { enabled: true, intensity: 0.8, luminanceThreshold: 0.75, luminanceSmoothing: 0.04  }, vignette: { enabled: true, offset: 0.4, darkness: 0.5 }, noise: { enabled: false, opacity: 0 } },
};

// ── Componente ────────────────────────────────────────────────
export default function RobotEffects({
  robotState = 'idle',
  presets,
  disabled = false,
}: RobotEffectsProps) {
  const preset = useMemo<EffectsPreset>(
    () =>
      (robotState && (presets?.[robotState] ?? STATE_PRESETS[robotState]))
      ?? NEUTRAL_EFFECTS_PRESET,
    [robotState, presets],
  );

  if (disabled) return null;

  // Los efectos siempre se renderizan; la intensidad controla la visibilidad.
  // EffectComposer requiere hijos de tipo Effect — no acepta short-circuit (&&).
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={preset.bloom.enabled ? preset.bloom.intensity : 0}
        luminanceThreshold={preset.bloom.luminanceThreshold}
        luminanceSmoothing={preset.bloom.luminanceSmoothing}
        blendFunction={BlendFunction.ADD}
      />
      <Vignette
        offset={preset.vignette.enabled ? preset.vignette.offset : 1}
        darkness={preset.vignette.enabled ? preset.vignette.darkness : 0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise
        opacity={preset.noise.enabled ? preset.noise.opacity : 0}
        blendFunction={BlendFunction.SCREEN}
      />
    </EffectComposer>
  );
}
