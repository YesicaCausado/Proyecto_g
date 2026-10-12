/**
 * Notificaciones persistentes del usuario (parche 11B).
 *
 * Un solo proveedor para toda la app: consulta el contador real de no leídas
 * (GET /notifications/unread-count) cada minuto y al volver a la pestaña, y
 * carga la lista al abrir el panel. Marcar como leída se guarda en el
 * servidor, así que el estado se mantiene después de recargar (F5).
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: number;
  type: string;
  icon: string;
  title: string;
  message: string;
  link: string | null;
  resource_type: string | null;
  resource_id: number | null;
  read: boolean;
  read_at: string | null;
  created_at: string | null;
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: number) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
}

const PAGE_SIZE = 30;
const POLL_MS = 60_000;

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const enabled = !!user && !user.must_change_password;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadedOnce = useRef(false);

  const refreshCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get<{ unread_count: number }>('/notifications/unread-count', {
        params: { _t: Date.now() }, // evita la caché GET de 15 s del cliente
      });
      setUnreadCount(res.data.unread_count ?? 0);
    } catch {
      /* el contador se reintenta en el siguiente ciclo; la lista muestra el error */
    }
  }, [enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/notifications', { params: { limit: PAGE_SIZE, offset: 0, _t: Date.now() } });
      setNotifications(res.data.notifications ?? []);
      setUnreadCount(res.data.unread_count ?? 0);
      setHasMore(!!res.data.has_more);
      loadedOnce.current = true;
    } catch {
      setError('No fue posible cargar tus notificaciones.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications', {
        params: { limit: PAGE_SIZE, offset: notifications.length, _t: Date.now() },
      });
      setNotifications(prev => [...prev, ...(res.data.notifications ?? [])]);
      setHasMore(!!res.data.has_more);
    } catch {
      setError('No fue posible cargar más notificaciones.');
    } finally {
      setLoading(false);
    }
  }, [enabled, loading, notifications.length]);

  const markRead = useCallback(async (id: number) => {
    try {
      const res = await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount(res.data.unread_count ?? 0);
      return true;
    } catch {
      setError('No fue posible marcar la notificación como leída.');
      return false;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      return true;
    } catch {
      setError('No fue posible marcar las notificaciones como leídas.');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setUnreadCount(0);
      loadedOnce.current = false;
      return;
    }
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    const onFocus = () => { refreshCount(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refreshCount, user?.id]);

  const value = useMemo<NotificationsState>(() => ({
    notifications, unreadCount, loading, error, hasMore, refresh, loadMore, markRead, markAllRead,
  }), [notifications, unreadCount, loading, error, hasMore, refresh, loadMore, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>.');
  return ctx;
}
