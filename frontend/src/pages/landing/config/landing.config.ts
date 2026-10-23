/**
 * landing.config.ts
 * ─────────────────────────────────────────────────────────────
 * Single Source of Truth de la Landing de NeuroLearn (rewrite
 * espec-compliant). Centraliza la PALETA (estrictamente
 * negro / blanco / grises / azul), los textos de story-telling
 * y los datos de las secciones. Ningún componente hardcodea
 * colores ni copy.
 * ─────────────────────────────────────────────────────────────
 */

// ── Paleta oficial ────────────────────────────────────────────
// Regla 70/20/10: 70% blanco/negro/gris · 20% estructura · 10% azul
export const NL = {
  black:      '#050505', // negro profundo
  black2:     '#0A0A0A', // negro secundario
  grayDark:   '#171717', // gris oscuro
  grayMid:    '#525252', // gris medio
  grayLight:  '#A3A3A3', // gris claro
  grayPale:   '#E5E5E5', // gris muy claro
  white:      '#FFFFFF',
  blue:       '#2563EB', // azul principal
  blueBright: '#3B82F6', // azul highlight
  blueSoft:   '#60A5FA', // azul suave (efectos)
} as const;

// ── Marca ────────────────────────────────────────────────────
export const BRAND = {
  name:     'NeuroLearn',
  tagline:  'Aprendizaje adaptativo con inteligencia artificial',
  wordmark: 'NEUROLEARN',
} as const;

// ── Hero ─────────────────────────────────────────────────────
export const HERO = {
  eyebrow:         'IA + Educación · Tutor neuronal',
  headlineA:       'Una inteligencia artificial que entiende',
  headlineB:       'cómo aprenden tus estudiantes',
  headlineHighlight: 'cómo aprende cada estudiante.',
  subline:
    'Neuron analiza patrones de voz, rostro, teclado, interacción y rendimiento para construir un aprendizaje verdaderamente adaptativo.',
  ctaPrimary:      'Comenzar ahora',
  ctaSecondary:    'Ver la plataforma',
  scrollHint:      'Explorar la inteligencia',
  badge:           'Sistema de aprendizaje adaptativo',
} as const;

// ── Competencias (Sección capacidades) ──────────────────────
export interface Competency {
  id:    string;
  label: string;
  index: string;   // numeración técnica
  desc:  string;
}

export const COMPETENCIES: Competency[] = [
  {
    id:    'logico',
    label: 'Pensamiento lógico-matemático',
    index: '01',
    desc:  'Resolución de problemas, razonamiento y lógica formal.',
  },
  {
    id:    'lectura',
    label: 'Lectura crítica',
    index: '02',
    desc:  'Comprensión profunda, análisis e interpretación de textos.',
  },
  {
    id:    'ingles',
    label: 'Inglés comunicativo',
    index: '03',
    desc:  'Competencia lingüística y comunicación funcional en inglés.',
  },
  {
    id:    'ciudadanas',
    label: 'Competencias ciudadanas',
    index: '04',
    desc:  'Convivencia, participación y pensamiento social.',
  },
  {
    id:    'cientifico',
    label: 'Pensamiento científico',
    index: '05',
    desc:  'Método científico, exploración y razonamiento basado en evidencia.',
  },
];

// ── Pipeline (Sección proceso) ───────────────────────────────
export interface PipelineStage {
  id:    string;
  label: string;
  note:  string;
}

export const PIPELINE: PipelineStage[] = [
  { id: 'datos',     label: 'Datos',     note: 'Señales crudas de cada sesión.' },
  { id: 'analisis',  label: 'Análisis',  note: 'Patrones y comportamiento.' },
  { id: 'ia',        label: 'IA',        note: 'Modelo neuronal predictivo.' },
  { id: 'adaptacion',label: 'Adaptación',note: 'Contenido y ritmo ajustados.' },
  { id: 'aprendizaje',label: 'Aprendizaje', note: 'Progreso y dominio real.' },
];

