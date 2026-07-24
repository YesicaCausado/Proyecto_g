/**
 * useRobotController.ts
 * -----------------------------------------------------------------
 * Responsabilidad unica: envolver RobotStateMachine en el ciclo
 * de vida de React y exponer una API reactiva.
 *
 * SOLID > Dependency Inversion: LoginPage y RobotCanvas dependen
 * de este hook (abstraccion), no de RobotStateMachine directamente.
 * -----------------------------------------------------------------
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RobotStateMachine,
  destroyRobotController,
  type IRobotController,
  type StateChangeListener,
} from './RobotController'
import {
  type RobotState,
  type RobotStateTransition,
  STATE_METADATA_MAP,
  INITIAL_STATE,
} from './RobotStates'

// ── Resultado expuesto al consumidor ─────────────────────────

export interface UseRobotControllerResult {
  /** Estado actual del robot (reactivo — dispara re-renders) */
  state:            RobotState
  /** true durante el fadeIn/fadeOut de una transicion */
  isTransitioning:  boolean
  /** Metadata del estado actual (prioridad, label, gsapHint, etc.) */
  meta:             (typeof STATE_METADATA_MAP)[RobotState]
  /**
   * Solicita transicion. Devuelve true si fue aceptada.
   * Rechaza si el estado actual bloquea o la matriz no lo permite.
   */
  transition:       (to: RobotState, reason?: string) => boolean
  /**
   * Fuerza la transicion ignorando prioridades y matriz.
   * Solo para errores criticos o reset manual.
   */
  forceTransition:  (to: RobotState) => void
  /** Verifica si una transicion concreta esta permitida ahora */
  canTransition:    (to: RobotState) => boolean
  /** Reinicia la maquina al estado inicial */
  reset:            () => void
  /** Referencia directa al controlador (para GSAP bridge) */
  controllerRef:    React.RefObject<IRobotController | null>
}

// ── Hook ─────────────────────────────────────────────────────

export function useRobotController(): UseRobotControllerResult {

  // La maquina vive en un ref — no causa re-renders por si sola
  const machineRef = useRef<RobotStateMachine | null>(null)

  // Estado reactivo — solo lo que la UI necesita renderizar
  const [state,           setReactState]    = useState<RobotState>(INITIAL_STATE)
  const [isTransitioning, setTransitioning] = useState(false)

  // ── Inicializar maquina una sola vez ─────────────────────

  if (machineRef.current === null) {
    machineRef.current = new RobotStateMachine()
  }

  // ── Sincronizar con React state ──────────────────────────

  useEffect(() => {
    const machine = machineRef.current!

    const listener: StateChangeListener = (
      _prev: RobotState,
      next:  RobotState,
      t:     RobotStateTransition,
    ) => {
      setReactState(next)
      setTransitioning(true)

      // Marcar transicion completa cuando el fade termina
      const durationMs = t.durationSec * 1000
      const timer = setTimeout(() => setTransitioning(false), durationMs)
      return () => clearTimeout(timer)
    }

    const unsubscribe = machine.onStateChange(listener)

    return () => {
      unsubscribe()
    }
  }, [])

  // ── Limpiar al desmontar ─────────────────────────────────

  useEffect(() => {
    return () => {
      machineRef.current?.destroy()
      destroyRobotController()
    }
  }, [])

  // ── API estable con useCallback ──────────────────────────

  const transition = useCallback(
    (to: RobotState, reason?: string): boolean => {
      return machineRef.current?.transition(to, reason) ?? false
    },
    [],
  )

  const forceTransition = useCallback((to: RobotState): void => {
    machineRef.current?.forceTransition(to, 'forced-from-hook')
  }, [])

  const canTransition = useCallback((to: RobotState): boolean => {
    const machine = machineRef.current
    if (!machine) return false
    return machine.canTransition(machine.currentState, to)
  }, [])

  const reset = useCallback((): void => {
    machineRef.current?.reset()
    setReactState(INITIAL_STATE)
    setTransitioning(false)
  }, [])

  return {
    state,
    isTransitioning,
    meta:            STATE_METADATA_MAP[state],
    transition,
    forceTransition,
    canTransition,
    reset,
    controllerRef:   machineRef as React.RefObject<IRobotController | null>,
  }
}
