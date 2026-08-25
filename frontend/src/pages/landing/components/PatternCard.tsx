/**
 * PatternCard.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: una tarjeta para cada patrón
 * neurodigital de NeuroLearn.
 *
 * Estética: monocroma (blanco/negro/gris), premium y sin
 * saturación. La aparición animada la controla PatternsTransition
 * vía GSAP usando el atributo `data-pattern`; aquí solo se define
 * la estructura y las microinteracciones de hover.
 * ─────────────────────────────────────────────────────────────
 */
import type { ReactNode } from 'react';

export interface PatternCardProps {
  /** Número de patrón (0-based) usado para el indicador */
  index:    number;
  /** Nombre del patrón */
  title:    string;
  /** Descripción breve */
  description: string;
  /** Icono (elemento lucide u otro) */
  icon:     ReactNode;
}

export default function PatternCard({
  index,
  title,
  description,
  icon,
}: PatternCardProps) {
  return (
    <div
      data-pattern
      className="group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1.5 hover:border-white/30"
      style={{
        borderColor: 'rgba(230,230,230,0.14)',
        background: 'rgba(255,255,255,0.03)',
        color: '#f5f5f5',
        willChange: 'transform',
        boxShadow: '0 0 0 rgba(0,0,0,0)',
      }}
      aria-label={`Patrón neurodigital: ${title}`}
    >
      {/* Cabecera: icono + número de patrón */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 group-hover:bg-white"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          aria-hidden="true"
        >
          <span className="text-white transition-colors duration-300 group-hover:text-black">
            {icon}
          </span>
        </div>
        <span
          className="text-[11px] font-semibold tracking-[0.25em]"
          style={{ color: 'rgba(220,220,220,0.45)' }}
          aria-hidden="true"
        >
          {`0${index + 1}`}
        </span>
      </div>

      {/* Nombre del patrón */}
      <h3
        className="mt-6 text-xl font-semibold tracking-tight text-white"
      >
        {title}
      </h3>

      {/* Trazo técnico sutil */}
      <div
        className="mt-3 h-px w-10 transition-all duration-300 group-hover:w-full"
        style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.35), transparent)' }}
        aria-hidden="true"
      />

      {/* Descripción */}
      <p
        className="mt-4 text-sm leading-relaxed"
        style={{ color: 'rgba(230,230,230,0.72)' }}
      >
        {description}
      </p>
    </div>
  );
}