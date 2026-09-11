import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Search, Loader2, MessageSquare, PenSquare, X, CheckCheck, Paperclip, Download } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Messaging — Componente único y reutilizable de mensajería directa.
 *
 * Se usa en los tres paneles de rol (Super Profesor, Profesor, Estudiante) contra
 * la misma API `/messages/*` del backend, que ya valida las reglas de rol:
 *   Super ↔ cualquiera, Profesor ↔ sus estudiantes / otros profesores / Super,
 *   Estudiante ↔ sus profesores.
 *
 * `accent` (color primario) permite diferenciar visualmente cada panel sin duplicar lógica.
 */

interface Message {
  id: string;
  senderId: number;
  text: string;
  time: string;
  read: boolean;
  attachment?: { name: string; mime: string; size: number; url: string } | null;
}

interface Conversation {
  otherId: number;
  name: string;
  role: string;
  initials: string;
  subtitle: string;
  lastMsg: string;
  lastTime: string;
  unread: number;
  messages: Message[];
  loaded: boolean;
}

interface Contact {
  id: number;
  name: string;
  role: string;
  initials: string;
}

interface MessagingProps {
  accent?: string;            // color principal (#2E6FDB / #0066FF / #6940A5)
  height?: string;            // altura del contenedor (ej. 'h-[580px]')
  emptyHint?: string;         // texto cuando no hay conversaciones
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function mapConv(raw: any): Conversation {
  const otherId = raw.other_user_id ?? raw.other_id ?? 0;
  const name = raw.other_user_name ?? raw.other_name ?? '—';
  return {
    otherId,
    name,
    role: raw.other_user_role ?? raw.other_role ?? '',
    initials: getInitials(name),
    subtitle: raw.classroom_name ?? '',
    lastMsg: raw.last_message ?? '',
    lastTime: raw.last_message_at ? fmtTime(raw.last_message_at) : '',
    unread: raw.unread_count ?? 0,
    messages: [],
    loaded: false,
  };
}

function mapMessage(raw: any): Message {
  return {
    id: String(raw.id),
    senderId: raw.sender_id,
    text: raw.content ?? raw.text,
    time: raw.created_at
      ? new Date(raw.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : (raw.time ?? ''),
    read: raw.is_read ?? false,
    attachment: raw.attachment ?? null,
  };
}

const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  super_profesor: { bg: 'bg-purple-50 text-[#6940A5]', text: 'text-[#6940A5]', label: 'Super Profesor' },
  profesor:       { bg: 'bg-[#EEF3FD] text-[#2E6FDB]', text: 'text-[#2E6FDB]', label: 'Profesor' },
  estudiante:     { bg: 'bg-emerald-50 text-[#0F7B6C]', text: 'text-[#0F7B6C]', label: 'Estudiante' },
};

export default function Messaging({ accent = '#0066FF', height = 'h-[600px]', emptyHint }: MessagingProps) {
  const { user } = useAuth();
  const myId = user?.id ?? 0;

  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/messages/conversations')
      .then(res => {
        const list: Conversation[] = (res.data.conversations ?? res.data ?? []).map(mapConv);
        setConvs(list);
        if (list.length > 0) openConversation(list[0], list);
      })
      .catch(() => setConvs([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  const openConversation = useCallback(async (conv: Conversation, list?: Conversation[]) => {
    const src = list ?? convs;
    setConvs(src.map(c => c.otherId === conv.otherId ? { ...c, unread: 0 } : c));
    if (!conv.loaded) {
      try {
        const [msgsRes] = await Promise.all([
          api.get(`/messages/conversations/${conv.otherId}`),
          api.post(`/messages/conversations/${conv.otherId}/read`).catch(() => {}),
        ]);
        const msgs: Message[] = (msgsRes.data.messages ?? msgsRes.data ?? []).map(mapMessage);
        const updated: Conversation = { ...conv, messages: msgs, loaded: true, unread: 0 };
        setConvs(prev => prev.map(c => c.otherId === conv.otherId ? updated : c));
        setActive(updated);
      } catch {
        setActive({ ...conv, unread: 0 });
      }
    } else {
      setActive({ ...conv, unread: 0 });
      api.post(`/messages/conversations/${conv.otherId}/read`).catch(() => {});
    }
  }, [convs]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter envía; Shift+Enter no envía. Se ignoran los Enter generados por la
    // composición del teclado (p. ej. acentos del español con IME/autocorrección),
    // que de otro modo tragan o disparan el envío antes de tiempo.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if ((!text.trim() && !attachment) || !active || sending) return;
    const content = text.trim();
    const file = attachment;
    setText('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSending(true);
    const tempMsg: Message = {
      id: `tmp-${Date.now()}`,
      senderId: myId,
      text: content,
      time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      attachment: file ? { name: file.name, mime: file.type, size: file.size, url: '' } : null,
    };
    const updatedActive = { ...active, messages: [...active.messages, tempMsg], lastMsg: content || `📎 ${file?.name}`, lastTime: 'Ahora', unread: 0 };
    setActive(updatedActive);
    setConvs(prev => prev.map(c => c.otherId === active.otherId ? updatedActive : c));
    try {
      const form = new FormData();
      form.append('content', content);
      if (file) form.append('file', file);
      await api.post(`/messages/conversations/${active.otherId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      setText(content);
      setAttachment(file);
      setActive(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempMsg.id) } : prev);
    } finally {
      setSending(false);
    }
  };

  const openNewChat = async () => {
    setShowNew(true);
    if (contacts.length > 0) return;
    try {
      const r = await api.get('/messages/contacts');
      setContacts((r.data.contacts ?? r.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name ?? c.full_name ?? '—',
        role: c.role ?? '',
        initials: (c.name ?? c.full_name ?? '?').charAt(0).toUpperCase(),
      })));
    } catch { /* noop */ }
  };

  const startConversation = (contact: Contact) => {
    const existing = convs.find(c => c.otherId === contact.id);
    if (existing) { openConversation(existing); setShowNew(false); return; }
    const newConv: Conversation = {
      otherId: contact.id, name: contact.name, role: contact.role,
      initials: contact.initials, subtitle: '', lastMsg: '', lastTime: '',
      unread: 0, messages: [], loaded: false,
    };
    setConvs(prev => [newConv, ...prev]);
    openConversation(newConv, [newConv, ...convs]);
    setShowNew(false);
  };

  const downloadAttachment = async (msg: Message) => {
    if (!msg.attachment?.url) return;
    try {
      const res = await api.get(msg.attachment.url, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = msg.attachment.name || 'archivo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { /* noop */ }
  };

  const filtered = convs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase())
  );
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()));
  const totalUnread = convs.reduce((a, c) => a + c.unread, 0);
  const badgeFor = (role: string) => ROLE_BADGES[role] ?? { bg: 'bg-[#F7F6F3] text-[#787774]', text: 'text-[#787774]', label: role };

  return (
    <div className={`flex ${height} bg-white border border-[#E9E9E7] rounded-xl overflow-hidden relative`}>
      {/* ── Modal nueva conversación ─────────────────────────── */}
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
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0066FF]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.length === 0 && (
                <p className="text-center text-xs text-[#AEADAB] py-8">
                  {contacts.length === 0 ? 'Cargando contactos…' : 'Sin resultados'}
                </p>
              )}
              {filteredContacts.map(contact => {
                const b = badgeFor(contact.role.toLowerCase());
                return (
                  <button key={contact.id} onClick={() => startConversation(contact)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F7F6F3] transition-colors text-left border-b border-[#F7F6F3] last:border-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${b.bg}`}>{contact.initials}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#191919] truncate">{contact.name}</p>
                      <p className="text-[10px] text-[#787774] capitalize">{contact.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de conversaciones ──────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-[#E9E9E7] flex flex-col">
        <div className="px-4 py-3 border-b border-[#E9E9E7]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#191919] text-sm">Mensajes</h3>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: accent }}>{totalUnread}</span>
              )}
              <button onClick={openNewChat} title="Nueva conversación"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF3FD] text-[#787774] hover:text-[#0066FF] transition-colors">
                <PenSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0066FF]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#F7F6F3]">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-[#AEADAB] text-xs">
              <MessageSquare className="w-6 h-6 mb-2 text-[#E9E9E7]" />
              {loading ? 'Cargando…' : (emptyHint ?? 'Sin conversaciones aún')}
            </div>
          )}
          {filtered.map(conv => {
            const b = badgeFor(conv.role.toLowerCase());
            const isActive = active?.otherId === conv.otherId;
            return (
              <button key={conv.otherId} onClick={() => openConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${b.bg}`}>{conv.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-[#191919]' : 'font-medium text-[#37352F]'}`}>{conv.name}</p>
                    {conv.lastTime && <span className="text-[10px] text-[#AEADAB] flex-shrink-0 ml-1">{conv.lastTime}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-[#787774] truncate">{conv.lastMsg ?? 'Inicia la conversación'}</p>
                    {conv.unread > 0 && (
                      <span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ml-1" style={{ background: accent }}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  {conv.subtitle && <p className="text-[10px] text-[#AEADAB] mt-0.5 truncate">{conv.subtitle}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panel de chat ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#AEADAB]">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Cargando conversaciones…</> : 'Selecciona una conversación'}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/50 flex-shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${badgeFor(active.role.toLowerCase()).bg}`}>
                {active.initials}
              </div>
              <div>
                <p className="font-semibold text-[#191919] text-sm">{active.name}</p>
                <p className="text-[10px] text-[#AEADAB] capitalize">{badgeFor(active.role.toLowerCase()).label}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {active.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-[#AEADAB]">
                  <MessageSquare className="w-8 h-8 mb-2 text-[#E9E9E7]" />
                  <p className="text-xs">Inicia la conversación con {active.name}</p>
                </div>
              )}
              {active.messages.map(msg => {
                const isMe = msg.senderId === myId;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${isMe ? 'text-white rounded-br-sm' : 'bg-[#F7F6F3] text-[#191919] rounded-bl-sm'}`} style={isMe ? { background: accent } : undefined}>
                      {msg.text && <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>}
                      {msg.attachment?.name && (
                        <button
                          onClick={() => downloadAttachment(msg)}
                          disabled={!msg.attachment.url}
                          className={`mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white border border-[#E9E9E7] text-[#37352F] hover:bg-[#EBEBEA]'
                          }`}
                          title="Descargar archivo"
                        >
                          <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate max-w-[160px]">{msg.attachment.name}</span>
                          {msg.attachment.url && <Download className="w-3.5 h-3.5 flex-shrink-0" />}
                        </button>
                      )}
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

            <div className="px-5 pt-3 border-t border-[#E9E9E7] flex-shrink-0">
              {attachment && (
                <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg text-xs text-[#37352F]">
                  <Paperclip className="w-3.5 h-3.5 text-[#787774]" />
                  <span className="truncate flex-1">{attachment.name}</span>
                  <span className="text-[#AEADAB]">{Math.round(attachment.size / 1024)} KB</span>
                  <button onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-[#787774] hover:text-[#E03E3E]"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex items-center gap-3 pb-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={e => setAttachment(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar archivo"
                  className="w-9 h-9 flex items-center justify-center rounded-full text-[#787774] hover:bg-[#F7F6F3] hover:text-[#37352F] transition-colors"
                  style={attachment ? { color: accent } : undefined}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Escribe a ${active.name}...`}
                  className="flex-1 px-4 py-2 border border-[#E9E9E7] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]"
                />
                <button onClick={sendMessage} disabled={(!text.trim() && !attachment) || sending}
                  className="w-9 h-9 flex items-center justify-center text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:opacity-90"
                  style={{ background: accent }}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}