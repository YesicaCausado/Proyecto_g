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
  top:          40,            // Neurón más centrado en la pantalla (no arriba)
  scale:        1.15,          // Robot protagonista: un poco más grande
  floatAmplitude: 10,
  floatDuration:  5.2,
  entranceY:     40,
  entranceScale: 0.92,
  entranceRotation: 1.5,
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
  step1Bg:     0.0,
  step2Robot:  0.35,
  step3Nodes:  0.7,
  step4Brand:  0.6,
  step5Copy:   0.95,
  stagger:     0.11,
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
  robotUpTravel:    -140,
  robotScrollScale: 0.86,
  robotScrollRotation: 2,
  textTravel:       -260,
};

// ── Patterns (transición hacia los 5 patrones neurodigitales) ─
export interface HeroPatterns {
  /** Swing los 5 patrones mostrados en la transición */
  patterns: string[];
  /** Texto de encabezado */
  title:    string;
  /** Texto secundario */
  sub:      string;
}

export const HERO_PATTERNS: HeroPatterns = {
  patterns: ['Facial', 'Voz', 'Teclado', 'Interacción', 'Rendimiento'],
  title:    'Cinco señales neurodigitales',
  sub:      'NeuroLearn lee los patrones que delatan cómo aprende cada persona: cómo se expresa, cómo escribe, cómo interactúa y cómo progresa.',
};

// ── Detalle de cada patrón (para las cards) ──────────────────
// Cada entrada alimenta una tarjeta en PatternsTransition.tsx.
// `icon` es el nombre de un icono de lucide-react que se mapea
// en el componente (evitamos JSX aquí para mantener este archivo
// como Single Source of Truth de datos, no de UI).
export interface PatternDetail {
  id:          string;
  title:       string;
  icon:        string;      // clave del icono lucide-react
  description: string;
}

export const PATTERN_DETAILS: PatternDetail[] = [
  {
    id:          'facial',
    title:       'Facial',
    icon:        'Eye',
    description: 'Expresiones, micromovimientos y contacto visual delatan el estado emocional y la atención real, incluso cuando lo que se dice es distinto.',
  },
  {
    id:          'voz',
    title:       'Voz',
    icon:        'Mic',
    description: 'Tono, ritmo, pausas y volumen del habla revelan confianza, dudas y comprensión. La IA detecta señales que van más allá de las palabras.',
  },
  {
    id:          'teclado',
    title:       'Teclado',
    icon:        'Keyboard',
    description: 'Velocidad de escritura, errores típicos y hábitos sobre el teclado permiten anticipar dificultades antes de que se traduzcan en un mal resultado.',
  },
  {
    id:          'interaccion',
    title:       'Interacción',
    icon:        'Users',
    description: 'Cómo la persona navega, decide y colabora con la interfaz y con otros usuarios construye un mapa único de su forma de aprender.',
  },
  {
    id:          'rendimiento',
    title:       'Rendimiento',
    icon:        'TrendingUp',
    description: 'Resultados y progreso se convierten en una curva viva que la IA ajusta en cada paso para que el aprendizaje sea cada vez más adaptativo.',
  },
];

// ── Secciones de detalle de cada patrón (más abajo) ──────────
// Datos reales: las señales listadas corresponden a las métricas
// que NeuroLearn ya calcula (useFacialDetection, useVoiceProsody,
// useBehavioralMetrics y la predicción de error del backend).
// Card `id` debe coincidir con `PATTERN_DETAILS[].id` para el scroll.
export interface PatternSignal {
  metric: string;   // nombre técnico de la métrica
  label:  string;   // etiqueta legible
  desc:   string;   // qué significa
}

export interface PatternSection {
  id:        string;
  title:     string;
  tagline:   string;
  intro:     string;
  signals:   PatternSignal[];
  benefit:   string;
}

