/**
 * PatternHorizontalPinned.tsx
 * ─────────────────────────────────────────────────────────────
 * La sección FIRMA de la Landing: los 5 patrones neurodigitales
 * recorridos en horizontal controlado por el scroll vertical.
 *
 * Técnica (GSAP + ScrollTrigger):
 *   · La sección se "pineea" (pin: true) mientras el usuario hace
 *     scroll vertical; en ese tramo, un track interno se traslada
 *     horizontalmente (x) panel a panel — escritorio.
 *   · En móvil/tablet se desactiva el pin y los paneles fluyen
 *     como una galería vertical, manteniendo la usabilidad.
 *   · Un indicador de progreso (barras numeradas 01–05) + barra de
 *     avance se sincronizan con el scrub.
 *   · Al terminar el recorrido, los 5 patrones CONVERGEN en Neuron
 *     ("Cada interacción cuenta") antes de soltar el pin.
 *
 * Accesibilidad: prefers-reduced-motion → estado estático apilado.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import NeuronGlyph from './NeuronGlyph';
import PatternPanelVisual from './PatternPanelVisual';
import { NEURO_PATTERNS, RESPONSIVE } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

/** Paneles visibles al entrar: 5 patrones + 1 panel de convergencia. */
const PANEL_COUNT = NEURO_PATTERNS.length + 1;

export default function PatternHorizontalPinned() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
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
    const track = trackRef.current;
    if (!section || !track) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Paneles y etiquetas activas ──
    const panels = Array.from(track.querySelectorAll<HTMLElement>('[data-ppanel]'));
    const navDots = Array.from(section.querySelectorAll<HTMLElement>('[data-ppnav]'));
    const progressFill = progressFillRef.current;

    // Estimar la "distancia" horizontal: ancho del track menos viewport.
    const measure = () => track.scrollWidth - (section.clientWidth || window.innerWidth);

    if (reduce || isMobile) {
      // Sin pin: mostrar todo apilado/visible.
      gsap.set([panels, navDots], { opacity: 1 });
      if (progressFill) gsap.set(progressFill, { scaleX: 1 });
      return;
    }

    // Estado inicial
    gsap.set(panels, { opacity: 1 });
    if (progressFill) gsap.set(progressFill, { scaleX: 0, transformOrigin: 'left center' });

    const dist = () => Math.max(0, measure());

    // ── Timeline horizontal scrubbed ──
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${dist() + window.innerHeight * 0.3}`,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const p = self.progress;
          // Barra de progreso
          if (progressFill) progressFill.style.transform = `scaleX(${p})`;
          // Índice activo para los nav dots
          const activeIdx = Math.min(
            PANEL_COUNT - 1,
            Math.floor(p * PANEL_COUNT + 0.0001),
          );
          navDots.forEach((dot, i) => {
            dot.classList.toggle('pp-active', i === activeIdx);
          });
        },
      },
    });

    // ── Entrada/salida suave del track (opacity) ──
    gsap.fromTo(track, { opacity: 0.6, scale: 0.985 }, {
      opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: section, start: 'top 90%', toggleActions: 'play none none reverse' },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  return (
    <section
      ref={sectionRef}
      id="patrones"
      className="pp-section relative overflow-hidden"
      aria-label="Los cinco patrones neurodigitales de NeuroLearn"
      style={{ background: '#04060a', color: '#eef2f1' }}
    >
      {/* Cabecera fija de la sección (dentro del área pineada) */}
      <div className="pp-header">
        <p className="nl-mono pp-kicker">
          <span className="nl-dot-live" aria-hidden="true" />
          Los 5 patrones neurodigitales
        </p>
        <h2 className="pp-title">NeuroLearn observa cómo interactúas.</h2>
        <p className="pp-sub">Cinco patrones nos ayudan a entender tu experiencia de aprendizaje.</p>
      </div>

      {/* ── Track horizontal ├──────────┤ ── */}
      <div ref={trackRef} className="pp-track">
        {NEURO_PATTERNS.map((p) => (
          <article
            key={p.id}
            data-ppanel
            className="pp-slot"
          >
            <div className="pp-slot-inner">
              <div className="pp-slot-text">
                <span className="pp-index" style={{ color: p.accent }}>{p.index}</span>
                <span className="pp-tag">{p.tag}</span>
                <h3 className="pp-slot-title">{p.title}</h3>
                <p className="pp-slot-desc">{p.desc}</p>
                <div className="pp-slot-labels">
                  {p.labels.map((l) => (
                    <span key={l} className="pp-slot-label">{l}</span>
                  ))}
                </div>
              </div>
              <div className="pp-slot-visual">
                <PatternPanelVisual id={p.id} />
              </div>
            </div>
          </article>
        ))}

        {/* ── Panel final: convergencia en Neuron ── */}
        <article data-ppanel className="pp-slot pp-slot-convergence">
          <div className="pp-convergence">
            {/* Los 5 patrones orbitando hacia el centro Neuron */}
            <div className="pp-convergence-stage">
              {NEURO_PATTERNS.map((p, i) => {
                const ang = (i / NEURO_PATTERNS.length) * Math.PI * 2 - Math.PI / 2;
                const rx = 180, ry = 140;
                const x = Math.cos(ang) * rx;
                const y = Math.sin(ang) * ry;
                return (
                  <span
                    key={p.id}
                    className="pp-converge-node"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      borderColor: p.accent,
                      color: p.accent,
                    }}
                  >
                    {p.title}
                  </span>
                );
              })}
              <div className="pp-converge-center">
                <NeuronGlyph size={170} active />
              </div>
            </div>

            <h3 className="pp-converge-title">Cada interacción cuenta.</h3>
            <p className="pp-converge-sub">
              NeuroLearn combina estas señales para construir una experiencia de aprendizaje más personalizada.
            </p>
          </div>
        </article>
      </div>

      {/* ── Indicador de progreso (nav dots + barra) ── */}
      <div className="pp-progress">
        <div className="pp-progress-dots">
          {Array.from({ length: PANEL_COUNT }).map((_, i) => (
            <span key={i} data-ppnav className={`pp-progress-dot ${i === 0 ? 'pp-active' : ''}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
          ))}
        </div>
        <div className="pp-progress-track">
          <div ref={progressFillRef} className="pp-progress-fill" />
        </div>
      </div>
    </section>
  );
}