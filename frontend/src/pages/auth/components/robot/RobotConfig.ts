/**
 * RobotConfig.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: centralizar TODA la configuración
 * estática del robot y la escena 3D.
 *
 * Principio: Single Source of Truth — ningún otro archivo
 * hardcodea valores de cámara, posición o escala.
 * ─────────────────────────────────────────────────────────────
 */

// Tipos primitivos 3D — definidos aquí para evitar imports circulares
export type Vector3Tuple = [x: number, y: number, z: number];
export type EulerTuple   = [x: number, y: number, z: number];

// ── Ruta al modelo ────────────────────────────────────────────
export const ROBOT_GLB_PATH = '/robot.glb' as const;

// ── Transformación del modelo en la escena ───────────────────
export interface RobotTransform {
  position: Vector3Tuple;
  rotation: EulerTuple;
  scale:    Vector3Tuple;
}

export const ROBOT_TRANSFORM: RobotTransform = {
  position: [0, -0.2, 0],
  rotation: [0, 0, 0],
  scale:    [1, 1, 1],
};

// ── Cámara ───────────────────────────────────────────────────
export interface CameraConfig {
  position:    Vector3Tuple;
  fov:         number;
  near:        number;
  far:         number;
  /** Punto al que la cámara apunta por defecto */
  lookAt:      Vector3Tuple;
}

export const CAMERA_CONFIG: CameraConfig = {
  position: [0, 0, 4.5],
  fov:      50,
  near:     0.1,
  far:      100,
  lookAt:   [0, 0, 0],
};

// ── Iluminación ──────────────────────────────────────────────
export interface LightConfig {
  ambientIntensity:      number;
  ambientColor:          string;
  directionalIntensity:  number;
  directionalColor:      string;
  directionalPosition:   Vector3Tuple;
  pointLight1Color:      string;
  pointLight1Intensity:  number;
  pointLight1Position:   Vector3Tuple;
  pointLight2Color:      string;
  pointLight2Intensity:  number;
  pointLight2Position:   Vector3Tuple;
}

export const LIGHT_CONFIG: LightConfig = {
  ambientIntensity:     0.4,
  ambientColor:         '#b0c4ff',
  directionalIntensity: 1.2,
  directionalColor:     '#ffffff',
  directionalPosition:  [3, 5, 3],
  pointLight1Color:     '#4f8ef7',   // azul — izquierda
  pointLight1Intensity: 1.5,
  pointLight1Position:  [-3, 2, 2],
  pointLight2Color:     '#a78bfa',   // violeta — derecha
  pointLight2Intensity: 1.0,
  pointLight2Position:  [3, 1, 1],
};

// ── Partículas flotantes ─────────────────────────────────────
export interface ParticleConfig {
  count:      number;
  spread:     number;     // Radio máximo de dispersión
  minSize:    number;
  maxSize:    number;
  color:      string;
  opacity:    number;
  speed:      number;
}

export const PARTICLE_CONFIG: ParticleConfig = {
  count:   80,
  spread:  4,
  minSize: 0.01,
  maxSize: 0.04,
  color:   '#4f8ef7',
  opacity: 0.6,
  speed:   0.3,
};

// ── Seguimiento del mouse ────────────────────────────────────
export interface MouseFollowConfig {
  /** Qué tanto rota la cabeza/cuerpo siguiendo el mouse (0–1) */
  sensitivity:   number;
  /** Suavizado de la interpolación (lerp factor) */
  lerpFactor:    number;
  /** Ángulo máximo de rotación horizontal en radianes */
  maxRotationX:  number;
  /** Ángulo máximo de rotación vertical en radianes */
  maxRotationY:  number;
}

export const MOUSE_FOLLOW_CONFIG: MouseFollowConfig = {
  sensitivity:  0.5,
  lerpFactor:   0.05,
  maxRotationX: 0.3,
  maxRotationY: 0.25,
};

// ── Floating (efecto de levitación) ─────────────────────────
export interface FloatingConfig {
  amplitude: number;   // Amplitud vertical del movimiento
  frequency: number;   // Ciclos por segundo
  phaseOffset: number; // Desfase inicial
}

export const FLOATING_CONFIG: FloatingConfig = {
  amplitude:   0.08,
  frequency:   0.6,
  phaseOffset: 0,
};

// ── Canvas / Renderer ────────────────────────────────────────
export interface CanvasConfig {
  /** PCFShadowMap = recomendado en Three.js >= r164 (PCFSoft deprecado) */
  shadows:          true | 'basic' | 'percentage' | 'soft' | 'variance';
  dpr:              [number, number];
  backgroundColor:  string;
  backgroundAlpha:  number;
}

export const CANVAS_CONFIG: CanvasConfig = {
  shadows:         'percentage',
  dpr:             [1.5, 2.5],   // mayor resolución — sin pixelado
  backgroundColor: '#EDECEA',
  backgroundAlpha: 1,
};
