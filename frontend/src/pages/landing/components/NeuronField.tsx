/**
 * NeuronField.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: campo de nodos/partículas sutiles que
 * rodean a Neurón en el Hero.
 *
 * Diseño:
 *   · 100% DOM + CSS — sin Three.js extra, casi cero costo de GPU.
 *   · Nodes fijos (count pequeño, adaptado por viewport).
 *   · Se genera UNA vez (useMemo) — sin loops por frame.
 *   · El fade-in lo controla GSAP desde Hero.tsx (data-hero="nodes").
 *   · El container es transparente — se ve sobre white y dark.
 *
 * Con reduces-motion la clase se añade igual pero sin animación
 * extra (el container solo tiene un leve parallax CSS, se desactiva).
 * ─────────────────────────────────────────────────────────────
 */
import { useMemo } from 'react';

const BASE_NODE_COUNT = 26;

interface PNode {
  id:    number;
  x:     number;   // % horizontal
  y:     number;   // % vertical
  size:  number;   // px
  delay: number;   // s — fase de aparición
  dur:   number;   // s — duración del idling
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNodes(count: number): PNode[] {
  const rnd = mulberry(0x4E555230); // seed 'NEUR0'
  const nodes: PNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id:    i,
      x:     4 + rnd() * 92,                       // 4–96%
      y:     8 + rnd() * 84,                       // 8–92%
      size:  2 + rnd() * 4,                        // 2–6px
      delay: (rnd() * 1.6).toFixed(2) as unknown as number,
      dur:   (3 + rnd() * 3).toFixed(2) as unknown as number,
    });
  }
  return nodes;
}

export default function NeuronField() {
  const nodes = useMemo<PNode[]>(() => {
    const q = typeof window !== 'undefined' && window.innerWidth < 768
      ? Math.round(BASE_NODE_COUNT * 0.45)
      : BASE_NODE_COUNT;
    return makeNodes(q);
  }, []);

  return (
    <div
      className="hero-node-field"
      data-hero="nodes"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        transform: 'translateZ(0)',
        willChange: 'opacity, transform',
      }}
    >
      {nodes.map((n) => (
        <span
          key={n.id}
          className="hero-node"
          data-anim="field-idle"
          style={{
            position: 'absolute',
            left: `${n.x}%`,
            top: `${n.y}%`,
            width: n.size,
            height: n.size,
            borderRadius: '50%',
            background: 'currentColor',
            opacity: 0,
            // El nodo "respira" con una pequeña animación CSS infinita
            animation: `nodeFloat ${n.dur}s ease-in-out ${n.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}