import { useState, useRef, useEffect } from 'react';
import { Send, Search, CheckCheck } from 'lucide-react';

type ConvType = 'teacher' | 'group';

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  read: boolean;
}

interface Conversation {
  id: string;
  type: ConvType;
  name: string;
  subtitle: string;
  initials: string;
  lastMsg: string;
  lastTime: string;
  unread: number;
  messages: Message[];
}

const MY_ID = 'estudiante';

const INITIAL_CONVS: Conversation[] = [
  {
    id: 'c1', type: 'teacher', name: 'Prof. Carlos Martínez',
    subtitle: 'Matemáticas 9A', initials: 'CM',
    lastMsg: 'Puedes usar cualquiera de los dos métodos.',
    lastTime: '10:34', unread: 1,
    messages: [
      { id: 'm1', senderId: MY_ID,    text: 'Profe, buenos días. Tengo una duda sobre el ejercicio 10 de la tarea.', time: '10:20', read: true  },
      { id: 'm2', senderId: 'teacher',text: 'Hola, dime tu duda.', time: '10:22', read: true  },
      { id: 'm3', senderId: MY_ID,    text: '¿El ejercicio 10 se resuelve con fórmula general o completando el cuadrado?', time: '10:30', read: true  },
      { id: 'm4', senderId: 'teacher',text: 'Puedes usar cualquiera de los dos métodos.', time: '10:34', read: false },
    ],
  },
  {
    id: 'c2', type: 'group', name: 'Matemáticas 9A',
    subtitle: 'Prof. Carlos Martínez · 32 estudiantes', initials: 'M9',
    lastMsg: '¡Así se habla! Éxitos a todos.', lastTime: 'Ayer', unread: 3,
    messages: [
      { id: 'm5', senderId: 'teacher',  text: 'Recuerden que mañana hay tarea del capítulo 4.', time: 'Ayer 15:00', read: true  },
      { id: 'm6', senderId: 'valentina',text: '¡Entendido profe!', time: 'Ayer 15:05', read: true  },
      { id: 'm7', senderId: 'teacher',  text: '¡Así se habla! Éxitos a todos.', time: 'Ayer 15:10', read: false },
    ],
  },
  {
    id: 'c3', type: 'teacher', name: 'Prof. María López',
    subtitle: 'Física 10B', initials: 'ML',
    lastMsg: 'Sí, el parcial es el viernes 5 de julio.', lastTime: 'Lun', unread: 0,
    messages: [
      { id: 'm8', senderId: MY_ID,    text: 'Profe, ¿el parcial de física es el viernes o el lunes?', time: 'Lun 09:00', read: true },
      { id: 'm9', senderId: 'teacher',text: 'Sí, el parcial es el viernes 5 de julio.',              time: 'Lun 09:15', read: true },
    ],
  },
  {
    id: 'c4', type: 'group', name: 'Álgebra 8C',
    subtitle: 'Prof. Ana Torres · 30 estudiantes', initials: 'A8',
    lastMsg: 'La guía de estudio ya está disponible en el tablero.', lastTime: 'Dom', unread: 0,
    messages: [
      { id: 'm10', senderId: 'teacher', text: 'La guía de estudio ya está disponible en el tablero.', time: 'Dom 14:00', read: true },
    ],
  },
];

const TYPE_COLOR: Record<ConvType, string> = {
  teacher: 'bg-[#EEF3FD] text-[#2E6FDB]',
  group:   'bg-emerald-50 text-[#0F7B6C]',
};

const SENDER_NAMES: Record<string, string> = {
  teacher:   'Profesor',
  valentina: 'Valentina T.',
};

