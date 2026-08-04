import { useState, useRef, useEffect } from 'react';
import { Send, Search, CheckCheck, Loader2, PenSquare, X } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

interface Message {
  id: string;
  senderId: number;
  text: string;
  time: string;
  read: boolean;
}

interface Conversation {
  id: string;
  type: 'student' | 'group' | 'super';
  name: string;
  avatar: string;
  lastMsg: string;
  lastTime: string;
  unread: number;
  otherId: number;
  messages: Message[];
}

interface Contact {
  id: number;
  name: string;
  role: string;
  initials: string;
}

const TYPE_COLOR: Record<Conversation['type'], string> = { student:'bg-[#EEF3FD] text-[#2E6FDB]', group:'bg-emerald-50 text-[#0F7B6C]', super:'bg-purple-50 text-[#6940A5]' };

function mapConv(raw: any): Conversation {
  // Backend returns: other_user_id, other_user_name, other_user_role
  const otherId = raw.other_user_id ?? raw.other_id ?? raw.otherId ?? raw.id;
  const otherName = raw.other_user_name ?? raw.other_name ?? raw.otherName ?? raw.name ?? '—';
  const role = (raw.other_user_role ?? raw.other_role ?? raw.otherRole ?? 'estudiante').toLowerCase();
  const type: Conversation['type'] = role.includes('super') || role.includes('rector') ? 'super'
    : role.includes('profesor') ? 'group'
    : 'student';
  return {
    id:       String(otherId),
    type,
    name:     otherName,
    avatar:   (otherName || '?').charAt(0).toUpperCase(),
    lastMsg:  raw.last_message ?? raw.lastMsg ?? '',
    lastTime: raw.last_message_at
      ? new Date(raw.last_message_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      : (raw.lastTime ?? ''),
    unread:   raw.unread_count ?? raw.unread ?? 0,
    otherId,
    messages: [],
  };
}

function mapMessage(raw: any, _myId?: number): Message {
  return {
    id:       String(raw.id),
    senderId: raw.sender_id ?? raw.senderId,
    text:     raw.content ?? raw.text,
    time:     (raw.created_at ?? raw.time ?? '').slice(11, 16) || raw.time,
    read:     raw.is_read ?? raw.read ?? false,
  };
}

export default function MensajesTab() {
  const { user } = useAuth();
  const myId = user?.id ?? 0;

  const [convs,       setConvs]       = useState<Conversation[]>([]);
  const [active,      setActive]      = useState<Conversation | null>(null);
  const [text,        setText]        = useState('');
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [contacts,    setContacts]    = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/messages/conversations')
      .then(r => {
        const list = (r.data.conversations ?? r.data ?? []).map(mapConv);
        setConvs(list);
        if (list.length > 0) loadConversation(list[0], list);
      })
      .catch(() => setConvs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  const loadConversation = async (conv: Conversation, allConvs?: Conversation[]) => {
    try {
      const [msgsRes] = await Promise.all([
        api.get(`/messages/conversations/${conv.otherId}`),
        api.post(`/messages/conversations/${conv.otherId}/read`).catch(() => {}),
      ]);
      const msgs: Message[] = (msgsRes.data.messages ?? msgsRes.data ?? []).map((m: any) => mapMessage(m, myId));
      const updated = { ...conv, messages: msgs, unread: 0 };
      setActive(updated);
      const base = allConvs ?? convs;
      setConvs(base.map(c => c.id === conv.id ? updated : c));
    } catch {
      setActive({ ...conv, messages: [] });
    }
  };

  const selectConv = (conv: Conversation) => {
    loadConversation(conv);
  };

  const sendMessage = async () => {
    if (!text.trim() || !active || sending) return;
    const msgText = text.trim();
    setText('');
    setSending(true);
    const optimistic: Message = { id: String(Date.now()), senderId: myId, text: msgText, time: new Date().toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'}), read: false };
    const updatedActive = { ...active, messages: [...active.messages, optimistic], lastMsg: msgText };
    setActive(updatedActive);
    setConvs(prev => prev.map(c => c.id === active.id ? updatedActive : c));
    try {
      await api.post(`/messages/conversations/${active.otherId}`, { content: msgText });
    } catch { /* keep optimistic */ }
    setSending(false);
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
    const role = contact.role.toLowerCase();
    const type: Conversation['type'] = role.includes('super') ? 'super'
      : role.includes('profesor') ? 'group' : 'student';
    const existing = convs.find(c => c.otherId === contact.id);
    if (existing) { selectConv(existing); setShowNew(false); return; }
    const newConv: Conversation = {
      id: String(contact.id), type, name: contact.name,
      avatar: contact.initials, lastMsg: '', lastTime: '',
      unread: 0, otherId: contact.id, messages: [],
    };
    setConvs(prev => [newConv, ...prev]);
    selectConv(newConv);
    setShowNew(false);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filtered = convs.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalUnread = convs.reduce((a, c) => a + c.unread, 0);

  return (
    <div className="flex h-[600px] bg-white border border-[#E9E9E7] rounded-xl overflow-hidden relative">

      {/* ── Contacts Modal ───────────────────────────────────── */}
      {showNew && (
        <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl w-80 shadow-xl flex flex-col max-h-[480px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9E9E7]">
              <h4 className="font-semibold text-[#191919] text-sm">Nueva conversación</h4>
              <button onClick={() => setShowNew(false)} className="text-[#787774] hover:text-[#191919]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-[#E9E9E7]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
                <input value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                  placeholder="Buscar contacto..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2E6FDB]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.length === 0 && (
                <p className="text-center text-xs text-[#AEADAB] py-8">
                  {contacts.length === 0 ? 'Cargando contactos…' : 'Sin resultados'}
                </p>
              )}
              {filteredContacts.map(contact => (
                <button key={contact.id} onClick={() => startConversation(contact)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F7F6F3] transition-colors text-left border-b border-[#F7F6F3] last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    contact.role.toLowerCase().includes('super') ? TYPE_COLOR.super
                    : contact.role.toLowerCase().includes('profesor') ? TYPE_COLOR.group
                    : TYPE_COLOR.student}`}>
                    {contact.initials}
                  </div>
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

      {/* ── Lista de conversaciones ──────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-[#E9E9E7] flex flex-col">
        <div className="px-4 py-3 border-b border-[#E9E9E7]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#191919] text-sm">Mensajes</h3>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#2E6FDB] text-white text-[10px] font-bold flex items-center justify-center">{totalUnread}</span>
              )}
              <button onClick={openNewChat} title="Nueva conversación"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF3FD] text-[#787774] hover:text-[#2E6FDB] transition-colors">
                <PenSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversación..."
              className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2E6FDB]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => {
            const isActiveConv = active?.id === conv.id;
            return (
              <button key={conv.id} onClick={() => selectConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#F7F6F3] transition-colors ${isActiveConv ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${TYPE_COLOR[conv.type]}`}>
                  {conv.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-[#191919]' : 'font-medium text-[#37352F]'}`}>{conv.name}</p>
                    <span className="text-[10px] text-[#AEADAB] flex-shrink-0 ml-2">{conv.lastTime}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-[#787774] truncate">{conv.lastMsg}</p>
                    {conv.unread > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#2E6FDB] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ml-2">{conv.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat activo ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#AEADAB]">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Cargando conversaciones…</> : 'Selecciona una conversación'}
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/50">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${TYPE_COLOR[active.type]}`}>
            {active.avatar}
          </div>
          <div>
            <p className="font-semibold text-[#191919] text-sm">{active.name}</p>
            <p className="text-[10px] text-[#AEADAB] capitalize">{active.type === 'group' ? 'Grupo' : active.type === 'super' ? 'Administración' : 'Estudiante'}</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {active.messages.map(msg => {
            const isMe = msg.senderId === myId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${isMe ? 'bg-[#2E6FDB] text-white rounded-br-sm' : 'bg-[#F7F6F3] text-[#191919] rounded-bl-sm'}`}>
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

        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-[#E9E9E7]">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder={`Escribe un mensaje a ${active.name}...`}
            className="flex-1 px-4 py-2 border border-[#E9E9E7] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]"
          />
          <button onClick={sendMessage} disabled={!text.trim() || sending}
            className="w-9 h-9 flex items-center justify-center bg-[#2E6FDB] text-white rounded-full hover:bg-[#255DC0] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
            <Send className="w-4 h-4" />
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
