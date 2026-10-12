/**
 * Tema visual único de NeuroLearn (azul de la marca).
 *
 * Lo usan los menús laterales (estado activo), el fondo de las sidebars y el
 * banner de bienvenida. Es igual para todos los usuarios: la apariencia no
 * depende del rol ni de ningún plan.
 */
export const THEME = {
  /** Fondo de los menús laterales. */
  background: '#F4FAFD',
  /** Gradiente del banner de bienvenida del dashboard. */
  welcome: 'linear-gradient(135deg, #EAF4FB 0%, #C8E5F5 55%, #99CCEA 100%)',
  /** Títulos del banner de bienvenida. */
  welcomeAccent: '#074D6E',
  /** Subtexto del banner de bienvenida. */
  welcomeAccentSoft: '#0B6E99',
  /** Acento del menú (barra del ítem activo, chevrones). */
  accent: '#0B6E99',
  /** Fondo suave del ítem activo del menú. */
  activeTint: '#E7F1FB',
} as const;
