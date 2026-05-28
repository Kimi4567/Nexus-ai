import { Film, Megaphone, BarChart3, Shield } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   AgentAvatar — Pure CSS futuristic agent portraits
   No images needed. Zero network requests. Lightning fast.
   ═══════════════════════════════════════════════════════════════ */

interface AgentAvatarProps {
  name: 'NEX' | 'VEX' | 'PULSE' | 'Sentinel'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
}

const AGENT_STYLES = {
  NEX: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    glow: 'rgba(245,158,11,0.4)',
    bgGlow: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.3)',
    iconColor: '#fbbf24',
  },
  VEX: {
    gradient: 'from-cyan-500 via-blue-500 to-cyan-600',
    glow: 'rgba(6,182,212,0.4)',
    bgGlow: 'rgba(6,182,212,0.15)',
    borderColor: 'rgba(6,182,212,0.3)',
    iconColor: '#67e8f9',
  },
  PULSE: {
    gradient: 'from-purple-500 via-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.4)',
    bgGlow: 'rgba(139,92,246,0.15)',
    borderColor: 'rgba(139,92,246,0.3)',
    iconColor: '#c4b5fd',
  },
  Sentinel: {
    gradient: 'from-emerald-500 via-teal-500 to-emerald-600',
    glow: 'rgba(16,185,129,0.4)',
    bgGlow: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
    iconColor: '#6ee7b7',
  },
}

const SIZE_MAP = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
}

const ICON_SIZE = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

export default function AgentAvatar({ name, size = 'md', animate = true }: AgentAvatarProps) {
  const style = AGENT_STYLES[name]
  const sizeClass = SIZE_MAP[size]
  const iconSize = ICON_SIZE[size]

  const Icon = name === 'NEX' ? Film : name === 'VEX' ? Megaphone : name === 'PULSE' ? BarChart3 : Shield

  return (
    <div className={`relative ${sizeClass} shrink-0`}>
      {/* Outer glow ring */}
      <div
        className="absolute inset-[-4px] rounded-2xl opacity-60"
        style={{
          background: `radial-gradient(circle, ${style.bgGlow}, transparent 70%)`,
          animation: animate ? 'pulse-glow 3s ease-in-out infinite' : undefined,
        }}
      />

      {/* Gradient border */}
      <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${style.gradient} p-[2px]`}>
        {/* Inner dark background with icon */}
        <div
          className="w-full h-full rounded-2xl flex items-center justify-center relative overflow-hidden"
          style={{ background: 'rgba(2,2,4,0.95)' }}
        >
          {/* Subtle inner glow */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 50% 30%, ${style.bgGlow}, transparent 60%)`,
            }}
          />

          {/* Icon */}
          <Icon
            size={iconSize}
            color={style.iconColor}
            style={{
              filter: `drop-shadow(0 0 8px ${style.glow})`,
              zIndex: 1,
            }}
          />

          {/* Scan line effect */}
          {animate && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, transparent 40%, ${style.bgGlow} 50%, transparent 60%)`,
                backgroundSize: '100% 200%',
                animation: 'scanMove 2.5s linear infinite',
                opacity: 0.3,
              }}
            />
          )}
        </div>
      </div>

      {/* Status dot */}
      <div
        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2"
        style={{ borderColor: '#020204', boxShadow: '0 0 8px #10b981' }}
      />
    </div>
  )
}
