/**
 * RobotErrorBoundary.tsx
 * ─────────────────────────────────────────────────────────────
 * ErrorBoundary de clase para envolver la escena 3D.
 *
 * Captura cualquier error dentro del Canvas (GLB no encontrado,
 * WebGL no disponible, error de shader, etc.) y muestra un
 * fallback elegante en lugar de crashear toda la app.
 * ─────────────────────────────────────────────────────────────
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children:  ReactNode;
  /** Nodo a renderizar si ocurre un error. Si no se pasa, usa el fallback por defecto. */
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
    if (this.state.hasError) {
      return this.props.fallback ?? <RobotCanvasFallbackUI error={this.state.error} />;
    }
    return this.props.children;
  }
}

// ── Fallback visual por defecto ───────────────────────────────

export function RobotCanvasFallbackUI({ error }: { error: Error | null }) {
  const isGlbMissing = error?.message?.includes('robot.glb') ||
                       error?.message?.includes('Could not load') ||
                       error?.message?.includes('valid JSON');

  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px',
        textAlign: 'center',
      }}
    >
      {isGlbMissing ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '11px', color: 'rgba(44,42,39,0.65)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            Robot no disponible
          </p>
          <p style={{ fontSize: '10px', color: 'rgba(44,42,39,0.45)', fontFamily: 'monospace' }}>
            Coloca robot.glb en /public
          </p>
        </div>
      ) : (
        <p style={{ fontSize: '11px', color: 'rgba(44,42,39,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Escena no disponible
        </p>
      )}
    </div>
  );
}
