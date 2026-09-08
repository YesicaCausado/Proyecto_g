import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  BookOpen,
  Languages,
  Users,
  FlaskConical,
} from 'lucide-react';

/**
 * Competencias Saber 11 de NeuroLearn.
 * Fuente única de verdad para el menú del estudiante, el Neuro-Chat y los
 * quizzes. Elimina la duplicación de SKILLS/SUBJECTS que había en varias
 * páginas y garantiza coherencia entre navegación y contenido.
 *
 * `slug`  → segmento de ruta usado bajo /chat/:slug (p. ej. "logico-matematico").
 * `key`   → clave estable usada por backend/clasificación y por el dashboard.
 * `topic` → texto que se envía al tutor IA / quiz (el backend lo usa para
 *            contextualizar y para agrupar el desempeño por competencia).
 */
export interface Competency {
  slug: string;
  key: string;
  name: string;
  topic: string;
  desc: string;
  icon: LucideIcon;
  iconEmoji: string;
  color: string;      // hex de acento
  bg: string;         // clase tailwind de fondo del icono
  text: string;       // clase tailwind de texto/acento
  bar: string;        // gradiente de barras de progreso
  topics: string[];
}

export const COMPETENCIES: Competency[] = [
  {
    slug: 'logico-matematico',
    key: 'matematicas',
    name: 'Pensamiento Lógico-Matemático',
    topic: 'Razonamiento cuantitativo y matemáticas para Saber 11',
    desc: 'Razonamiento cuantitativo, álgebra, geometría, estadística y probabilidad',
    icon: Calculator,
    iconEmoji: '🧮',
    color: '#0B6E99',
    bg: 'bg-[#E5F3FF]',
    text: 'text-[#0B6E99]',
    bar: 'linear-gradient(90deg,#0B6E99,#095E85)',
    topics: ['Ecuaciones', 'Funciones', 'Geometría', 'Estadística', 'Probabilidad'],
  },
  {
    slug: 'lectura-critica',
    key: 'lectora',
    name: 'Lectura Crítica',
    topic: 'Comprensión lectora y lectura crítica para Saber 11',
    desc: 'Lectura crítica, análisis de textos, inferencia y argumentación',
    icon: BookOpen,
    iconEmoji: '📖',
    color: '#D9730D',
    bg: 'bg-[#FDF4EC]',
    text: 'text-[#D9730D]',
    bar: 'linear-gradient(90deg,#D9730D,#B8600B)',
    topics: ['Idea principal', 'Inferencias', 'Argumentación', 'Tipos de texto', 'Comunicación'],
  },
  {
    slug: 'ingles',
    key: 'ingles',
    name: 'Inglés Comunicativo',
    topic: 'Competencia comunicativa en inglés para Saber 11',
    desc: 'Gramática, vocabulario y comprensión de lectura en inglés',
    icon: Languages,
    iconEmoji: '🌎',
    color: '#0F7B6C',
    bg: 'bg-[#EEF7F4]',
    text: 'text-[#0F7B6C]',
    bar: 'linear-gradient(90deg,#0F7B6C,#0A6459)',
    topics: ['Present Simple', 'Past Simple', 'Reading', 'Vocabulary', 'Connectors'],
  },
  {
    slug: 'ciudadanas',
    key: 'ciudadanas',
    name: 'Competencias Ciudadanas',
    topic: 'Competencias ciudadanas y sociales para Saber 11',
    desc: 'Constitución, derechos, democracia, convivencia y pensamiento social crítico',
    icon: Users,
    iconEmoji: '🏛️',
    color: '#6940A5',
    bg: 'bg-[#F7F3FB]',
    text: 'text-[#6940A5]',
    bar: 'linear-gradient(90deg,#6940A5,#5A358F)',
    topics: ['Constitución', 'Derechos', 'Participación', 'Convivencia', 'Democracia'],
  },
  {
    slug: 'cientifico',
    key: 'cientifico',
    name: 'Pensamiento Científico',
    topic: 'Pensamiento científico y ciencias naturales para Saber 11',
    desc: 'Método científico, biología, química, física y ecología',
    icon: FlaskConical,
    iconEmoji: '🔬',
    color: '#0F7B6C',
    bg: 'bg-[#E5F3FF]',
    text: 'text-[#0F7B6C]',
    bar: 'linear-gradient(90deg,#0B6E99,#0EA5A4)',
    topics: ['Método científico', 'Biología', 'Química', 'Física', 'Ecología'],
  },
];

/** Busca una competencia por slug de ruta o por clave estable. */
export function findCompetency(value?: string | null): Competency | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim();
  return COMPETENCIAS.find(
    (c) => c.slug === v || c.key === v || c.name.toLowerCase() === v,
  );
}