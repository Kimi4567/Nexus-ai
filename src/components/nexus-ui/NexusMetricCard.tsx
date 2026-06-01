'use client'
import React from 'react'

interface NexusMetricCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  accentColor?: string
  trend?: { value: string; up: boolean }
  children?: React.ReactNode
  className?: string
}

export function NexusMetricCard({
  label,
  value,
  sub,
  icon,
  accentColor = '#8B5CF6',
  trend,
  children,
  className = '',
}: NexusMetricCardProps) {
  return (
    <div className={`nx-metric-card ${className}`}>
      {/* Ambient glow blob */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-15 pointer-events-none"
        style={{ background: accentColor }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium leading-tight" style={{ color: 'var(--nx-text-3)' }}>
            {label}
          </p>
          {icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: accentColor + '15' }}
            >
              <span style={{ color: accentColor }}>{icon}</span>
            </div>
          )}
        </div>
        <p
          className="text-2xl font-bold mb-1 font-heading"
          style={{ color: accentColor }}
        >
          {value}
        </p>
        {children}
        <div className="flex items-center justify-between mt-1">
          {sub && <p className="text-[11px]" style={{ color: 'var(--nx-text-3)' }}>{sub}</p>}
          {trend && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: trend.up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: trend.up ? '#10B981' : '#EF4444',
              }}
            >
              {trend.up ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
