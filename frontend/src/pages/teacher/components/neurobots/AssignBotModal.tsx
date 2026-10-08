/**
 * Asignar un NeuroBot a grupos y/o estudiantes con una meta de interacciones.
 *
 * GET  /bots/{id}/assignments  → grupos y estudiantes del profesor con su estado
 * POST /bots/{id}/assignments  → asigna (o actualiza la meta) y notifica a los
 *                                estudiantes que lo reciben por primera vez
 * DELETE /bots/{id}/assignments/classrooms/{cid} | students/{sid}
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Search, Share2, Target, Users, X } from 'lucide-react';
import api, { invalidateApiCache } from '../../../../services/api';

interface ClassroomRow {
  id: number;
  name: string;
  subject: string;
  grade: string;
  student_count: number;
  assigned: boolean;
  goal_interactions: number | null;
}

interface StudentRow {
  id: number;
  full_name: string;
  username: string;
  classrooms: string[];
  assigned_individually: boolean;
  goal_interactions: number | null;
}

interface Overview {
  default_goal: number;
  min_goal: number;
  max_goal: number;
  classrooms: ClassroomRow[];
  students: StudentRow[];
}

function apiError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  if (!err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}

export default function AssignBotModal({ botId, botName, onClose, onChanged }: {
  botId: string;
  botName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [goal, setGoal] = useState<string>('');
  const [classes, setClasses] = useState<Set<number>>(new Set());
  const [students, setStudents] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const res = await api.get<Overview>(`/bots/${botId}/assignments`, { params: { _t: Date.now() } });
      setData(res.data);
      setGoal(g => g || String(res.data.default_goal));
    } catch (err) {
      setLoadError(apiError(err, 'No fue posible cargar tus grupos y estudiantes.'));
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [botId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.students;
    return data.students.filter(s =>
      s.full_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
      || s.classrooms.some(c => c.toLowerCase().includes(q)));
  }, [data, search]);

  const toggle = (set: Set<number>, id: number, apply: (s: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    apply(next);
  };

  const goalNumber = Number(goal);
  const goalValid = data !== null && Number.isInteger(goalNumber)
    && goalNumber >= data.min_goal && goalNumber <= data.max_goal;

  const submit = async () => {
    if (!goalValid || (classes.size === 0 && students.size === 0)) return;
    setSaving(true);
    setError('');
    setResult('');
    try {
      const res = await api.post(`/bots/${botId}/assignments`, {
        classroom_ids: [...classes],
        student_ids: [...students],
        goal_interactions: goalNumber,
      });
      const r = res.data;
      const parts: string[] = [];
      if (r.classrooms_added) parts.push(`${r.classrooms_added} grupo(s) nuevo(s)`);
      if (r.students_added) parts.push(`${r.students_added} estudiante(s) nuevo(s)`);
      if (r.classrooms_updated || r.students_updated) parts.push('meta actualizada');
      setResult(
        `Asignación guardada${parts.length ? ` (${parts.join(', ')})` : ''}. `
        + (r.students_notified ? `Se notificó a ${r.students_notified} estudiante(s).` : 'No había estudiantes nuevos que notificar.')
        + (r.completed_after_goal_change ? ` ${r.completed_after_goal_change} ya alcanzaron la nueva meta.` : ''),
      );
      setData(r.assignments);
      setClasses(new Set());
      setStudents(new Set());
      invalidateApiCache('/bots');
      onChanged();
    } catch (err) {
      setError(apiError(err, 'No fue posible asignar el NeuroBot.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: 'classrooms' | 'students', id: number) => {
    setRemoving(`${kind}-${id}`);
    setError('');
    setResult('');
    try {
      const res = await api.delete(`/bots/${botId}/assignments/${kind}/${id}`);
      setData(res.data.assignments);
      invalidateApiCache('/bots');
      onChanged();
    } catch (err) {
      setError(apiError(err, 'No fue posible quitar la asignación.'));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E9E9E7]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#EEF3FD] rounded-lg flex items-center justify-center">
              <Share2 className="w-4 h-4 text-[#2E6FDB]" />
            </div>
            <div>
              <p className="font-semibold text-[#191919] text-sm">Asignar NeuroBot</p>
              <p className="text-[11px] text-[#787774]">{botName} · a tus grupos o a estudiantes concretos</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#787774] hover:text-[#37352F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loadError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-[#E03E3E] mx-auto mb-2" />
              <p className="text-sm text-[#E03E3E]">{loadError}</p>
              <button onClick={load} className="mt-3 text-xs font-medium text-[#2E6FDB] hover:underline">Reintentar</button>
            </div>
          ) : !data ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#2E6FDB]" /></div>
          ) : data.classrooms.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
              <p className="text-sm text-[#787774]">No tienes grupos creados.</p>
              <p className="text-xs text-[#AEADAB] mt-1">Crea un grupo en «Grupos» para poder asignar este NeuroBot.</p>
            </div>
          ) : (
            <>
              <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4">
                <label htmlFor="goal" className="flex items-center gap-2 text-sm font-medium text-[#191919]">
                  <Target className="w-4 h-4 text-[#2E6FDB]" /> Meta de interacciones
                </label>
                <p className="text-xs text-[#787774] mt-1">
                  Mensajes que el estudiante debe intercambiar con el NeuroBot para completarlo. El progreso es
                  interacciones realizadas / meta.
                </p>
                <input id="goal" type="number" min={data.min_goal} max={data.max_goal} value={goal}
                  onChange={e => setGoal(e.target.value)}
                  className="mt-2 w-28 px-3 py-1.5 border border-[#E9E9E7] rounded-md text-sm focus:outline-none focus:border-[#2E6FDB]" />
                {!goalValid && goal !== '' && (
                  <p className="text-xs text-[#E03E3E] mt-1">Entre {data.min_goal} y {data.max_goal} interacciones.</p>
                )}
              </div>

              <section>
                <h4 className="text-xs font-semibold text-[#787774] uppercase tracking-wide mb-2">Grupos</h4>
                <div className="space-y-2">
                  {data.classrooms.map(c => (
                    <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                      classes.has(c.id) ? 'border-[#2E6FDB] bg-[#EEF3FD]' : 'border-[#E9E9E7]'}`}>
                      <input type="checkbox" checked={classes.has(c.id)} onChange={() => toggle(classes, c.id, setClasses)}
                        aria-label={`Seleccionar ${c.name}`} className="w-4 h-4 accent-[#2E6FDB]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#191919] truncate">{c.name}</p>
                        <p className="text-[11px] text-[#787774]">
                          {c.subject}{c.grade ? ` · ${c.grade}` : ''} · {c.student_count} estudiante(s)
                        </p>
                      </div>
                      {c.assigned && (
                        <>
                          <span className="flex items-center gap-1 text-xs font-medium text-[#0F7B6C]">
                            <CheckCircle className="w-3.5 h-3.5" /> Asignado · meta {c.goal_interactions}
                          </span>
                          <button onClick={() => remove('classrooms', c.id)} disabled={removing !== null}
                            className="text-xs text-[#E03E3E] hover:underline disabled:opacity-50">
                            {removing === `classrooms-${c.id}` ? 'Quitando…' : 'Quitar'}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold text-[#787774] uppercase tracking-wide mb-2">
                  Estudiantes (asignación individual)
                </h4>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-[#AEADAB] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, usuario o grupo"
                    className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-md text-sm focus:outline-none focus:border-[#2E6FDB]" />
                </div>
                {data.students.length === 0 ? (
                  <p className="text-xs text-[#AEADAB]">Tus grupos todavía no tienen estudiantes inscritos.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-[#E9E9E7] rounded-lg divide-y divide-[#F7F6F3]">
                    {filtered.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                        <input type="checkbox" checked={students.has(s.id)} onChange={() => toggle(students, s.id, setStudents)}
                          aria-label={`Seleccionar ${s.full_name}`} className="w-4 h-4 accent-[#2E6FDB]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#191919] truncate">{s.full_name}</p>
                          <p className="text-[11px] text-[#AEADAB] truncate">{s.username} · {s.classrooms.join(', ')}</p>
                        </div>
                        {s.assigned_individually && (
                          <>
                            <span className="text-xs font-medium text-[#0F7B6C] whitespace-nowrap">Asignado · meta {s.goal_interactions}</span>
                            <button onClick={() => remove('students', s.id)} disabled={removing !== null}
                              className="text-xs text-[#E03E3E] hover:underline disabled:opacity-50">
                              {removing === `students-${s.id}` ? 'Quitando…' : 'Quitar'}
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {filtered.length === 0 && <p className="px-3 py-3 text-xs text-[#AEADAB]">Sin resultados.</p>}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#E9E9E7] space-y-2">
          {error && <p className="text-xs text-[#E03E3E]">{error}</p>}
          {result && <p className="text-xs text-[#0F7B6C]">{result}</p>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[#787774] hover:text-[#37352F]">Cerrar</button>
            <button onClick={submit}
              disabled={saving || !goalValid || (classes.size === 0 && students.size === 0)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Asignar{classes.size + students.size > 0 ? ` (${classes.size + students.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
