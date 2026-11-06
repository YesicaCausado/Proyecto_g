import { Component, type ErrorInfo, type ReactNode } from 'react';
import AppLoader from './AppLoader';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary] No fue posible renderizar la ruta.', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <AppLoader
          message="No se pudo abrir esta sección"
          error="Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa, recarga la página."
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
