/**
 * Panel de notificaciones (todos los roles).
 *
 * Lista las notificaciones guardadas del usuario, más recientes primero. Al
 * pulsar una se marca como leída en el servidor y se abre el recurso exacto
 * (`link`), por ejemplo el NeuroBot asignado o la conversación del mensaje.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, Bot, Building2, CheckCheck, ClipboardList, Flame, Loader2, MessageSquare,
  RotateCcw, Star, Trophy, X,
} from 'lucide-react';
import { useNotifications, type AppNotification } from '../context/NotificationsContext';

const ICONS: Record<string, { icon: React.ReactNode; bg: string }> = {
  bot:       { icon: <Bot className="w-4 h-4 text-[#2E6FDB]" />,             bg: 'bg-[#EEF3FD] border-[#C5D9F7]' },
  trophy:    { icon: <Trophy className="w-4 h-4 text-[#0F7B6C]" />,          bg: 'bg-[#EDF7F5] border-[#B7E1D9]' },
  clipboard: { icon: <ClipboardList className="w-4 h-4 text-[#6940A5]" />,   bg: 'bg-[#F4EFFA] border-[#DCCDEF]' },
  alert:     { icon: <AlertTriangle className="w-4 h-4 text-[#E03E3E]" />,   bg: 'bg-[#FDEEEE] border-[#F5C7C7]' },
  building:  { icon: <Building2 className="w-4 h-4 text-[#787774]" />,       bg: 'bg-[#F7F6F3] border-[#E9E9E7]' },
  flame:     { icon: <Flame className="w-4 h-4 text-[#D9730D]" />,           bg: 'bg-[#FBF0E6] border-[#F3D3B5]' },
  star:      { icon: <Star className="w-4 h-4 text-[#CB912F]" />,            bg: 'bg-[#FBF3DB] border-[#F0DDA4]' },
  message:   { icon: <MessageSquare className="w-4 h-4 text-[#2E6FDB]" />,   bg: 'bg-[#EEF3FD] border-[#C5D9F7]' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

interface NotificationsPanelProps {
  onClose: () => void;
  /** `dropdown`: bajo un botón en una barra. `sidebar`: junto a un menú lateral. */
  placement?: 'dropdown' | 'sidebar';
}

export function NotificationsPanel({ onClose, placement = 'dropdown' }: NotificationsPanelProps) {
  const { notifications, unreadCount, loading, error, hasMore, refresh, loadMore, markRead, markAllRead } =
    useNotifications();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const open = async (n: AppNotification) => {
    if (!n.read) await markRead(n.id);
    if (n.link) {
      onClose();
      navigate(n.link);
    }
  };

  const position = placement === 'sidebar'
    ? 'fixed left-2 right-2 bottom-2 top-14 sm:top-auto sm:right-auto sm:left-[248px] sm:bottom-4 sm:w-96'
    : 'fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-96';

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notificaciones"
      className={`${position} z-[70] bg-white border border-[#E9E9E7] rounded-xl shadow-xl overflow-hidden flex flex-col sm:max-h-[520px]`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#787774]" />
          <span className="font-semibold text-sm text-[#37352F]">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="bg-[#E03E3E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={() => markAllRead()}
              className="flex items-center gap-1 text-xs text-[#2E6FDB] hover:underline font-medium">
              <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
            </button>
          )}
          <button onClick={onClose} aria-label="Cerrar" className="text-[#9B9A97] hover:text-[#37352F]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-[#E03E3E] bg-[#FDEEEE] border-b border-[#F5C7C7]">
          <span>{error}</span>
          <button onClick={() => refresh()} className="flex items-center gap-1 font-medium hover:underline">
            <RotateCcw className="w-3 h-3" /> Reintentar
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#2E6FDB]" />
          </div>
        ) : notifications.length === 0 ? (
          !error && (
            <div className="flex flex-col items-center justify-center py-10 text-[#9B9A97] gap-2">
              <Bell className="w-8 h-8 opacity-30" />
              <p className="text-sm">No tienes notificaciones.</p>
            </div>
          )
        ) : (
          <>
            {notifications.map(n => {
              const look = ICONS[n.icon] ?? { icon: <Bell className="w-4 h-4 text-[#9B9A97]" />, bg: 'bg-[#F7F6F3] border-[#E9E9E7]' };
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3 border-b last:border-b-0 border-[#F0F0EF] transition-colors hover:bg-[#F7F6F3] ${
                    n.read ? '' : 'bg-[#FBFBFA]'
                  }`}
                >
                  <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${look.bg}`}>
                    {look.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.read ? 'text-[#787774]' : 'font-semibold text-[#37352F]'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-[#787774] mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-[#AEADAB] mt-1">
                      {timeAgo(n.created_at)}
                      {n.link && <span className="text-[#2E6FDB]"> · Ver</span>}
                    </p>
                  </div>
                  {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#2E6FDB] flex-shrink-0" aria-label="No leída" />}
                </button>
              );
            })}
            {hasMore && (
              <button onClick={() => loadMore()} disabled={loading}
                className="w-full py-2.5 text-xs font-medium text-[#2E6FDB] hover:bg-[#F7F6F3] disabled:opacity-60">
                {loading ? 'Cargando…' : 'Ver más'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NotificationsPanel;
