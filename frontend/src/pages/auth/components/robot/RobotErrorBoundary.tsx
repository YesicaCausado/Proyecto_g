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

function RobotCanvasFallbackUI({ error }: { error: Error | null }) {
  const isGlbMissing = error?.message?.includes('robot.glb') ||
                       error?.message?.includes('Could not load') ||
                       error?.message?.includes('valid JSON');

  return (
    <div
      style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '16px',
      }}
    >
      {/* Placeholder animado del robot */}
      <div
        style={{
          width:        '80px',
          height:       '80px',
          borderRadius: '50%',
          border:       '2px solid rgba(11,110,153,0.3)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          animation:    'pulse 2s ease-in-out infinite',
          background:   'radial-gradient(circle, rgba(11,110,153,0.08) 0%, transparent 70%)',
        }}
      >
        {/* Silueta robot SVG inline */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="4" width="16" height="12" rx="3" fill="rgba(11,110,153,0.3)" />
          <circle cx="16" cy="10" r="2" fill="rgba(11,110,153,0.6)" />
          <circle cx="24" cy="10" r="2" fill="rgba(11,110,153,0.6)" />
          <rect x="8"  y="18" width="24" height="14" rx="3" fill="rgba(11,110,153,0.25)" />
          <rect x="2"  y="20" width="5"  height="9"  rx="2" fill="rgba(11,110,153,0.2)" />
          <rect x="33" y="20" width="5"  height="9"  rx="2" fill="rgba(11,110,153,0.2)" />
          <rect x="13" y="32" width="5"  height="7"  rx="2" fill="rgba(11,110,153,0.2)" />
          <rect x="22" y="32" width="5"  height="7"  rx="2" fill="rgba(11,110,153,0.2)" />
          {/* Antena */}
          <line x1="20" y1="4" x2="20" y2="1" stroke="rgba(11,110,153,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="1" r="1" fill="rgba(11,110,153,0.5)" />
        </svg>
      </div>

      {isGlbMissing ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
            Robot no disponible
          </p>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace' }}>
            Coloca robot.glb en /public
          </p>
        </div>
      ) : (
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Escena no disponible
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
