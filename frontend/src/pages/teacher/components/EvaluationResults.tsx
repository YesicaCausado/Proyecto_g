import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, XCircle, Users, BarChart2, Save } from 'lucide-react';
import api, { invalidateApiCache } from '../../../services/api';

/**
 * Resultados de una evaluación para el profesor:
 * GET  /teacher/evaluations/{id}/results
 * GET  /teacher/evaluations/{id}/submissions/{sid}
 * POST /teacher/evaluations/{id}/submissions/{sid}/grade   (preguntas abiertas)
 */

interface SubmissionSummary {
  id: number;
  attempt_number: number;
  status: 'en_curso' | 'pendiente_revision' | 'calificada';
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  auto_submitted: boolean;
  submitted_at: string | null;
}

interface StudentRow {
  student_id: number;
  name: string;
  username: string;
  enrolled: boolean;
  attempts_used: number;
  status: 'sin_entregar' | 'en_curso' | 'pendiente_revision' | 'calificada';
  official: SubmissionSummary | null;
  attempts: SubmissionSummary[];
}

interface QuestionStat {
  id: string;
  text: string;
  type: string;
  responses: number;
  correct_rate: number | null;
  avg_points: number | null;
  max_points: number;
}

interface ResultsData {
  evaluation: { id: number; title: string; group: string; status: string; attempts: number; date: string; duration: number };
  summary: { students_total: number; students_submitted: number; pending_review: number; average_percentage: number | null; max_score: number };
  students: StudentRow[];
  questions: QuestionStat[];
}

interface DetailItem {
  question: { id: string; type: string; text: string; options?: string[]; correct?: string; points: number; explanation?: string };
  answer: string | null;
  result: { correct: boolean | null; points: number | null; max_points: number; feedback: string | null } | null;
}

interface SubmissionDetail {
  submission: SubmissionSummary;
  student: { id: number; name: string };
  items: DetailItem[];
}

const STATUS: Record<StudentRow['status'], { label: string; cls: string }> = {
  sin_entregar:       { label: 'Sin entregar',   cls: 'bg-[#F7F6F3] text-[#787774]' },
  en_curso:           { label: 'Respondiendo',   cls: 'bg-[#EEF3FD] text-[#2E6FDB]' },
  pendiente_revision: { label: 'Por calificar',  cls: 'bg-purple-50 text-[#6940A5]' },
  calificada:         { label: 'Calificada',     cls: 'bg-[#EEF7F4] text-[#0F7B6C]' },
};

