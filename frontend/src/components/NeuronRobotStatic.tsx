/**
 * NeuronRobotStatic.tsx
 * ─────────────────────────────────────────────────────────────
 * Ilustración SVG de Neuron — sin WebGL, siempre visible.
 * Ideal para tarjetas secundarias donde ya hay un RobotCanvas.
 * Incluye animación CSS de levitación y parpadeo de ojos.
 * ─────────────────────────────────────────────────────────────
 */

interface NeuronRobotStaticProps {
  /** Altura total del SVG en px (default 120) */
  size?: number;
  className?: string;
}

export default function NeuronRobotStatic({ size = 120, className = '' }: NeuronRobotStaticProps) {
  const id = 'nrs';

  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 100 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible', animation: 'neuronFloat 3s ease-in-out infinite' }}
    >
      <style>{`
        @keyframes neuronFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-7px); }
        }
        @keyframes neuronBlink {
          0%,90%,100% { transform: scaleY(1); }
          95%          { transform: scaleY(0.08); }
        }
        .nrs-eye { animation: neuronBlink 4s ease-in-out infinite; transform-origin: center; }
        .nrs-eye-r { animation: neuronBlink 4s ease-in-out 0.3s infinite; transform-origin: center; }
        @keyframes neuronGlow {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        .nrs-antenna-dot { animation: neuronGlow 1.8s ease-in-out infinite; }
        @keyframes neuronScan {
          0%,100% { opacity: 0.3; }
          50%      { opacity: 0.9; }
        }
        .nrs-mouth { animation: neuronScan 2.2s ease-in-out infinite; }
      `}</style>

      <defs>
        <linearGradient id={`${id}-body`} x1="20" y1="30" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id={`${id}-head`} x1="25" y1="18" x2="75" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={`${id}-eye-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="100%" stopColor="#06b6d4" />
        </radialGradient>
      </defs>

      {/* ── Sombra suelo ─────────────────────────── */}
      <ellipse cx="50" cy="113" rx="22" ry="4" fill="#7c3aed" opacity="0.15" />

      {/* ── Piernas ──────────────────────────────── */}
      <rect x="34" y="86" width="10" height="18" rx="5" fill={`url(#${id}-body)`} opacity="0.9" />
      <rect x="56" y="86" width="10" height="18" rx="5" fill={`url(#${id}-body)`} opacity="0.9" />
      {/* Pies */}
      <rect x="30" y="100" width="16" height="7" rx="4" fill="#4f46e5" />
      <rect x="54" y="100" width="16" height="7" rx="4" fill="#4f46e5" />

      {/* ── Cuerpo ───────────────────────────────── */}
      <rect x="28" y="56" width="44" height="34" rx="10" fill={`url(#${id}-body)`} />
      {/* Panel del pecho */}
      <rect x="35" y="63" width="30" height="18" rx="6" fill="rgba(255,255,255,0.12)" />
      {/* Luces pecho */}
      <circle cx="42" cy="72" r="3.5" fill="#a5f3fc" opacity="0.9" filter={`url(#${id}-glow)`} />
      <circle cx="50" cy="72" r="3.5" fill="#818cf8" opacity="0.9" />
      <circle cx="58" cy="72" r="3.5" fill="#f0abfc" opacity="0.9" />

      {/* ── Brazos ───────────────────────────────── */}
      {/* Izquierdo */}
      <rect x="12" y="58" width="14" height="9" rx="4.5" fill={`url(#${id}-body)`} />
      <circle cx="12" cy="62.5" r="5.5" fill="#6d28d9" />
      {/* Derecho */}
      <rect x="74" y="58" width="14" height="9" rx="4.5" fill={`url(#${id}-body)`} />
      <circle cx="88" cy="62.5" r="5.5" fill="#6d28d9" />

      {/* ── Cuello ───────────────────────────────── */}
      <rect x="43" y="50" width="14" height="8" rx="4" fill="#6d28d9" />

      {/* ── Cabeza ───────────────────────────────── */}
      <rect x="22" y="18" width="56" height="34" rx="12" fill={`url(#${id}-head)`} />
      {/* Reflejo superior cabeza */}
      <rect x="28" y="20" width="36" height="6" rx="4" fill="rgba(255,255,255,0.18)" />

      {/* ── Ojos ─────────────────────────────────── */}
      <g className="nrs-eye">
        <circle cx="37" cy="34" r="8" fill="rgba(0,0,0,0.35)" />
        <circle cx="37" cy="34" r="6" fill={`url(#${id}-eye-glow)`} />
        <circle cx="37" cy="34" r="3" fill="white" opacity="0.95" />
        <circle cx="38.5" cy="32.5" r="1.2" fill="white" opacity="0.7" />
      </g>
      <g className="nrs-eye-r">
        <circle cx="63" cy="34" r="8" fill="rgba(0,0,0,0.35)" />
        <circle cx="63" cy="34" r="6" fill={`url(#${id}-eye-glow)`} />
        <circle cx="63" cy="34" r="3" fill="white" opacity="0.95" />
        <circle cx="64.5" cy="32.5" r="1.2" fill="white" opacity="0.7" />
      </g>

      {/* ── Boca / scanner ───────────────────────── */}
      <rect x="36" y="44" width="28" height="4" rx="2" fill="rgba(0,0,0,0.25)" />
      <rect className="nrs-mouth" x="37" y="45" width="12" height="2" rx="1" fill="#a5f3fc" />

      {/* ── Orejas / laterales cabeza ────────────── */}
      <rect x="18" y="26" width="6" height="16" rx="3" fill="#6d28d9" />
      <rect x="76" y="26" width="6" height="16" rx="3" fill="#6d28d9" />

      {/* ── Antena ───────────────────────────────── */}
      <line x1="50" y1="18" x2="50" y2="8" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
      <circle className="nrs-antenna-dot" cx="50" cy="6" r="4" fill="#a5f3fc" filter={`url(#${id}-glow)`} />
    </svg>
  );
}
