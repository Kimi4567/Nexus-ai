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
        // ── NEXUS Core Palette ────────────────────────────────────────
        'nx-base':        '#06071A',   // deepest background
        'nx-surface':     '#0C0D24',   // card surface
        'nx-elevated':    '#111330',   // elevated / hover surface
        'nx-panel':       '#0F1028',   // panel / sidebar
        'nx-border':      'rgba(139,92,246,0.15)',
        'nx-border-hi':   'rgba(139,92,246,0.35)',

        // ── NEXUS Accent — violet-blue ────────────────────────────────
        'nx-violet':      '#8B5CF6',
        'nx-violet-dark': '#7C3AED',
        'nx-violet-dim':  'rgba(139,92,246,0.12)',
        'nx-blue':        '#3B82F6',
        'nx-cyan':        '#06B6D4',

        // ── NEXUS Orange accent lines ─────────────────────────────────
        'nx-orange':      '#F97316',
        'nx-orange-dim':  'rgba(249,115,22,0.12)',

        // ── NEXUS Text ────────────────────────────────────────────────
        'nx-text-1':      '#F8FAFC',   // primary
        'nx-text-2':      '#94A3B8',   // secondary
        'nx-text-3':      '#64748B',   // muted
        'nx-text-4':      '#334155',   // disabled

        // ── Agent accent colors ───────────────────────────────────────
        'agent-brain':      '#8B5CF6',
        'agent-strategist': '#6366F1',
        'agent-nex':        '#06B6D4',
        'agent-vex':        '#F97316',
        'agent-sentinel':   '#EAB308',
        'agent-pulse':      '#10B981',

        // ── Legacy compatibility ──────────────────────────────────────
        'bg-base':        '#06071A',
        'bg-surface':     '#0C0D24',
        'bg-elevated':    '#111330',
        'bg-sidebar':     '#0A0B1E',
        'text-primary':   '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted':     '#64748B',
        'accent-purple':  '#8B5CF6',
        'accent-teal':    '#06B6D4',
        'accent-cyan':    '#06B6D4',
        'accent-amber':   '#F59E0B',
        'accent-orange':  '#F97316',
        'accent-gold':    '#EAB308',
        'status-approved':  '#10B981',
        'status-pending':   '#F59E0B',
        'status-rejected':  '#EF4444',
        'status-draft':     '#64748B',
        'status-progress':  '#3B82F6',
        'status-completed': '#06B6D4',
        'status-error':     '#EF4444',
        'agent-nex-legacy': '#06B6D4',
        'agent-vex-legacy': '#F97316',

        // ── dark-* aliases (used by legacy page components) ───────────
        // These map to the nx-* palette so all pages render correctly
        'dark':           '#06071A',   // bg-dark  → nx-base
        'dark-secondary': '#0C0D24',   // bg-dark-secondary → nx-surface
        'dark-tertiary':  '#111330',   // bg-dark-tertiary, border-dark-tertiary → nx-elevated
        'accent':         '#8B5CF6',   // text-accent, bg-accent, border-accent → nx-violet
      },

      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        arabic:  ['Noto Sans Arabic', 'Inter', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        'nx-sm':   '8px',
        'nx-md':   '12px',
        'nx-lg':   '16px',
        'nx-xl':   '20px',
        'nx-2xl':  '24px',
        'card':    '12px',
        'panel':   '16px',
      },

      boxShadow: {
        // Violet glow family
        'nx-glow-sm':   '0 0 12px rgba(139,92,246,0.25)',
        'nx-glow-md':   '0 0 24px rgba(139,92,246,0.3), 0 0 48px rgba(139,92,246,0.12)',
        'nx-glow-lg':   '0 0 40px rgba(139,92,246,0.35), 0 0 80px rgba(139,92,246,0.15)',
        // Orange glow
        'nx-orange-sm': '0 0 12px rgba(249,115,22,0.3)',
        'nx-orange-md': '0 0 24px rgba(249,115,22,0.35)',
        // Card depth
        'nx-card':      '0 1px 3px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        'nx-card-hover':'0 2px 8px rgba(0,0,0,0.7), 0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        'nx-panel':     '0 4px 24px rgba(0,0,0,0.6), 0 24px 64px rgba(0,0,0,0.35)',
        // Agent glows
        'agent-brain':      '0 0 20px rgba(139,92,246,0.35)',
        'agent-strategist': '0 0 20px rgba(99,102,241,0.35)',
        'agent-nex':        '0 0 20px rgba(6,182,212,0.35)',
        'agent-vex':        '0 0 20px rgba(249,115,22,0.35)',
        'agent-sentinel':   '0 0 20px rgba(234,179,8,0.35)',
        // Legacy
        'card':             '0 1px 3px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3)',
        'card-hover':       '0 2px 8px rgba(0,0,0,0.6), 0 12px 32px rgba(0,0,0,0.35)',
        'panel':            '0 4px 24px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.32)',
        'accent-sm':        '0 0 16px rgba(139,92,246,0.25)',
        'accent-md':        '0 0 32px rgba(139,92,246,0.2)',
        'top-edge':         'inset 0 1px 0 rgba(255,255,255,0.04)',
      },

      backgroundImage: {
        // NEXUS gradients
        'nx-hero':          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.2) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(249,115,22,0.08) 0%, transparent 60%)',
        'nx-card':          'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(6,7,26,0) 100%)',
        'nx-card-hover':    'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(249,115,22,0.03) 100%)',
        'nx-violet':        'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
        'nx-violet-orange': 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
        'nx-cta':           'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
        'nx-orange':        'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
        'nx-sidebar':       'linear-gradient(180deg, #0A0B1E 0%, #06071A 100%)',
        'nx-grid':          'linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)',
        // Agent gradients
        'agent-brain-grad':      'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(99,102,241,0.1) 100%)',
        'agent-nex-grad':        'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(59,130,246,0.1) 100%)',
        'agent-vex-grad':        'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(234,88,12,0.1) 100%)',
        'agent-sentinel-grad':   'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(161,98,7,0.1) 100%)',
        'agent-strategist-grad': 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.1) 100%)',
        // Legacy
        'gradient-primary':   'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
        'gradient-hero':      'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.1) 0%, transparent 50%)',
        'gradient-card-hover':'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.05) 100%)',
        'gradient-border':    'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
        'gradient-sidebar':   'linear-gradient(180deg, #0A0B1E 0%, #06071A 100%)',
        'btn-gradient':       'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      },

      animation: {
        'fade-in':        'fadeIn 0.5s ease-out forwards',
        'fade-in-up':     'fadeInUp 0.6s ease-out forwards',
        'slide-up':       'slideUp 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'scale-in':       'scaleIn 0.3s ease-out forwards',
        'pulse-glow':     'pulseGlow 3s ease-in-out infinite',
        'shimmer':        'shimmer 2.5s linear infinite',
        'float':          'float 4s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'orbit':          'orbit 8s linear infinite',
      },

      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp:  { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideUp:   { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(20px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        scaleIn:   { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)' },
          '50%':       { boxShadow: '0 0 40px rgba(139,92,246,0.6), 0 0 80px rgba(139,92,246,0.2)' },
        },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float:     { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        gradientShift: { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        orbit:     { '0%': { transform: 'rotate(0deg) translateX(60px) rotate(0deg)' }, '100%': { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)' } },
      },
    },
  },
  plugins: [],
}
export default config
