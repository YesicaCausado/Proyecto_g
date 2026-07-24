/**
 * RobotController.ts
 */
import {
  type RobotState,
  type RobotStateTransition,
  type RobotStateMetadata,
  STATE_METADATA_MAP,
  BLOCKING_STATES,
  FALLBACK_STATE,
  INITIAL_STATE,
} from './RobotStates'

export type StateChangeListener = (
  previous:   RobotState,
  next:       RobotState,
  transition: RobotStateTransition,
) => void

export type UnsubscribeFn = () => void

export interface IRobotController {
  readonly currentState:    RobotState
  readonly isTransitioning: boolean
  transition(to: RobotState, reason?: string, onComplete?: () => void): boolean
  forceTransition(to: RobotState, reason?: string): void
  canTransition(from: RobotState, to: RobotState): boolean
  onStateChange(listener: StateChangeListener): UnsubscribeFn
  reset(): void
  destroy(): void
}

type TransitionRule = RobotState[] | '*'
type TransitionMatrix = Partial<Record<RobotState, TransitionRule>>

const TRANSITION_MATRIX: TransitionMatrix = {
  idle:            '*',
  greeting:        ['idle', 'lookingEmail', 'lookingPassword', 'sleep'],
  lookingEmail:    ['idle', 'lookingPassword', 'loading', 'sleep'],
  lookingPassword: ['idle', 'lookingEmail',    'loading', 'sleep'],
  loading:         ['success', 'error'],
  success:         ['idle'],
  error:           ['idle', 'lookingEmail', 'lookingPassword'],
  sleep:           ['idle', 'greeting'],
}

export class RobotStateMachine implements IRobotController {

  private _current:         RobotState = INITIAL_STATE
  private _isTransitioning: boolean    = false
  private _listeners:       Set<StateChangeListener> = new Set()
  private _autoIdleTimer:   ReturnType<typeof setTimeout> | null = null

  get currentState():    RobotState { return this._current }
  get isTransitioning(): boolean    { return this._isTransitioning }

  canTransition(from: RobotState, to: RobotState): boolean {
    if (from === to) return false
    const rule = TRANSITION_MATRIX[from]
    if (!rule) return false
    if (rule === '*') return true
    return (rule as RobotState[]).includes(to)
  }

  transition(to: RobotState, reason?: string, onComplete?: () => void): boolean {
    const meta: RobotStateMetadata = STATE_METADATA_MAP[to]
    if (
      BLOCKING_STATES.has(this._current) &&
      STATE_METADATA_MAP[this._current].priority >= meta.priority
    ) {
      return false
    }
    if (!this.canTransition(this._current, to)) return false
    this._executeTransition(to, meta.fadeInSecs, reason, onComplete)
    return true
  }

  forceTransition(to: RobotState, reason?: string): void {
    const meta = STATE_METADATA_MAP[to]
    this._executeTransition(to, meta.fadeInSecs, reason ?? 'forced')
  }

  onStateChange(listener: StateChangeListener): UnsubscribeFn {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  reset(): void {
    this._clearAutoIdleTimer()
    this._isTransitioning = false
    this._current         = INITIAL_STATE
  }

  destroy(): void {
    this._clearAutoIdleTimer()
    this._listeners.clear()
  }

  private _executeTransition(
    to:          RobotState,
    durationSec: number,
    reason?:     string,
    onComplete?: () => void,
  ): void {
    const previous = this._current
    const transition: RobotStateTransition = { from: previous, to, durationSec, reason, onComplete }
    this._clearAutoIdleTimer()
    this._isTransitioning = true
    this._current         = to
    this._listeners.forEach(fn => fn(previous, to, transition))
    const ms = durationSec * 1000
    setTimeout(() => {
      this._isTransitioning = false
      onComplete?.()
      this._scheduleAutoIdle(to)
    }, ms)
  }

  private _scheduleAutoIdle(state: RobotState): void {
    const meta = STATE_METADATA_MAP[state]
    if (meta.idleAfterMs === null) return
    this._autoIdleTimer = setTimeout(() => {
      if (this._current === state) {
        this._executeTransition(
          FALLBACK_STATE,
          STATE_METADATA_MAP[FALLBACK_STATE].fadeInSecs,
          'auto-idle after ' + state,
        )
      }
    }, meta.idleAfterMs)
  }

  private _clearAutoIdleTimer(): void {
    if (this._autoIdleTimer !== null) {
      clearTimeout(this._autoIdleTimer)
      this._autoIdleTimer = null
    }
  }
}

let _instance: RobotStateMachine | null = null

export function getRobotController(): RobotStateMachine {
  if (!_instance) _instance = new RobotStateMachine()
  return _instance
}

export function destroyRobotController(): void {
  _instance?.destroy()
  _instance = null
}