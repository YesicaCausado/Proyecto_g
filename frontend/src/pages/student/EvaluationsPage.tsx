import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardCheck, Clock, Loader2, AlertCircle, CheckCircle, XCircle, Send, Play, Save,
} from 'lucide-react';
import api, { invalidateApiCache } from '../../services/api';
import StudentEvaluationsList from '../../components/evaluations/StudentEvaluationsList';
import {
  STATE_LABELS, apiError, formatDateTime, type AttemptInfo, type StudentEvaluation,
} from '../../components/evaluations/shared';

interface PublicQuestion {
  id: string;
  type: 'multiple' | 'truefalse' | 'open' | 'match';
  text: string;
  points: number;
  options?: string[];
}

interface ReviewItem {
  question: PublicQuestion & { correct?: string; explanation?: string };
  answer: string | null;
  result: { correct: boolean | null; points: number | null; max_points: number; feedback: string | null } | null;
}

interface EvaluationDetail extends StudentEvaluation {
  attempts: AttemptInfo[];
  review: ReviewItem[] | null;
}

interface ActiveAttempt {
  submissionId: number;
  attemptNumber: number;
  expiresAt: number;           // epoch ms
  questions: PublicQuestion[];
}

const SAVE_DELAY_MS = 1500;    // espera tras la última respuesta antes de guardar el progreso

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EvaluationsPage() {
  const [params, setParams] = useSearchParams();
  const evalId = params.get('id');

  if (!evalId) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[#191919]">Evaluaciones</h1>
          <p className="text-sm text-[#787774]">Evaluaciones que tus profesores publicaron en tus clases.</p>
        </div>
        <StudentEvaluationsList title="Mis evaluaciones" />
      </div>
    );
  }
  return <EvaluationDetailView evalId={Number(evalId)} onBack={() => setParams({})} />;
}