export const PATTERN_SECTIONS: PatternSection[] = [
  {
    id: 'facial',
    title: 'Microexpresión facial',
    tagline: 'Cómo te sientes mientras aprendes',
    intro:
      'A través de la cámara, NeuroLearn analiza micromovimientos del rostro en tiempo real. No lee emociones "mágicas": mide cambios observables de luminosidad, movimiento y atención que correlacionan con el estado emocional y el foco.',
    signals: [
      { metric: 'attention_score',    label: 'Atención visual',    desc: 'Detecta si la mirada permanece en la pantalla y si el movimiento es estable.' },
      { metric: 'valence / arousal',  label: 'Emoción y energía',  desc: 'Valencia (positiva/neutral/negativa) y activación fisiológica del momento.' },
      { metric: 'blink_rate',         label: 'Frecuencia de parpadeo', desc: 'Cambios en el parpadeo pueden delatar fatiga o concentración.' },
      { metric: 'gaze_direction',     label: 'Dirección de la mirada', desc: 'Hacia la pantalla, desviada, arriba o abajo.' },
      { metric: 'brow_furrow',        label: 'Fruncimiento del ceño',  desc: 'Tensión facial asociada a esfuerzo o confusión.' },
    ],
    benefit:
      'Cuando la atención decae, el tutor adapta el ritmo, reformula el contenido o propone una pausa antes de que la concentración se pierda del todo.',
  },
  {
    id: 'voz',
    title: 'Prosodia de voz',
    tagline: 'Lo que la voz dice sin palabras',
    intro:
      'El micrófono captura cómo se habla — no solo qué se dice. Tono, ritmo, pausas y trembleza aportan señales sobre confianza, dudas y comprensión que las palabras por sí solas no revelan.',
    signals: [
      { metric: 'pitch_mean_hz',       label: 'Tono (frecuencia)', desc: 'Variaciones de tono asociadas a énfasis y estado.' },
      { metric: 'speech_rate_wpm',     label: 'Velocidad de habla', desc: 'Palabras por minuto; hablar rápido o lento delata dominio o inseguridad.' },
      { metric: 'voice_tremor',        label: 'Estabilidad de la voz', desc: 'Varianza en la intensidad: temblor puede indicar nerviosismo.' },
      { metric: 'energy_level',        label: 'Nivel de energía',  desc: 'Volumen y actividad vocal general del momento.' },
      { metric: 'filler_words / silence', label: 'Muletillas y silencios', desc: 'Pausas y muletillas como señal de vacilación.' },
    ],
    benefit:
      'Si el tono duda o la velocidad cambia al enfrentar un tema, la IA refuerza ese contenido con ejemplos y verifica comprensión de forma más cercana.',
  },
  {
    id: 'teclado',
    title: 'Ritmo de interacción y teclado',
    tagline: 'Las decisiones se leen al escribir',
    intro:
      'La dinámica de escritura es una ventana a la decisión: cuánto se tarda en empezar, qué tan fluido escribe y cuántas veces se corrige. Estos patrones se capturan mientras el estudiante interactúa con la plataforma.',
    signals: [
      { metric: 'response_time_ms',    label: 'Tiempo de respuesta', desc: 'Cuánto tarda en responder tras el mensaje del tutor.' },
      { metric: 'pause_before_ms',     label: 'Pausa previa',       desc: 'El tiempo de duda antes de empezar a escribir (bloqueo si supera ~3s).' },
      { metric: 'typing_speed_cpm',    label: 'Velocidad de escritura', desc: 'Caracteres por minuto reales, con su fluidez.' },
      { metric: 'corrections',         label: 'Correcciones',       desc: 'Backspaces y reescrituras — señal de indecisión.' },
      { metric: 'typing_bursts',       label: 'Ráfagas de escritura', desc: 'Cómo se agrupa la escritura con pausas, revelando tropezones.' },
    ],
    benefit:
      'Una pausa larga o muchas correcciones delatan atascos. El tutor detecta el momento de duda y ofrece ayuda justo cuando hace falta, no después.',
  },
  {
    id: 'interaccion',
    title: 'Patrones de interacción',
    tagline: 'Cómo navega y decide en la plataforma',
    intro:
      'No solo importa la respuesta: también la ruta. La forma en que una persona navega, se detiene, cambia de opinión y colabora dibuja un mapa conductual que la IA usa para entender su estilo de aprendizaje.',
    signals: [
      { metric: 'navigation',         label: 'Recorrido',           desc: 'Órdenes, retornos y atajos al moverse por la plataforma.' },
      { metric: 'hesitations',        label: 'Vacilaciones',        desc: 'Pausas y cambios de ruta ante opciones o contenido.' },
      { metric: 'collaboration',      label: 'Colaboración',        desc: 'Interacción con otros usuarios, grupos y actividades.' },
      { metric: 'question_signals',   label: 'Señales de duda',     desc: 'Mensajes que cierran en pregunta o buscan confirmación.' },
    ],
    benefit:
      'Con el mapa de la interacción, la plataforma anticipa dónde se pierde el interés o la confianza y reorganiza la experiencia hacia el camino más eficiente.',
  },
  {
    id: 'rendimiento',
    title: 'Predicción de rendimiento y error',
    tagline: 'Una curva de progreso que se ajusta sola',
    intro:
      'Rendimiento no es solo la nota: es la trayectoria. Con el historial real de quizzes y actividades, la IA predice el riesgo de error antes de que ocurra y ajusta la dificultad y el refuerzo en consecuencia.',
    signals: [
      { metric: 'error_risk',        label: 'Riesgo de error',     desc: 'Predicción calculada con historial real de respuestas y actividad.' },
      { metric: 'engagement_score',  label: 'Nivel de compromiso', desc: 'Qué tan conectado está el estudiante con el contenido.' },
      { metric: 'progression',       label: 'Progresión',          desc: 'Evolución de resultados en el tiempo, sesión a sesión.' },
      { metric: 'adaptation',        label: 'Adaptación de la IA', desc: '¿Debe reforzar, avanzar o cambiar de estrategia?' },
    ],
    benefit:
      'El sistema decide cuándo reforzar, cuándo avanzar y cuándo sugerir una pausa, manteniendo a cada estudiante en su zona óptima de aprendizaje.',
  },
];

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