export default function MessagesPage() {
  const [convs,    setConvs]    = useState<Conversation[]>(INITIAL_CONVS);
  const [active,   setActive]   = useState<Conversation>(INITIAL_CONVS[0]);
  const [text,     setText]     = useState('');
  const [search,   setSearch]   = useState('');
  const bottomRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active.id, active.messages.length]);

  const selectConv = (conv: Conversation) => {
    const updated = { ...conv, unread: 0, messages: conv.messages.map(m => ({ ...m, read: true })) };
    setConvs(prev => prev.map(c => c.id === conv.id ? updated : c));
    setActive(updated);
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    const msg: Message = {
      id: Date.now().toString(), senderId: MY_ID, text: text.trim(),
      time: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };
    const updatedConv = { ...active, messages: [...active.messages, msg], lastMsg: text.trim(), lastTime: msg.time };
    setActive(updatedConv);
    setConvs(prev => prev.map(c => c.id === active.id ? updatedConv : c));
    setText('');
  };

  const filtered = convs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = convs.reduce((a, c) => a + c.unread, 0);

  const getSenderLabel = (senderId: string, conv: Conversation): string => {
    if (senderId === MY_ID) return 'Yo';
    if (senderId === 'teacher') return conv.name;
    return SENDER_NAMES[senderId] ?? senderId;
  };

  return (
    <div className="p-4 md:p-6 md:pl-8 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#37352F]">Mensajes</h1>
        <p className="text-[#787774] text-sm mt-1">Conversaciones con tus profesores y grupos</p>
      </div>

      <div className="flex h-[620px] bg-white border border-[#E9E9E7] rounded-xl overflow-hidden shadow-sm">

        {/* ── Lista conversaciones ─────────────────────────── */}
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
            {filtered.map(conv => {
              const isAct = active.id === conv.id;
              return (
                <button key={conv.id} onClick={() => selectConv(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isAct ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${TYPE_COLOR[conv.type]}`}>
                    {conv.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-[#191919]' : 'font-medium text-[#37352F]'}`}>{conv.name}</p>
                      <span className="text-[10px] text-[#AEADAB] flex-shrink-0 ml-1">{conv.lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#787774] truncate">{conv.lastMsg}</p>
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

        {/* ── Chat ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/50 flex-shrink-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${TYPE_COLOR[active.type]}`}>
              {active.initials}
            </div>
            <div>
              <p className="font-semibold text-[#191919] text-sm">{active.name}</p>
              <p className="text-[10px] text-[#AEADAB]">{active.subtitle}</p>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {active.messages.map(msg => {
              const isMe = msg.senderId === MY_ID;
              const senderLabel = getSenderLabel(msg.senderId, active);
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                  {!isMe && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 self-end ${TYPE_COLOR[active.type]}`}>
                      {senderLabel.charAt(0)}
                    </div>
                  )}
                  <div className={`max-w-[68%] ${isMe ? '' : ''}`}>
                    {!isMe && active.type === 'group' && (
                      <p className="text-[10px] text-[#AEADAB] mb-1 pl-1">{senderLabel}</p>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl ${isMe ? 'bg-[#37352F] text-white rounded-br-sm' : 'bg-[#F7F6F3] text-[#191919] rounded-bl-sm border border-[#E9E9E7]'}`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/60' : 'text-[#AEADAB]'}`}>
                        <span className="text-[10px]">{msg.time}</span>
                        {isMe && <CheckCheck className={`w-3 h-3 ${msg.read ? (isMe ? 'text-white/80' : '') : 'text-white/40'}`} />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Nota grupos — solo lectura en grupos del profesor */}
          {active.type === 'group' && (
            <div className="px-5 py-2 bg-[#F7F6F3] border-t border-[#E9E9E7]">
              <p className="text-[11px] text-[#787774] text-center">
                📢 Solo los profesores pueden publicar en grupos. Puedes responder en los comentarios del tablero.
              </p>
            </div>
          )}

          {/* Input — solo para chats directos */}
          {active.type === 'teacher' && (
            <div className="flex items-center gap-3 px-5 py-3 border-t border-[#E9E9E7] flex-shrink-0">
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder={`Escribe un mensaje a ${active.name}...`}
                className="flex-1 px-4 py-2 border border-[#E9E9E7] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20 focus:border-[#37352F]"
              />
              <button onClick={sendMessage} disabled={!text.trim()}
                className="w-9 h-9 flex items-center justify-center bg-[#37352F] text-white rounded-full hover:bg-[#2F2D2B] disabled:opacity-40 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
