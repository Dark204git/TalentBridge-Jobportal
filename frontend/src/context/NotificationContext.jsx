import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30_000;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id;                        // stable primitive — avoids re-running effect on every render
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await notificationsAPI.getAll();
      setNotifications(data.notifications  ?? []);
      setUnreadCount(data.unread_count     ?? 0);
    } catch {
      // silently fail
    }
  }, [userId]);                                   // only re-create when the actual user id changes

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      clearInterval(intervalRef.current);
      return;
    }

    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

    return () => clearInterval(intervalRef.current);
  }, [userId, fetchNotifications]);

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    notificationsAPI.markRead(id).catch(console.error);
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    notificationsAPI.markAllRead().catch(console.error);
  };

  const remove = async (id) => {
    const notif = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (notif && !notif.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    notificationsAPI.delete(id).catch(console.error);
  };

  const clearAll = async () => {
    setNotifications([]);
    setUnreadCount(0);
    notificationsAPI.clearAll().catch(console.error);
  };

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, loading,
      markRead, markAllRead, remove, clearAll, refresh: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};