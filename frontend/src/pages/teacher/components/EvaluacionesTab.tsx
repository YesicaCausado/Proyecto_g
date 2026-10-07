import { useState, useEffect } from 'react';
import {
  Plus, CheckCircle, Eye, AlertCircle,
  Trash2, ToggleLeft, ToggleRight, X, Sparkles, Loader2,
} from 'lucide-react';
import api from '../../../services/api';
import { COMPETENCIES } from '../../../data/competencies';

type QuestionType = 'multiple' | 'truefalse' | 'open' | 'match';
type Difficulty = 'basico' | 'intermedio' | 'avanzado';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correct?: string;
  points: number;
  explanation?: string;
}

interface Evaluation {
  id: string;
  title: string;
  group: string;
  type: 'cuestionario' | 'examen';
  date: string;
  duration: number; // minutos
  attempts: number;
  questions: Question[];
  active: boolean;
  submissions: number;
}

/** Aula real del profesor (GET /classrooms/my-classes). */
interface Group {
  id: number;
  name: string;
  subject: string;
  grade: string;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple:  'Selección múltiple',
  truefalse: 'Verdadero / Falso',
  open:      'Pregunta abierta',
  match:     'Emparejamiento',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  basico:     'Básica',
  intermedio: 'Intermedia',
  avanzado:   'Avanzada',
};

const TRUE_FALSE = ['Verdadero', 'Falso'];

/** Mensaje de error real del backend (FastAPI `detail`). */
function apiError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error,\s*/i, '');
  if (!err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}

function toEvaluation(e: any): Evaluation {
  return {
    id:          String(e.id),
    title:       e.title,
    group:       e.group,
    type:        e.type,
    date:        e.date,
    duration:    e.duration,
    attempts:    e.attempts,
    questions:   e.questions ?? [],
    active:      e.active,
    submissions: e.submissions,
  };
}

const EMPTY_FORM = {
  title: '', group: '', type: 'cuestionario' as 'cuestionario' | 'examen',
  date: '', duration: 30, attempts: 1,
};
const EMPTY_Q = { type: 'multiple' as QuestionType, text: '', options: ['', '', '', ''], correct: '', points: 2 };

