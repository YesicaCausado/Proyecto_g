/**
 * useRobotIdleAnimation.ts
 * ─────────────────────────────────────────────────────────────
 * Animación Idle premium para Neuron.
 *
 * Principio de diseño:
 *   — Corre SOLO en useFrame (sin GSAP) para sincronía perfecta
 *     con el render loop de R3F.
 *   — Los offsets se aplican sobre el rootGroup (wrapper Group),
 *     que el AnimationMixer NUNCA toca — cero conflictos.
 *   — Todo es math puro: sin, cos, lerp. Sin timelines externos.
 *
 * Comportamientos:
 *   1. Respiración   — oscilación Y suave con función seno
 *   2. Balanceo      — rotación Z ~2° con función seno desfasada
 *   3. Cabeza viva   — micro-rotaciones X/Y con ruido de fase
 *   4. Parpadeo      — aleatorio 4–8s, animación de 140ms
 *   5. Movimiento ocular — deriva muy pequeña en X/Y
 * ─────────────────────────────────────────────────────────────
 */
import { useRef, useEffect } from 'react'
import { useFrame }          from '@react-three/fiber'
import * as THREE            from 'three'
import type { RobotNodeMap } from './RobotAnimationState'

// ── Configuración (tweakable) ─────────────────────────────────

const CFG = {
  // Respiración vertical
  breathAmp:    0.018,   // unidades Three.js
  breathFreq:   0.38,    // ciclos/seg — ~23 rpm (lento, meditativo)

  // Balanceo del torso (Z)
  swayAmp:      0.012,   // radianes ≈ 0.7° — imperceptible pero vivo
  swayFreq:     0.22,    // ciclos/seg

  // Micro-movimiento cabeza
  headAmpX:     0.006,   // pitch — mira leve arriba/abajo
  headAmpY:     0.009,   // yaw   — mira leve izquierda/derecha
  headFreqX:    0.17,
  headFreqY:    0.13,
  headPhaseX:   1.3,     // desfase para evitar movimiento sincronizado
  headPhaseY:   2.7,

  // Deriva ocular (se aplica sobre la rotación de la cabeza como offset adicional)
  eyeDriftAmpX: 0.003,
  eyeDriftAmpY: 0.004,
  eyeDriftFreqX: 0.29,
  eyeDriftFreqY: 0.23,

  // Parpadeo
  blinkMinSec:  4.0,     // mínimo entre parpadeos
  blinkMaxSec:  8.0,     // máximo entre parpadeos
  blinkCloseSec: 0.07,   // tiempo en cerrar (rápido)
  blinkOpenSec:  0.10,   // tiempo en abrir (ligeramente más lento)

  // Lerp suavizado de transiciones de entrada/salida del idle
  lerpIn:  0.04,         // qué tan rápido se activan los offsets al entrar en idle
  lerpOut: 0.06,         // qué tan rápido se neutralizan al salir
} as const

// ── Estado interno del hook ──────────────────────────────────

interface IdleState {
  // Base position/rotation cuando el idle empezó
  baseY:       number
  // Tiempo acumulado (propio, para pausar/reanudar limpio)
  elapsed:     number
  // Factor de blend 0→1 cuando se activa, 1→0 cuando se desactiva
  blend:       number
  // Parpadeo
  blinkTimer:  number
  blinkNext:   number
  blinkPhase:  'idle' | 'closing' | 'opening'
  blinkT:      number  // progreso 0..1 de la fase actual
  // Eye meshes encontradas en el GLB
  eyeMeshes:   THREE.Mesh[]
  eyeBaseScaleY: number[]
  // Flag inicialización
  initialized: boolean
}

// ── Helper: buscar meshes de ojos ────────────────────────────

function findEyeMeshes(scene: THREE.Object3D): { meshes: THREE.Mesh[], scalesY: number[] } {
  const meshes:  THREE.Mesh[]  = []
  const scalesY: number[]      = []

  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return
    const n = obj.name.toLowerCase()
    // Buscamos cualquier mesh que contenga "eye", "ojo", "lid", "blink"
    if (n.includes('eye') || n.includes('ojo') || n.includes('lid') || n.includes('blink')) {
      meshes.push(obj as THREE.Mesh)
      scalesY.push(obj.scale.y)
    }
  })

  return { meshes, scalesY }
}

// ── Hook ─────────────────────────────────────────────────────

export interface UseRobotIdleAnimationParams {
  /** Grupo raíz del modelo (el wrapper Group — NO un hueso del rig) */
  rootGroup:  THREE.Group | null
  /** Nodos del rig extraídos del GLB */
  nodes:      RobotNodeMap
  /** Escena completa del GLB (para buscar meshes de ojos) */
  scene:      THREE.Object3D | null
  /** Si false, los offsets se interpolan a cero y el hook se neutraliza */
  isActive:   boolean
}

