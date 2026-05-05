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

function applyDarkTheme() {
  const r = document.documentElement;
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
  r.style.setProperty('--sidebar-bg',          '#07070f');
  r.style.setProperty('--sidebar-border',      'rgba(255,255,255,0.07)');
  r.style.setProperty('--sidebar-text',        'rgba(255,255,255,0.45)');
  r.style.setProperty('--sidebar-text-hover',  '#ffffff');
  r.style.setProperty('--sidebar-hover-bg',    'rgba(255,255,255,0.05)');
  r.style.setProperty('--sidebar-divider',     'rgba(255,255,255,0.08)');
  r.style.setProperty('--sidebar-user-bg',     'rgba(255,255,255,0.05)');
  r.style.setProperty('--sidebar-user-border', 'rgba(255,255,255,0.08)');
  r.style.setProperty('--sidebar-name',        '#ffffff');
  r.style.setProperty('--sidebar-role',        'rgba(255,255,255,0.35)');
  r.style.setProperty('--topbar-bg',     '#07070f');
  r.style.setProperty('--topbar-border', 'rgba(255,255,255,0.07)');
  r.style.setProperty('--topbar-title',  '#ffffff');
  r.style.setProperty('--drop-bg',         '#13132a');
  r.style.setProperty('--drop-border',     'rgba(255,255,255,0.12)');
  r.style.setProperty('--drop-divider',    'rgba(255,255,255,0.07)');
  r.style.setProperty('--drop-name',       '#ffffff');
  r.style.setProperty('--drop-role',       'rgba(255,255,255,0.35)');
  r.style.setProperty('--drop-item',       'rgba(255,255,255,0.55)');
  r.style.setProperty('--drop-item-hover', '#ffffff');
  r.style.setProperty('--drop-hover-bg',   'rgba(255,255,255,0.05)');
  r.style.setProperty('--card-bg',     '#07070f');
  r.style.setProperty('--card-border', 'rgba(255,255,255,0.07)');
  r.style.setProperty('--input-bg',     '#13132a');
  r.style.setProperty('--input-border', 'rgba(255,255,255,0.12)');
  r.style.setProperty('--input-text',   '#ffffff');
  r.style.setProperty('--settings-card-bg',     '#07070f');
  r.style.setProperty('--settings-card-border', 'rgba(255,255,255,0.07)');
  r.style.setProperty('--settings-title',       '#ffffff');
  r.style.setProperty('--settings-desc',        'rgba(255,255,255,0.38)');
  r.style.setProperty('--settings-divider',     'rgba(255,255,255,0.06)');
  r.style.setProperty('--theme-btn-bg',     'rgba(255,255,255,0.03)');
  r.style.setProperty('--theme-btn-border', 'rgba(255,255,255,0.08)');
  r.style.setProperty('--theme-btn-text',   'rgba(255,255,255,0.7)');
  r.style.setProperty('--theme-btn-desc',   'rgba(255,255,255,0.35)');
  r.style.setProperty('--strength-empty',   'rgba(255,255,255,0.08)');
  r.style.setProperty('--danger-card-bg',   'rgba(239,68,68,0.04)');
  r.style.setProperty('--danger-inner-bg',  'rgba(239,68,68,0.05)');
  r.style.setProperty('--danger-text',      '#ffffff');
  r.style.setProperty('--danger-desc',      'rgba(255,255,255,0.4)');
  r.style.setProperty('--modal-bg',            '#0d0d1c');
  r.style.setProperty('--modal-body-text',     'rgba(255,255,255,0.65)');
  r.style.setProperty('--modal-confirm-text',  '#ffffff');
  r.style.setProperty('--eye-btn',       'rgba(255,255,255,0.30)');
  r.style.setProperty('--eye-btn-hover', 'rgba(255,255,255,0.60)');
  document.body.style.background = 'var(--ink2)';
  document.body.style.color      = 'var(--text-body)';
}

export function ThemeProvider({ children }) {
  const [accent, setAccentState] = useState(() => localStorage.getItem('tb_accent') || 'gold');

  // Clear any stale light/system preference so dark is always used
  localStorage.setItem('tb_theme', 'dark');

  const setAccent = (a) => {
    setAccentState(a);
    localStorage.setItem('tb_accent', a);
    applyAccent(a);
  };

  useEffect(() => {
    applyDarkTheme();
    applyAccent(accent);
  }, []); 

  return (
    <ThemeContext.Provider value={{ theme: 'dark', accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};