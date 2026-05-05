import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService.js';

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Validates: local@domain.tld — requires real domain with dot + 2–63 char TLD
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,63}$/;

export const register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address (e.g. you@example.com)' });
    }

    if (!['employer', 'candidate'].includes(role)) {
      return res.status(400).json({ error: 'Role must be employer or candidate' });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        full_name,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id, email, full_name, role')
      .single();

    if (error) throw error;

    // Create role-specific profile
    if (role === 'employer') {
      await supabase.from('employer_profiles').insert({ user_id: userId });
    } else {
      await supabase.from('candidate_profiles').insert({ user_id: userId });
    }

    await sendWelcomeEmail(email, full_name, role).catch(console.error);

    const token = generateToken(userId);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, full_name, role, is_active')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getMe = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, role, created_at,
        employer_profiles(*),
        candidate_profiles(*)
      `)
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    // Always return success to prevent email enumeration attacks
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Delete any existing reset token for this user
    await supabase.from('password_reset_tokens').delete().eq('user_id', user.id);

    // Save hashed token to DB
    const { error: insertError } = await supabase.from('password_reset_tokens').insert({
      id: uuidv4(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;

    await sendPasswordResetEmail(user.email, user.full_name, resetToken).catch(console.error);

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: resetRecord, error } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !resetRecord) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (new Date(resetRecord.expires_at) < new Date()) {
      await supabase.from('password_reset_tokens').delete().eq('token_hash', tokenHash);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);

    await supabase.from('users')
      .update({ password_hash: hashedPassword, updated_at: new Date().toISOString() })
      .eq('id', resetRecord.user_id);

    // Delete used token
    await supabase.from('password_reset_tokens').delete().eq('token_hash', tokenHash);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password_hash: hashed }).eq('id', req.user.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    // Delete role-specific data first, then the user row.
    // All related tables use user_id / candidate_id / employer_id as FK,
    // so we clean them up manually (Supabase anon key doesn't cascade deletes).
    if (role === 'candidate') {
      await Promise.all([
        supabase.from('applications')       .delete().eq('candidate_id', userId),
        supabase.from('saved_jobs')         .delete().eq('user_id',      userId),
        supabase.from('candidate_profiles') .delete().eq('user_id',      userId),
        supabase.from('notifications')      .delete().eq('user_id',      userId),
      ]);
    } else if (role === 'employer') {
      // Remove applications for this employer's jobs before deleting the jobs
      const { data: jobs } = await supabase
        .from('jobs').select('id').eq('employer_id', userId);

      if (jobs?.length) {
        const jobIds = jobs.map(j => j.id);
        await supabase.from('applications').delete().in('job_id', jobIds);
        await supabase.from('jobs')        .delete().in('id',     jobIds);
      }

      await Promise.all([
        supabase.from('employer_profiles').delete().eq('user_id', userId),
        supabase.from('notifications')    .delete().eq('user_id', userId),
      ]);
    }

    // Delete from your users table
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;

    // Also delete from Supabase Auth so the email can be re-registered.
    // Without this, auth.users still holds the email and blocks future signups.
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      // Non-fatal: log it but don't fail the request —
      // the user row is already gone so they can't log in regardless.
      console.warn('Could not delete from Supabase Auth (may not use Supabase Auth):', authError.message);
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};