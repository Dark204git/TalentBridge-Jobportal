import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const ACCENT_MAP = {
  gold:   { hex: '#d4a843', hover: '#e8c06a', a14: 'rgba(212,168,67,0.14)', a07: 'rgba(212,168,67,0.07)', a28: 'rgba(212,168,67,0.28)' },
  blue:   { hex: '#6366f1', hover: '#818cf8', a14: 'rgba(99,102,241,0.14)',  a07: 'rgba(99,102,241,0.07)',  a28: 'rgba(99,102,241,0.28)'  },
  green:  { hex: '#10b981', hover: '#34d399', a14: 'rgba(16,185,129,0.14)', a07: 'rgba(16,185,129,0.07)', a28: 'rgba(16,185,129,0.28)' },
  rose:   { hex: '#f43f5e', hover: '#fb7185', a14: 'rgba(244,63,94,0.14)',  a07: 'rgba(244,63,94,0.07)',  a28: 'rgba(244,63,94,0.28)'  },
  violet: { hex: '#8b5cf6', hover: '#a78bfa', a14: 'rgba(139,92,246,0.14)', a07: 'rgba(139,92,246,0.07)', a28: 'rgba(139,92,246,0.28)' },
  cyan:   { hex: '#06b6d4', hover: '#22d3ee', a14: 'rgba(6,182,212,0.14)',  a07: 'rgba(6,182,212,0.07)',  a28: 'rgba(6,182,212,0.28)'  },
};

function applyAccent(id) {
  const c = ACCENT_MAP[id] || ACCENT_MAP.gold;
  const r = document.documentElement;
  r.style.setProperty('--gold',        c.hex);
  r.style.setProperty('--gold2',       c.hover);
  r.style.setProperty('--gold3',       c.a14);
  r.style.setProperty('--gold4',       c.a07);
  r.style.setProperty('--gold-border', c.a28);
}

