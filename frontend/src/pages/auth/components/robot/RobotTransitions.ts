/**
 * RobotTransitions.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: definir las animaciones de cada estado.
 *
 * Principio Open/Closed — agregar un estado = agregar una función.
 * Nunca se modifica código existente.
 *
 * Estética: Apple · OpenAI · Linear · Figure AI
 * — transiciones de 400–900ms, easing profesional, sin cortes
 * — clips GLB como base, GSAP como capa procedural sobre el root
 * ─────────────────────────────────────────────────────────────
 */
import gsap from 'gsap'
import * as THREE from 'three'
import type { AnimationContext } from './RobotAnimationState'
import { GLB_CLIPS } from './RobotAnimationState'
import { ROBOT_TRANSFORM } from './RobotConfig'

// ── Tipos ─────────────────────────────────────────────────────

/** Resultado de una transición: entry timeline + loop timeline */
export interface TransitionResult {
  /** Timeline de entrada (played once) — puede ser null si no hay GSAP extra */
  entry: gsap.core.Timeline | null
  /** Timeline de loop continuo — null si no hay loop procedural */
  loop:  gsap.core.Timeline | null
}

/** Firma de cualquier función de transición */
export type TransitionFn = (ctx: AnimationContext) => TransitionResult

// ── Helpers internos ──────────────────────────────────────────

/**
 * Crossfade desde la acción anterior a la nueva.
 * Si no hay acción anterior, simplemente arranca la nueva.
 */
function crossfadeTo(
  ctx:      AnimationContext,
  clipName: string,
  duration: number,
  timeScale = 1,
  loop      = true,
): THREE.AnimationAction | null {
  const action = ctx.actions[clipName]
  if (!action) return null

  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
  action.clampWhenFinished = !loop
  action.setEffectiveTimeScale(timeScale)
  action.setEffectiveWeight(1)

  if (ctx.previousAction && ctx.previousAction !== action) {
    action.reset()
    action.play()
    ctx.previousAction.crossFadeTo(action, duration, true)
  } else if (!action.isRunning()) {
    action.reset().fadeIn(duration).play()
  }

  return action
}


// ── IDLE ──────────────────────────────────────────────────────

export function transitionIdle(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.IDLE, 0.7)

  const root  = ctx.rootGroup
  const head  = ctx.nodes.head
  const neck  = ctx.nodes.neck
  const spine = ctx.nodes.spine
  const homeY = ROBOT_TRANSFORM.position[1]

  // Restaurar root + nodos del rig a neutral con easing suave
  // (los estados lookingEmail/Password animan los nodos directamente)
  const entry = gsap.timeline({ defaults: { ease: 'power2.out' } })

  entry.to(root.rotation,   { x: 0, y: 0, z: 0, duration: 0.75 }, 0)
  entry.to(root.position,   { x: 0, y: homeY, z: 0, duration: 0.70 }, 0)

  if (head)  entry.to(head.rotation,  { x: 0, y: 0, z: 0, duration: 0.65 }, 0)
  if (neck)  entry.to(neck.rotation,  { x: 0, y: 0, z: 0, duration: 0.70 }, 0)
  if (spine) entry.to(spine.rotation, { x: 0, y: 0, z: 0, duration: 0.75 }, 0)

  // Loop: flotación suave vertical (premium — muy sutil)
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(root.position, {
    y: homeY + 0.04,
    duration: 2.2,
    ease: 'sine.inOut',
  })

  return { entry, loop }
}

// ── GREETING ─────────────────────────────────────────────────
//
// Secuencia (total ~3.0s):
//   0.00 — 0.90s  Robot sube flotando desde homeY-0.55 hasta homeY (absoluto)
//   0.70 — 1.20s  Brazo derecho sube suavemente
//   1.20 — 1.80s  Micro-wave: dos oscilaciones del brazo (saludo sutil)
//   1.80 — 2.50s  Brazo baja, torso leve inclinación de bienvenida
//   2.50 — 3.00s  Todo vuelve a posición neutral → idle

