/**
 * PatternDetails.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: las secciones de detalle de cada patrón
 * neurodigital, que aparecen MÁS ABAJO que el índice resumen.
 *
 * Dirección editorial (misma lengua que PatternsTransition):
 * numeración serif grande, títulos serif, tagline con acento de la
 * paleta y lista de señales con índice mono + punto de color por
 * patrón. Layout alternado para dar ritmo sin saturación.
 *
 * Animación: cada bloque entra con ScrollTrigger (fade + slide).
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, Sparkles } from 'lucide-react';

import { PATTERN_DETAILS, PATTERN_SECTIONS } from '../config/hero.config';

gsap.registerPlugin(ScrollTrigger);

/** Mapa de acento de color por id de patrón (de la SSOT PATTERN_DETAILS) */
const ACCENT: Record<string, string> = Object.fromEntries(
  PATTERN_DETAILS.map((p) => [p.id, p.accent]),
);

/** Lista de iconos por patrón (mismo mapeo que las cards) */
const ICON_MAP: Record<string, typeof Sparkles> = {
  Eye: Sparkles,
  Mic: Sparkles,
  Keyboard: Sparkles,
  Users: Sparkles,
  TrendingUp: Sparkles,
};

export default function PatternDetails() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const blocks = section.querySelectorAll('[data-pattern-detail]');
    if (!blocks.length) return;

    if (reduce) {
      gsap.set(blocks, { opacity: 1, x: 0 });
      return;
    }

    gsap.set(blocks, { opacity: 0, x: 40 });

    // Cada bloque anima cuando entra al viewport (fade + slide suave).
    const triggers = Array.from(blocks).map((block) => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: block,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
        defaults: { ease: 'power2.out', duration: 0.8 },
      });
      tl.to(block, { opacity: 1, x: 0 });
      return tl;
    });

    return () => {
      triggers.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        background: 'radial-gradient(120% 120% at 50% 100%, #06090c 0%, #030405 100%)',
        color: '#eef2f1',
        padding: 'clamp(64px, 10vh, 120px) 6vw',
      }}
      aria-label="Detalle de cada patrón neurodigital"
    >
      <div className="mx-auto max-w-6xl">
        {/* ── Encabezado de la sección de detalles ───────────── */}
        <div className="mb-20 max-w-3xl">
          <p className="landing-kicker" style={{ color: '#3FA9DB' }}>
            <span aria-hidden="true" style={{ color: '#5DC8B4' }}>●</span>
            Cómo los lee la IA
          </p>
          <h2 className="landing-serif mt-5 text-3xl font-medium leading-tight tracking-tight text-white sm:text-5xl">
            Qué analiza, exactamente,
            <span className="font-light italic" style={{ color: '#5DC8B4' }}> cada patrón</span>
          </h2>
          <p
            className="mt-6 text-base leading-relaxed"
            style={{ color: 'rgba(232,236,234,0.78)' }}
          >
            Estas son las señales reales que NeuroLearn ya mide sobre cada estudiante y
            cómo las usa para adaptar el aprendizaje en tiempo real.
          </p>
        </div>

        {/* ── Bloques de detalle por patrón ───────────────────── */}
        <div className="flex flex-col gap-28">
          {PATTERN_SECTIONS.map((p, i) => {
            const Icon = ICON_MAP[p.id] ?? Sparkles;
            const even = i % 2 === 0;
            const accent = ACCENT[p.id] ?? '#5DC8B4';
            return (
              <article
                key={p.id}
                id={`patron-${p.id}`}
                data-pattern-detail
                className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16"
                style={{ scrollMarginTop: '96px' }}
                aria-label={`Detalle del patrón ${p.title}`}
              >
                {/* Columna de texto (alterna de lado en cada patrón) */}
                <div className={even ? 'lg:order-1' : 'lg:order-2'}>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="landing-num text-4xl font-medium leading-none"
                      style={{ color: 'rgba(238,242,241,0.4)' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: `${accent}1f` }}
                      aria-hidden="true"
                    >
                      <span style={{ color: accent }}>
                        <Icon size={20} strokeWidth={1.5} />
                      </span>
                    </div>
                    <span
                      className="landing-mono text-[10px] font-medium uppercase tracking-[0.28em]"
                      style={{ color: accent }}
                    >
                      Patrón {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <h3 className="landing-serif mt-7 text-3xl font-medium tracking-tight text-white sm:text-4xl">
                    {p.title}
                  </h3>
                  <p
                    className="mt-2 text-sm font-medium tracking-wide italic"
                    style={{ color: accent }}
                  >
                    {p.tagline}
                  </p>

                  <p
                    className="landing-sans mt-6 text-base leading-relaxed"
                    style={{ color: 'rgba(232,236,234,0.86)' }}
                  >
                    {p.intro}
                  </p>
                </div>

                {/* Columna de señales reales */}
                <div className={even ? 'lg:order-2' : 'lg:order-1'}>
                  <ul className="flex flex-col">
                    {p.signals.map((s, si) => (
                      <li
                        key={s.metric}
                        className="group flex items-start gap-4 border-t py-4"
                        style={{ borderColor: 'rgba(238,242,241,0.10)' }}
                      >
                        <span
                          aria-hidden="true"
                          className="landing-mono mt-0.5 text-[11px] font-medium"
                          style={{ color: accent }}
                        >
                          {String(si + 1).padStart(2, '0')}
                        </span>
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 flex-none rounded-full transition-transform duration-300 group-hover:scale-125"
                          style={{ background: accent }}
                        />
                        <div className="w-full">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="landing-sans text-[15px] font-semibold text-white">
                              {s.label}
                            </span>
                            <code
                              className="landing-mono text-[10px] uppercase tracking-wider"
                              style={{ color: 'rgba(238,242,241,0.55)' }}
                            >
                              {s.metric}
                            </code>
                          </div>
                          <p
                            className="mt-1 text-sm leading-snug"
                            style={{ color: 'rgba(232,236,234,0.8)' }}
                          >
                            {s.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Beneficio */}
                  <div
                    className="mt-6 px-5 py-4"
                    style={{
                      borderLeft: `2px solid ${accent}`,
                      background: `${accent}12`,
                    }}
                  >
                    <p className="landing-sans text-sm leading-relaxed" style={{ color: 'rgba(238,242,241,0.9)' }}>
                      <span className="font-semibold" style={{ color: accent }}>Por qué importa — </span>
                      {p.benefit}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Enlace hacia la plataforma */}
        <div className="mt-28 flex flex-col items-center gap-4 text-center" data-pattern-detail>
          <p
            className="max-w-xl text-base leading-relaxed"
            style={{ color: 'rgba(232,236,234,0.8)' }}
          >
            Cada una de estas señales se combina en un único perfil de aprendizaje en
            tiempo real.
          </p>
          <a
            href="#patrones"
            className="group inline-flex items-center gap-2 px-1 pb-1 text-sm font-semibold transition-transform duration-300 hover:-translate-y-0.5"
            style={{ color: '#f2f4f3' }}
          >
            <span className="landing-link border-b py-1 text-base">Explorar la plataforma</span>
            <ArrowDown size={16} aria-hidden="true" strokeWidth={1.5} style={{ color: '#5DC8B4' }} />
          </a>
        </div>
      </div>
    </section>
  );
}