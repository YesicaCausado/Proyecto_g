/**
 * useRobotAnimationEngine.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: conectar el Animation Engine al ciclo
 * de vida de React y al contexto de R3F.
 *
 * DEBE ejecutarse DENTRO del Canvas (contexto R3F activo).
 *
 * Retorna:
 *   - groupRef: ref que se pasa a RobotModel
 *   - controller: la API play() para código externo
 *   - onClipsLoaded: callback que se pasa a RobotModel.onLoaded
 * ─────────────────────────────────────────────────────────────
 */
import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useFrame }      from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import type * as THREE   from 'three'
import type { AnimationClip, Group } from 'three'

import { buildNodeMap }              from './RobotAnimationState'
import type { RobotNodeMap }         from './RobotAnimationState'
import { createAnimationManager }    from './RobotAnimationManager'
import { RobotAnimationController }  from './RobotAnimationController'
import type { IRobotAnimationController } from './RobotAnimationController'
import type { RobotState }           from './RobotStates'

// ── Resultado del hook ────────────────────────────────────────

export interface UseRobotAnimationEngineResult {
  /** Ref que se adjunta al grupo raíz del modelo en Three.js */
  groupRef:      React.RefObject<Group | null>
  /** API pública: controller.play('idle'), etc. */
  controller:    IRobotAnimationController
  /**
   * Callback para RobotModel.onLoaded.
   * Recibe los clips del GLB y activa el motor.
   */
  onClipsLoaded: (clips: AnimationClip[], scene: THREE.Object3D) => void
  /** true cuando el motor está listo y reproduciendo */
  isReady:       boolean
  /** Nodos del rig (expuesto para hooks de animación procedural) */
  nodes:         RobotNodeMap | null
  /** Escena completa del GLB (para búsqueda de eye meshes, etc.) */
  scene:         THREE.Object3D | null
}

// ── Hook ─────────────────────────────────────────────────────

export function useRobotAnimationEngine(
  initialState: RobotState = 'greeting',
): UseRobotAnimationEngineResult {

  const groupRef = useRef<Group>(null)

  // Estado interno: clips del GLB (se set cuando el modelo carga)
  const [clips, setClips]         = useState<AnimationClip[]>([])
  const [scene, setScene]         = useState<THREE.Object3D | null>(null)
  const [nodes, setNodes]         = useState<RobotNodeMap | null>(null)
  const [isReady, setIsReady]     = useState(false)

  // useAnimations de @react-three/drei:
  // — maneja el AnimationMixer internamente
  // — devuelve actions: Record<name, AnimationAction>
  const { actions, mixer } = useAnimations(clips, groupRef)

  // Manager y Controller (instancias estables, creadas una sola vez)
  const manager    = useMemo(() => createAnimationManager(), [])
  const controller = useMemo(() => new RobotAnimationController(manager), [manager])

  // ── Callback que RobotModel llama cuando el GLB carga ────────
  const onClipsLoaded = useCallback(
    (loadedClips: AnimationClip[], loadedScene: THREE.Object3D) => {
      setClips(loadedClips)
      setScene(loadedScene)
    },
    [],
  )

  // ── Conectar el manager al contexto cuando actions estén listos
  useEffect(() => {
    if (!mixer || !groupRef.current || Object.keys(actions).length === 0 || !scene) return

    const nodes    = buildNodeMap(scene)
    const rootGroup = groupRef.current

    manager.connect({
      actions:        actions as Record<string, THREE.AnimationAction | undefined>,
      mixer,
      nodes,
      rootGroup,
      previousAction: null,
    })

    setNodes(nodes)
    setIsReady(true)

    // Reproducir el estado inicial
    manager.play(initialState)

    return () => {
      manager.disconnect()
      setIsReady(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer, actions, scene])

  // ── Actualizar el mixer en cada frame ───────────────────────
  useFrame((_, delta) => {
    manager.update(delta)
  })

  return {
    groupRef: groupRef as React.RefObject<Group | null>,
    controller,
    onClipsLoaded,
    isReady,
    nodes,
    scene,
  }
}
