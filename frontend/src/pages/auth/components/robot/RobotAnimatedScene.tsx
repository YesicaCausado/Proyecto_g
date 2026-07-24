/**
 * RobotAnimatedScene.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: componente R3F que combina el modelo
 * 3D con el motor de animaciones.
 *
 * Es el único componente que usa useRobotAnimationEngine.
 * RobotModel solo renderiza — no sabe nada de animaciones.
 *
 * Flujo:
 *   1. Renderiza RobotModel con un groupRef
 *   2. Cuando el GLB carga, llama a onClipsLoaded
 *   3. El engine conecta actions + mixer + nodes
 *   4. El engine reproduce el estado inicial (greeting)
 *   5. Cuando robotState cambia, llama a controller.play()
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef }         from 'react'
import { Preload }                 from '@react-three/drei'
import type { AnimationClip }      from 'three'
import type * as THREE             from 'three'

import { useRobotAnimationEngine } from './useRobotAnimationEngine'
import { useRobotIdleAnimation }   from './useRobotIdleAnimation'
import { useMouseTracking }        from './useMouseTracking'
import RobotModel                  from './RobotModel'
import { ROBOT_TRANSFORM }         from './RobotConfig'
import type { RobotState }         from './RobotStates'

// ── Variable de módulo: sobrevive al ciclo mount/unmount/mount
// de React StrictMode (en prod el componente solo monta una vez).
// Se resetea si el usuario recarga la página — comportamiento correcto.
let _greetingHasPlayed = false

// ── Props ─────────────────────────────────────────────────────

export interface RobotAnimatedSceneProps {
  /** Estado actual del robot (viene de RobotContext o props) */
  robotState:   RobotState
  /** Callback cuando el modelo y el motor están listos */
  onReady?:     (clips: AnimationClip[]) => void
}

// ── Componente ────────────────────────────────────────────────

export default function RobotAnimatedScene({
  robotState,
  onReady,
}: RobotAnimatedSceneProps) {

  const { groupRef, controller, onClipsLoaded, isReady, nodes, scene } =
    useRobotAnimationEngine('idle')

  // ── Flag de módulo — no se resetea con StrictMode ────────
  const greetingPlayed = useRef(_greetingHasPlayed)

  // ── Idle animation procedural (useFrame, sin GSAP) ───────
  useRobotIdleAnimation({
    rootGroup:  groupRef.current,
    nodes:      nodes ?? { root: null, head: null, neck: null, spine: null, hips: null,
                           armRight: null, armLeft: null, foreArmRight: null, foreArmLeft: null },
    scene,
    isActive:   isReady && robotState === 'idle',
  })

  // ── Mouse tracking — solo cabeza y cuello, lerp muy suave ─
  useMouseTracking({
    nodes,
    robotState,
  })

  // ── Saludo inicial — UNA sola vez por sesión ─────────────
  useEffect(() => {
    if (!isReady || greetingPlayed.current) return
    greetingPlayed.current  = true
    _greetingHasPlayed      = true   // persiste en módulo
    controller.force('greeting')
  }, [isReady, controller])

  // ── Reaccionar a cambios de estado externos (formulario) ─
  // Solo estados accionables desde el formulario.
  // 'idle' y 'greeting' los gestiona el engine internamente.
  useEffect(() => {
    if (!isReady || !greetingPlayed.current) return
    if (robotState === 'idle' || robotState === 'greeting') return
    controller.play(robotState)
  }, [robotState, isReady, controller])

  // ── Callback adaptado para RobotModel.onLoaded ───────────
  const handleLoaded = (clips: AnimationClip[], scene: THREE.Object3D) => {
    onClipsLoaded(clips, scene)
    onReady?.(clips)
  }

  return (
    <>
      <RobotModel
        groupRef={groupRef}
        position={ROBOT_TRANSFORM.position}
        rotation={ROBOT_TRANSFORM.rotation}
        scale={ROBOT_TRANSFORM.scale}
        castShadow
        onLoaded={handleLoaded}
      />
      <Preload all />
    </>
  )
}