function EvaluationDetailView({ evalId, onBack }: { evalId: number; onBack: () => void }) {
  const [detail, setDetail] = useState<EvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState<ActiveAttempt | null>(null);
  const [starting, setStarting] = useState(false);
  const [initialAnswers, setInitialAnswers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    invalidateApiCache('/student/evaluations');
    try {
      const res = await api.get(`/student/evaluations/${evalId}`);
      setDetail(res.data);
    } catch (err) {
      setError(apiError(err, 'No se pudo cargar la evaluación.'));
    } finally {
      setLoading(false);
    }
  }, [evalId]);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/student/evaluations/${evalId}/start`);
      invalidateApiCache('/student/evaluations');
      setActive({
        submissionId: res.data.submission_id,
        attemptNumber: res.data.attempt_number,
        expiresAt: Date.now() + res.data.remaining_seconds * 1000,
        questions: res.data.questions ?? [],
      });
      setInitialAnswers(res.data.answers ?? {});
    } catch (err) {
      setError(apiError(err, 'No se pudo abrir la evaluación.'));
      load();
    } finally {
      setStarting(false);
    }
  };

  const finish = (message: string) => {
    setActive(null);
    setNotice(message);
    load();
  };

  if (active) {
    return (
      <TakeEvaluation
        evalId={evalId}
        title={detail?.title ?? ''}
        attempt={active}
        initialAnswers={initialAnswers}
        onFinished={finish}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F]">
        <ArrowLeft className="w-4 h-4" /> Evaluaciones
      </button>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#EEF7F4] border border-[#0F7B6C]/20 text-sm text-[#0F7B6C]">
          <CheckCircle className="w-4 h-4" /> {notice}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-[#E03E3E]/20 text-sm text-[#E03E3E]">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading && !detail ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#2E6FDB]" /></div>
      ) : detail && (
        <>
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EEF3FD] flex items-center justify-center"><ClipboardCheck className="w-5 h-5 text-[#2E6FDB]" /></div>
                <div>
                  <h1 className="text-lg font-bold text-[#191919]">{detail.title}</h1>
                  <p className="text-xs text-[#787774] capitalize">{detail.classroom_name} · {detail.type}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATE_LABELS[detail.state].cls}`}>{STATE_LABELS[detail.state].label}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Stat label="Preguntas" value={String(detail.questions_count)} />
              <Stat label="Tiempo" value={`${detail.duration} min`} />
              <Stat label="Intentos" value={`${detail.attempts_used} de ${detail.attempts_allowed}`} />
              <Stat label="Fecha límite" value={detail.deadline ? formatDateTime(detail.deadline) : 'Sin límite'} />
            </div>

            {detail.official && (
              <div className="mt-4 p-3 rounded-lg bg-[#F7F6F3] text-sm text-[#37352F]">
                {detail.official.status === 'calificada'
                  ? <>Tu nota (mejor intento): <strong className="text-[#0F7B6C]">{detail.official.score} / {detail.official.max_score} pts · {detail.official.percentage}%</strong></>
                  : <>Entregada. Tu profesor está calificando las preguntas abiertas.</>}
              </div>
            )}

            {detail.can_start && (
              <button onClick={start} disabled={starting}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-60">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {detail.in_progress_id ? 'Continuar intento' : detail.attempts_used > 0 ? 'Nuevo intento' : 'Comenzar evaluación'}
              </button>
            )}
            {detail.can_start && !detail.in_progress_id && (
              <p className="mt-2 text-[11px] text-[#787774] text-center">
                Al comenzar corre el tiempo ({detail.duration} min). Tus respuestas se guardan mientras respondes; si el tiempo se agota se envían automáticamente.
              </p>
            )}
          </div>

          {detail.attempts.length > 0 && (
            <div className="bg-white border border-[#E9E9E7] rounded-lg">
              <p className="px-4 py-3 border-b border-[#E9E9E7] text-sm font-semibold text-[#191919]">Mis intentos</p>
              <div className="divide-y divide-[#F7F6F3]">
                {detail.attempts.map(a => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-[#37352F]">Intento {a.attempt_number}{a.auto_submitted ? ' · enviado al agotarse el tiempo' : ''}</span>
                    <span className="text-xs text-[#787774]">
                      {a.status === 'en_curso' ? 'En curso'
                        : a.status === 'pendiente_revision' ? 'En revisión'
                        : `${a.score} / ${a.max_score} pts (${a.percentage}%)`}
                      {a.submitted_at ? ` · ${formatDateTime(a.submitted_at)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.review ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[#191919]">Corrección (mejor intento)</p>
              {detail.review.map((item, i) => <ReviewCard key={item.question.id} item={item} index={i} />)}
            </div>
          ) : detail.official && (
            <p className="text-xs text-[#787774] text-center">
              Podrás ver las respuestas correctas cuando el profesor cierre la evaluación o pase la fecha límite.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-[#F7F6F3]">
      <p className="text-sm font-bold text-[#191919]">{value}</p>
      <p className="text-[10px] text-[#787774] uppercase">{label}</p>
    </div>
  );
}

function ReviewCard({ item, index }: { item: ReviewItem; index: number }) {
  const { question: q, answer, result } = item;
  const pending = result?.points == null && answer;
  return (
    <div className="bg-white border border-[#E9E9E7] rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#191919] whitespace-pre-line">{q.text}</p>
          {q.options ? (
            <div className="mt-2 space-y-1">
              {q.options.map(o => {
                const isCorrect = o === q.correct;
                const isMine = o === answer;
                return (
                  <div key={o} className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                    isCorrect ? 'bg-emerald-50 text-[#0F7B6C] font-medium' : isMine ? 'bg-red-50 text-[#E03E3E]' : 'text-[#787774]'}`}>
                    {isCorrect ? <CheckCircle className="w-3 h-3" /> : isMine ? <XCircle className="w-3 h-3" /> : <span className="w-3" />}
                    {o}{isMine ? ' (tu respuesta)' : ''}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#37352F] bg-[#F7F6F3] rounded p-2 whitespace-pre-line">{answer || 'Sin respuesta'}</p>
          )}
          {q.explanation && <p className="mt-2 text-xs text-[#787774] italic">💡 {q.explanation}</p>}
          {result?.feedback && <p className="mt-2 text-xs text-[#6940A5]">Comentario del profesor: {result.feedback}</p>}
        </div>
        <span className="text-xs font-semibold text-[#6940A5] whitespace-nowrap">
          {pending ? 'Por calificar' : `${result?.points ?? 0} / ${q.points} pts`}
        </span>
      </div>
    </div>
  );
}

function TakeEvaluation({ evalId, title, attempt, initialAnswers, onFinished }: {
  evalId: number;
  title: string;
  attempt: ActiveAttempt;
  initialAnswers: Record<string, string>;
  onFinished: (message: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [remaining, setRemaining] = useState(Math.max(0, Math.round((attempt.expiresAt - Date.now()) / 1000)));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = useCallback(async (auto: boolean) => {
    if (submittedRef.current) return;      // evita doble envío (clic + fin del tiempo)
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const res = await api.post(`/student/evaluations/${evalId}/submit`, {
        submission_id: attempt.submissionId,
        answers: answersRef.current,
      });
      invalidateApiCache('/student/evaluations');
      onFinished(auto ? `Se agotó el tiempo. ${res.data.message}` : res.data.message);
    } catch (err: any) {
      invalidateApiCache('/student/evaluations');
      if (err?.response?.status === 409) {
        onFinished(apiError(err, 'El intento ya no está abierto.'));
        return;
      }
      submittedRef.current = false;
      setError(apiError(err, 'No se pudo enviar la evaluación. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }, [evalId, attempt.submissionId, onFinished]);

  // Cuenta regresiva real (hora de vencimiento que dio el servidor).
  useEffect(() => {
    const tick = () => {
      const secs = Math.max(0, Math.round((attempt.expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt.expiresAt, submit]);

  const saveProgress = async (snapshot: Record<string, string>) => {
    setSaveState('saving');
    try {
      await api.put(`/student/evaluations/${evalId}/progress`, {
        submission_id: attempt.submissionId,
        answers: snapshot,
      });
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const setAnswer = (qid: string, value: string) => {
    const next = { ...answersRef.current, [qid]: value };
    setAnswers(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProgress(next), SAVE_DELAY_MS);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const answered = attempt.questions.filter(q => (answers[q.id] ?? '').trim()).length;
  const lowTime = remaining <= 60;

  const confirmSubmit = () => {
    const missing = attempt.questions.length - answered;
    const msg = missing > 0
      ? `Tienes ${missing} pregunta(s) sin responder. ¿Enviar de todos modos?`
      : '¿Enviar la evaluación? No podrás cambiar tus respuestas.';
    if (window.confirm(msg)) submit(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-[#E9E9E7] rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#191919] truncate">{title}</p>
          <p className="text-[11px] text-[#787774]">
            Intento {attempt.attemptNumber} · {answered} de {attempt.questions.length} respondidas ·{' '}
            {saveState === 'saving' ? 'guardando…' : saveState === 'saved' ? 'progreso guardado' : saveState === 'error' ? 'no se pudo guardar el progreso' : 'sin cambios'}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-bold ${lowTime ? 'text-[#E03E3E]' : 'text-[#2E6FDB]'}`}>
          <Clock className="w-4 h-4" /> {formatClock(remaining)}
        </div>
      </div>

      {attempt.questions.map((q, i) => (
        <div key={q.id} className="bg-white border border-[#E9E9E7] rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-[#191919] whitespace-pre-line"><strong>{i + 1}.</strong> {q.text}</p>
            <span className="text-xs font-semibold text-[#6940A5] whitespace-nowrap">{q.points} pts</span>
          </div>
          {q.options ? (
            <div className="mt-3 space-y-1.5">
              {q.options.map(o => (
                <label key={o} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                  answers[q.id] === o ? 'border-[#2E6FDB] bg-[#EEF3FD] text-[#191919]' : 'border-[#E9E9E7] text-[#37352F] hover:bg-[#F7F6F3]'}`}>
                  <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswer(q.id, o)}
                    className="w-3.5 h-3.5 text-[#2E6FDB]" disabled={submitting} />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <textarea value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)} disabled={submitting}
              rows={4} maxLength={5000} placeholder="Escribe tu respuesta…"
              className="mt-3 w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-y" />
          )}
        </div>
      ))}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-[#E03E3E]/20 text-sm text-[#E03E3E]">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button onClick={() => saveProgress(answersRef.current)} disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 border border-[#E9E9E7] rounded-lg text-sm text-[#37352F] hover:bg-[#F7F6F3] disabled:opacity-50">
          <Save className="w-4 h-4" /> Guardar progreso
        </button>
        <button onClick={confirmSubmit} disabled={submitting}
          className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-60">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Enviando…' : 'Enviar evaluación'}
        </button>
      </div>
      <p className="text-center text-[11px] text-[#AEADAB]"><Link to="/evaluations" className="hover:underline">Salir</Link>: el tiempo sigue corriendo y lo que guardaste se enviará al terminar.</p>
    </div>
  );
}