// ── Iluminación MONOCROMÁTICA de Neurón (Hero) ───────────────
//
// La escena 3D compartida (RobotLights) ilumina Neurón por defecto
// con luces azul (#4f8ef7) y violeta (#a78bfa) — heredadas del login.
// La Landing exige una paleta ESTRICTAMENTE blanca/negra/gris, así que
// aquí sobrescribimos el preset de iluminación con luces NEUTRAS
// (blanco/gris), dejando intacta la escena del login.
//
// Estructura: LightingPresetMap de RobotLights, indexada por RobotState
// ("idle" es el estado que usa el Hero).
// ─────────────────────────────────────────────────────────────
import type { LightingPreset } from '../../auth/components/robot/RobotLights';

export interface MonochromeLighting {
  /** Intensidad global aplicada a todas las luces (ajusta brillo) */
  intensityScale: number;
  /** Mediante qué presets de post-procesado se suaviza/baja el bloom */
  enableBloom:    boolean;
  /**
   * Preset de iluminación listo para inyectar en RobotCanvas
   * (lightingPresets). Monocromo: punto-luces blancas/grises.
   */
  preset:         { idle: LightingPreset };
}

export const HERO_LIGHTING: MonochromeLighting = {
  intensityScale: 1,
  enableBloom:    true,
  preset: {
    idle: {
      ambient:     { color: '#ffffff', intensity: 0.55 },
      directional: { color: '#ffffff', intensity: 1.1, position: [3, 5, 3], castShadow: true },
      pointLights: [
        // Relleno neutro cálido-frío → luz blanca pura, sin tinte
        { color: '#ffffff', intensity: 0.9,  position: [-3, 2, 2], distance: 12, decay: 2 },
        { color: '#d9d9d9', intensity: 0.7,  position: [3, 1, 1],  distance: 12, decay: 2 },
        // Una luz gris central para modelar el volumen del robot
        { color: '#f2f2f2', intensity: 0.5,  position: [0, -1, 3], distance: 12, decay: 2 },
      ],
    },
  },
};