/**
 * SectionPipeline.tsx — Sección 4 · "Proceso"
 * ─────────────────────────────────────────────────────────────
 * Dark/intermedio. Visualiza el pipeline continuo:
 *   Datos → Análisis → IA → Adaptación → Aprendizaje
 * con líneas animadas que conectan cada etapa (ScrollTrigger scrub).
 * ─────────────────────────────────────────────────────────────
 */
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import SectionHeading from './SectionHeading';
import { PIPELINE, NL } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

export default function SectionPipeline() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      // Líneas conectoras que "se dibujan" al hacer scroll
      gsap.fromTo(
        '[data-connector]',
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          ease: 'none',
          stagger: 0.25,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            end: 'center 55%',
            scrub: true,
          },
        },
      );
      // Etapas entran desde abajo escalonadas
      gsap.fromTo(
        '[data-stage]',
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.2,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 68%', toggleActions: 'play none none none' },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const mobile = typeof window !== 'undefined' && window.innerWidth < 720;

  return (
    <section
      ref={sectionRef}
      className="nl-section nl-bg-dark relative overflow-hidden"
      aria-label="Proceso de análisis de NeuroLearn"
      id="podemos"
    >
      <div className="nl-grid-bg absolute inset-0 opacity-40" />
      <div className="nl-container relative z-2">
        <SectionHeading
          eyebrow="03 · Proceso continuo"
          title="De los datos al"
          highlight="aprendizaje."
          lead="El pipeline transforma información cruda en una experiencia que se adapta a cada estudiante, sesión a sesión, sin fricción."
        />

        <div className="mt-16">
          <div className={mobile ? 'flex flex-col gap-2' : 'flex items-center'}>
            {PIPELINE.map((s, i) => (
              <div key={s.id} className={mobile ? 'w-full' : 'flex-1'}>
                <div data-stage className="nl-stage">
                  <span className="nl-mono text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: NL.blueSoft }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="nl-h mt-2 text-xl text-white">{s.label}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-400">{s.note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Fila de conectores bajo las etapas */}
          <div className={mobile ? 'flex flex-col items-center gap-2' : 'flex items-center'}>
            {PIPELINE.map((s, i) => (
              <div key={s.id} className={mobile ? 'w-full' : 'flex-1'} style={{ display: 'flex' }}>
                {i < PIPELINE.length - 1 ? (
                  <div className="mx-3 mt-3 h-[2px] w-full" style={{ overflow: 'hidden', opacity: 0.7 }}>
                    <div data-connector className="h-full w-full rounded-full" style={{ background: `linear-gradient(90deg, ${NL.blue}, ${NL.blueBright})` }} />
                  </div>
                ) : <div className="mx-3 mt-3" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}