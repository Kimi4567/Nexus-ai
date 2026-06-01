'use client'
import React from 'react'

interface NexusGlowPanelProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
  glowPosition?: 'top' | 'bottom' | 'both'
}

export function NexusGlowPanel({
  children,
  className = '',
  glowColor = 'rgba(139,92,246,0.15)',
  glowPosition = 'top',
}: NexusGlowPanelProps) {
  return (
    <div className={`nx-glow-panel ${className}`} style={{ '--glow-color': glowColor } as React.CSSProperties}>
      {(glowPosition === 'top' || glowPosition === 'both') && (
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none"
          style={{ background: glowColor, opacity: 0.6 }}
        />
      )}
      {(glowPosition === 'bottom' || glowPosition === 'both') && (
        <div
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none"
          style={{ background: glowColor, opacity: 0.4 }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
