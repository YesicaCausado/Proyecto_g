import { useState, useRef } from 'react';
import {
  Plus, Copy, Share2, RefreshCw, Users, BookOpen, MoreVertical,
  Check, ChevronLeft, Megaphone, ClipboardList, UserCheck,
  Trash2, Eye, EyeOff,
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  subject: string;
  grade: string;
  description: string;
  color: string;
  students: number;
  avg: number;
  code: string;
  active: boolean;
  created: string;
}

const COLORS = [
  { name: 'Azul',    value: '#2E6FDB' },
  { name: 'Verde',   value: '#0F7B6C' },
  { name: 'Naranja', value: '#D9730D' },
  { name: 'Morado',  value: '#6940A5' },
  { name: 'Rojo',    value: '#E03E3E' },
  { name: 'Teal',    value: '#0B6E99' },
];

function generateCode(subject: string): string {
  const prefix  = subject.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  const chars   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand    = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${rand(4)}-${rand(4)}`;
}

const MOCK_GROUPS: Group[] = [
  { id: '1', name: 'Matemáticas 9A',  subject: 'Matemáticas',  grade: '9°A',  description: 'Álgebra, geometría y cálculo introductorio.', color: '#2E6FDB', students: 32, avg: 8.2, code: 'MATE-7XQ9-LP2K', active: true,  created: '2026-02-10' },
  { id: '2', name: 'Física 10B',      subject: 'Física',        grade: '10°B', description: 'Mecánica, termodinámica y electromagnetismo.',  color: '#0F7B6C', students: 28, avg: 7.6, code: 'FISI-4RTZ-AB2D', active: true,  created: '2026-02-11' },
  { id: '3', name: 'Álgebra 8C',      subject: 'Álgebra',       grade: '8°C',  description: 'Fundamentos de álgebra y ecuaciones.',          color: '#D9730D', students: 30, avg: 6.9, code: 'ALGE-NW7H-XQ3P', active: true,  created: '2026-02-12' },
  { id: '4', name: 'Cálculo 11A',     subject: 'Cálculo',       grade: '11°A', description: 'Cálculo diferencial e integral.',               color: '#6940A5', students: 25, avg: 8.8, code: 'CALC-3MPN-VF9J', active: true,  created: '2026-02-13' },
  { id: '5', name: 'Geometría 7A',    subject: 'Geometría',     grade: '7°A',  description: 'Geometría plana y trigonometría básica.',       color: '#0B6E99', students: 33, avg: 7.1, code: 'GEOM-HK2L-ZQ4R', active: false, created: '2026-02-14' },
  { id: '6', name: 'Estadística 10A', subject: 'Estadística',   grade: '10°A', description: 'Probabilidad y estadística descriptiva.',       color: '#E03E3E', students: 29, avg: 7.8, code: 'ESTA-PV5W-YN8S', active: true,  created: '2026-02-15' },
];

const MOCK_STUDENTS = [
  { id:'s1', name:'Valentina Torres', email:'v.torres@escuela.edu', avg:9.4, last:'Hoy',        status:'active' },
  { id:'s2', name:'Carlos Silva',     email:'c.silva@escuela.edu',  avg:9.1, last:'Hoy',        status:'active' },
  { id:'s3', name:'María González',   email:'m.gonzalez@escuela.edu',avg:8.7,last:'Ayer',       status:'active' },
  { id:'s4', name:'Juan Pérez',       email:'j.perez@escuela.edu',  avg:4.2, last:'Hace 3 días',status:'risk'   },
  { id:'s5', name:'Ana Rodríguez',    email:'a.rodriguez@escuela.edu',avg:7.5,last:'Hace 2 días',status:'active'},
];

// ── Vista detalle de un grupo ────────────────────────────────────────────────
function GroupDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const [tab, setTab] = useState<'inicio' | 'tablero' | 'estudiantes'>('inicio');

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
            { label:'Promedio',    value: `${group.avg}/10`, icon: ClipboardList },
            { label:'Tareas activas', value: '3', icon: ClipboardList     },
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
            <p className="text-sm text-[#787774]">Descripción: <span className="text-[#37352F]">{group.description}</span></p>
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

      {tab === 'estudiantes' && (
        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">Estudiante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">Correo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Promedio</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Última conexión</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_STUDENTS.map(s => (
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
                    <span className={`text-sm font-bold ${s.avg < 6 ? 'text-[#E03E3E]' : s.avg < 7.5 ? 'text-[#D9730D]' : 'text-[#0F7B6C]'}`}>{s.avg}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[#787774]">{s.last}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${s.status === 'risk' ? 'bg-red-50 text-[#E03E3E]' : 'bg-emerald-50 text-[#0F7B6C]'}`}>
                      {s.status === 'risk' ? 'En riesgo' : 'Activo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MisGruposTab({ license }: { license: any }) {
  const [groups,      setGroups]      = useState<Group[]>(MOCK_GROUPS);
  const [selected,    setSelected]    = useState<Group | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [menuId,      setMenuId]      = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', subject: '', grade: '', description: '',
    color: COLORS[0].value, image: '',
  });

  const maxGroups  = license?.groups_limit  ?? 10;
  const usedGroups = groups.length;

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerateCode = (id: string) => {
    setGroups(prev => prev.map(g => g.id === id
      ? { ...g, code: generateCode(g.subject) } : g));
  };

  const toggleActive = (id: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, active: !g.active } : g));
  };

  const deleteGroup = (id: string) => {
    if (!window.confirm('¿Eliminar este grupo? Esta acción no se puede deshacer.')) return;
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.subject.trim()) return;
    const newGroup: Group = {
      id:          Date.now().toString(),
      name:        form.name.trim(),
      subject:     form.subject.trim(),
      grade:       form.grade,
      description: form.description,
      color:       form.color,
      students:    0,
      avg:         0,
      code:        generateCode(form.subject),
      active:      true,
      created:     new Date().toISOString().slice(0, 10),
    };
    setGroups(prev => [newGroup, ...prev]);
    setShowModal(false);
    setForm({ name:'', subject:'', grade:'', description:'', color: COLORS[0].value, image:'' });
  };

  if (selected) return <GroupDetail group={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-5">

      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#787774]">
            <span className="font-semibold text-[#191919]">{usedGroups}</span> de {maxGroups} grupos — plan {license?.plan ?? 'básica'}
          </p>
          <div className="mt-1 w-40 h-1.5 bg-[#E9E9E7] rounded-full overflow-hidden">
            <div className="h-full bg-[#2E6FDB] rounded-full" style={{ width: `${Math.min((usedGroups / maxGroups) * 100, 100)}%` }} />
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={usedGroups >= maxGroups}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Crear Grupo
        </button>
      </div>

      {/* Grid de grupos */}
      {groups.length === 0 ? (
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
                        <button onClick={() => { toggleActive(g.id); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#37352F] hover:bg-[#F7F6F3]">
                          {g.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {g.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => { regenerateCode(g.id); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#37352F] hover:bg-[#F7F6F3]">
                          <RefreshCw className="w-3.5 h-3.5" /> Nuevo código
                        </button>
                        <hr className="my-1 border-[#E9E9E7]" />
                        <button onClick={() => { deleteGroup(g.id); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E03E3E] hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3 text-xs text-[#787774]">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.students} est.</span>
                  {g.avg > 0 && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />Prom. {g.avg}</span>}
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
                      <button
                        onClick={() => navigator.share?.({ title: g.name, text: `Únete a ${g.name} con el código: ${g.code}`, url: window.location.href })}
                        title="Compartir"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-[#787774] hover:text-[#2E6FDB] transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => regenerateCode(g.id)} title="Regenerar"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-[#787774] hover:text-[#D9730D] transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
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
              <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Imagen (opcional)</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => setForm(p => ({...p, image: e.target.files?.[0]?.name ?? ''}))} />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-2.5 border border-dashed border-[#E9E9E7] rounded-lg text-xs text-[#787774] hover:bg-[#F7F6F3] transition-colors">
                  {form.image ? `✓ ${form.image}` : '+ Subir imagen del grupo'}
                </button>
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.name.trim() || !form.subject.trim()}
                className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <Plus className="w-4 h-4 inline mr-1.5" />Crear Grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
