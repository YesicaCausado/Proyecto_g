/**
 * RobotAnimationState.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: definir los tipos del Animation Engine.
 *
 * Sin dependencias de React — puro TypeScript.
 * Consumido por RobotAnimationManager, RobotAnimationController
 * y RobotTransitions.
 * ─────────────────────────────────────────────────────────────
 */
import type * as THREE from 'three'
import type { RobotState } from './RobotStates'

// ── Mapa de nodos extraídos del GLB ──────────────────────────

/**
 * Nodos del modelo encontrados por traversal.
 * Los nombres son case-insensitive: "Head", "head", "mixamorigHead"
 * se normalizan al mismo slot.
 */
export interface RobotNodeMap {
  root:     THREE.Object3D | null
  head:     THREE.Object3D | null
  neck:     THREE.Object3D | null
  spine:    THREE.Object3D | null
  hips:     THREE.Object3D | null
  armRight: THREE.Object3D | null
  armLeft:  THREE.Object3D | null
  foreArmRight: THREE.Object3D | null
  foreArmLeft:  THREE.Object3D | null
}

export function emptyNodeMap(): RobotNodeMap {
  return {
    root:         null,
    head:         null,
    neck:         null,
    spine:        null,
    hips:         null,
    armRight:     null,
    armLeft:      null,
    foreArmRight: null,
    foreArmLeft:  null,
  }
}

/**
 * Construye un NodeMap recorriendo el grafo de escena del GLB.
 * Usa coincidencia parcial case-insensitive para ser robusto
 * frente a diferentes convenciones de nombres en distintos rigs.
 */
export function buildNodeMap(scene: THREE.Object3D): RobotNodeMap {
  const map = emptyNodeMap()
  map.root = scene

  scene.traverse((obj) => {
    const n = obj.name.toLowerCase()

    if (!map.head     && (n.includes('head')))                       map.head     = obj
    if (!map.neck     && (n.includes('neck')))                       map.neck     = obj
    if (!map.spine    && (n.includes('spine') || n.includes('chest'))) map.spine  = obj
    if (!map.hips     && (n.includes('hip')   || n.includes('pelvis'))) map.hips  = obj

    if (!map.armRight && (n.includes('rightarm')  || n.includes('arm_r')   ||
                          n.includes('upperarm.r') || n.includes('upperarm_r') ||
                          (n.includes('arm') && (n.includes('right') || n.endsWith('.r')))))
      map.armRight = obj

    if (!map.armLeft  && (n.includes('leftarm')   || n.includes('arm_l')   ||
                          n.includes('upperarm.l') || n.includes('upperarm_l') ||
                          (n.includes('arm') && (n.includes('left') || n.endsWith('.l')))))
      map.armLeft = obj

    if (!map.foreArmRight && (n.includes('forearm') && (n.includes('right') || n.endsWith('.r') || n.includes('_r'))))
      map.foreArmRight = obj

    if (!map.foreArmLeft  && (n.includes('forearm') && (n.includes('left')  || n.endsWith('.l') || n.includes('_l'))))
      map.foreArmLeft = obj
  })

  return map
}

// ── Estado activo del motor ───────────────────────────────────

export interface AnimationEngineState {
  /** Estado que está reproduciendo en este momento */
  currentState:    RobotState | null
  /** Estado anterior (para crossfade de salida) */
  previousState:   RobotState | null
  /** true durante la ventana de transición */
  isTransitioning: boolean
  /** Timeline de GSAP de la transición de entrada activa */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entryTimeline:   any | null
  /** Timeline de GSAP del loop continuo (idle float, loading bob, etc.) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loopTimeline:    any | null
  /** AnimationAction de Three.js activa */
  activeAction:    THREE.AnimationAction | null
}

export function createInitialEngineState(): AnimationEngineState {
  return {
    currentState:    null,
    previousState:   null,
    isTransitioning: false,
    entryTimeline:   null,
    loopTimeline:    null,
    activeAction:    null,
  }
}

// ── Contexto que reciben las funciones de transición ─────────

export interface AnimationContext {
  /** Acciones disponibles por nombre de clip */
  actions:  Record<string, THREE.AnimationAction | undefined>
  /** Mixer de Three.js */
  mixer:    THREE.AnimationMixer
  /** Nodos del rig */
  nodes:    RobotNodeMap
  /** Grupo raíz del modelo (para root motion GSAP) */
  rootGroup: THREE.Object3D
  /** Estado anterior (útil para crossfade) */
  previousAction: THREE.AnimationAction | null
}

// ── Nombre de clips del GLB ───────────────────────────────────
// Los clips reales detectados en el modelo robot.glb

export const GLB_CLIPS = {
  IDLE:     'Character|IDLE',
  WALK:     'Character|WALK',
  WELCOME:  'Character|WELCOME',
  AUDIO_1:  'Character|Audio_1',
  AUDIO_2:  'Character|Audio_2',
} as const

export type GLBClipName = typeof GLB_CLIPS[keyof typeof GLB_CLIPS]
