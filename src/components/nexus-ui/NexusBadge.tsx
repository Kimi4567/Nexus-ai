'use client'
import React from 'react'

type BadgeVariant = 'violet' | 'orange' | 'green' | 'red' | 'cyan' | 'yellow' | 'ghost' | 'custom'

interface NexusBadgeProps {
  label: string
  variant?: BadgeVariant
  size?: 'xs' | 'sm' | 'md'
  dot?: boolean
  icon?: React.ReactNode
  color?: string   // custom hex — used when variant='custom'
  className?: string
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string; dot?: string }> = {
  violet:  { bg: 'rgba(139,92,246,0.12)',  text: '#A78BFA', border: 'rgba(139,92,246,0.25)', dot: '#8B5CF6' },
  orange:  { bg: 'rgba(249,115,22,0.12)',  text: '#FB923C', border: 'rgba(249,115,22,0.25)', dot: '#F97316' },
  green:   { bg: 'rgba(16,185,129,0.1)',   text: '#34D399', border: 'rgba(16,185,129,0.2)',  dot: '#10B981' },
  red:     { bg: 'rgba(239,68,68,0.1)',    text: '#F87171', border: 'rgba(239,68,68,0.2)',   dot: '#EF4444' },
  cyan:    { bg: 'rgba(6,182,212,0.1)',    text: '#67E8F9', border: 'rgba(6,182,212,0.2)',   dot: '#06B6D4' },
  yellow:  { bg: 'rgba(234,179,8,0.1)',    text: '#FDE047', border: 'rgba(234,179,8,0.2)',   dot: '#EAB308' },
  ghost:   { bg: 'rgba(100,116,139,0.08)', text: '#94A3B8', border: 'rgba(100,116,139,0.15)' },
  custom:  { bg: 'transparent', text: '', border: 'transparent' },
}

const SIZE_STYLES = {
  xs: 'text-[9px] px-1.5 py-0.5 rounded-md',
  sm: 'text-[10px] px-2 py-0.5 rounded-md',
  md: 'text-[11px] px-2.5 py-1 rounded-lg',
}

export function NexusBadge({
  label,
  variant = 'violet',
  size = 'sm',
  dot = false,
  icon,
  color,
  className = '',
}: NexusBadgeProps) {
  const isCustom = variant === 'custom' && color
  const s = VARIANT_STYLES[variant]

  const bgStyle = isCustom ? `${color}18` : s.bg
  const textStyle = isCustom ? color! : s.text
  const borderStyle = isCustom ? `${color}30` : s.border
  const dotColor = isCustom ? color! : (s.dot || textStyle)

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${SIZE_STYLES[size]} ${className}`}
      style={{ background: bgStyle, color: textStyle, border: `1px solid ${borderStyle}` }}
    >
      {dot && (
        <span
          className="w-1 h-1 rounded-full shrink-0"
          style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}` }}
        />
      )}
      {icon && <span className="w-3 h-3 flex items-center justify-center">{icon}</span>}
      {label}
    </span>
  )
}
