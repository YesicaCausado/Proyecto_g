/**
 * RobotGSAPBridge.ts
 * -----------------------------------------------------------------
 * Responsabilidad unica: ser el punto de conexion entre la maquina
 * de estados y GSAP. Cada funcion corresponde a UN estado.
 *
 * SOLID > Open/Closed: agregar un nuevo estado = agregar una
 * funcion nueva aqui. Nada mas cambia.
 *
 * SOLID > Dependency Inversion: el bridge depende de refs de
 * Three.js (Object3D) y de gsap (cuando se instale), no de React.
 *
 * Como conectarlo:
 *   1. Instala gsap:  npm install gsap
 *   2. Importa gsap:  import gsap from 'gsap'
 *   3. Implementa cada funcion usando el groupRef del robot
 *   4. Registra el bridge en useRobotController via onStateChange()
 *
 * Firma de cada animacion:
 *   animateXxx(refs: RobotRefs): void
 *
 * El parametro 'refs' contiene los Object3D del robot (cabeza,
 * cuerpo, brazos) que GSAP tweenara directamente.
 * -----------------------------------------------------------------
 */

import type { Group, Object3D } from 'three'
import type { RobotState } from './RobotStates'

// ── Refs que se pasaran al bridge cuando el GLB este cargado ──

export interface RobotRefs {
  /** Grupo raiz del modelo completo */
  root:      Group | null
  /** Nodo de la cabeza (nombre en el GLB: buscar 'Head' o 'head') */
  head:      Object3D | null
  /** Nodo del cuerpo/torso */
  body:      Object3D | null
  /** Brazo derecho */
  armRight:  Object3D | null
  /** Brazo izquierdo */
  armLeft:   Object3D | null
  /** Ojos (pueden ser meshes separados) */
  eyeLeft:   Object3D | null
  eyeRight:  Object3D | null
}

// ── Tipo del bridge completo ──────────────────────────────────

export type RobotAnimationBridge = Record<
  RobotState,
  (refs: RobotRefs) => void
>

// ── Implementaciones (stubs vacios — listos para GSAP) ────────
//
// Cada funcion tiene un JSDoc que describe EXACTAMENTE que debe
// hacer GSAP cuando se implemente. Sirve como contrato.

/**
 * IDLE
 * - gsap.to(refs.root, { y: '+=0.05', yoyo: true, repeat: -1, duration: 2, ease: 'sine.inOut' })
 * - Parpadeo: gsap.to(refs.eyeLeft/eyeRight scale.y, { to: 0, yoyo: true, repeat: -1, repeatDelay: 4 })
 * - Ninguna rotacion adicional
 */
export function animateIdle(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * GREETING
 * - gsap.to(refs.armRight.rotation, { z: -1.2, duration: 0.4, ease: 'back.out' })
 * - gsap.to(refs.armRight.rotation, { z: 0, duration: 0.4, delay: 0.6, ease: 'back.in' })
 * - gsap.to(refs.head.rotation, { y: 0.15, duration: 0.3 }) — leve giro hacia el usuario
 * - Al completar: vuelve a idle automaticamente (idleAfterMs: 2800)
 */
export function animateGreeting(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * LOOKING EMAIL
 * - gsap.to(refs.head.rotation, { y: -0.25, x: 0.05, duration: 0.25, ease: 'power2.out' })
 * - gsap.to(refs.body.rotation, { y: -0.08, duration: 0.3 }) — leve inclinacion del torso
 * - Mantener hasta que llegue otro estado
 */
export function animateLookingEmail(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * LOOKING PASSWORD
 * - gsap.to(refs.head.rotation, { y: 0.1, x: 0.12, duration: 0.25, ease: 'power2.out' })
 * - gsap.to(refs.armLeft, { rotation.z: 0.3, duration: 0.3 }) — mano cerca de la cara
 * - Expresion de concentracion / curiosidad
 */
export function animateLookingPassword(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * LOADING
 * - gsap.to(refs.head.rotation, { y: 0.2, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
 * - gsap.to(refs.root, { y: '-=0.03', duration: 0.4, yoyo: true, repeat: -1 }) — espera
 * - Detener todos los tweens al salir de este estado
 */
export function animateLoading(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * SUCCESS
 * - gsap.to(refs.root.position, { y: '+=0.3', duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 })
 * - gsap.to(refs.armRight.rotation, { z: -1.5, duration: 0.25, ease: 'back.out(2)' })
 * - gsap.to(refs.armLeft.rotation,  { z:  1.5, duration: 0.25, ease: 'back.out(2)' })
 * - Emitir particulas desde DOM (optional — elemento HTML superpuesto)
 */
export function animateSuccess(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * ERROR
 * - gsap.to(refs.head.rotation, { y: -0.3, duration: 0.1, yoyo: true, repeat: 3, ease: 'power1.inOut' })
 * - gsap.to(refs.body.position, { x: '-=0.04', duration: 0.08, yoyo: true, repeat: 4 }) — shake
 * - gsap.to(refs.head.rotation, { x: 0.1, duration: 0.2, delay: 0.5 }) — decepcion
 */
export function animateError(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

/**
 * SLEEP
 * - gsap.to(refs.head.rotation, { x: 0.5, duration: 1.2, ease: 'power1.inOut' }) — cabeza cae
 * - gsap.to(refs.root, { y: '-=0.05', duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }) — respiracion lenta
 * - gsap.to(refs.eyeLeft/eyeRight scale.y, { to: 0.05, duration: 0.8 }) — ojos casi cerrados
 * - Mostrar ZZZ flotando (elemento DOM superpuesto — fuera de Three.js)
 */
export function animateSleep(_refs: RobotRefs): void {
  // TODO: implementar con GSAP
}

// ── Bridge completo como mapa ─────────────────────────────────
//
// Usar con useRobotController.onStateChange:
//
//   const bridge = ROBOT_ANIMATION_BRIDGE
//   controller.onStateChange((_, next) => bridge[next](refs))

export const ROBOT_ANIMATION_BRIDGE: RobotAnimationBridge = {
  idle:            animateIdle,
  greeting:        animateGreeting,
  lookingEmail:    animateLookingEmail,
  lookingPassword: animateLookingPassword,
  loading:         animateLoading,
  success:         animateSuccess,
  error:           animateError,
  sleep:           animateSleep,
  celebrate:       animateSuccess,   // reutiliza success hasta tener implementación propia
}

// ── Helper: detener todas las animaciones GSAP del robot ──────
//
// Llamar siempre que el robot entre en un nuevo estado,
// para evitar que tweens anteriores interfieran.
//
//   import gsap from 'gsap'
//   export function killRobotTweens(refs: RobotRefs): void {
//     const targets = Object.values(refs).filter(Boolean)
//     targets.forEach(t => gsap.killTweensOf(t))
//   }

export function killRobotTweens(_refs: RobotRefs): void {
  // TODO: descomenta cuando GSAP este instalado:
  // import gsap from 'gsap'
  // const targets = Object.values(_refs).filter(Boolean)
  // targets.forEach(t => gsap.killTweensOf(t))
}
