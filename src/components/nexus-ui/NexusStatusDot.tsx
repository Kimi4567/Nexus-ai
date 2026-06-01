'use client'
import React from 'react'

type DotStatus = 'online' | 'idle' | 'offline' | 'warning' | 'processing' | 'custom'

interface NexusStatusDotProps {
  status?: DotStatus
  color?: string   // custom hex color
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pulse?: boolean
  label?: string
  labelPosition?: 'right' | 'left'
  className?: string
}

const STATUS_COLORS: Record<DotStatus, string> = {
  online:     '#10B981',
  idle:       '#EAB308',
  offline:    '#475569',
  warning:    '#F97316',
  processing: '#8B5CF6',
  custom:     '#8B5CF6',
}

const SIZE_PX: Record<string, string> = {
  xs: 'w-1 h-1',
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
}

const LABEL_SIZE: Record<string, string> = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-[11px]',
}

export function NexusStatusDot({
  status = 'online',
  color,
  size = 'sm',
  pulse = true,
  label,
  labelPosition = 'right',
  className = '',
}: NexusStatusDotProps) {
  const dotColor = color || STATUS_COLORS[status]

  const dot = (
    <span className="relative flex shrink-0">
      {pulse && status !== 'offline' && (
        <span
          className="absolute inline-flex rounded-full opacity-75 animate-ping"
          style={{ background: dotColor, width: '100%', height: '100%' }}
        />
      )}
      <span
        className={`relative inline-flex rounded-full ${SIZE_PX[size]}`}
        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
    </span>
  )

  if (!label) {
    return <span className={`inline-flex items-center ${className}`}>{dot}</span>
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {labelPosition === 'left' && (
        <span className={`font-medium ${LABEL_SIZE[size]}`} style={{ color: dotColor }}>{label}</span>
      )}
      {dot}
      {labelPosition === 'right' && (
        <span className={`font-medium ${LABEL_SIZE[size]}`} style={{ color: dotColor }}>{label}</span>
      )}
    </span>
  )
}
