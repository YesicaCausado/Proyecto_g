/**
 * RobotAnimationController.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: exponer la API pública del sistema
 * de animaciones.
 *
 * Es el único punto de contacto para código externo (LoginCard,
 * hooks de formulario, etc.).
 *
 * Uso:
 *   const robot = useRobotAnimationEngine()
 *   robot.play('idle')
 *   robot.play('greeting')
 *   robot.play('success')
 * ─────────────────────────────────────────────────────────────
 */
import { RobotAnimationManager } from './RobotAnimationManager'
import type { RobotState } from './RobotStates'
import { STATE_METADATA_MAP, BLOCKING_STATES } from './RobotStates'

// ── Interfaz pública ──────────────────────────────────────────

export interface IRobotAnimationController {
  /**
   * Reproduce la animación asociada al estado dado.
   * Hace crossfade suave desde el estado anterior.
   * Respeta prioridades — un estado de alta prioridad no
   * puede ser interrumpido por uno de baja prioridad.
   *
   * @returns true si la animación fue aceptada y reproducida
   */
  play(state: RobotState, force?: boolean): boolean

  /**
   * Detiene todas las animaciones con fade-out.
   */
  stop(fadeSecs?: number): void

  /**
   * Fuerza el estado ignorando prioridades.
   * Solo para errores críticos o reset manual.
   */
  force(state: RobotState): void

  /**
   * Devuelve el robot suavemente a Idle desde cualquier estado.
   * Equivale a force('idle') pero semánticamente más claro.
   * Útil para reutilizar el robot en dashboard, logros, etc.
   */
  reset(): void

  /** Estado que se está reproduciendo ahora */
  readonly currentState: RobotState | null

  /** true durante la ventana de transición (crossfade) */
  readonly isTransitioning: boolean

  /** true si el motor está conectado a un modelo 3D cargado */
  readonly isReady: boolean
}

// ── Implementación ────────────────────────────────────────────

export class RobotAnimationController implements IRobotAnimationController {

  private readonly manager: RobotAnimationManager

  constructor(manager: RobotAnimationManager) {
    this.manager = manager
  }

  play(state: RobotState, force = false): boolean {
    if (!this.manager.isConnected) return false

    const current = this.manager.currentState

    // Respetar estados bloqueantes
    if (!force && current && BLOCKING_STATES.has(current)) {
      const currentPriority = STATE_METADATA_MAP[current].priority
      const nextPriority    = STATE_METADATA_MAP[state].priority
      if (nextPriority < currentPriority) return false
    }

    // No re-disparar el mismo estado
    if (current === state) return false

    this.manager.play(state)
    return true
  }

  stop(fadeSecs = 0.5): void {
    this.manager.stop(fadeSecs)
  }

  force(state: RobotState): void {
    this.manager.play(state)
  }

  reset(): void {
    this.manager.play('idle')
  }

  get currentState(): RobotState | null {
    return this.manager.currentState
  }

  get isTransitioning(): boolean {
    return this.manager.isTransitioning
  }

  get isReady(): boolean {
    return this.manager.isConnected
  }
}
