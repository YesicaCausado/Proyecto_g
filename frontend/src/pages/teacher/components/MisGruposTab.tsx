import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Copy, RefreshCw, Users, BookOpen, MoreVertical,
  Check, ChevronLeft, Megaphone, ClipboardList, UserCheck,
  Eye, EyeOff, Loader2, UserMinus, UserPlus,
} from 'lucide-react';
import api from '../../../services/api';

interface Group {
  id: string;
  name: string;
  subject: string;
  grade: string;
  description: string;
  color: string;
  students: number;
  avg: number | null;   // null = ningún estudiante con sesiones
  code: string;
  active: boolean;
  created: string;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  avg: number | null;
  last: string;
  status: 'risk' | 'active' | 'inactive';
}

const COLORS = [
  { name: 'Azul',    value: '#2E6FDB' },
  { name: 'Verde',   value: '#0F7B6C' },
  { name: 'Naranja', value: '#D9730D' },
  { name: 'Morado',  value: '#6940A5' },
  { name: 'Rojo',    value: '#E03E3E' },
  { name: 'Teal',    value: '#0B6E99' },
];

function mapGroup(raw: any): Group {
  return {
    id:          String(raw.id),
    name:        raw.name,
    subject:     raw.subject,
    grade:       raw.grade ?? '',
    description: raw.description ?? '',
    color:       raw.color ?? COLORS[0].value,
    students:    raw.student_count ?? 0,
    avg:         raw.avg ?? null,
    code:        raw.invite_code ?? raw.code ?? '',
    active:      raw.is_active ?? true,
    created:     (raw.created_at ?? '').slice(0, 10),
  };
}

// GET /classrooms/{id}/students → EnrollmentResponse (student_name,
// student_email, student_id). Antes se leían full_name/email, que no
// existen en esa respuesta, y todos los nombres salían como «—».
function mapStudent(raw: any): StudentRow {
  const sessions = raw.total_sessions ?? 0;
  const inactiveDays = raw.last_activity ? (Date.now() - new Date(raw.last_activity).getTime()) / 86400_000 : null;
  return {
    id:     String(raw.student_id ?? raw.id ?? ''),
    name:   raw.student_name || raw.student_username || '—',
    email:  raw.student_email || '—',
    avg:    sessions > 0 && raw.average_score != null ? Math.round(raw.average_score) / 10 : null,
    last:   raw.last_activity ? new Date(raw.last_activity).toLocaleDateString('es-CO') : 'Sin actividad',
    // Mismas reglas que NeuroAlertas: riesgo calculado, promedio < 40 % con
    // 3+ sesiones o 7+ días sin actividad. Sin sesiones no es «en riesgo».
    status: (raw.risk_level === 'medium' || raw.risk_level === 'high'
             || (sessions >= 3 && raw.average_score < 40)
             || (inactiveDays != null && inactiveDays >= 7)) ? 'risk'
           : sessions === 0 ? 'inactive' : 'active',
  };
}

interface RemovedRow {
  id: string;
  name: string;
  email: string;
  removedAt: string;
}

function apiDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : fallback;
}