export function transitionGreeting(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.WELCOME, 0.6, 0.85, false)

  const root  = ctx.rootGroup
  const armR  = ctx.nodes.armRight
  const head  = ctx.nodes.head

  // Posición Y absoluta (nunca relativa al estado actual — evita acumulación en StrictMode)
  const homeY  = ROBOT_TRANSFORM.position[1]
  const entryY = homeY - 0.55

  // Forzar posición de inicio de manera explícita
  gsap.set(root.position, { y: entryY, x: 0, z: 0 })
  gsap.set(root.rotation, { x: 0, y: 0, z: 0 })

  // Resetear brazo/cabeza a neutral antes de animar
  if (armR) gsap.set(armR.rotation, { x: 0, y: 0, z: 0 })
  if (head) gsap.set(head.rotation, { x: 0, y: 0, z: 0 })

  // onInterrupt: si el timeline se mata antes de terminar,
  // el robot siempre vuelve a homeY — nunca queda desplazado
  const resetAll = () => {
    gsap.set(root.position, { y: homeY, x: 0, z: 0 })
    gsap.set(root.rotation, { x: 0, y: 0, z: 0 })
    if (armR) gsap.set(armR.rotation, { x: 0, y: 0, z: 0 })
    if (head) gsap.set(head.rotation, { x: 0, y: 0, z: 0 })
  }

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    onInterrupt: resetAll,
  })

  // ── FASE 1 (0.00–0.90s): flotar desde entryY → homeY ────
  tl.to(root.position, {
    y: homeY,
    duration: 0.90,
    ease: 'power2.out',
  }, 0)

  // ── FASE 2 (0.70–1.20s): brazo derecho sube elegante ────
  if (armR) {
    tl.to(armR.rotation, {
      z: -0.60,
      x:  0.08,
      duration: 0.55,
      ease: 'power2.out',
    }, 0.70)
  }

  // ── FASE 3 (1.20–1.80s): micro-wave — 2 oscilaciones ───
  if (armR) {
    tl
      .to(armR.rotation, { z: -0.75, duration: 0.18, ease: 'sine.inOut' }, 1.20)
      .to(armR.rotation, { z: -0.52, duration: 0.18, ease: 'sine.inOut' }, 1.38)
      .to(armR.rotation, { z: -0.70, duration: 0.15, ease: 'sine.inOut' }, 1.56)
      .to(armR.rotation, { z: -0.55, duration: 0.15, ease: 'sine.inOut' }, 1.71)
  }

  // ── Cabeza: leve inclinación de bienvenida ───────────────
  if (head) {
    tl.to(head.rotation, { y: 0.08, x: -0.04, duration: 0.60, ease: 'power2.out'   }, 0.75)
    tl.to(head.rotation, { y: 0,    x:  0,    duration: 0.70, ease: 'power2.inOut'  }, 2.10)
  }

  // ── FASE 4 (1.80–2.50s): brazo baja, inclinación torso ──
  if (armR) {
    tl.to(armR.rotation, { z: 0, x: 0, duration: 0.70, ease: 'power2.inOut' }, 1.80)
  }
  tl.to(root.rotation, { x: 0.025, duration: 0.50, ease: 'power1.out'  }, 2.00)

  // ── FASE 5 (2.50–3.00s): volver a neutral ───────────────
  tl.to(root.rotation, { x: 0, y: 0, z: 0, duration: 0.50, ease: 'power2.out' }, 2.50)

  // Loop flotación sutil mientras dura el greeting
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(root.position, {
    y: homeY + 0.025,
    duration: 2.0,
    ease: 'sine.inOut',
  })

  return { entry: tl, loop }
}

// ── LOOKING EMAIL ─────────────────────────────────────────────
//
// El robot gira el rootGroup hacia el formulario (derecha del canvas).
// El mixer controla los huesos — GSAP solo toca el wrapper Group.
// Duración: 600ms. Al hacer blur → idle restaura en 750ms.

export function transitionLookingEmail(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.AUDIO_1, 0.5, 0.7)

  const root  = ctx.rootGroup
  const homeY = ROBOT_TRANSFORM.position[1]

  const onInterrupt = () => {
    gsap.set(root.position, { x: 0, z: 0, y: homeY })
    gsap.set(root.rotation, { x: 0, y: 0, z: 0 })
  }

  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    onInterrupt,
  })

  // Girar el cuerpo entero hacia el formulario (a la derecha)
  tl.to(root.rotation, {
    y:  0.42,   // ~24° — claramente visible, no exagerado
    x:  0.06,   // leve pitch hacia abajo — mirando el campo
    z:  0,
    duration: 0.60,
  }, 0)

  // Micro lean-in hacia el usuario
  tl.to(root.position, {
    z:  0.06,
    y:  homeY,
    duration: 0.60,
    ease: 'power2.out',
  }, 0)

  // Loop: flotación suave de atención
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(root.position, {
    y: homeY + 0.022,
    duration: 1.9,
    ease: 'sine.inOut',
  })

  return { entry: tl, loop }
}