export function useRobotIdleAnimation({
  rootGroup,
  nodes,
  scene,
  isActive,
}: UseRobotIdleAnimationParams): void {

  const s = useRef<IdleState>({
    baseY:        0,
    elapsed:      0,
    blend:        0,
    blinkTimer:   0,
    blinkNext:    CFG.blinkMinSec + Math.random() * (CFG.blinkMaxSec - CFG.blinkMinSec),
    blinkPhase:  'idle',
    blinkT:       0,
    eyeMeshes:    [],
    eyeBaseScaleY: [],
    initialized:  false,
  })

  // Buscar meshes de ojos cuando la escena esté disponible
  useEffect(() => {
    if (!scene) return
    const { meshes, scalesY } = findEyeMeshes(scene)
    s.current.eyeMeshes      = meshes
    s.current.eyeBaseScaleY  = scalesY
    if (import.meta.env.DEV) {
      console.info('[IdleAnimation] Eye meshes found:', meshes.map(m => m.name))
    }
  }, [scene])

  // Capturar la posición base cuando se activa por primera vez
  useEffect(() => {
    if (isActive && rootGroup && !s.current.initialized) {
      s.current.baseY       = rootGroup.position.y
      s.current.initialized = true
    }
    if (!isActive) {
      s.current.initialized = false
    }
  }, [isActive, rootGroup])

  useFrame((_, delta) => {
    if (!rootGroup) return

    const st = s.current

    // ── 1. Blend in/out ────────────────────────────────────
    if (isActive) {
      st.blend = Math.min(1, st.blend + delta / 0.6)   // fade-in en ~600ms
    } else {
      st.blend = Math.max(0, st.blend - delta / 0.4)   // fade-out en ~400ms
    }

    const b = st.blend
    if (b === 0) return   // completamente desactivado — no tocar nada

    // ── 2. Avanzar tiempo propio ──────────────────────────
    if (isActive) st.elapsed += delta

    const t = st.elapsed

    // ── 3. Respiración (Y) ────────────────────────────────
    const breathOffset = Math.sin(t * Math.PI * 2 * CFG.breathFreq) * CFG.breathAmp
    rootGroup.position.y = st.baseY + breathOffset * b

    // ── 4. Balanceo torso (Z) ─────────────────────────────
    const swayOffset = Math.sin(t * Math.PI * 2 * CFG.swayFreq + 0.8) * CFG.swayAmp
    rootGroup.rotation.z = swayOffset * b

    // ── 5. Micro-movimiento cabeza ────────────────────────
    if (nodes.head) {
      // Añadir sobre la rotación que ya tiene el IDLE clip del mixer
      // Usamos un offset temporal — NO sobreescribimos la rotación del mixer
      const headOffsetX = Math.sin(t * Math.PI * 2 * CFG.headFreqX + CFG.headPhaseX) * CFG.headAmpX
      const headOffsetY = Math.sin(t * Math.PI * 2 * CFG.headFreqY + CFG.headPhaseY) * CFG.headAmpY

      // Drift ocular sobre la cabeza (frecuencia diferente para parecerse a un micro-movimiento natural)
      const eyeOffsetX  = Math.sin(t * Math.PI * 2 * CFG.eyeDriftFreqX + 0.5) * CFG.eyeDriftAmpX
      const eyeOffsetY  = Math.cos(t * Math.PI * 2 * CFG.eyeDriftFreqY + 1.1) * CFG.eyeDriftAmpY

      nodes.head.rotation.x += (headOffsetX + eyeOffsetX) * b
      nodes.head.rotation.y += (headOffsetY + eyeOffsetY) * b
    }

    // ── 6. Parpadeo ───────────────────────────────────────
    if (isActive && st.eyeMeshes.length > 0) {
      st.blinkTimer += delta

      if (st.blinkPhase === 'idle' && st.blinkTimer >= st.blinkNext) {
        // Iniciar parpadeo
        st.blinkPhase = 'closing'
        st.blinkT     = 0
        st.blinkTimer = 0
        st.blinkNext  = CFG.blinkMinSec + Math.random() * (CFG.blinkMaxSec - CFG.blinkMinSec)
      }

      if (st.blinkPhase === 'closing') {
        st.blinkT += delta / CFG.blinkCloseSec
        if (st.blinkT >= 1) {
          st.blinkT     = 0
          st.blinkPhase = 'opening'
        }
        const scaleY = THREE.MathUtils.lerp(1, 0.05, _easeIn(st.blinkT))
        _applyBlinkScale(st, scaleY)
      } else if (st.blinkPhase === 'opening') {
        st.blinkT += delta / CFG.blinkOpenSec
        if (st.blinkT >= 1) {
          st.blinkT     = 0
          st.blinkPhase = 'idle'
          _applyBlinkScale(st, 1)
        } else {
          const scaleY = THREE.MathUtils.lerp(0.05, 1, _easeOut(st.blinkT))
          _applyBlinkScale(st, scaleY)
        }
      }
    }
  })
}

// ── Helpers de easing ─────────────────────────────────────────

function _easeIn(t: number): number {
  return t * t
}

function _easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function _applyBlinkScale(st: IdleState, scaleY: number): void {
  for (let i = 0; i < st.eyeMeshes.length; i++) {
    st.eyeMeshes[i].scale.y = (st.eyeBaseScaleY[i] ?? 1) * scaleY
  }
}
