/**
 * SectionInstitutions.tsx — Sección "Para instituciones"
 * ─────────────────────────────────────────────────────────────
 * Visión CINEMATOGRÁFICA sobre fondo claro (gris/azul muy suave).
 *
 * Neuron desciende por un rail vertical a medida que el usuario hace
 * scroll (ScrollTrigger scrub), deteniéndose junto a cada rol del
 * ecosistema: Institución → Docentes → Estudiantes → NeuroLearn AI.
 *
 * Técnica: GSAP + ScrollTrigger. Los roles entran por la derecha con
 * stagger mientras Neuron viaja. prefers-reduced-motion → estático.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Building2, GraduationCap, UserRound, Cpu, type LucideIcon } from 'lucide-react';

import RobotCanvas from '../../auth/components/robot/RobotCanvas';
import useInViewport from '../hooks/useInViewport';
import { INSTITUTIONS, NL, RESPONSIVE } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

const ROLE_ICONS: Record<string, LucideIcon> = {
  institucion: Building2,
  docentes: GraduationCap,
  estudiantes: UserRound,
  neurolearn: Cpu,
};

export default function SectionInstitutions() {
  const { ref: sectionRef, inView } = useInViewport<HTMLElement>();
  const neuronRailRef = useRef<HTMLDivElement>(null);
  const neuronFloatRef = useRef<HTMLDivElement>(null);
  const neuronInnerRef = useRef<HTMLDivElement>(null);
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

    const reveals = section.querySelectorAll<HTMLElement>('[data-inst-reveal]');
    const roles = section.querySelectorAll<HTMLElement>('[data-inst-role]');
    const nodeChip = neuronFloatRef.current;
    const nodeInner = neuronInnerRef.current;
    const rail = neuronRailRef.current;
    const ctx = gsap.context(() => {
      if (!reveals.length) return;

      if (reduce) {
        gsap.set([reveals, roles], { opacity: 1, y: 0 });
        return;
      }

      gsap.set(reveals, { opacity: 0, y: 28 });

      // Texto entra al llegar.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top 72%', toggleActions: 'play none none none' },
        defaults: { ease: 'power3.out', duration: 0.8 },
      });
      tl.to(reveals, { opacity: 1, y: 0, stagger: 0.1 });

      // Roles entran escalonados con el scroll (scrub) al pasar.
      roles.forEach((role) => {
        gsap.fromTo(role, { opacity: 0, x: 40, scale: 0.97 }, {
          opacity: 1, x: 0, scale: 1, ease: 'none',
          scrollTrigger: { trigger: role, start: 'top 88%', end: 'top 55%', scrub: 0.5 },
        });
      });

      // Neurón desciende por el rail según el scroll de la sección.
      if (rail && nodeChip && !isMobile) {
        const distance = () => {
          const railRect = rail.getBoundingClientRect();
          const travel = rail.scrollHeight - railRect.height;
          return Math.max(0, travel);
        };
        gsap.fromTo(nodeChip, { y: 0 }, {
          y: () => distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: rail,
            start: 'top 75%',
            end: 'bottom 45%',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate(self) {
              // Pequeña rotación/hover según avance (leve vida a Neurón).
              // Se aplica al contenedor INTERNO para no pisar el `y` del scroll.
              if (nodeInner) {
                gsap.set(nodeInner, { rotation: Math.sin(self.progress * Math.PI * 2) * 2 });
              }
            },
          },
        });
      }

      // Flotación continua de Neurón (solo en el contenedor interno 3D).
      if (nodeInner) {
        gsap.to(nodeInner, { y: '+=6', duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }
    }, section);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const flow = INSTITUTIONS.roles;

  return (
    <section
      ref={sectionRef}
      id="instituciones"
      className="nl-section relative overflow-hidden"
      aria-label="NeuroLearn para instituciones educativas"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6f8fb 100%)' }}
    >
      {/* grid técnico sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: [
            'linear-gradient(to bottom, rgba(37,99,235,0.03) 1px, transparent 1px)',
            'linear-gradient(to right, rgba(37,99,235,0.03) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(100% 90% at 50% 0%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(100% 90% at 50% 0%, #000 30%, transparent 85%)',
        }}
        aria-hidden="true"
      />

      <div className="nl-container relative z-2 grid items-start gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Columna de texto */}
        <div>
          <p data-inst-reveal className="nl-kicker" style={{ color: NL.blue }}>
            <span className="nl-dot-live" aria-hidden="true" />
            {INSTITUTIONS.eyebrow}
          </p>
          <h2
            data-inst-reveal
            className="nl-h mt-5"
            style={{ fontSize: 'clamp(30px, 4.4vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#0a0a0a' }}
          >
            {INSTITUTIONS.title}{' '}
            <span style={{ color: NL.blue }}>{INSTITUTIONS.highlight}</span>
          </h2>
          <p data-inst-reveal className="mt-6 max-w-lg text-[16px] leading-relaxed" style={{ color: '#4b4b4b' }}>
            {INSTITUTIONS.lead}
          </p>

          {/* Rail de Neurón (desktop) — robot.glb real que desciende */}
          {!isMobile && (
            <div ref={neuronRailRef} className="inst-neuron-rail mt-14" aria-hidden="true">
              {/* línea guía vertical */}
              <span className="inst-neuron-line" />
              <div ref={neuronFloatRef} className="inst-neuron-chip">
                <div ref={neuronInnerRef} className="inst-neuron-3d">
                  {inView && (
                    <RobotCanvas robotState="idle" transparent className="h-full w-full" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna de roles */}
        <div className="mt-10 flex flex-col gap-4 lg:mt-4">
          {flow.map((r) => {
            const Icon = ROLE_ICONS[r.id] ?? Cpu;
            const isNeuro = r.id === 'neurolearn';
            return (
              <div
                key={r.id}
                data-inst-role
                className="inst-role card-shadow"
                style={{
                  borderRadius: 18,
                  borderColor: isNeuro ? 'rgba(37,99,235,0.35)' : 'rgba(5,5,5,0.08)',
                  background: isNeuro ? 'rgba(37,99,235,0.04)' : '#ffffff',
                  transition: 'transform .3s ease, box-shadow .3s ease, border-color .3s ease',
                }}
              >
                <div className="flex items-center gap-4 px-6 py-5">
                  {isNeuro ? (
                    <div
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                      style={{ background: 'rgba(37,99,235,0.12)', color: NL.blue }}
                    >
                      <Cpu size={22} strokeWidth={1.7} />
                    </div>
                  ) : (
                    <div
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                      style={{ background: 'rgba(37,99,235,0.1)', color: NL.blue }}
                    >
                      <Icon size={22} strokeWidth={1.7} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="nl-h text-[16px] font-semibold text-neutral-800">{r.label}</div>
                    <div className="text-[12.5px] text-neutral-500">{r.note}</div>
                  </div>
                  {isNeuro && (
                    <span className="nl-mono ml-auto text-[10px] uppercase tracking-[0.2em]" style={{ color: NL.blue }}>
                      IA
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}