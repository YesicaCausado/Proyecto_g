import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Users, GraduationCap, BookOpen, User, Paperclip, Clock, CheckCheck, Plus, Trash2, Search, PenSquare, X } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

type Recipient = 'institucional' | 'profesores' | 'estudiantes' | 'grado' | 'grupo';
type View = 'compose' | 'sent' | 'chat';

interface SentMsg {
  id: number; subject: string; to: string; date: string;
  reads: number; total: number; sender: string;
}

interface ChatMessage { id: string; senderId: number; text: string; time: string; read: boolean; }
interface ChatConv {
  otherId: number; name: string; role: string; initials: string;
  lastMsg: string; lastTime: string; unread: number; messages: ChatMessage[];
}
interface Contact { id: number; name: string; role: string; initials: string; }

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function mapChatConv(raw: any): ChatConv {
  const name = raw.other_user_name ?? raw.other_name ?? '—';
  return {
    otherId:  raw.other_user_id ?? raw.other_id ?? 0,
    name, role: raw.other_user_role ?? raw.other_role ?? '',
    initials: name.charAt(0).toUpperCase(),
    lastMsg:  raw.last_message ?? '',
    lastTime: raw.last_message_at ? fmtTime(raw.last_message_at) : '',
    unread:   raw.unread_count ?? 0,
    messages: [],
  };
}


const RECIPIENT_OPTIONS: { value: Recipient; label: string; icon: any; desc: string }[] = [
  { value: 'institucional', label: 'Toda la institución', icon: Users,         desc: 'Profesores + estudiantes' },
  { value: 'profesores',    label: 'Solo profesores',     icon: User,           desc: '18 docentes activos' },
  { value: 'estudiantes',   label: 'Solo estudiantes',    icon: GraduationCap,  desc: '745 estudiantes activos' },
  { value: 'grado',         label: 'Por grado',           icon: BookOpen,       desc: 'Selecciona el grado' },
  { value: 'grupo',         label: 'Por grupo',           icon: BookOpen,       desc: 'Selecciona el grupo' },
];

const GRADES = ['6°','7°','8°','9°','10°','11°'];
const GROUPS = ['Matemáticas 8A','Ciencias 9B','Lenguaje 7C','Historia 10A','Física 11B','Tecnología 8B'];

