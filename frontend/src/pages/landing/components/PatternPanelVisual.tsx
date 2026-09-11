/**
 * PatternPanelVisual.tsx
 * ─────────────────────────────────────────────────────────────
 * Escenas CINEMATOGRÁFICAS por patrón neurodigital, basadas en
 * IMAGEN (public/Imagenes_Landing/) como escena principal + overlays
 * SVG tecnológicos minimalistas (scan lines, tracking points, onda,
 * keystrokes, cursor, gráfico de datos).
 *
 * Cada escena se controla con el scroll (scrub) mediante una timeline
 * GSAP que expone play(progress)/reset()/timeline(). La imagen hace
 * zoom/parallax lentos ("cámara"); los overlays entran en cadena.
 *
 * Técnicas:
 *   · GSAP + ScrollTrigger (scrub desde PatternHorizontalPinned)
 *   · SVG con strokeDasharray/strokeDashoffset para el "draw"
 *   · transform/opacity only (rendimiento ~60fps)
 *   · Sin librerías de pago, sin 3D, sin R3F
 *
 * prefers-reduced-motion → estado estático visible (sin scrub).
 * ─────────────────────────────────────────────────────────────
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import gsap from 'gsap';

export interface PatternPanelVisualHandle {
  play(progress: number): void;
  reset(): void;
  timeline(): gsap.core.Timeline | null;
}

interface Props {
  id: string;
  /** Ruta de la imagen de escena (relativa a BASE_URL) */
  image: string;
  /** Nombres de los labels a mostrar (overlays de datos) */
  labels: string[];
  style?: CSSProperties;
}

