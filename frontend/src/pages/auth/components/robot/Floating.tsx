/**
 * Floating.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: aplicar el efecto de levitación suave
 * (bob) a cualquier objeto 3D que lo envuelva, y renderizar
 * las partículas flotantes del fondo de la escena.
 *
 * Principio: Single Responsibility + Composición —
 * se usa como wrapper <Floating> alrededor del robot,
 * o de forma independiente para partículas.
 * ─────────────────────────────────────────────────────────────
 */
import type { FloatingConfig, ParticleConfig } from './RobotConfig';
import type { RobotState } from './RobotStates';

// ── Props del componente Floating (wrapper de levitación) ─────

export interface FloatingProps {
  /** Configuración del movimiento vertical */
  config?:    Partial<FloatingConfig>;
  /** El objeto 3D hijo que levitará */
  children:   React.ReactNode;
  /** Si false, el efecto queda congelado en posición base */
  enabled?:   boolean;
  /** Pausa el efecto cuando el robot está en ciertos estados */
  pauseOn?:   RobotState[];
}

// ── Tipos de una partícula individual ────────────────────────

export interface Particle {
  id:         number;
  position:   [x: number, y: number, z: number];
  size:       number;
  speed:      number;
  opacity:    number;
  /** Fase inicial para que no todas oscilen sincronizadas */
  phase:      number;
}

// ── Props del sistema de partículas ──────────────────────────

export interface SceneParticlesProps {
  config?:    Partial<ParticleConfig>;
  /** Si false, no se renderizan partículas */
  enabled?:   boolean;
  /** Estado del robot — puede modular la velocidad/opacidad */
  robotState?: RobotState;
}

// ── Resultado del hook useParticles ──────────────────────────

export interface UseParticlesResult {
  /** Array de partículas con posición y propiedades inicializadas */
  particles: Particle[];
  /** Función a llamar en useFrame para actualizar posiciones */
  update:    (deltaTime: number) => void;
}
