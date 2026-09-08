/**
 * TravellingNeuron.tsx
 * ─────────────────────────────────────────────────────────────
 * Neuron se "transporta" por la página siguiendo la sección
 * activa: mientras el usuario baja o sube, Neuron se desplaza
 * suavemente (lerp) para posicionarse junto a la sección que
 * ocupa en cada momento.
 *
 * · Avión fijo a la derecha en escritorio.
 * · Al activarse cada sección, un pequeño Neuron + la fase
 *   narrativa viajan hasta el centro vertical de esa sección.
 * · Se desactiva en móvil (<768) y con prefers-reduced-motion.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from 'react';
import NeuronGlyph from './NeuronGlyph';
import { NL } from '../config/landing.config';

export interface NeuronStop {
  id:      string;
  label:   string;   // fase narrativa que se muestra junto a Neuron
}

interface Props {
  stops: NeuronStop[];
}

export default function TravellingNeuron({ stops }: Props) {
  const glyphRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  // Habilitar solo en desktop + sin reduced-motion.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const check = () => setEnabled(media.matches && !reduce.matches);
    check();
    media.addEventListener('change', check);
    reduce.addEventListener('change', check);
    return () => {
      media.removeEventListener('change', check);
      reduce.removeEventListener('change', check);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const glyph = glyphRef.current;
    const label = labelRef.current;
    if (!glyph) return;

    let raf = 0;
    let currentY = window.innerHeight / 2;   // posición actual
    let targetY = currentY;

    const update = () => {
      // Sección activa = la que tiene su centro más cercano al centro del viewport.
      let best = stops[0] ?? null;
      let bestDist = Infinity;
      const vcenter = window.innerHeight / 2;
      for (const s of stops) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const dist = Math.abs(center - vcenter);
        if (dist < bestDist) { bestDist = dist; best = s; }
      }

      // Target: centro de la sección activa, acotado para no salirse de pantalla.
      const el = best ? document.getElementById(best.id) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        targetY = Math.max(120, Math.min(window.innerHeight - 220, center));
      }
      if (label && best) label.textContent = best.label;
    };

    const loop = () => {
      currentY += (targetY - currentY) * 0.12;
      glyph.style.transform = `translate3d(0, ${currentY - glyph.offsetHeight / 2}px, 0)`;
      raf = requestAnimationFrame(loop);
    };

    update();
    raf = requestAnimationFrame(loop);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => { update(); });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update);
    };
  }, [enabled, stops]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={{
        position: 'fixed',
        right: 26,
        top: 0,
        height: '100vh',
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div ref={glyphRef} className="relative flex flex-col items-center" style={{ willChange: 'transform' }}>
        {/* Neuron pequeño que viaja */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            transform: 'translateX(-50%)',
            padding: 4,
            borderRadius: 999,
            background: 'rgba(5,5,5,0.6)',
            border: `1px solid rgba(96,165,250,0.25)`,
            boxShadow: `0 0 24px rgba(37,99,235,0.35)`,
            backdropFilter: 'blur(4px)',
          }}
        >
          <NeuronGlyph size={44} active />
        </div>
        {/* Fase narrativa */}
        <span
          ref={labelRef}
          className="nl-mono"
          style={{
            position: 'absolute',
            left: -12,
            top: 6,
            transform: 'translateX(-100%)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: NL.blueSoft,
            whiteSpace: 'nowrap',
            background: 'rgba(5,5,5,0.55)',
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid rgba(96,165,250,0.2)',
            boxShadow: '0 0 18px rgba(0,0,0,0.4)',
            opacity: 0.95,
          }}
        />
        {/* Línea guía vertical */}
        <div style={{ position: 'absolute', right: 22, top: -40, height: '100vh', width: 1, background: 'linear-gradient(180deg, transparent, rgba(96,165,250,0.25) 20%, rgba(96,165,250,0.08) 80%, transparent)' }} />
      </div>
    </div>
  );
}