export default forwardRef<PatternPanelVisualHandle, Props>(
  function PatternPanelVisual({ id, image, labels, style }, ref) {
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

    const src = `${import.meta.env.BASE_URL}${image}`;

    return (
      <div ref={scopeRef} className="pp-visual pp-scene" style={style} aria-hidden="true">
        {/* Imagen de escena (protagonista) */}
        <div className="pp-scene-img-wrap">
          <img
            className="pp-scene-img"
            src={src}
            alt=""
            loading="lazy"
            draggable={false}
          />
          {/* Vignette/velo para legibilidad de overlay */}
          <span className="pp-scene-veil" />
        </div>

        {/* Overlays SVG específicos por patrón */}
        {renderOverlay(id)}

        {/* Labels de datos (aparecen en cadena) */}
        <div className="pp-scene-labels">
          {labels.map((l) => (
            <span key={l} className="pp-scene-label" data-scene-label>{l}</span>
          ))}
        </div>
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

/* ═══════════════════════════════════════════════════════════
   Overlays SVG por patrón
   ═══════════════════════════════════════════════════════════ */
function renderOverlay(id: string): ReactNode {
  switch (id) {
    case 'facial':      return <FacialOverlay />;
    case 'voz':         return <VoiceOverlay />;
    case 'teclado':     return <KeyboardOverlay />;
    case 'interaccion': return <InteractionOverlay />;
    case 'rendimiento': return <PerformanceOverlay />;
    default:            return null;
  }
}

/* ── FACIAL: scan line + tracking points + líneas ─────────── */
const FACE_PTS: { x: number; y: number }[] = [
  { x: 180, y: 180 }, { x: 300, y: 170 },   // cejas
  { x: 150, y: 250 }, { x: 330, y: 250 },   // ojos
  { x: 190, y: 320 }, { x: 290, y: 320 },   // pómulos
  { x: 240, y: 360 },                        // nariz
  { x: 200, y: 420 }, { x: 280, y: 420 },   // boca
  { x: 240, y: 470 },                        // mentón
];

function FacialOverlay() {
  return (
    <svg className="pp-overlay" viewBox="0 0 480 520" fill="none" preserveAspectRatio="xMidYMid slice">
      {/* Línea de escaneo horizontal */}
      <line className="pp-scan" x1="0" y1="260" x2="480" y2="260"
        stroke="rgba(96,165,250,0.85)" strokeWidth="1.5" />
      <line className="pp-scan" x1="0" y1="258" x2="480" y2="258"
        stroke="rgba(96,165,250,0.25)" strokeWidth="4" />
      {/* Conexiones sutiles entre puntos */}
      {FACE_PTS.slice(0, 9).map((p, i) => {
        const n = FACE_PTS[(i + 1) % 9];
        return (
          <line key={`c${i}`} className="pp-face-link" x1={p.x} y1={p.y} x2={n.x} y2={n.y}
            stroke="rgba(96,165,250,0.4)" strokeWidth="1" strokeDasharray="3 5" />
        );
      })}
      {/* Puntos de tracking */}
      {FACE_PTS.map((p, i) => (
        <g key={i}>
          <circle className="pp-face-ring" cx={p.x} cy={p.y} r="11" fill="none"
            stroke="rgba(96,165,250,0.45)" strokeWidth="1" />
          <circle className="pp-face-dot" cx={p.x} cy={p.y} r="4" fill="#3B82F6" />
        </g>
      ))}
    </svg>
  );
}

/* ── VOZ: waveform orgánica ──────────────────────────────── */
const WAVE_PTS = Array.from({ length: 40 }, (_, i) => {
  const t = i / 39;
  return {
    x: i * 12 + 6,
    // onda pseudo-orgánica (varias frecuencias)
    base: Math.sin(t * Math.PI * 3) * 0.5 + Math.sin(t * Math.PI * 7) * 0.25 + Math.sin(t * Math.PI * 13) * 0.15,
  };
});

function VoiceOverlay() {
  const mid = 200;
  return (
    <svg className="pp-overlay" viewBox="0 0 480 400" fill="none" preserveAspectRatio="xMidYMid meet">
      {/* Línea central */}
      <line x1="0" y1={mid} x2="480" y2={mid} stroke="rgba(96,165,250,0.2)" strokeWidth="1" />
      {WAVE_PTS.map((p, i) => {
        const amp = p.base * 120;
        const y1 = mid - amp;
        const y2 = mid + amp;
        return (
          <line key={i} className="pp-wave-line" data-wave
            x1={p.x} y1={y1} x2={p.x} y2={y2}
            stroke="url(#pp-wavegrad)" strokeWidth="2" strokeLinecap="round"
          />
        );
      })}
      <defs>
        <linearGradient id="pp-wavegrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60A5FA" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── TECLADO: overlays discretos sobre teclas ────────────── */
const KEYS: { x: number; y: number; w: number; h: number }[] = [
  { x: 40,  y: 130, w: 46, h: 46 },
  { x: 130, y: 130, w: 46, h: 46 },
  { x: 220, y: 130, w: 46, h: 46 },
  { x: 310, y: 130, w: 60, h: 46 },
  { x: 370, y: 130, w: 46, h: 46 },
  { x: 85,  y: 210, w: 46, h: 46 },
  { x: 175, y: 210, w: 46, h: 46 },
  { x: 265, y: 210, w: 46, h: 46 },
  { x: 355, y: 210, w: 46, h: 46 },
  { x: 130, y: 290, w: 80, h: 46 },
  { x: 260, y: 290, w: 46, h: 46 },
];

function KeyboardOverlay() {
  return (
    <svg className="pp-overlay" viewBox="0 0 480 400" fill="none" preserveAspectRatio="xMidYMid meet">
      {KEYS.map((k, i) => (
        <rect key={i} className="pp-key-hl" data-key
          x={k.x} y={k.y} width={k.w} height={k.h} rx="8"
          fill="rgba(59,130,246,0.12)" stroke="rgba(96,165,250,0.7)" strokeWidth="1.4"
        />
      ))}
      {/* Trailer de "pulsación" bajo algunas teclas */}
      {KEYS.slice(0, 6).map((k, i) => (
        <circle key={`p${i}`} className="pp-key-pulse" data-keypulse
          cx={k.x + k.w / 2} cy={k.y + k.h / 2} r="6"
          fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/* ── INTERACCIÓN: cursor + clics + conexiones ────────────── */
function InteractionOverlay() {
  return (
    <div className="pp-inter-action">
      {/* Conexiones sutiles entre nodos de UI (viewBox landscape 480×320) */}
      <svg className="pp-overlay" viewBox="0 0 480 320" fill="none" preserveAspectRatio="xMidYMid meet">
        <path className="pp-conn" d="M80 88 L210 128 L320 72 L400 144 L360 240 L180 208 L80 88"
          stroke="rgba(59,130,246,0.5)" strokeWidth="1.2" fill="none"
          strokeDasharray="4 6" />
        {[[80, 88], [210, 128], [320, 72], [400, 144], [360, 240], [180, 208]].map(([x, y], i) => (
          <circle key={i} className="pp-conn-node" data-node cx={x} cy={y} r="5" fill="#3B82F6" />
        ))}
      </svg>
      {/* Cursor SVG/HTML que recorre la escena */}
      <div className="pp-live-cursor" data-cursor>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 3l15 9-7 1.5L9.5 18 5 3z" fill="#3B82F6" stroke="#fff" strokeWidth="1.3" />
        </svg>
        <span className="pp-live-click" data-click />
      </div>
    </div>
  );
}

/* ── RENDIMIENTO: gráfico SVG + datos ────────────────────── */
const LINE_PTS = '20,160 90,140 160,150 230,110 300,120 340,60 380,80 440,40';
const AREA_PTS = `20,160 ${LINE_PTS} 440,200 20,200`;

function PerformanceOverlay() {
  return (
    <div className="pp-perf">
      {/* Gráfico de línea (se dibuja con dashoffset) */}
      <svg className="pp-overlay" viewBox="0 0 480 220" fill="none" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pp-areagrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(96,165,250,0.35)" />
            <stop offset="1" stopColor="rgba(96,165,250,0)" />
          </linearGradient>
        </defs>
        <polygon className="pp-chart-area" points={AREA_PTS} fill="url(#pp-areagrad)" />
        <polyline className="pp-chart-line" data-chart points={LINE_PTS}
          fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {LINE_PTS.split(' ').map((pt, i) => {
          const [x, y] = pt.split(',').map(Number);
          return <circle key={i} className="pp-chart-dot" data-chartdot cx={x} cy={y} r="4" fill="#3B82F6" />;
        })}
      </svg>
      {/* Números de datos */}
      <div className="pp-perf-stats">
        <div className="pp-perf-stat" data-stat>
          <span className="pp-perf-val" data-count data-to="92">0%</span>
          <span className="pp-perf-key">respuestas</span>
        </div>
        <div className="pp-perf-stat" data-stat>
          <span className="pp-perf-val" data-count data-to="8">0%</span>
          <span className="pp-perf-key">errores</span>
        </div>
        <div className="pp-perf-stat" data-stat>
          <span className="pp-perf-val" data-count data-to="24">0m</span>
          <span className="pp-perf-key">tiempo</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Builders de timeline (scrub ligado al progress de la sección)
   ═══════════════════════════════════════════════════════════ */
function buildTimeline(id: string, scope: HTMLDivElement): gsap.core.Timeline | null {
  switch (id) {
    case 'facial':      return facialTL(scope);
    case 'voz':         return voiceTL(scope);
    case 'teclado':     return keyboardTL(scope);
    case 'interaccion': return interactionTL(scope);
    case 'rendimiento': return performanceTL(scope);
    default:            return null;
  }
}

/** Helper: anima los labels en cadena al final de cada escena. */
function labelsIn(tl: gsap.core.Timeline, scope: HTMLDivElement, at: number) {
  const labels = scope.querySelectorAll('[data-scene-label]');
  tl.fromTo(labels, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, at);
}

function facialTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const img = scope.querySelector('.pp-scene-img');
  const scan = scope.querySelector('.pp-scan');
  const dots = scope.querySelectorAll('.pp-face-dot');
  const rings = scope.querySelectorAll('.pp-face-ring');
  const links = scope.querySelectorAll('.pp-face-link');
  if (!img) return tl;

  // Cámara: zoom progresivo suave + leve pane
  tl.fromTo(img, { scale: 1.06, xPercent: 2 }, { scale: 1.18, xPercent: 0, duration: 1, ease: 'none' }, 0)
    // Scan line entra de arriba y barre
    .fromTo(scan, { y: -160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power1.inOut' }, 0.15)
    .to(scan, { y: 160, duration: 0.7, ease: 'power1.inOut' }, 0.7)
    // Líneas de conexión se dibujan
    .fromTo(links, { strokeDashoffset: 60, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power1.inOut' }, 0.3)
    // Puntos de tracking se activan en cadena
    .fromTo(dots, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, stagger: 0.05, ease: 'back.out(2.4)' }, 0.4)
    .fromTo(rings, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out' }, 0.45);

  labelsIn(tl, scope, 0.75);
  return tl;
}

function voiceTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const img = scope.querySelector('.pp-scene-img');
  const waves = scope.querySelectorAll('[data-wave]');
  if (!img) return tl;

  if (waves.length) {
    // Cada barra de onda dibuja su longitud desde el centro
    gsap.set(waves, { scaleY: 0.05, transformOrigin: 'center center' });
  }
  tl.fromTo(img, { scale: 1.05, xPercent: -2 }, { scale: 1.16, xPercent: 2, duration: 1, ease: 'none' }, 0)
    // La onda crece orgánicamente
    .fromTo(waves, { scaleY: 0.05, opacity: 0.4 }, { scaleY: 1, opacity: 1, duration: 0.6, stagger: 0.018, ease: 'power1.out' }, 0.15)
    // Deformación lenta tipo "voz viva"
    .to(waves, { scaleY: 1.25, duration: 0.5, stagger: 0.03, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.55);

  labelsIn(tl, scope, 0.75);
  return tl;
}

function keyboardTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const img = scope.querySelector('.pp-scene-img');
  const keys = scope.querySelectorAll('[data-key]');
  const pulses = scope.querySelectorAll('[data-keypulse]');
  if (!img) return tl;

  tl.fromTo(img, { scale: 1.08, yPercent: 2 }, { scale: 1.2, yPercent: -2, duration: 1, ease: 'none' }, 0)
    // Overlays de teclas aparecen en cadena
    .fromTo(keys, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.35, stagger: 0.06, ease: 'back.out(1.6)' }, 0.15)
    // Pulses de pulsación
    .fromTo(pulses, { scale: 0, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.5, stagger: 0.2, repeat: 1, ease: 'power1.out' }, 0.5);

  labelsIn(tl, scope, 0.75);
  return tl;
}

function interactionTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, paused: true });
  const img = scope.querySelector('.pp-scene-img');
  const cursor = scope.querySelector('[data-cursor]');
  const click = scope.querySelector('[data-click]');
  const conns = scope.querySelector('.pp-conn');
  const nodes = scope.querySelectorAll('[data-node]');
  if (!img || !cursor) return tl;

  if (conns) {
    const len = (conns as SVGPathElement).getTotalLength?.() || 900;
    gsap.set(conns, { strokeDasharray: len, strokeDashoffset: len });
  }

  tl.fromTo(img, { scale: 1.04 }, { scale: 1.15, duration: 1, ease: 'none' }, 0)
    // Cursor entra
    .fromTo(cursor, { opacity: 0, x: -40, y: 20 }, { opacity: 1, x: 0, y: 0, duration: 0.4, ease: 'power2.out' }, 0.1)
    // Recorrido del cursor (cámara guiada)
    .to(cursor, { x: 120, y: -30, duration: 0.5, ease: 'power1.inOut' }, 0.35)
    .fromTo(click, { scale: 0, opacity: 0.9 }, { scale: 1.4, opacity: 0, duration: 0.35, ease: 'power1.out' }, 0.85)
    .to(cursor, { x: -80, y: 50, duration: 0.5, ease: 'power1.inOut' }, 0.9)
    .fromTo(click, { scale: 0, opacity: 0.9 }, { scale: 1.4, opacity: 0, duration: 0.35, ease: 'power1.out' }, 1.4)
    .to(cursor, { x: 40, y: -10, duration: 0.4, ease: 'power1.inOut' }, 1.5)
    // Conexiones se dibujan
    .fromTo(conns, { strokeDashoffset: (conns as SVGPathElement).getTotalLength?.() || 900 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.inOut' }, 0.4)
    .fromTo(nodes, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, stagger: 0.08, ease: 'back.out(2)' }, 0.6);

  labelsIn(tl, scope, 0.8);
  return tl;
}

function performanceTL(scope: HTMLDivElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, paused: true });
  const img = scope.querySelector('.pp-scene-img');
  const line = scope.querySelector('[data-chart]');
  const area = scope.querySelector('.pp-chart-area');
  const dots = scope.querySelectorAll('[data-chartdot]');
  const stats = scope.querySelectorAll('[data-stat]');
  const counts = scope.querySelectorAll('[data-count]');
  if (!img || !line) return tl;

  const lineEl = line as SVGPathElement | SVGPolylineElement;
  const len = (lineEl.getTotalLength?.() as number) || 500;
  gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });

  tl.fromTo(img, { scale: 1.06, opacity: 0.95 }, { scale: 1.14, opacity: 1, duration: 1, ease: 'none' }, 0)
    // Gráfico se dibuja
    .fromTo(line, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, 0.15)
    .fromTo(area, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.35)
    .fromTo(dots, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, stagger: 0.06, ease: 'back.out(2)' }, 0.4)
    // Stats aparecen
    .fromTo(stats, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.1, ease: 'power2.out' }, 0.6);

  // Número ticker por stat (0 → dato)
  counts.forEach((c, i) => {
    const target = Number((c as HTMLElement).dataset.to ?? 0);
    const unit = (c as HTMLElement).textContent?.match(/[a-z%]+/i)?.[0] ?? '%';
    const obj = { v: 0 };
    tl.fromTo(obj, { v: 0 }, {
      v: target, duration: 0.6, ease: 'power1.inOut',
      onUpdate() { c.textContent = `${Math.round(obj.v)}${unit}`; },
    }, 0.6 + i * 0.1);
  });

  labelsIn(tl, scope, 0.85);
  return tl;
}