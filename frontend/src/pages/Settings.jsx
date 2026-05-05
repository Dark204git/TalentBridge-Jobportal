import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, Eye, EyeOff, Sun, Moon, Monitor,
  Trash2, AlertTriangle, Loader, CheckCircle,
  Shield, Palette, KeyRound
} from 'lucide-react';
import DashboardLayout from '../components/common/DashboardLayout';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

/* ─── Shared inline styles via CSS vars ─────────────────────────────────── */
const card = {
  background: 'var(--settings-card-bg)',
  border: '1px solid var(--settings-card-border)',
  borderRadius: 16,
  padding: 22,
  transition: 'background 0.25s, border-color 0.25s',
};

/* ─── Password Section ──────────────────────────────────────────────────── */
function PasswordField({ label, fieldKey, value, show, onToggle, onChange, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate2)', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: '100%', borderRadius: 10, padding: '10px 44px 10px 16px',
            fontSize: 14, fontWeight: 500, outline: 'none', transition: 'all 0.15s',
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            color: 'var(--input-text)',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--gold-border)'; e.target.style.boxShadow = '0 0 0 2px var(--gold4)'; }}
          onBlur={e =>  { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
        />
        <button type="button" onClick={onToggle}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--eye-btn)', transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--eye-btn-hover)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--eye-btn)'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggle = k => setShow(p => ({ ...p, [k]: !p[k] }));

  const score = (() => {
    const p = form.new_password;
    return [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'][score];

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) { toast.error('Passwords do not match'); return; }
    if (form.new_password.length < 8) { toast.error('Minimum 8 characters'); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      setSuccess(true);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password updated!');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update password');
    } finally { setSaving(false); }
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--gold3)', border: '1px solid var(--gold-border)' }}>
          <KeyRound size={16} style={{ color: 'var(--gold)' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--settings-title)', margin: 0, letterSpacing: '-0.02em' }}>Reset Password</h2>
          <p style={{ fontSize: 12, color: 'var(--settings-desc)', margin: '2px 0 0' }}>Use your current password to set a new one</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PasswordField label="Current Password" value={form.current_password} show={show.current}
          onToggle={() => toggle('current')} onChange={v => set('current_password', v)}
          placeholder="Enter current password" />

        <div style={{ height: 1, background: 'var(--settings-divider)' }} />

        <PasswordField label="New Password" value={form.new_password} show={show.new}
          onToggle={() => toggle('new')} onChange={v => set('new_password', v)}
          placeholder="At least 8 characters" />

        {form.new_password && (
          <div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, transition: 'background 0.3s',
                  background: i <= score ? strengthColor : 'var(--strength-empty)' }} />
              ))}
            </div>
            <p style={{ fontSize: 11, color: strengthColor, marginTop: 4 }}>{strengthLabel}</p>
          </div>
        )}

        <PasswordField label="Confirm New Password" value={form.confirm_password} show={show.confirm}
          onToggle={() => toggle('confirm')} onChange={v => set('confirm_password', v)}
          placeholder="Repeat new password" />

        {form.confirm_password && form.new_password !== form.confirm_password && (
          <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>Passwords do not match</p>
        )}

        <div style={{ paddingTop: 4 }}>
          <button type="submit"
            disabled={saving || !form.current_password || !form.new_password || !form.confirm_password}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {saving ? <><Loader size={14} className="animate-spin" /> Updating…</>
              : success ? <><CheckCircle size={14} /> Updated!</>
              : <><Lock size={14} /> Update Password</>}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Theme Section ─────────────────────────────────────────────────────── */
const THEMES = [
  { id: 'dark',   label: 'Dark',   desc: 'Easy on eyes',  icon: Moon,
    swatch: [['#07070f',24,18],['#1a1a35',11,13],['#d4a843',11,8]] },
  { id: 'light',  label: 'Light',  desc: 'Clean & bright', icon: Sun,
    swatch: [['#f1f3f8',24,18],['#ffffff',11,13],['#d4a843',11,8]] },
  { id: 'system', label: 'System', desc: 'Follows OS',     icon: Monitor,
    swatch: [['#0d0d1c',24,18],['#13132a',11,13],['#d4a843',11,8]] },
];

const ACCENT_COLORS = [
  { id: 'gold',   label: 'Gold',    hex: '#d4a843' },
  { id: 'blue',   label: 'Indigo',  hex: '#6366f1' },
  { id: 'green',  label: 'Emerald', hex: '#10b981' },
  { id: 'rose',   label: 'Rose',    hex: '#f43f5e' },
  { id: 'violet', label: 'Violet',  hex: '#8b5cf6' },
  { id: 'cyan',   label: 'Cyan',    hex: '#06b6d4' },
];

