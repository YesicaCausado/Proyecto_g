import type { LicenseType } from '../context/LicenseContext';

/**
 * Diferenciación visual por licencia (plan) en NeuroLearn.
 *
 * Cada plan define:
 *   - `background`: color de fondo completo del menú lateral (tinte sutil).
 *   - `welcome`:    gradiente del banner de bienvenida del dashboard.
 *   - `className`:  clases de fondo/texto/borde del badge con el nombre del plan.
 *   - `label`:      nombre legible del plan.
 *   - `accent`:     hex de acento del plan (para estados activos/hover del menú).
 *   - `activeTint`: hex de fondo suave del ítem activo del menú (tinte del plan).
 *
 * IMPORTANTE — paleta alineada a NeuroLearn:
 *   Los colores de cada plan se derivan de la paleta Notion de la aplicación
 *   (definida en `index.css`), no de paletas ajenas (ámbar/violeta Tailwind):
 *     - basica  → Azul Notion (#0B6E99 · #2E96C7 · #EAF4FB)
 *     - premium → Verde Notion (#0F7B6C · #5DC8B4 · teal claro)
 *     - pro     → Morado Notion (#6940A5 · #8B70C9 · lila claro)
 *
 * Así cada licencia conserva un tinte propio distinguible, pero siempre dentro
 * de un mismo lenguaje visual cohesivo con el resto de la app.
 *
 * Los tres roles con licencia institucional (estudiante, profesor y super
 * profesor) usan esta paleta. El panel de administración (admin) es global y
 * NO está ligado a una licencia, por lo que queda excluido.
 */

export interface PlanColor {
  /** Clases de fondo + texto + borde del badge (tinte perceptible). */
  className: string;
  /** Color de fondo del menú lateral completo. */
  background: string;
  /** Gradiente del banner de bienvenida del dashboard. */
  welcome: string;
  /** Color de acento (títulos del banner de bienvenida). */
  welcomeAccent: string;
  /** Color de acento secundario (subtexto del banner). */
  welcomeAccentSoft: string;
  /** Nombre legible del plan. */
  label: string;
  /** Hex de acento principal del plan (chevrón / icono activo del menú). */
  accent: string;
  /** Hex de fondo suave del ítem activo del menú (tinte del plan). */
  activeTint: string;
}

/**
 * Paleta por plan, alineada a la paleta Notion de NeuroLearn:
 *   - basica  → Azul     (#0B6E99)
 *   - premium → Verde    (#0F7B6C)
 *   - pro     → Morado   (#6940A5)
 */
export const PLAN_COLORS: Record<LicenseType, PlanColor> = {
  basica: {
    className:        'bg-[#EAF4FB] text-[#074D6E] border border-[#C8E5F5]',
    background:       '#F4FAFD',
    welcome:          'linear-gradient(135deg, #EAF4FB 0%, #C8E5F5 55%, #99CCEA 100%)',
    welcomeAccent:    '#074D6E',
    welcomeAccentSoft:'#0B6E99',
    label:            'Básica',
    accent:           '#0B6E99',
    activeTint:       '#E7F1FB',
  },
  premium: {
    className:        'bg-[#E6F5F1] text-[#0A6459] border border-[#BFE6DE]',
    background:       '#EFF8F6',
    welcome:          'linear-gradient(135deg, #E6F5F1 0%, #C3EBE3 55%, #8FD8CA 100%)',
    welcomeAccent:    '#0A6459',
    welcomeAccentSoft:'#0F7B6C',
    label:            'Premium',
    accent:           '#0F7B6C',
    activeTint:       '#E6F1EF',
  },
  pro: {
    className:        'bg-[#F0EAF9] text-[#4A2E86] border border-[#D8CBEF]',
    background:       '#F5EFFC',
    welcome:          'linear-gradient(135deg, #F0EAF9 0%, #D8CBEF 55%, #B9A5E6 100%)',
    welcomeAccent:    '#4A2E86',
    welcomeAccentSoft:'#6940A5',
    label:            'Pro',
    accent:           '#6940A5',
    activeTint:       '#F0EAF9',
  },
};

/**
 * Resuelve el color/gradiente/label de un tipo de licencia, con fallback
 * seguro a "basica" ante valores inesperados o undefined (p. ej. admin).
 */
export function planColor(type: LicenseType | string | null | undefined): PlanColor {
  switch (type) {
    case 'premium': return PLAN_COLORS.premium;
    case 'pro':     return PLAN_COLORS.pro;
    default:        return PLAN_COLORS.basica;
  }
}

/** Nombre legible del plan, con capitalización adecuada. */
export function planLabel(type: LicenseType | string | null | undefined): string {
  return planColor(type).label;
}