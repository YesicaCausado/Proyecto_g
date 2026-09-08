/**
 * useCustomCursor.tsx
 * ─────────────────────────────────────────────────────────────
 * Cursor personalizado sutil en escritorio.
 *  · Círculo pequeño azul que sigue al puntero (lerp suave).
 *  · Anillo que se expande / se tiñe al pasar sobre elementos
 *    interactivos (botones, links, cards).
 *  · Se desactiva en: móvil / touch / prefers-reduced-motion.
 *
 * Uso: <CustomCursor /> una vez dentro de la landing.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef } from 'react';

const INTERACTIVE = 'a, button, .nl-card, input, [data-cursor]';

export default function useCustomCursor() {
  const dotRef    = useRef<HTMLDivElement>(null);
  const ringRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Solo desktop + sin reduced-motion.
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!media.matches || reduce.matches) return;

    const dot  = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Ocultar el cursor nativo en el área de la app es invasivo:
    // mejor mantenerlo y superponer uno sutil que no estorbe.
    let mx = -100, my = -100;
    let rx = -100, ry = -100;
    let raf = 0;
    let hover = false;

    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onOver = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest?.(INTERACTIVE);
      if (t && !hover) {
        hover = true;
        ring.classList.add('is-hover');
      } else if (!t && hover) {
        hover = false;
        ring.classList.remove('is-hover');
      }
    };

    const onOut = () => { ring.classList.remove('is-hover'); hover = false; };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseleave', onOut);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden="true" style={{ position: 'fixed', zIndex: 9999, inset: 0, pointerEvents: 'none' }}>
      <div ref={ringRef} className="nl-cursor-ring" />
      <div ref={dotRef} className="nl-cursor-dot" />
    </div>
  );
}