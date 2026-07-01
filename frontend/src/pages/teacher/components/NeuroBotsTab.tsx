import { useState, useRef } from 'react';
import {
  Bot, Plus, Trash2, Globe, Lock, FileText, Upload, X,
  CheckCircle, Clock, AlertCircle, MessageSquare, BarChart2,
  ToggleLeft, ToggleRight, BookOpen,
} from 'lucide-react';

interface KnowledgeFile {
  id: string;
  name: string;
  size: string;
  date: string;
  status: 'processed' | 'processing' | 'error';
}

interface NeuroBot {
  id: string;
  name: string;
  description: string;
  subject: string;
  mode: 'public' | 'private';
  active: boolean;
  queries: number;
  docs: KnowledgeFile[];
  created: string;
}

const MOCK_BOTS: NeuroBot[] = [
  {
    id:'b1', name:'MateBot 9A', description:'Asistente de álgebra y geometría para grado 9A.',
    subject:'Matemáticas', mode:'public', active:true, queries:342,
    docs:[
      {id:'d1',name:'algebra_cap1.pdf',size:'2.1 MB',date:'2026-06-10',status:'processed'},
      {id:'d2',name:'geometria_basica.pdf',size:'3.4 MB',date:'2026-06-12',status:'processed'},
      {id:'d3',name:'ejercicios_ecuaciones.md',size:'0.3 MB',date:'2026-06-15',status:'processed'},
    ],
    created:'2026-02-20',
  },
  {
    id:'b2', name:'FísicaBot 10B', description:'Explica mecánica, óptica y electromagnetismo.',
    subject:'Física', mode:'public', active:true, queries:218,
    docs:[
      {id:'d4',name:'mecanica_newton.pdf',size:'4.2 MB',date:'2026-05-20',status:'processed'},
      {id:'d5',name:'electromagnetismo.pdf',size:'5.1 MB',date:'2026-05-22',status:'processed'},
    ],
    created:'2026-02-21',
  },
  {
    id:'b3', name:'AlgebraBot 8C', description:'Apoyo en ecuaciones y funciones básicas.',
    subject:'Álgebra', mode:'private', active:false, queries:89,
    docs:[
      {id:'d6',name:'funciones_lineales.pdf',size:'1.8 MB',date:'2026-04-05',status:'processed'},
    ],
    created:'2026-03-15',
  },
];

const STATUS_CONFIG = {
  processed:  { icon: CheckCircle, color: 'text-[#0F7B6C]', label: 'Procesado'  },
  processing: { icon: Clock,       color: 'text-[#D9730D]', label: 'Procesando' },
  error:      { icon: AlertCircle, color: 'text-[#E03E3E]', label: 'Error'       },
};

