'use client'

/* ═══════════════════════════════════════════════════════════════
   AgentAvatar — Pure CSS/SVG futuristic agent portraits
   No images needed. GPU-friendly. Zero network requests.
   ═══════════════════════════════════════════════════════════════ */

interface AgentAvatarProps {
  name: 'NEX' | 'VEX' | 'PULSE' | 'Sentinel'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
}

const AGENT_CONFIG = {
  NEX: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    glow: 'rgba(245,158,11,0.4)',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="nexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <filter id="nexGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <!-- Hexagonal face -->
        <polygon points="50,5 90,25 90,70 50,90 10,70 10,25" fill="url(#nexGrad)" opacity="0.2" />
        <polygon points="50,15 80,30 80,65 50,80 20,65 20,30" fill="url(#nexGrad)" opacity="0.4" />
        <!-- Eyes -->
        <circle cx="38" cy="45" r="6" fill="#fff" opacity="0.9" filter="url(#nexGlow)" />
        <circle cx="62" cy="45" r="6" fill="#fff" opacity="0.9" filter="url(#nexGlow)" />
        <circle cx="38" cy="45" r="3" fill="#f59e0b" />
        <circle cx="62" cy="45" r="3" fill="#f59e0b" />
        <!-- Mouth -->
        <path d="M 35 60 Q 50 68 65 60" stroke="#fff" strokeWidth="2" fill="none" opacity="0.6" />
      </svg>
    ),
  },
  VEX: {
    gradient: 'from-cyan-500 via-blue-500 to-cyan-600',
    glow: 'rgba(6,182,212,0.4)',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="vexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="vexGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <!-- Square face with rounded corners -->
        <rect x="15" y="10" width="70" height="80" rx="20" fill="url(#vexGrad)" opacity="0.2" />
        <rect x="22" y="18" width="56" height="64" rx="15" fill="url(#vexGrad)" opacity="0.35" />
        <!-- Target eyes -->
        <circle cx="35" cy="42" r="8" stroke="#fff" strokeWidth="2" fill="none" opacity="0.8" filter="url(#vexGlow)" />
        <circle cx="65" cy="42" r="8" stroke="#fff" strokeWidth="2" fill="none" opacity="0.8" filter="url(#vexGlow)" />
        <circle cx="35" cy="42" r="3" fill="#06b6d4" />
        <circle cx="65" cy="42" r="3" fill="#06b6d4" />
        <!-- Tactical line mouth -->
        <line x1="40" y1="62" x2="60" y2="62" stroke="#fff" strokeWidth="2" opacity="0.6" />
      </svg>
    ),
  },
  PULSE: {
    gradient: 'from-purple-500 via-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.4)',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <filter id="pulseGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <!-- Circle face -->
        <circle cx="50" cy="50" r="42" fill="url(#pulseGrad)" opacity="0.2" />
        <circle cx="50" cy="50" r="34" fill="url(#pulseGrad)" opacity="0.35" />
        <!-- Data eyes -->
        <rect x="28" y="38" width="18" height="14" rx="3" fill="#fff" opacity="0.8" filter="url(#pulseGlow)" />
        <rect x="54" y="38" width="18" height="14" rx="3" fill="#fff" opacity="0.8" filter="url(#pulseGlow)" />
        <rect x="32" y="42" width="10" height="6" rx="1" fill="#8b5cf6" />
        <rect x="58" y="42" width="10" height="6" rx="1" fill="#8b5cf6" />
        <!-- Wave mouth -->
        <path d="M 35 65 Q 42 60 50 65 Q 58 70 65 65" stroke="#fff" strokeWidth="2" fill="none" opacity="0.6" />
      </svg>
    ),
  },
  Sentinel: {
    gradient: 'from-emerald-500 via-teal-500 to-emerald-600',
    glow: 'rgba(16,185,129,0.4)',
    icon: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="sentinelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id="sentinelGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <!-- Shield face -->
        <path d="M 50 8 L 88 25 L 88 55 Q 88 78 50 92 Q 12 78 12 55 L 12 25 Z" fill="url(#sentinelGrad)" opacity="0.2" />
        <path d="M 50 18 L 78 30 L 78 52 Q 78 70 50 82 Q 22 70 22 52 L 22 30 Z" fill="url(#sentinelGrad)" opacity="0.4" />
        <!-- Scanner eyes -->
        <line x1="30" y1="42" x2="45" y2="42" stroke="#fff" strokeWidth="3" opacity="0.9" filter="url(#sentinelGlow)" />
        <line x1="55" y1="42" x2="70" y2="42" stroke="#fff" strokeWidth="3" opacity="0.9" filter="url(#sentinelGlow)" />
        <circle cx="37" cy="42" r="2" fill="#10b981" />
        <circle cx="63" cy="42" r="2" fill="#10b981" />
        <!-- Scanner beam -->
        <line x1="50" y1="42" x2="50" y2="35" stroke="#10b981" strokeWidth="1" opacity="0.5"
          style={{ animation: 'scanBeam 2s ease-in-out infinite' }}
        />
      </svg>
    ),
  },
}

const SIZE_MAP = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
}

export default function AgentAvatar({ name, size = 'md', animate = true }: AgentAvatarProps) {
  const config = AGENT_CONFIG[name]
  const sizeClass = SIZE_MAP[size]

  return (
    <div
      className={`relative ${sizeClass} shrink-0`}
      style={{
        filter: animate ? `drop-shadow(0 0 12px ${config.glow})` : undefined,
      }}
    >
      <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${config.gradient} p-[2px]`}
        style={{
          animation: animate ? 'pulse-glow 3s ease-in-out infinite' : undefined,
        }}
      >
        <div className="w-full h-full rounded-2xl bg-deep overflow-hidden"
          style={{ background: 'rgba(2,2,4,0.9)' }}
        >
          {config.icon}
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-deep"
        style={{ boxShadow: '0 0 8px #10b981' }}
      />
    </div>
  )
}
