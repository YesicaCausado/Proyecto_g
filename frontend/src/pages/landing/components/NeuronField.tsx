/**
 * NeuronField.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: campo de nodos/partículas sutiles que
 * rodean a Neurón en el Hero, dispuestos como una constelación
 * minimalista de instrumentación neurodigital.
 *
 * Diseño (monocromo, sin coste por frame):
 *   · 100% DOM + CSS + una capa SVG estática para las conexiones.
 *   · Posiciones DETERMINISTAS (semilla PRNG) generadas UNA vez
 *     con useMemo — no hay loops en el closure del frame.
 *   · Dos familias de nodos: puntos rellenos y anillos de contorno.
 *   · Conexiones: segmentos SVG muy tenues entre nodos cercanos,
 *     calculados una sola vez (k-vecinos por distancia, con límite
 *     de enlaces). Cero coste de GPU extra (un solo trazo plano).
 *   · El fade-in lo controla GSAP desde Hero.tsx mediante la clase
 *     `.hero-node` (dots + links comparten la misma clase para que
 *     todo el campo aparezca con el mismo stagger).
 *
 * Con prefers-reduced-motion el campo sigue visible pero sin
 * animación CSS infinita (clases gestionadas en index.css).
 * ─────────────────────────────────────────────────────────────
 */
import { useMemo } from 'react';

const BASE_NODE_COUNT     = 26;
const MAX_LINKS_PER_NODE  = 3;   // evita un grafo denso / ruidoso
const LINK_LIMIT          = 120; // tope absoluto de segmentos SVG
const LINK_MAX_DIST       = 14;  // % del viewport: umbral de "cercanía"

type NodeKind = 'dot' | 'ring' | 'square';

interface PNode {
  id:    number;
  x:     number;   // % horizontal
  y:     number;   // % vertical
  size:  number;   // px
  kind:  NodeKind;
  delay: number;   // s — fase de aparición
  dur:   number;   // s — duración del idling
}

interface PLink {
  key:  string;
  x1:   number;   // %
  y1:   number;
  x2:   number;
  y2:   number;
  /** Opacidad relativa (más corta la conexión → algo más visible) */
  o:    number;
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
  const kinds: NodeKind[] = ['dot', 'dot', 'dot', 'ring', 'square', 'dot'];
  const nodes: PNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id:    i,
      x:     4 + rnd() * 92,                                 // 4–96%
      y:     8 + rnd() * 84,                                 // 8–92%
      size:  2 + rnd() * 3.5,                                // 2–5.5px
      kind:  kinds[Math.floor(rnd() * kinds.length)],
      delay: +(rnd() * 1.6).toFixed(2),
      dur:   +(3 + rnd() * 3).toFixed(2),
    });
  }
  return nodes;
}

/** Constelación: enlaza nodos cercanos (distancia euclídea).
 *  Determinista y estático; se genera una sola vez. */
function makeLinks(nodes: PNode[]): PLink[] {
  const pairs: Array<[number, number, number]> = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d > LINK_MAX_DIST) continue;
      pairs.push([i, j, d]);
    }
  }
  // Enlaza primero los pares más próximos (orden estable).
  pairs.sort((a, b) => a[2] - b[2]);

  const links: PLink[] = [];
  const perNode = new Map<number, number>();
  for (const [i, j, dist] of pairs) {
    if (links.length >= LINK_LIMIT) break;
    const c1 = perNode.get(i) ?? 0;
    const c2 = perNode.get(j) ?? 0;
    if (c1 >= MAX_LINKS_PER_NODE || c2 >= MAX_LINKS_PER_NODE) continue;
    perNode.set(i, c1 + 1);
    perNode.set(j, c2 + 1);
    links.push({
      key: `${i}-${j}`,
      x1:  nodes[i].x,
      y1:  nodes[i].y,
      x2:  nodes[j].x,
      y2:  nodes[j].y,
      o:   Math.max(0.16, 0.5 - dist * 0.02),
    });
  }
  return links;
}

export default function NeuronField() {
  const { nodes, links } = useMemo(() => {
    const q = typeof window !== 'undefined' && window.innerWidth < 768
      ? Math.round(BASE_NODE_COUNT * 0.45)
      : BASE_NODE_COUNT;
    const ns = makeNodes(q);
    return { nodes: ns, links: makeLinks(ns) };
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
      {/* Conexiones de la constelación — SVG estático en gris tenue.
          Comparte la clase .hero-node para aparecer con el stagger de GSAP. */}
      {links.map((l) => (
        <svg
          key={l.key}
          className="hero-node hero-link"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0 }}
          aria-hidden="true"
        >
          <line
            x1={`${l.x1}%`}
            y1={`${l.y1}%`}
            x2={`${l.x2}%`}
            y2={`${l.y2}%`}
            stroke="currentColor"
            strokeOpacity={l.o}
            strokeWidth="0.5"
          />
        </svg>
      ))}

      {/* Nodos — puntos rellenos, anillos y gotas cuadradas */}
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
            borderRadius: n.kind === 'square' ? '1px' : '50%',
            background: n.kind === 'ring' ? 'transparent' : 'currentColor',
            boxShadow: n.kind === 'ring' ? 'inset 0 0 0 1px currentColor' : 'none',
            opacity: 0,
            animation: `nodeFloat ${n.dur}s ease-in-out ${n.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}