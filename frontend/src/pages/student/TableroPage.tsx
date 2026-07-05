import { useState } from 'react';
import {
  Megaphone, ClipboardList, Link2, FileText, Bell,
  MessageCircle, Send, Paperclip, ThumbsUp,
} from 'lucide-react';

type PostType = 'anuncio' | 'tarea' | 'recordatorio' | 'enlace' | 'material';

interface Comment {
  id: string;
  author: string;
  isTeacher: boolean;
  text: string;
  time: string;
}

interface Post {
  id: string;
  type: PostType;
  title: string;
  content: string;
  date: string;
  group: string;
  teacherName: string;
  reactions: number;
  userReacted: boolean;
  comments: Comment[];
  attachments: string[];
  dueDate?: string;
}

const TYPE_CONFIG: Record<PostType, { label: string; color: string; bg: string; borderColor: string; icon: any }> = {
  anuncio:      { label: 'Anuncio',      color: 'text-[#2E6FDB]', bg: 'bg-[#EEF3FD]',   borderColor: 'border-[#2E6FDB]',  icon: Megaphone    },
  tarea:        { label: 'Tarea',        color: 'text-[#E03E3E]', bg: 'bg-red-50',       borderColor: 'border-[#E03E3E]',  icon: ClipboardList },
  recordatorio: { label: 'Recordatorio', color: 'text-[#D9730D]', bg: 'bg-orange-50',    borderColor: 'border-[#D9730D]',  icon: Bell         },
  enlace:       { label: 'Enlace',       color: 'text-[#0B6E99]', bg: 'bg-sky-50',       borderColor: 'border-[#0B6E99]',  icon: Link2        },
  material:     { label: 'Material',     color: 'text-[#6940A5]', bg: 'bg-purple-50',    borderColor: 'border-[#6940A5]',  icon: FileText     },
};

const MOCK_POSTS: Post[] = [
  {
    id: 'p1', type: 'anuncio', group: 'Matemáticas 9A',
    teacherName: 'Prof. Carlos Martínez',
    title: 'Bienvenida al segundo semestre 2026',
    content: 'Estimados estudiantes, les doy la bienvenida al segundo período académico. Recuerden revisar el NeuroBots de la clase para repasar los temas del parcial anterior. ¡Mucho ánimo este semestre!',
    date: '2026-07-01',
    reactions: 18, userReacted: false,
    comments: [
      { id: 'c1', author: 'Valentina Torres', isTeacher: false, text: '¡Gracias profe! Lista para este semestre.', time: 'Hace 2h' },
      { id: 'c2', author: 'Prof. Carlos Martínez', isTeacher: true, text: '¡Así se habla Valentina! Éxitos a todos.', time: 'Hace 1h' },
    ],
    attachments: [],
  },
  {
    id: 'p2', type: 'tarea', group: 'Matemáticas 9A',
    teacherName: 'Prof. Carlos Martínez',
    title: 'Tarea #4 — Ecuaciones cuadráticas',
    content: 'Resolver los ejercicios 1 al 15 del capítulo 4 del libro. Mostrar el procedimiento completo. Subir foto o PDF del desarrollo en la plataforma antes de la fecha límite.',
    date: '2026-06-30', dueDate: '2026-07-05',
    reactions: 5, userReacted: true,
    comments: [
      { id: 'c3', author: 'Juan Pérez', isTeacher: false, text: 'Profe, ¿el ejercicio 10 es con fórmula general o completando el cuadrado?', time: 'Hace 3h' },
      { id: 'c4', author: 'Prof. Carlos Martínez', isTeacher: true, text: 'Puedes usar cualquiera de los dos métodos, Juan.', time: 'Hace 2h' },
    ],
    attachments: ['cap4_ejercicios.pdf', 'rubrica_tarea4.pdf'],
  },
  {
    id: 'p3', type: 'recordatorio', group: 'Física 10B',
    teacherName: 'Prof. María López',
    title: 'Parcial de Física — Viernes 5 de julio',
    content: 'Recuerden que el parcial cubre los temas de la Unidad 2: Termodinámica y Ondas. Traer calculadora científica. No se permiten hojas de fórmulas. Duración: 90 minutos.',
    date: '2026-06-28',
    reactions: 12, userReacted: false,
    comments: [],
    attachments: [],
  },
  {
    id: 'p4', type: 'material', group: 'Álgebra 8C',
    teacherName: 'Prof. Ana Torres',
    title: 'Guía de estudio — Funciones lineales',
    content: 'Comparto el material de apoyo para estudiar funciones lineales antes del quiz del miércoles. Incluye ejercicios resueltos y ejercicios de práctica.',
    date: '2026-06-27',
    reactions: 24, userReacted: true,
    comments: [
      { id: 'c5', author: 'Carlos López', isTeacher: false, text: '¡Gracias profe, muy útil!', time: 'Hace 1 día' },
    ],
    attachments: ['funciones_lineales_guia.pdf'],
  },
  {
    id: 'p5', type: 'enlace', group: 'Matemáticas 9A',
    teacherName: 'Prof. Carlos Martínez',
    title: 'Video explicativo — Ecuaciones cuadráticas',
    content: 'Les comparto este video de Khan Academy que explica de forma muy clara el método de la fórmula cuadrática. Perfecto para repasar antes de la tarea.',
    date: '2026-06-25',
    reactions: 8, userReacted: false,
    comments: [],
    attachments: ['https://khanacademy.org/algebra'],
  },
];