// ── Vista detalle de un bot ───────────────────────────────────────────────────
function BotDetail({ bot, onBack, onUpdate }: { bot: NeuroBot; onBack: () => void; onUpdate: (b: NeuroBot) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const newDocs: KnowledgeFile[] = Array.from(files).map(f => ({
      id:     Date.now().toString() + f.name,
      name:   f.name,
      size:   `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      date:   new Date().toISOString().slice(0, 10),
      status: 'processing',
    }));
    const updated = { ...bot, docs: [...bot.docs, ...newDocs] };
    onUpdate(updated);
    setTimeout(() => {
      onUpdate({
        ...updated,
        docs: updated.docs.map(d => d.status === 'processing' ? { ...d, status: 'processed' } : d),
      });
      setUploading(false);
    }, 2000);
  };

  const removeDoc = (docId: string) => {
    onUpdate({ ...bot, docs: bot.docs.filter(d => d.id !== docId) });
  };

  const totalSize = bot.docs.reduce((acc, d) => acc + parseFloat(d.size), 0);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F] transition-colors">
        ← NeuroBots
      </button>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#EEF3FD] rounded-xl flex items-center justify-center">
            <Bot className="w-6 h-6 text-[#2E6FDB]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#191919]">{bot.name}</h2>
            <p className="text-sm text-[#787774]">{bot.subject} · {bot.mode === 'public' ? 'Público' : 'Privado'}</p>
            <p className="text-xs text-[#AEADAB] mt-0.5">{bot.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#787774]">
          <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {bot.queries} consultas</span>
          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {bot.docs.length} docs</span>
        </div>
      </div>

      {/* Base de conocimiento */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#191919] text-sm">Base de Conocimiento</h3>
            <p className="text-xs text-[#787774] mt-0.5">{bot.docs.length} documentos · {totalSize.toFixed(1)} MB total</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".pdf,.md,.txt" multiple className="hidden"
              onChange={e => handleUpload(e.target.files)} />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6FDB] text-white rounded-lg text-xs font-medium hover:bg-[#255DC0] transition-colors">
              {uploading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Procesando...' : 'Subir documento'}
            </button>
          </div>
        </div>

        {bot.docs.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
            <p className="text-sm text-[#787774]">No hay documentos. Sube PDF o Markdown para entrenar al bot.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F7F6F3]">
            {bot.docs.map(doc => {
              const sc = STATUS_CONFIG[doc.status];
              const SIcon = sc.icon;
              return (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F6F3]/50 transition-colors">
                  <FileText className="w-4 h-4 text-[#787774] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#191919] truncate font-medium">{doc.name}</p>
                    <p className="text-[11px] text-[#AEADAB]">{doc.size} · Subido el {doc.date}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${sc.color}`}>
                    <SIcon className="w-3.5 h-3.5" /> {sc.label}
                  </div>
                  <button onClick={() => removeDoc(doc.id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-[#AEADAB] hover:text-[#E03E3E] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-3 bg-[#F7F6F3] border-t border-[#E9E9E7]">
          <p className="text-xs text-[#787774]">
            📄 Formatos soportados: <strong>PDF</strong>, <strong>Markdown (.md)</strong>, <strong>Texto plano (.txt)</strong>.
            El sistema extrae e indexa el texto automáticamente para responder consultas.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function NeuroBotsTab({ license }: { license: any }) {
  const [bots,      setBots]      = useState<NeuroBot[]>(MOCK_BOTS);
  const [selected,  setSelected]  = useState<NeuroBot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ name:'', description:'', subject:'', mode:'public' as 'public'|'private' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const maxBots = license?.bots_limit === 'unlimited' ? Infinity : (license?.bots_limit ?? 1);
  const usedBots = bots.length;

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const newBot: NeuroBot = {
      id:          Date.now().toString(),
      name:        form.name.trim(),
      description: form.description.trim(),
      subject:     form.subject.trim() || 'General',
      mode:        form.mode,
      active:      true,
      queries:     0,
      docs:        [],
      created:     new Date().toISOString().slice(0, 10),
    };
    setBots(prev => [newBot, ...prev]);
    setShowModal(false);
    setForm({ name:'', description:'', subject:'', mode:'public' });
    setPreviewImg(null);
  };

  const toggleBot = (id: string) => {
    setBots(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  const deleteBot = (id: string) => {
    if (!window.confirm('¿Eliminar este NeuroBot?')) return;
    setBots(prev => prev.filter(b => b.id !== id));
  };

  const updateBot = (updated: NeuroBot) => {
    setBots(prev => prev.map(b => b.id === updated.id ? updated : b));
    setSelected(updated);
  };

  if (selected) return <BotDetail bot={selected} onBack={() => setSelected(null)} onUpdate={updateBot} />;

  return (
    <div className="space-y-5">

      {/* Barra */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-[#787774]">
          <span><strong className="text-[#191919]">{bots.filter(b=>b.active).length}</strong> activos</span>
          <span><strong className="text-[#191919]">{bots.reduce((a,b)=>a+b.queries,0).toLocaleString()}</strong> consultas totales</span>
          <span><strong className="text-[#191919]">{bots.reduce((a,b)=>a+b.docs.length,0)}</strong> documentos</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={usedBots >= maxBots}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Crear NeuroBot
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#787774] uppercase">NeuroBot</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#787774] uppercase">Materia</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Modo</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Docs</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Consultas</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Estado</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[#787774] uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bots.map(bot => (
              <tr key={bot.id} className="border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#EEF3FD] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-[#2E6FDB]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#191919]">{bot.name}</p>
                      <p className="text-[11px] text-[#AEADAB] truncate max-w-[160px]">{bot.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-[#787774] text-xs">{bot.subject}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`flex items-center justify-center gap-1 text-xs font-medium ${bot.mode === 'public' ? 'text-[#0F7B6C]' : 'text-[#787774]'}`}>
                    {bot.mode === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {bot.mode === 'public' ? 'Público' : 'Privado'}
                  </span>
                </td>
                <td className="px-5 py-3 text-center text-sm font-semibold text-[#191919]">{bot.docs.length}</td>
                <td className="px-5 py-3 text-center">
                  <span className="flex items-center justify-center gap-1 text-xs text-[#6940A5]">
                    <BarChart2 className="w-3.5 h-3.5" /> {bot.queries.toLocaleString()}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => toggleBot(bot.id)} className="transition-colors">
                    {bot.active
                      ? <ToggleRight className="w-6 h-6 text-[#0F7B6C]" />
                      : <ToggleLeft  className="w-6 h-6 text-[#AEADAB]" />}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setSelected(bot)}
                      className="px-2.5 py-1 bg-[#EEF3FD] text-[#2E6FDB] rounded text-xs font-medium hover:bg-[#2E6FDB] hover:text-white transition-colors">
                      Gestionar
                    </button>
                    <button onClick={() => deleteBot(bot.id)}
                      className="w-7 h-7 flex items-center justify-center rounded text-[#AEADAB] hover:bg-red-50 hover:text-[#E03E3E] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bots.length === 0 && (
          <div className="py-12 text-center">
            <Bot className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
            <p className="text-sm text-[#787774]">No hay bots. Crea tu primer NeuroBot.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
              <h3 className="font-semibold text-[#191919]">Crear NeuroBot</h3>
              <button onClick={() => setShowModal(false)} className="text-[#787774] hover:text-[#37352F] text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Nombre *</label>
                <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}
                  placeholder="ej. MateBot 9A"
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Materia</label>
                <input value={form.subject} onChange={e => setForm(p=>({...p,subject:e.target.value}))}
                  placeholder="ej. Matemáticas"
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                  placeholder="¿Para qué sirve este bot?"
                  rows={2}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Modo de acceso</label>
                <div className="flex gap-3">
                  {[{v:'public',l:'Público',icon:Globe},{v:'private',l:'Privado',icon:Lock}].map(opt=>{
                    const MIcon = opt.icon;
                    return (
                      <button key={opt.v} onClick={() => setForm(p=>({...p,mode:opt.v as any}))}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-colors ${form.mode===opt.v ? 'border-[#2E6FDB] bg-[#EEF3FD] text-[#2E6FDB]' : 'border-[#E9E9E7] text-[#787774] hover:bg-[#F7F6F3]'}`}>
                        <MIcon className="w-3.5 h-3.5" />{opt.l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Imagen (opcional)</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f=e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=ev=>setPreviewImg(ev.target?.result as string); r.readAsDataURL(f); }}} />
                {previewImg
                  ? <div className="relative w-16 h-16"><img src={previewImg} className="w-16 h-16 rounded-lg object-cover border border-[#E9E9E7]" /><button onClick={() => setPreviewImg(null)} className="absolute -top-1 -right-1 w-4 h-4 bg-[#E03E3E] text-white rounded-full text-[10px] flex items-center justify-center">×</button></div>
                  : <button onClick={() => fileRef.current?.click()} className="w-full py-2.5 border border-dashed border-[#E9E9E7] rounded-lg text-xs text-[#787774] hover:bg-[#F7F6F3] transition-colors">+ Subir imagen</button>
                }
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.name.trim()}
                className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                <Bot className="w-4 h-4 inline mr-1.5" />Crear Bot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
