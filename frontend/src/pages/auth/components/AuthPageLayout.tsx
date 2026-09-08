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
 *
 * CARGA DIFERIDA + GATE:
 *   El formulario (children) NO se muestra hasta que Neuron
 *   (robot 3D) termine de renderizar la escena. Mientras tanto
 *   se muestra un splash de bienvenida con el logo.
 *   Si el 3D falla o tarda demasiado, se muestra un fallback
 *   estático de Neuron y el login siempre queda accesible.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useState, type ReactNode } from 'react';
import { RobotProvider } from '../../../context/RobotContext';
import RobotCanvas       from './robot/RobotCanvas';
import { RobotErrorBoundary } from './robot/RobotErrorBoundary';

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
    position: relative;
    overflow: hidden;
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
    transition: opacity 420ms ease, transform 420ms ease;
  }
  .auth-card-panel.is-hidden {
    opacity: 0;
    transform: translateY(8px);
    pointer-events: none;
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

  /* ── Splash de carga: Neuron inicializándose ─────────────── */
  .auth-splash {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #EDECEA;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    transition: opacity 500ms ease, visibility 500ms ease;
  }
  .auth-splash.is-gone {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .auth-splash-dot {
    width: 14px; height: 14px; border-radius: 50%;
    background: #0B6E99;
    animation: authSplashPulse 1.1s ease-in-out infinite;
  }
  .auth-splash-p {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(55,53,47,0.55);
    font-weight: 500;
    animation: authSplashBlink 1.4s ease-in-out infinite;
  }
  @keyframes authSplashPulse {
    0%,100% { opacity: 0.35; transform: scale(0.9); }
    50%      { opacity: 1;   transform: scale(1.15); }
  }
  @keyframes authSplashBlink {
    0%,100% { opacity: 0.5; }
    50%      { opacity: 1;   }
  }
`;

// Tiempo de espera máximo antes de mostrar el login aunque Neuron
// aún no haya terminado de renderizar (evita que el acceso se bloquee).
const SCENE_READY_TIMEOUT_MS = 10_000;

export default function AuthPageLayout({ children }: AuthPageLayoutProps) {
  // 'pending' → muestra splash y oculta el formulario
  // 'ready'   → Neuron renderizado → muestra formulario
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);

  // Timeout de seguridad: nunca bloquear el acceso para siempre.
  useEffect(() => {
    const t = window.setTimeout(() => setSceneReady(true), SCENE_READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  const onReady = () => setSceneReady(true);
  // Si el 3D falla, no mostramos ningún robot falso: solo revelamos el
  // formulario y dejamos el panel vacío (solo la marca en la esquina).
  const onError  = () => setSceneError(true);

  const revealForm = sceneReady || sceneError;

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
            <RobotErrorBoundary onError={onError} fallback={null}>
              <RobotCanvas
                enabled
                className="absolute inset-0"
                onSceneReady={onReady}
                /* El robot.glb es metálico: necesita un environment map o se
                   vería negro/invisible. Se usa un environment local brillante
                   (Lightformers, sin descarga HDR desde CDN). El post-proceso
                   pesado y las sombras se omiten por rendimiento. */
                environment
                effects={false}
                shadows={false}
              />
            </RobotErrorBoundary>

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

          {/* ── Slot de contenido (formulario) ─────────── */}
          <div className={`auth-card-panel ${revealForm ? '' : 'is-hidden'}`}>
            {children}
          </div>

        </div>
      </div>

      {/* ── Splash mientras Neuron (robot.glb) se inicializa ── */}
      {/* Se usa un spinner neutro — ningún robot falso. */}
      <div className={`auth-splash ${revealForm ? 'is-gone' : ''}`} aria-hidden={revealForm}>
        <div className="auth-splash-dot" />
        <p className="auth-splash-p">Inicializando Neuron…</p>
      </div>
    </RobotProvider>
  );
}