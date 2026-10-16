import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Search, Loader2, MessageSquare, PenSquare, X,
  CheckCheck, Paperclip, Download, ArrowLeft, Trash2, AlertTriangle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Messaging — Componente único y reutilizable de mensajería directa.
 *
 * Se usa en los tres paneles de rol (Super Profesor, Profesor, Estudiante) contra
 * la misma API `/messages/*` del backend, que ya valida las reglas de rol.
 *
 * Funcionalidades añadidas:
 *   - Eliminar para mí / Eliminar para todos (con confirmación modal)
 *   - Restricción de 15 min para "eliminar para todos" validada en backend
 *   - Separadores de fecha estilo WhatsApp (Hoy / Ayer / fecha larga)
 *   - Hora de envío visible en cada mensaje
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  senderId: number;
  text: string;
  time: string;        // HH:MM formateado para mostrar
  createdAt: string;   // ISO 8601 original del backend (para cálculos de fecha)
  read: boolean;
  isDeleted?: boolean;
  deletedForAll?: boolean;
  canDeleteForAll?: boolean;  // backend calcula si la ventana de 15 min está activa
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
  accent?: string;
  height?: string;
  emptyHint?: string;
}

type DeleteScope = 'for_me' | 'for_all';

interface DeleteConfirm {
  msg: Message;
  canDeleteForAll: boolean;
}

// ── Utilidades de fecha ───────────────────────────────────────────────────────

/** Etiqueta del separador de fecha estilo WhatsApp, en zona horaria local. */
function dateSeparatorLabel(iso: string): string {
  const msgDate  = new Date(iso);
  const today    = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  if (sameDay(msgDate, today))     return 'Hoy';
  if (sameDay(msgDate, yesterday)) return 'Ayer';

  return msgDate.toLocaleDateString('es-CO', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  });
}

/** Clave de agrupación: YYYY-MM-DD en hora local. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Formatea HH:MM para mostrar en cada mensaje. */
function fmtMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** Formatea la última hora de conversación en la lista lateral. */
function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ── Mapeo de datos API ────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function mapConv(raw: any): Conversation {
  const otherId = raw.other_user_id ?? raw.other_id ?? 0;
  const name    = raw.other_user_name ?? raw.other_name ?? '—';
  return {
    otherId,
    name,
    role:     raw.other_user_role ?? raw.other_role ?? '',
    initials: getInitials(name),
    subtitle: raw.classroom_name ?? '',
    lastMsg:  raw.last_message ?? '',
    lastTime: raw.last_message_at ? fmtTime(raw.last_message_at) : '',
    unread:   raw.unread_count ?? 0,
    messages: [],
    loaded:   false,
  };
}

function mapMessage(raw: any): Message {
  const iso = raw.created_at ?? '';
  return {
    id:             String(raw.id),
    senderId:       raw.sender_id,
    text:           raw.content ?? raw.text ?? '',
    time:           iso ? fmtMsgTime(iso) : (raw.time ?? ''),
    createdAt:      iso,
    read:           raw.is_read ?? false,
    isDeleted:      raw.is_deleted ?? false,
    deletedForAll:  raw.deleted_for_all ?? false,
    canDeleteForAll: raw.can_delete_for_all ?? false,
    attachment:     raw.attachment ?? null,
  };
}

// ── Constantes visuales ───────────────────────────────────────────────────────

