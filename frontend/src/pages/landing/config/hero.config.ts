/**
 * hero.config.ts
 * ─────────────────────────────────────────────────────────────
 * Responsabilidad única: centralizar TODA la configuración del
 * Hero de la Landing de NeuroLearn.
 *
 * Principio (igual que RobotConfig.ts): Single Source of Truth —
 * aquí NO se hardcodean textos, posiciones, escalas ni velocidades
 * dentro de los componentes. Todo se tweakea desde este archivo.
 *
 * Para ajustar position/escala/velocidad de Neurón, text o timing,
 * modifica únicamente este archivo — los componentes lo leen.
 * ─────────────────────────────────────────────────────────────
 */

// ── Textos del Hero ───────────────────────────────────────────
export interface HeroCopy {
  eyebrow:    string;   // etiqueta superior (NEUROLEARN)
  headlineA:  string;   // línea 1 del mensaje principal
  headlineB:  string;   // línea 2 del mensaje principal (resaltada)
  subline:    string;   // mensaje secundario
  ctaPrimary: string;   // botón principal
  ctaSecondary:string;  // botón secundario
}

export const HERO_COPY: HeroCopy = {
  eyebrow:     'NeuroLearn',
  headlineA:   'La inteligencia artificial que entiende',
  headlineB:   'cómo aprenden tus estudiantes.',
  subline:     'NeuroLearn combina IA y análisis neurodigital para crear experiencias de aprendizaje más adaptativas.',
  ctaPrimary:  'Conocer NeuroLearn',
  ctaSecondary:'Explorar la plataforma',
};

// ── Logo / marca ──────────────────────────────────────────────
export const HERO_BRAND = 'NEUROLEARN';

// ── Estética decorativa del Hero (monocroma) ─────────────────
// Centraliza las capas visuales no robóticas: la textura de grilla
// técnica del fondo claro y el glow neutro del fondo oscuro.
// Mantener aquí los valores estéticos permite afinar sin tocar JSX.
export const HERO_AESTHETIC = {
  /** Textura "blueprint" del fondo claro — rejilla fina y muy tenue */
  grid: {
    /** Tamaño de celda de la cuadrícula (px) */
    cell:            76,
    /** Color de las líneas horizontales */
    lineH:           'rgba(10,11,16,0.05)',
    /** Color de las líneas verticales */
    lineV:           'rgba(10,11,16,0.04)',
  },
  /** Resplandor técnico del fondo oscuro (neutro, sin tinte) */
  glowDark: {
    center:          'rgba(214,217,224,0.10)',
    edge:            'rgba(214,217,224,0.00)',
  },
  /** Máscara que oculta la grilla bajo el contenido central */
  gridFadeTop:      'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0) 26%)',
  /** Máscara que oculta la grilla en la base (se funde al hero) */
  gridFadeBottom:   'linear-gradient(0deg, #ffffff 0%, rgba(255,255,255,0) 30%)',
} as const;

// ── Neurón (posición / escala / velocidad) ────────────────────
//
// El robot real es el `/robot.glb` que ya renderiza `RobotCanvas`.
// Mover el wrapper DOM (HeroRobot) con GSAP produce el
// efecto cinematográfico sin tocar el motor 3D existente.
//
//   · floatAmplitude  → cuánto sube/baja Neurón en la flotación continua (px)
//   · floatDuration   → segundos de un ciclo completo (más corto = más rápido)
//   · entranceY       → desplazamiento Y de entrada (px) desde el que "entra en escena"
//   · entranceScale   → escala con la que entra (de<1 → aparece creciendo)
//   · maxMouseRotX    → grados máx. de inclinación por el movimiento del mouse (eje X)
//   · maxMouseRotY    → grados máx. de giro lateral por el mouse (eje Y)
//   · mouseEase       → suavizado del mouse ("power3.out")
//
export interface HeroRobotConfig {
  /** posicion inicial desktop: [top, left], en % del hero */
  top:          number;
  /** escala base del contenedor del robot (desktop) */
  scale:        number;
  /** Amplitud vertical de la flotación continua (px) */
  floatAmplitude: number;
  /** Duración de un ciclo completo de flotación (s) */
  floatDuration:  number;
  /** Desplazamiento Y de entrada (px) */
  entranceY:     number;
  /** Escala de entrada */
  entranceScale: number;
  /** Rotación Z de entrada (grados) */
  entranceRotation: number;
  /** Mouse parallax */
  maxMouseRotX:  number;
  maxMouseRotY:  number;
  maxMouseTilt:  number;
}

