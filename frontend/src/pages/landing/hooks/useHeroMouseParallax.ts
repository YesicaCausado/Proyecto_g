/**
 * useHeroMouseParallax.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: parallax 3D del wrapper de Neurón al mover
 * el mouse. Suave (easing GSAP), sutil (pocos grados),
 * desactivado en touch, pointer-coarse y prefers-reduced-motion.
 *
 * No reacciona de forma exagerada: solo una inclinación premium
 * que da sensación de profundidad.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { HERO_ROBOT } from '../config/hero.config';

export function useHeroMouseParallax(
  getWrapper: () => HTMLElement | null,
  enabled = true,
): void {
  const frame = useRef<number | null>(null);
  const getRef = useRef(getWrapper);
  getRef.current = getWrapper;

  useLayoutEffect(() => {
    const robot = getRef.current();
    if (!robot || !enabled) return;

    const isCoarse =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isCoarse || reduce) return;

    const raf = window.requestAnimationFrame;
    const onMove = (e: MouseEvent) => {
      if (frame.current != null) return;
      frame.current = raf(() => {
        frame.current = null;
        const nx = (e.clientX / window.innerWidth) * 2 - 1;   // -1..1
        const ny = (e.clientY / window.innerHeight) * 2 - 1; // -1..1
        gsap.to(robot, {
          rotateY: nx * HERO_ROBOT.maxMouseRotY,
          rotateX: -ny * HERO_ROBOT.maxMouseRotX,
          duration: 1.4,
          ease: 'power3.out',
          transformOrigin: 'center center',
        });
        void nx; void ny;
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [enabled]);
}