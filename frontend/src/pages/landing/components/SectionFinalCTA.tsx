/**
 * SectionFinalCTA.tsx — CTA final
 * ─────────────────────────────────────────────────────────────
 * Dark. Neuron vuelve a ser protagonista, flotando sobre el mensaje
 * final. Copy grande + CTA fuerte. Ojos/partículas y glow azul.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

import NeuronGlyph from './NeuronGlyph';
import NeuronParticleSystem, { type NeuronParticleSystemHandle } from './NeuronParticleSystem';
import useGsapReveal from '../hooks/useGsapReveal';
import { CTA_FINAL, NL, RESPONSIVE } from '../config/landing.config';

export default function SectionFinalCTA() {
  const scopeRef = useGsapReveal({ start: 'top 70%' });
  const partsRef = useRef<NeuronParticleSystemHandle>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isMobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < RESPONSIVE.mobileBreakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Encender partículas + glow + flotación cuando entra en viewport.
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      if (glowRef.current) glowRef.current.style.opacity = '1';
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(glowRef.current, { opacity: 0 }, {
        opacity: 1, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: scopeRef.current, start: 'top 60%', toggleActions: 'play none none none' },
        onStart: () => partsRef.current?.connect(1),
      });
      if (floatRef.current) {
        gsap.to(floatRef.current, { y: '+=12', duration: 3.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }
    }, scopeRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={scopeRef}
      className="nl-section nl-bg-black relative overflow-hidden"
      style={{ minHeight: '94vh' }}
      aria-label="Llamado final"
      id="cta"
    >
      {/* Fondo */}
      <div aria-hidden="true" className="absolute inset-0" style={{
        background: 'radial-gradient(120% 100% at 50% 100%, #101116 0%, #070708 55%, #050505 100%)',
      }} />
      <div aria-hidden="true" className="nl-grid-bg absolute inset-0 opacity-30" />
      {/* Partículas conexionistas */}
      <NeuronParticleSystem ref={partsRef} className="absolute inset-0 opacity-70" />

      {/* Glow azul central */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          opacity: 0,
          background: 'radial-gradient(46% 46% at 50% 28%, rgba(37,99,235,0.32) 0%, rgba(37,99,235,0.05) 55%, transparent 75%)',
        }}
      />

      <div className="nl-container flex flex-col items-center text-center">
        {/* Neuron protagonista */}
        <div className="relative">
          <div ref={floatRef} className="relative">
            <NeuronGlyph size={isMobile ? 170 : 200} active />
            <div className="nl-orbit" style={{ width: 340, height: 340, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', opacity: 0.4 }} />
            <div className="nl-orbit" style={{ width: 300, height: 300, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', opacity: 0.25 }} />
          </div>
        </div>

        {/* Copy proteinomial */}
        <p className="nl-kicker nl-reveal" style={{ color: NL.blueSoft, marginTop: isMobile ? 24 : 40 }}>
          <span className="nl-dot-live" aria-hidden="true" />
          {CTA_FINAL.eyebrow}
        </p>

        <h2
          className="nl-h nl-reveal"
          style={{
            fontSize: 'clamp(30px, 5.2vw, 58px)',
            lineHeight: 1.05,
            marginTop: 20,
            color: '#fff',
            letterSpacing: '-0.02em',
          }}
        >
          {CTA_FINAL.headline}
          <br />
          <span style={{ color: 'transparent', backgroundImage: `linear-gradient(92deg, ${NL.blueBright}, ${NL.blueSoft})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
            {CTA_FINAL.highlight}
          </span>
        </h2>

        <p
          className="nl-reveal"
          style={{ marginTop: 22, fontSize: '17px', lineHeight: 1.65, color: '#B8B8B8', maxWidth: 600 }}
        >
          {CTA_FINAL.subline}
        </p>

        <div className="nl-reveal mt-9 flex flex-wrap items-center justify-center gap-4">
          <a href="/login" className="nl-btn nl-btn-primary" style={{ padding: '17px 36px', fontSize: '16px' }}>
            {CTA_FINAL.primary}
            <span className="nl-btn-arrow" aria-hidden="true">→</span>
          </a>
          <a href="#chattutor" className="nl-btn nl-btn-secondary">
            {CTA_FINAL.secondary}
          </a>
        </div>

        <p className="nl-mono nl-reveal" style={{ marginTop: 44, fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#6b6b6b' }}>
          {CTA_FINAL.footer}
        </p>
      </div>
    </section>
  );
}