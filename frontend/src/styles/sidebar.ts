import type { CSSProperties } from 'react';
import { planColor } from './plan';

/**
 * Único origen del efecto de "hover / activo / seleccionado" de las barras
 * laterales de NeuroLearn (estudiante, profesor, super profesor y admin).
 *
 * Cada panel conserva su propio layout (padding, redondeo, tipografía), pero
 * los ESTADOS (hover suave, activo con barra lateral de acento y tinte del
 * plan, y la correspondiente variación del color del icono) se calculan aquí
 * para que todos reutilicen el mismo efecto visual.
 *
 * `theme`:
 *   - 'light' → sidebars claras (#F7F6F3). Hover azulado (paleta NeuroLearn).
 *   - 'dark'  → sidebar oscura del admin (#191919). Hover con overlay claro y
 *               acento azul consistente.
 *
 * El acento de los paneles ligados a licencia se toma del plan (azul/verde/
 * morado según la licencia), de modo que el estado activo del menú quede
 * cohesionado con el tinte de la sidebar y el banner de bienvenida.
 */
export type SidebarTheme = 'light' | 'dark';

export interface NavItemTokens {
  /** Clases de estado: fondo / color de texto (hover y activo). */
  stateClass: string;
  /** Clases del color del icono (normal / hover / activo). */
  iconClass: string;
  /** Estilo extra (barra lateral izquierda del ítem activo). */
  style?: CSSProperties;
}

export interface NavItemStyleOptions {
  disabled?: boolean;
  /** Tipo de licencia que tiñe el estado activo (si no se pasa: azul por defecto). */
  planType?: string | null;
}

export function navItemStyle(
  theme: SidebarTheme,
  active: boolean,
  opts?: NavItemStyleOptions,
): NavItemTokens {
  if (opts?.disabled) {
    return {
      stateClass: 'text-[#AEADAB] cursor-not-allowed',
      iconClass: 'text-[#D5D4D2]',
    };
  }

  // Acento del plan (solo aplica a paneles light ligados a licencia).
  const plan = planColor(opts?.planType);
  const accent = plan.accent;
  const tint = plan.activeTint;

  if (theme === 'dark') {
    return active
      ? {
          stateClass: 'bg-white/10 text-white',
          iconClass: 'text-[#60C8FF]',
          style: { boxShadow: `inset 3px 0 0 ${accent}` },
        }
      : {
          stateClass: 'text-[#9B9A97] hover:text-white hover:bg-white/10',
          iconClass: 'text-[#9B9A97] group-hover:text-white',
        };
  }

  return active
    ? {
        stateClass: 'bg-[#E7F1FB] text-[#0B3B5C]',
        iconClass: 'text-[#0B6E99]',
        style: { boxShadow: `inset 3px 0 0 ${accent}`, background: tint },
      }
    : {
        stateClass: 'text-[#787774] hover:bg-[#EDF3FA] hover:text-[#1F2A37]',
        iconClass: 'text-[#9B9A97] group-hover:text-[#1F2A37]',
      };
}