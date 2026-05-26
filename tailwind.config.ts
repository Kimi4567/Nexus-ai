import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Base surfaces (graphite with subtle blue undertone) ───────
        'dark':           '#09090e',   // base canvas — rich graphite
        'dark-secondary': '#111119',   // primary panel surface
        'dark-tertiary':  '#1c1c28',   // elevated surface / active borders
        // ── Layered surface hierarchy ─────────────────────────────────
        's0': '#09090e',   // deepest layer
        's1': '#0d0d15',   // base cards
        's2': '#111119',   // elevated cards
        's3': '#161622',   // top-level / popovers
        's4': '#1c1c28',   // borders, dividers
        's5': '#242434',   // hovered borders
        // ── Accent system ─────────────────────────────────────────────
        'accent':         '#6366f1',
        'accent-light':   '#818cf8',
        'accent-dim':     'rgba(99, 102, 241, 0.10)',
        // ── Semantic text ─────────────────────────────────────────────
        't1': '#f0f0f8',
        't2': '#9090a8',
        't3': '#5a5a6e',
        't4': '#38383e',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        'card': '14px',
        'panel': '18px',
      },
      boxShadow: {
        // Layered depth shadows
        'card':       '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.55), 0 12px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)',
        'panel':      '0 4px 24px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
        // Accent ambient glows
        'accent-sm':  '0 0 16px rgba(99,102,241,0.18)',
        'accent-md':  '0 0 32px rgba(99,102,241,0.16), 0 0 64px rgba(99,102,241,0.07)',
        // Inset light edge
        'top-edge':   'inset 0 1px 0 rgba(255,255,255,0.05)',
        'top-edge-hi':'inset 0 1px 0 rgba(255,255,255,0.09)',
      },
      animation: {
        'fade-in':       'fadeIn 0.4s cubic-bezier(0.22,1,0.36,1)',
        'slide-up':      'slideUp 0.28s cubic-bezier(0.22,1,0.36,1)',
        'slide-down':    'slideDown 0.28s cubic-bezier(0.22,1,0.36,1)',
        'ambient-pulse': 'ambientPulse 3.5s ease-in-out infinite',
        'float':         'float 5s ease-in-out infinite',
        'glow-pulse':    'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' }, '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        ambientPulse: {
          '0%,100%': { opacity: '0.3' }, '50%': { opacity: '0.75' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 14px rgba(99,102,241,0.10)' },
          '50%': { boxShadow: '0 0 28px rgba(99,102,241,0.22)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
