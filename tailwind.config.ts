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
        'nx-base':        '#F5F5F7',
        'nx-surface':     '#FFFFFF',
        'nx-surface-2':   '#F8FAFC',
        'nx-elevated':    '#F9FAFB',
        'nx-panel':       '#FFFFFF',
        'nx-border':      'rgba(15,23,42,0.08)',
        'nx-border-hi':   'rgba(15,23,42,0.16)',

        // ── NEXUS Accent — violet-blue ────────────────────────────────
        'nx-violet':      '#5E5CE6',
        'nx-violet-dark': '#4F46E5',
        'nx-violet-dim':  'rgba(94,92,230,0.08)',
        'nx-blue':        '#2563EB',
        'nx-cyan':        '#0891B2',

        // ── NEXUS Orange accent lines ─────────────────────────────────
        'nx-orange':      '#D97706',
        'nx-orange-dim':  'rgba(217,119,6,0.08)',

        // ── NEXUS Text ────────────────────────────────────────────────
        'nx-text-1':      '#111827',
        'nx-text-2':      '#4B5563',
        'nx-text-3':      '#6B7280',
        'nx-text-4':      '#9CA3AF',

        // ── Semantic UI state tokens ─────────────────────────────────
        'nx-success':        '#059669',
        'nx-success-bg':     '#ECFDF5',
        'nx-success-border': 'rgba(16,185,129,0.18)',
        'nx-warning':        '#D97706',
        'nx-warning-bg':     '#FFFBEB',
        'nx-warning-border': 'rgba(217,119,6,0.18)',
        'nx-danger':         '#DC2626',
        'nx-danger-bg':      '#FEF2F2',
        'nx-danger-border':  'rgba(239,68,68,0.18)',
        'nx-info':           '#2563EB',
        'nx-info-bg':        '#EFF6FF',
        'nx-info-border':    'rgba(37,99,235,0.16)',
        'nx-neutral-bg':     '#F8FAFC',
        'nx-neutral-border': 'rgba(15,23,42,0.08)',

        // ── Agent accent colors ───────────────────────────────────────
        'agent-brain':      '#5E5CE6',
        'agent-strategist': '#2563EB',
        'agent-nex':        '#0891B2',
        'agent-vex':        '#D97706',
        'agent-sentinel':   '#CA8A04',
        'agent-pulse':      '#059669',

        // ── Legacy compatibility ──────────────────────────────────────
        'bg-base':        '#F5F5F7',
        'bg-surface':     '#FFFFFF',
        'bg-elevated':    '#F9FAFB',
        'bg-sidebar':     '#FFFFFF',
        'text-primary':   '#111827',
        'text-secondary': '#4B5563',
        'text-muted':     '#6B7280',
        'accent-purple':  '#5E5CE6',
        'accent-teal':    '#0891B2',
        'accent-cyan':    '#0891B2',
        'accent-amber':   '#F59E0B',
        'accent-orange':  '#D97706',
        'accent-gold':    '#CA8A04',
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
        'dark':           '#F5F5F7',
        'dark-secondary': '#FFFFFF',
        'dark-tertiary':  '#E5E7EB',
        'accent':         '#5E5CE6',
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
        'nx-card':      '0 1px 2px rgba(15,23,42,0.04), 0 10px 30px rgba(15,23,42,0.06)',
        'nx-card-hover':'0 2px 4px rgba(15,23,42,0.05), 0 16px 42px rgba(15,23,42,0.09)',
        'nx-panel':     '0 12px 36px rgba(15,23,42,0.08)',
        // Agent glows
        'agent-brain':      '0 0 20px rgba(139,92,246,0.35)',
        'agent-strategist': '0 0 20px rgba(99,102,241,0.35)',
        'agent-nex':        '0 0 20px rgba(6,182,212,0.35)',
        'agent-vex':        '0 0 20px rgba(249,115,22,0.35)',
        'agent-sentinel':   '0 0 20px rgba(234,179,8,0.35)',
        // Legacy
        'card':             '0 1px 2px rgba(15,23,42,0.04), 0 10px 30px rgba(15,23,42,0.06)',
        'card-hover':       '0 2px 4px rgba(15,23,42,0.05), 0 16px 42px rgba(15,23,42,0.09)',
        'panel':            '0 12px 36px rgba(15,23,42,0.08)',
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
        'nx-sidebar':       'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
        'nx-grid':          'none',
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
        'gradient-sidebar':   'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
        'btn-gradient':       'linear-gradient(135deg, #111827 0%, #374151 100%)',
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