// ── LOOKING PASSWORD ──────────────────────────────────────────
//
// Gesto de privacidad: el robot gira la cabeza HACIA EL OTRO LADO
// (se aleja del formulario) y baja levemente la mirada.
// Transmite "no miro tu contraseña" de forma elegante y sutil.
// Duración: 650ms. Vuelve a idle al perder el foco.

export function transitionLookingPassword(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.IDLE, 0.5, 0.8)

  const root  = ctx.rootGroup
  const homeY = ROBOT_TRANSFORM.position[1]

  const onInterrupt = () => {
    gsap.set(root.position, { x: 0, z: 0, y: homeY })
    gsap.set(root.rotation, { x: 0, y: 0, z: 0 })
  }

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    onInterrupt,
  })

  // Gira hacia la IZQUIERDA (opuesto al formulario) — gesto de privacidad
  // ~20° — claramente visible, comunica intención sin exageración
  tl.to(root.rotation, {
    y: -0.35,    // ~20° hacia la izquierda (lejos del formulario)
    x:  0.08,   // pitch abajo más notable — mirada discreta al suelo
    z:  0,
    duration: 0.65,
    ease: 'power2.inOut',
  }, 0)

  // Retrocede levemente — da espacio personal al usuario
  tl.to(root.position, {
    z: -0.03,
    y:  homeY,
    duration: 0.65,
    ease: 'power2.out',
  }, 0)

  // Loop: respiración muy lenta — quietud, respeto
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(root.position, {
    y: homeY + 0.015,
    duration: 2.4,
    ease: 'sine.inOut',
  })

  return { entry: tl, loop }
}

// ── LOADING ───────────────────────────────────────────────────

export function transitionLoading(ctx: AnimationContext): TransitionResult {
  // Walk clip a velocidad reducida = efecto "pensativo en el lugar"
  crossfadeTo(ctx, GLB_CLIPS.WALK, 0.4, 0.35)

  const entry = gsap.timeline()
  // Volver a posición neutral
  entry.to(ctx.rootGroup.rotation, {
    x: 0, y: 0, z: 0,
    duration: 0.5,
    ease: 'power2.out',
  })
  entry.to(ctx.rootGroup.position, {
    z: 0,
    y: ctx.rootGroup.position.y,
    duration: 0.5,
    ease: 'power2.out',
  }, '<')

  // Loop: cabeceo pensativo izquierda-derecha
  const loop = gsap.timeline({ repeat: -1 })
  loop
    .to(ctx.rootGroup.rotation, { y:  0.09, duration: 0.9, ease: 'sine.inOut' })
    .to(ctx.rootGroup.rotation, { y: -0.09, duration: 0.9, ease: 'sine.inOut' })
    .to(ctx.rootGroup.rotation, { y:  0.00, duration: 0.6, ease: 'sine.inOut' })

  return { entry, loop }
}

// ── SUCCESS ───────────────────────────────────────────────────

export function transitionSuccess(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.AUDIO_2, 0.3, 1, false)

  const yBase = ctx.rootGroup.position.y
  const entry = gsap.timeline()

  // Bounce de alegría: sube, pausa, vuelve
  entry
    .to(ctx.rootGroup.position, {
      y: yBase + 0.22,
      duration: 0.32,
      ease: 'power2.out',
    })
    .to(ctx.rootGroup.position, {
      y: yBase - 0.04,
      duration: 0.22,
      ease: 'power2.in',
    })
    .to(ctx.rootGroup.position, {
      y: yBase + 0.10,
      duration: 0.18,
      ease: 'power2.out',
    })
    .to(ctx.rootGroup.position, {
      y: yBase,
      duration: 0.30,
      ease: 'bounce.out',
    })

  // Rotación de celebración
  entry.to(ctx.rootGroup.rotation, {
    z: 0.06,
    duration: 0.20,
    ease: 'power1.out',
  }, 0)
  entry.to(ctx.rootGroup.rotation, {
    z: -0.04,
    duration: 0.20,
    ease: 'power1.inOut',
  }, 0.3)
  entry.to(ctx.rootGroup.rotation, {
    z: 0,
    x: 0,
    y: 0,
    duration: 0.35,
    ease: 'power2.out',
  }, 0.55)

  // Loop: flotación celebratoria suave
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(ctx.rootGroup.position, {
    y: yBase + 0.05,
    duration: 1.4,
    ease: 'sine.inOut',
  })

  return { entry, loop }
}

