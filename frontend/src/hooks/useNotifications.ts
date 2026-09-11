import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface AppNotification {
  id: string;
  type: 'warning' | 'achievement' | 'success' | 'info' | 'tip';
  title: string;
  message: string;
  icon: string;
  read: boolean;
  created_at: string;
}

export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/notifications');
      const list: AppNotification[] = res.data?.notifications ?? [];
      setNotifications(list);
      setUnreadCount(res.data?.unread_count ?? list.filter((n) => !n.read).length);
    } catch (err) {
      // No bloquear la UI, pero registrar para poder diagnosticar.
      setError(err instanceof Error ? err.message : String(err));
      console.warn('[notifications] No se pudieron cargar:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, loading, error, fetchNotifications, markAllRead };
}
