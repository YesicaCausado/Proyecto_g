/**
 * useGsapReveal.ts
 * ─────────────────────────────────────────────────────────────
 * Hook compartido de animación con GSAP + ScrollTrigger.
 * Aplica a los targets `.nl-reveal` dentro de un elemento scope
 * un fade+slide al entrar al viewport (stagger opcional).
 * Respeta prefers-reduced-motion.
 *
 * Devuelve ref para el contenedor scope.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface Options {
  /** Selector de targets (default .nl-reveal) */
  selector?: string;
  /** Desfase entre targets (en vez de simultáneo) */
  stagger?: number;
  /** Distancia vertical inicial (px) */
  distanceY?: number;
  /** start del trigger */
  start?: string;
  /** Animar una sola vez y volver inactivo */
  once?: boolean;
}

export default function useGsapReveal(opts: Options = {}) {
  const {
    selector = '.nl-reveal',
    stagger = 0.14,
    distanceY = 34,
    start = 'top 82%',
    once = true,
  } = opts;

  const scopeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targets = Array.from(scope.querySelectorAll<HTMLElement>(selector));
    if (!targets.length) return;

    if (reduce) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(targets, { opacity: 0, y: distanceY });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scope,
          start,
          toggleActions: once ? 'play none none none' : 'play none none reverse',
        },
        defaults: { ease: 'power3.out', duration: 0.9 },
      });
      tl.to(targets, { opacity: 1, y: 0, stagger });
    }, scope);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return scopeRef;
}