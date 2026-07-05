import { useState, useEffect } from 'react';
import {
  BookOpen, Search, Users, TrendingUp,
  Activity, Eye, Edit3, Trash2, RefreshCw, ArrowLeftRight, Loader2
} from 'lucide-react';
import api from '../../../services/api';

interface Group {
  id: number; name: string; teacher: string; subject: string; grade: string;
  students: number; code: string; status: string; avg: number; lastActivity: string;
}

export default function GruposTab() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.get('/super/classrooms')
      .then(r => setGroups(r.data.classrooms ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el grupo "${name}"? Esta acción no se puede deshacer.`)) {
      setGroups(prev => prev.filter(g => g.id !== id));
      showToast(`Grupo "${name}" eliminado correctamente.`);
    }
  };

  const handleToggleStatus = (id: number) => {
    setGroups(prev => prev.map(g =>
      g.id === id ? { ...g, status: g.status === 'activo' ? 'inactivo' : 'activo' } : g
    ));
    const g = groups.find(g => g.id === id);
    showToast(`Grupo "${g?.name}" ${g?.status === 'activo' ? 'desactivado' : 'activado'}.`);
  };

  const handleTransfer = (name: string) => {
    const newTeacher = window.prompt(`Transferir grupo "${name}" a un nuevo profesor. Ingresa el nombre del docente:`);
    if (newTeacher?.trim()) {
      setGroups(prev => prev.map(g => g.name === name ? { ...g, teacher: newTeacher.trim() } : g));
      showToast(`Grupo "${name}" transferido a ${newTeacher.trim()}.`);
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
      <div className="grid grid-cols-3 gap-4">
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
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
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
                      onClick={() => showToast(`Ver grupo: ${group.name} (disponible próximamente)`)}
                      className="p-1.5 rounded hover:bg-[#E5F3FF] text-[#787774] hover:text-[#0B6E99] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title={group.status === 'activo' ? 'Desactivar' : 'Activar'}
                      onClick={() => handleToggleStatus(group.id)}
                      className="p-1.5 rounded hover:bg-[#F7F6F3] text-[#787774] hover:text-[#37352F] transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Transferir a otro profesor"
                      onClick={() => handleTransfer(group.name)}
                      className="p-1.5 rounded hover:bg-[#FCF6E5] text-[#787774] hover:text-[#D9730D] transition-colors">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Eliminar grupo"
                      onClick={() => handleDelete(group.id, group.name)}
                      className="p-1.5 rounded hover:bg-[#FDEEEE] text-[#787774] hover:text-[#E03E3E] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#787774]">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No se encontraron grupos</p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3] flex justify-between items-center">
          <p className="text-xs text-[#787774]">Mostrando {filtered.length} de {groups.length} grupos</p>
          <button
            onClick={() => {
              setLoading(true);
              api.get('/super/classrooms')
                .then(r => setGroups(r.data.classrooms ?? []))
                .catch(() => {})
                .finally(() => { setLoading(false); showToast('Datos actualizados'); });
            }}
            className="flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#37352F] transition-colors">
            <RefreshCw className="w-3 h-3" /> Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
