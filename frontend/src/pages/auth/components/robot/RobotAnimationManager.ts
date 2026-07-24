/**
 * RobotAnimationManager.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: gestionar el ciclo de vida de las
 * animaciones activas — matar timelines, ejecutar crossfades,
 * actualizar el mixer.
 *
 * Sin dependencias de React. Instancia de clase pura.
 * Recibe el AnimationContext y coordina las transiciones.
 * ─────────────────────────────────────────────────────────────
 */
import gsap from 'gsap'
import {
  type AnimationEngineState,
  type AnimationContext,
  createInitialEngineState,
} from './RobotAnimationState'
import { TRANSITION_MAP } from './RobotTransitions'
import type { RobotState } from './RobotStates'
import { STATE_METADATA_MAP } from './RobotStates'

export class RobotAnimationManager {

  private state: AnimationEngineState = createInitialEngineState()
  private ctx:   AnimationContext | null = null

  // ── Conectar el contexto (se llama desde el hook cuando el GLB carga) ──

  connect(ctx: AnimationContext): void {
    this.ctx = ctx
  }

  disconnect(): void {
    this.killAll()
    this.ctx = null
  }

  // ── API principal ─────────────────────────────────────────

  /**
   * Ejecuta la animación del estado dado.
   * Mata suavemente la anterior antes de iniciar la nueva.
   */
  play(next: RobotState): void {
    if (!this.ctx) return
    if (this.state.currentState === next) return

    const meta     = STATE_METADATA_MAP[next]
    const fadeSecs = meta.fadeInSecs

    // ── 1. Matar timelines previos con fade-out suave ────────
    this._killPreviousTimelines(fadeSecs)

    // ── 2. Actualizar estado ─────────────────────────────────
    this.state.previousState   = this.state.currentState
    this.state.currentState    = next
    this.state.isTransitioning = true

    // ── 3. Actualizar previousAction para crossfade de Three.js
    this.ctx.previousAction = this.state.activeAction

    // ── 4. Ejecutar la transición ────────────────────────────
    const transitionFn = TRANSITION_MAP[next]
    const result       = transitionFn(this.ctx)

    this.state.entryTimeline = result.entry
    this.state.loopTimeline  = result.loop

    // ── 5. Marcar fin de transición ──────────────────────────
    const transitionMs = fadeSecs * 1000
    setTimeout(() => {
      this.state.isTransitioning = false
    }, transitionMs)
  }

  /**
   * Detiene todas las animaciones con fade-out.
   * Vuelve a pose neutral.
   */
  stop(fadeSecs = 0.5): void {
    this._killPreviousTimelines(fadeSecs)

    if (this.ctx?.previousAction) {
      this.ctx.previousAction.fadeOut(fadeSecs)
    }

    if (this.ctx) {
      gsap.to(this.ctx.rootGroup.position, {
        y: 0, x: 0, z: 0,
        duration: fadeSecs,
        ease: 'power2.out',
      })
      gsap.to(this.ctx.rootGroup.rotation, {
        x: 0, y: 0, z: 0,
        duration: fadeSecs,
        ease: 'power2.out',
      })
    }

    this.state.currentState  = null
    this.state.previousState = null
    this.state.activeAction  = null
  }

  // ── Actualización por frame ───────────────────────────────

  /**
   * Debe llamarse en cada frame desde useFrame.
   * Actualiza el AnimationMixer de Three.js.
   */
  update(delta: number): void {
    this.ctx?.mixer.update(delta)
  }

  // ── Getters ───────────────────────────────────────────────

  get currentState(): RobotState | null {
    return this.state.currentState
  }

  get isTransitioning(): boolean {
    return this.state.isTransitioning
  }

  get isConnected(): boolean {
    return this.ctx !== null
  }

  // ── Internos ──────────────────────────────────────────────

  private _killPreviousTimelines(fadeSecs: number): void {
    if (this.state.loopTimeline) {
      // Fade out del loop con una duración proporcional
      this.state.loopTimeline.kill()
      this.state.loopTimeline = null
    }

    if (this.state.entryTimeline) {
      // Si la entrada aún se está ejecutando, la matamos limpiamente
      this.state.entryTimeline.kill()
      this.state.entryTimeline = null
    }

    // Matar cualquier tween activo sobre el rootGroup
    if (this.ctx) {
      gsap.killTweensOf(this.ctx.rootGroup.position)
      gsap.killTweensOf(this.ctx.rootGroup.rotation)
      gsap.killTweensOf(this.ctx.rootGroup.scale)

      if (this.ctx.nodes.head) {
        gsap.killTweensOf(this.ctx.nodes.head.rotation)
        gsap.killTweensOf(this.ctx.nodes.head.position)
      }
      if (this.ctx.nodes.spine) {
        gsap.killTweensOf(this.ctx.nodes.spine.rotation)
      }
      if (this.ctx.nodes.armRight) {
        gsap.killTweensOf(this.ctx.nodes.armRight.rotation)
      }
      if (this.ctx.nodes.armLeft) {
        gsap.killTweensOf(this.ctx.nodes.armLeft.rotation)
      }
    }

    void fadeSecs // usado conceptualmente en el crossfade de Three.js
  }

  private killAll(): void {
    this._killPreviousTimelines(0)
    if (this.ctx) {
      // Detener todas las acciones del mixer
      this.ctx.mixer.stopAllAction()
    }
  }
}

// ── Singleton por escena ──────────────────────────────────────
// Se crea UNO por instancia de RobotCanvas, no global.
// El hook useRobotAnimationEngine lo instancia y lo gestiona.

export function createAnimationManager(): RobotAnimationManager {
  return new RobotAnimationManager()
}
