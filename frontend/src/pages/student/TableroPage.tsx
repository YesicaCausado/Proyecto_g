import { useState, useEffect } from 'react';
import {
  Megaphone, ClipboardList, Link2, FileText, Bell,
  MessageCircle, Send, Paperclip, ThumbsUp, Loader2,
} from 'lucide-react';
import api from '../../services/api';

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

// Convierte un post de la API al formato del componente
function mapPost(raw: any): Post {
  const mapComment = (c: any): Comment => ({
    id:        String(c.id),
    author:    c.author_name ?? '?',
    isTeacher: c.author_role === 'profesor' || c.author_role === 'super_profesor',
    text:      c.content,
    time:      new Date(c.created_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
  });

  return {
    id:          String(raw.id),
    type:        (raw.post_type ?? 'anuncio') as PostType,
    title:       raw.title,
    content:     raw.content ?? '',
    date:        (raw.created_at ?? '').slice(0, 10),
    group:       raw.classroom_name ?? '',
    teacherName: raw.teacher_name ?? 'Profesor',
    reactions:   raw.reactions_count ?? 0,
    userReacted: raw.user_reacted ?? false,
    comments:    (raw.comments ?? []).map(mapComment),
    attachments: (raw.attachments ?? []).map((a: any) => typeof a === 'string' ? a : (a.name ?? a.url ?? '')),
    dueDate:     raw.due_date ?? undefined,
  };
}

export default function TableroPage() {
  const [posts,       setPosts]       = useState<Post[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filterGroup, setFilterGroup] = useState('Todos');
  const [filterType,  setFilterType]  = useState<PostType | 'todos'>('todos');
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  // ── Fetch inicial ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api.get('/posts')
      .then(res => {
        const raw: any[] = res.data.posts ?? [];
        setPosts(raw.map(mapPost));
        // Expandir el primero automáticamente
        if (raw.length > 0) setExpanded(new Set([String(raw[0].id)]));
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = ['Todos', ...Array.from(new Set(posts.map(p => p.group)))];

  const filtered = posts.filter(p => {
    const gOk = filterGroup === 'Todos' || p.group === filterGroup;
    const tOk = filterType  === 'todos' || p.type  === filterType;
    return gOk && tOk;
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleReaction = async (id: string) => {
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === id
      ? { ...p, userReacted: !p.userReacted, reactions: p.userReacted ? p.reactions - 1 : p.reactions + 1 }
      : p
    ));
    try {
      const res = await api.post(`/posts/${id}/reactions`);
      // Sincronizar con la respuesta real del servidor
      setPosts(prev => prev.map(p => p.id === id
        ? { ...p, userReacted: res.data.reacted, reactions: res.data.reactions_count }
        : p
      ));
    } catch {
      // Si falla, revertir
      setPosts(prev => prev.map(p => p.id === id
        ? { ...p, userReacted: !p.userReacted, reactions: p.userReacted ? p.reactions - 1 : p.reactions + 1 }
        : p
      ));
    }
  };

  const addComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    setCommentText(prev => ({ ...prev, [postId]: '' }));
    try {
      const res = await api.post(`/posts/${postId}/comments`, { content: text });
      const newComment: Comment = {
        id:        String(res.data.id),
        author:    res.data.author_name,
        isTeacher: res.data.author_role === 'profesor' || res.data.author_role === 'super_profesor',
        text:      res.data.content,
        time:      new Date(res.data.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      };
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    } catch {
      // Restaurar texto si falla
      setCommentText(prev => ({ ...prev, [postId]: text }));
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const pendingTasks = posts.filter(p => p.type === 'tarea' && p.dueDate && p.dueDate >= today);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-[#787774] animate-spin" />
    </div>
  );

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
