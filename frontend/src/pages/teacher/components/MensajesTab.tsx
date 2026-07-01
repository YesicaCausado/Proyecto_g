import { useState, useRef, useEffect } from 'react';
import { Send, Search, CheckCheck } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
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
  messages: Message[];
}

const MY_ID = 'profesor';

const MOCK_CONVS: Conversation[] = [
  {
    id:'c1', type:'student', name:'Juan Pérez', avatar:'J', lastMsg:'¿El ejercicio 10 es con fórmula general?', lastTime:'10:32',unread:1,
    messages:[
      {id:'m1',senderId:'juan',    text:'Buenos días profe, tengo una duda sobre la tarea.',time:'10:15',read:true},
      {id:'m2',senderId:MY_ID,     text:'Hola Juan, dime en qué tienes dudas.',time:'10:18',read:true},
      {id:'m3',senderId:'juan',    text:'¿El ejercicio 10 es con fórmula general?',time:'10:32',read:false},
    ],
  },
  {
    id:'c2', type:'group', name:'Matemáticas 9A', avatar:'M', lastMsg:'Recuerden entregar la tarea hoy', lastTime:'09:00',unread:0,
    messages:[
      {id:'m4',senderId:MY_ID,     text:'Buenos días grupo, recuerden que hoy vence la entrega de la tarea #4.',time:'09:00',read:true},
      {id:'m5',senderId:'valentina',text:'¡Entendido profe! Ya la subí.',time:'09:05',read:true},
      {id:'m6',senderId:'carlos',   text:'Yo también. ¡Gracias!',time:'09:08',read:true},
    ],
  },
  {
    id:'c3', type:'super', name:'Super Profe (Rector)', avatar:'R', lastMsg:'Reunión el viernes a las 4pm', lastTime:'Ayer',unread:1,
    messages:[
      {id:'m7',senderId:'rector',  text:'Hola, hay reunión de docentes el viernes a las 4pm. ¿Puedes asistir?',time:'Ayer',read:false},
      {id:'m8',senderId:MY_ID,     text:'Claro, ahí estaré.',time:'Ayer',read:true},
    ],
  },
  {
    id:'c4', type:'student', name:'Valentina Torres', avatar:'V', lastMsg:'Gracias profe, quedó muy claro!', lastTime:'Lun',unread:0,
    messages:[
      {id:'m9', senderId:'valentina',text:'Profe, ¿cuándo es el próximo examen?',time:'Lun 14:00',read:true},
      {id:'m10',senderId:MY_ID,     text:'El 10 de julio, Valentina. ¡Estudia mucho!',time:'Lun 14:05',read:true},
      {id:'m11',senderId:'valentina',text:'Gracias profe, quedó muy claro!',time:'Lun 14:07',read:true},
    ],
  },
];

const TYPE_COLOR: Record<Conversation['type'], string> = { student:'bg-[#EEF3FD] text-[#2E6FDB]', group:'bg-emerald-50 text-[#0F7B6C]', super:'bg-purple-50 text-[#6940A5]' };

export default function MensajesTab() {
  const [convs,    setConvs]    = useState<Conversation[]>(MOCK_CONVS);
  const [active,   setActive]   = useState<Conversation>(MOCK_CONVS[0]);
  const [text,     setText]     = useState('');
  const [search,   setSearch]   = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active.id, active.messages.length]);

  const selectConv = (conv: Conversation) => {
    // Marcar mensajes como leídos
    const updated = conv.id === conv.id ? { ...conv, unread: 0, messages: conv.messages.map(m => ({...m, read:true})) } : conv;
    setConvs(prev => prev.map(c => c.id === conv.id ? updated : c));
    setActive(updated);
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    const msg: Message = { id: Date.now().toString(), senderId: MY_ID, text: text.trim(), time: new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}), read: true };
    const updatedConv = { ...active, messages: [...active.messages, msg], lastMsg: text.trim(), lastTime: msg.time };
    setActive(updatedConv);
    setConvs(prev => prev.map(c => c.id === active.id ? updatedConv : c));
    setText('');
  };

  const filtered = convs.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const totalUnread = convs.reduce((a, c) => a + c.unread, 0);

  return (
    <div className="flex h-[600px] bg-white border border-[#E9E9E7] rounded-xl overflow-hidden">

      {/* ── Lista de conversaciones ──────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-[#E9E9E7] flex flex-col">
        <div className="px-4 py-3 border-b border-[#E9E9E7]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#191919] text-sm">Mensajes</h3>
            {totalUnread > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#2E6FDB] text-white text-[10px] font-bold flex items-center justify-center">{totalUnread}</span>
            )}
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
            const isActive = active.id === conv.id;
            return (
              <button key={conv.id} onClick={() => selectConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#F7F6F3] transition-colors ${isActive ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]'}`}>
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
            const isMe = msg.senderId === MY_ID;
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
          <button onClick={sendMessage} disabled={!text.trim()}
            className="w-9 h-9 flex items-center justify-center bg-[#2E6FDB] text-white rounded-full hover:bg-[#255DC0] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