// ── CTA final ────────────────────────────────────────────────
export const CTA_FINAL = {
  eyebrow:  'NeuroLearn',
  headline: 'El futuro del aprendizaje',
  highlight: 'comienza contigo.',
  subline:
    'Únete a la plataforma donde la inteligencia artificial entiende cómo aprende cada estudiante.',
  footer:   'neurolearn · aprendizaje adaptativo · inteligencia artificial',
} as const;

// ── Footer ──────────────────────────────────────────────────
export const FOOTER_LINKS = {
  producto: ['Plataforma', 'NeuroChat', 'Analítica', 'Integraciones'],
  saberes:  ['Pensamiento lógico-matemático', 'Lectura crítica', 'Inglés', 'Competencias ciudadanas', 'Pensamiento científico'],
  empresa:  ['Sobre NeuroLearn', 'Contacto', 'Política de privacidad', 'Términos'],
} as const;

// ── Cinco patrones neurodigitales (experiencia horizontal) ──
// Los nombres SON EXACTOS: Facial, Voz, Teclado, Interacción,
// Rendimiento. NO se cambian. Cada uno ocupa ~una pantalla en el
// recorrido horizontal pinned (GSAP + ScrollTrigger).
export interface NeuroPattern {
  id:      string;      // clave única (ancla/estado)
  index:   string;      // numeración técnica (01..05)
  title:   string;      // nombre exacto del patrón
  tag:     string;      // etiqueta técnica corta (microcopy)
  desc:    string;      // descripción sencilla del patrón
  accent:  string;      // acento de la paleta (monocromo + azul)
  /** Señales/labels que aparecen progresivamente durante el scroll */
  labels:  string[];
  /** Ruta de la imagen de escena (public/Imagenes_Landing/) */
  image:   string;
}

export const NEURO_PATTERNS: NeuroPattern[] = [
  {
    id: 'facial', index: '01', title: 'Facial', tag: 'Microexpresión',
    desc: 'Analiza microexpresiones y cambios faciales durante la interacción.',
    accent: '#3B82F6',
    labels: ['Microexpresiones', 'Atención', 'Mirada'],
    image: 'Imagenes_Landing/facial1.jpg',
  },
  {
    id: 'voz', index: '02', title: 'Voz', tag: 'Prosodia',
    desc: 'Analiza aspectos como el ritmo, las pausas y la prosodia.',
    accent: '#60A5FA',
    labels: ['Ritmo', 'Pausas', 'Prosodia'],
    image: 'Imagenes_Landing/voz.jpg',
  },
  {
    id: 'teclado', index: '03', title: 'Teclado', tag: 'Escritura',
    desc: 'Observa la velocidad, las pausas y los errores al escribir.',
    accent: '#2563EB',
    labels: ['Velocidad', 'Pausas', 'Errores'],
    image: 'Imagenes_Landing/teclado.jpg',
  },
  {
    id: 'interaccion', index: '04', title: 'Interacción', tag: 'Navegación',
    desc: 'Analiza cómo navegas, haces clic y utilizas la plataforma.',
    accent: '#3B82F6',
    labels: ['Clics', 'Navegación', 'Comportamiento'],
    image: 'Imagenes_Landing/interaccion.jpg',
  },
  {
    id: 'rendimiento', index: '05', title: 'Rendimiento', tag: 'Progreso',
    desc: 'Analiza respuestas, errores, tiempo y progreso para entender tu evolución.',
    accent: '#60A5FA',
    labels: ['Respuestas', 'Errores', 'Tiempo', 'Progreso'],
    image: 'Imagenes_Landing/rendimiento.jpg',
  },
];

// ── ¿Qué es NeuroLearn? (flujo secuencial) ─────────────────
export interface WhatIsStep {
  id:    string;
  label: string;
  note:  string;
}

