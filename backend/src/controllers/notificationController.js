import { supabase } from '../config/supabase.js';

// GET /api/notifications — fetch latest 30 for the current user 
export const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const unread_count = (data || []).filter((n) => !n.is_read).length;
    res.json({ notifications: data || [], unread_count });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// PATCH/api/notifications/:id/read — mark one as read 
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id); // ensure ownership

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('markAsRead error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// PATCH/api/notifications/read-all — mark all as read 
export const markAllAsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// DELETE /api/notifications/:id — delete one notification 
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('deleteNotification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// DELETE /api/notifications — clear all 
export const clearAll = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('clearAll error:', err);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
};
