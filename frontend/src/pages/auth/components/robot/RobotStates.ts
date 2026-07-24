/**
 * RobotStates.ts
 * -----------------------------------------------------------------
 * Responsabilidad unica: definir TODOS los estados del robot,
 * sus metadatos y las transiciones automaticas.
 *
 * SOLID > Open/Closed: agregar un estado nuevo = agregar una
 * entrada al enum y al STATE_METADATA_MAP. Nada mas cambia.
 * -----------------------------------------------------------------
 */

// ── 1. Union de estados ──────────────────────────────────────

/**
 * Cada valor describe una intencion de comportamiento, no una
 * animacion concreta. Las animaciones se asignan en RobotGSAPBridge.
 */
export type RobotState =
  | 'idle'             // Reposo: respiracion suave, mirada al frente
  | 'greeting'         // Primera carga: saludo con la mano
  | 'lookingEmail'     // Focus en campo email/usuario: robot mira izquierda
  | 'lookingPassword'  // Focus en campo password: robot mira con curiosidad
  | 'loading'          // Submit en proceso: robot pensativo, leve cabeceo
  | 'success'          // Login exitoso: robot celebra, salta
  | 'error'            // Login fallido: robot niega con la cabeza
  | 'sleep'            // Inactividad prolongada: robot dormita
  | 'celebrate'        // Primer login / logro importante: ambos brazos arriba

// ── 2. Metadata de cada estado ───────────────────────────────

export interface RobotStateMetadata {
  readonly state:        RobotState
  /** Nombre legible para logs y DevTools */
  readonly label:        string
  /**
   * Prioridad de la cola de transiciones.
   * Mayor numero = interrumpe estados de menor prioridad.
   * Rango recomendado: 0 (mas bajo) - 100 (mas alto)
   */
  readonly priority:     number
  /** true = la animacion hace loop hasta que otro estado la interrumpa */
  readonly loopable:     boolean
  /**
   * Milisegundos hasta volver automaticamente a 'idle'.
   * null = no vuelve automaticamente (hay que llamar a transition()).
   */
  readonly idleAfterMs:  number | null
  /**
   * Duracion sugerida de crossfade de entrada en segundos.
   * RobotGSAPBridge la usara cuando conecte las animaciones.
   */
  readonly fadeInSecs:   number
  /**
   * Duracion sugerida de crossfade de salida en segundos.
   */
  readonly fadeOutSecs:  number
  /**
   * Descripcion de QUE deberia hacer GSAP en este estado.
   * Sirve como contrato para quien implemente RobotGSAPBridge.
   */
  readonly gsapHint:     string
}

// ── 3. Mapa de metadata (source of truth) ────────────────────

export const STATE_METADATA_MAP: Record<RobotState, RobotStateMetadata> = {
  idle: {
    state:       'idle',
    label:       'Reposo',
    priority:    0,
    loopable:    true,
    idleAfterMs: null,
    fadeInSecs:  0.6,
    fadeOutSecs: 0.3,
    gsapHint:    'Respiracion lenta (scale Y +-0.5%). Parpadeo cada 3-5s. Mirada al frente.',
  },
  greeting: {
    state:       'greeting',
    label:       'Saludo',
    priority:    10,
    loopable:    false,
    idleAfterMs: 2800,
    fadeInSecs:  0.2,
    fadeOutSecs: 0.4,
    gsapHint:    'Mano derecha sube y baja (wave). Cabeza leve inclinacion. Expresion amigable.',
  },
  lookingEmail: {
    state:       'lookingEmail',
    label:       'Mirando campo usuario',
    priority:    5,
    loopable:    true,
    idleAfterMs: null,
    fadeInSecs:  0.25,
    fadeOutSecs: 0.2,
    gsapHint:    'Cabeza gira ligeramente a la izquierda. Ojos hacia el input. Leve inclinacion hacia adelante.',
  },
  lookingPassword: {
    state:       'lookingPassword',
    label:       'Mirando campo contrasena',
    priority:    5,
    loopable:    true,
    idleAfterMs: null,
    fadeInSecs:  0.25,
    fadeOutSecs: 0.2,
    gsapHint:    'Cabeza levemente inclinada. Expresion de concentracion. Puede taparse los ojos con mano (guino).',
  },
  loading: {
    state:       'loading',
    label:       'Cargando',
    priority:    20,
    loopable:    true,
    idleAfterMs: null,
    fadeInSecs:  0.2,
    fadeOutSecs: 0.2,
    gsapHint:    'Cabeza oscila suavemente de lado a lado (pensativo). Cuerpo leve movimiento de espera.',
  },
  success: {
    state:       'success',
    label:       'Exito',
    priority:    50,
    loopable:    false,
    idleAfterMs: 2500,
    fadeInSecs:  0.15,
    fadeOutSecs: 0.5,
    gsapHint:    'Salto o rebote hacia arriba. Brazos arriba. Expresion de alegria. Particulas celebracion.',
  },
  error: {
    state:       'error',
    label:       'Error',
    priority:    40,
    loopable:    false,
    idleAfterMs: 2000,
    fadeInSecs:  0.15,
    fadeOutSecs: 0.4,
    gsapHint:    'Cabeza niega de izquierda a derecha (x2). Hombros caen. Leve shake del cuerpo.',
  },
  sleep: {
    state:       'sleep',
    label:       'Dormido',
    priority:    1,
    loopable:    true,
    idleAfterMs: null,
    fadeInSecs:  1.2,
    fadeOutSecs: 0.8,
    gsapHint:    'Cabeza cae suavemente. Respiracion lenta exagerada. ZZZ flotando (elemento DOM). Ojos cerrados.',
  },
  celebrate: {
    state:       'celebrate',
    label:       'Celebración',
    priority:    60,
    loopable:    false,
    idleAfterMs: 3200,
    fadeInSecs:  0.15,
    fadeOutSecs: 0.5,
    gsapHint:    'Ambos brazos arriba. Bounce doble. Wiggle torso. Halo más brillante. Vuelve a idle solo.',
  },
}

// ── 4. Constantes de estado ───────────────────────────────────

export const INITIAL_STATE: RobotState = 'greeting'

/** Estados que NO deben ser interrumpidos por eventos de baja prioridad */
export const BLOCKING_STATES: ReadonlySet<RobotState> = new Set<RobotState>([
  'loading',
  'success',
  'error',
  'celebrate',
])

/** Estado de reposo al que se regresa automaticamente */
export const FALLBACK_STATE: RobotState = 'idle'

// ── 5. Contexto de transicion ─────────────────────────────────

export interface RobotStateTransition {
  from:        RobotState
  to:          RobotState
  /** Duracion real de la transicion en segundos (override de fadeInSecs) */
  durationSec: number
  /** Razon de la transicion (para logs y DevTools) */
  reason?:     string
  /** Callback ejecutado AL COMPLETARSE la transicion */
  onComplete?: () => void
}
