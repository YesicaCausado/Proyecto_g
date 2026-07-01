import { useState, useRef } from 'react';
import {
  Megaphone, ClipboardList, Link2, FileText,
  Plus, MessageCircle, Send, Paperclip,
  MoreVertical, BookOpen, X,
} from 'lucide-react';

type PostType = 'anuncio' | 'tarea' | 'recordatorio' | 'enlace' | 'material';

interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
}

interface Post {
  id: string;
  type: PostType;
  title: string;
  content: string;
  date: string;
  group: string;
  reactions: { emoji: string; count: number }[];
  comments: Comment[];
  attachments: string[];
  dueDate?: string;
}

const GROUPS = ['Matemáticas 9A','Física 10B','Álgebra 8C','Cálculo 11A'];

const MOCK_POSTS: Post[] = [
  {
    id:'p1', type:'anuncio', group:'Todos los grupos',
    title:'Bienvenida al segundo semestre',
    content:'Estimados estudiantes, les damos la bienvenida al segundo período académico 2026. Recuerden revisar el NeuroBots para repasar los temas del parcial.',
    date:'2026-07-01', reactions:[{emoji:'👍',count:18},{emoji:'❤️',count:7},{emoji:'😊',count:4}],
    comments:[
      {id:'c1',author:'Valentina Torres',text:'¡Gracias profe! Lista para el semestre.',date:'Hace 2h'},
      {id:'c2',author:'Carlos Silva',text:'¿El examen parcial es el 15 o el 18?',date:'Hace 1h'},
    ],
    attachments:[],
  },
  {
    id:'p2', type:'tarea', group:'Matemáticas 9A',
    title:'Tarea #4 — Ecuaciones cuadráticas',
    content:'Resolver los ejercicios 1 al 15 del capítulo 4. Subir foto del desarrollo en la plataforma. Recuerden mostrar el procedimiento completo.',
    date:'2026-06-30', dueDate:'2026-07-05',
    reactions:[{emoji:'👍',count:12},{emoji:'😅',count:8}],
    comments:[{id:'c3',author:'Juan Pérez',text:'¿El ejercicio 10 es con fórmula general?',date:'Hace 3h'}],
    attachments:['cap4_ejercicios.pdf'],
  },
  {
    id:'p3', type:'recordatorio', group:'Física 10B',
    title:'Parcial de Física — Viernes 5 de julio',
    content:'Recuerden que el parcial cubre los temas de la Unidad 2: Termodinámica y Ondas. Traer calculadora científica.',
    date:'2026-06-28',
    reactions:[{emoji:'😰',count:15},{emoji:'💪',count:10}],
    comments:[],
    attachments:[],
  },
];

const TYPE_CONFIG: Record<PostType, { label:string; color:string; bg:string; icon:any; borderColor:string }> = {
  anuncio:     { label:'Anuncio',     color:'text-[#2E6FDB]', bg:'bg-[#EEF3FD]',  icon:Megaphone,  borderColor:'border-[#2E6FDB]'  },
  tarea:       { label:'Tarea',       color:'text-[#E03E3E]', bg:'bg-red-50',      icon:ClipboardList,borderColor:'border-[#E03E3E]'},
  recordatorio:{ label:'Recordatorio',color:'text-[#D9730D]', bg:'bg-orange-50',   icon:Megaphone,  borderColor:'border-[#D9730D]'  },
  enlace:      { label:'Enlace',      color:'text-[#0B6E99]', bg:'bg-sky-50',      icon:Link2,      borderColor:'border-[#0B6E99]'  },
  material:    { label:'Material',    color:'text-[#6940A5]', bg:'bg-purple-50',   icon:FileText,   borderColor:'border-[#6940A5]'  },
};

const REACTION_EMOJIS = ['👍','❤️','😊','😮','😂','💪'];

