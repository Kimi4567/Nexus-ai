'use client'
import React from 'react'

interface NexusGlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
  accentColor?: string
  onClick?: () => void
  style?: React.CSSProperties
}

export function NexusGlassCard({
  children,
  className = '',
  hover = true,
  padding = 'md',
  accentColor,
  onClick,
  style,
}: NexusGlassCardProps) {
  const padMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }
  const base = [
    'rounded-2xl relative overflow-hidden',
    padMap[padding],
    hover ? 'nx-card' : 'nx-glass',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={base} onClick={onClick} style={style}>
      {accentColor && (
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: accentColor }}
        />
      )}
      {children}
    </div>
  )
}
