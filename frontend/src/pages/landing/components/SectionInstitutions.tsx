/**
 * SectionInstitutions.tsx — Sección "Para instituciones"
 * ─────────────────────────────────────────────────────────────
 * Muestra cómo cada rol del ecosistema interactúa con NeuroLearn:
 *   Institución → Docentes → Estudiantes → NeuroLearn AI
 * con animaciones que conectan cada rol (misma estética minimalista).
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Building2, GraduationCap, UserRound, Cpu, type LucideIcon } from 'lucide-react';

import NeuronGlyph from './NeuronGlyph';
import { INSTITUTIONS, NL } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

const ROLE_ICONS: Record<string, LucideIcon> = {
  institucion: Building2,
  docentes: GraduationCap,
  estudiantes: UserRound,
  neurolearn: Cpu,
};

export default function SectionInstitutions() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reveals = section.querySelectorAll<HTMLElement>('[data-inst-reveal]');
    const roles = section.querySelectorAll<HTMLElement>('[data-inst-role]');
    const connectors = section.querySelectorAll<HTMLElement>('[data-inst-connector]');

    if (!reveals.length) return;

    if (reduce) {
      gsap.set([reveals, roles], { opacity: 1, y: 0 });
      gsap.set(connectors, { scaleX: 1 });
      return;
    }

    gsap.set(reveals, { opacity: 0, y: 28 });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 72%', toggleActions: 'play none none none' },
      defaults: { ease: 'power3.out', duration: 0.8 },
    });
    tl.to(reveals, { opacity: 1, y: 0, stagger: 0.1 });

    // Roles aparecen en secuencia; conectores se dibujan entre ellos.
    roles.forEach((role, i) => {
      gsap.fromTo(role, { opacity: 0, y: 26, scale: 0.96 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: role, start: 'top 88%', toggleActions: 'play none none none' },
        delay: i * 0.05,
      });
    });
    gsap.fromTo(connectors, { scaleX: 0, transformOrigin: 'left center' }, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top 55%', end: 'center 45%', scrub: 0.5 },
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flow = INSTITUTIONS.roles;

  return (
    <section
      ref={sectionRef}
      id="instituciones"
      className="nl-section nl-bg-black-2 relative overflow-hidden"
      aria-label="NeuroLearn para instituciones educativas"
    >
      {/* fondo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(90% 60% at 50% 0%, rgba(37,99,235,0.08), transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="nl-grid-bg absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="nl-container relative z-2">
        <div className="mx-auto max-w-2xl text-center">
          <p data-inst-reveal className="nl-kicker" style={{ color: NL.blueSoft }}>
            <span className="nl-dot-live" aria-hidden="true" />
            {INSTITUTIONS.eyebrow}
          </p>
          <h2
            data-inst-reveal
            className="nl-h mt-5"
            style={{ fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}
          >
            {INSTITUTIONS.title}{' '}
            <span style={{ color: NL.blueSoft }}>{INSTITUTIONS.highlight}</span>
          </h2>
          <p data-inst-reveal className="mt-5 text-[16px] leading-relaxed" style={{ color: '#b8b8b8' }}>
            {INSTITUTIONS.lead}
          </p>
        </div>

        {/* Flujo de roles */}
        <div className="mt-14 flex flex-col items-center gap-3">
          {flow.map((r, i) => {
            const Icon = ROLE_ICONS[r.id] ?? Cpu;
            const isNeuro = r.id === 'neurolearn';
            return (
              <div key={r.id} className="flex w-full max-w-md flex-col items-center">
                {i > 0 && (
                  <span
                    data-inst-connector
                    className="my-1 block h-6 w-px"
                    style={{ background: `linear-gradient(180deg, ${NL.blue}66, ${NL.blueBright})` }}
                    aria-hidden="true"
                  />
                )}
                <div
                  data-inst-role
                  className="flex w-full items-center gap-4 rounded-2xl border px-5 py-4"
                  style={{
                    borderColor: isNeuro ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)',
                    background: isNeuro ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.03)',
                    transition: 'border-color .3s ease, transform .3s ease',
                  }}
                >
                  {isNeuro ? (
                    <div className="flex-none" style={{ width: 42, height: 42 }}>
                      <NeuronGlyph size={42} active />
                    </div>
                  ) : (
                    <div
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                      style={{ background: 'rgba(37,99,235,0.12)', color: NL.blueSoft }}
                    >
                      <Icon size={22} strokeWidth={1.7} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="nl-h text-[16px] font-semibold text-white">{r.label}</div>
                    <div className="text-[12.5px] text-neutral-400">{r.note}</div>
                  </div>
                  {isNeuro && <span className="nl-mono ml-auto text-[10px] uppercase tracking-[0.2em]" style={{ color: NL.blueSoft }}>IA</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}