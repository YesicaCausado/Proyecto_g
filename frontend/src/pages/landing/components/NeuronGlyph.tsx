/**
 * NeuronGlyph.tsx
 * ─────────────────────────────────────────────────────────────
 * Representación 2D ligera y monocroma de Neuron (robot).
 * Se usa en secciones donde el GLB 3D completo sería caro.
 * Timeless, geométrica, futurista: rostro/ojos + detalles
 * técnicos azules. Paleta estrictamente negro/gris/azul.
 * ─────────────────────────────────────────────────────────────
 */
import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  active?: boolean;            // ojos azules "encendidos"
  className?: string;
  style?: CSSProperties;
}

export default function NeuronGlyph({ size = 200, active = true, className = '', style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label="Neuron, robot inteligente de NeuroLearn"
    >
      <defs>
        <linearGradient id="ng-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#111" />
        </linearGradient>
        <linearGradient id="ng-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60A5FA" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ng-eye" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#93C5FD" />
          <stop offset="0.55" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </radialGradient>
      </defs>

      {/* Halo / bloom */}
      <circle cx="100" cy="100" r={active ? 92 : 96} fill="url(#ng-glow)" />

      {/* Torso */}
      <rect x="78" y="128" width="44" height="40" rx="11" fill="url(#ng-body)" stroke="rgba(255,255,255,0.14)" strokeWidth="1.4" />
      <rect x="84" y="136" width="6" height="10" rx="3" fill={active ? '#3B82F6' : '#333'} />
      <rect x="92" y="146" width="16" height="3" rx="1.5" fill={active ? '#2563EB' : '#252525'} />
      <rect x="92" y="152" width="10" height="3" rx="1.5" fill="#262626" />

      {/* Cabeza */}
      <rect x="56" y="38" width="88" height="92" rx="24" fill="url(#ng-body)" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
      {/* Laudos / placa superior */}
      <path d="M76 38 L100 24 L124 38" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Frente con visor */}
      <rect x="70" y="50" width="60" height="34" rx="10" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />

      {/* Ojos */}
      {active ? (
        <>
          <ellipse cx="82" cy="67" rx="7" ry="8.5" fill="url(#ng-eye)" />
          <ellipse cx="118" cy="67" rx="7" ry="8.5" fill="url(#ng-eye)" />
          <circle cx="84" cy="65" r="1.6" fill="#fff" />
          <circle cx="120" cy="65" r="1.6" fill="#fff" />
        </>
      ) : (
        <>
          <rect x="74" y="58" width="16" height="18" rx="6" fill="#2a2a2a" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
          <rect x="110" y="58" width="16" height="18" rx="6" fill="#2a2a2a" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
        </>
      )}

      {/* Boca / rejilla */}
      <rect x="88" y="98" width="24" height="3" rx="1.5" fill={active ? '#3B82F6' : '#303030'} />
      <path d="M76 110 L124 110" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* Liners/laterales — antenas y oídos */}
      <circle cx="50" cy="96" r="3" fill={active ? '#60A5FA' : '#2a2a2a'} stroke="rgba(255,255,255,0.2)" strokeWidth="1" style={{ filter: active ? 'drop-shadow(0 0 4px #60A5FA)' : undefined }} />
      <circle cx="150" cy="96" r="3" fill={active ? '#60A5FA' : '#2a2a2a'} stroke="rgba(255,255,255,0.2)" strokeWidth="1" style={{ filter: active ? 'drop-shadow(0 0 4px #60A5FA)' : undefined }} />
      {/* Antena superior */}
      <path d="M100 24 L100 14" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="100" cy="11" r="3.5" fill={active ? '#3B82F6' : '#2a2a2a'} style={{ filter: active ? 'drop-shadow(0 0 5px #3B82F6)' : undefined }} />
    </svg>
  );
}