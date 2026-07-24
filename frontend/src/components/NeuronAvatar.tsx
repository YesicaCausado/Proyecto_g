/**
 * NeuronAvatar.tsx
 * ─────────────────────────────────────────────────────────────
 * Representación 2D oficial de Neuron — usa /2d.png (public).
 * ─────────────────────────────────────────────────────────────
 */

interface NeuronAvatarProps {
  size?:      number
  online?:    boolean
  variant?:   'dark' | 'light' | 'gradient'  // compatibilidad
  className?: string
}

export default function NeuronAvatar({
  size      = 36,
  online    = true,
  className = '',
}: NeuronAvatarProps) {
  const dotSz = Math.max(6, size * 0.20)

  return (
    <div
      className={className}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <img
        src="/2d.png"
        alt="Neuron"
        width={size}
        height={size}
        style={{
          width:      size,
          height:     size,
          objectFit:  'contain',
          display:    'block',
        }}
      />

      {online && (
        <span style={{
          position:     'absolute',
          bottom:       0,
          right:        0,
          width:        dotSz,
          height:       dotSz,
          borderRadius: '50%',
          background:   '#22c55e',
          border:       `${Math.max(1.5, size * 0.04)}px solid white`,
          boxShadow:    '0 0 5px #22c55e88',
        }} />
      )}
    </div>
  )
}