// ── ERROR ─────────────────────────────────────────────────────

export function transitionError(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.IDLE, 0.25)

  const xBase = ctx.rootGroup.position.x
  const entry = gsap.timeline()

  // Shake horizontal del cuerpo — negación
  entry
    .to(ctx.rootGroup.position, { x: xBase - 0.07, duration: 0.07, ease: 'power2.out' })
    .to(ctx.rootGroup.position, { x: xBase + 0.07, duration: 0.07, ease: 'power2.inOut' })
    .to(ctx.rootGroup.position, { x: xBase - 0.05, duration: 0.07, ease: 'power2.inOut' })
    .to(ctx.rootGroup.position, { x: xBase + 0.05, duration: 0.07, ease: 'power2.inOut' })
    .to(ctx.rootGroup.position, { x: xBase - 0.03, duration: 0.07, ease: 'power2.inOut' })
    .to(ctx.rootGroup.position, { x: xBase,        duration: 0.10, ease: 'power2.out' })

  // Después del shake: leve caída de hombros (inclinación hacia delante)
  entry.to(ctx.rootGroup.rotation, {
    x:  0.07,
    y:  0,
    z:  0,
    duration: 0.4,
    ease: 'power2.out',
  }, 0.42)
  entry.to(ctx.rootGroup.rotation, {
    x: 0,
    duration: 0.6,
    ease: 'power2.inOut',
    delay: 0.5,
  })

  // Loop: flotación mínima — decaída
  const yStart = ctx.rootGroup.position.y
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(ctx.rootGroup.position, {
    y: yStart + 0.015,
    duration: 2.4,
    ease: 'sine.inOut',
  })

  return { entry, loop }
}

// ── SLEEP ─────────────────────────────────────────────────────

export function transitionSleep(ctx: AnimationContext): TransitionResult {
  // IDLE muy lento = efecto de somnolencia
  crossfadeTo(ctx, GLB_CLIPS.IDLE, 1.2, 0.3)

  const entry = gsap.timeline()

  // Cabeza/cuerpo cae suavemente hacia adelante
  entry.to(ctx.rootGroup.rotation, {
    x:  0.18,
    y:  0,
    z:  0,
    duration: 1.4,
    ease: 'power1.inOut',
  })
  entry.to(ctx.rootGroup.position, {
    y: ctx.rootGroup.position.y - 0.08,
    duration: 1.4,
    ease: 'power1.inOut',
  }, '<')

  // Loop: respiración muy lenta — amplitud pequeña
  const yBase = ctx.rootGroup.position.y - 0.08
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(ctx.rootGroup.position, {
    y: yBase + 0.015,
    duration: 3.0,
    ease: 'sine.inOut',
  })

  return { entry, loop }
}

// ── CELEBRATE ────────────────────────────────────────────────
//
// Primer login exitoso o logro importante.
// Ambos brazos suben, doble bounce, wiggle del torso.
// Más intenso que success — transmite euforia.
// Dura ~3.2s y vuelve sola a idle.

