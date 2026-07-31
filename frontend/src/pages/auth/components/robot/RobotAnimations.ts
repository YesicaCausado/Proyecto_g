/**
 * RobotAnimations.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: definir los tipos de animación y el
 * contrato (interfaz) que debe cumplir cualquier sistema de
 * reproducción de clips del robot.
 *
 * Principio: Dependency Inversion — los consumidores dependen
 * de estas interfaces abstractas, no de implementaciones Three.js.
 * ─────────────────────────────────────────────────────────────
 */
import type { RobotState } from './RobotStates';

// ── Tipos primitivos reutilizables ───────────────────────────
export type Vector3Tuple = [x: number, y: number, z: number];
export type EulerTuple   = [x: number, y: number, z: number];
export type QuatTuple    = [x: number, y: number, z: number, w: number];

// ── Definición de un clip de animación ──────────────────────
export interface AnimationClip {
  /** Nombre del clip tal como aparece en el GLB */
  name:         string;
  /** Estado del robot al que pertenece este clip */
  state:        RobotState;
  /** Velocidad de reproducción (1 = normal, 0.5 = mitad) */
  timeScale:    number;
  /** ¿El clip hace loop? */
  loop:         boolean;
  /** Peso de fundido al entrar (crossfade) en segundos */
  fadeInTime:   number;
  /** Peso de fundido al salir en segundos */
  fadeOutTime:  number;
  /** Clip de fallback si este nombre no existe en el GLB */
  fallback?:    string;
}

/** Mapa de estado → clip de animación */
export type AnimationClipMap = Record<RobotState, AnimationClip>;

// ── Contrato del controlador de animaciones ──────────────────
export interface IAnimationController {
  /**
   * Activa el clip correspondiente al estado dado.
   * Hace crossfade desde el clip activo anterior.
   */
  play(state: RobotState): void;

  /** Detiene el clip activo con un fundido de salida */
  stop(): void;

  /** Pausa sin soltar el clip actual */
  pause(): void;

  /** Reanuda desde la posición de pausa */
  resume(): void;

  /** Devuelve el estado activo en este momento */
  getCurrentState(): RobotState | null;

  /** Devuelve true si el clip especificado está en reproducción */
  isPlaying(state: RobotState): boolean;
}

// ── Resultado del hook de animaciones (para R3F useAnimations) ──
export interface UseRobotAnimationsResult {
  /** Controlador listo para usar */
  controller: IAnimationController;
  /** Nombres de clips disponibles en el modelo cargado */
  availableClips: string[];
  /** ¿Están las animaciones listas? */
  ready: boolean;
}
