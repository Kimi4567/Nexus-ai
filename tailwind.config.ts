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
        // ── Base surfaces — warm obsidian (no blue cast) ──────────────
        'dark':           '#080807',   // true warm black
        'dark-secondary': '#101010',   // primary panel surface
        'dark-tertiary':  '#1a1a18',   // elevated surface / active borders
        // ── Layered surface hierarchy ─────────────────────────────────
        's0': '#080807',   // deepest layer
        's1': '#0d0d0c',   // base cards
        's2': '#131312',   // elevated cards
        's3': '#191918',   // top-level / popovers
        's4': '#1f1f1d',   // borders, dividers
        's5': '#272724',   // hovered borders
        // ── Nexus Ember — signature amber accent ──────────────────────
        'accent':         '#FF9500',   // Nexus Ember — pure amber
        'accent-light':   '#FFB340',   // hover / lighter state
        'accent-dim':     'rgba(255, 149, 0, 0.10)',
        // ── Semantic text — warm white, not cold blue ─────────────────
        't1': '#F5F0E8',   // warm white — primary text
        't2': '#9A9080',   // warm gray — secondary text
        't3': '#5C5448',   // warm muted — tertiary
        't4': '#38342E',   // warm dim — borders/placeholders
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
        'panel': '16px',
      },
      boxShadow: {
        // Layered depth shadows — warm-tinted
        'card':       '0 1px 3px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.6), 0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
        'panel':      '0 4px 24px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.03)',
        // Amber ambient glows — the Nexus Ember signature
        'accent-sm':  '0 0 16px rgba(255,149,0,0.20)',
        'accent-md':  '0 0 32px rgba(255,149,0,0.18), 0 0 64px rgba(255,149,0,0.08)',
        // Inset light edge
        'top-edge':   'inset 0 1px 0 rgba(255,255,255,0.04)',
        'top-edge-hi':'inset 0 1px 0 rgba(255,255,255,0.08)',
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
          '0%,100%': { boxShadow: '0 0 14px rgba(255,149,0,0.12)' },
          '50%': { boxShadow: '0 0 32px rgba(255,149,0,0.25)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
