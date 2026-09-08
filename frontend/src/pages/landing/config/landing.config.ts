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

// ── Fuentes ──────────────────────────────────────────────────
export const FONT = {
  ui:       "'Inter', 'Segoe UI', system-ui, sans-serif",
  display:  "'Space Grotesk', 'Inter', system-ui, sans-serif",
  mono:     "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace",
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

// ── Story-telling · Story sections ───────────────────────────
export interface StorySection {
  id:        string;
  /** Sección contínua: título editorial */
  title:     string;
  highlight: string;   // palabra resaltada en azul
  lead:      string;   // párrafo corto
  /** Fase narrativa (para el eyebrow) */
  phase:     string;
}

export const STORY: StorySection[] = [
  {
    id: 'analisis',
    phase: '01 · Análisis',
    title: 'Cada señal se convierte en',
    highlight: 'comprensión.',
    lead:
      'Mientras el estudiante interactúa, Neuron lee cómo se expresa, cómo escribe y cómo progresa — y traduce esas señales en un perfil de aprendizaje vivo.',
  },
  {
    id: 'capacidades',
    phase: '02 · Competencias',
    title: 'Cinco saberes, una sola',
    highlight: 'red neuronal.',
    lead:
      'Pensamiento lógico-matemático, lectura crítica, inglés, competencias ciudadanas y pensamiento científico — conectados y analizados como una sola inteligencia.',
  },
  {
    id: 'pipeline',
    phase: '03 · Proceso',
    title: 'De los datos al',
    highlight: 'aprendizaje.',
    lead:
      'Un pipeline continuo transforma la información cruda en una experiencia que se adapta a cada estudiante, sesión a sesión.',
  },
  {
    id: 'chattutor',
    phase: '04 · NeuroTutor',
    title: 'Habla con una IA que',
    highlight: 'te conoce.',
    lead:
      'NeuroChat acompaña, responde y ajusta cada explicación al momento de duda real — como un tutor disponible 24/7.',
  },
  {
    id: 'plataforma',
    phase: '05 · Plataforma',
    title: 'Todo tu ecosistema',
    highlight: 'en un solo lugar.',
    lead:
      'Estudiantes y docentes viven la misma experiencia: dashboards claros, contenido inteligente y seguimiento preciso del progreso.',
  },
  {
    id: 'integracion',
    phase: '06 · Integración',
    title: 'Automatización que',
    highlight: 'se conecta contigo.',
    lead:
      'NeuroLearn se integra con tus herramientas y automatiza el flujo de trabajo para que tú te enfoques en enseñar.',
  },
];

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

// ── Platorm features (Sección estudiante / docente) ─────────
export interface PlatformCard {
  id:    string;
  icon:  string;          // clave lucide
  title: string;
  desc:  string;
  tag:   string;          // 'Estudiante' | 'Docente' | 'Institución'
}

export const PLATFORM_CARDS: PlatformCard[] = [
  {
    id: 'chat',        icon: 'MessageSquare',   tag: 'Estudiante',
    title: 'NeuroChat', desc: 'Tutor IA personalizado que te acompaña en cada tema y momento de duda.',
  },
  {
    id: 'desempeno',   icon: 'Activity',        tag: 'Estudiante',
    title: 'Desempeño', desc: 'Visualiza tu progreso, rachas y áreas de mejora en tiempo real.',
  },
  {
    id: 'tablero',     icon: 'LayoutDashboard', tag: 'Estudiante',
    title: 'Tablero adaptativo', desc: 'Un panel vivo que reorganiza tu ruta de aprendizaje según avanzas.',
  },
  {
    id: 'analitica',   icon: 'BarChart3',       tag: 'Docente',
    title: 'Analítica inteligente', desc: 'Seguimiento por estudiante con predicción de riesgo de error.',
  },
  {
    id: 'materiales',  icon: 'FileText',        tag: 'Docente',
    title: 'Materiales', desc: 'Crea, organiza y comparte contenidos potenciados por IA.',
  },
  {
    id: 'grupos',      icon: 'Users',           tag: 'Docente',
    title: 'Grupos y clases', desc: 'Gestiona aulas, notificaciones y comunicación sin fricción.',
  },
];

// ── Integración / automatización ─────────────────────────────
export interface Integration {
  id:    string;
  label: string;
  icon:  string;          // clave lucide
  kind:  string;          // 'Plataforma' | 'Automatización'
}

export const INTEGRATIONS: Integration[] = [
  { id: 'sso',         label: 'SSO / AAA',        icon: 'Fingerprint',   kind: 'Plataforma' },
  { id: 'lms',         label: 'LMS',              icon: 'PanelLeft',     kind: 'Plataforma' },
  { id: 'calendario',  label: 'Calendario',       icon: 'CalendarDays',  kind: 'Plataforma' },
  { id: 'webhook',     label: 'Webhooks',         icon: 'Webhook',       kind: 'Automatización' },
  { id: 'api',         label: 'API abierta',      icon: 'Code2',         kind: 'Automatización' },
  { id: 'reportes',    label: 'Reportes',         icon: 'FileBarChart',  kind: 'Automatización' },
];

// ── CTA final ────────────────────────────────────────────────
export const CTA_FINAL = {
  eyebrow:  'NeuroLearn',
  headline: 'El futuro del aprendizaje',
  highlight: 'comienza contigo.',
  subline:
    'Únete a la plataforma donde la inteligencia artificial entiende cómo aprende cada estudiante. Empieza gratis.',
  primary:  'Crear cuenta gratis',
  secondary:'Hablar con Neuron',
  footer:   'neurolearn · aprendizaje adaptativo · inteligencia artificial',
} as const;

// ── Footer ──────────────────────────────────────────────────
export const FOOTER_LINKS = {
  producto: ['Plataforma', 'NeuroChat', 'Analítica', 'Integraciones'],
  saberes:  ['Pensamiento lógico-matemático', 'Lectura crítica', 'Inglés', 'Competencias ciudadanas', 'Pensamiento científico'],
  empresa:  ['Sobre NeuroLearn', 'Contacto', 'Privacidad', 'Términos'],
} as const;

// ── Responsive ──────────────────────────────────────────────
export const RESPONSIVE = {
  mobileBreakpoint: 768,
  /** Override para reducir partículas/efectos en móvil */
  mobileParticles:  40,
  desktopParticles: 90,
} as const;