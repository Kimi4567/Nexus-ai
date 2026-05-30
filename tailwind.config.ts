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
        // ── Reference design system ──────────────────────────────────
        'bg-base':     '#0A0E27',
        'bg-surface':  '#111536',
        'bg-elevated': '#1A1F4B',
        'bg-sidebar':  '#0F1430',
        'bg-input':    '#111536',
        'bg-border':   '#1A1F4B',
        'text-primary':   '#FFFFFF',
        'text-secondary': '#A0AEC0',
        'text-muted':     '#5A6A8C',
        'accent-purple':  '#6C63FF',
        'accent-teal':    '#00BFA6',
        'accent-cyan':    '#00D4FF',
        'accent-amber':   '#FFB800',
        'accent-orange':  '#FF6B35',
        'accent-gold':    '#FFD700',
        'status-approved':  '#4CAF50',
        'status-pending':   '#FF9800',
        'status-rejected':  '#F44336',
        'status-draft':     '#5A6A8C',
        'status-progress':  '#2196F3',
        'status-completed': '#00BFA6',
        'status-error':     '#F44336',
        'agent-strategist': '#6C63FF',
        'agent-nex':        '#00BFA6',
        'agent-vex':        '#FF6B35',
        'agent-pulse':      '#00D4FF',
        'agent-sentinel':   '#FFD700',
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
        // ── V2 Space palette ────────────────────────────────────────
        'deep':           '#020204',
        'surface':        '#0a0a12',
        'text-primary':   '#f8fafc',
        'text-secondary': '#94a3b8',
        'text-muted':     '#64748b',
        'amber': { DEFAULT: '#f59e0b', dark: '#d97706' },
        'cyan':  { DEFAULT: '#06b6d4' },
        'violet': { DEFAULT: '#8b5cf6' },
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        arabic:  ['Noto Sans Arabic', 'Inter', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
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
        'fade-in':        'fadeIn 0.5s ease-out forwards',
        'fade-in-up':     'fadeInUp 0.6s ease-out forwards',
        'slide-up':       'slideUp 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'scale-in':       'scaleIn 0.3s ease-out forwards',
        'pulse-glow':     'pulseGlow 2s ease-in-out infinite',
        'shimmer':        'shimmer 2s linear infinite',
        'float':          'float 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' }, '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(108,99,255,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(108,99,255,0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backgroundImage: {
        'gradient-primary':     'linear-gradient(135deg, #6C63FF 0%, #9333EA 100%)',
        'gradient-hero':        'radial-gradient(ellipse at 20% 50%, rgba(108,99,255,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(0,191,166,0.1) 0%, transparent 50%)',
        'gradient-card-hover':  'linear-gradient(135deg, rgba(108,99,255,0.1) 0%, rgba(0,191,166,0.05) 100%)',
        'gradient-border':      'linear-gradient(135deg, #6C63FF 0%, #00BFA6 100%)',
        'gradient-sidebar':     'linear-gradient(180deg, #0F1430 0%, #0A0E27 100%)',
      },
    },
  },
  plugins: [],
}
export default config
