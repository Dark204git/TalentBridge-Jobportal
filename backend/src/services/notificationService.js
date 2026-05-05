import { supabase } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a notification for a user.
 * Safe to call fire-and-forget (.catch(console.error)) — never throws.
 */
export const createNotification = async ({ user_id, type, title, message, link = null }) => {
  const { error } = await supabase.from('notifications').insert({
    id: uuidv4(),
    user_id,
    type,
    title,
    message,
    link,
    is_read: false,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('createNotification error:', error);
};

// ─── Convenience helpers ───────────────────────────────────────────────────

export const notifyApplicationReceived = (employerId, candidateName, jobTitle) =>
  createNotification({
    user_id: employerId,
    type: 'application_received',
    title: 'New Application Received',
    message: `${candidateName} applied for your job: ${jobTitle}`,
    link: '/employer/applications',
  });

export const notifyApplicationStatusChanged = (candidateId, jobTitle, status) =>
  createNotification({
    user_id: candidateId,
    type: 'application_status_changed',
    title: 'Application Status Updated',
    message: `Your application for "${jobTitle}" has been updated to: ${status}`,
    link: '/candidate/applications',
  });

export const notifyJobMatch = (candidateId, jobTitle, companyName, matchScore) =>
  createNotification({
    user_id: candidateId,
    type: 'job_match',
    title: 'New Job Match!',
    message: matchScore != null
      ? `${matchScore}% match: "${jobTitle}" at ${companyName}`
      : `A new job matches your profile: "${jobTitle}" at ${companyName}`,
    link: '/jobs',
  });

export const notifySystem = (userId, title, message, link = null) =>
  createNotification({ user_id: userId, type: 'system', title, message, link });