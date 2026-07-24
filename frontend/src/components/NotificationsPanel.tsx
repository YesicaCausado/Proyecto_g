import { useRef, useEffect } from 'react';
import {
  Flame, Trophy, Star, Brain, Bot, Lightbulb, Sparkles, X, Bell,
} from 'lucide-react';
import type { AppNotification } from '../hooks/useNotifications';

interface NotificationsPanelProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  flame:     <Flame     className="w-4 h-4 text-orange-500" />,
  trophy:    <Trophy    className="w-4 h-4 text-yellow-500" />,
  star:      <Star      className="w-4 h-4 text-yellow-400" />,
  brain:     <Brain     className="w-4 h-4 text-purple-500" />,
  bot:       <Bot       className="w-4 h-4 text-indigo-500" />,
  lightbulb: <Lightbulb className="w-4 h-4 text-blue-400"  />,
  sparkles:  <Sparkles  className="w-4 h-4 text-violet-500" />,
};

const TYPE_BG: Record<string, string> = {
  warning:     'bg-orange-50 border-orange-200',
  achievement: 'bg-yellow-50 border-yellow-200',
  success:     'bg-green-50  border-green-200',
  info:        'bg-blue-50   border-blue-200',
  tip:         'bg-violet-50 border-violet-200',
};

export function NotificationsPanel({
  notifications,
  onClose,
  onMarkAllRead,
}: NotificationsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 z-50 w-80 sm:w-96 bg-white border border-[#E9E9E7] rounded-xl shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E9E9E7] bg-[#F7F6F3]">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#787774]" />
          <span className="font-semibold text-sm text-[#37352F]">Notificaciones</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="bg-[#7C5CBF] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.some(n => !n.read) && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-[#7C5CBF] hover:underline font-medium"
            >
              Marcar todas
            </button>
          )}
          <button onClick={onClose} className="text-[#9B9A97] hover:text-[#37352F]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#9B9A97] gap-2">
            <Bell className="w-8 h-8 opacity-30" />
            <p className="text-sm">Sin notificaciones nuevas</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              className={`flex gap-3 px-4 py-3 border-b last:border-b-0 border-[#F0F0EF] ${
                notif.read ? 'opacity-60' : ''
              }`}
            >
              <div
                className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                  TYPE_BG[notif.type] ?? 'bg-gray-50 border-gray-200'
                }`}
              >
                {ICON_MAP[notif.icon] ?? <Bell className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#37352F] leading-snug">{notif.title}</p>
                <p className="text-xs text-[#9B9A97] mt-0.5 leading-snug">{notif.message}</p>
              </div>
              {!notif.read && (
                <div className="mt-1.5 w-2 h-2 rounded-full bg-[#7C5CBF] flex-shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
