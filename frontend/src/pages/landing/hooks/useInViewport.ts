/**
 * useInViewport.ts
 * ─────────────────────────────────────────────────────────────
 * Hook para montar/desmontar contenido costoso (p.ej. un <Canvas>
 * WebGL del robot 3D) SOLO cuando su contenedor está dentro (o
 * cerca) del viewport.
 *
 * Evita saturar la GPU con varios contextos WebGL simultáneos:
 * cada sección renderiza su robot únicamente mientras es visible.
 *
 * Devuelve un ref para el contenedor y un booleano `inView`.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from 'react';

interface Options {
  /** Margen (px) alrededor del viewport para precargar antes de ser visible */
  rootMargin?: string;
  /** Cuánto debe ser visible (0–1) para considerarse "en pantalla" */
  threshold?: number;
  /** Valor inicial de inView (útil para secciones visibles al cargar, ej. Hero) */
  defaultInView?: boolean;
}

export default function useInViewport<T extends HTMLElement>({
  rootMargin = '200px 0px 200px 0px',
  threshold = 0,
  defaultInView = false,
}: Options = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(defaultInView);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback: si no hay IntersectionObserver, activar siempre.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setInView(entry.isIntersecting);
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootMargin, threshold]);

  return { ref, inView };
}