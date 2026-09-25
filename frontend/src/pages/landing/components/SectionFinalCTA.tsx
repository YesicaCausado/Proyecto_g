/**
 * SectionFinalCTA.tsx — CTA final (visión cinematográfica)
 * ─────────────────────────────────────────────────────────────
 * Fondo claro (gris/azul muy sutil). Neuron es el protagonista:
 * entra con escala/fade + flotación, acompaña al mensaje final y
 * reacciona al scroll (desciende sutilmente mientras el usuario
 * llega). Partículas conexionistas + glow azul suave.
 *
 * Técnica: GSAP + ScrollTrigger + RobotCanvas (robot.glb 3D real)
 * + NeuronParticleSystem. prefers-reduced-motion → estado estático.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import RobotCanvas from '../../auth/components/robot/RobotCanvas';
import NeuronParticleSystem, { type NeuronParticleSystemHandle } from './NeuronParticleSystem';
import useInViewport from '../hooks/useInViewport';
import { CTA_FINAL, NL, RESPONSIVE } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

export default function SectionFinalCTA() {
  const { ref: sectionRef, inView } = useInViewport<HTMLElement>();
  const partsRef = useRef<NeuronParticleSystemHandle>(null);
  const neuronWrapRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isMobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < RESPONSIVE.mobileBreakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const reveals = section.querySelectorAll<HTMLElement>('[data-cta]');
      const neuron = neuronWrapRef.current;
      const glow = glowRef.current;

      if (reduce) {
        gsap.set(reveals, { opacity: 1, y: 0 });
        if (neuron) gsap.set(neuron, { opacity: 1, scale: 1 });
        if (glow) gsap.set(glow, { opacity: 1 });
        return;
      }

      gsap.set(reveals, { opacity: 0, y: 30 });
      if (neuron) gsap.set(neuron, { opacity: 0, scale: 0.7, y: 40 });

      // ── Timeline cinematográfico de entrada ──
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top 65%', toggleActions: 'play none none none' },
        defaults: { ease: 'power3.out', duration: 0.9 },
      });

      tl.to(neuron, { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0)
        .to(glow, { opacity: 1, duration: 1.4, ease: 'power2.out' }, 0.2)
        .to(reveals, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 }, '-=0.6');

      // Neuron desciende ligeramente con el scroll (scrub).
      gsap.fromTo(neuron, { y: 0 }, {
        y: 30, ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 40%',
          end: 'bottom 55%',
          scrub: 0.6,
        },
      });

      // Flotación continua en el contenedor interno.
      if (floatRef.current) {
        gsap.to(floatRef.current, { y: '+=10', duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }

      // Partículas se encienden al entrar.
      if (glow) {
        gsap.fromTo(glow, { opacity: 0 }, {
          opacity: 1, duration: 1.4, ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 60%', toggleActions: 'play none none none' },
          onStart: () => partsRef.current?.connect(1),
        });
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="cta"
      className="nl-section relative overflow-hidden"
      style={{ minHeight: '94vh', background: 'linear-gradient(180deg, #f6f8fb 0%, #eef2f8 100%)' }}
      aria-label="Llamado final"
    >
      {/* Fondo técnico sutil */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            'linear-gradient(to bottom, rgba(37,99,235,0.04) 1px, transparent 1px)',
            'linear-gradient(to right, rgba(37,99,235,0.04) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(120% 100% at 50% 20%, #000 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(120% 100% at 50% 20%, #000 20%, transparent 80%)',
        }}
        aria-hidden="true"
      />

      {/* Partículas conexionistas (azul suave sobre claro) */}
      <NeuronParticleSystem ref={partsRef} className="absolute inset-0 opacity-60" />

      {/* Glow azul central */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          opacity: 0,
          background: 'radial-gradient(46% 46% at 50% 30%, rgba(37,99,235,0.16) 0%, rgba(37,99,235,0.03) 55%, transparent 75%)',
        }}
      />

      <div className="nl-container flex flex-col items-center text-center">
        {/* Neurón real (robot.glb 3D) protagonista */}
        <div ref={neuronWrapRef} className="relative">
          <div ref={floatRef} className="relative" style={{ width: 'min(78vw, 460px)', height: 'clamp(320px, 48vh, 440px)' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              {inView && (
                <RobotCanvas robotState="idle" transparent className="h-full w-full" />
              )}
            </div>
            <div className="nl-orbit" style={{ width: 320, height: 320, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', opacity: 0.35 }} />
            <div className="nl-orbit" style={{ width: 280, height: 280, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', opacity: 0.22 }} />
          </div>
        </div>

        {/* Copy */}
        <p data-cta className="nl-kicker" style={{ color: NL.blue, marginTop: isMobile ? 24 : 40 }}>
          <span className="nl-dot-live" aria-hidden="true" />
          {CTA_FINAL.eyebrow}
        </p>

        <h2
          data-cta
          className="nl-h"
          style={{
            fontSize: 'clamp(30px, 5.2vw, 58px)',
            lineHeight: 1.05,
            marginTop: 20,
            color: '#0a0a0a',
            letterSpacing: '-0.02em',
          }}
        >
          {CTA_FINAL.headline}
          <br />
          <span
            style={{
              color: 'transparent',
              backgroundImage: `linear-gradient(92deg, ${NL.blue}, ${NL.blueBright})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            {CTA_FINAL.highlight}
          </span>
        </h2>

        <p
          data-cta
          style={{ marginTop: 22, fontSize: '17px', lineHeight: 1.65, color: '#5b5b5b', maxWidth: 600 }}
        >
          {CTA_FINAL.subline}
        </p>

        <div data-cta className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <a href="#/login" className="nl-btn nl-btn-primary" style={{ padding: '17px 36px', fontSize: '16px' }}>
            {CTA_FINAL.primary}
            <span className="nl-btn-arrow" aria-hidden="true">→</span>
          </a>
          <a href="#instituciones" className="nl-btn nl-btn-outline-dark">
            {CTA_FINAL.secondary}
          </a>
        </div>

        <p data-cta className="nl-mono" style={{ marginTop: 44, fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#8a8a8a' }}>
          {CTA_FINAL.footer}
        </p>
      </div>
    </section>
  );
}