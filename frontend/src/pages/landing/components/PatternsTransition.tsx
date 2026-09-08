/**
 * PatternsTransition.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: la sección que presenta los 5 patrones
 * neurodigitales de NeuroLearn.
 *
 * Dirección editorial (no genérica / no "IA"): en vez de una rejilla
 * de tarjetas idénticas, un ÍNDICE tipo revista — numeración grande
 * en serif, títulos serif, etiquetas en mono y un acento de color de
 * la paleta por patrón. Cada fila es un enlace al detalle.
 *
 * Animación: GSAP + ScrollTrigger con stagger; respeta reduced-motion.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import PatternVisual from './PatternVisual';
import { HERO_PATTERNS, PATTERN_DETAILS } from '../config/hero.config';

gsap.registerPlugin(ScrollTrigger);

export default function PatternsTransition() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef    = useRef<HTMLDivElement>(null);
  const rowsRef    = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const header  = headRef.current ? Array.from(headRef.current.children) : [];
    const rows    = rowsRef.current ? Array.from(rowsRef.current.children) : [];
    const targets = [...header, ...rows].filter(Boolean) as Element[];

    if (reduce) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(targets, { opacity: 0, y: 36 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 62%',
        toggleActions: 'play none none none',
      },
    });

    tl.to(header, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.08 })
      .to(rows, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.09 }, '-=0.35');

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      id="patrones"
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        minHeight: '110vh',
        background:
          'radial-gradient(120% 120% at 50% 0%, #0d1318 0%, #080b0e 55%, #04060a 100%)',
        color: '#eef2f1',
        padding: 'clamp(96px, 18vh, 190px) 6vw',
      }}
      aria-label="Los cinco patrones neurodigitales de NeuroLearn"
    >
      {/* Filete superior técnico */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(63,169,219,0.35), transparent)' }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl">
        {/* ── Cabecera editorial ─────────────────────────────── */}
        <div ref={headRef}>
          <p className="landing-kicker" style={{ color: '#3FA9DB' }}>
            <span aria-hidden="true" style={{ color: '#5DC8B4' }}>●</span>
            Neuroanálisis en tiempo real
          </p>

          <h2 className="landing-serif mt-6 max-w-4xl text-4xl font-medium leading-[1.02] tracking-tight text-white sm:text-6xl">
            Cinco señales
            <br />
            <span className="font-light italic" style={{ color: '#5DC8B4' }}>
              neurodigitales
            </span>{' '}
            · un solo estudiante
            <span aria-hidden="true" style={{ color: '#3FA9DB' }}>.</span>
          </h2>

          <p
            className="mt-7 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ color: 'rgba(232,236,234,0.82)' }}
          >
            {HERO_PATTERNS.sub}
          </p>
        </div>

        {/* ── Índice editorial de los 5 patrones ─────────────── */}
        <div ref={rowsRef} className="mt-16 sm:mt-20">
          {PATTERN_DETAILS.map((p, i) => (
            <a
              key={p.id}
              href={`#patron-${p.id}`}
              className="group grid grid-cols-[auto_1fr_auto] items-start gap-5 border-b py-7 sm:gap-8 sm:py-9"
              style={{ borderColor: 'rgba(238,242,241,0.14)' }}
              aria-label={`Ver detalle del patrón ${p.title}`}
            >
              {/* Numeración editorial grande */}
              <span
                aria-hidden="true"
                className="landing-num text-5xl leading-none font-medium sm:text-7xl"
                style={{
                  color: 'rgba(238,242,241,0.55)',
                  WebkitTextStroke: '1px rgba(238,242,241,0.4)',
                  transition: 'color .35s ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = p.accent; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(238,242,241,0.55)'; }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              {/* Contenido */}
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="landing-serif text-2xl font-medium tracking-tight text-white transition-transform duration-300 group-hover:translate-x-1 sm:text-4xl">
                    {p.title}
                  </h3>
                </div>
                <p
                  className="landing-sans mt-2.5 max-w-2xl text-sm leading-relaxed sm:text-base"
                  style={{ color: 'rgba(232,236,234,0.84)' }}
                >
                  {p.description}
                </p>
                <span className="landing-mono mt-4 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] transition-colors">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent }} />
                  <span style={{ color: p.accent }}>Señal neurodigital</span>
                  <span style={{ color: 'rgba(238,242,241,0.7)' }}>{String(i + 1).padStart(2, '0')}</span>
                </span>
              </div>

              {/* Visual animado del patrón (voz→ondas, facial→parpadeo, …) */}
              <PatternVisual id={p.id} accent={p.accent} />
            </a>
          ))}
        </div>

        {/* Pista de que hay más abajo */}
        <p
          className="mt-12 text-[12px] tracking-wide"
          style={{ color: 'rgba(226,232,230,0.75)' }}
        >
          <span aria-hidden="true" style={{ color: '#5DC8B4' }}>↓</span>{' '}
          Cada una abre el detalle: las señales exactas que NeuroLearn analiza.
        </p>
      </div>
    </section>
  );
}