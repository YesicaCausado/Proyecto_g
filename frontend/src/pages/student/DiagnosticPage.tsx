import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle, XCircle, Loader2, AlertCircle, ClipboardList, Send, ChevronDown,
} from 'lucide-react';
import api, { invalidateApiCache } from '../../services/api';
import { findCompetency, type Competency } from '../../data/competencies';
import { apiError } from '../../components/evaluations/shared';
import NeuronAvatar from '../../components/NeuronAvatar';

type Difficulty = 'basico' | 'intermedio' | 'avanzado';

interface DiagnosticQuestion {
  id: string;
  topic: string;
  difficulty: Difficulty;
  context: string | null;
  text: string;
  options: string[];
}

interface ReviewItem extends DiagnosticQuestion {
  chosen: number | null;
  correct: number;
  is_correct: boolean;
  explanation: string;
}

interface DiagnosticResult {
  level: number;
  label: string;
  description: string;
  score: number;
  correct_count: number;
  total_questions: number;
  topic_results: { topic: string; correct: number; total: number }[];
  weak_topics: string[];
  tutor_feedback: string | null;
  feedback_provider: string | null;
  completed_at: string | null;
}

interface StatusItem {
  key: string;
  name: string;
  total_questions: number;
  completed: boolean;
  result: DiagnosticResult | null;
}

interface Detail {
  key: string;
  name: string;
  completed: boolean;
  questions?: DiagnosticQuestion[];
  result?: DiagnosticResult;
  review?: ReviewItem[];
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado',
};

// Colores por nivel de desempeño (1 Insuficiente … 4 Avanzado).
const LEVEL_STYLE: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-[#FDEEEE]', text: 'text-[#C4554D]', border: 'border-[#F4BDBD]' },
  2: { bg: 'bg-[#FDF4EC]', text: 'text-[#D9730D]', border: 'border-[#F5D5B5]' },
  3: { bg: 'bg-[#E5F3FF]', text: 'text-[#0B6E99]', border: 'border-[#B6DAF2]' },
  4: { bg: 'bg-[#EEF7F4]', text: 'text-[#0F7B6C]', border: 'border-[#B7DDD5]' },
};

const LETTERS = ['A', 'B', 'C', 'D'];

export default function DiagnosticPage() {
  const { slug } = useParams();
  const competency = findCompetency(slug);
  if (slug && !competency) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <BackLink />
        <p className="mt-4 text-sm text-[#787774]">Esa competencia no existe.</p>
      </div>
    );
  }
  // key: al cambiar de competencia se reinicia el estado (preguntas, respuestas).
  return competency ? <CompetencyDiagnostic key={competency.key} competency={competency} /> : <DiagnosticOverview />;
}

function BackLink() {
  return (
    <Link to="/diagnostic" className="inline-flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F]">
      <ArrowLeft className="w-4 h-4" /> Diagnóstico inicial
    </Link>
  );
}

function LevelBadge({ result }: { result: Pick<DiagnosticResult, 'level' | 'label'> }) {
  const s = LEVEL_STYLE[result.level] ?? LEVEL_STYLE[1];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}>
      Nivel {result.level} · {result.label}
    </span>
  );
}

// ── Vista general: las cinco competencias ────────────────────────────────────