export const HERO_ROBOT: HeroRobotConfig = {
  top:          58,            // Neurón más centrado en la pantalla (no arriba) - movido abajo para dejar espacio al contenido
  scale:        1.25,          // Robot protagonista: más grande y visible
  floatAmplitude: 12,
  floatDuration:  5.0,
  entranceY:     50,
  entranceScale: 0.9,
  entranceRotation: 1,
  maxMouseRotX:  3,
  maxMouseRotY:  5,
  maxMouseTilt:  4,
};

// ── Timing de la animación de entrada (s) ─────────────────────
export interface HeroTiming {
  step1Bg:     number;  // fondo blanco limpio
  step2Robot:  number;  // Neurón aparece progresivamente
  step3Nodes:  number;  // partículas/nodos alrededor
  step4Brand:  number;  // aparece NEUROLEARN
  step5Copy:   number;  // mensaje principal + CTA
  stagger:     number;  // desfase entre sub-elementos
}

export const HERO_TIMING: HeroTiming = {
  step1Bg:     0.0,  // fondo blanco limpio
  step2Robot:  0.8,  // Neurón aparece progresivamente (después del contenido)
  step3Nodes:  1.2,  // partículas/nodos alrededor
  step4Brand:  0.0,  // aparece NEUROLEARN (primero)
  step5Copy:   0.3,  // mensaje principal + CTA (después de la marca)
  stagger:     0.12, // desfase entre sub-elementos
};

// ── Scroll (transición cinematográfica) ───────────────────────
//
// La transición está "scrubbada" (ligada al scroll) sobre el
// conjunto hero + zona de transición. Con `start`/`end` en
// formato de proporciones.
export interface HeroScroll {
  /** Posición del trigger donde empieza el scrub (proporción) */
  start:       string;
  /** Posición donde termina (proporción) — sobre la zona oscura */
  end:         string;
  /** Cuánto sube Neurón durante el scroll (px) */
  robotUpTravel: number;
  /** Cuánto se achica Neurón durante el scroll (0–1) */
  robotScrollScale: number;
  /** Rotación Z durante el scroll (grados) */
  robotScrollRotation: number;
  /** Cuánto sube el texto (sale más rápido — parallax) (px) */
  textTravel:  number;
}

export const HERO_SCROLL: HeroScroll = {
  start:            'top top',
  end:              '+=120%',
  robotUpTravel:    -60,          // Menos movimiento hacia arriba para mantener presencia
  robotScrollScale: 0.94,         // Escala ligeramente menor pero manteniendo más tamaño
  robotScrollRotation: 0,         // Sin rotación para mantener estabilidad
  textTravel:       -200,         // El texto sale menos rápido pero aún visible
};

// ── Responsive ────────────────────────────────────────────────
// En mobile se reduce Neurón y se simplifican los efectos.
export interface HeroResponsive {
  /** Umbral de ancho (px) que marca desktop vs mobile */
  mobileBreakpoint: number;
  /** Escala de Neurón en mobile */
  mobileRobotScale: number;
  /** Top de Neurón en mobile (%) */
  mobileTop:        number;
}

export const HERO_RESPONSIVE: HeroResponsive = {
  mobileBreakpoint: 768,
  mobileRobotScale: 0.9,
  mobileTop:        42,
};
