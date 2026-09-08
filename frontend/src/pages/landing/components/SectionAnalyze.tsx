/**
 * SectionAnalyze.tsx — Sección 2 · "Neuron analiza"
 * ─────────────────────────────────────────────────────────────
 * Dark. Neuron procesa información: partículas y líneas se
 * desplazan alrededor del robot mientras se describen las señales
 * que lee. Fondo negro profundo, Neuron a la derecha (desktop)
 * / centro (móvil), métricas a la izquierda.
 * ─────────────────────────────────────────────────────────────
 */
import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';

import SectionHeading from './SectionHeading';
import NeuronGlyph from './NeuronGlyph';
import NeuralCanvasBackground from './NeuralCanvasBackground';
import useGsapReveal from '../hooks/useGsapReveal';
import { NL, RESPONSIVE } from '../config/landing.config';

const SIGNALS = [
  { key: 'Facial',   val: 'Rostro',     pct: 96 },
  { key: 'Voz',      val: 'Prosodia',   pct: 92 },
  { key: 'Teclado',  val: 'Escritura',  pct: 88 },
  { key: 'Interacción', val: 'Navegación', pct: 85 },
  { key: 'Rendimiento', val: 'Progreso', pct: 94 },
];

export default function SectionAnalyze() {
  const scopeRef = useGsapReveal();
  const wrapRef = useRef<HTMLDivElement>(null);
  const robotFloatRef = useRef<HTMLDivElement>(null);
  const [isMobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < RESPONSIVE.mobileBreakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Flotación suave del robot + barras que se rellenan al entrar.
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      if (robotFloatRef.current) {
        gsap.to(robotFloatRef.current, { y: '+=12', duration: 4.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }
      gsap.utils.toArray<HTMLElement>('[data-pct]').forEach((el) => {
        const target = Number(el.getAttribute('data-pct') || 0);
        gsap.fromTo(el, { scaleX: 0 }, {
          scaleX: target / 100,
          ease: 'power3.out',
          duration: 1.4,
          transformOrigin: 'left center',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        });
      });
    });
    return () => ctx.revert();
  }, []);

  const metrics = [
    { label: 'Voz',     note: 'Tono, ritmo, pausas',      pct: 96 },
    { label: 'Rostro',  note: 'Atención y microexpresión', pct: 92 },
    { label: 'Teclado', note: 'Fluidez y dudas',          pct: 88 },
  ];

  return (
    <section
      ref={scopeRef}
      className="nl-section nl-bg-black-2 relative overflow-hidden"
      aria-label="Cómo Neuron analiza la información"
      id="analisis"
    >
      <NeuralCanvasBackground className="absolute inset-0 opacity-40" caption="dark" />
      {/* Orbs decorativos */}
      <div className="nl-orbit" style={{ width: 520, height: 520, left: '58%', top: '10%', opacity: 0.5 }} />
      <div className="nl-orbit" style={{ width: 760, height: 760, left: '52%', top: '-10%', opacity: 0.3 }} />

      <div ref={wrapRef} className="nl-container grid items-center gap-12 lg:grid-cols-2">
        {/* Texto */}
        <div>
          <SectionHeading
            eyebrow="01 · Análisis neuronal"
            title="Neuron decodifica"
            highlight="cómo aprende."
            lead="No se limita a escuchar respuestas: lee cómo te expresas, cómo escribes, cómo reaccionas y cómo avanzas — lo suficiente para construir un perfil único de aprendizaje."
          />

          <div className="mt-10 space-y-5">
            {metrics.map((m) => (
              <div key={m.label} className="nl-card p-5" style={{ borderRadius: 14, background: 'rgba(10,10,10,0.5)' }}>
                <div className="flex items-center justify-between">
                  <span className="nl-mono text-sm font-semibold text-white">{m.label}</span>
                  <span className="text-xs text-neutral-400">{m.note}</span>
                </div>
                <div className="mt-3 h-1 w-full rounded-full bg-white/5" style={{ overflow: 'hidden' }}>
                  <div
                    data-pct={m.pct}
                    className="h-full w-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${NL.blue}, ${NL.blueBright})` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Neuron analizando */}
        <div className="relative flex items-center justify-center" style={{ minHeight: 420 }}>
          <div ref={robotFloatRef} className="relative">
            <NeuronGlyph size={isMobile ? 260 : 360} active />
            {/* Orbits con nodos */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="nl-orbit"
                style={{
                  width: 300 + i * 90,
                  height: 300 + i * 90,
                  left: '50%', top: '50%',
                  transform: 'translate(-50%,-50%)',
                  opacity: 0.35,
                }}
              />
            ))}
            {SIGNALS.map((s, i) => (
              <div key={s.key} className="nl-node" style={{
                left: `${[8, 88, 4, 94, 46][i]}%`,
                top: `${[18, 24, 76, 70, 38][i]}%`,
                width: 12, height: 12,
                background: i % 2 ? NL.blueBright : NL.blueSoft,
                boxShadow: `0 0 14px ${NL.blueBright}`,
              }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}