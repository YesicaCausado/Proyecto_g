/**
 * PatternVisual.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: un pequeño gráfico ANIMADO por patrón,
 * temático y atractivo, controlado con GSAP (el "cerebro" de la
 * landing) en vez de keyframes CSS hechos a mano:
 *
 *   · voz          → ondas de sonido (barras que laten en escalera)
 *   · facial       → parpadeo de dos ojos
 *   · teclado      → escritura en vivo (caret + teclas que se presionan)
 *   · interaccion  → red de nodos (pulsos a lo largo de lazos)
 *   · rendimiento  → barras ascendentes + punto en movimiento
 *
 * Cada componente monta un `gsap.context` con scope propio y se
 * limpia al desmontar (ctx.revert()). Bajo prefers-reduced-motion no
 * se inicia la animación: los elementos quedan en estado estático
 * visible. El color se inyecta desde el acento de la paleta.
 * ─────────────────────────────────────────────────────────────
 */
import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import gsap from 'gsap';

export interface PatternVisualProps {
  id:     string;
  accent: string;
}

function prefersReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Monta un gsap.context acotado al scope; limpia con ctx.revert(). */
type AnimFn = (scope: HTMLDivElement) => void;
function usePatternAnim(anim: AnimFn) {
  const scopeRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const ctx = gsap.context(() => anim(scope), scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return scopeRef;
}

const BOX: CSSProperties = {
  width: 72,
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function PatternVisual({ id, accent }: PatternVisualProps) {
  switch (id) {
    case 'voz':         return <Voice accent={accent} />;
    case 'facial':      return <Facial accent={accent} />;
    case 'teclado':     return <Typing accent={accent} />;
    case 'interaccion': return <Network accent={accent} />;
    case 'rendimiento': return <Trend accent={accent} />;
    default:            return <div data-pattern-visual style={BOX} aria-hidden="true" />;
  }
}

/* ── Voz: ondas de sonido ─────────────────────────────────── */
function Voice({ accent }: { accent: string }) {
  const ref = usePatternAnim((_scope) => {
    if (prefersReduced()) return;
    gsap.fromTo('.v-bar',
      { scaleY: 0.18, transformOrigin: 'center bottom' },
      { scaleY: 1, duration: 1.25, ease: 'sine.inOut', stagger: 0.13, repeat: -1, yoyo: true },
    );
  });
  const heights = [0.7, 0.5, 1, 0.62, 0.88, 0.55, 0.78];
  return (
    <div data-pattern-visual style={BOX} aria-hidden="true">
      <div ref={ref} className="flex items-end gap-[3px]" style={{ height: 46 }}>
        {heights.map((h, i) => (
          <span
            key={i}
            className="v-bar"
            style={{
              width: 4,
              height: `${Math.round(h * 100)}%`,
              borderRadius: 99,
              background: accent,
              opacity: 0.92,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Facial: parpadeo de dos ojos ─────────────────────────── */
function Facial({ accent }: { accent: string }) {
  const ref = usePatternAnim((_scope) => {
    if (prefersReduced()) return;
    gsap.set('.v-eye', { transformOrigin: 'center center', scaleY: 1 });
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.4 });
    tl.to('.v-eye', { scaleY: 0.12, duration: 0.12, ease: 'power2.in', stagger: { each: 0.1 } })
      .to('.v-eye', { scaleY: 1, duration: 0.35, ease: 'power2.out', stagger: { each: 0.1 } });
  });
  return (
    <div data-pattern-visual style={{ ...BOX, gap: 10, flexDirection: 'column' }} aria-hidden="true">
      <div ref={ref} className="flex items-center gap-2">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="v-eye"
            style={{
              position: 'relative',
              width: 22,
              height: 14,
              borderRadius: 9999,
              border: `2px solid ${accent}`,
            }}
          >
            <span style={{ position: 'absolute', inset: 0, margin: 'auto', width: 6, height: 6, borderRadius: '50%', background: accent }} />
          </span>
        ))}
      </div>
      <span style={{ width: 22, height: 2, borderRadius: 2, background: accent, opacity: 0.75, transform: 'translateX(-4px)' }} />
    </div>
  );
}

/* ── Teclado: escritura en vivo (caret + teclas) ──────────── */
function Typing({ accent }: { accent: string }) {
  const ref = usePatternAnim((_scope) => {
    if (prefersReduced()) return;
    gsap.to('.v-caret', { opacity: 0, duration: 0.5, ease: 'none', repeat: -1, yoyo: true });
    gsap.fromTo('.v-key',
      { y: 0 },
      { y: 3.5, duration: 0.1, ease: 'power2.in', stagger: 0.2, repeat: -1, repeatDelay: 0.5, yoyo: true },
    );
  });
  return (
    <div data-pattern-visual style={{ ...BOX, gap: 10, flexDirection: 'column', alignItems: 'center' }} aria-hidden="true">
      <div ref={ref} className="flex items-center gap-2" style={{ height: 18 }}>
        <span className="v-caret" style={{ width: 2, height: 18, background: accent }} />
        <span style={{ width: 34, height: 2, borderRadius: 2, background: 'rgba(238,242,241,0.30)' }} />
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="v-key"
            style={{ width: 16, height: 16, borderRadius: 4, background: `${accent}2e` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Interacción: red de nodos con pulsos ─────────────────── */
function Network({ accent }: { accent: string }) {
  const ref = usePatternAnim((_scope) => {
    if (prefersReduced()) return;
    gsap.fromTo('.v-net-dot',
      { scale: 1, opacity: 0.85 },
      { scale: 1.5, opacity: 0.5, duration: 1.15, ease: 'sine.inOut', stagger: 0.3, repeat: -1, yoyo: true },
    );
    gsap.fromTo('.v-net-center',
      { scale: 1 },
      { scale: 1.4, duration: 1.4, ease: 'sine.inOut', repeat: -1, yoyo: true },
    );
  });
  const arms = [0, 90, 180, 270];
  return (
    <div data-pattern-visual style={{ ...BOX, width: 68 }} aria-hidden="true">
      <div ref={ref} className="relative" style={{ width: 54, height: 54 }}>
        {arms.map((deg) => (
          <span
            key={deg}
            className="v-net-arm"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 22,
              height: 2,
              background: accent,
              transform: `rotate(${deg}deg)`,
              transformOrigin: 'left center',
            }}
          >
            <span
              className="v-net-dot"
              style={{ position: 'absolute', top: '50%', right: -4, width: 7, height: 7, borderRadius: '50%', background: accent, transform: 'translateY(-50%)', transformOrigin: 'center center' }}
            />
          </span>
        ))}
        <span className="v-net-center" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 10, height: 10, borderRadius: '50%', background: accent, transformOrigin: 'center center' }} />
      </div>
    </div>
  );
}

/* ── Rendimiento: barras ascendentes + punto ──────────────── */
function Trend({ accent }: { accent: string }) {
  const ref = usePatternAnim((scope) => {
    if (prefersReduced()) return;
    const bars = scope.querySelectorAll('.v-chart-bar');
    gsap.fromTo(bars,
      { scaleY: 0.5, transformOrigin: 'center bottom' },
      { scaleY: 1, duration: 1.2, ease: 'power1.inOut', stagger: 0.18, repeat: -1, yoyo: true },
    );
    gsap.to('.v-chart-dot', { y: -3, duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true });
  });
  return (
    <div data-pattern-visual style={{ ...BOX, alignItems: 'flex-end', gap: 8 }} aria-hidden="true">
      <div ref={ref} className="relative flex items-end gap-2" style={{ height: 46, width: 56 }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="v-chart-bar" style={{ width: 9, height: 46, borderRadius: 3, background: accent }} />
        ))}
        <span className="v-chart-dot" style={{ position: 'absolute', top: 0, right: -3, width: 9, height: 9, borderRadius: '50%', background: accent }} />
      </div>
    </div>
  );
}