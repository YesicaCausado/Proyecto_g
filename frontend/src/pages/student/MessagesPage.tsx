import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Search, CheckCheck, Loader2, MessageSquare } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Message {
  id: string;
  senderId: number;
  senderName: string;
  text: string;
  time: string;
  read: boolean;
}

interface Conversation {
  otherId: number;
  otherName: string;
  otherRole: string;
  initials: string;
  subtitle: string;
  lastMsg: string | null;
  lastTime: string | null;
  unread: number;
  messages: Message[];
  loaded: boolean;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  return {
    otherId:   raw.other_user_id,
    otherName: raw.other_user_name,
    otherRole: raw.other_user_role,
    initials:  getInitials(raw.other_user_name),
    subtitle:  raw.classroom_name ?? (raw.other_user_role === 'profesor' ? 'Profesor' : raw.other_user_role),
    lastMsg:   raw.last_message ?? null,
    lastTime:  raw.last_message_at ? fmtTime(raw.last_message_at) : null,
    unread:    raw.unread_count ?? 0,
    messages:  [],
    loaded:    false,
  };
}

function mapMessage(raw: any): Message {
  return {
    id:         String(raw.id),
    senderId:   raw.sender_id,
    senderName: raw.sender_name,
    text:       raw.content,
    time:       fmtTime(raw.created_at),
    read:       raw.is_read,
  };
}

