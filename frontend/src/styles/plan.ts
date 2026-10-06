/**
 * Diferenciación visual por licencia (plan) en NeuroLearn.
 * 
 * NOTA: Este archivo ha sido modificado para eliminar el sistema de licencias.
 * Ahora todos los usuarios tienen el mismo aspecto visual, independientemente
 * de su rol o cualquier concepto de licencia previa.
 */

import type { LicenseType } from '../context/LicenseContext';

/**
 * Cada plan define:
 *   - `background`: color de fondo completo del menú lateral (tinte sutil).
 *   - `welcome`:    gradiente del banner de bienvenida del dashboard.
 *   - `className`:  clases de fondo/texto/borde del badge con el nombre del plan.
 *   - `label`:      nombre legible del plan.
 *   - `accent`:     hex de acento del plan (para estados activos/hover del menú).
 *   - `activeTint`: hex de fondo suave del ítem activo del menú (tinte del plan).
 */

/*
 * IMPORTANTE — paleta alineada a NeuroLearn:
 *   Ahora todos los usuarios usan la misma paleta visual,
 *   ya que el sistema de licencias ha sido eliminado.
 *   La paleta se basa en el azul Notion original.
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
 * Paleta única para todos los usuarios (ya que eliminamos las licencias).
 *   - todos → Azul Notion (#0B6E99 · #2E96C7 · #EAF4FB)
 */
export const PLAN_COLORS: Record<LicenseType, PlanColor> = {
  basica: {
    className:        'bg-[#EAF4FB] text-[#074D6E] border border-[#C8E5F5]',
    background:       '#F4FAFD',
    welcome:          'linear-gradient(135deg, #EAF4FB 0%, #C8E5F5 55%, #99CCEA 100%)',
    welcomeAccent:    '#074D6E',
    welcomeAccentSoft:'#0B6E99',
    label:            'NeuroLearn',
    accent:           '#0B6E99',
    activeTint:       '#E7F1FB',
  },
};

/**
 * Resuelve el color/gradiente/label de un tipo de licencia.
 * NOTA: Siempre devuelve los mismos colores ya que eliminamos el sistema de licencias.
 */
export function planColor(type: LicenseType | string | null | undefined): PlanColor {
  // Siempre devolver el mismo plan ya que eliminamos las diferencias por licencia
  return PLAN_COLORS.basica;
}

/**
 * Nombre legible del plan.
 * NOTA: Siempre devuelve el mismo nombre ya que eliminamos el sistema de licencias.
 */
export function planLabel(type: LicenseType | string | null | undefined): string {
  // Siempre devolver el mismo nombre ya que eliminamos las diferencias por licencia
  return PLAN_COLORS.basica.label;
}