export const WHAT_IS: {
  title:     string;
  highlight: string;
  lead:      string;
  steps:     WhatIsStep[];
} = {
  title: '¿Qué es',
  highlight: 'NeuroLearn?',
  lead:
    'NeuroLearn utiliza inteligencia artificial para entender cómo aprende cada estudiante y adaptar su experiencia de aprendizaje.',
  steps: [
    { id: 'estudiante', label: 'Estudiante', note: 'Interactúa con la plataforma' },
    { id: 'interaccion', label: 'Interacción', note: 'Voz, rostro, teclado y clics' },
    { id: 'ia', label: 'IA', note: 'Neuron observa y decodifica' },
    { id: 'analisis', label: 'Análisis', note: 'Patrones neurodigitales' },
    { id: 'personalizado', label: 'Aprendizaje personalizado', note: 'Se adapta al estudiante' },
  ],
};

// ── Personalización (¿Cómo se adapta?) ─────────────────────
export interface AdaptationAxis {
  id:    string;
  label: string;
  desc:  string;
  from:  string;
  to:    string;
}

export const ADAPTATION: {
  eyebrow:   string;
  title:     string;
  highlight: string;
  lead:      string;
  axes:      AdaptationAxis[];
} = {
  eyebrow: 'Personalización',
  title: 'El aprendizaje cambia según',
  highlight: 'cada estudiante.',
  lead:
    'Toda la información converge en un perfil vivo. NeuroLearn ajusta la experiencia en tiempo real, sesión a sesión.',
  axes: [
    { id: 'dificultad', label: 'Dificultad', desc: 'Nivel del contenido', from: 'Base', to: 'Desafiante' },
    { id: 'contenido', label: 'Contenido', desc: 'Qué se enseña', from: 'Genérico', to: 'Personalizado' },
    { id: 'recomendaciones', label: 'Recomendaciones', desc: 'Qué se sugiere', from: 'Globales', to: 'Individuales' },
    { id: 'ritmo', label: 'Ritmo', desc: 'Velocidad de avance', from: 'Fijo', to: 'Adaptativo' },
  ],
};

// ── Beneficios ─────────────────────────────────────────────
export interface Benefit {
  id:    string;
  icon:  string;
  title: string;
  desc:  string;
  from:  'left' | 'right' | 'top' | 'bottom';
}

export const BENEFITS: Benefit[] = [
  { id: 'personalizado', icon: 'Sparkles',  title: 'Aprendizaje personalizado', desc: 'La experiencia se adapta al estudiante.', from: 'left' },
  { id: 'seguimiento',   icon: 'Activity',  title: 'Seguimiento inteligente',   desc: 'Observa la evolución y el progreso.', from: 'top' },
  { id: 'ia',            icon: 'Brain',     title: 'IA educativa',              desc: 'NeuroLearn acompaña al estudiante durante su aprendizaje.', from: 'bottom' },
  { id: 'docentes',      icon: 'Users',     title: 'Información para docentes', desc: 'Los docentes pueden identificar avances y posibles dificultades.', from: 'right' },
];

// ── Instituciones ──────────────────────────────────────────
export interface InstitutionRole {
  id:      string;
  label:   string;
  note:    string;
}

export const INSTITUTIONS: {
  eyebrow:   string;
  title:     string;
  highlight: string;
  lead:      string;
  roles:     InstitutionRole[];
} = {
  eyebrow: 'Instituciones',
  title: 'Pensado para todo el',
  highlight: 'ecosistema educativo.',
  lead:
    'NeuroLearn no solo acompaña al estudiante: conecta instituciones, docentes y estudiantes en una única inteligencia.',
  roles: [
    { id: 'institucion', label: 'Institución', note: 'Gobierna y supervisa' },
    { id: 'docentes', label: 'Docentes', note: 'Enseñan y acompañan' },
    { id: 'estudiantes', label: 'Estudiantes', note: 'Aprenden a su ritmo' },
    { id: 'neurolearn', label: 'NeuroLearn AI', note: 'La inteligencia que conecta todo' },
  ],
};

// ── Responsive ──────────────────────────────────────────────
export const RESPONSIVE = {
  mobileBreakpoint: 768,
  /** Override para reducir partículas/efectos en móvil */
  mobileParticles:  40,
  desktopParticles: 90,
} as const;