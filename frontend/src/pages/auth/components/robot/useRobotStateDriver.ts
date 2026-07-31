/**
 * useRobotStateDriver.ts
 * -----------------------------------------------------------------
 * Responsabilidad unica: traducir eventos del formulario de login
 * en transiciones del robot. Es el puente entre la UI y la maquina.
 *
 * SOLID > Single Responsibility: este hook NO renderiza nada,
 * NO conoce Three.js, NO toca GSAP. Solo mapea eventos a estados.
 *
 * Uso:
 *   const driver = useRobotStateDriver(transition)
 *   <input onFocus={driver.onEmailFocus} onChange={driver.onEmailChange} />
 *   <input onFocus={driver.onPasswordFocus} />
 *   <form onSubmit={driver.onSubmit(handleLogin)} />
 * -----------------------------------------------------------------
 */

import { useCallback, useRef, useEffect } from 'react'
import type { RobotState } from './RobotStates'

// ── Config de inactividad ─────────────────────────────────────

/** ms sin actividad antes de que el robot se duerma */
const SLEEP_AFTER_MS = 30_000

/** ms sin actividad antes de resetear a idle (antes de sleep) */
const IDLE_AFTER_BLUR_MS = 4_000

// ── Tipos ────────────────────────────────────────────────────

/** Funcion de transicion que viene de useRobotController */
export type TransitionFn = (to: RobotState, reason?: string) => boolean

/** Conjunto de handlers listos para conectar al JSX del formulario */
export interface RobotFormDriverHandlers {
  /** Input de usuario/email recibe focus */
  onEmailFocus:     () => void
  /** Input de usuario/email pierde focus */
  onEmailBlur:      () => void
  /** Input de usuario/email recibe input del teclado */
  onEmailChange:    () => void
  /** Input de password recibe focus */
  onPasswordFocus:  () => void
  /** Input de password pierde focus */
  onPasswordBlur:   () => void
  /** Input de password recibe input del teclado */
  onPasswordChange: () => void
  /**
   * Envuelve el onSubmit del formulario.
   * Devuelve un handler que transiciona a loading,
   * espera la promesa y transiciona a success o error.
   *
   * @example
   *   <form onSubmit={driver.onSubmit(handleLogin)}>
   */
  onSubmit: (
    loginFn: (e: React.FormEvent) => Promise<void>
  ) => (e: React.FormEvent) => Promise<void>
  /**
   * Llama directamente al robot con el resultado del login.
   * Util si el submit ya se maneja fuera del driver.
   */
  notifySuccess: () => void
  notifyError:   () => void
}

// ── Hook ─────────────────────────────────────────────────────

export function useRobotStateDriver(
  transition: TransitionFn,
): RobotFormDriverHandlers {

  const sleepTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeField   = useRef<'email' | 'password' | null>(null)

  // ── Helpers internos ────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (sleepTimer.current)  clearTimeout(sleepTimer.current)
    if (idleTimer.current)   clearTimeout(idleTimer.current)
    sleepTimer.current  = null
    idleTimer.current   = null
  }, [])

  const scheduleSleep = useCallback(() => {
    clearTimers()
    idleTimer.current = setTimeout(() => {
      // Si no hay campo activo, va a idle primero
      if (!activeField.current) transition('idle', 'inactivity-pre-sleep')
    }, IDLE_AFTER_BLUR_MS)

    sleepTimer.current = setTimeout(() => {
      transition('sleep', 'inactivity-sleep')
    }, SLEEP_AFTER_MS)
  }, [clearTimers, transition])

  // Reiniciar timer de sleep en cualquier actividad
  const resetActivity = useCallback(() => {
    clearTimers()
    scheduleSleep()
  }, [clearTimers, scheduleSleep])

  // ── Handlers de email ────────────────────────────────────

  const onEmailFocus = useCallback(() => {
    activeField.current = 'email'
    clearTimers()
    transition('lookingEmail', 'email-focus')
  }, [clearTimers, transition])

  const onEmailBlur = useCallback(() => {
    activeField.current = null
    scheduleSleep()
  }, [scheduleSleep])

  const onEmailChange = useCallback(() => {
    resetActivity()
    // Mantiene lookingEmail mientras el usuario escribe
    transition('lookingEmail', 'email-typing')
  }, [resetActivity, transition])

  // ── Handlers de password ─────────────────────────────────

  const onPasswordFocus = useCallback(() => {
    activeField.current = 'password'
    clearTimers()
    transition('lookingPassword', 'password-focus')
  }, [clearTimers, transition])

  const onPasswordBlur = useCallback(() => {
    activeField.current = null
    scheduleSleep()
  }, [scheduleSleep])

  const onPasswordChange = useCallback(() => {
    resetActivity()
    transition('lookingPassword', 'password-typing')
  }, [resetActivity, transition])

  // ── Submit ───────────────────────────────────────────────

  const notifySuccess = useCallback(() => {
    clearTimers()
    transition('success', 'login-success')
  }, [clearTimers, transition])

  const notifyError = useCallback(() => {
    clearTimers()
    transition('error', 'login-error')
  }, [clearTimers, transition])

  const onSubmit = useCallback(
    (loginFn: (e: React.FormEvent) => Promise<void>) =>
      async (e: React.FormEvent): Promise<void> => {
        clearTimers()
        activeField.current = null
        transition('loading', 'form-submit')
        try {
          await loginFn(e)
          notifySuccess()
        } catch {
          notifyError()
        }
      },
    [clearTimers, transition, notifySuccess, notifyError],
  )

  // ── Limpiar al desmontar ─────────────────────────────────

  useEffect(() => {
    // Inicia el timer de sleep desde que el componente monta
    scheduleSleep()
    return clearTimers
  }, [scheduleSleep, clearTimers])

  return {
    onEmailFocus,
    onEmailBlur,
    onEmailChange,
    onPasswordFocus,
    onPasswordBlur,
    onPasswordChange,
    onSubmit,
    notifySuccess,
    notifyError,
  }
}
