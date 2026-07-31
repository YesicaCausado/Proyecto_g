/**
 * MouseFollow.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: calcular la rotación objetivo del robot
 * a partir de la posición del mouse en pantalla.
 *
 * Principio: Pure functions — no tiene estado, no tiene efectos
 * secundarios. Recibe datos y devuelve datos.
 * ─────────────────────────────────────────────────────────────
 */
import type { Vector3Tuple, EulerTuple } from './RobotAnimations';
import type { MouseFollowConfig } from './RobotConfig';

// ── Posición normalizada del mouse ───────────────────────────
/** Coordenadas del mouse normalizadas en el rango [-1, +1] */
export interface NormalizedMousePosition {
  x: number;  // -1 = borde izquierdo, +1 = borde derecho
  y: number;  // -1 = borde inferior,  +1 = borde superior
}

// ── Resultado del cálculo de seguimiento ─────────────────────
export interface MouseFollowResult {
  /** Euler de rotación objetivo para el cuerpo del robot */
  bodyRotation:   EulerTuple;
  /** Euler de rotación objetivo para la cabeza (si se controla por separado) */
  headRotation:   EulerTuple;
  /** Punto 3D al que mira la cabeza (para lookAt) */
  lookAtTarget:   Vector3Tuple;
}

// ── Contrato del servicio de seguimiento ─────────────────────
export interface IMouseFollowService {
  /**
   * Calcula la rotación objetivo a partir del mouse normalizado.
   * Aplica los límites y sensibilidad de MouseFollowConfig.
   */
  compute(
    mouse:  NormalizedMousePosition,
    config: MouseFollowConfig,
  ): MouseFollowResult;

  /**
   * Interpola suavemente desde la rotación actual a la objetivo.
   * Debe llamarse en cada frame (useFrame de R3F).
   */
  lerp(
    current: EulerTuple,
    target:  EulerTuple,
    factor:  number,
  ): EulerTuple;

  /**
   * Convierte coordenadas de pantalla (px) a rango [-1, +1].
   */
  normalize(
    clientX:      number,
    clientY:      number,
    windowWidth:  number,
    windowHeight: number,
  ): NormalizedMousePosition;
}

// ── Estado del hook useMouseFollow ───────────────────────────
export interface UseMouseFollowResult {
  /** Posición normalizada actual del mouse */
  mousePosition:     NormalizedMousePosition;
  /** Rotación objetivo calculada lista para aplicar al mesh */
  followResult:      MouseFollowResult;
  /** true si el mouse está dentro del canvas */
  isInsideCanvas:    boolean;
}
