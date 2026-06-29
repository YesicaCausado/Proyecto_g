import { useState } from 'react';
import {
  FileText, Download, Eye, Search,
  BookOpen, Calculator, MessageSquare,
  Users, Zap, Filter, Layers,
  ExternalLink, BookMarked, GraduationCap, Globe,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type SubjectKey = 'todos' | 'lectura' | 'matematicas' | 'ciencias' | 'sociales' | 'ingles' | 'general';
type MaterialType = 'simulacro' | 'guia' | 'cuaderno';
type ExternalType = 'web' | 'plataforma' | 'video';

interface Material {
  id: string;
  title: string;
  description: string;
  subject: SubjectKey;
  type: MaterialType;
  pages: number;
  file: string;          // ruta relativa en /material/
  year?: string;
  difficulty?: 'Fácil' | 'Medio' | 'Difícil';
  recommended?: boolean;
}

interface ExternalResource {
  id: string;
  title: string;
  description: string;
  subject: SubjectKey;
  type: ExternalType;
  source: string;
  url: string;
  recommended?: boolean;
}

// ─── Catálogo de materiales ───────────────────────────────────────────────────
const MATERIALS: Material[] = [
  {
    id: '12',
    title: 'Simulacro Saber 11 — Guía Visual Serie 1',
    description: 'Cuadernillo oficial con preguntas de todas las áreas del Saber 11. Diseño visual estructurado para repasar todos los componentes de la prueba.',
    subject: 'general',
    type: 'simulacro',
    pages: 32,
    file: '/material/12.pdf',
    year: '2026',
    difficulty: 'Medio',
    recommended: true,
  },
  {
    id: '2',
    title: 'Cuaderno Saber 11 — Serie 1, Cuadernillo 1',
    description: 'Primer cuadernillo oficial Saber 11 con preguntas de Lectura Crítica y Comunicación. Incluye textos continuos y discontinuos de niveles literal, inferencial y crítico.',
    subject: 'lectura',
    type: 'cuaderno',
    pages: 32,
    file: '/material/2.pdf',
    year: '2025',
    difficulty: 'Medio',
    recommended: true,
  },
  {
    id: '1',
    title: 'Cuaderno Saber 11 — Serie 1, Cuadernillo 2',
    description: 'Segundo cuadernillo oficial de la Serie 1. Comprensión lectora con énfasis en textos argumentativos y análisis crítico del discurso.',
    subject: 'lectura',
    type: 'cuaderno',
    pages: 32,
    file: '/material/1.pdf',
    year: '2025',
    difficulty: 'Difícil',
  },
  {
    id: '3',
    title: 'Guía de Competencias Generales — Saber 11',
    description: 'Material de preparación elaborado por docentes expertos. Cubre Matemáticas, Ciencias Naturales, Sociales y Ciudadanas con ejercicios resueltos y teoría.',
    subject: 'general',
    type: 'guia',
    pages: 32,
    file: '/material/3.pdf',
    year: '2025',
    difficulty: 'Medio',
  },
  {
    id: '4',
    title: 'Práctica Integrada Saber 11',
    description: 'Banco de preguntas de práctica con 100 ítems distribuidos en todas las áreas del Saber 11. Ideal para simulacros cronometrados.',
    subject: 'general',
    type: 'simulacro',
    pages: 100,
    file: '/material/4.pdf',
    year: '2025',
    difficulty: 'Difícil',
    recommended: true,
  },
  {
    id: '5',
    title: 'Material Complementario — Todas las Áreas',
    description: 'Documento de repaso integral con resúmenes temáticos, fórmulas clave y ejemplos resueltos. Perfecto para repasar antes del examen.',
    subject: 'general',
    type: 'guia',
    pages: 40,
    file: '/material/5.pdf',
    year: '2025',
    difficulty: 'Fácil',
  },
];

// ─── Recursos en línea ────────────────────────────────────────────────────────
const EXTERNAL_RESOURCES: ExternalResource[] = [
  {
    id: 'icfes-guias',
    title: 'Guías de Orientación ICFES 2024',
    description: 'Guías oficiales del ICFES con la estructura del examen Saber 11, número de preguntas, módulos y tiempos. Ediciones 2024 disponibles para descarga.',
    subject: 'general',
    type: 'web',
    source: 'ICFES Oficial',
    url: 'https://www.icfes.gov.co/guias-de-orientacion',
    recommended: true,
  },
  {
    id: 'icfes-evaluaciones',
    title: 'Portal de Evaluaciones ICFES',
    description: 'Información oficial sobre el Saber 11: fechas de inscripción, resultados, calendario académico y todo lo relacionado con la prueba de estado.',
    subject: 'general',
    type: 'plataforma',
    source: 'ICFES Oficial',
    url: 'https://www.icfes.gov.co/evaluaciones-icfes/',
    recommended: true,
  },
  {
    id: 'khan-algebra',
    title: 'Khan Academy — Álgebra y Matemáticas',
    description: 'Videos y ejercicios interactivos de álgebra, geometría, estadística y trigonometría. Cobertura completa de los temas evaluados en Saber 11 Matemáticas.',
    subject: 'matematicas',
    type: 'plataforma',
    source: 'Khan Academy',
    url: 'https://es.khanacademy.org/math/algebra',
    recommended: true,
  },
  {
    id: 'khan-ciencias',
    title: 'Khan Academy — Ciencias Naturales',
    description: 'Biología, química y física con videos explicativos, animaciones y práctica interactiva. Ideal para reforzar los módulos de Ciencias del Saber 11.',
    subject: 'ciencias',
    type: 'plataforma',
    source: 'Khan Academy',
    url: 'https://es.khanacademy.org/science',
  },
  {
    id: 'khan-lectura',
    title: 'Khan Academy — Gramática y Comprensión',
    description: 'Comprensión lectora, gramática española y análisis de textos argumentativos. Fortalece las competencias de Lectura Crítica evaluadas en el Saber 11.',
    subject: 'lectura',
    type: 'plataforma',
    source: 'Khan Academy',
    url: 'https://es.khanacademy.org/humanities/grammar',
  },
  {
    id: 'khan-ingles',
    title: 'Khan Academy — Inglés y Grammar',
    description: 'Gramática inglesa, vocabulario y comprensión de lectura en inglés. Cubre los niveles A1–B+ requeridos en la prueba de Inglés del Saber 11.',
    subject: 'ingles',
    type: 'plataforma',
    source: 'Khan Academy',
    url: 'https://es.khanacademy.org/humanities/grammar',
  },
  {
    id: 'colombia-aprende',
    title: 'Colombia Aprende — Portal Educativo MEN',
    description: 'Portal oficial del Ministerio de Educación con recursos educativos, videos de clase, guías docentes y contenidos alineados al currículo colombiano de bachillerato.',
    subject: 'general',
    type: 'web',
    source: 'Min. Educación',
    url: 'https://contenidos.ia.colombiaaprende.edu.co/educativo',
  },
  {
    id: 'khan-estadistica',
    title: 'Khan Academy — Estadística y Probabilidad',
    description: 'Módulo completo de estadística descriptiva, probabilidad e interpretación de datos. Contenido clave para Matemáticas y Ciencias Sociales en Saber 11.',
    subject: 'matematicas',
    type: 'plataforma',
    source: 'Khan Academy',
    url: 'https://es.khanacademy.org/math/statistics-probability',
  },
  {
    id: 'khan-ciencias-sociales',
    title: 'Khan Academy — Historia y Geografía',
    description: 'Historia mundial, economía, geografía y democracia. Refuerza los conceptos de Ciencias Sociales y Ciudadanas evaluados en el Saber 11.',
    subject: 'sociales',
    type: 'plataforma',
    source: 'Khan Academy',
    url: 'https://es.khanacademy.org/humanities',
  },
  {
    id: 'icfes-simulacros-guia',
    title: 'ICFES — Guías 2024-1 Saber 11',
    description: 'Página directa con las guías de orientación Saber 11 edición 2024-1. Descarga el documento PDF oficial con la estructura, tipos de preguntas y ejemplos.',
    subject: 'general',
    type: 'web',
    source: 'ICFES Oficial',
    url: 'https://www.icfes.gov.co/publicaciones-icfes/guias-de-orientacion/2024-2/',
  },
];

// ─── Estilos por materia ──────────────────────────────────────────────────────
const SUBJECT_STYLES: Record<SubjectKey, { label: string; Icon: React.ElementType; color: string; bg: string; text: string; badge: string }> = {
  todos:       { label: 'Todos',          Icon: Layers,       color: '#64748b', bg: 'bg-gray-100',    text: 'text-gray-600',    badge: 'bg-gray-100 text-gray-600'    },
  lectura:     { label: 'Lectura Crítica',Icon: BookOpen,     color: '#f59e0b', bg: 'bg-amber-50',    text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'  },
  matematicas: { label: 'Matemáticas',    Icon: Calculator,   color: '#2563EB', bg: 'bg-blue-50',     text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'    },
  ciencias:    { label: 'Ciencias',       Icon: Zap,          color: '#06b6d4', bg: 'bg-cyan-50',     text: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700'    },
  sociales:    { label: 'Sociales',       Icon: Users,        color: '#8b5cf6', bg: 'bg-violet-50',   text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700'},
  ingles:      { label: 'Inglés',         Icon: MessageSquare,color: '#10b981', bg: 'bg-emerald-50',  text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
  general:     { label: 'General',        Icon: GraduationCap,color: '#2563EB', bg: 'bg-indigo-50',   text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700'},
};

const TYPE_LABELS: Record<MaterialType, string> = {
  simulacro: 'Simulacro',
  guia:      'Guía',
  cuaderno:  'Cuadernillo',
};

const EXT_TYPE_LABELS: Record<ExternalType, string> = {
  web:        'Sitio Web',
  plataforma: 'Plataforma',
  video:      'Videos',
};

const DIFF_COLORS: Record<string, string> = {
  'Fácil':   'bg-emerald-50 text-emerald-700',
  'Medio':   'bg-amber-50 text-amber-700',
  'Difícil': 'bg-red-50 text-red-600',
};

const FILTER_TABS: { key: SubjectKey; label: string; Icon: React.ElementType }[] = [
  { key: 'todos',       label: 'Todos',          Icon: Layers        },
  { key: 'general',     label: 'General',        Icon: GraduationCap },
  { key: 'lectura',     label: 'Lectura',        Icon: BookOpen      },
  { key: 'matematicas', label: 'Matemáticas',    Icon: Calculator    },
  { key: 'ciencias',    label: 'Ciencias',       Icon: Zap           },
  { key: 'sociales',    label: 'Sociales',       Icon: Users         },
  { key: 'ingles',      label: 'Inglés',         Icon: MessageSquare },
];

// ─── Visor modal ──────────────────────────────────────────────────────────────
function PDFViewer({ material, onClose }: { material: Material; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-[#E0E0E0] rounded-md w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-[#707070]" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[#2F3437] text-sm truncate">{material.title}</p>
              <p className="text-[11px] text-[#9B9B9B]">{material.pages} páginas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <a href={material.file} download
              className="flex items-center gap-1.5 bg-[#2F3437] hover:bg-[#454A4D] text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
              <Download className="w-3.5 h-3.5" /> Descargar
            </a>
            <a href={material.file} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#F7F6F3] hover:bg-[#E8E6E1] border border-[#E0E0E0] text-[#707070] text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir
            </a>
            <button onClick={onClose}
              className="w-7 h-7 rounded-md text-[#9B9B9B] hover:text-[#2F3437] hover:bg-[#F7F6F3] flex items-center justify-center transition-colors text-lg font-bold border border-[#E0E0E0]">
              ×
            </button>
          </div>
        </div>
        {/* PDF embed */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={`${material.file}#toolbar=1&navpanes=1`}
            title={material.title}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de recurso en línea ──────────────────────────────────────────────
function ExternalResourceCard({ r }: { r: ExternalResource }) {
  const style = SUBJECT_STYLES[r.subject];
  const Icon  = style.Icon;
  return (
    <div className="bg-white border border-[#E0E0E0] rounded-md overflow-hidden flex flex-col group hover:border-[#9B9B9B] transition-colors">
      <div className="p-5 flex flex-col flex-1">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-[#707070]" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-2">
            {r.recommended && (
              <span className="bg-[#F7F6F3] text-[#707070] text-[10px] font-medium px-2 py-0.5 rounded-md border border-[#E0E0E0]">
                ⭐ Recomendado
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#F7F6F3] border border-[#E0E0E0] text-[#707070]">
              {SUBJECT_STYLES[r.subject].label}
            </span>
          </div>
        </div>
        {/* Title + description */}
        <h3 className="font-medium text-[#2F3437] text-sm leading-snug mb-2">
          {r.title}
        </h3>
        <p className="text-[#9B9B9B] text-xs leading-relaxed flex-1 mb-4">{r.description}</p>
        {/* Meta */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="flex items-center gap-1 text-[11px] text-[#9B9B9B]">
            <Globe className="w-3.5 h-3.5" /> {EXT_TYPE_LABELS[r.type]}
          </span>
          <span className="text-[#D5D5D5]">·</span>
          <span className="text-[11px] text-[#9B9B9B]">{r.source}</span>
        </div>
        {/* Action */}
        <div className="flex gap-2 mt-auto">
          <a href={r.url} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-[#2F3437] hover:bg-[#454A4D] text-white text-sm font-medium py-2.5 rounded-md transition-colors">
            <Globe className="w-4 h-4" /> Abrir
          </a>
          <a href={r.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#F7F6F3] hover:bg-[#E8E6E1] border border-[#E0E0E0] text-[#707070] text-sm font-medium py-2.5 px-3 rounded-md transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de material ──────────────────────────────────────────────────────
function MaterialCard({ m, onView }: { m: Material; onView: (m: Material) => void }) {
  const style = SUBJECT_STYLES[m.subject];
  const Icon  = style.Icon;
  return (
    <div className="bg-white border border-[#E0E0E0] rounded-md overflow-hidden flex flex-col group hover:border-[#9B9B9B] transition-colors">
      <div className="p-5 flex flex-col flex-1">
        {/* Top: icon + badges */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-[#707070]" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-2">
            {m.recommended && (
              <span className="bg-[#F7F6F3] text-[#707070] text-[10px] font-medium px-2 py-0.5 rounded-md border border-[#E0E0E0]">
                ⭐ Recomendado
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#F7F6F3] border border-[#E0E0E0] text-[#707070]">
              {SUBJECT_STYLES[m.subject].label}
            </span>
          </div>
        </div>

        {/* Title + description */}
        <h3 className="font-medium text-[#2F3437] text-sm leading-snug mb-2">
          {m.title}
        </h3>
        <p className="text-[#9B9B9B] text-xs leading-relaxed flex-1 mb-4">
          {m.description}
        </p>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="flex items-center gap-1 text-[11px] text-[#9B9B9B]">
            <FileText className="w-3.5 h-3.5" /> {m.pages} págs.
          </span>
          <span className="text-[#D5D5D5]">·</span>
          <span className="flex items-center gap-1 text-[11px] text-[#9B9B9B]">
            <BookMarked className="w-3.5 h-3.5" /> {TYPE_LABELS[m.type]}
          </span>
          {m.year && (
            <>
              <span className="text-[#D5D5D5]">·</span>
              <span className="text-[11px] text-[#9B9B9B]">{m.year}</span>
            </>
          )}
          {m.difficulty && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${DIFF_COLORS[m.difficulty]}`}>
              {m.difficulty}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button onClick={() => onView(m)}
            className="flex-1 flex items-center justify-center gap-2 bg-[#2F3437] hover:bg-[#454A4D] text-white text-sm font-medium py-2.5 rounded-md transition-colors">
            <Eye className="w-4 h-4" /> Ver
          </button>
          <a href={m.file} download
            className="flex items-center justify-center gap-2 bg-[#F7F6F3] hover:bg-[#E8E6E1] border border-[#E0E0E0] text-[#707070] text-sm py-2.5 px-4 rounded-md transition-colors">
            <Download className="w-4 h-4" />
          </a>
          <a href={m.file} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#F7F6F3] hover:bg-[#E8E6E1] border border-[#E0E0E0] text-[#707070] text-sm py-2.5 px-3 rounded-md transition-colors">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function MaterialPage() {
  const [activeTab, setActiveTab] = useState<SubjectKey>('todos');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Material | null>(null);

  const filtered = MATERIALS.filter(m => {
    const matchTab    = activeTab === 'todos' || m.subject === activeTab;
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase())
      || m.description.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const filteredExternal = EXTERNAL_RESOURCES.filter(r => {
    const matchTab    = activeTab === 'todos' || r.subject === activeTab;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase())
      || r.description.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const recommended = MATERIALS.filter(m => m.recommended);

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <div className="pb-6 mb-6 border-b border-[#E0E0E0]">
        <h1 className="text-xl font-semibold text-[#2F3437] flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-[#707070]" />
          </div>
          Material de Estudio
        </h1>
        <p className="text-[#707070] mt-1 text-sm">Documentos oficiales y guías para prepararte al Saber 11</p>
      </div>

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Documentos PDF',        value: String(MATERIALS.length),                                        icon: FileText,      },
          { label: 'Simulacros',            value: String(MATERIALS.filter(m => m.type === 'simulacro').length),    icon: GraduationCap, },
          { label: 'Guías y Cuadernillos',  value: String(MATERIALS.filter(m => m.type !== 'simulacro').length),   icon: BookOpen,      },
          { label: 'Recursos en Línea',     value: String(EXTERNAL_RESOURCES.length),                              icon: Globe,         },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white border border-[#E0E0E0] rounded-md p-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#9B9B9B]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[#2F3437]">{s.value}</p>
                <p className="text-xs text-[#9B9B9B]">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Recomendados ── */}
      {recommended.length > 0 && (
        <div className="bg-[#F7F6F3] border border-[#E0E0E0] rounded-md p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">⭐</span>
            <h2 className="font-semibold text-[#2F3437] text-sm">Documentos Recomendados</h2>
            <span className="text-xs text-[#707070] font-medium bg-white border border-[#E0E0E0] px-2.5 py-1 rounded-md ml-1">
              Empieza por aquí
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recommended.map(m => {
              const style = SUBJECT_STYLES[m.subject];
              const Icon  = style.Icon;
              return (
                <div key={m.id}
                  className="flex-shrink-0 w-60 bg-white border border-[#E0E0E0] rounded-md p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[#707070]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#2F3437] text-xs leading-tight truncate">{m.title}</p>
                      <p className="text-[11px] text-[#9B9B9B]">{m.pages} páginas · {TYPE_LABELS[m.type]}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewing(m)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#2F3437] hover:bg-[#454A4D] text-white text-xs font-medium py-2 rounded-md transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </button>
                    <a href={m.file} download
                      className="flex items-center justify-center gap-1.5 bg-[#F7F6F3] hover:bg-[#E8E6E1] border border-[#E0E0E0] text-[#707070] text-xs py-2 px-3 rounded-md transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9B9B]" />
          <input
            type="text"
            placeholder="Buscar materiales..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E0E0E0] rounded-md text-sm focus:outline-none focus:border-[#2F3437] focus:ring-1 focus:ring-[#2F3437] transition-all text-[#2F3437]"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-[#9B9B9B]">
          <Filter className="w-4 h-4" />
          <span>{filtered.length} PDFs · {filteredExternal.length} en línea</span>
        </div>
      </div>

      {/* ── Subject filter tabs ── */}
      <div className="flex flex-wrap gap-1.5 mb-5 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md p-1">
        {FILTER_TABS.map(t => {
          const Icon = t.Icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-white text-[#2F3437] border border-[#E0E0E0]'
                  : 'text-[#707070] hover:text-[#2F3437]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Grid de materiales ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-[#9B9B9B]" />
          </div>
          <p className="text-sm font-medium text-[#707070]">No se encontraron materiales</p>
          <p className="text-xs text-[#9B9B9B] mt-1">Intenta otra búsqueda o categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <MaterialCard key={m.id} m={m} onView={setViewing} />
          ))}
        </div>
      )}

      {/* ── Recursos en línea ── */}
      {filteredExternal.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-[#707070]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#2F3437] text-sm">Recursos en Línea</h2>
              <p className="text-xs text-[#9B9B9B]">Plataformas y portales oficiales</p>
            </div>
            <span className="ml-auto text-xs text-[#707070] font-medium bg-[#F7F6F3] border border-[#E0E0E0] px-3 py-1 rounded-md">
              {filteredExternal.length} recursos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExternal.map(r => (
              <ExternalResourceCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}

      {/* ── PDF Viewer modal ── */}
      {viewing && <PDFViewer material={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
