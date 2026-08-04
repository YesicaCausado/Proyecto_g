/**
 * RobotContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Controlador central del robot. Fuente única de verdad para:
 *   · Estado reactivo del robot (state, meta, isTransitioning)
 *   · Driver del formulario   (onEmailFocus, onSubmit, …)
 *
 * ESCALABLE — cualquier pantalla puede hacer:
 *   1. Envolver su árbol con <RobotProvider>
 *   2. Consumir useRobotContext() desde cualquier descendiente
 *   sin pasar props entre componentes intermedios.
 *
 * SOLID > Dependency Inversion:
 *   Los componentes dependen de esta abstracción (el contexto),
 *   no de useRobotController / useRobotStateDriver directamente.
 * ─────────────────────────────────────────────────────────────
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import {
  useRobotController,
  type UseRobotControllerResult,
} from '../pages/auth/components/robot/useRobotController';

import {
  useRobotStateDriver,
  type RobotFormDriverHandlers,
} from '../pages/auth/components/robot/useRobotStateDriver';

// ── Forma del contexto ────────────────────────────────────────

export interface RobotContextValue extends UseRobotControllerResult {
  /** Handlers listos para conectar al JSX del formulario */
  driver: RobotFormDriverHandlers;
}

// ── Contexto interno ──────────────────────────────────────────

/**
 * Exportado para que RobotCanvas pueda leer opcionalmente
 * el estado sin lanzar error cuando no hay provider.
 */
export const RobotContext = createContext<RobotContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

/**
 * Coloca este provider en el nivel de la pantalla / layout
 * que necesite controlar al robot.
 *
 * @example
 *   // LoginPage.tsx
 *   <RobotProvider>
 *     <RobotCanvas />   ← lee estado del contexto automáticamente
 *     <LoginCard />     ← conecta handlers del formulario
 *   </RobotProvider>
 */
export function RobotProvider({ children }: { children: ReactNode }) {
  const controller = useRobotController();
  const driver     = useRobotStateDriver(controller.transition);

  /**
   * Solo recreamos el valor del contexto cuando cambian
   * las partes reactivas (state, isTransitioning).
   * Las funciones estables (transition, reset…) se capturan
   * en el primer render y no cambian gracias a useCallback.
   */
  const value = useMemo<RobotContextValue>(
    () => ({
      state:           controller.state,
      isTransitioning: controller.isTransitioning,
      meta:            controller.meta,
      transition:      controller.transition,
      forceTransition: controller.forceTransition,
      canTransition:   controller.canTransition,
      reset:           controller.reset,
      controllerRef:   controller.controllerRef,
      driver,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controller.state, controller.isTransitioning],
  );

  return (
    <RobotContext.Provider value={value}>
      {children}
    </RobotContext.Provider>
  );
}

// ── Hook principal ────────────────────────────────────────────

/**
 * Accede al controlador central del robot desde cualquier componente
 * dentro de <RobotProvider>.
 *
 * Lanza un error descriptivo si se usa fuera del provider.
 */
export function useRobotContext(): RobotContextValue {
  const ctx = useContext(RobotContext);
  if (!ctx) {
    throw new Error(
      '[RobotContext] useRobotContext() debe usarse dentro de <RobotProvider>.\n' +
      'Envuelve la pantalla con <RobotProvider> en su layout o página.',
    );
  }
  return ctx;
}

/**
 * Versión segura: devuelve null si no hay provider activo.
 * Útil para componentes que son opcionales dentro del árbol del robot
 * (ej. RobotCanvas puede montarse standalone sin provider).
 */
export function useRobotContextSafe(): RobotContextValue | null {
  return useContext(RobotContext);
}
