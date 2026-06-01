'use client'
import React from 'react'

interface NexusSectionHeaderProps {
  label: string
  title?: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  accentColor?: string
  className?: string
}

export function NexusSectionHeader({
  label,
  title,
  subtitle,
  icon,
  action,
  accentColor = '#8B5CF6',
  className = '',
}: NexusSectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          {icon && (
            <div
              className="w-5 h-5 flex items-center justify-center"
              style={{ color: accentColor }}
            >
              {icon}
            </div>
          )}
          <span className="nx-section-label" style={{ color: accentColor + 'AA' }}>
            {label}
          </span>
        </div>
        {title && (
          <h2 className="text-lg font-bold font-heading text-nx-text-1 leading-tight">{title}</h2>
        )}
        {subtitle && (
          <p className="text-sm text-nx-text-3 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