export default function EvaluacionesTab() {
  const [evals,       setEvals]       = useState<Evaluation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [listError,   setListError]   = useState('');
  const [groups,      setGroups]      = useState<Group[]>([]);
  const [showModal,   setShowModal]   = useState(false);
  const [viewEval,    setViewEval]    = useState<Evaluation | null>(null);
  const [step,        setStep]        = useState<1 | 2>(1);

  const [form, setForm] = useState(EMPTY_FORM);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQ, setNewQ] = useState(EMPTY_Q);
  const [qError, setQError] = useState('');

  // Generación con IA
  const [aiForm, setAiForm] = useState({
    topic: '', subject: '', grade: '', competency: '', difficulty: 'intermedio' as Difficulty, count: 5, context: '',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState('');
  const [aiDraft,   setAiDraft]   = useState<(Question & { selected: boolean })[]>([]);

  // Guardado
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState('');

  /* ── Carga inicial: evaluaciones y grupos reales del profesor ──────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setListError('');
      try {
        const [evRes, grRes] = await Promise.all([
          api.get('/teacher/evaluations'),
          api.get('/classrooms/my-classes'),
        ]);
        setEvals((evRes.data.evaluations ?? []).map(toEvaluation));
        setGroups((grRes.data.classrooms ?? []).map((c: any) => ({
          id: c.id, name: c.name, subject: c.subject ?? '', grade: c.grade ?? '',
        })));
      } catch (err) {
        setListError(apiError(err, 'No se pudieron cargar las evaluaciones.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedGroup = groups.find(g => g.name === form.group);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, group: groups[0]?.name ?? '' });
    setQuestions([]);
    setNewQ(EMPTY_Q);
    setQError('');
    setAiDraft([]);
    setAiError('');
    setSaveError('');
    setStep(1);
    setShowModal(true);
  };

  const closeCreate = () => {
    if (saving) return;
    setShowModal(false);
  };

  // Al pasar al paso 2 se precargan materia, grado y tema desde el grupo y el título.
  const goToQuestions = () => {
    setAiForm(prev => ({
      ...prev,
      topic:   prev.topic || form.title.trim(),
      subject: selectedGroup?.subject ?? prev.subject,
      grade:   selectedGroup?.grade ?? prev.grade,
    }));
    setStep(2);
  };

  const toggleEval = async (id: string) => {
    setListError('');
    try {
      const r = await api.post(`/teacher/evaluations/${id}/toggle`);
      setEvals(prev => prev.map(e => e.id === id ? { ...e, active: r.data.active } : e));
    } catch (err) {
      setListError(apiError(err, 'No se pudo cambiar el estado de la evaluación.'));
    }
  };

  const deleteEval = async (id: string) => {
    if (!window.confirm('¿Eliminar evaluación?')) return;
    setListError('');
    try {
      await api.delete(`/teacher/evaluations/${id}`);
      setEvals(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setListError(apiError(err, 'No se pudo eliminar la evaluación.'));
    }
  };

  /* ── Preguntas manuales ────────────────────────────────────────────── */
  const addQuestion = () => {
    const text = newQ.text.trim();
    if (!text) return;
    let options: string[] | undefined;
    let correct: string | undefined;
    if (newQ.type === 'truefalse') {
      options = TRUE_FALSE;
      correct = newQ.correct;
      if (!TRUE_FALSE.includes(correct)) { setQError('Marca si la afirmación es verdadera o falsa.'); return; }
    } else if (newQ.type !== 'open') {
      options = newQ.options.map(o => o.trim()).filter(Boolean);
      correct = newQ.correct.trim();
      if (options.length < 2) { setQError('Escribe al menos 2 opciones.'); return; }
      if (new Set(options).size !== options.length) { setQError('Hay opciones repetidas.'); return; }
      if (!correct || !options.includes(correct)) { setQError('Marca la opción correcta.'); return; }
    }
    setQError('');
    setQuestions(prev => [...prev, {
      id: `m-${Date.now()}`, type: newQ.type, text, points: newQ.points,
      ...(options ? { options, correct } : {}),
    }]);
    setNewQ(EMPTY_Q);
  };

  const removeQuestion = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id));

  /* ── Preguntas con IA: POST /teacher/ai/generate (kind "preguntas") ── */
  const generateWithAI = async () => {
    if (aiLoading) return; // evita doble envío
    if (!aiForm.topic.trim()) { setAiError('Escribe el tema de las preguntas.'); return; }
    setAiLoading(true);
    setAiError('');
    try {
      const r = await api.post('/teacher/ai/generate', {
        kind:       'preguntas',
        topic:      aiForm.topic.trim(),
        level:      aiForm.grade.trim() || 'No especificado',
        subject:    aiForm.subject.trim() || null,
        competency: aiForm.competency || null,
        difficulty: aiForm.difficulty,
        count:      aiForm.count,
        extra:      aiForm.context.trim() || null,
      });
      const generated: any[] = r.data?.content?.questions ?? [];
      if (generated.length === 0) {
        setAiError('La IA no devolvió preguntas. Inténtalo de nuevo.');
        return;
      }
      const stamp = Date.now();
      setAiDraft(generated.map((q, i) => ({
        id:          `ia-${stamp}-${i}`,
        type:        'multiple',
        text:        q.text,
        options:     q.options,
        correct:     q.correct,
        points:      q.points ?? 2,
        explanation: q.explanation || undefined,
        selected:    true,
      })));
    } catch (err) {
      setAiError(apiError(err, 'No se pudieron generar las preguntas.'));
    } finally {
      setAiLoading(false);
    }
  };

  const toggleDraft = (id: string) =>
    setAiDraft(prev => prev.map(q => q.id === id ? { ...q, selected: !q.selected } : q));

  const acceptDraft = () => {
    const chosen = aiDraft.filter(q => q.selected).map(({ selected: _s, ...q }) => q);
    setQuestions(prev => [...prev, ...chosen]);
    setAiDraft([]);
  };

  /* ── Guardar evaluación (POST /teacher/evaluations) ────────────────── */
  const handleCreate = async () => {
    if (saving || !form.title.trim() || !form.group || questions.length === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const r = await api.post('/teacher/evaluations', {
        ...form,
        title: form.title.trim(),
        questions: questions.map(({ id, type, text, options, correct, points, explanation }) => ({
          id, type, text, options, correct, points, explanation,
        })),
      });
      setEvals(prev => [toEvaluation(r.data), ...prev]);
      setShowModal(false);
    } catch (err) {
      setSaveError(apiError(err, 'No se pudo guardar la evaluación.'));
    } finally {
      setSaving(false);
    }
  };

  if (viewEval) return (
    <div className="space-y-5">
      <button onClick={() => setViewEval(null)} className="text-sm text-[#787774] hover:text-[#37352F]">← Evaluaciones</button>
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
        <h2 className="text-lg font-bold text-[#191919]">{viewEval.title}</h2>
        <p className="text-sm text-[#787774]">{viewEval.group} · {viewEval.type} · {viewEval.date || 'sin fecha'} · {viewEval.duration} min</p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xl font-bold text-[#2E6FDB]">{viewEval.questions.length}</p><p className="text-xs text-[#787774]">Preguntas</p></div>
          <div><p className="text-xl font-bold text-[#0F7B6C]">{viewEval.submissions}</p><p className="text-xs text-[#787774]">Entregas</p></div>
          <div><p className="text-xl font-bold text-[#D9730D]">{viewEval.attempts}</p><p className="text-xs text-[#787774]">Intentos</p></div>
        </div>
      </div>
      <div className="space-y-3">
        {viewEval.questions.map((q, i) => (
          <div key={q.id ?? i} className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
              <div className="flex-1">
                <span className="text-[10px] font-semibold text-[#787774] uppercase">{TYPE_LABELS[q.type]}</span>
                <p className="text-sm text-[#191919] mt-0.5 whitespace-pre-line">{q.text}</p>
                {q.options && <div className="mt-2 space-y-1">{q.options.map(o=><div key={o} className={`text-xs px-2 py-1 rounded ${o===q.correct ? 'bg-emerald-50 text-[#0F7B6C] font-medium' : 'text-[#787774]'}`}>{o}</div>)}</div>}
                {q.explanation && <p className="mt-2 text-xs text-[#787774] italic">💡 {q.explanation}</p>}
              </div>
              <span className="text-xs font-semibold text-[#6940A5]">{q.points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const inputCls = 'w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]';
  const labelCls = 'block text-xs font-semibold text-[#787774] uppercase mb-1.5';
  const selectedDraft = aiDraft.filter(q => q.selected).length;

  return (
    <div className="space-y-5">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#2E6FDB] animate-spin" />
        </div>
      )}
      {!loading && <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#787774]"><strong className="text-[#191919]">{evals.length}</strong> evaluaciones creadas</p>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Crear evaluación
        </button>
      </div>

      {listError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-[#E03E3E]/20 text-sm text-[#E03E3E]">
          <AlertCircle className="w-4 h-4" /> {listError}
        </div>
      )}

      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
              {['Título','Grupo','Tipo','Fecha','Preguntas','Entregas','Estado','Acciones'].map(h=>(
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evals.map(ev => (
              <tr key={ev.id} className="border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50">
                <td className="px-4 py-3 font-medium text-[#191919] max-w-[180px] truncate">{ev.title}</td>
                <td className="px-4 py-3 text-xs text-[#787774]">{ev.group}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-[#EEF3FD] text-[#2E6FDB] rounded text-[10px] font-medium capitalize">{ev.type}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[#787774]">{ev.date}</td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-[#191919]">{ev.questions.length}</td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-[#0F7B6C]">{ev.submissions}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleEval(ev.id)}>
                    {ev.active ? <ToggleRight className="w-6 h-6 text-[#0F7B6C]" /> : <ToggleLeft className="w-6 h-6 text-[#AEADAB]" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setViewEval(ev)} title="Ver"
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF3FD] text-[#2E6FDB] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteEval(ev.id)} title="Eliminar"
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#AEADAB] hover:text-[#E03E3E] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {evals.length === 0 && !listError && (
          <p className="py-10 text-center text-sm text-[#787774]">Aún no has creado evaluaciones.</p>
        )}
      </div>

      {/* Modal crear evaluación — 2 pasos */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-[#191919]">Crear evaluación</h3>
                <p className="text-xs text-[#787774]">Paso {step} de 2: {step===1 ? 'Configuración' : 'Preguntas'}</p>
              </div>
              <button onClick={closeCreate} className="text-[#787774] hover:text-[#37352F] text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {step === 1 ? (
                groups.length === 0 ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-[#D9730D] mx-auto mb-2" />
                    <p className="text-sm text-[#37352F]">Primero crea un grupo en la pestaña «Mis grupos».</p>
                    <p className="text-xs text-[#787774] mt-1">Cada evaluación se asigna a uno de tus grupos.</p>
                  </div>
                ) : (
                <>
                  <div>
                    <label className={labelCls}>Título *</label>
                    <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="ej. Parcial 1 — Álgebra"
                      maxLength={200} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Grupo *</label>
                      <select value={form.group} onChange={e=>setForm(p=>({...p,group:e.target.value}))} className={`${inputCls} bg-white`}>
                        {groups.map(g=><option key={g.id} value={g.name}>{g.name}{g.grade ? ` · ${g.grade}` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Tipo</label>
                      <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value as any}))} className={`${inputCls} bg-white`}>
                        <option value="cuestionario">Cuestionario</option>
                        <option value="examen">Examen</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Fecha</label>
                      <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Duración (min)</label>
                      <input type="number" value={form.duration} onChange={e=>setForm(p=>({...p,duration:+e.target.value}))} min={5} max={180} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Intentos</label>
                      <input type="number" value={form.attempts} onChange={e=>setForm(p=>({...p,attempts:+e.target.value}))} min={1} max={5} className={inputCls} />
                    </div>
                  </div>
                </>
                )
              ) : (
                <>
                  {/* Generación con IA */}
                  <div className="border border-[#6940A5]/30 bg-purple-50/40 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-[#6940A5] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Generar preguntas con IA (tipo Saber 11)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={labelCls}>Tema *</label>
                        <input value={aiForm.topic} onChange={e=>setAiForm(p=>({...p,topic:e.target.value}))} maxLength={200}
                          placeholder="ej. Ecuaciones de primer grado" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Materia</label>
                        <input value={aiForm.subject} onChange={e=>setAiForm(p=>({...p,subject:e.target.value}))} maxLength={120} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Grado</label>
                        <input value={aiForm.grade} onChange={e=>setAiForm(p=>({...p,grade:e.target.value}))} maxLength={30} placeholder="ej. 9°" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Competencia Saber 11</label>
                        <select value={aiForm.competency} onChange={e=>setAiForm(p=>({...p,competency:e.target.value}))} className={`${inputCls} bg-white`}>
                          <option value="">Sin especificar</option>
                          {COMPETENCIES.map(c => <option key={c.key} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Dificultad</label>
                          <select value={aiForm.difficulty} onChange={e=>setAiForm(p=>({...p,difficulty:e.target.value as Difficulty}))} className={`${inputCls} bg-white`}>
                            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map(d => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Cantidad</label>
                          <select value={aiForm.count} onChange={e=>setAiForm(p=>({...p,count:Number(e.target.value)}))} className={`${inputCls} bg-white`}>
                            {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Contexto (opcional)</label>
                        <input value={aiForm.context} onChange={e=>setAiForm(p=>({...p,context:e.target.value}))} maxLength={1000}
                          placeholder="ej. usar situaciones del contexto colombiano" className={inputCls} />
                      </div>
                    </div>
                    <button onClick={generateWithAI} disabled={aiLoading || !aiForm.topic.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#6940A5] bg-purple-50 text-[#6940A5] rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {aiLoading ? 'Generando con IA...' : '✨ Generar preguntas con IA'}
                    </button>
                    {aiError && <p className="text-xs text-[#E03E3E] flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {aiError}</p>}
                  </div>

                  {/* Revisión de las preguntas generadas */}
                  {aiDraft.length > 0 && (
                    <div className="border border-[#E9E9E7] rounded-lg">
                      <div className="px-4 py-2.5 border-b border-[#E9E9E7] flex items-center justify-between bg-[#F7F6F3]">
                        <p className="text-xs font-semibold text-[#37352F]">Revisa las preguntas generadas ({selectedDraft} de {aiDraft.length} seleccionadas)</p>
                        <div className="flex gap-2">
                          <button onClick={() => setAiDraft([])} className="text-xs text-[#787774] hover:text-[#E03E3E]">Descartar</button>
                          <button onClick={acceptDraft} disabled={selectedDraft === 0}
                            className="px-3 py-1 bg-[#6940A5] text-white rounded text-xs font-medium disabled:opacity-50">Agregar seleccionadas</button>
                        </div>
                      </div>
                      <div className="divide-y divide-[#F7F6F3] max-h-72 overflow-y-auto">
                        {aiDraft.map((q, i) => (
                          <label key={q.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-[#FBFBFA]">
                            <input type="checkbox" checked={q.selected} onChange={() => toggleDraft(q.id)} className="mt-1 w-3.5 h-3.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#191919] whitespace-pre-line"><strong>{i + 1}.</strong> {q.text}</p>
                              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {q.options?.map(o => (
                                  <span key={o} className={`text-[11px] px-2 py-0.5 rounded ${o === q.correct ? 'bg-emerald-50 text-[#0F7B6C] font-medium' : 'text-[#787774] bg-[#F7F6F3]'}`}>{o}</span>
                                ))}
                              </div>
                              {q.explanation && <p className="mt-1.5 text-[11px] text-[#787774] italic">💡 {q.explanation}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preguntas de la evaluación */}
                  {questions.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs font-semibold text-[#787774] uppercase">Preguntas de la evaluación ({questions.length})</p>
                      {questions.map((q,i) => (
                        <div key={q.id} className="flex items-start gap-2 p-2.5 bg-[#F7F6F3] rounded-lg">
                          <span className="text-[10px] font-bold text-[#AEADAB] w-4 mt-0.5">{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[#787774] uppercase">{TYPE_LABELS[q.type]} · {q.points} pts</p>
                            <p className="text-xs text-[#37352F] line-clamp-2">{q.text}</p>
                            {q.correct && <p className="text-[10px] text-[#0F7B6C] mt-0.5 truncate">✓ {q.correct}</p>}
                          </div>
                          <button onClick={() => removeQuestion(q.id)} className="text-[#AEADAB] hover:text-[#E03E3E] transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nueva pregunta manual */}
                  <div className="border border-[#E9E9E7] rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <select value={newQ.type} onChange={e=>setNewQ(p=>({...p,type:e.target.value as QuestionType, correct:''}))}
                        className="flex-1 px-3 py-2 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none bg-white">
                        {(Object.entries(TYPE_LABELS) as [QuestionType,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                      <input type="number" value={newQ.points} onChange={e=>setNewQ(p=>({...p,points:Math.min(10, Math.max(1, +e.target.value || 1))}))} min={1} max={10}
                        className="w-16 px-2 py-2 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none text-center" title="Puntos" />
                    </div>
                    <textarea value={newQ.text} onChange={e=>setNewQ(p=>({...p,text:e.target.value}))}
                      placeholder="Texto de la pregunta..." rows={2} maxLength={2000}
                      className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-none" />
                    {newQ.type !== 'open' && (
                      <div className="space-y-1.5">
                        {(newQ.type === 'truefalse' ? TRUE_FALSE : newQ.options).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="radio" name="correct" value={opt}
                              checked={!!opt && newQ.correct === opt} onChange={() => setNewQ(p=>({...p,correct:opt}))}
                              disabled={!opt.trim()}
                              className="w-3.5 h-3.5 text-[#2E6FDB]" />
                            {newQ.type === 'truefalse'
                              ? <span className="text-xs text-[#37352F]">{opt}</span>
                              : <input value={opt} onChange={e=>{ const ops=[...newQ.options]; const wasCorrect = newQ.correct === ops[i]; ops[i]=e.target.value; setNewQ(p=>({...p,options:ops, correct: wasCorrect ? e.target.value : p.correct})); }}
                                  placeholder={`Opción ${i+1}`} className="flex-1 px-2 py-1 border border-[#E9E9E7] rounded text-xs focus:outline-none focus:border-[#2E6FDB]" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {qError && <p className="text-xs text-[#E03E3E]">{qError}</p>}
                    <button onClick={addQuestion} disabled={!newQ.text.trim()}
                      className="w-full py-1.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg text-xs font-medium text-[#787774] hover:bg-[#E9E9E7] transition-colors disabled:opacity-50">
                      + Agregar pregunta
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-[#E9E9E7] flex-shrink-0 space-y-2">
              {saveError && <p className="text-xs text-[#E03E3E] flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {saveError}</p>}
              <div className="flex justify-between">
                {step === 2
                  ? <button onClick={() => setStep(1)} disabled={saving} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">← Anterior</button>
                  : <button onClick={closeCreate} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
                }
                {step === 1
                  ? <button onClick={goToQuestions} disabled={!form.title.trim() || !form.group}
                      className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                      Siguiente →
                    </button>
                  : <button onClick={handleCreate} disabled={questions.length === 0 || saving}
                      className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {saving ? 'Guardando...' : 'Crear evaluación'}
                    </button>
                }
              </div>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
