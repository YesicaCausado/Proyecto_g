/**
 * PatternPanelVisual.tsx
 * ─────────────────────────────────────────────────────────────
 * Visuales a pantalla completa de cada patrón neurodigital para la
 * experiencia horizontal pinneada (PatternHorizontalPinned). Cada
 * visual es una representación futurista y minimalista (SIN cámara
 * real) que "se enciende" progresivamente con el scroll (scrub):
 *
 *   · facial       → SVG draw (stroke-dashoffset) + beam lines +
 *                    puntos faciales que se activan en cadena
 *   · voz          → audio waveform animada + ritmo/pausas/prosodia
 *   · teclado      → typing animation (TextPlugin) + text cursor +
 *                    stagger de teclas que se iluminan
 *   · interaccion  → magnet (cursor atrae tarjetas) + spotlight card
 *                    + recorrido MotionPath
 *   · rendimiento  → number ticker (0→94%) + progress bars + ScrollTrigger
 *
 * Técnicas: GSAP + ScrollTrigger + MotionPathPlugin + TextPlugin.
 * Para el "draw" de SVG se usa stroke-dashoffset nativo (equivale a
 * DrawSVG sin depender del plugin premium). Cada visual expone
 * play(progress)/reset()/timeline() para ser scrubeados por la
 * sección pinneada. prefers-reduced-motion → estado estático visible.
 * ─────────────────────────────────────────────────────────────
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { TextPlugin } from 'gsap/TextPlugin';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, TextPlugin);

export interface PatternPanelVisualHandle {
  /** Scrub 0→1 del visual (el panel llama con su progreso local) */
  play(progress: number): void;
  /** Vuelve al estado inicial (sin re-animar) */
  reset(): void;
  /** Timeline GSAP crudo por si el panel quiere sincronizar */
  timeline(): gsap.core.Timeline | null;
}

interface Props {
  id: string;
  style?: CSSProperties;
  /** Ancho real del viewport para calibra el magnet/spotlight */
}

export default forwardRef<PatternPanelVisualHandle, Props>(
  function PatternPanelVisual({ id, style }, ref) {
    const scopeRef = useRef<HTMLDivElement>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);

    const reduce = useReduce();

    useImperativeHandle(ref, () => ({
      play(progress: number) {
        const tl = tlRef.current;
        if (!tl) return;
        tl.progress(Math.max(0, Math.min(1, progress)));
      },
      reset() {
        tlRef.current?.progress(0);
      },
      timeline() {
        return tlRef.current;
      },
    }), []);

    // Construir el timeline GSAP una sola vez, acotado al scope del visual.
    useLayoutEffect(() => {
      if (reduce) return;
      const scope = scopeRef.current;
      if (!scope || tlRef.current) return;
      const tl = buildTimeline(id, scope);
      if (tl) {
        tl.pause(0);
        tlRef.current = tl;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduce]);

    return (
      <div ref={scopeRef} className="pp-visual" style={style} aria-hidden="true">
        {renderVisual(id)}
      </div>
    );
  },
);

