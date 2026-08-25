/**
 * PatternDetails.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: las secciones de detalle de cada patrón
 * neurodigital, que aparecen MÁS ABAJO que las tarjetas resumen.
 *
 * Cada patrón es un bloque a pantalla (o casi) con:
 *   · Cabecera (tagline + título + intro)
 *   · Lista de SEÑALES REALES que NeuroLearn analiza (métricas
 *     reales del proyecto: useFacialDetection, useVoiceProsody,
 *     useBehavioralMetrics y la predicción del backend)
 *   · Un beneficio concreto de esa señal para la adaptación.
 *   · Layout alternado (texto a la izquierda/derecha) para
 *     dar ritmo visual sin caer en saturación.
 *
 * Animación: cada bloque entra con ScrollTrigger (fade + slide)
 * con su propio trigger. Movimiento suave, nada de rebotes.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDown, Sparkles } from 'lucide-react';

import { PATTERN_SECTIONS } from '../config/hero.config';

gsap.registerPlugin(ScrollTrigger);

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
      className="relative"
      style={{
        background: '#050507',
        color: '#f5f5f5',
        padding: 'clamp(64px, 10vh, 120px) 5vw',
      }}
      aria-label="Detalle de cada patrón neurodigital"
    >
      <div className="mx-auto max-w-6xl">
        {/* Encabezado de la sección de detalles */}
        <div className="mb-20">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: 'rgba(220,220,220,0.60)' }}
          >
            Cómo los lee la IA
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Qué analiza exactamente cada patrón
          </h2>
          <p
            className="mt-5 max-w-2xl text-base leading-relaxed"
            style={{ color: 'rgba(230,230,230,0.72)' }}
          >
            Estas son las señales reales que NeuroLearn ya mide sobre cada estudiante y
            cómo las usa para adaptar el aprendizaje en tiempo real.
          </p>
        </div>

        {/* Bloques de detalle por patrón */}
        <div className="flex flex-col gap-24">
          {PATTERN_SECTIONS.map((p, i) => {
            const Icon = ICON_MAP[p.id] ?? Sparkles;
            const even = i % 2 === 0;
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
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                      aria-hidden="true"
                    >
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.25em]"
                      style={{ color: 'rgba(220,220,220,0.45)' }}
                      aria-hidden="true"
                    >
                      {`Patrón ${String(i + 1).padStart(2, '0')}`}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
                    {p.title}
                  </h3>
                  <p
                    className="mt-1 text-sm font-medium tracking-wide"
                    style={{ color: 'rgba(220,220,220,0.55)' }}
                  >
                    {p.tagline}
                  </p>

                  <p
                    className="mt-6 text-base leading-relaxed"
                    style={{ color: 'rgba(230,230,230,0.78)' }}
                  >
                    {p.intro}
                  </p>
                </div>

                {/* Columna de señales reales */}
                <div className={even ? 'lg:order-2' : 'lg:order-1'}>
                  <ul className="flex flex-col gap-3">
                    {p.signals.map((s) => (
                      <li
                        key={s.metric}
                        className="flex items-start gap-3 rounded-xl border px-4 py-3"
                        style={{ borderColor: 'rgba(230,230,230,0.12)', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
                          style={{ background: 'rgba(255,255,255,0.6)' }}
                          aria-hidden="true"
                        />
                        <div>
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-semibold text-white">{s.label}</span>
                            <code
                              className="text-[10px] uppercase tracking-wider"
                              style={{ color: 'rgba(255,255,255,0.4)' }}
                            >
                              {s.metric}
                            </code>
                          </div>
                          <p
                            className="mt-0.5 text-sm leading-snug"
                            style={{ color: 'rgba(230,230,230,0.72)' }}
                          >
                            {s.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Beneficio */}
                  <div
                    className="mt-6 rounded-xl border-l-2 px-5 py-4"
                    style={{ borderColor: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)' }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(235,235,235,0.85)' }}>
                      <span className="font-semibold text-white">Por qué importa: </span>
                      {p.benefit}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Enlace hacia la plataforma */}
        <div className="mt-24 flex flex-col items-center gap-4 text-center" data-pattern-detail>
          <p
            className="max-w-xl text-base leading-relaxed"
            style={{ color: 'rgba(230,230,230,0.72)' }}
          >
            Cada una de estas señales se combina en un único perfil de aprendizaje en
            tiempo real.
          </p>
          <a
            href="#patrones"
            className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-transform duration-300 hover:-translate-y-0.5"
            style={{ borderColor: 'rgba(230,230,230,0.3)', color: '#f5f5f5' }}
          >
            <ArrowDown size={16} aria-hidden="true" strokeWidth={1.5} />
            Explorar la plataforma
          </a>
        </div>
      </div>
    </section>
  );
}