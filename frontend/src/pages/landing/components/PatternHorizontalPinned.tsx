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
 *   · Cada escena (PatternPanelVisual) recibe su progreso local
 *     mientras es el panel activo, controlando su "cámara" (zoom/
 *     parallax) y overlays SVG como una película por scroll.
 *   · En móvil/tablet se desactiva el pin y los paneles fluyen
 *     apilados, manteniendo la usabilidad.
 *   · Indicador de progreso (dots 01–05 + barra) sincronizado.
 *
 * Accesibilidad: prefers-reduced-motion → estado estático apilado.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef, useState, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import PatternPanelVisual, { type PatternPanelVisualHandle } from './PatternPanelVisual';
import { NEURO_PATTERNS, RESPONSIVE } from '../config/landing.config';

gsap.registerPlugin(ScrollTrigger);

/** Paneles visibles: 5 patrones (la convergencia se integra al final). */
const PANEL_COUNT = NEURO_PATTERNS.length;

export default function PatternHorizontalPinned() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Refs a los visuales de cada escena para scrubearlos.
  const visualRefs = useRef<(PatternPanelVisualHandle | null)[]>([]);
  const setVisualRef = useCallback((i: number) => (el: PatternPanelVisualHandle | null) => {
    visualRefs.current[i] = el;
  }, []);

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

    const panels = Array.from(track.querySelectorAll<HTMLElement>('[data-ppanel]'));
    const navDots = Array.from(section.querySelectorAll<HTMLElement>('[data-ppnav]'));
    const progressFill = progressFillRef.current;

    const measure = () => track.scrollWidth - (section.clientWidth || window.innerWidth);

    if (reduce || isMobile) {
      gsap.set([panels, navDots], { opacity: 1 });
      if (progressFill) gsap.set(progressFill, { scaleX: 1 });
      // Mostrar escenas en estado final en móvil/reduced
      visualRefs.current.forEach((v) => v?.play(1));
      return;
    }

    gsap.set(panels, { opacity: 1 });
    if (progressFill) gsap.set(progressFill, { scaleX: 0, transformOrigin: 'left center' });
    visualRefs.current.forEach((v) => v?.reset());

    const dist = () => Math.max(0, measure());

    // ── Timeline horizontal scrubbed ──
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${dist() + window.innerHeight * 0.4}`,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const p = self.progress;
          if (progressFill) progressFill.style.transform = `scaleX(${p})`;

          // Índice activo
          const activeIdx = Math.min(PANEL_COUNT - 1, Math.floor(p * PANEL_COUNT + 0.0001));
          navDots.forEach((dot, i) => dot.classList.toggle('pp-active', i === activeIdx));

          // Scrub de cada escena con su progreso local (0..1)
          const perPanel = 1 / PANEL_COUNT;
          visualRefs.current.forEach((v, i) => {
            if (!v) return;
            const start = i * perPanel;
            const local = Math.max(0, Math.min(1, (p - start) / perPanel));
            // La escena anterior queda en estado final (1), la siguiente espera.
            v.play(local);
          });
        },
      },
    });

    // Entrada/salida suave del track.
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
      style={{ background: '#ffffff', color: '#0a0a0a' }}
    >
      {/* Cabecera compacta (no tapa las escenas) */}
      <div className="pp-header">
        <p className="nl-mono pp-kicker">
          <span className="nl-dot-live" aria-hidden="true" />
          Los 5 patrones neurodigitales
        </p>
        <h2 className="pp-title">NeuroLearn observa cómo interactúas.</h2>
      </div>

      {/* ── Track horizontal ── */}
      <div ref={trackRef} className="pp-track">
        {NEURO_PATTERNS.map((p, i) => (
          <article key={p.id} data-ppanel className="pp-slot">
            <div className="pp-slot-inner">
              <div className="pp-slot-text">
                <span className="pp-index" style={{ color: p.accent }}>{p.index}</span>
                <span className="pp-tag">{p.tag}</span>
                <h3 className="pp-slot-title">{p.title}</h3>
                <p className="pp-slot-desc">{p.desc}</p>
              </div>
              <div className="pp-slot-visual">
                <PatternPanelVisual
                  ref={setVisualRef(i)}
                  id={p.id}
                  image={p.image}
                  labels={p.labels}
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ── Indicador de progreso ── */}
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