function useReduce(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Elige el builder de timeline según el id del patrón. */
function buildTimeline(id: string, scope: HTMLDivElement): gsap.core.Timeline | null {
  switch (id) {
    case 'facial':      return facialTL(scope);
    case 'voz':         return voiceTL(scope);
    case 'teclado':     return typingTL(scope);
    case 'interaccion': return interactionTL(scope);
    case 'rendimiento': return trendTL(scope);
    default:            return null;
  }
}

/** Elige el JSX del visual según el id. */
function renderVisual(id: string): ReactNode {
  switch (id) {
    case 'facial':      return <Facial />;
    case 'voz':         return <Voice />;
    case 'teclado':     return <Typing />;
    case 'interaccion': return <Interaction />;
    case 'rendimiento': return <Trend />;
    default:            return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   FACIAL — SVG draw + beam lines + puntos de seguimiento
   ═══════════════════════════════════════════════════════════ */
// Puntos de seguimiento facial (grid sobre el óvalo).
const FACE_POINTS: { x: number; y: number }[] = [
  { x: 122, y: 96 },  { x: 178, y: 96 },   // cejas
  { x: 108, y: 140 }, { x: 192, y: 140 },  // ojos
  { x: 122, y: 176 }, { x: 178, y: 176 },  // pómulos
  { x: 150, y: 200 },                       // nariz
  { x: 132, y: 236 }, { x: 168, y: 236 },  // boca
  { x: 150, y: 272 },                       // mentón
];

function Facial() {
  return (
    <div className="pp-panel pp-panel-facial relative h-full w-full">
      <svg className="pp-face-full" viewBox="0 0 300 320" width="100%" height="100%" fill="none">
        <rect width="300" height="320" fill="transparent" />
        {/* Óvalo del rostro (draw con stroke-dashoffset) */}
        <ellipse
          className="pp-face-outline"
          cx="150" cy="168" rx="84" ry="118"
          stroke="url(#pp-grad)" strokeWidth="2"
          fill="rgba(59,130,246,0.03)"
        />
        {/* Líneas "beam" desde el centro hacia cada punto */}
        {FACE_POINTS.map((p, i) => (
          <line
            key={`l${i}`}
            className="pp-face-line"
            x1="150" y1="168" x2={p.x} y2={p.y}
            stroke="url(#pp-beam)" strokeWidth="1.2" strokeLinecap="round"
            data-face-line
          />
        ))}
        {/* Nodos de seguimiento */}
        {FACE_POINTS.map((p, i) => (
          <g key={`d${i}`}>
            <circle className="pp-face-ring" cx={p.x} cy={p.y} r="8" fill="none" stroke="rgba(96,165,250,0.35)" strokeWidth="1" />
            <circle className="pp-face-dot" cx={p.x} cy={p.y} r="4.4" fill="#3B82F6" />
          </g>
        ))}
        <defs>
          <linearGradient id="pp-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60A5FA" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="pp-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(96,165,250,0)" />
            <stop offset="0.5" stopColor="rgba(96,165,250,0.9)" />
            <stop offset="1" stopColor="rgba(96,165,250,0)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="pp-label">Microexpresiones</span>
    </div>
  );
}

function facialTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const face = scope.querySelector('.pp-face');
  const outline = scope.querySelector('.pp-face-outline');
  const dots = scope.querySelectorAll('.pp-face-dot');
  const rings = scope.querySelectorAll('.pp-face-ring');
  const lines = scope.querySelectorAll('[data-face-line]');
  const label = scope.querySelector('.pp-label');
  if (!face || !outline || !label) return tl;
  if (outline) {
    const len = 2 * Math.PI * (84 + 118) * 0.5; // aprox perímetro de la elipse
    gsap.set(outline, { strokeDasharray: len, strokeDashoffset: len });
  }
  tl.fromTo(face, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.5 }, 0)
    // Draw del contorno
    .to(outline, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.inOut' }, 0.15)
    // Beam lines se "dibujan" desde el centro (scaleX)
    .fromTo(lines, { scaleX: 0, opacity: 0, transformOrigin: 'left center' },
      { scaleX: 1, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power1.inOut' }, 0.4)
    // Puntos se activan en cadena
    .fromTo(dots, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, stagger: 0.055, ease: 'back.out(2.4)' }, 0.55)
    // Anillos "pulse" en puntos clave
    .fromTo(rings, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, 0.65)
    .fromTo(label, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 0.9);
  return tl;
}

/* ═══════════════════════════════════════════════════════════
   VOZ — audio waveform animada + prosodia/ritmo/pausas
   ═══════════════════════════════════════════════════════════ */
function Voice() {
  const heights = [0.28, 0.55, 0.4, 0.95, 0.5, 1, 0.62, 0.74, 0.38, 0.88, 0.48, 0.68, 0.32, 0.58, 0.44, 0.82, 0.52, 0.7, 0.36, 0.6];
  return (
    <div className="pp-panel pp-panel-voice relative flex h-full w-full flex-col items-center justify-center gap-9">
      <div className="pp-wave" aria-hidden="true">
        {heights.map((h, i) => (
          <span
            key={i}
            className="pp-voice-bar"
            data-wavebar
            style={{ height: `${Math.round(h * 132)}px` }}
          />
        ))}
      </div>
      {/* Labels de prosodia/ritmo/pausas que se encienden */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {['Prosodia', 'Ritmo', 'Pausas'].map((l) => (
          <span key={l} className="pp-voice-label">{l}</span>
        ))}
      </div>
    </div>
  );
}

function voiceTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const bars = scope.querySelectorAll('[data-wavebar]');
  const labels = scope.querySelectorAll('.pp-voice-label');
  // La onda "aparece" barra a barra con amplitud creciente.
  tl.fromTo(bars, { scaleY: 0.06, opacity: 0, transformOrigin: 'center center' },
    { scaleY: 1, opacity: 1, duration: 0.45, stagger: 0.03, ease: 'back.out(1.6)' }, 0)
    // Desplazamiento lateral sutil de la onda (sensación de audio vivo)
    .to(bars, { y: () => gsap.utils.random(-4, 4), duration: 0.6, stagger: 0.02, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.5)
    .fromTo(labels, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12 }, 0.7);
  return tl;
}

/* ═══════════════════════════════════════════════════════════
   TECLADO — typing animation + text cursor + teclas iluminadas
   ═══════════════════════════════════════════════════════════ */
const TYPED_TEXT = 'aprendizaje adaptativo';
const KEY_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];
const HOT_KEYS = new Set(['A', 'P', 'R', 'E', 'N', 'D', 'I', 'Z', 'J', 'T']);

function Typing() {
  return (
    <div className="pp-panel pp-panel-keyboard relative flex h-full w-full flex-col items-center justify-center gap-9">
      {/* Línea de texto tipeada con cursor */}
      <div className="pp-typed">
        <span className="pp-typed-text" data-typed />
        <span className="pp-cursor-caret" data-caret />
      </div>

      <div className="flex flex-col gap-2">
        {KEY_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2">
            {row.map((k) => (
              <span
                key={k}
                className={`pp-key ${HOT_KEYS.has(k) ? 'pp-key-hot' : ''}`}
                data-key={k}
              >{k}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {['Velocidad', 'Pausas', 'Errores'].map((l) => (
          <span key={l} className="pp-voice-label">{l}</span>
        ))}
      </div>
    </div>
  );
}

function typingTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const typed = scope.querySelector('[data-typed]');
  const caret = scope.querySelector('[data-caret]');
  const keys = scope.querySelectorAll('.pp-key');
  const hot = scope.querySelectorAll('.pp-key-hot');
  const labels = scope.querySelectorAll('.pp-voice-label');
  if (!typed) return tl;

  tl.fromTo(keys, { opacity: 0, y: 16, scale: 0.94 },
    { opacity: 1, y: 0, scale: 1, duration: 0.35, stagger: 0.02, ease: 'back.out(1.8)' }, 0)
    // Typing animation con TextPlugin (escribe el texto carácter a carácter)
    .fromTo(typed, { text: '' }, {
      text: TYPED_TEXT, duration: 1.2, ease: 'none',
    }, 0.35)
    // Cursor parpadeando mientras escribe
    .fromTo(caret, { opacity: 0 }, { opacity: 1, duration: 0.15, repeat: 7, yoyo: true }, 0.35)
    // Teclas "calientes" se iluminan conforme avanza la escritura
    .fromTo(hot, { backgroundColor: 'rgba(96,165,250,0.10)', color: '#e5e7eb' },
      { backgroundColor: '#3B82F6', color: '#0b1220', duration: 0.25, stagger: 0.12, ease: 'power1.inOut' }, 0.5)
    .to(hot, { backgroundColor: 'rgba(96,165,250,0.10)', color: '#e5e7eb', duration: 0.25, stagger: 0.12 }, 1.0)
    .fromTo(labels, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, 1.2)
    .fromTo(caret, { opacity: 1 }, { opacity: 0.25, duration: 0.4, repeat: -1, yoyo: true }, 1.6);
  return tl;
}

/* ═══════════════════════════════════════════════════════════
   INTERACCIÓN — magnet (cursor atrae tarjetas) + spotlight + path
   ═══════════════════════════════════════════════════════════ */
const UI_BOXES = [
  { id: 'a', top: '14%', left: '12%' },
  { id: 'b', top: '16%', left: '58%' },
  { id: 'c', top: '60%', left: '18%' },
  { id: 'd', top: '62%', left: '52%', wide: true },
];

function Interaction() {
  return (
    <div className="pp-panel pp-panel-interaction relative flex h-full w-full flex-col items-center justify-center gap-8">
      <div className="pp-ui-stage" data-spotlight>
        {/* Cursor */}
        <div className="pp-cursor" data-cursor>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 3l14 8-6 1.5L9.5 18 5 3z" fill="#3B82F6" stroke="#fff" strokeWidth="1.2" />
          </svg>
        </div>
        <span className="pp-click-ring" data-ring />
        {/* Elementos de interfaz (magnéticos) */}
        {UI_BOXES.map((b) => (
          <div
            key={b.id}
            className={`pp-ui-box ${b.wide ? 'pp-ui-box-wide' : ''}`}
            data-magnet
            style={{ top: b.top, left: b.left }}
          />
        ))}
        {/* Spotlight */}
        <span className="pp-spotlight" data-spot />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {['Click', 'Navegación', 'Interacción'].map((l) => (
          <span key={l} className="pp-voice-label">{l}</span>
        ))}
      </div>
    </div>
  );
}

function interactionTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, paused: true });
  const cursor = scope.querySelector('[data-cursor]');
  const boxes = scope.querySelectorAll('[data-magnet]');
  const ring = scope.querySelector('[data-ring]');
  const spot = scope.querySelector('[data-spot]');
  const labels = scope.querySelectorAll('.pp-voice-label');
  if (!cursor || !ring) return tl;
  const stage = cursor.closest('.pp-ui-stage');

  tl.fromTo(cursor, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
    .fromTo(boxes, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.1)
    // Recorrido con MotionPath por el stage (píxeles, stage 320×220)
    .to(cursor, {
      motionPath: {
        path: [
          { x: 0,    y: 0 },
          { x: -90,  y: -60 },
          { x: 70,   y: -50 },
          { x: 55,   y: 60 },
          { x: -70,  y: 50 },
        ],
        curviness: 1.4,
        alignOrigin: [0.5, 0.5],
        autoRotate: false,
      },
      duration: 2.6,
      ease: 'none',
    }, 0.3)
    // Magnet: cada caja se "asoma" hacia el cursor al pasar
    .to(boxes, { scale: 1.06, duration: 0.25, stagger: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.6)
    // Spotlight que sigue al recorrido
    .fromTo(spot, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'power1.inOut' }, 0.3)
    // Clic en puntos calientes
    .fromTo(ring, { scale: 0, opacity: 0.9 }, { scale: 1, opacity: 0, duration: 0.4, ease: 'power1.out' }, 1.1)
    .fromTo(ring, { scale: 0, opacity: 0.9 }, { scale: 1, opacity: 0, duration: 0.4, ease: 'power1.out' }, 2.2)
    .fromTo(labels, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, 2.6);

  // El spotlight DOM se mueve dentro del stage de forma sutil
  if (spot && stage) {
    tl.to(spot, { x: '-20%', y: '-10%', duration: 0.8 }, 0.3)
      .to(spot, { x: '30%', y: '20%', duration: 0.8 }, 1.2)
      .to(spot, { x: '-10%', y: '30%', duration: 0.7 }, 2.0);
  }
  return tl;
}

/* ═══════════════════════════════════════════════════════════
   RENDIMIENTO — number ticker + progress bars
   ═══════════════════════════════════════════════════════════ */
const COMPETENCIES = [
  { label: 'Pensamiento lógico', pct: 90 },
  { label: 'Lectura crítica', pct: 80 },
  { label: 'Inglés', pct: 70 },
  { label: 'Ciencias', pct: 88 },
];

function Trend() {
  return (
    <div className="pp-panel pp-panel-trend relative flex h-full w-full flex-col items-center justify-center gap-9">
      <div className="pp-dashboard">
        {/* Ticker central 0→94% */}
        <div className="pp-ticker">
          <span className="pp-ticker-value" data-ticker>0%</span>
          <span className="pp-ticker-label">progreso global</span>
        </div>

        {/* Barras de competencias */}
        <div className="pp-comp-grid">
          {COMPETENCIES.map((c) => (
            <div key={c.label} className="pp-comp">
              <div className="pp-comp-head">
                <span>{c.label}</span>
                <span className="pp-comp-val" data-compval data-to={c.pct}>0%</span>
              </div>
              <div className="pp-comp-track">
                <span className="pp-comp-fill" data-compfill style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {['Respuestas', 'Errores', 'Tiempo', 'Progreso'].map((l) => (
          <span key={l} className="pp-voice-label">{l}</span>
        ))}
      </div>
    </div>
  );
}

function trendTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const ticker = scope.querySelector('[data-ticker]');
  const fills = scope.querySelectorAll('[data-compfill]');
  const vals = scope.querySelectorAll('[data-compval]');
  const labels = scope.querySelectorAll('.pp-voice-label');
  if (!ticker) return tl;

  const tickObj = { v: 0 };
  tl.fromTo(tickObj, { v: 0 }, {
    v: 94, duration: 1.6, ease: 'power1.inOut',
    onUpdate() { ticker.textContent = `${Math.round(tickObj.v)}%`; },
  }, 0.2)
    .fromTo(fills, { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.7, stagger: 0.1, ease: 'power1.inOut' }, 0.5);

  // Cada barra anima su número propio (0→pct)
  vals.forEach((val, i) => {
    const target = Number((val as HTMLElement).dataset.to ?? 0);
    const obj = { v: 0 };
    tl.fromTo(obj, { v: 0 }, {
      v: target, duration: 0.7, ease: 'power1.inOut',
      onUpdate() { val.textContent = `${Math.round(obj.v)}%`; },
    }, 0.5 + i * 0.1);
  });

  tl.fromTo(labels, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, 1.3);
  return tl;
}