/**
 * RobotErrorBoundary.tsx
 * ─────────────────────────────────────────────────────────────
 * ErrorBoundary de clase para envolver la escena 3D.
 *
 * Captura cualquier error dentro del Canvas (GLB no encontrado,
 * WebGL no disponible, error de shader, etc.) y muestra un
 * fallback neutro en lugar de crashear toda la app.
 *
 * NUNCA renderiza un robot falso: usamos exclusivamente robot.glb.
 * Si la escena falla, el fallback por defecto es vacío (null) y el
 * layout se encarga de mostrar el estado correspondiente.
 * ─────────────────────────────────────────────────────────────
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children:  ReactNode;
  /** Nodo a renderizar si ocurre un error. Si no se pasa, no se muestra nada. */
  fallback?: ReactNode;
  /** Callback para logging externo (Sentry, etc.) */
  onError?:  (error: Error, info: string) => void;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class RobotErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log solo en DEV — en producción delegar a onError prop
    if (import.meta.env.DEV) {
      console.warn('[RobotErrorBoundary] Error en escena 3D:', error.message);
      console.warn('[RobotErrorBoundary] Detalle:', info.componentStack?.slice(0, 300));
    }
    this.props.onError?.(error, info.componentStack ?? '');
  }

  render() {
    // Sin robot falso: solo se muestra lo que el padre indique (o nada).
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