function ThemeSection() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const currentAccent = ACCENT_COLORS.find(c => c.id === accent);

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <Palette size={16} style={{ color: '#818cf8' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--settings-title)', margin: 0, letterSpacing: '-0.02em' }}>Application Theme</h2>
          <p style={{ fontSize: 12, color: 'var(--settings-desc)', margin: '2px 0 0' }}>Customize the look and feel of the app</p>
        </div>
      </div>

      {/* Mode picker */}
      <div style={{ marginTop: 20 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate2)', marginBottom: 10 }}>
          Color Mode
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {THEMES.map(({ id, label, desc, icon: Icon, swatch }) => {
            const active = theme === id;
            return (
              <button key={id} type="button" onClick={() => setTheme(id)}
                style={{
                  background: active ? 'var(--gold3)' : 'var(--theme-btn-bg)',
                  border: `1.5px solid ${active ? 'var(--gold-border)' : 'var(--theme-btn-border)'}`,
                  borderRadius: 12, padding: '12px 8px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s',
                }}>
                {/* Swatch preview */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                  {swatch.map(([color, w, h], i) => (
                    <div key={i} style={{ width: w, height: h, background: color, borderRadius: 3 }} />
                  ))}
                </div>
                <Icon size={14} style={{ color: active ? 'var(--gold)' : 'var(--slate2)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 2px', color: active ? 'var(--gold)' : 'var(--theme-btn-text)' }}>{label}</p>
                  <p style={{ fontSize: 10, margin: 0, color: 'var(--theme-btn-desc)' }}>{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent color */}
      <div style={{ marginTop: 20 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--slate2)', marginBottom: 10 }}>
          Accent Color
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ACCENT_COLORS.map(({ id, label, hex }) => (
            <button key={id} type="button" onClick={() => setAccent(id)} title={label}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: hex,
                border: accent === id ? '3px solid white' : '3px solid transparent',
                outline: accent === id ? `2px solid ${hex}` : '2px solid transparent',
                transition: 'all 0.15s', cursor: 'pointer', position: 'relative', flexShrink: 0,
              }}>
              {accent === id && (
                <CheckCircle size={12} style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  color: id === 'gold' ? '#07070f' : '#ffffff',
                }} />
              )}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--settings-desc)', marginTop: 8 }}>
          Active: <span style={{ color: currentAccent?.hex, fontWeight: 600 }}>{currentAccent?.label}</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Danger Zone ───────────────────────────────────────────────────────── */
function DangerSection({ isEmployer }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === 'DELETE';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await authAPI.deleteAccount();
      logout(); navigate('/');
      toast.success('Account deleted.');
    } catch {
      toast.error('Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <>
      <div style={{ ...card, background: 'var(--danger-card-bg)', border: '1px solid rgba(239,68,68,0.22)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)' }}>
            <Shield size={16} style={{ color: '#f87171' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f87171', margin: 0, letterSpacing: '-0.02em' }}>Danger Zone</h2>
            <p style={{ fontSize: 12, color: 'var(--settings-desc)', margin: '2px 0 0' }}>Irreversible and destructive actions</p>
          </div>
        </div>

        {/* Delete row */}
        <div style={{ marginTop: 20, padding: 16, borderRadius: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, background: 'var(--danger-inner-bg)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger-text)', margin: 0 }}>Delete Account</p>
            <p style={{ fontSize: 12, color: 'var(--danger-desc)', margin: '4px 0 0', lineHeight: 1.5 }}>
              {isEmployer
                ? 'Permanently removes your account, job postings, and applications.'
                : 'Permanently removes your account, profile, and applications.'}
            </p>
          </div>
          <button type="button" onClick={() => setShowModal(true)}
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid rgba(239,68,68,0.45)', color: '#f87171', background: 'transparent', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.10)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, background: 'var(--modal-bg)', border: '1px solid rgba(239,68,68,0.30)', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
            {/* Icon + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle size={20} style={{ color: '#f87171' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--modal-confirm-text)', margin: 0 }}>Delete Account</h3>
                <p style={{ fontSize: 12, color: 'var(--settings-desc)', margin: '2px 0 0' }}>This action cannot be undone</p>
              </div>
            </div>

            {/* Body */}
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--modal-body-text)', marginBottom: 18 }}>
              This will permanently delete your {isEmployer ? 'employer account, all job postings, and applications' : 'candidate profile, all applications, and saved jobs'}.{' '}
              <span style={{ color: '#f87171', fontWeight: 600 }}>This cannot be undone.</span>
            </p>

            {/* Confirm input */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--settings-desc)', marginBottom: 8 }}>
                Type <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--modal-confirm-text)' }}>DELETE</span> to confirm
              </label>
              <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: '100%', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'monospace',
                  outline: 'none', boxSizing: 'border-box',
                  background: 'var(--input-bg)', color: 'var(--input-text)',
                  border: `1px solid ${confirmText && !isConfirmed ? 'rgba(239,68,68,0.6)' : 'var(--input-border)'}`,
                }} />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowModal(false); setConfirmText(''); }}
                disabled={deleting}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: 'var(--theme-btn-bg)', border: '1px solid var(--settings-card-border)', color: 'var(--settings-title)', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--line2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--theme-btn-bg)'}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting || !isConfirmed}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: isConfirmed && !deleting ? 'pointer' : 'not-allowed',
                  opacity: (!isConfirmed || deleting) ? 0.45 : 1,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)',
                  color: '#f87171', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (isConfirmed && !deleting) e.currentTarget.style.background = 'rgba(239,68,68,0.20)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}>
                {deleting ? <><Loader size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete Account</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { isEmployer } = useAuth();
  return (
    <DashboardLayout title="Settings">
      <div style={{ maxWidth: 640, margin: '0 auto' }} className="animate-fade-in">
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: 'var(--text)' }}>Settings</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Manage your account security, appearance, and preferences
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PasswordSection />
          <ThemeSection />
          <DangerSection isEmployer={isEmployer} />
        </div>
      </div>
    </DashboardLayout>
  );
}