function DiagnosticOverview() {
  const [items, setItems] = useState<StatusItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    invalidateApiCache('/student/diagnostic');
    api.get('/student/diagnostic')
      .then((res) => setItems(res.data.competencies ?? []))
      .catch((err) => setError(apiError(err, 'No se pudo cargar el diagnóstico.')));
  }, []);

  const done = items?.filter((i) => i.completed).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#191919]">Diagnóstico inicial</h1>
        <p className="text-sm text-[#787774]">
          Responde 10 preguntas por competencia para conocer tu nivel de partida. El tutor usará el
          resultado para adaptar las explicaciones. Cada diagnóstico se presenta una sola vez.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#FDEEEE] border border-[#F4BDBD] text-sm text-[#37352F]">
          <AlertCircle className="w-4 h-4 text-[#C4554D]" /> {error}
        </div>
      )}

      {!items && !error && (
        <div className="flex items-center gap-2 text-sm text-[#9B9A97]"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
      )}

      {items && (
        <>
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#37352F] font-medium">Progreso</span>
              <span className="text-[#787774]">{done} de {items.length} competencias</span>
            </div>
            <div className="h-2 bg-[#F1F1EF] rounded-full overflow-hidden">
              <div className="h-full bg-[#0B6E99] transition-all" style={{ width: `${(done / Math.max(items.length, 1)) * 100}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => {
              const comp = findCompetency(item.key);
              if (!comp) return null;
              const Icon = comp.icon;
              return (
                <Link
                  key={item.key}
                  to={`/diagnostic/${comp.slug}`}
                  className="group bg-white border border-[#E9E9E7] rounded-lg p-4 hover:border-[#0B6E99]/40 hover:shadow-sm transition"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${comp.bg} ${comp.text}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-[#191919]">{comp.name}</h2>
                      <p className="text-xs text-[#9B9A97] mt-0.5">{item.total_questions} preguntas</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {item.result ? (
                          <>
                            <LevelBadge result={item.result} />
                            <span className="text-xs text-[#787774]">{item.result.correct_count}/{item.result.total_questions} correctas</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-[#787774]">Pendiente</span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B6E99]">
                              Empezar <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Una competencia: presentar o ver resultado ───────────────────────────────

function CompetencyDiagnostic({ competency }: { competency: Competency }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    invalidateApiCache('/student/diagnostic');
    api.get(`/student/diagnostic/${competency.key}`)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(apiError(err, 'No se pudo cargar el diagnóstico.')));
  }, [competency.key]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <BackLink />
        <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#FDEEEE] border border-[#F4BDBD] text-sm text-[#37352F]">
          <AlertCircle className="w-4 h-4 text-[#C4554D]" /> {error}
        </div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 flex items-center gap-2 text-sm text-[#9B9A97]">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
      </div>
    );
  }
  if (detail.completed && detail.result) {
    return <ResultView competency={competency} result={detail.result} review={detail.review ?? []} />;
  }
  if (!started) {
    return <IntroView competency={competency} total={detail.questions?.length ?? 0} onStart={() => setStarted(true)} />;
  }
  return <TakeDiagnostic competency={competency} questions={detail.questions ?? []} onFinished={setDetail} />;
}

function IntroView({ competency, total, onStart }: { competency: Competency; total: number; onStart: () => void }) {
  const Icon = competency.icon;
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <BackLink />
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-md flex items-center justify-center ${competency.bg} ${competency.text}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-[#9B9A97]">Diagnóstico inicial</p>
            <h1 className="text-lg font-bold text-[#191919]">{competency.name}</h1>
          </div>
        </div>
        <ul className="text-sm text-[#37352F] space-y-1.5 list-disc pl-5">
          <li>{total} preguntas de selección múltiple con única respuesta.</li>
          <li>Hay preguntas de nivel básico, intermedio y avanzado; las más difíciles valen más.</li>
          <li>No tiene tiempo límite. Puedes moverte entre preguntas antes de enviar.</li>
          <li>Se presenta <strong>una sola vez</strong>: responde con lo que sabes, sin buscar ayuda, para que el resultado refleje tu nivel real.</li>
        </ul>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0B6E99] text-white text-sm font-medium hover:bg-[#095E85]"
        >
          <ClipboardList className="w-4 h-4" /> Comenzar diagnóstico
        </button>
      </div>
    </div>
  );
}

function TakeDiagnostic({
  competency, questions, onFinished,
}: { competency: Competency; questions: DiagnosticQuestion[]; onFinished: (d: Detail) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const startedAt = useRef(Date.now());

  const q = questions[index];
  const answered = Object.keys(answers).length;
  const complete = answered === questions.length;

  const submit = async () => {
    if (!complete || sending) return;
    if (!window.confirm('¿Enviar el diagnóstico? No podrás volver a presentarlo.')) return;
    setSending(true);
    setError('');
    try {
      const res = await api.post(`/student/diagnostic/${competency.key}`, {
        answers,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
      invalidateApiCache('/student/diagnostic');
      window.scrollTo({ top: 0 });
      onFinished(res.data);
    } catch (err) {
      setError(apiError(err, 'No se pudo enviar el diagnóstico.'));
    } finally {
      setSending(false);
    }
  };

  if (!q) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm font-semibold text-[#191919] truncate">{competency.name}</h1>
        <span className="text-xs text-[#787774] shrink-0">{answered}/{questions.length} respondidas</span>
      </div>

      {/* Navegación por pregunta */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Preguntas">
        {questions.map((item, i) => {
          const isCurrent = i === index;
          const isAnswered = answers[item.id] !== undefined;
          return (
            <button
              key={item.id}
              onClick={() => setIndex(i)}
              aria-label={`Pregunta ${i + 1}${isAnswered ? ', respondida' : ''}`}
              aria-current={isCurrent}
              className={`w-8 h-8 rounded-md text-xs font-semibold border transition ${
                isCurrent ? 'border-[#0B6E99] bg-[#0B6E99] text-white'
                  : isAnswered ? 'border-[#B6DAF2] bg-[#E5F3FF] text-[#0B6E99]'
                    : 'border-[#E9E9E7] bg-white text-[#787774] hover:border-[#0B6E99]/40'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs text-[#9B9A97]">
          <span>Pregunta {index + 1} de {questions.length}</span>
          <span>·</span>
          <span>{q.topic}</span>
          <span>·</span>
          <span>{DIFFICULTY_LABEL[q.difficulty]}</span>
        </div>

        {q.context && (
          <blockquote className="text-sm text-[#37352F] bg-[#F7F6F3] border-l-2 border-[#D3D1CB] px-3 py-2 rounded-r-md leading-relaxed">
            {q.context}
          </blockquote>
        )}
        <p className="text-[15px] font-medium text-[#191919] leading-relaxed">{q.text}</p>

        <div className="space-y-2" role="radiogroup">
          {q.options.map((option, i) => {
            const selected = answers[q.id] === i;
            return (
              <button
                key={i}
                role="radio"
                aria-checked={selected}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-md border text-sm transition ${
                  selected ? 'border-[#0B6E99] bg-[#E5F3FF] text-[#074D6E]'
                    : 'border-[#E9E9E7] hover:border-[#0B6E99]/40 text-[#37352F]'
                }`}
              >
                <span className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${
                  selected ? 'border-[#0B6E99] bg-[#0B6E99] text-white' : 'border-[#D3D1CB] text-[#787774]'
                }`}>
                  {LETTERS[i]}
                </span>
                <span className="pt-0.5">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#FDEEEE] border border-[#F4BDBD] text-sm text-[#37352F]">
          <AlertCircle className="w-4 h-4 text-[#C4554D]" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#E9E9E7] text-sm text-[#37352F] disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>
        {index < questions.length - 1 ? (
          <button
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0B6E99] text-white text-sm font-medium hover:bg-[#095E85]"
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!complete || sending}
            title={complete ? undefined : 'Responde todas las preguntas para enviar'}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0B6E99] text-white text-sm font-medium hover:bg-[#095E85] disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'El tutor está evaluando tus respuestas…' : 'Enviar diagnóstico'}
          </button>
        )}
      </div>
      {index === questions.length - 1 && !complete && (
        <p className="text-xs text-[#9B9A97] text-right">Te faltan {questions.length - answered} pregunta(s) por responder.</p>
      )}
    </div>
  );
}

function ResultView({ competency, result, review }: { competency: Competency; result: DiagnosticResult; review: ReviewItem[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const s = LEVEL_STYLE[result.level] ?? LEVEL_STYLE[1];

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <BackLink />

      <div className={`rounded-lg border p-5 sm:p-6 ${s.bg} ${s.border}`}>
        <p className="text-xs text-[#787774]">Resultado del diagnóstico · {competency.name}</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className={`text-3xl font-bold ${s.text}`}>Nivel {result.level}</span>
          <span className={`text-lg font-semibold ${s.text}`}>{result.label}</span>
        </div>
        <p className="mt-2 text-sm text-[#37352F]">{result.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/70 rounded-md px-3 py-2">
            <p className="text-xs text-[#787774]">Respuestas correctas</p>
            <p className="text-lg font-semibold text-[#191919]">{result.correct_count} / {result.total_questions}</p>
          </div>
          <div className="bg-white/70 rounded-md px-3 py-2">
            <p className="text-xs text-[#787774]">Puntaje (ponderado)</p>
            <p className="text-lg font-semibold text-[#191919]">{Math.round(result.score)} / 100</p>
          </div>
        </div>
      </div>

      {result.tutor_feedback && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 sm:p-5 flex gap-3">
          <NeuronAvatar size={36} variant="gradient" className="flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#191919]">Evaluación de tu tutor</h2>
            <p className="mt-1 text-sm text-[#37352F] whitespace-pre-line">{result.tutor_feedback}</p>
            {result.feedback_provider === 'local' && (
              <p className="mt-2 text-xs text-[#9B9A97]">
                El tutor de IA no estaba disponible; esta evaluación se generó con tus resultados.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#191919]">Resultado por tema</h2>
        {result.topic_results.map((t) => {
          const pct = t.total ? (t.correct / t.total) * 100 : 0;
          return (
            <div key={t.topic}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#37352F]">{t.topic}</span>
                <span className="text-[#787774]">{t.correct}/{t.total}</span>
              </div>
              <div className="h-1.5 bg-[#F1F1EF] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 50 ? '#0F7B6C' : '#D9730D' }} />
              </div>
            </div>
          );
        })}
        {result.weak_topics.length > 0 && (
          <p className="text-xs text-[#787774] pt-1">
            Temas para reforzar: <span className="text-[#37352F] font-medium">{result.weak_topics.join(', ')}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate(`/chat/${competency.slug}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0B6E99] text-white text-sm font-medium hover:bg-[#095E85]"
        >
          Practicar con el tutor <ArrowRight className="w-4 h-4" />
        </button>
        <Link to="/diagnostic" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#E9E9E7] text-sm text-[#37352F] hover:bg-[#F7F6F3]">
          Otras competencias
        </Link>
      </div>

      {review.length > 0 && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="w-full flex items-center justify-between px-4 sm:px-5 py-3 text-sm font-semibold text-[#191919]"
          >
            Revisar respuestas
            <ChevronDown className={`w-4 h-4 text-[#787774] transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ol className="border-t border-[#E9E9E7] divide-y divide-[#F1F1EF]">
              {review.map((item, i) => (
                <li key={item.id} className="px-4 sm:px-5 py-4 space-y-2">
                  <div className="flex items-start gap-2">
                    {item.is_correct
                      ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#0F7B6C]" />
                      : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#C4554D]" />}
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs text-[#9B9A97]">{i + 1}. {item.topic} · {DIFFICULTY_LABEL[item.difficulty]}</p>
                      {item.context && <p className="text-xs text-[#787774] italic">{item.context}</p>}
                      <p className="text-sm text-[#191919]">{item.text}</p>
                      <p className="text-xs text-[#37352F]">
                        Tu respuesta: <span className={item.is_correct ? 'text-[#0F7B6C]' : 'text-[#C4554D]'}>
                          {item.chosen !== null && item.chosen !== undefined ? `${LETTERS[item.chosen]}. ${item.options[item.chosen]}` : 'Sin responder'}
                        </span>
                      </p>
                      {!item.is_correct && (
                        <p className="text-xs text-[#37352F]">
                          Correcta: <span className="text-[#0F7B6C]">{LETTERS[item.correct]}. {item.options[item.correct]}</span>
                        </p>
                      )}
                      <p className="text-xs text-[#787774]">{item.explanation}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
