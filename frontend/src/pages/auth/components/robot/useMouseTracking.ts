/**
 * useMouseTracking.ts
 * ─────────────────────────────────────────────────────────────
 * Mouse tracking premium para el robot Neuron.
 *
 * Principios:
 *   · Solo head y neck — NUNCA el rootGroup completo.
 *   · Lerp extremadamente suave (factor 0.035–0.045 por frame).
 *   · Offset aditivo (+=) sobre lo que el mixer ya puso.
 *     El mixer resetea cada frame → nuestra adición siempre
 *     queda acotada por MAX_HEAD_RAD / MAX_NECK_RAD.
 *   · Se desactiva automáticamente en loading/success/error/sleep/greeting.
 *   · Al desactivarse, el offset vuelve suavemente a cero (lerp out).
 *   · Usa useFrame con prioridad 1 para correr DESPUÉS del mixer.
 *
 * Límites angulares:
 *   Head:  ±12° yaw  (Y),  ±6°  pitch (X)
 *   Neck:  ±5°  yaw  (Y),  ±3°  pitch (X)
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef } from 'react'
import { useFrame }          from '@react-three/fiber'
import type { RobotNodeMap } from './RobotAnimationState'
import type { RobotState }   from './RobotStates'

// ── Constantes ────────────────────────────────────────────────

const MAX_HEAD_YAW   =  0.209  // 12°
const MAX_HEAD_PITCH =  0.105  //  6°
const MAX_NECK_YAW   =  0.087  //  5°
const MAX_NECK_PITCH =  0.052  //  3°

/** Qué tan suave sigue el cursor — más pequeño = más suave */
const LERP_ACTIVE   = 0.040
/** Qué tan suave vuelve a cero al desactivarse */
const LERP_DEACTIVE = 0.055

/** Estados donde el tracking está deshabilitado */
const BLOCKED_STATES = new Set<RobotState>([
  'loading', 'success', 'error', 'sleep', 'greeting',
])

// ── Interfaz ──────────────────────────────────────────────────

export interface UseMouseTrackingParams {
  nodes:      RobotNodeMap | null
  robotState: RobotState
}

// ── Hook ─────────────────────────────────────────────────────

export function useMouseTracking({ nodes, robotState }: UseMouseTrackingParams): void {

  // Posición normalizada del mouse [-1, +1]
  const rawMouse = useRef({ x: 0, y: 0 })

  // Offset suavizado actual que se aplica a cada hueso
  // (se computa en useFrame para que sea frame-rate independiente)
  const headOffset = useRef({ x: 0, y: 0 })
  const neckOffset = useRef({ x: 0, y: 0 })

  // ── Listener de mousemove ────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      rawMouse.current = {
        x:  (e.clientX / window.innerWidth)  * 2 - 1,          // [-1, +1]
        y: -((e.clientY / window.innerHeight) * 2 - 1),        // [-1, +1] invertido
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // ── useFrame (prioridad 1 → corre DESPUÉS del mixer) ────
  useFrame(() => {
    const head = nodes?.head
    const neck = nodes?.neck
    if (!head && !neck) return

    const isActive = !BLOCKED_STATES.has(robotState)
    const lerpF    = isActive ? LERP_ACTIVE : LERP_DEACTIVE

    // Target para este frame
    const targetHeadY = isActive ? rawMouse.current.x  * MAX_HEAD_YAW   : 0
    const targetHeadX = isActive ? rawMouse.current.y  * MAX_HEAD_PITCH  : 0
    const targetNeckY = isActive ? rawMouse.current.x  * MAX_NECK_YAW   : 0
    const targetNeckX = isActive ? rawMouse.current.y  * MAX_NECK_PITCH  : 0

    // Lerp del offset almacenado hacia el target
    headOffset.current.y += (targetHeadY - headOffset.current.y) * lerpF
    headOffset.current.x += (targetHeadX - headOffset.current.x) * lerpF
    neckOffset.current.y += (targetNeckY - neckOffset.current.y) * lerpF
    neckOffset.current.x += (targetNeckX - neckOffset.current.x) * lerpF

    // Aplicar como offset aditivo (el mixer ya actualizó los huesos)
    // El mixer resetea a su valor cada frame → += queda siempre acotado
    if (head) {
      head.rotation.y += headOffset.current.y
      head.rotation.x += headOffset.current.x
    }
    if (neck) {
      neck.rotation.y += neckOffset.current.y
      neck.rotation.x += neckOffset.current.x
    }
  }, 1)  // prioridad 1 → después del mixer (useAnimations usa prioridad 0)
}