function applyTheme(themeId) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = themeId === 'dark' || (themeId === 'system' && prefersDark);
  const r = document.documentElement;

  if (isDark) {
    r.setAttribute('data-theme', 'dark');
    r.style.setProperty('--ink',         '#07070f');
    r.style.setProperty('--ink2',        '#0d0d1c');
    r.style.setProperty('--ink3',        '#13132a');
    r.style.setProperty('--ink4',        '#1a1a35');
    r.style.setProperty('--ink5',        '#242452');
    r.style.setProperty('--line',        'rgba(255,255,255,0.07)');
    r.style.setProperty('--line2',       'rgba(255,255,255,0.12)');
    r.style.setProperty('--slate',       'rgba(255,255,255,0.55)');
    r.style.setProperty('--slate2',      'rgba(255,255,255,0.35)');
    r.style.setProperty('--slate3',      'rgba(255,255,255,0.18)');
    r.style.setProperty('--text',        '#ffffff');
    r.style.setProperty('--text-body',   'rgba(255,255,255,0.85)');
    r.style.setProperty('--text-muted',  'rgba(255,255,255,0.45)');
    r.style.setProperty('--placeholder', 'rgba(255,255,255,0.25)');
    // Sidebar (stays dark always)
    r.style.setProperty('--sidebar-bg',     '#07070f');
    r.style.setProperty('--sidebar-border', 'rgba(255,255,255,0.07)');
    r.style.setProperty('--sidebar-text',   'rgba(255,255,255,0.45)');
    r.style.setProperty('--sidebar-text-hover', '#ffffff');
    r.style.setProperty('--sidebar-hover-bg',   'rgba(255,255,255,0.05)');
    r.style.setProperty('--sidebar-divider',    'rgba(255,255,255,0.08)');
    r.style.setProperty('--sidebar-user-bg',    'rgba(255,255,255,0.05)');
    r.style.setProperty('--sidebar-user-border','rgba(255,255,255,0.08)');
    r.style.setProperty('--sidebar-name',   '#ffffff');
    r.style.setProperty('--sidebar-role',   'rgba(255,255,255,0.35)');
    // Topbar
    r.style.setProperty('--topbar-bg',      '#07070f');
    r.style.setProperty('--topbar-border',  'rgba(255,255,255,0.07)');
    r.style.setProperty('--topbar-title',   '#ffffff');
    // Dropdown
    r.style.setProperty('--drop-bg',        '#13132a');
    r.style.setProperty('--drop-border',    'rgba(255,255,255,0.12)');
    r.style.setProperty('--drop-divider',   'rgba(255,255,255,0.07)');
    r.style.setProperty('--drop-name',      '#ffffff');
    r.style.setProperty('--drop-role',      'rgba(255,255,255,0.35)');
    r.style.setProperty('--drop-item',      'rgba(255,255,255,0.55)');
    r.style.setProperty('--drop-item-hover','#ffffff');
    r.style.setProperty('--drop-hover-bg',  'rgba(255,255,255,0.05)');
    // Card
    r.style.setProperty('--card-bg',        '#07070f');
    r.style.setProperty('--card-border',    'rgba(255,255,255,0.07)');
    // Input
    r.style.setProperty('--input-bg',       '#13132a');
    r.style.setProperty('--input-border',   'rgba(255,255,255,0.12)');
    r.style.setProperty('--input-text',     '#ffffff');
    // Settings page specific
    r.style.setProperty('--settings-card-bg',      '#07070f');
    r.style.setProperty('--settings-card-border',  'rgba(255,255,255,0.07)');
    r.style.setProperty('--settings-title',        '#ffffff');
    r.style.setProperty('--settings-desc',         'rgba(255,255,255,0.38)');
    r.style.setProperty('--settings-divider',      'rgba(255,255,255,0.06)');
    r.style.setProperty('--theme-btn-bg',          'rgba(255,255,255,0.03)');
    r.style.setProperty('--theme-btn-border',      'rgba(255,255,255,0.08)');
    r.style.setProperty('--theme-btn-text',        'rgba(255,255,255,0.7)');
    r.style.setProperty('--theme-btn-desc',        'rgba(255,255,255,0.35)');
    r.style.setProperty('--strength-empty',        'rgba(255,255,255,0.08)');
    r.style.setProperty('--danger-card-bg',        'rgba(239,68,68,0.04)');
    r.style.setProperty('--danger-inner-bg',       'rgba(239,68,68,0.05)');
    r.style.setProperty('--danger-text',           '#ffffff');
    r.style.setProperty('--danger-desc',           'rgba(255,255,255,0.4)');
    r.style.setProperty('--modal-bg',              '#0d0d1c');
    r.style.setProperty('--modal-body-text',       'rgba(255,255,255,0.65)');
    r.style.setProperty('--modal-confirm-text',    '#ffffff');
    r.style.setProperty('--eye-btn',               'rgba(255,255,255,0.30)');
    r.style.setProperty('--eye-btn-hover',         'rgba(255,255,255,0.60)');
    document.body.style.background = 'var(--ink2)';
    document.body.style.color      = 'var(--text-body)';
  } else {
    r.setAttribute('data-theme', 'light');
    r.style.setProperty('--ink',         '#ffffff');
    r.style.setProperty('--ink2',        '#f1f3f8');
    r.style.setProperty('--ink3',        '#e5e9f2');
    r.style.setProperty('--ink4',        '#d8dcea');
    r.style.setProperty('--ink5',        '#c4cbde');
    r.style.setProperty('--line',        'rgba(0,0,0,0.07)');
    r.style.setProperty('--line2',       'rgba(0,0,0,0.13)');
    r.style.setProperty('--slate',       'rgba(15,15,35,0.55)');
    r.style.setProperty('--slate2',      'rgba(15,15,35,0.40)');
    r.style.setProperty('--slate3',      'rgba(15,15,35,0.12)');
    r.style.setProperty('--text',        '#0f0f23');
    r.style.setProperty('--text-body',   'rgba(15,15,35,0.88)');
    r.style.setProperty('--text-muted',  'rgba(15,15,35,0.50)');
    r.style.setProperty('--placeholder', 'rgba(15,15,35,0.30)');
    // Sidebar stays dark for contrast
    r.style.setProperty('--sidebar-bg',     '#1a1a35');
    r.style.setProperty('--sidebar-border', 'rgba(255,255,255,0.08)');
    r.style.setProperty('--sidebar-text',   'rgba(255,255,255,0.45)');
    r.style.setProperty('--sidebar-text-hover', '#ffffff');
    r.style.setProperty('--sidebar-hover-bg',   'rgba(255,255,255,0.07)');
    r.style.setProperty('--sidebar-divider',    'rgba(255,255,255,0.10)');
    r.style.setProperty('--sidebar-user-bg',    'rgba(255,255,255,0.06)');
    r.style.setProperty('--sidebar-user-border','rgba(255,255,255,0.10)');
    r.style.setProperty('--sidebar-name',   '#ffffff');
    r.style.setProperty('--sidebar-role',   'rgba(255,255,255,0.38)');
    // Topbar uses page surface color in light mode
    r.style.setProperty('--topbar-bg',      '#ffffff');
    r.style.setProperty('--topbar-border',  'rgba(0,0,0,0.08)');
    r.style.setProperty('--topbar-title',   '#0f0f23');
    // Dropdown
    r.style.setProperty('--drop-bg',        '#ffffff');
    r.style.setProperty('--drop-border',    'rgba(0,0,0,0.12)');
    r.style.setProperty('--drop-divider',   'rgba(0,0,0,0.07)');
    r.style.setProperty('--drop-name',      '#0f0f23');
    r.style.setProperty('--drop-role',      'rgba(15,15,35,0.42)');
    r.style.setProperty('--drop-item',      'rgba(15,15,35,0.55)');
    r.style.setProperty('--drop-item-hover','#0f0f23');
    r.style.setProperty('--drop-hover-bg',  'rgba(0,0,0,0.04)');
    // Card
    r.style.setProperty('--card-bg',        '#ffffff');
    r.style.setProperty('--card-border',    'rgba(0,0,0,0.08)');
    // Input
    r.style.setProperty('--input-bg',       '#ffffff');
    r.style.setProperty('--input-border',   'rgba(0,0,0,0.14)');
    r.style.setProperty('--input-text',     '#0f0f23');
    // Settings page specific
    r.style.setProperty('--settings-card-bg',     '#ffffff');
    r.style.setProperty('--settings-card-border', 'rgba(0,0,0,0.08)');
    r.style.setProperty('--settings-title',       '#0f0f23');
    r.style.setProperty('--settings-desc',        'rgba(15,15,35,0.45)');
    r.style.setProperty('--settings-divider',     'rgba(0,0,0,0.07)');
    r.style.setProperty('--theme-btn-bg',         'rgba(0,0,0,0.03)');
    r.style.setProperty('--theme-btn-border',     'rgba(0,0,0,0.10)');
    r.style.setProperty('--theme-btn-text',       'rgba(15,15,35,0.75)');
    r.style.setProperty('--theme-btn-desc',       'rgba(15,15,35,0.42)');
    r.style.setProperty('--strength-empty',       'rgba(0,0,0,0.10)');
    r.style.setProperty('--danger-card-bg',       'rgba(239,68,68,0.03)');
    r.style.setProperty('--danger-inner-bg',      'rgba(239,68,68,0.04)');
    r.style.setProperty('--danger-text',          '#0f0f23');
    r.style.setProperty('--danger-desc',          'rgba(15,15,35,0.48)');
    r.style.setProperty('--modal-bg',             '#ffffff');
    r.style.setProperty('--modal-body-text',      'rgba(15,15,35,0.65)');
    r.style.setProperty('--modal-confirm-text',   '#0f0f23');
    r.style.setProperty('--eye-btn',              'rgba(15,15,35,0.30)');
    r.style.setProperty('--eye-btn-hover',        'rgba(15,15,35,0.65)');
    document.body.style.background = 'var(--ink2)';
    document.body.style.color      = 'var(--text-body)';
  }
}

export function ThemeProvider({ children }) {
  const [theme,  setThemeState]  = useState(() => localStorage.getItem('tb_theme')  || 'dark');
  const [accent, setAccentState] = useState(() => localStorage.getItem('tb_accent') || 'gold');

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('tb_theme', t);
    applyTheme(t);
  };

  const setAccent = (a) => {
    setAccentState(a);
    localStorage.setItem('tb_accent', a);
    applyAccent(a);
  };

  useEffect(() => {
    applyTheme(theme);
    applyAccent(accent);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};