// â”€â”€ Componente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MessagesPage() {
  const { user } = useAuth();
  const myId = user?.id ?? 0;

  const [convs,   setConvs]   = useState<Conversation[]>([]);
  const [active,  setActive]  = useState<Conversation | null>(null);
  const [text,    setText]    = useState('');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // â”€â”€ Cargar lista de conversaciones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    api.get('/messages/conversations')
      .then(res => {
        const list: Conversation[] = (res.data.conversations ?? []).map(mapConv);
        setConvs(list);
        if (list.length > 0) openConversation(list[0], list);
      })
      .catch(() => setConvs([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // â”€â”€ Scroll automÃ¡tico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  // â”€â”€ Abrir conversaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openConversation = useCallback(async (conv: Conversation, list?: Conversation[]) => {
    const src = list ?? convs;
    const withRead = src.map(c => c.otherId === conv.otherId ? { ...c, unread: 0 } : c);
    setConvs(withRead);

    if (!conv.loaded) {
      try {
        const res = await api.get(`/messages/conversations/${conv.otherId}`);
        const msgs: Message[] = (res.data.messages ?? []).map(mapMessage);
        const updated: Conversation = { ...conv, messages: msgs, loaded: true, unread: 0 };
        setConvs(prev => prev.map(c => c.otherId === conv.otherId ? updated : c));
        setActive(updated);
        api.post(`/messages/conversations/${conv.otherId}/read`).catch(() => {});
      } catch {
        setActive({ ...conv, unread: 0 });
      }
    } else {
      setActive({ ...conv, unread: 0 });
      api.post(`/messages/conversations/${conv.otherId}/read`).catch(() => {});
    }
  }, [convs]);

  // â”€â”€ Enviar mensaje â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sendMessage = async () => {
    if (!text.trim() || !active || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);

    const tempMsg: Message = {
      id:         `tmp-${Date.now()}`,
      senderId:   myId,
      senderName: user?.full_name ?? 'Yo',
      text:       content,
      time:       new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      read:       false,
    };
    const updatedActive = { ...active, messages: [...active.messages, tempMsg], lastMsg: content, lastTime: 'Ahora' };
    setActive(updatedActive);
    setConvs(prev => prev.map(c => c.otherId === active.otherId ? updatedActive : c));

    try {
      const res = await api.post(`/messages/conversations/${active.otherId}`, { content });
      const realMsg = mapMessage(res.data);
      setActive(prev => prev ? { ...prev, messages: prev.messages.map(m => m.id === tempMsg.id ? realMsg : m) } : prev);
      setConvs(prev => prev.map(c => c.otherId === active.otherId
        ? { ...c, messages: c.messages.map(m => m.id === tempMsg.id ? realMsg : m), lastMsg: content, lastTime: 'Ahora' }
        : c));
    } catch {
      setText(content);
      setActive(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== tempMsg.id) } : prev);
    } finally {
      setSending(false);
    }
  };

  const filtered = convs.filter(c =>
    c.otherName.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = convs.reduce((a, c) => a + c.unread, 0);
  const isTeacher = (c: Conversation) => c.otherRole === 'profesor' || c.otherRole === 'super_profesor';

  return (
    <div className="p-4 md:p-6 md:pl-8 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#37352F]">Mensajes</h1>
        <p className="text-[#787774] text-sm mt-1">Conversaciones con tus profesores</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-[#787774] animate-spin" />
        </div>
      ) : (
        <div className="flex h-[620px] bg-white border border-[#E9E9E7] rounded-xl overflow-hidden shadow-sm">

          {/* â”€â”€ Lista conversaciones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="w-72 flex-shrink-0 border-r border-[#E9E9E7] flex flex-col">
            <div className="px-4 py-3 border-b border-[#E9E9E7]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#191919]">Conversaciones</span>
                {totalUnread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#2E6FDB] text-white text-[10px] font-bold flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2E6FDB]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#F7F6F3]">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-[#AEADAB] text-xs">
                  <MessageSquare className="w-6 h-6 mb-2 text-[#E9E9E7]" />
                  Sin conversaciones aÃºn
                </div>
              ) : filtered.map(conv => {
                const isAct = active?.otherId === conv.otherId;
                const initBg = isTeacher(conv) ? 'bg-[#EEF3FD] text-[#2E6FDB]' : 'bg-emerald-50 text-[#0F7B6C]';
                return (
                  <button key={conv.otherId} onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isAct ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${initBg}`}>
                      {conv.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-[#191919]' : 'font-medium text-[#37352F]'}`}>{conv.otherName}</p>
                        {conv.lastTime && <span className="text-[10px] text-[#AEADAB] flex-shrink-0 ml-1">{conv.lastTime}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-[#787774] truncate">{conv.lastMsg ?? 'Inicia la conversaciÃ³n'}</p>
                        {conv.unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-[#2E6FDB] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 ml-1">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#AEADAB] mt-0.5 truncate">{conv.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {active ? (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/50 flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${isTeacher(active) ? 'bg-[#EEF3FD] text-[#2E6FDB]' : 'bg-emerald-50 text-[#0F7B6C]'}`}>
                  {active.initials}
                </div>
                <div>
                  <p className="font-semibold text-[#191919] text-sm">{active.otherName}</p>
                  <p className="text-[10px] text-[#AEADAB]">{active.subtitle}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {active.messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-[#AEADAB]">
                    <MessageSquare className="w-8 h-8 mb-2 text-[#E9E9E7]" />
                    <p className="text-xs">Inicia la conversaciÃ³n con {active.otherName}</p>
                  </div>
                )}
                {active.messages.map(msg => {
                  const isMe = msg.senderId === myId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMe && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 self-end ${isTeacher(active) ? 'bg-[#EEF3FD] text-[#2E6FDB]' : 'bg-emerald-50 text-[#0F7B6C]'}`}>
                          {getInitials(msg.senderName)}
                        </div>
                      )}
                      <div className="max-w-[68%]">
                        <div className={`px-4 py-2.5 rounded-2xl ${isMe ? 'bg-[#37352F] text-white rounded-br-sm' : 'bg-[#F7F6F3] text-[#191919] rounded-bl-sm border border-[#E9E9E7]'}`}>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/60' : 'text-[#AEADAB]'}`}>
                            <span className="text-[10px]">{msg.time}</span>
                            {isMe && <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-white/80' : 'text-white/40'}`} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-center gap-3 px-5 py-3 border-t border-[#E9E9E7] flex-shrink-0">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  placeholder={`Escribe un mensaje a ${active.otherName}...`}
                  className="flex-1 px-4 py-2 border border-[#E9E9E7] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20 focus:border-[#37352F]"
                />
                <button onClick={sendMessage} disabled={!text.trim() || sending}
                  className="w-9 h-9 flex items-center justify-center bg-[#37352F] text-white rounded-full hover:bg-[#2F2D2B] disabled:opacity-40 transition-colors">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#AEADAB]">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[#E9E9E7]" />
                <p className="text-sm">Selecciona una conversaciÃ³n</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

