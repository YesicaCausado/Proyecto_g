import { useState } from 'react';
import {
  Sparkles, Brain, FileText, ListChecks, BookOpen, SlidersHorizontal,
  Loader2, Copy, Check, Cpu, CircleAlert, ClipboardList,
} from 'lucide-react';
import api from '../../../services/api';

type Kind = 'plan_clase' | 'preguntas' | 'guia' | 'rubrica';

const KIND_META: { id: Kind; label: string; icon: any; desc: string }[] = [
  { id: 'plan_clase', label: 'Plan de clase', icon: ClipboardList, desc: 'Objetivos, momentos y evaluación' },
  { id: 'preguntas', label: 'Preguntas de evaluación', icon: ListChecks, desc: 'Banco de preguntas de opción múltiple' },
  { id: 'guia', label: 'Guía de estudio', icon: BookOpen, desc: 'Conceptos, actividades y reflexión' },
  { id: 'rubrica', label: 'Rúbrica de evaluación', icon: SlidersHorizontal, desc: 'Criterios y niveles de desempeño' },
];

const GRADES = ['1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°', '11°'];

interface GenResult {
  content: any;
  provider: string;
  ai_used: boolean;
  kind: Kind;
  topic: string;
}

export default function IAGenerativaTab() {
  const [kind, setKind] = useState<Kind>('plan_clase');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('10°');
  const [subject, setSubject] = useState('');
  const [count, setCount] = useState(5);
  const [extra, setExtra] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) { setError('Escribe el tema a generar.'); return; }
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const r = await api.post('/teacher/ai/generate', {
        kind, topic: topic.trim(), level, subject: subject || null, count, extra: extra || null,
      });
      setResult({ content: r.data.content, provider: r.data.provider, ai_used: r.data.ai_used, kind: r.data.kind, topic: r.data.topic });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo generar el contenido. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.content, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const providerLabel = result?.provider === 'local' ? 'Local (sin IA configurada)' : `IA · ${result?.provider ?? ''}`;
  const providerStyle = result?.provider === 'local' ? 'bg-[#F7F6F3] text-[#AEADAB] border-[#E9E9E7]' : 'bg-[#EEF3FD] text-[#2E6FDB] border-[#C5D9F7]';

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-[#6940A5]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#191919]">IA Generativa</h2>
          <p className="text-sm text-[#787774]">Crea planes de clase, preguntas, guías y rúbricas con inteligencia artificial.</p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleGenerate} className="bg-white border border-[#E9E9E7] rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#787774] mb-2">Tipo de contenido</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {KIND_META.map(k => {
              const Icon = k.icon;
              const active = kind === k.id;
              return (
                <button key={k.id} type="button" onClick={() => setKind(k.id)}
                  className={`text-left rounded-lg border p-3 transition-all ${active ? 'border-[#2E6FDB] bg-[#EEF3FD] ring-1 ring-[#2E6FDB]/30' : 'border-[#E9E9E7] bg-white hover:border-[#9B9A97]'}`}>
                  <Icon className={`w-5 h-5 mb-2 ${active ? 'text-[#2E6FDB]' : 'text-[#9B9A97]'}`} />
                  <p className="text-xs font-semibold text-[#191919] leading-tight">{k.label}</p>
                  <p className="text-[10px] text-[#AEADAB] mt-0.5 leading-tight">{k.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#787774] mb-1">Tema *</label>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="Ej: Ecuaciones cuadráticas, Revolución Francesa…"
              className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#787774] mb-1">Grado/Nivel</label>
              <select value={level} onChange={e => setLevel(e.target.value)}
                className="w-full p-2 border border-[#E9E9E7] rounded bg-white text-sm">
                {GRADES.map(g => <option key={g} value={g}>{g} grado</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#787774] mb-1">N° ítems</label>
              <select value={count} onChange={e => setCount(Number(e.target.value))}
                className="w-full p-2 border border-[#E9E9E7] rounded bg-white text-sm">
                {[3, 5, 8, 10, 12].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#787774] mb-1">Asignatura (opcional)</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Matemáticas, Ciencias Sociales…"
              className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#787774] mb-1">Contexto adicional (opcional)</label>
            <input type="text" value={extra} onChange={e => setExtra(e.target.value)}
              placeholder="Ej: incluir casos del contexto colombiano"
              className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm" />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm flex items-center gap-2">
            <CircleAlert className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#6940A5] text-white text-sm font-medium rounded-lg hover:bg-[#5A358F] transition-all shadow-md disabled:opacity-50">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando con IA…</> : <><Sparkles className="w-4 h-4" /> Generar contenido</>}
          </button>
        </div>
      </form>

      {/* Resultado */}
      {result && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/40">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#787774]" />
              <span className="text-sm font-semibold text-[#191919]">
                {KIND_META.find(k => k.id === result.kind)?.label} — {result.topic}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${providerStyle}`}>
                {result.provider === 'local' ? <CircleAlert className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
                {providerLabel}
              </span>
            </div>
            <button onClick={copyResult}
              className="text-xs text-[#787774] hover:text-[#191919] flex items-center gap-1 px-2 py-1 rounded hover:bg-white border border-transparent hover:border-[#E9E9E7]">
              {copied ? <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="p-6">
            <ContentRenderer content={result.content} kind={result.kind} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Render especializado por tipo de contenido ────────────────────────────────

function ContentRenderer({ content, kind }: { content: any; kind: Kind }) {
  if (!content) return <p className="text-sm text-[#AEADAB]">Sin contenido generado.</p>;

  if (kind === 'preguntas' && Array.isArray(content?.questions)) {
    return <QuestionsList questions={content.questions} />;
  }
  if (kind === 'preguntas' && Array.isArray(content)) {
    return <QuestionsList questions={content} />;
  }

  if (kind === 'plan_clase') {
    return (
      <div className="space-y-4 text-sm text-[#37352F]">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-[#EEF3FD] text-[#2E6FDB] font-medium">Duración: {content.duracion_minutos || 60} min</span>
          <span className="px-2 py-0.5 rounded-full bg-[#F7F6F3] text-[#787774] font-medium">Grado: {content.grado || '—'}</span>
        </div>
        <Section title="Objetivos">
          {(content.objetivos || []).map((o: string, i: number) => <Li key={i}>{o}</Li>)}
        </Section>
        <Section title="Indicadores de desempeño">
          {(content.indicadores_desempeno || []).map((o: string, i: number) => <Li key={i}>{o}</Li>)}
        </Section>
        <Section title="Momentos">
          {(content.momentos || []).map((m: any, i: number) => (
            <div key={i} className="border-l-2 border-[#2E6FDB] pl-3 py-1">
              <p className="font-semibold text-[#2E6FDB]">{m.nombre} <span className="font-normal text-[#AEADAB]">· {m.duracion_min} min</span></p>
              <p className="text-[#787774]">{m.detalle}</p>
            </div>
          ))}
        </Section>
        <Section title="Recursos">
          <div className="flex flex-wrap gap-2">
            {(content.recursos || []).map((r: string, i: number) => (
              <span key={i} className="px-2 py-1 rounded-lg bg-[#F7F6F3] border border-[#E9E9E7] text-xs">{r}</span>
            ))}
          </div>
        </Section>
        <Section title="Evaluación"><p className="text-[#787774]">{content.evaluacion}</p></Section>
        <Section title="Cierre"><p className="text-[#787774]">{content.cierre}</p></Section>
      </div>
    );
  }

  if (kind === 'guia') {
    return (
      <div className="space-y-4 text-sm text-[#37352F]">
        <Section title="Conceptos clave">
          <div className="flex flex-wrap gap-2">
            {(content.conceptos_clave || []).map((c: string, i: number) => (
              <span key={i} className="px-2 py-1 rounded-lg bg-[#EEF3FD] text-[#2E6FDB] text-xs font-medium">{c}</span>
            ))}
          </div>
        </Section>
        <Section title="Resumen"><p className="text-[#787774]">{content.resumen}</p></Section>
        <Section title="Actividades">
          {(content.actividades || []).map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#6940A5] text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="font-medium">{a.titulo} <span className="text-[10px] text-[#AEADAB] uppercase">· {a.tipo}</span></p>
                <p className="text-[#787774]">{a.descripcion}</p>
              </div>
            </div>
          ))}
        </Section>
        <Section title="Preguntas de reflexión">
          {(content.preguntas_reflexion || []).map((p: string, i: number) => <Li key={i}>{p}</Li>)}
        </Section>
        <Section title="Recomendaciones">
          {(content.recomendaciones || []).map((p: string, i: number) => <Li key={i}>{p}</Li>)}
        </Section>
      </div>
    );
  }

  if (kind === 'rubrica') {
    return (
      <div className="space-y-3 text-sm">
        {(content.criterios || []).map((c: any, i: number) => (
          <div key={i} className="border border-[#E9E9E7] rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-[#F7F6F3] border-b border-[#E9E9E7]">
              <p className="font-semibold text-[#191919]">{c.criterio}</p>
              <p className="text-xs text-[#787774]">{c.descripcion}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E9E9E7]">
              {(c.niveles || []).slice(0, 4).map((n: string, j: number) => {
                const levels = ['[D]', '[C]', '[B]', '[A]'];
                return (
                  <div key={j} className="px-3 py-2 text-xs">
                    <span className="font-bold text-[#6940A5]">{levels[Math.min(j, 3)]}</span>
                    <p className="text-[#787774] mt-0.5">{n}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback genérico
  return <pre className="whitespace-pre-wrap text-sm text-[#37352F] bg-[#F7F6F3] p-4 rounded-lg">{JSON.stringify(content, null, 2)}</pre>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#AEADAB] mb-1.5">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[#37352F]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2E6FDB] mt-1.5 flex-shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function QuestionsList({ questions }: { questions: any[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {questions.map((q: any, i: number) => (
        <div key={i} className="border border-[#E9E9E7] rounded-lg overflow-hidden">
          <button type="button" onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F7F6F3] transition-colors">
            <span className="text-sm font-medium text-[#37352F]">{q.text}</span>
            <span className="text-xs font-bold text-[#AEADAB]">{q.points ?? 2} pt</span>
          </button>
          {open === i && (
            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(q.options || []).map((opt: string, j: number) => {
                const isCorrect = opt === q.correct;
                return (
                  <div key={j} className={`px-3 py-1.5 rounded-lg text-xs border ${isCorrect ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'border-[#E9E9E7] text-[#787774]'}`}>
                    {String.fromCharCode(65 + j)}. {opt}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}