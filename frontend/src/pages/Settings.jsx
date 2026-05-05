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

// ─── Password Field (defined outside to prevent remount on each keystroke) ────
function PasswordField({ label, field, placeholder, value, show, onToggle, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input pr-10"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── Password Section ────────────────────────────────────────────────────────
function PasswordSection() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggle = (k) => setShow(p => ({ ...p, [k]: !p[k] }));

  const strengthScore = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };

  const score = strengthScore(form.new_password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'][score];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (form.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await authAPI.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess(true);
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password updated successfully!');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to update password';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="settings-icon-wrap" style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)' }}>
          <KeyRound size={16} style={{ color: 'var(--gold)' }} />
        </div>
        <div>
          <h2 className="settings-card-title">Reset Password</h2>
          <p className="settings-card-desc">Use your current password to set a new one</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mt-5">
        <PasswordField label="Current Password" field="current" placeholder="Enter your current password"
          value={form.current_password} show={show.current}
          onToggle={() => toggle('current')} onChange={v => set('current_password', v)} />

        <div className="settings-divider" />

        <PasswordField label="New Password" field="new" placeholder="At least 8 characters"
          value={form.new_password} show={show.new}
          onToggle={() => toggle('new')} onChange={v => set('new_password', v)} />

        {/* Strength meter */}
        {form.new_password && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ background: i <= score ? strengthColor : 'rgba(255,255,255,0.08)' }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
          </div>
        )}

        <PasswordField label="Confirm New Password" field="confirm" placeholder="Repeat your new password"
          value={form.confirm_password} show={show.confirm}
          onToggle={() => toggle('confirm')} onChange={v => set('confirm_password', v)} />

        {form.confirm_password && form.new_password !== form.confirm_password && (
          <p className="text-xs text-red-400">Passwords do not match</p>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving || !form.current_password || !form.new_password || !form.confirm_password}
            className="btn-primary flex items-center gap-2 disabled:opacity-40"
          >
            {saving ? (
              <><Loader size={14} className="animate-spin" /> Updating…</>
            ) : success ? (
              <><CheckCircle size={14} /> Updated!</>
            ) : (
              <><Lock size={14} /> Update Password</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Theme Section ───────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'dark',
    label: 'Dark',
    desc: 'Easy on the eyes',
    icon: Moon,
    preview: ['#07070f', '#d4a843', '#13132a'],
  },
  {
    id: 'light',
    label: 'Light',
    desc: 'Clean & bright',
    icon: Sun,
    preview: ['#f8f9fa', '#d4a843', '#ffffff'],
  },
  {
    id: 'system',
    label: 'System',
    desc: 'Follows OS setting',
    icon: Monitor,
    preview: ['#1a1a2e', '#d4a843', '#07070f'],
  },
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

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="settings-icon-wrap" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Palette size={16} style={{ color: '#818cf8' }} />
        </div>
        <div>
          <h2 className="settings-card-title">Application Theme</h2>
          <p className="settings-card-desc">Customize the look and feel of the app</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="mt-5 space-y-3">
        <label className="label">Color Mode</label>
        <div className="grid grid-cols-3 gap-2.5">
          {THEMES.map(({ id, label, desc, icon: Icon, preview }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className="theme-option"
              style={{
                background: theme === id ? 'rgba(212,168,67,0.08)' : 'rgba(255,255,255,0.03)',
                border: theme === id ? '1.5px solid rgba(212,168,67,0.5)' : '1.5px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
                padding: '12px 10px',
                transition: 'all 0.15s',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {/* Mini preview */}
              <div className="flex gap-1 items-end">
                {preview.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === 0 ? 22 : 10,
                      height: i === 0 ? 16 : i === 1 ? 10 : 14,
                      background: c,
                      borderRadius: 3,
                    }}
                  />
                ))}
              </div>
              <Icon size={14} style={{ color: theme === id ? 'var(--gold)' : 'rgba(255,255,255,0.4)' }} />
              <div>
                <p style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: theme === id ? 'var(--gold)' : 'rgba(255,255,255,0.7)',
                  marginBottom: 2,
                }}>{label}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div className="mt-5 space-y-3">
        <label className="label">Accent Color</label>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_COLORS.map(({ id, label, hex }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAccent(id)}
              title={label}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: hex,
                border: accent === id ? `3px solid white` : '3px solid transparent',
                outline: accent === id ? `2px solid ${hex}` : '2px solid transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {accent === id && (
                <CheckCircle
                  size={12}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: id === 'gold' ? '#07070f' : 'white',
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Currently: <span style={{ color: ACCENT_COLORS.find(c => c.id === accent)?.hex }}>
            {ACCENT_COLORS.find(c => c.id === accent)?.label}
          </span>
        </p>
      </div>
    </div>
  );
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────
function DangerSection({ isEmployer }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await authAPI.deleteAccount();
      logout();
      navigate('/');
      toast.success('Your account has been deleted.');
    } catch {
      toast.error('Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  const isConfirmed = confirmText === 'DELETE';

  return (
    <>
      <div
        className="settings-card"
        style={{
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.03)',
        }}
      >
        <div className="settings-card-header">
          <div className="settings-icon-wrap" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <Shield size={16} style={{ color: '#f87171' }} />
          </div>
          <div>
            <h2 className="settings-card-title" style={{ color: '#fca5a5' }}>Danger Zone</h2>
            <p className="settings-card-desc">Irreversible and destructive actions</p>
          </div>
        </div>

        <div
          className="mt-5 p-4 rounded-xl flex items-start justify-between gap-4"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <div>
            <p className="text-sm font-semibold text-white">Delete Account</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {isEmployer
                ? 'Permanently removes your account, all job postings, and candidate applications.'
                : 'Permanently removes your account, profile, applications, and saved jobs.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium"
            style={{
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171',
              background: 'transparent',
              transition: 'all 0.15s',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: '#0d0d1c', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)' }}
              >
                <AlertTriangle size={20} style={{ color: '#f87171' }} />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Delete Account</h3>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              This will permanently delete your {isEmployer ? 'employer account, all job postings, and applications' : 'candidate profile, all applications, and saved jobs'}.{' '}
              <span style={{ color: '#f87171', fontWeight: 600 }}>This cannot be undone.</span>
            </p>

            <div>
              <label className="label mb-1.5">
                Type <span className="font-mono font-bold text-white">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="input font-mono"
                style={{ borderColor: confirmText && !isConfirmed ? 'rgba(239,68,68,0.5)' : undefined }}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowModal(false); setConfirmText(''); }}
                disabled={deleting}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !isConfirmed}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: isConfirmed ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#f87171',
                  cursor: isConfirmed ? 'pointer' : 'not-allowed',
                }}
              >
                {deleting
                  ? <><Loader size={14} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={14} /> Delete Account</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { isEmployer } = useAuth();

  return (
    <DashboardLayout title="Settings">
      <style>{`
        .settings-card {
          background: #07070f;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 22px;
          transition: all 0.2s;
        }
        .settings-card-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .settings-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .settings-card-title {
          font-size: 15px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .settings-card-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.38);
          margin: 2px 0 0;
        }
        .settings-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 4px 0;
        }
      `}</style>

      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Manage your account security, appearance, and preferences
          </p>
        </div>

        <div className="space-y-5">
          <PasswordSection />
          <ThemeSection />
          <DangerSection isEmployer={isEmployer} />
        </div>
      </div>
    </DashboardLayout>
  );
}