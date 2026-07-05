import { useState } from 'react';
import {
  Plus, Clock, CheckCircle, Eye,
  Trash2, ToggleLeft, ToggleRight, X, Sparkles,
} from 'lucide-react';

type QuestionType = 'multiple' | 'truefalse' | 'open' | 'match';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  correct?: string;
  points: number;
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

const GROUPS = ['Matemáticas 9A', 'Física 10B', 'Álgebra 8C', 'Cálculo 11A'];

const MOCK_EVALS: Evaluation[] = [
  {
    id:'e1', title:'Parcial 1 — Álgebra Lineal', group:'Matemáticas 9A', type:'examen',
    date:'2026-07-10', duration:60, attempts:1, submissions:28, active:true,
    questions:[
      {id:'q1',type:'multiple',text:'¿Cuál es la fórmula general para resolver ecuaciones de segundo grado?',options:['x = (-b ± √(b²-4ac)) / 2a','x = b/2a','x = -b/a','x = (-b ± √b²) / 2a'],correct:'x = (-b ± √(b²-4ac)) / 2a',points:2},
      {id:'q2',type:'truefalse',text:'Un polinomio de grado 2 siempre tiene exactamente dos raíces reales.',options:['Verdadero','Falso'],correct:'Falso',points:1},
    ],
  },
  {
    id:'e2', title:'Quiz Rápido — Leyes de Newton', group:'Física 10B', type:'cuestionario',
    date:'2026-07-05', duration:20, attempts:2, submissions:15, active:true,
    questions:[
      {id:'q3',type:'multiple',text:'La Primera Ley de Newton establece que:',options:['Todo cuerpo en movimiento permanece en movimiento','Fuerza = masa × aceleración','A toda acción le corresponde una reacción igual','La energía se conserva'],correct:'Todo cuerpo en movimiento permanece en movimiento',points:2},
    ],
  },
];

const AI_GENERATED_QUESTIONS: Question[] = [
  { id:'ai1', type:'multiple', text:'¿Cuál de los siguientes es un número irracional?', options:['√4','√9','√2','√16'], correct:'√2', points:2 },
  { id:'ai2', type:'truefalse', text:'El número π es exactamente igual a 22/7.', options:['Verdadero','Falso'], correct:'Falso', points:1 },
  { id:'ai3', type:'open', text:'Explica con tus propias palabras qué es una función lineal.', points:3 },
];

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple:  'Selección múltiple',
  truefalse: 'Verdadero / Falso',
  open:      'Pregunta abierta',
  match:     'Emparejamiento',
};

