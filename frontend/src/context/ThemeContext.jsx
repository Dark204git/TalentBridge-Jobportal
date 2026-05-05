import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const ACCENT_MAP = {
  gold:   { primary: '#d4a843', hover: '#e8c06a', ring: 'rgba(212,168,67,0.4)' },
  blue:   { primary: '#6366f1', hover: '#818cf8', ring: 'rgba(99,102,241,0.4)' },
  green:  { primary: '#10b981', hover: '#34d399', ring: 'rgba(16,185,129,0.4)' },
  rose:   { primary: '#f43f5e', hover: '#fb7185', ring: 'rgba(244,63,94,0.4)' },
  violet: { primary: '#8b5cf6', hover: '#a78bfa', ring: 'rgba(139,92,246,0.4)' },
  cyan:   { primary: '#06b6d4', hover: '#22d3ee', ring: 'rgba(6,182,212,0.4)' },
};

function applyAccent(accentId) {
  const colors = ACCENT_MAP[accentId] || ACCENT_MAP.gold;
  const root = document.documentElement;
  root.style.setProperty('--gold',        colors.primary);
  root.style.setProperty('--gold2',       colors.hover);
  root.style.setProperty('--gold3',       colors.ring.replace('0.4', '0.14'));
  root.style.setProperty('--gold4',       colors.ring.replace('0.4', '0.07'));
  root.style.setProperty('--gold-border', colors.ring.replace('0.4', '0.28'));
}

function applyTheme(themeId) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = themeId === 'dark' || (themeId === 'system' && prefersDark);

  if (isDark) {
    root.style.setProperty('--ink',  '#07070f');
    root.style.setProperty('--ink2', '#0d0d1c');
    root.style.setProperty('--ink3', '#13132a');
    root.style.setProperty('--ink4', '#1a1a35');
    root.style.setProperty('--ink5', '#242452');
    root.style.setProperty('--line',  'rgba(255,255,255,0.07)');
    root.style.setProperty('--line2', 'rgba(255,255,255,0.12)');
    root.style.setProperty('--slate',  'rgba(255,255,255,0.55)');
    root.style.setProperty('--slate2', 'rgba(255,255,255,0.35)');
    root.style.setProperty('--slate3', 'rgba(255,255,255,0.18)');
    root.style.setProperty('--text',        '#ffffff');
    root.style.setProperty('--text-body',   'rgba(255,255,255,0.85)');
    root.style.setProperty('--text-muted',  'rgba(255,255,255,0.45)');
    root.style.setProperty('--placeholder', 'rgba(255,255,255,0.25)');
    document.body.style.background = 'var(--ink2)';
    document.body.style.color      = 'var(--text-body)';
  } else {
    root.style.setProperty('--ink',  '#ffffff');
    root.style.setProperty('--ink2', '#f1f3f8');
    root.style.setProperty('--ink3', '#e8eaf2');
    root.style.setProperty('--ink4', '#dde0ed');
    root.style.setProperty('--ink5', '#c8cde0');
    root.style.setProperty('--line',  'rgba(0,0,0,0.07)');
    root.style.setProperty('--line2', 'rgba(0,0,0,0.12)');
    root.style.setProperty('--slate',  'rgba(0,0,0,0.55)');
    root.style.setProperty('--slate2', 'rgba(0,0,0,0.38)');
    root.style.setProperty('--slate3', 'rgba(0,0,0,0.12)');
    root.style.setProperty('--text',        '#0f1117');
    root.style.setProperty('--text-body',   'rgba(0,0,0,0.82)');
    root.style.setProperty('--text-muted',  'rgba(0,0,0,0.45)');
    root.style.setProperty('--placeholder', 'rgba(0,0,0,0.28)');
    document.body.style.background = 'var(--ink2)';
    document.body.style.color      = 'var(--text-body)';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('tb_theme') || 'dark');
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

  // React to OS-level changes when theme === 'system'
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