/**
 * SectionPersonalization.tsx — Sección "¿Cómo se adapta?"
 * ─────────────────────────────────────────────────────────────
 * Muestra cómo la información se convierte en aprendizaje
 * personalizado (Datos → IA → Análisis → Personalización) y una
 * interfaz simulada donde NeuroLearn adapta dificultad, contenido,
 * recomendaciones y ritmo — que cambian dinámicamente con el scroll.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ADAPTATION, NL, RESPONSIVE } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

const PIPELINE = ['Datos', 'IA', 'Análisis', 'Personalización'];

export default function SectionPersonalization() {
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

    const reveals = section.querySelectorAll<HTMLElement>('[data-adapt-reveal]');
    const stages = section.querySelectorAll<HTMLElement>('[data-adapt-stage]');
    const connectors = section.querySelectorAll<HTMLElement>('[data-adapt-connector]');
    const fills = section.querySelectorAll<HTMLElement>('[data-adapt-fill]');
    const values = section.querySelectorAll<HTMLElement>('[data-adapt-value]');

    if (!reveals.length) return;

    if (reduce) {
      gsap.set([reveals, stages], { opacity: 1, y: 0 });
      gsap.set(connectors, { scaleX: 1 });
      gsap.set(fills, { scaleX: 1 });
      values.forEach((v) => { v.textContent = v.dataset.to ?? ''; });
      return;
    }

    gsap.set(reveals, { opacity: 0, y: 30 });

    // Texto entra al llegar
    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 72%', toggleActions: 'play none none none' },
      defaults: { ease: 'power3.out', duration: 0.8 },
    });
    tl.to(reveals, { opacity: 1, y: 0, stagger: 0.1 });

    // Pipeline superior (Datos → IA → Análisis → Personalización)
    gsap.fromTo(stages, { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top 55%', end: 'center 45%', scrub: 0.5 },
      stagger: 0.15,
    });
    gsap.fromTo(connectors, { scaleX: 0, transformOrigin: 'left center' }, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top 45%', end: 'center 40%', scrub: 0.5 },
    });

    // Ejes de adaptación: barra "from → to" + valor cambia con el scroll.
    fills.forEach((fill) => {
      gsap.fromTo(fill, { scaleX: 0, transformOrigin: 'left center' }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: fill, start: 'top 88%', end: 'top 40%', scrub: 0.5 },
      });
    });

    // Valores "from → to": cambian al llegar el scroll a cada tarjeta.
    values.forEach((value) => {
      const to = value.dataset.to ?? '';
      gsap.timeline({
        scrollTrigger: {
          trigger: value,
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
      }).fromTo(value, { textContent: value.dataset.from ?? '' }, {
        textContent: to, duration: 0.6, ease: 'power1.inOut',
      });
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  return (
    <section
      ref={sectionRef}
      id="personalizacion"
      className="nl-section nl-bg-pale relative overflow-hidden"
      aria-label="Cómo se adapta NeuroLearn a cada estudiante"
    >
      <div className="nl-container">
        {/* Pipeline 4 etapas */}
        <div className="mb-16 flex flex-wrap items-center justify-center gap-3">
          {PIPELINE.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <span
                data-adapt-stage
                className="nl-mono inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.16em]"
                style={{ borderColor: 'rgba(37,99,235,0.25)', color: NL.blue, background: '#fff' }}
              >
                <span className="nl-dot-live" style={{ transform: 'scale(0.6)' }} aria-hidden="true" />
                {s}
              </span>
              {i < PIPELINE.length - 1 && (
                <span
                  data-adapt-connector
                  className="h-px w-6"
                  style={{ background: `linear-gradient(90deg, ${NL.blue}, ${NL.blueBright})` }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>

        {/* Headline */}
        <div className="mx-auto max-w-2xl text-center">
          <p data-adapt-reveal className="nl-kicker" style={{ color: NL.blue }}>
            <span className="nl-dot-live" aria-hidden="true" />
            {ADAPTATION.eyebrow}
          </p>
          <h2
            data-adapt-reveal
            className="nl-h mt-5"
            style={{ fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#0a0a0a' }}
          >
            {ADAPTATION.title}{' '}
            <span style={{ color: NL.blue }}>{ADAPTATION.highlight}</span>
          </h2>
          <p data-adapt-reveal className="mt-5 text-[16px] leading-relaxed" style={{ color: '#4b4b4b' }}>
            {ADAPTATION.lead}
          </p>
        </div>

        {/* Ejes adaptativos (interfaz simulada) */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {ADAPTATION.axes.map((a) => (
            <div
              key={a.id}
              data-adapt-reveal
              className="nl-card nl-card-light p-6"
              style={{ borderRadius: 18 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="nl-h text-[16px] font-semibold text-neutral-800">{a.label}</h3>
                  <p className="text-[12.5px] text-neutral-500">{a.desc}</p>
                </div>
                <span
                  data-adapt-value
                  data-to={a.to}
                  data-from={a.from}
                  className="nl-mono text-sm font-semibold"
                  style={{ color: NL.blue }}
                >
                  {a.from}
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  data-adapt-fill
                  className="h-full w-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${NL.blue}, ${NL.blueBright})` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
                <span>{a.from}</span>
                <span>{a.to}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}