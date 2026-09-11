/**
 * SectionWhatIs.tsx — Sección "¿Qué es NeuroLearn?"
 * ─────────────────────────────────────────────────────────────
 * Explica NeuroLearn de forma extremadamente sencilla mientras un
 * flujo aparece progresivamente durante el scroll:
 *
 *   Estudiante → Interacción → IA → Análisis → Aprendizaje personalizado
 *
 * Técnica: GSAP + ScrollTrigger. El texto entra con stagger y cada
 * paso del flujo se "enciende" en secuencia conforme avanza el scroll
 * (scrub lineal) para contar la historia sin abrumar.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { WHAT_IS, NL, RESPONSIVE } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

export default function SectionWhatIs() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${RESPONSIVE.mobileBreakpoint - 1}px)`);
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reveals = section.querySelectorAll<HTMLElement>('[data-what]');
    const steps = section.querySelectorAll<HTMLElement>('[data-what-step]');
    const connectors = section.querySelectorAll<HTMLElement>('[data-what-connector]');

    if (!reveals.length) return;

    if (reduce) {
      gsap.set([reveals, steps], { opacity: 1, y: 0 });
      gsap.set(connectors, { scaleX: 1 });
      return;
    }

    gsap.set(reveals, { opacity: 0, y: 28 });

    // Texto principal entra al llegar a la sección.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 70%',
        toggleActions: 'play none none none',
      },
      defaults: { ease: 'power3.out', duration: 0.8 },
    });
    tl.to(reveals, { opacity: 1, y: 0, stagger: 0.1 });

    // Flujo vertical: cada paso se enciende con el scroll (scrub).
    if (!isMobile) {
      steps.forEach((step) => {
        gsap.fromTo(step, { opacity: 0.25, y: 20, scale: 0.96 }, {
          opacity: 1, y: 0, scale: 1, ease: 'none',
          scrollTrigger: {
            trigger: step,
            start: 'top 88%',
            end: 'top 60%',
            scrub: 0.5,
          },
        });
      });
      // Conectores se "dibujan" tras cada paso.
      gsap.fromTo(connectors, { scaleX: 0, transformOrigin: 'top center' }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 55%',
          end: 'bottom 55%',
          scrub: 0.5,
        },
      });
    }

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  return (
    <section
      ref={sectionRef}
      id="que-es"
      className="nl-section nl-bg-light relative overflow-hidden"
      aria-label="Qué es NeuroLearn"
    >
      {/* grid técnico sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: [
            'linear-gradient(to bottom, rgba(5,5,5,0.03) 1px, transparent 1px)',
            'linear-gradient(to right, rgba(5,5,5,0.03) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(100% 90% at 50% 0%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(100% 90% at 50% 0%, #000 30%, transparent 85%)',
        }}
      />

      <div className="nl-container grid items-center gap-14 lg:grid-cols-2">
        {/* Texto */}
        <div>
          <p data-what className="nl-kicker" style={{ color: NL.blue }}>
            <span className="nl-dot-live" aria-hidden="true" />
            NeuroLearn
          </p>
          <h2
            data-what
            className="nl-h mt-5"
            style={{ fontSize: 'clamp(32px, 4.5vw, 54px)', lineHeight: 1.04, letterSpacing: '-0.02em', color: '#0a0a0a' }}
          >
            {WHAT_IS.title}{' '}
            <span style={{ color: NL.blue }}>{WHAT_IS.highlight}</span>
          </h2>
          <p
            data-what
            className="mt-6 max-w-lg text-[17px] leading-relaxed"
            style={{ color: '#4b4b4b' }}
          >
            {WHAT_IS.lead}
          </p>
        </div>

        {/* Flujo vertical secuencial */}
        <div className={isMobile ? 'flex flex-col' : 'relative flex flex-col'} style={{ maxWidth: 380, width: '100%', margin: isMobile ? '0 auto' : '0 0 0 auto' }}>
          {WHAT_IS.steps.map((s, i) => (
            <div key={s.id} className="flex flex-col">
              {i > 0 && (
                <div
                  data-what-connector
                  className="h-8 w-px self-center"
                  style={{ background: 'rgba(37,99,235,0.3)' }}
                  aria-hidden="true"
                />
              )}
              <div
                data-what-step
                className="flex items-center gap-4 rounded-2xl border px-5 py-4"
                style={{
                  borderColor: 'rgba(5,5,5,0.08)',
                  background: '#fff',
                  boxShadow: '0 10px 30px -18px rgba(0,0,0,0.12)',
                  transition: 'border-color .3s ease, box-shadow .3s ease',
                }}
              >
                <span
                  className="nl-mono flex h-9 w-9 flex-none items-center justify-center rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(37,99,235,0.1)', color: NL.blue }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="nl-h text-[15px] font-semibold text-neutral-800">{s.label}</div>
                  <div className="truncate text-[12.5px] text-neutral-500">{s.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}