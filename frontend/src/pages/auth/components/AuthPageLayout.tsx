/**
 * AuthPageLayout.tsx
 * ─────────────────────────────────────────────────────────────
 * Layout compartido para TODAS las páginas de autenticación:
 *   - LoginPage
 *   - ForgotPasswordPage
 *   - ResetPasswordPage
 *   - (cualquier pantalla futura que necesite el robot)
 *
 * Robot panel (izq/arriba) + Card panel (der/abajo).
 * Fully responsive: columna en mobile, fila en ≥768px.
 * ─────────────────────────────────────────────────────────────
 */
import type { ReactNode } from 'react';
import { RobotProvider } from '../../../context/RobotContext';
import RobotCanvas       from './robot/RobotCanvas';

interface AuthPageLayoutProps {
  /** Contenido de la tarjeta derecha (formulario) */
  children: ReactNode;
}

const CSS = `
  .auth-outer {
    min-height: 100vh;
    background: #EDECEA;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    padding: 16px;
  }
  .auth-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 900px;
    border-radius: 28px;
    overflow: hidden;
    box-shadow:
      0 2px 8px rgba(55,53,47,0.06),
      0 16px 48px rgba(55,53,47,0.10);
  }
  .auth-robot-panel {
    position: relative;
    background: #EDECEA;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    overflow: hidden;
  }
  .auth-card-panel {
    background: #F4F2EF;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
  }
  @media (min-width: 768px) {
    .auth-container {
      flex-direction: row;
      min-height: 560px;
    }
    .auth-robot-panel {
      flex: 1;
      min-height: 560px;
    }
    .auth-card-panel {
      width: 400px;
      min-width: 360px;
      min-height: 560px;
      padding: 48px 40px;
    }
  }
`;

export default function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <RobotProvider>
      <style>{CSS}</style>

      <div className="auth-outer">
        <div className="auth-container">

          {/* ── Robot 3D ─────────────────────────────── */}
          <div className="auth-robot-panel">
            <div
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
                boxShadow: 'inset 0 0 32px rgba(55,53,47,0.04)',
              }}
            />
            <RobotCanvas enabled className="absolute inset-0" />
            <p
              style={{
                position: 'absolute', bottom: '16px', left: '20px',
                fontSize: '9px', letterSpacing: '0.18em',
                color: 'rgba(55,53,47,0.25)', textTransform: 'uppercase',
                fontWeight: 500, zIndex: 3, margin: 0,
              }}
            >
              NeuroLearn IA
            </p>
          </div>

          {/* ── Slot de contenido ─────────────────── */}
          <div className="auth-card-panel">
            {children}
          </div>

        </div>
      </div>
    </RobotProvider>
  );
}
