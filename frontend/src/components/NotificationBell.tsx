/**
 * Botón 🔔 con el contador real de no leídas y el panel de notificaciones.
 *
 * `variant="icon"`: botón cuadrado para barras superiores.
 * `variant="sidebar"`: fila «🔔 Notificaciones» para los menús laterales de los
 * paneles (Súper Profesor, Profesor, Administrador).
 */
import { useCallback, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext';
import { NotificationsPanel } from './NotificationsPanel';

interface NotificationBellProps {
  variant?: 'icon' | 'sidebar';
  /** Dónde se abre el panel; por defecto, junto al menú lateral en `sidebar`. */
  panel?: 'dropdown' | 'sidebar';
  className?: string;
}

export default function NotificationBell({ variant = 'icon', panel, className = '' }: NotificationBellProps) {
  const placement = panel ?? (variant === 'sidebar' ? 'sidebar' : 'dropdown');
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const label = unreadCount > 0 ? `Notificaciones: ${unreadCount} sin leer` : 'Notificaciones';

  if (variant === 'sidebar') {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-label={label}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[13px] text-[#787774] hover:bg-[#EBEBEA] hover:text-[#37352F] rounded-md transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="flex-1 text-left">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-[#E03E3E] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {badge}
            </span>
          )}
        </button>
        {open && <NotificationsPanel onClose={close} placement={placement} />}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        className="relative w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center text-[#787774] hover:bg-[#F1F1EF] transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#E03E3E] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>
      {open && <NotificationsPanel onClose={close} placement={placement} />}
    </div>
  );
}