// ── Vista detalle de un grupo ────────────────────────────────────────────────
function GroupDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const [tab, setTab] = useState<'inicio' | 'tablero' | 'estudiantes'>('inicio');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [removed, setRemoved] = useState<RemovedRow[]>([]);
  const [busyStudent, setBusyStudent] = useState<string | null>(null);
  const [studentNotice, setStudentNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const loadStudents = useCallback(() => {
    setLoadingStudents(true);
    setStudentsError('');
    Promise.all([
      api.get(`/classrooms/${group.id}/students`, { params: { _t: Date.now() } }),
      api.get(`/classrooms/${group.id}/removed-students`, { params: { _t: Date.now() } }),
    ])
      .then(([active, gone]) => {
        setStudents((active.data ?? []).map(mapStudent));
        setRemoved((gone.data ?? []).map((r: { student_id: number; student_name: string; student_email: string; removed_at: string | null }) => ({
          id: String(r.student_id),
          name: r.student_name,
          email: r.student_email || '—',
          removedAt: r.removed_at ? new Date(r.removed_at).toLocaleDateString('es-CO') : '—',
        })));
      })
      .catch(() => { setStudents([]); setRemoved([]); setStudentsError('No fue posible cargar los estudiantes del grupo.'); })
      .finally(() => setLoadingStudents(false));
  }, [group.id]);

  useEffect(() => {
    if (tab === 'estudiantes') loadStudents();
  }, [tab, loadStudents]);

  // El retiro revoca el acceso al grupo (actividades, material, NeuroBots del
  // grupo) sin borrar su historial. Ningún código lo vuelve a inscribir: solo
  // «Reincorporar».
  const removeStudent = async (s: StudentRow) => {
    if (!window.confirm(`¿Retirar a ${s.name} de «${group.name}»? Dejará de ver las actividades, el material y los NeuroBots del grupo. Su historial se conserva y no podrá volver con el código: solo si lo reincorporas.`)) return;
    setBusyStudent(s.id);
    setStudentNotice(null);
    try {
      await api.delete(`/classrooms/${group.id}/students/${s.id}`);
      setStudentNotice({ kind: 'ok', text: `${s.name} fue retirado del grupo.` });
      loadStudents();
    } catch (err) {
      setStudentNotice({ kind: 'error', text: apiDetail(err, 'No fue posible retirar al estudiante.') });
    } finally {
      setBusyStudent(null);
    }
  };

  const reinstateStudent = async (r: RemovedRow) => {
    if (!window.confirm(`¿Reincorporar a ${r.name} a «${group.name}»?`)) return;
    setBusyStudent(r.id);
    setStudentNotice(null);
    try {
      await api.post(`/classrooms/${group.id}/students/${r.id}/reinstate`);
      setStudentNotice({ kind: 'ok', text: `${r.name} fue reincorporado al grupo.` });
      loadStudents();
    } catch (err) {
      setStudentNotice({ kind: 'error', text: apiDetail(err, 'No fue posible reincorporar al estudiante.') });
    } finally {
      setBusyStudent(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header grupo */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F] transition-colors">
          <ChevronLeft className="w-4 h-4" /> Mis Grupos
        </button>
      </div>

      <div className="flex items-center gap-4 bg-white border border-[#E9E9E7] rounded-lg p-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ background: group.color }}>
          {group.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#191919]">{group.name}</h2>
          <p className="text-sm text-[#787774]">{group.subject} · Grado {group.grade}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#787774]">Código</p>
          <code className="text-sm font-mono font-bold text-[#191919] bg-[#F7F6F3] px-2 py-0.5 rounded">{group.code}</code>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E9E9E7]">
        {[
          { id:'inicio',      label:'Inicio',       icon: BookOpen      },
          { id:'tablero',     label:'Tablero',      icon: Megaphone     },
          { id:'estudiantes', label:'Estudiantes',  icon: Users         },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-[#2E6FDB] text-[#2E6FDB]' : 'border-transparent text-[#787774] hover:text-[#37352F]'
              }`}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {tab === 'inicio' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label:'Estudiantes', value: group.students, icon: Users      },
            { label:'Promedio',    value: group.avg != null ? `${group.avg}/10` : 'Sin datos', icon: ClipboardList },
            { label:'Creado',      value: group.created || '—', icon: BookOpen },
            { label:'Estado',     value: group.active ? 'Activo' : 'Inactivo', icon: UserCheck },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white border border-[#E9E9E7] rounded-lg p-4">
                <Icon className="w-4 h-4 text-[#787774] mb-2" />
                <p className="text-xl font-bold text-[#191919]">{c.value}</p>
                <p className="text-xs text-[#787774]">{c.label}</p>
              </div>
            );
          })}
          <div className="col-span-full bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4 text-center">
            <p className="text-sm text-[#787774]">Descripción: <span className="text-[#37352F]">{group.description || 'Sin descripción'}</span></p>
          </div>
        </div>
      )}

      {tab === 'tablero' && (
        <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-8 text-center">
          <Megaphone className="w-10 h-10 text-[#AEADAB] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#787774]">El tablero de publicaciones está disponible</p>
          <p className="text-xs text-[#AEADAB] mt-1">Ve al módulo "Tablero" para publicar anuncios y tareas</p>
        </div>
      )}

      {tab === 'estudiantes' && studentNotice && (
        <div role="status" className={`px-4 py-2.5 rounded-lg text-sm border ${studentNotice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-[#0F7B6C]' : 'bg-red-50 border-red-200 text-[#E03E3E]'}`}>
          {studentNotice.text}
        </div>
      )}

      {tab === 'estudiantes' && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden overflow-x-auto">
          {loadingStudents ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-[#787774]">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando estudiantes…
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">Estudiante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">Correo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Promedio</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Última conexión</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#787774] uppercase"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: StudentRow) => (
                <tr key={s.id} className="border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-medium text-[#191919]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#787774] text-xs">{s.email}</td>
                  <td className="px-4 py-3 text-center">
                    {s.avg == null
                      ? <span className="text-xs text-[#AEADAB]">—</span>
                      : <span className={`text-sm font-bold ${s.avg < 6 ? 'text-[#E03E3E]' : s.avg < 7.5 ? 'text-[#D9730D]' : 'text-[#0F7B6C]'}`}>{s.avg}</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[#787774]">{s.last}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      s.status === 'risk' ? 'bg-red-50 text-[#E03E3E]' : s.status === 'inactive' ? 'bg-[#F7F6F3] text-[#787774]' : 'bg-emerald-50 text-[#0F7B6C]'}`}>
                      {s.status === 'risk' ? 'En riesgo' : s.status === 'inactive' ? 'Sin sesiones' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeStudent(s)} disabled={busyStudent === s.id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#787774] hover:text-[#E03E3E] hover:bg-red-50 rounded disabled:opacity-50"
                      title="Retirar del grupo">
                      {busyStudent === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />} Retirar
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={6} className={`text-center py-8 text-xs ${studentsError ? 'text-[#E03E3E]' : 'text-[#787774]'}`}>{studentsError || 'Sin estudiantes inscritos aún.'}</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      )}

      {tab === 'estudiantes' && !loadingStudents && removed.length > 0 && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <p className="text-xs font-semibold text-[#787774] uppercase">Retirados ({removed.length})</p>
            <p className="text-[11px] text-[#9B9A97] mt-0.5">No pueden volver con el código del grupo; solo si los reincorporas.</p>
          </div>
          <ul>
            {removed.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F7F6F3] last:border-0 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#191919] truncate">{r.name}</p>
                  <p className="text-xs text-[#787774] truncate">{r.email} · retirado el {r.removedAt}</p>
                </div>
                <button onClick={() => reinstateStudent(r)} disabled={busyStudent === r.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#2E6FDB] hover:bg-[#EEF3FD] rounded disabled:opacity-50">
                  {busyStudent === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Reincorporar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MisGruposTab() {
  const [groups,      setGroups]      = useState<Group[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [notice,      setNotice]      = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busyId,      setBusyId]      = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [creating,    setCreating]    = useState(false);
  const [selected,    setSelected]    = useState<Group | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [menuId,      setMenuId]      = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', subject: '', grade: '', description: '',
    color: COLORS[0].value,
  });

  useEffect(() => {
    api.get('/classrooms/my-classes')
      .then(r => setGroups((r.data.classrooms ?? []).map(mapGroup)))
      .catch(() => { setGroups([]); setLoadError('No fue posible cargar tus grupos.'); })
      .finally(() => setLoading(false));
  }, []);

  const usedGroups = groups.length;

  const errorText = (err: any, fallback: string) => {
    const detail = err?.response?.data?.detail;
    return typeof detail === 'string' ? detail : fallback;
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // RF-39: el código anterior deja de servir para unirse al grupo.
  const regenerateCode = async (group: Group) => {
    if (!window.confirm(`¿Generar un código nuevo para «${group.name}»? El código ${group.code} dejará de funcionar.`)) return;
    setBusyId(group.id);
    setNotice(null);
    try {
      const { data } = await api.post(`/classrooms/${group.id}/regenerate-code`);
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, code: data.invite_code } : g));
      setNotice({ kind: 'ok', text: `Nuevo código de «${group.name}»: ${data.invite_code}` });
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err, 'No fue posible generar un código nuevo.') });
    } finally {
      setBusyId(null);
    }
  };

  // El backend desactiva el grupo (no lo borra): sus estudiantes dejan de
  // verlo y el Súper Profesor puede reactivarlo desde Grupos.
  const deactivateGroup = async (group: Group) => {
    if (!window.confirm(`¿Desactivar el grupo «${group.name}»? Sus estudiantes dejarán de verlo. Solo el Súper Profesor podrá reactivarlo.`)) return;
    setBusyId(group.id);
    setNotice(null);
    try {
      await api.delete(`/classrooms/${group.id}`);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setNotice({ kind: 'ok', text: `Grupo «${group.name}» desactivado.` });
    } catch (err) {
      setNotice({ kind: 'error', text: errorText(err, 'No fue posible desactivar el grupo.') });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await api.post('/classrooms/', {
        name:         form.name.trim(),
        subject:      form.subject.trim(),
        grade:        form.grade,
        description:  form.description,
        max_students: 40,
        color:        form.color,
      });
      setGroups(prev => [mapGroup(res.data), ...prev]);
      setShowModal(false);
      setForm({ name:'', subject:'', grade:'', description:'', color: COLORS[0].value });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Error al crear el grupo. Intenta de nuevo.';
      setCreateError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setCreating(false);
    }
  };

  if (selected) return <GroupDetail group={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-5">

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2 text-sm text-[#787774]">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando grupos…
        </div>
      )}

      {(loadError || notice) && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${
          loadError || notice?.kind === 'error' ? 'bg-red-50 border-red-100 text-[#E03E3E]' : 'bg-emerald-50 border-emerald-100 text-[#0F7B6C]'}`}>
          {loadError || notice?.text}
        </div>
      )}

      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#787774]">
            <span className="font-semibold text-[#191919]">{usedGroups}</span> {usedGroups === 1 ? 'grupo' : 'grupos'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Crear Grupo
        </button>
      </div>

      {/* Grid de grupos */}
      {groups.length === 0 && !loading && !loadError ? (
        <div className="bg-white border border-dashed border-[#E9E9E7] rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-[#E9E9E7] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#787774]">No tienes grupos creados</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-[#2E6FDB] hover:underline">Crear mi primer grupo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map(g => (
            <div key={g.id} className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden hover:shadow-sm transition-all group">
              {/* Color strip */}
              <div className="h-1.5 w-full" style={{ background: g.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <button onClick={() => setSelected(g)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: g.color }}>
                      {g.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#191919] text-sm truncate">{g.name}</p>
                      <p className="text-xs text-[#787774]">{g.subject} · {g.grade}</p>
                    </div>
                  </button>
                  {/* Menu */}
                  <div className="relative">
                    <button onClick={() => setMenuId(menuId === g.id ? null : g.id)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774]">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuId === g.id && (
                      <div className="absolute right-0 top-8 bg-white border border-[#E9E9E7] rounded-lg shadow-lg z-20 w-36 py-1" onMouseLeave={() => setMenuId(null)}>
                        <button onClick={() => { setSelected(g); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#37352F] hover:bg-[#F7F6F3]">
                          <Eye className="w-3.5 h-3.5" /> Ver grupo
                        </button>
                        <button onClick={() => { regenerateCode(g); setMenuId(null); }}
                          disabled={busyId === g.id}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#37352F] hover:bg-[#F7F6F3] disabled:opacity-50">
                          <RefreshCw className="w-3.5 h-3.5" /> Nuevo código
                        </button>
                        <hr className="my-1 border-[#E9E9E7]" />
                        <button onClick={() => { deactivateGroup(g); setMenuId(null); }}
                          disabled={busyId === g.id}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E03E3E] hover:bg-red-50 disabled:opacity-50">
                          <EyeOff className="w-3.5 h-3.5" /> Desactivar grupo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3 text-xs text-[#787774]">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.students} est.</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{g.avg != null ? `Prom. ${g.avg}/10` : 'Sin promedio aún'}</span>
                  {!g.active && (
                    <span className="ml-auto px-1.5 py-0.5 bg-[#F7F6F3] text-[#AEADAB] rounded text-[10px]">Inactivo</span>
                  )}
                </div>

                {/* Código de invitación */}
                <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-2.5">
                  <p className="text-[10px] text-[#AEADAB] mb-1 font-medium">CÓDIGO DE INVITACIÓN</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs font-bold text-[#191919] tracking-wider">{g.code}</code>
                    <div className="flex gap-1">
                      <button onClick={() => copyCode(g.id, g.code)}
                        title="Copiar código"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-[#787774] hover:text-[#2E6FDB] transition-colors">
                        {copiedId === g.id ? <Check className="w-3.5 h-3.5 text-[#0F7B6C]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
              
                      <button onClick={() => regenerateCode(g)} title="Generar un código nuevo" disabled={busyId === g.id}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-[#787774] hover:text-[#D9730D] transition-colors disabled:opacity-50">
                        {busyId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal crear grupo ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-h-[90dvh] overflow-y-auto max-w-md">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
              <h3 className="font-semibold text-[#191919]">Crear nuevo grupo</h3>
              <button onClick={() => setShowModal(false)} className="text-[#787774] hover:text-[#37352F] text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Nombre del grupo *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  placeholder="ej. Matemáticas 9A"
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Materia *</label>
                  <input value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))}
                    placeholder="ej. Matemáticas"
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Grado</label>
                  <input value={form.grade} onChange={e => setForm(p => ({...p, grade: e.target.value}))}
                    placeholder="ej. 9°A"
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Descripción (opcional)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  placeholder="Breve descripción del grupo..."
                  rows={2}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Color del grupo</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setForm(p => ({...p, color: c.value}))}
                      title={c.name}
                      className={`w-7 h-7 rounded-full transition-all ${form.color === c.value ? 'ring-2 ring-offset-2 ring-[#37352F] scale-110' : ''}`}
                      style={{ background: c.value }} />
                  ))}
                </div>
              </div>
              {/* Se retiró «Imagen (opcional)»: solo guardaba el nombre del
                  archivo en pantalla; el grupo no tiene dónde almacenar una imagen. */}
            </div>
            <div className="px-6 pb-5 flex flex-col gap-2">
              {createError && (
                <p className="text-xs text-[#E03E3E] bg-red-50 border border-red-100 rounded-lg px-3 py-2">{createError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowModal(false); setCreateError(''); }}
                  className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg transition-colors">Cancelar</button>
                <button onClick={handleCreate} disabled={!form.name.trim() || !form.subject.trim() || creating}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {creating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                    : <><Plus className="w-4 h-4" />Crear Grupo</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