export default function MensajeriaTab() {
  const { user } = useAuth();
  const myId = user?.id ?? 0;

  // ── Broadcast state ─────────────────────────────────────────
  const [view, setView]           = useState<View>('compose');
  const [recipient, setRecipient] = useState<Recipient>('institucional');
  const [grade, setGrade]         = useState('');
  const [group, setGroup]         = useState('');
  const [subject, setSubject]     = useState('');
  const [body, setBody]           = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [sent, setSent]           = useState<SentMsg[]>([]);
  const [sending, setSending]     = useState(false);
  const [success, setSuccess]     = useState('');

  // ── Chat state ───────────────────────────────────────────────
  const [convs,         setConvs]         = useState<ChatConv[]>([]);
  const [activeConv,    setActiveConv]    = useState<ChatConv | null>(null);
  const [chatText,      setChatText]      = useState('');
  const [chatSearch,    setChatSearch]    = useState('');
  const [chatLoading,   setChatLoading]   = useState(false);
  const [chatSending,   setChatSending]   = useState(false);
  const [showNew,       setShowNew]       = useState(false);
  const [contacts,      setContacts]      = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/super/broadcasts')
      .then(r => setSent(r.data.broadcasts ?? []))
      .catch(() => setSent([]));
  }, []);

  // Load chat conversations when switching to chat tab
  useEffect(() => {
    if (view !== 'chat' || convs.length > 0) return;
    setChatLoading(true);
    api.get('/messages/conversations')
      .then(r => {
        const list = (r.data.conversations ?? r.data ?? []).map(mapChatConv);
        setConvs(list);
        if (list.length > 0) openChat(list[0], list);
      })
      .catch(() => {})
      .finally(() => setChatLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length]);

  const openChat = async (conv: ChatConv, allConvs?: ChatConv[]) => {
    try {
      const [msgsRes] = await Promise.all([
        api.get(`/messages/conversations/${conv.otherId}`),
        api.post(`/messages/conversations/${conv.otherId}/read`).catch(() => {}),
      ]);
      const msgs: ChatMessage[] = (msgsRes.data.messages ?? msgsRes.data ?? []).map((m: any) => ({
        id: String(m.id), senderId: m.sender_id,
        text: m.content, time: fmtTime(m.created_at), read: m.is_read,
      }));
      const updated = { ...conv, messages: msgs, unread: 0 };
      setActiveConv(updated);
      const base = allConvs ?? convs;
      setConvs(base.map(c => c.otherId === conv.otherId ? updated : c));
    } catch {
      setActiveConv({ ...conv, messages: [] });
    }
  };

  const sendChat = async () => {
    if (!chatText.trim() || !activeConv || chatSending) return;
    const msgText = chatText.trim();
    setChatText('');
    setChatSending(true);
    const opt: ChatMessage = { id: String(Date.now()), senderId: myId, text: msgText, time: new Date().toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'}), read: false };
    const updated = { ...activeConv, messages: [...activeConv.messages, opt], lastMsg: msgText };
    setActiveConv(updated);
    setConvs(prev => prev.map(c => c.otherId === activeConv.otherId ? updated : c));
    try { await api.post(`/messages/conversations/${activeConv.otherId}`, { content: msgText }); } catch { /**/ }
    setChatSending(false);
  };

  const openNewChat = async () => {
    setShowNew(true);
    if (contacts.length > 0) return;
    try {
      const r = await api.get('/messages/contacts');
      setContacts((r.data.contacts ?? r.data ?? []).map((c: any) => ({
        id: c.id, name: c.name ?? c.full_name ?? '—',
        role: c.role ?? '', initials: (c.name ?? c.full_name ?? '?').charAt(0).toUpperCase(),
      })));
    } catch { /**/ }
  };

  const startConversation = (contact: Contact) => {
    const existing = convs.find(c => c.otherId === contact.id);
    if (existing) { openChat(existing); setShowNew(false); return; }
    const newConv: ChatConv = {
      otherId: contact.id, name: contact.name, role: contact.role,
      initials: contact.initials, lastMsg: '', lastTime: '', unread: 0, messages: [],
    };
    setConvs(prev => [newConv, ...prev]);
    openChat(newConv);
    setShowNew(false);
  };

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()));
  const filteredConvs = convs.filter(c => c.name.toLowerCase().includes(chatSearch.toLowerCase()));

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/super/broadcasts', {
        subject,
        body,
        recipient_type: recipient,
        grade: recipient === 'grado' ? grade : undefined,
        group_id: recipient === 'grupo' ? group : undefined,
        scheduled_at: scheduleDate || undefined,
      });
      setSent(prev => [res.data, ...prev]);
      setSubject(''); setBody(''); setScheduleDate('');
      setSuccess('¡Mensaje enviado exitosamente!');
      setTimeout(() => setSuccess(''), 4000);
      setView('sent');
    } catch {
      setSuccess('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6F3] p-1 rounded-md w-fit border border-[#E9E9E7]">
        {[{ id: 'compose', label: 'Nuevo mensaje', icon: Plus }, { id: 'sent', label: 'Enviados', icon: Clock }, { id: 'chat', label: 'Chat directo', icon: MessageSquare }].map(t => (
          <button key={t.id} onClick={() => setView(t.id as View)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${view===t.id ? 'bg-white text-[#191919] shadow-sm border border-[#E9E9E7]' : 'text-[#787774] hover:bg-white/50 hover:text-[#37352F]'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {success && (
        <div className="p-3 bg-[#EEF8F6] border border-[#A6DDD6] rounded-md flex items-center gap-2 text-sm text-[#0F7B6C] font-medium">
          <CheckCheck className="w-4 h-4" /> {success}
        </div>
      )}

      {view === 'compose' ? (
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-6 space-y-5 max-w-3xl">
          <h3 className="font-semibold text-[#191919] border-b border-[#E9E9E7] pb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#787774]" /> Redactar mensaje institucional
          </h3>

          {/* Destinatarios */}
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-2 uppercase tracking-wide">Destinatarios</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {RECIPIENT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setRecipient(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${recipient===opt.value ? 'border-[#6940A5] bg-purple-50 text-[#6940A5]' : 'border-[#E9E9E7] hover:border-[#AEADAB] text-[#787774]'}`}>
                  <opt.icon className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-70">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {recipient === 'grado' && (
              <select value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#6940A5]">
                <option value="">Selecciona el grado</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            {recipient === 'grupo' && (
              <select value={group} onChange={e => setGroup(e.target.value)}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#6940A5]">
                <option value="">Selecciona el grupo</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
          </div>

          {/* Asunto */}
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Asunto</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Escribe el asunto del mensaje..."
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5]" />
          </div>

          {/* Cuerpo */}
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">Mensaje</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
              placeholder="Escribe el contenido del mensaje institucional..."
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5] resize-none" />
          </div>

          {/* Programar */}
          <div>
            <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" /> Programar envío (opcional)
            </label>
            <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
              className="px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5] bg-white" />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E9E9E7]">
            <button className="flex items-center gap-2 text-sm text-[#787774] hover:text-[#37352F] transition-colors">
              <Paperclip className="w-4 h-4" /> Adjuntar archivo
            </button>
            <div className="flex gap-2">
              <button onClick={() => { setSubject(''); setBody(''); }}
                className="px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-[#F7F6F3] transition-colors">
                Limpiar
              </button>
              <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-[#6940A5] text-white text-sm font-medium rounded-md hover:bg-[#5A358F] transition-colors shadow-sm disabled:opacity-50">
                {sending ? <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Enviando...</> : <><Send className="w-4 h-4" /> {scheduleDate ? 'Programar envío' : 'Enviar ahora'}</>}
              </button>
            </div>
          </div>
        </div>

      ) : (
        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
              <tr>
                {['Asunto','Destinatarios','Fecha y hora','Lecturas','Acciones'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider ${h==='Acciones'?'text-right':'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E7]">
              {sent.map(msg => {
                const pct = msg.total > 0 ? Math.round((msg.reads / msg.total) * 100) : 0;
                return (
                  <tr key={msg.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#191919]">{msg.subject}</p>
                      <p className="text-xs text-[#787774]">De: {msg.sender}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs bg-[#F7F6F3] px-2 py-0.5 rounded-full text-[#787774] border border-[#E9E9E7]">
                        <Users className="w-3 h-3" /> {msg.to}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#787774]">{msg.date}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden w-20">
                          <div className="h-full bg-[#6940A5] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#787774] whitespace-nowrap">{msg.reads}/{msg.total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button onClick={() => setSent(prev => prev.filter(m => m.id !== msg.id))}
                        className="p-1.5 rounded hover:bg-[#FDEEEE] text-[#787774] hover:text-[#E03E3E] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sent.length === 0 && (
            <div className="text-center py-12 text-[#787774]"><MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No hay mensajes enviados</p></div>
          )}
        </div>
      )}

      {/* ── Chat directo ──────────────────────────────────────── */}
      {view === 'chat' && (
        <div className="flex h-[580px] bg-white border border-[#E9E9E7] rounded-xl overflow-hidden relative">

          {/* Contacts Modal */}
          {showNew && (
            <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center">
              <div className="bg-white rounded-xl w-80 shadow-xl flex flex-col max-h-[480px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9E9E7]">
                  <h4 className="font-semibold text-[#191919] text-sm">Nueva conversación</h4>
                  <button onClick={() => setShowNew(false)} className="text-[#787774] hover:text-[#191919]"><X className="w-4 h-4" /></button>
                </div>
                <div className="px-4 py-2 border-b border-[#E9E9E7]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
                    <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Buscar contacto..."
                      className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6940A5]" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredContacts.length === 0 && <p className="text-center text-xs text-[#AEADAB] py-8">{contacts.length === 0 ? 'Cargando contactos…' : 'Sin resultados'}</p>}
                  {filteredContacts.map(contact => (
                    <button key={contact.id} onClick={() => startConversation(contact)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F7F6F3] transition-colors text-left border-b border-[#F7F6F3] last:border-0">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm flex-shrink-0">{contact.initials}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#191919] truncate">{contact.name}</p>
                        <p className="text-[10px] text-[#787774] capitalize">{contact.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar */}
          <div className="w-72 flex-shrink-0 border-r border-[#E9E9E7] flex flex-col">
            <div className="px-4 py-3 border-b border-[#E9E9E7]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#191919] text-sm">Conversaciones</h3>
                <button onClick={openNewChat} title="Nueva conversación"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3EEF8] text-[#787774] hover:text-[#6940A5] transition-colors">
                  <PenSquare className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
                <input value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6940A5]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chatLoading && <p className="text-center text-xs text-[#AEADAB] py-6">Cargando…</p>}
              {filteredConvs.map(conv => (
                <button key={conv.otherId} onClick={() => openChat(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#F7F6F3] transition-colors ${activeConv?.otherId === conv.otherId ? 'bg-[#F3EEF8]' : 'hover:bg-[#F7F6F3]'}`}>
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm flex-shrink-0">{conv.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-[#191919]' : 'font-medium text-[#37352F]'}`}>{conv.name}</p>
                      <span className="text-[10px] text-[#AEADAB] ml-2">{conv.lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#787774] truncate">{conv.lastMsg}</p>
                      {conv.unread > 0 && <span className="w-4 h-4 rounded-full bg-[#6940A5] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ml-2">{conv.unread}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          <div className="flex-1 flex flex-col">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[#AEADAB]">
                {chatLoading ? 'Cargando conversaciones…' : 'Selecciona una conversación'}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/50">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">{activeConv.initials}</div>
                  <div>
                    <p className="font-semibold text-[#191919] text-sm">{activeConv.name}</p>
                    <p className="text-[10px] text-[#AEADAB] capitalize">{activeConv.role}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {activeConv.messages.map(msg => {
                    const isMe = msg.senderId === myId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${isMe ? 'bg-[#6940A5] text-white rounded-br-sm' : 'bg-[#F7F6F3] text-[#191919] rounded-bl-sm'}`}>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/70' : 'text-[#AEADAB]'}`}>
                            <span className="text-[10px]">{msg.time}</span>
                            {isMe && <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-white' : 'text-white/50'}`} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div className="flex items-center gap-3 px-5 py-3 border-t border-[#E9E9E7]">
                  <input value={chatText} onChange={e => setChatText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat())}
                    placeholder={`Escribe a ${activeConv.name}...`}
                    className="flex-1 px-4 py-2 border border-[#E9E9E7] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#6940A5]/30 focus:border-[#6940A5]" />
                  <button onClick={sendChat} disabled={!chatText.trim() || chatSending}
                    className="w-9 h-9 flex items-center justify-center bg-[#6940A5] text-white rounded-full hover:bg-[#5A358F] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
