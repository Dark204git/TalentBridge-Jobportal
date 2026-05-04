/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4a843',
          light:   '#e8c06a',
          dim:     'rgba(212,168,67,0.14)',
          border:  'rgba(212,168,67,0.28)',
        },
        ink: {
          DEFAULT: '#07070f',
          2: '#0d0d1c',
          3: '#13132a',
          4: '#1a1a35',
          5: '#242452',
        },
        green:  { job: '#00c896' },
        purple: { job: '#8b84ff' },
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        card: '14px',
        btn:  '10px',
        chip: '20px',
      },
      boxShadow: {
        'card-hover': '0 8px 32px rgba(0,0,0,0.5)',
        'gold-glow':  '0 0 20px rgba(212,168,67,0.2)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%':     { opacity: '0.4', transform: 'scale(0.85)' },
        },
      },
      animation: {
        'fade-up':   'fadeUp 0.4s ease-out forwards',
        'fade-in':   'fadeIn 0.3s ease-out forwards',
        'shimmer':   'shimmer 1.4s infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
