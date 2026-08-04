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

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications ?? []);
      setUnreadCount(res.data.unread_count ?? 0);
    } catch {
      // Silently fail — notificaciones no son críticas
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

  return { notifications, unreadCount, loading, fetchNotifications, markAllRead };
}