export function transitionCelebrate(ctx: AnimationContext): TransitionResult {
  crossfadeTo(ctx, GLB_CLIPS.WELCOME, 0.3, 1.1, false)

  const root  = ctx.rootGroup
  const armR  = ctx.nodes.armRight
  const armL  = ctx.nodes.armLeft
  const head  = ctx.nodes.head
  const homeY = ROBOT_TRANSFORM.position[1]

  const resetAll = () => {
    gsap.set(root.position, { y: homeY, x: 0, z: 0 })
    gsap.set(root.rotation, { x: 0, y: 0, z: 0 })
    if (armR) gsap.set(armR.rotation, { x: 0, y: 0, z: 0 })
    if (armL) gsap.set(armL.rotation, { x: 0, y: 0, z: 0 })
    if (head) gsap.set(head.rotation, { x: 0, y: 0, z: 0 })
  }

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    onInterrupt: resetAll,
  })

  // ── Bounce 1 ────────────────────────────────────────────
  tl.to(root.position, { y: homeY + 0.28, duration: 0.22, ease: 'power2.out' }, 0)
  tl.to(root.position, { y: homeY - 0.04, duration: 0.18, ease: 'power2.in'  }, 0.22)
  tl.to(root.position, { y: homeY + 0.14, duration: 0.15, ease: 'power2.out' }, 0.40)
  tl.to(root.position, { y: homeY,        duration: 0.20, ease: 'bounce.out' }, 0.55)

  // ── Bounce 2 (más suave) ─────────────────────────────────
  tl.to(root.position, { y: homeY + 0.10, duration: 0.18, ease: 'power2.out' }, 0.85)
  tl.to(root.position, { y: homeY,        duration: 0.22, ease: 'bounce.out' }, 1.03)

  // ── Ambos brazos arriba ──────────────────────────────────
  if (armR) {
    tl.to(armR.rotation, { z: -1.15, x: 0.05, duration: 0.30, ease: 'power2.out' }, 0.05)
    tl.to(armR.rotation, { z: -0.90, duration: 0.12, ease: 'sine.inOut' }, 0.65)
    tl.to(armR.rotation, { z: -1.15, duration: 0.12, ease: 'sine.inOut' }, 0.77)
    tl.to(armR.rotation, { z: 0, x: 0, duration: 0.50, ease: 'power2.inOut' }, 1.80)
  }
  if (armL) {
    tl.to(armL.rotation, { z: 1.15, x: 0.05, duration: 0.30, ease: 'power2.out' }, 0.05)
    tl.to(armL.rotation, { z: 0.90, duration: 0.12, ease: 'sine.inOut' }, 0.65)
    tl.to(armL.rotation, { z: 1.15, duration: 0.12, ease: 'sine.inOut' }, 0.77)
    tl.to(armL.rotation, { z: 0, x: 0, duration: 0.50, ease: 'power2.inOut' }, 1.80)
  }

  // ── Wiggle torso ────────────────────────────────────────
  tl.to(root.rotation, { z:  0.09, duration: 0.12 }, 0.28)
  tl.to(root.rotation, { z: -0.07, duration: 0.12 }, 0.40)
  tl.to(root.rotation, { z:  0.05, duration: 0.10 }, 0.52)
  tl.to(root.rotation, { z:  0,    duration: 0.25, ease: 'power2.out' }, 0.62)

  // ── Cabeza: inclinación de alegría ──────────────────────
  if (head) {
    tl.to(head.rotation, { x: -0.12, y: 0.05, duration: 0.30, ease: 'power2.out' }, 0.10)
    tl.to(head.rotation, { x: 0, y: 0, duration: 0.50, ease: 'power2.inOut' }, 1.50)
  }

  // ── Volver todo a neutral ────────────────────────────────
  tl.to(root.rotation, { x: 0, y: 0, z: 0, duration: 0.40, ease: 'power2.out' }, 2.20)
  tl.to(root.position, { y: homeY, x: 0, z: 0, duration: 0.40, ease: 'power2.out' }, 2.20)

  // Loop flotación festiva
  const loop = gsap.timeline({ repeat: -1, yoyo: true })
  loop.to(root.position, { y: homeY + 0.05, duration: 1.1, ease: 'sine.inOut' })

  return { entry: tl, loop }
}

// ── Mapa completo ─────────────────────────────────────────────

import type { RobotState } from './RobotStates'

export const TRANSITION_MAP: Record<RobotState, TransitionFn> = {
  idle:            transitionIdle,
  greeting:        transitionGreeting,
  lookingEmail:    transitionLookingEmail,
  lookingPassword: transitionLookingPassword,
  loading:         transitionLoading,
  success:         transitionSuccess,
  error:           transitionError,
  sleep:           transitionSleep,
  celebrate:       transitionCelebrate,
}