export default function TableroTab() {
  const [posts,       setPosts]       = useState<Post[]>(MOCK_POSTS);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('Todos los grupos');
  const [commentText,   setCommentText]   = useState<Record<string, string>>({});
  const [expandComments, setExpandComments] = useState<Set<string>>(new Set());
  const [menuPostId,  setMenuPostId]  = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ type:'anuncio' as PostType, title:'', content:'', group:'Todos los grupos', dueDate:'', attachments: [] as string[] });

  const toggleComments = (id: string) => {
    setExpandComments(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const addReaction = (postId: string, emoji: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const existing = p.reactions.find(r => r.emoji === emoji);
      if (existing) {
        return { ...p, reactions: p.reactions.map(r => r.emoji === emoji ? {...r, count: r.count + 1} : r) };
      }
      return { ...p, reactions: [...p.reactions, {emoji, count:1}] };
    }));
  };

  const addComment = (postId: string) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    const c: Comment = { id: Date.now().toString(), author:'Yo (Profesor)', text, date:'Ahora' };
    setPosts(prev => prev.map(p => p.id === postId ? {...p, comments:[...p.comments, c]} : p));
    setCommentText(prev => ({...prev, [postId]:''}));
  };

  const deletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    setMenuPostId(null);
  };

  const handlePublish = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const newPost: Post = {
      id:          Date.now().toString(),
      type:        form.type,
      title:       form.title.trim(),
      content:     form.content.trim(),
      group:       form.group,
      date:        new Date().toISOString().slice(0,10),
      dueDate:     form.dueDate || undefined,
      reactions:   [],
      comments:    [],
      attachments: form.attachments,
    };
    setPosts(prev => [newPost, ...prev]);
    setShowCompose(false);
    setForm({ type:'anuncio', title:'', content:'', group:'Todos los grupos', dueDate:'', attachments:[] });
  };

  const filtered = posts.filter(p =>
    selectedGroup === 'Todos los grupos' || p.group === 'Todos los grupos' || p.group === selectedGroup
  );

  return (
    <div className="space-y-4">

      {/* Barra filtro + publicar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
          className="px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm text-[#37352F] focus:outline-none focus:ring-1 focus:ring-[#2E6FDB] bg-white">
          <option>Todos los grupos</option>
          {GROUPS.map(g => <option key={g}>{g}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nueva publicación
        </button>
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="bg-[#F7F6F3] border border-dashed border-[#E9E9E7] rounded-xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
          <p className="text-sm text-[#787774]">No hay publicaciones en este grupo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => {
            const tc = TYPE_CONFIG[post.type];
            const TypeIcon = tc.icon;
            const showCmts = expandComments.has(post.id);

            return (
              <div key={post.id} className={`bg-white border border-l-4 ${tc.borderColor} border-[#E9E9E7] rounded-lg overflow-hidden`}>
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 ${tc.bg} rounded-md flex items-center justify-center flex-shrink-0`}>
                        <TypeIcon className={`w-4 h-4 ${tc.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase ${tc.color}`}>{tc.label}</span>
                          <span className="text-[10px] text-[#AEADAB]">· {post.group}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#191919] mt-0.5">{post.title}</h4>
                      </div>
                    </div>
                    <div className="relative flex items-center gap-2">
                      <span className="text-[11px] text-[#AEADAB]">{post.date}</span>
                      <button onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774]">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuPostId === post.id && (
                        <div className="absolute right-0 top-7 bg-white border border-[#E9E9E7] rounded-lg shadow-lg z-20 py-1 w-28"
                          onMouseLeave={() => setMenuPostId(null)}>
                          <button onClick={() => deletePost(post.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E03E3E] hover:bg-red-50">
                            <X className="w-3 h-3" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-[#37352F] leading-relaxed">{post.content}</p>

                  {post.dueDate && (
                    <p className="mt-2 text-xs font-medium text-[#E03E3E] flex items-center gap-1">
                      📅 Fecha límite: {post.dueDate}
                    </p>
                  )}

                  {post.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {post.attachments.map(a => (
                        <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-[#F7F6F3] border border-[#E9E9E7] rounded text-xs text-[#787774]">
                          <Paperclip className="w-3 h-3" />{a}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reacciones */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex gap-1">
                      {REACTION_EMOJIS.slice(0, 4).map(emoji => (
                        <button key={emoji} onClick={() => addReaction(post.id, emoji)}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F7F6F3] text-base transition-colors">
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {post.reactions.filter(r => r.count > 0).map(r => (
                      <span key={r.emoji} className="flex items-center gap-1 text-xs text-[#787774]">
                        {r.emoji} {r.count}
                      </span>
                    ))}
                    <button onClick={() => toggleComments(post.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-[#787774] hover:text-[#2E6FDB] transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> {post.comments.length} comentarios
                    </button>
                  </div>
                </div>

                {/* Comentarios */}
                {showCmts && (
                  <div className="border-t border-[#F7F6F3] bg-[#F7F6F3]/50 px-5 py-3 space-y-3">
                    {post.comments.map(c => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {c.author.charAt(0)}
                        </div>
                        <div className="flex-1 bg-white border border-[#E9E9E7] rounded-lg px-3 py-2">
                          <p className="text-[11px] font-semibold text-[#191919]">{c.author} <span className="text-[#AEADAB] font-normal">· {c.date}</span></p>
                          <p className="text-xs text-[#37352F] mt-0.5">{c.text}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#2E6FDB] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">P</div>
                      <input
                        value={commentText[post.id] ?? ''}
                        onChange={e => setCommentText(prev => ({...prev, [post.id]: e.target.value}))}
                        onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                        placeholder="Escribe un comentario..."
                        className="flex-1 px-3 py-1.5 text-xs border border-[#E9E9E7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E6FDB] bg-white"
                      />
                      <button onClick={() => addComment(post.id)}
                        className="w-7 h-7 flex items-center justify-center bg-[#2E6FDB] text-white rounded-lg hover:bg-[#255DC0] transition-colors">
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

      {/* Modal componer */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
              <h3 className="font-semibold text-[#191919]">Nueva publicación</h3>
              <button onClick={() => setShowCompose(false)} className="text-[#787774] hover:text-[#37352F] text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(TYPE_CONFIG) as [PostType, typeof TYPE_CONFIG[PostType]][]).map(([type, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={type} onClick={() => setForm(p=>({...p,type}))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.type===type ? `${cfg.bg} ${cfg.color} border-current` : 'border-[#E9E9E7] text-[#787774] hover:bg-[#F7F6F3]'}`}>
                        <Icon className="w-3.5 h-3.5" />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Grupo */}
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Grupo</label>
                <select value={form.group} onChange={e => setForm(p=>({...p,group:e.target.value}))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] bg-white">
                  <option>Todos los grupos</option>
                  {GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Título *</label>
                <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
                  placeholder="Título de la publicación"
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
              </div>
              {/* Contenido */}
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Descripción *</label>
                <textarea value={form.content} onChange={e => setForm(p=>({...p,content:e.target.value}))}
                  placeholder="Escribe el contenido de la publicación..."
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-none" />
              </div>
              {form.type === 'tarea' && (
                <div>
                  <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Fecha límite</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(p=>({...p,dueDate:e.target.value}))}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
                </div>
              )}
              {/* Adjuntar */}
              <div>
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => { const names = Array.from(e.target.files||[]).map(f=>f.name); setForm(p=>({...p,attachments:[...p.attachments,...names]})); }} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-[#787774] hover:text-[#37352F] transition-colors">
                  <Paperclip className="w-3.5 h-3.5" />
                  Adjuntar archivos
                  {form.attachments.length > 0 && <span className="text-[#2E6FDB] font-medium">({form.attachments.length})</span>}
                </button>
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowCompose(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={handlePublish} disabled={!form.title.trim() || !form.content.trim()}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                <Send className="w-4 h-4" /> Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