const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  super_profesor: { bg: 'bg-purple-50 text-[#6940A5]',  text: 'text-[#6940A5]', label: 'Super Profesor' },
  profesor:       { bg: 'bg-[#EEF3FD] text-[#2E6FDB]', text: 'text-[#2E6FDB]', label: 'Profesor'       },
  estudiante:     { bg: 'bg-emerald-50 text-[#0F7B6C]', text: 'text-[#0F7B6C]', label: 'Estudiante'     },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function Messaging({ accent = '#0066FF', height = 'h-[600px]', emptyHint }: MessagingProps) {
  const { user }  = useAuth();
  const myId      = user?.id ?? 0;
  const [searchParams] = useSearchParams();
  const withUser  = Number(searchParams.get('with')) || null;

  const [convs,         setConvs]         = useState<Conversation[]>([]);
  const [active,        setActive]        = useState<Conversation | null>(null);
  const [text,          setText]          = useState('');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [showNew,       setShowNew]       = useState(false);
  const [contacts,      setContacts]      = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [attachment,    setAttachment]    = useState<File | null>(null);
  const [messageError,  setMessageError]  = useState('');
  const [mobileListOpen, setMobileListOpen] = useState(true);

  // Estado del modal de confirmación de eliminación
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  // ── Carga inicial ────────────────────────────────────────────────────────

  useEffect(() => {
    api.get('/messages/conversations', { params: { _t: Date.now() } })
      .then(res => {
        const list: Conversation[] = (res.data.conversations ?? res.data ?? []).map(mapConv);
        setConvs(list);
        const target = withUser ? list.find(c => c.otherId === withUser) : undefined;
        if (target)            openConversation(target, list);
        else if (list.length)  openConversation(list[0], list);
      })
      .catch(() => setConvs([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  // ── Abrir conversación ────────────────────────────────────────────────────

  const openConversation = useCallback(async (conv: Conversation, list?: Conversation[]) => {
    setMobileListOpen(false);
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

  // ── Enviar mensaje ────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if ((!text.trim() && !attachment) || !active || sending) return;
    const content = text.trim();
    const file    = attachment;
    setText('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSending(true);

    const now = new Date().toISOString();
    const tempMsg: Message = {
      id:             `tmp-${Date.now()}`,
      senderId:       myId,
      text:           content,
      time:           fmtMsgTime(now),
      createdAt:      now,
      read:           false,
      canDeleteForAll: true,   // recién enviado → dentro de ventana
      attachment:     file ? { name: file.name, mime: file.type, size: file.size, url: '' } : null,
    };
    const updatedActive = {
      ...active,
      messages: [...active.messages, tempMsg],
      lastMsg:  content || `📎 ${file?.name}`,
      lastTime: 'Ahora',
      unread:   0,
    };
    setActive(updatedActive);
    setConvs(prev => prev.map(c => c.otherId === active.otherId ? updatedActive : c));

    try {
      const form = new FormData();
      form.append('content', content);
      if (file) form.append('file', file);
      const { data } = await api.post(`/messages/conversations/${active.otherId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Reemplazar el mensaje temporal con el real (incluye created_at real)
      const realMsg = mapMessage(data);
      setActive(prev => prev
        ? { ...prev, messages: prev.messages.map(m => m.id === tempMsg.id ? realMsg : m) }
        : prev,
      );
      setConvs(prev => prev.map(c => c.otherId === active.otherId
        ? { ...c, messages: c.messages.map(m => m.id === tempMsg.id ? realMsg : m) }
        : c,
      ));
    } catch {
      setText(content);
      setAttachment(file);
      setActive(prev => prev
        ? { ...prev, messages: prev.messages.filter(m => m.id !== tempMsg.id) }
        : prev,
      );
    } finally {
      setSending(false);
    }
  };

  // ── Eliminación de mensajes ───────────────────────────────────────────────

  /** Abre el modal de confirmación. El backend dirá si la ventana de 15 min aplica. */
  const requestDelete = (msg: Message) => {
    if (deletingId) return;
    setMessageError('');
    setDeleteConfirm({ msg, canDeleteForAll: msg.canDeleteForAll ?? false });
  };

  /** Ejecuta la eliminación con el scope elegido. */
  const confirmDelete = async (scope: DeleteScope) => {
    if (!deleteConfirm || !active) return;
    const { msg } = deleteConfirm;
    setDeleteConfirm(null);
    setDeletingId(msg.id);

    // ✅ LO QUE DEBE QUEDAR:
    try {
      await api.delete(`/messages/${msg.id}`, { params: { scope } });

      if (scope === 'for_all') {
        // Mostrar marcador en lugar de ocultar
        const placeholder: Message = {
          ...msg,
          text:           'Eliminaste este mensaje',
          isDeleted:      true,
          deletedForAll:  true,
          canDeleteForAll: false,
          attachment:     null,
        };
        const update = (msgs: Message[]) =>
          msgs.map(m => m.id === msg.id ? placeholder : m);
        setActive(prev => prev ? { ...prev, messages: update(prev.messages) } : prev);
        setConvs(prev => prev.map(c => c.otherId === active.otherId
          ? { ...c, messages: update(c.messages) }
          : c,
        ));
      } else {
        // Ocultar completamente para el usuario actual
        const update = (msgs: Message[]) => msgs.filter(m => m.id !== msg.id);
        const remaining = update(active.messages);
        const last      = remaining[remaining.length - 1];
        setActive(prev => prev ? {
          ...prev,
          messages: remaining,
          lastMsg:  last ? (last.text || (last.attachment ? `📎 ${last.attachment.name}` : '')) : '',
          lastTime: last?.time ?? '',
        } : prev);
        setConvs(prev => prev.map(c => c.otherId === active.otherId
          ? {
              ...c,
              messages: update(c.messages),
              lastMsg:  last ? (last.text || (last.attachment ? `📎 ${last.attachment.name}` : '')) : '',
              lastTime: last?.time ?? '',
            }
          : c,
        ));
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'No se pudo eliminar el mensaje.';
      setMessageError(detail);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Nueva conversación ────────────────────────────────────────────────────

  const openNewChat = async () => {
    setShowNew(true);
    if (contacts.length > 0) return;
    try {
      const r = await api.get('/messages/contacts');
      setContacts((r.data.contacts ?? r.data ?? []).map((c: any) => ({
        id:       c.id,
        name:     c.name ?? c.full_name ?? '—',
        role:     c.role ?? '',
        initials: (c.name ?? c.full_name ?? '?').charAt(0).toUpperCase(),
      })));
    } catch { /* noop */ }
  };

  const startConversation = (contact: Contact) => {
    const existing = convs.find(c => c.otherId === contact.id);
    if (existing) { openConversation(existing); setShowNew(false); return; }
    const newConv: Conversation = {
      otherId:  contact.id, name:    contact.name,
      role:     contact.role, initials: contact.initials,
      subtitle: '', lastMsg: '', lastTime: '',
      unread: 0, messages: [], loaded: false,
    };
    setConvs(prev => [newConv, ...prev]);
    openConversation(newConv, [newConv, ...convs]);
    setShowNew(false);
  };

  // ── Descarga de adjuntos ──────────────────────────────────────────────────

  const downloadAttachment = async (msg: Message) => {
    if (!msg.attachment?.url) return;
    try {
      const res  = await fetch(msg.attachment.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = msg.attachment.name || 'archivo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { /* noop */ }
  };

  // ── Separadores de fecha ──────────────────────────────────────────────────

  /**
   * Construye una lista intercalada con separadores de fecha entre mensajes
   * de días distintos. Usa `createdAt` ISO para agrupar.
   */
  const messagesWithSeparators = useCallback((messages: Message[]) => {
    const items: Array<{ type: 'separator'; label: string; key: string } | { type: 'message'; msg: Message }> = [];
    let lastDay = '';
    for (const msg of messages) {
      const iso = msg.createdAt || '';
      const key = iso ? dayKey(iso) : 'unknown';
      if (key !== lastDay) {
        lastDay = key;
        items.push({
          type:  'separator',
          label: iso ? dateSeparatorLabel(iso) : '',
          key,
        });
      }
      items.push({ type: 'message', msg });
    }
    return items;
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────

  const filtered         = convs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()),
  );
  const totalUnread      = convs.reduce((a, c) => a + c.unread, 0);
  const badgeFor = (role: string) =>
    ROLE_BADGES[role] ?? { bg: 'bg-[#F7F6F3] text-[#787774]', text: 'text-[#787774]', label: role };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className={`flex ${height} bg-white border border-[#E9E9E7] rounded-xl overflow-hidden relative`}>

      {/* ── Modal: nueva conversación ────────────────────────────────────── */}
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
                <input
                  value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                  placeholder="Buscar contacto..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0066FF]"
                />
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${b.bg}`}>
                      {contact.initials}
                    </div>
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

      {/* ── Modal: confirmar eliminación ─────────────────────────────────── */}
      {deleteConfirm && (
        <div className="absolute inset-0 z-30 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F0F0EE]">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-[#E03E3E]" />
              </div>
              <div>
                <h4 className="font-semibold text-[#191919] text-sm">Eliminar mensaje</h4>
                <p className="text-[11px] text-[#787774]">Elige cómo quieres eliminarlo</p>
              </div>
            </div>

            {/* Opciones */}
            <div className="px-5 py-4 space-y-2">
              {/* Eliminar para mí */}
              <button
                onClick={() => confirmDelete('for_me')}
                disabled={!!deletingId}
                className="w-full flex flex-col items-start px-4 py-3 rounded-xl border border-[#E9E9E7] hover:bg-[#FFF5F5] hover:border-red-200 transition-colors text-left disabled:opacity-50 group"
              >
                <span className="text-sm font-medium text-[#191919] group-hover:text-[#E03E3E]">
                  Eliminar para mí
                </span>
                <span className="text-[11px] text-[#787774] mt-0.5">
                  Solo tú dejarás de ver este mensaje
                </span>
              </button>

              {/* Eliminar para todos */}
              <button
                onClick={() => confirmDelete('for_all')}
                disabled={!!deletingId || !deleteConfirm.canDeleteForAll}
                className="w-full flex flex-col items-start px-4 py-3 rounded-xl border border-[#E9E9E7] hover:bg-[#FFF5F5] hover:border-red-200 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className={`text-sm font-medium ${deleteConfirm.canDeleteForAll ? 'text-[#191919] group-hover:text-[#E03E3E]' : 'text-[#AEADAB]'}`}>
                  Eliminar para todos
                </span>
                <span className="text-[11px] text-[#787774] mt-0.5">
                  {deleteConfirm.canDeleteForAll
                    ? 'Se eliminará para todos los participantes'
                    : 'Solo disponible durante los primeros 15 minutos'}
                </span>
              </button>
            </div>

            {/* Pie */}
            <div className="px-5 pb-4">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="w-full py-2 rounded-xl text-sm text-[#787774] hover:text-[#191919] hover:bg-[#F7F6F3] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de conversaciones ──────────────────────────────────────── */}
      <div className={`${active && !mobileListOpen ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0 border-r border-[#E9E9E7] flex-col`}>
        <div className="px-4 py-3 border-b border-[#E9E9E7]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#191919] text-sm">Mensajes</h3>
            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: accent }}>
                  {totalUnread}
                </span>
              )}
              <button onClick={openNewChat} title="Nueva conversación"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF3FD] text-[#787774] hover:text-[#0066FF] transition-colors">
                <PenSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AEADAB]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#0066FF]"
            />
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
            const b        = badgeFor(conv.role.toLowerCase());
            const isActive = active?.otherId === conv.otherId;
            return (
              <button key={conv.otherId} onClick={() => openConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-[#EEF3FD]' : 'hover:bg-[#F7F6F3]'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${b.bg}`}>
                  {conv.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-[#191919]' : 'font-medium text-[#37352F]'}`}>
                      {conv.name}
                    </p>
                    {conv.lastTime && (
                      <span className="text-[10px] text-[#AEADAB] flex-shrink-0 ml-1">{conv.lastTime}</span>
                    )}
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

      {/* ── Panel de chat ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#AEADAB]">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Cargando conversaciones…</>
              : 'Selecciona una conversación'}
          </div>
        ) : (
          <>
            {/* Cabecera del chat */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]/50 flex-shrink-0">
              <button
                onClick={() => setMobileListOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-[#787774] hover:bg-white"
                aria-label="Volver a conversaciones"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${badgeFor(active.role.toLowerCase()).bg}`}>
                {active.initials}
              </div>
              <div>
                <p className="font-semibold text-[#191919] text-sm">{active.name}</p>
                <p className="text-[10px] text-[#AEADAB] capitalize">{badgeFor(active.role.toLowerCase()).label}</p>
              </div>
            </div>

            {/* Área de mensajes */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 space-y-1 overscroll-contain">
              {messageError && (
                <div className="flex items-center gap-2 justify-center py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#E03E3E]" />
                  <p className="text-xs text-[#E03E3E]" role="alert">{messageError}</p>
                  <button onClick={() => setMessageError('')} className="text-[#787774] hover:text-[#191919]">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {active.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-[#AEADAB]">
                  <MessageSquare className="w-8 h-8 mb-2 text-[#E9E9E7]" />
                  <p className="text-xs">Inicia la conversación con {active.name}</p>
                </div>
              )}

              {messagesWithSeparators(active.messages).map(item => {
                // ── Separador de fecha ──────────────────────────────────────
                if (item.type === 'separator') {
                  return (
                    <div key={`sep-${item.key}`} className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px bg-[#E9E9E7]" />
                      <span className="text-[11px] text-[#AEADAB] font-medium px-2 py-0.5 bg-[#F7F6F3] rounded-full flex-shrink-0">
                        {item.label}
                      </span>
                      <div className="flex-1 h-px bg-[#E9E9E7]" />
                    </div>
                  );
                }

                // ── Burbuja de mensaje ──────────────────────────────────────
                const { msg } = item;
                const isMe      = msg.senderId === myId;
                const isDeleted = msg.isDeleted || msg.deletedForAll;

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div
                      className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${
                        isMe
                          ? isDeleted
                            ? 'bg-[#EEF3FD] border border-[#D0DEF8]'
                            : 'text-white rounded-br-sm'
                          : isDeleted
                            ? 'bg-[#F0F0EE] border border-[#E0E0DE]'
                            : 'bg-[#F7F6F3] text-[#191919] rounded-bl-sm'
                      }`}
                      style={isMe && !isDeleted ? { background: accent } : undefined}
                    >
                      {/* Contenido del mensaje (normal o eliminado) */}
                      {isDeleted ? (
                        <p className="text-sm italic text-[#AEADAB]">{msg.text}</p>
                      ) : (
                        <>
                          {msg.text && (
                            <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
                          )}
                          {msg.attachment?.name && (
                            <button
                              onClick={() => downloadAttachment(msg)}
                              disabled={!msg.attachment?.url}
                              className={`mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isMe
                                  ? 'bg-white/20 text-white hover:bg-white/30'
                                  : 'bg-white border border-[#E9E9E7] text-[#37352F] hover:bg-[#EBEBEA]'
                              }`}
                              title="Descargar archivo"
                            >
                              <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-[160px]">{msg.attachment.name}</span>
                              {msg.attachment.url && <Download className="w-3.5 h-3.5 flex-shrink-0" />}
                            </button>
                          )}
                        </>
                      )}

                      {/* Pie del mensaje: hora + leído + botón eliminar */}
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        isMe
                          ? isDeleted ? 'text-[#AEADAB]' : 'text-white/70'
                          : 'text-[#AEADAB]'
                      }`}>
                        <span className="text-[10px]">{msg.time}</span>
                        {isMe && !isDeleted && (
                          <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-white' : 'text-white/50'}`} />
                        )}
                        {/* Botón eliminar: solo para mis mensajes no eliminados */}
                        {isMe && !isDeleted && (
                          <button
                            type="button"
                            onClick={() => requestDelete(msg)}
                            disabled={deletingId === msg.id}
                            aria-label="Eliminar mensaje"
                            title="Eliminar mensaje"
                            className="ml-1 p-0.5 rounded text-white/70 hover:text-white disabled:opacity-50 transition-colors"
                          >
                            {deletingId === msg.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Trash2 className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Barra de escritura */}
            <div className="px-5 pt-3 border-t border-[#E9E9E7] flex-shrink-0">
              {attachment && (
                <div className="mb-2 flex items-center gap-2 px-3 py-1.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg text-xs text-[#37352F]">
                  <Paperclip className="w-3.5 h-3.5 text-[#787774]" />
                  <span className="truncate flex-1">{attachment.name}</span>
                  <span className="text-[#AEADAB]">{Math.round(attachment.size / 1024)} KB</span>
                  <button
                    onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-[#787774] hover:text-[#E03E3E]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
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
                <button
                  onClick={sendMessage}
                  disabled={(!text.trim() && !attachment) || sending}
                  className="w-9 h-9 flex items-center justify-center text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:opacity-90"
                  style={{ background: accent }}
                >
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