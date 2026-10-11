import { useState, useEffect } from 'react';
import {
  BookOpen, Search, Users, TrendingUp,
  Activity, Eye, Power, RefreshCw, ArrowLeftRight, Loader2, X
} from 'lucide-react';
import api from '../../../services/api';

interface Group {
  id: number; name: string; teacher: string; teacherId: number; subject: string; grade: string;
  students: number; code: string; status: string; avg: number; lastActivity: string;
}

interface GroupDetail {
  id: number; name: string; subject: string; grade: string; description: string; code: string;
  status: string; createdAt: string | null;
  teacher: { id: number; name: string } | null;
  students: { id: number; name: string; email: string; avg: number; lastActivity: string | null }[];
}

interface TeacherOption { id: number; full_name: string; username: string; is_active: boolean }

const errorText = (err: any, fallback: string) => err?.response?.data?.detail || fallback;

export default function GruposTab() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  // Detalle real del grupo (antes el botón decía «disponible próximamente»).
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Transferencia a un profesor real de la institución (antes se escribía un
  // nombre libre y el cambio solo se veía en pantalla).
  const [transfer, setTransfer] = useState<Group | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [newTeacherId, setNewTeacherId] = useState<number | ''>('');
  const [transferError, setTransferError] = useState('');

  const loadGroups = (notify = false) => {
    setLoading(true);
    setLoadError('');
    return api.get('/super/classrooms')
      .then(r => { setGroups(r.data.classrooms ?? []); if (notify) showToast('Datos actualizados'); })
      .catch(err => setLoadError(errorText(err, 'No se pudieron cargar los grupos.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGroups(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Activar / desactivar: se guarda en la base de datos. Un grupo
  // desactivado deja de aparecer a sus estudiantes; se puede reactivar.
  const handleToggleStatus = async (group: Group) => {
    const activate = group.status !== 'activo';
    if (!activate && !window.confirm(`¿Desactivar el grupo «${group.name}»? Sus estudiantes dejarán de verlo hasta que lo reactives.`)) return;
    setBusyId(group.id);
    try {
      const { data } = await api.patch(`/super/classrooms/${group.id}`, { is_active: activate });
      setGroups(prev => prev.map(g => g.id === group.id ? { ...g, status: data.status } : g));
      showToast(`Grupo «${group.name}» ${activate ? 'activado' : 'desactivado'}.`);
    } catch (err) {
      showToast(errorText(err, 'No se pudo cambiar el estado del grupo.'));
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (group: Group) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await api.get(`/super/classrooms/${group.id}`);
      setDetail(data);
    } catch (err) {
      showToast(errorText(err, 'No se pudo cargar el detalle del grupo.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openTransfer = async (group: Group) => {
    setTransfer(group);
    setNewTeacherId('');
    setTransferError('');
    try {
      const { data } = await api.get('/super/teachers');
      setTeachers((Array.isArray(data) ? data : []).filter((t: TeacherOption) => t.is_active && t.id !== group.teacherId));
    } catch (err) {
      setTransferError(errorText(err, 'No se pudo cargar la lista de profesores.'));
    }
  };

  const confirmTransfer = async () => {
    if (!transfer || newTeacherId === '') return;
    setBusyId(transfer.id);
    setTransferError('');
    try {
      const { data } = await api.patch(`/super/classrooms/${transfer.id}`, { teacher_id: newTeacherId });
      setGroups(prev => prev.map(g => g.id === transfer.id ? { ...g, teacher: data.teacher, teacherId: data.teacherId } : g));
      showToast(`Grupo «${transfer.name}» transferido a ${data.teacher}.`);
      setTransfer(null);
    } catch (err) {
      setTransferError(errorText(err, 'No se pudo transferir el grupo.'));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = groups.filter(g =>
    (filterStatus === 'todos' || g.status === filterStatus) &&
    (g.name.toLowerCase().includes(search.toLowerCase()) ||
     g.teacher.toLowerCase().includes(search.toLowerCase()) ||
     g.subject.toLowerCase().includes(search.toLowerCase()))
  );

  const totalStudents = groups.reduce((s, g) => s + g.students, 0);
  const activeGroups  = groups.filter(g => g.status === 'activo').length;
  const avgGlobal     = groups.length > 0 ? (groups.reduce((s, g) => s + g.avg, 0) / groups.length).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 relative">

      {/* Toast de confirmación */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#37352F] text-white px-4 py-2.5 rounded-lg text-sm shadow-lg flex items-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
          {toast}
        </div>
      )}

      {/* Banner de carga */}
      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-sm text-[#787774]">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando grupos…
        </div>
      )}

      {/* KPIs rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: BookOpen, label: 'Grupos activos',      value: activeGroups,   color: 'text-[#0B6E99]', bg: 'bg-[#E5F3FF]' },
          { icon: Users,    label: 'Total estudiantes',   value: totalStudents,  color: 'text-[#0F7B6C]', bg: 'bg-[#EEF8F6]' },
          { icon: TrendingUp, label: 'Promedio global',   value: `${avgGlobal}/10`, color: 'text-[#6940A5]', bg: 'bg-purple-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-[#E9E9E7] rounded-lg p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-md ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs text-[#787774]">{kpi.label}</p>
              <p className="text-xl font-bold text-[#191919]">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de búsqueda + filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEADAB]" />
          <input
            type="text"
            placeholder="Buscar grupo, profesor o materia..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none bg-white"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'activo', 'inactivo'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 text-xs rounded-md border font-medium transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-[#37352F] text-white border-[#37352F]'
                  : 'bg-white text-[#787774] border-[#E9E9E7] hover:bg-[#F7F6F3]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">Grupo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">Profesor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">Grado</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase tracking-wider">Estudiantes</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase tracking-wider">Promedio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">Última actividad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#787774] uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {filtered.map(group => (
              <tr key={group.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[#E5F3FF] rounded-md flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-[#0B6E99]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#191919] text-sm">{group.name}</p>
                      <p className="text-xs text-[#787774] font-mono">{group.code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#F7F6F3] border border-[#E9E9E7] flex items-center justify-center text-[10px] font-bold text-[#787774]">
                      {group.teacher.charAt(0)}
                    </div>
                    <span className="text-sm text-[#37352F]">{group.teacher}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-[#787774]">{group.grade}</td>
                <td className="px-4 py-3.5 text-center">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#191919]">
                    <Users className="w-3.5 h-3.5 text-[#787774]" /> {group.students}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className={`text-sm font-bold ${
                    group.avg >= 8 ? 'text-[#0F7B6C]' : group.avg >= 7 ? 'text-[#D9730D]' : 'text-[#E03E3E]'
                  }`}>
                    {group.avg}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    group.status === 'activo'
                      ? 'bg-[#EEF8F6] text-[#0F7B6C]'
                      : 'bg-[#F7F6F3] text-[#787774]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${group.status === 'activo' ? 'bg-[#0F7B6C]' : 'bg-[#AEADAB]'}`} />
                    {group.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs text-[#787774] flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {group.lastActivity}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Ver detalle"
                      onClick={() => openDetail(group)}
                      className="p-1.5 rounded hover:bg-[#E5F3FF] text-[#787774] hover:text-[#0B6E99] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title={group.status === 'activo' ? 'Desactivar' : 'Activar'}
                      onClick={() => handleToggleStatus(group)}
                      disabled={busyId === group.id}
                      className={`p-1.5 rounded hover:bg-[#F7F6F3] transition-colors disabled:opacity-40 ${
                        group.status === 'activo' ? 'text-[#787774] hover:text-[#E03E3E]' : 'text-[#0F7B6C]'
                      }`}>
                      {busyId === group.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      title="Transferir a otro profesor"
                      onClick={() => openTransfer(group)}
                      className="p-1.5 rounded hover:bg-[#FCF6E5] text-[#787774] hover:text-[#D9730D] transition-colors">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-[#787774]">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>{loadError || 'No se encontraron grupos'}</p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3] flex justify-between items-center">
          <p className="text-xs text-[#787774]">Mostrando {filtered.length} de {groups.length} grupos</p>
          <button
            onClick={() => loadGroups(true)}
            className="flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#37352F] transition-colors">
            <RefreshCw className="w-3 h-3" /> Actualizar
          </button>
        </div>
      </div>

      {/* ── Detalle del grupo ── */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#787774]">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando detalle…
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#191919]">{detail.name}</h3>
                    <p className="text-xs text-[#787774] mt-0.5">
                      {detail.subject} · Grado {detail.grade} · Código <span className="font-mono">{detail.code}</span> · {detail.status}
                    </p>
                  </div>
                  <button onClick={() => setDetail(null)} className="p-1 rounded hover:bg-[#F7F6F3] text-[#787774]" aria-label="Cerrar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-4 text-sm">
                  <p><span className="text-[#787774]">Profesor:</span> <span className="font-medium text-[#191919]">{detail.teacher?.name ?? '—'}</span></p>
                  {detail.description && <p className="text-[#37352F]">{detail.description}</p>}
                  <div>
                    <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mb-2">
                      Estudiantes ({detail.students.length})
                    </p>
                    {detail.students.length === 0 ? (
                      <p className="text-xs text-[#AEADAB]">Aún no hay estudiantes inscritos.</p>
                    ) : (
                      <ul className="divide-y divide-[#F1F1EF] border border-[#E9E9E7] rounded-md">
                        {detail.students.map(st => (
                          <li key={st.id} className="flex items-center justify-between px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm text-[#191919] truncate">{st.name}</p>
                              <p className="text-[11px] text-[#AEADAB] truncate">{st.email}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-[#37352F]">{st.avg}/10</p>
                              <p className="text-[10px] text-[#AEADAB]">{st.lastActivity ?? 'Sin actividad'}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Transferir a otro profesor ── */}
      {transfer && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setTransfer(null)}>
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-[#191919]">Transferir «{transfer.name}»</h3>
              <p className="text-xs text-[#787774] mt-1">
                El grupo, sus estudiantes y su contenido pasan al profesor que elijas. Profesor actual: {transfer.teacher}.
              </p>
            </div>
            <select
              value={newTeacherId}
              onChange={e => setNewTeacherId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#37352F] bg-white"
            >
              <option value="">Elige un profesor…</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name || t.username}</option>
              ))}
            </select>
            {teachers.length === 0 && !transferError && (
              <p className="text-xs text-[#AEADAB]">No hay otros profesores activos en la institución.</p>
            )}
            {transferError && <p className="text-xs text-[#E03E3E]">{transferError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setTransfer(null)} className="px-3 py-2 text-sm rounded-md border border-[#E9E9E7] hover:bg-[#F7F6F3]">
                Cancelar
              </button>
              <button
                onClick={confirmTransfer}
                disabled={newTeacherId === '' || busyId === transfer.id}
                className="px-3 py-2 text-sm rounded-md bg-[#37352F] text-white hover:bg-[#191919] disabled:opacity-40"
              >
                {busyId === transfer.id ? 'Transfiriendo…' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