export default function TableroPage() {
  const [posts,       setPosts]       = useState<Post[]>(MOCK_POSTS);
  const [filterGroup, setFilterGroup] = useState('Todos');
  const [filterType,  setFilterType]  = useState<PostType | 'todos'>('todos');
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set(['p1', 'p2']));

  const groups = ['Todos', ...Array.from(new Set(MOCK_POSTS.map(p => p.group)))];

  const filtered = posts.filter(p => {
    const gOk = filterGroup === 'Todos' || p.group === filterGroup;
    const tOk = filterType  === 'todos' || p.type  === filterType;
    return gOk && tOk;
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleReaction = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id
      ? { ...p, userReacted: !p.userReacted, reactions: p.userReacted ? p.reactions - 1 : p.reactions + 1 }
      : p
    ));
  };

  const addComment = (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    const c: Comment = { id: Date.now().toString(), author: 'Yo (Estudiante)', isTeacher: false, text, time: 'Ahora' };
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, c] } : p));
    setCommentText(prev => ({ ...prev, [postId]: '' }));
  };

  const today = new Date().toISOString().slice(0, 10);
  const pendingTasks = posts.filter(p => p.type === 'tarea' && p.dueDate && p.dueDate >= today);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#37352F]">Tablero de Clases</h1>
        <p className="text-[#787774] text-sm mt-1">Publicaciones de tus profesores — anuncios, tareas y recursos</p>
      </div>

      {/* Banner tareas pendientes */}
      {pendingTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-3 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-[#E03E3E] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#E03E3E]">
              Tienes {pendingTasks.length} tarea{pendingTasks.length > 1 ? 's' : ''} pendiente{pendingTasks.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[#E03E3E]/80 mt-0.5">
              {pendingTasks.map(t => `${t.title} (vence ${t.dueDate})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="px-3 py-1.5 border border-[#E9E9E7] rounded-lg text-sm text-[#37352F] focus:outline-none focus:ring-1 focus:ring-[#2E6FDB] bg-white"
        >
          {groups.map(g => <option key={g}>{g}</option>)}
        </select>

        <div className="flex gap-1 flex-wrap">
          {(['todos', 'anuncio', 'tarea', 'recordatorio', 'material', 'enlace'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                filterType === t ? 'bg-[#37352F] text-white' : 'bg-[#F7F6F3] text-[#787774] hover:bg-[#E9E9E7]'
              }`}>
              {t}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-[#AEADAB]">{filtered.length} publicaciones</span>
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#787774]">
          <Megaphone className="w-10 h-10 text-[#E9E9E7] mx-auto mb-3" />
          <p className="text-sm">No hay publicaciones para mostrar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => {
            const tc = TYPE_CONFIG[post.type];
            const TypeIcon = tc.icon;
            const isExpanded = expanded.has(post.id);
            const today = new Date().toISOString().slice(0, 10);
            const isOverdue = post.dueDate && post.dueDate < today;
            const isDueSoon = post.dueDate && post.dueDate >= today;

            return (
              <div key={post.id}
                className={`bg-white border border-l-4 ${tc.borderColor} border-[#E9E9E7] rounded-lg overflow-hidden`}>

                <div className="p-5">
                  {/* Header del post */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 ${tc.bg} rounded-md flex items-center justify-center flex-shrink-0`}>
                        <TypeIcon className={`w-4 h-4 ${tc.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${tc.color}`}>{tc.label}</span>
                          <span className="text-[10px] text-[#AEADAB]">· {post.group}</span>
                          <span className="text-[10px] text-[#AEADAB]">· {post.teacherName}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-[#191919] mt-0.5">{post.title}</h3>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#AEADAB] flex-shrink-0 ml-2">{post.date}</span>
                  </div>

                  {/* Contenido */}
                  <p className="text-sm text-[#37352F] leading-relaxed">{post.content}</p>

                  {/* Fecha límite */}
                  {post.dueDate && (
                    <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium ${isOverdue ? 'text-[#E03E3E]' : isDueSoon ? 'text-[#D9730D]' : ''}`}>
                      <ClipboardList className="w-3.5 h-3.5" />
                      Fecha límite: {post.dueDate}
                      {isOverdue && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-[#E03E3E] rounded text-[10px]">Vencida</span>}
                    </div>
                  )}

                  {/* Adjuntos */}
                  {post.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.attachments.map(a => (
                        <button key={a}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md text-xs text-[#787774] hover:bg-[#E9E9E7] transition-colors">
                          <Paperclip className="w-3 h-3" />
                          {a.startsWith('http') ? 'Abrir enlace' : a}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => toggleReaction(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${post.userReacted ? 'text-[#2E6FDB]' : 'text-[#787774] hover:text-[#2E6FDB]'}`}>
                      <ThumbsUp className={`w-3.5 h-3.5 ${post.userReacted ? 'fill-[#2E6FDB]' : ''}`} />
                      {post.reactions} Me gusta
                    </button>

                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#2E6FDB] transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {post.comments.length} comentario{post.comments.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>

                {/* Sección comentarios */}
                {isExpanded && (
                  <div className="border-t border-[#F7F6F3] bg-[#F7F6F3]/50 px-5 py-4 space-y-3">
                    {post.comments.map(c => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          c.isTeacher ? 'bg-[#2E6FDB] text-white' : 'bg-[#EEF3FD] text-[#2E6FDB]'
                        }`}>
                          {c.author.charAt(0)}
                        </div>
                        <div className="flex-1 bg-white border border-[#E9E9E7] rounded-lg px-3 py-2">
                          <p className="text-[11px] font-semibold text-[#191919]">
                            {c.author}
                            {c.isTeacher && <span className="ml-1.5 text-[9px] font-medium px-1.5 py-0.5 bg-[#EEF3FD] text-[#2E6FDB] rounded-full">Profesor</span>}
                            <span className="font-normal text-[#AEADAB] ml-1">· {c.time}</span>
                          </p>
                          <p className="text-xs text-[#37352F] mt-0.5 leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                    ))}

                    {/* Input comentario del estudiante */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <div className="w-7 h-7 rounded-full bg-[#37352F] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        E
                      </div>
                      <input
                        value={commentText[post.id] ?? ''}
                        onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                        placeholder="Escribe un comentario..."
                        className="flex-1 px-3 py-1.5 text-xs border border-[#E9E9E7] rounded-full focus:outline-none focus:ring-1 focus:ring-[#2E6FDB] focus:border-[#2E6FDB] bg-white"
                      />
                      <button onClick={() => addComment(post.id)}
                        disabled={!commentText[post.id]?.trim()}
                        className="w-7 h-7 flex items-center justify-center bg-[#2E6FDB] text-white rounded-full hover:bg-[#255DC0] disabled:opacity-40 transition-all">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
