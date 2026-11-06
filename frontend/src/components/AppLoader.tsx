import type { ReactNode } from 'react';

interface AppLoaderProps {
  message?: string;
  error?: string;
  onRetry?: () => void;
  onSignOut?: () => void;
  children?: ReactNode;
}

export default function AppLoader({
  message = 'Preparando tu espacio de aprendizaje',
  error,
  onRetry,
  onSignOut,
  children,
}: AppLoaderProps) {
  const logo = `${import.meta.env.BASE_URL}2d.png`;

  return (
    <main
      className={`app-loader${error ? ' app-loader--error' : ''}`}
      role={error ? undefined : 'status'}
      aria-live={error ? undefined : 'polite'}
      aria-busy={!error}
    >
      <div className="app-loader__content">
        <div className="app-loader__mark">
          <span className="app-loader__orbit" aria-hidden="true" />
          <img className="app-loader__logo" src={logo} alt="NeuroLearn IA" />
        </div>
        <p className="app-loader__brand">NeuroLearn <span>IA</span></p>
        <p className="app-loader__message">{error ? message : children ?? message}</p>
        {error && (
          <section className="app-loader__error" role="alert">
            <p>{error}</p>
            <div className="app-loader__actions">
              {onRetry && (
                <button type="button" onClick={onRetry}>
                  Reintentar conexión
                </button>
              )}
              {onSignOut && (
                <button type="button" className="app-loader__secondary" onClick={onSignOut}>
                  Ir al inicio de sesión
                </button>
              )}
            </div>
          </section>
        )}
        {!error && <span className="app-loader__progress" aria-hidden="true" />}
      </div>
    </main>
  );
}