function apiError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error,\s*/i, '');
  if (!err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

export default function EvaluationResults({ evaluationId, onBack }: { evaluationId: string; onBack: () => void }) {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'students' | 'questions'>('students');
  const [openSub, setOpenSub] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    invalidateApiCache(`/teacher/evaluations/${evaluationId}`);
    try {
      const res = await api.get(`/teacher/evaluations/${evaluationId}/results`);
      setData(res.data);
    } catch (err) {
      setError(apiError(err, 'No se pudieron cargar los resultados.'));
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => { load(); }, [load]);

  if (openSub !== null) {
    return (
      <SubmissionView
        evaluationId={evaluationId}
        submissionId={openSub}
        onBack={() => { setOpenSub(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-[#787774] hover:text-[#37352F]">← Evaluaciones</button>
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-[#E03E3E]/20 text-sm text-[#E03E3E]">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {loading && !data ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#2E6FDB]" /></div>
      ) : data && (
        <>
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <h2 className="text-lg font-bold text-[#191919]">{data.evaluation.title}</h2>
            <p className="text-sm text-[#787774]">
              {data.evaluation.group} · {data.evaluation.status} · {data.evaluation.date ? `hasta ${data.evaluation.date}` : 'sin fecha límite'} · {data.evaluation.duration} min · {data.evaluation.attempts} intento(s)
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Card label="Entregaron" value={`${data.summary.students_submitted} / ${data.summary.students_total}`} color="text-[#2E6FDB]" />
              <Card label="Promedio" value={data.summary.average_percentage != null ? `${data.summary.average_percentage}%` : '—'} color="text-[#0F7B6C]" />
              <Card label="Por calificar" value={String(data.summary.pending_review)} color="text-[#6940A5]" />
              <Card label="Puntaje máximo" value={`${data.summary.max_score} pts`} color="text-[#D9730D]" />
            </div>
          </div>

          <div className="flex gap-2">
            {([['students', 'Estudiantes', Users], ['questions', 'Preguntas', BarChart2]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${tab === id ? 'bg-[#2E6FDB] text-white' : 'bg-white border border-[#E9E9E7] text-[#787774]'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          {tab === 'students' ? (
            <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                    {['Estudiante', 'Estado', 'Intentos', 'Nota (mejor intento)', 'Entregado', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map(st => (
                    <tr key={st.student_id} className="border-b border-[#F7F6F3]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#191919]">{st.name}</p>
                        {!st.enrolled && <p className="text-[10px] text-[#D9730D]">Ya no está inscrito en el grupo</p>}
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS[st.status].cls}`}>{STATUS[st.status].label}</span></td>
                      <td className="px-4 py-3 text-xs text-[#787774]">{st.attempts_used} / {data.evaluation.attempts}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#191919]">
                        {st.official?.status === 'calificada' ? `${st.official.score} / ${st.official.max_score} (${st.official.percentage}%)` : st.official ? 'Pendiente' : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#787774]">
                        {formatDate(st.official?.submitted_at ?? null)}{st.official?.auto_submitted ? ' · tiempo agotado' : ''}
                      </td>
                      <td className="px-4 py-3">
                        {st.official && (
                          <button onClick={() => setOpenSub(st.official!.id)}
                            className="text-xs font-medium text-[#2E6FDB] hover:underline">
                            {st.official.status === 'pendiente_revision' ? 'Calificar' : 'Ver respuestas'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.students.length === 0 && <p className="py-8 text-center text-sm text-[#787774]">El grupo no tiene estudiantes inscritos.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {data.questions.map((q, i) => (
                <div key={q.id} className="bg-white border border-[#E9E9E7] rounded-lg p-4 flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <p className="flex-1 text-sm text-[#191919] line-clamp-2">{q.text}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#191919]">{q.correct_rate != null ? `${q.correct_rate}%` : '—'}</p>
                    <p className="text-[10px] text-[#787774]">{q.type === 'open' ? `promedio ${q.avg_points ?? '—'} / ${q.max_points} pts` : `aciertos · ${q.responses} respuestas`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-[#F7F6F3]">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-[#787774] uppercase">{label}</p>
    </div>
  );
}

function SubmissionView({ evaluationId, submissionId, onBack }: { evaluationId: string; submissionId: number; onBack: () => void }) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [grades, setGrades] = useState<Record<string, { points: string; feedback: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const apply = (d: SubmissionDetail) => {
    setDetail(d);
    const initial: Record<string, { points: string; feedback: string }> = {};
    d.items.filter(it => it.question.type === 'open').forEach(it => {
      initial[it.question.id] = {
        points: it.result?.points != null ? String(it.result.points) : '',
        feedback: it.result?.feedback ?? '',
      };
    });
    setGrades(initial);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        invalidateApiCache(`/teacher/evaluations/${evaluationId}`);
        const res = await api.get(`/teacher/evaluations/${evaluationId}/submissions/${submissionId}`);
        apply(res.data);
      } catch (err) {
        setError(apiError(err, 'No se pudo cargar la entrega.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [evaluationId, submissionId]);

  const openItems = detail?.items.filter(it => it.question.type === 'open' && it.answer) ?? [];

  const save = async () => {
    if (saving || !detail) return;
    const payload: Record<string, { points: number; feedback: string | null }> = {};
    for (const it of openItems) {
      const g = grades[it.question.id];
      if (!g || g.points.trim() === '') continue;
      const pts = Number(g.points);
      if (Number.isNaN(pts) || pts < 0 || pts > it.question.points) {
        setError(`Los puntos de la pregunta deben estar entre 0 y ${it.question.points}.`);
        return;
      }
      payload[it.question.id] = { points: pts, feedback: g.feedback.trim() || null };
    }
    if (Object.keys(payload).length === 0) { setError('Asigna puntos al menos a una pregunta abierta.'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/teacher/evaluations/${evaluationId}/submissions/${submissionId}/grade`, { grades: payload });
      apply(res.data);
      invalidateApiCache('/teacher/evaluations');
      setNotice(res.data.submission.status === 'calificada' ? 'Calificación guardada.' : 'Guardado. Aún hay preguntas abiertas sin calificar.');
    } catch (err) {
      setError(apiError(err, 'No se pudo guardar la calificación.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-[#787774] hover:text-[#37352F]">← Resultados</button>
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#2E6FDB]" /></div>
      ) : detail && (
        <>
          <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
            <h2 className="text-lg font-bold text-[#191919]">{detail.student.name}</h2>
            <p className="text-sm text-[#787774]">
              Intento {detail.submission.attempt_number} · {formatDate(detail.submission.submitted_at)}
              {detail.submission.auto_submitted ? ' · enviado al agotarse el tiempo' : ''}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#191919]">
              {detail.submission.status === 'calificada'
                ? `Nota: ${detail.submission.score} / ${detail.submission.max_score} (${detail.submission.percentage}%)`
                : `Parcial: ${detail.submission.score} / ${detail.submission.max_score} · faltan preguntas abiertas por calificar`}
            </p>
          </div>

          {detail.items.map((it, i) => {
            const q = it.question;
            const isOpen = q.type === 'open';
            return (
              <div key={q.id} className="bg-white border border-[#E9E9E7] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#191919] whitespace-pre-line">{q.text}</p>
                    {!isOpen ? (
                      <div className="mt-2 space-y-1">
                        {(q.options ?? []).map(o => (
                          <div key={o} className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                            o === q.correct ? 'bg-emerald-50 text-[#0F7B6C] font-medium' : o === it.answer ? 'bg-red-50 text-[#E03E3E]' : 'text-[#787774]'}`}>
                            {o === q.correct ? <CheckCircle className="w-3 h-3" /> : o === it.answer ? <XCircle className="w-3 h-3" /> : <span className="w-3" />}
                            {o}{o === it.answer ? ' (respuesta del estudiante)' : ''}
                          </div>
                        ))}
                        {!it.answer && <p className="text-xs text-[#AEADAB]">Sin respuesta</p>}
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 text-xs text-[#37352F] bg-[#F7F6F3] rounded p-2 whitespace-pre-line">{it.answer || 'Sin respuesta'}</p>
                        {it.answer && (
                          <div className="mt-2 flex flex-col sm:flex-row gap-2">
                            <input type="number" min={0} max={q.points} step={0.5}
                              value={grades[q.id]?.points ?? ''}
                              onChange={e => setGrades(p => ({ ...p, [q.id]: { ...(p[q.id] ?? { feedback: '' }), points: e.target.value } }))}
                              placeholder={`0 – ${q.points}`}
                              className="w-28 px-2 py-1.5 border border-[#E9E9E7] rounded text-xs" />
                            <input value={grades[q.id]?.feedback ?? ''} maxLength={1000}
                              onChange={e => setGrades(p => ({ ...p, [q.id]: { ...(p[q.id] ?? { points: '' }), feedback: e.target.value } }))}
                              placeholder="Comentario para el estudiante (opcional)"
                              className="flex-1 px-2 py-1.5 border border-[#E9E9E7] rounded text-xs" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[#6940A5] whitespace-nowrap">
                    {it.result?.points != null ? `${it.result.points} / ${q.points}` : `— / ${q.points}`} pts
                  </span>
                </div>
              </div>
            );
          })}

          {error && <p className="text-sm text-[#E03E3E] flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {error}</p>}
          {notice && <p className="text-sm text-[#0F7B6C] flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> {notice}</p>}
          {openItems.length > 0 && (
            <div className="flex justify-end">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar calificación
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