export default function EvaluacionesTab({ license }: { license: any }) {
  const [evals,       setEvals]       = useState<Evaluation[]>(MOCK_EVALS);
  const [showModal,   setShowModal]   = useState(false);
  const [viewEval,    setViewEval]    = useState<Evaluation | null>(null);
  const [step,        setStep]        = useState<1 | 2>(1);
  const [aiLoading,   setAiLoading]   = useState(false);

  const [form, setForm] = useState({
    title:'', group:GROUPS[0], type:'cuestionario' as 'cuestionario'|'examen',
    date:'', duration:30, attempts:1,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQ, setNewQ] = useState({ type:'multiple' as QuestionType, text:'', options:['','','',''], correct:'', points:2 });

  const toggleEval  = (id: string) => setEvals(prev => prev.map(e => e.id===id ? {...e,active:!e.active} : e));
  const deleteEval  = (id: string) => { if(!window.confirm('¿Eliminar evaluación?')) return; setEvals(prev=>prev.filter(e=>e.id!==id)); };

  const addQuestion = () => {
    if (!newQ.text.trim()) return;
    const q: Question = { id:Date.now().toString(), type:newQ.type, text:newQ.text, points:newQ.points,
      ...(newQ.type !== 'open' ? { options: newQ.options.filter(o=>o.trim()), correct: newQ.correct } : {}) };
    setQuestions(prev => [...prev, q]);
    setNewQ({ type:'multiple', text:'', options:['','','',''], correct:'', points:2 });
  };

  const removeQuestion = (id: string) => setQuestions(prev => prev.filter(q => q.id !== id));

  const generateWithAI = () => {
    setAiLoading(true);
    setTimeout(() => { setQuestions(prev => [...prev, ...AI_GENERATED_QUESTIONS]); setAiLoading(false); }, 1500);
  };

  const handleCreate = () => {
    if (!form.title.trim() || questions.length === 0) return;
    const ev: Evaluation = { id:Date.now().toString(), ...form, questions, active:true, submissions:0 };
    setEvals(prev => [ev, ...prev]);
    setShowModal(false);
    setStep(1);
    setForm({ title:'', group:GROUPS[0], type:'cuestionario', date:'', duration:30, attempts:1 });
    setQuestions([]);
  };

  const isPremium = license?.plan === 'premium' || license?.plan === 'pro';

  if (viewEval) return (
    <div className="space-y-5">
      <button onClick={() => setViewEval(null)} className="text-sm text-[#787774] hover:text-[#37352F]">← Evaluaciones</button>
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
        <h2 className="text-lg font-bold text-[#191919]">{viewEval.title}</h2>
        <p className="text-sm text-[#787774]">{viewEval.group} · {viewEval.type} · {viewEval.date} · {viewEval.duration} min</p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xl font-bold text-[#2E6FDB]">{viewEval.questions.length}</p><p className="text-xs text-[#787774]">Preguntas</p></div>
          <div><p className="text-xl font-bold text-[#0F7B6C]">{viewEval.submissions}</p><p className="text-xs text-[#787774]">Entregas</p></div>
          <div><p className="text-xl font-bold text-[#D9730D]">{viewEval.attempts}</p><p className="text-xs text-[#787774]">Intentos</p></div>
        </div>
      </div>
      <div className="space-y-3">
        {viewEval.questions.map((q, i) => (
          <div key={q.id} className="bg-white border border-[#E9E9E7] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>
              <div className="flex-1">
                <span className="text-[10px] font-semibold text-[#787774] uppercase">{TYPE_LABELS[q.type]}</span>
                <p className="text-sm text-[#191919] mt-0.5">{q.text}</p>
                {q.options && <div className="mt-2 space-y-1">{q.options.map(o=><div key={o} className={`text-xs px-2 py-1 rounded ${o===q.correct ? 'bg-emerald-50 text-[#0F7B6C] font-medium' : 'text-[#787774]'}`}>{o}</div>)}</div>}
              </div>
              <span className="text-xs font-semibold text-[#6940A5]">{q.points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#787774]"><strong className="text-[#191919]">{evals.length}</strong> evaluaciones creadas</p>
        <button onClick={() => { setShowModal(true); setStep(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Crear evaluación
        </button>
      </div>

      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
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
      </div>

      {/* Modal crear evaluación — 2 pasos */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-[#191919]">Crear evaluación</h3>
                <p className="text-xs text-[#787774]">Paso {step} de 2: {step===1 ? 'Configuración básica' : 'Preguntas'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#787774] hover:text-[#37352F] text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {step === 1 ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Título *</label>
                    <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="ej. Parcial 1 — Álgebra"
                      className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Grupo</label>
                      <select value={form.group} onChange={e=>setForm(p=>({...p,group:e.target.value}))}
                        className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] bg-white">
                        {GROUPS.map(g=><option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Tipo</label>
                      <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value as any}))}
                        className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] bg-white">
                        <option value="cuestionario">Cuestionario</option>
                        <option value="examen">Examen</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Fecha</label>
                      <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                        className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Duración (min)</label>
                      <input type="number" value={form.duration} onChange={e=>setForm(p=>({...p,duration:+e.target.value}))} min={5} max={180}
                        className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Intentos</label>
                      <input type="number" value={form.attempts} onChange={e=>setForm(p=>({...p,attempts:+e.target.value}))} min={1} max={5}
                        className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Botón AI */}
                  {isPremium && (
                    <button onClick={generateWithAI} disabled={aiLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#6940A5] bg-purple-50 text-[#6940A5] rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60">
                      {aiLoading ? <Clock className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {aiLoading ? 'Generando con IA...' : '✨ Generar preguntas con IA'}
                    </button>
                  )}

                  {/* Preguntas añadidas */}
                  {questions.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {questions.map((q,i) => (
                        <div key={q.id} className="flex items-start gap-2 p-2.5 bg-[#F7F6F3] rounded-lg">
                          <span className="text-[10px] font-bold text-[#AEADAB] w-4 mt-0.5">{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[#787774] uppercase">{TYPE_LABELS[q.type]}</p>
                            <p className="text-xs text-[#37352F] truncate">{q.text}</p>
                          </div>
                          <button onClick={() => removeQuestion(q.id)} className="text-[#AEADAB] hover:text-[#E03E3E] transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nueva pregunta */}
                  <div className="border border-[#E9E9E7] rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <select value={newQ.type} onChange={e=>setNewQ(p=>({...p,type:e.target.value as QuestionType}))}
                        className="flex-1 px-3 py-2 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none bg-white">
                        {(Object.entries(TYPE_LABELS) as [QuestionType,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                      <input type="number" value={newQ.points} onChange={e=>setNewQ(p=>({...p,points:+e.target.value}))} min={1} max={10}
                        className="w-16 px-2 py-2 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none text-center" placeholder="pts" />
                    </div>
                    <textarea value={newQ.text} onChange={e=>setNewQ(p=>({...p,text:e.target.value}))}
                      placeholder="Texto de la pregunta..." rows={2}
                      className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-none" />
                    {(newQ.type === 'multiple' || newQ.type === 'truefalse') && (
                      <div className="space-y-1.5">
                        {(newQ.type === 'truefalse' ? ['Verdadero','Falso'] : newQ.options).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="radio" name="correct" value={opt}
                              checked={newQ.correct === opt} onChange={() => setNewQ(p=>({...p,correct:opt}))}
                              className="w-3.5 h-3.5 text-[#2E6FDB]" />
                            {newQ.type === 'truefalse'
                              ? <span className="text-xs text-[#37352F]">{opt}</span>
                              : <input value={opt} onChange={e=>{ const ops=[...newQ.options]; ops[i]=e.target.value; setNewQ(p=>({...p,options:ops})); }}
                                  placeholder={`Opción ${i+1}`} className="flex-1 px-2 py-1 border border-[#E9E9E7] rounded text-xs focus:outline-none focus:border-[#2E6FDB]" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={addQuestion} disabled={!newQ.text.trim()}
                      className="w-full py-1.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg text-xs font-medium text-[#787774] hover:bg-[#E9E9E7] transition-colors disabled:opacity-50">
                      + Agregar pregunta
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 pb-5 pt-3 border-t border-[#E9E9E7] flex justify-between flex-shrink-0">
              {step === 2
                ? <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">← Anterior</button>
                : <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              }
              {step === 1
                ? <button onClick={() => setStep(2)} disabled={!form.title.trim()}
                    className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                    Siguiente →
                  </button>
                : <button onClick={handleCreate} disabled={questions.length === 0}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Crear evaluación
                  </button>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
