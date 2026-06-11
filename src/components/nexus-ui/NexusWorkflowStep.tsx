'use client'
import React from 'react'

type StepStatus = 'pending' | 'active' | 'completed' | 'warning'

interface NexusWorkflowStepProps {
  label: string
  description?: string
  status: StepStatus
  stepNumber?: number
  icon?: React.ReactNode
  accentColor?: string
}

const STATUS_STYLES: Record<StepStatus, { border: string; bg: string; textColor: string; dotColor: string }> = {
  pending:   { border: 'rgba(15,23,42,0.08)',      bg: '#FFFFFF',                       textColor: '#6B7280', dotColor: '#CBD5E1' },
  active:    { border: 'rgba(94,92,230,0.22)',     bg: '#F5F3FF',                       textColor: '#5E5CE6', dotColor: '#5E5CE6' },
  completed: { border: 'rgba(16,185,129,0.18)',    bg: '#ECFDF5',                       textColor: '#059669', dotColor: '#059669' },
  warning:   { border: 'rgba(217,119,6,0.18)',     bg: '#FFFBEB',                       textColor: '#B45309', dotColor: '#D97706' },
}

export function NexusWorkflowStep({
  label,
  description,
  status,
  stepNumber,
  icon,
  accentColor,
}: NexusWorkflowStepProps) {
  const s = STATUS_STYLES[status]
  const dotColor = accentColor || s.dotColor
  const textColor = accentColor || s.textColor

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="shrink-0">
        {icon ? (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${dotColor}15`, color: dotColor }}>
            {icon}
          </div>
        ) : stepNumber !== undefined ? (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: `${dotColor}15`, color: dotColor }}
          >
            {status === 'completed' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : stepNumber}
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full mt-0.5" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-tight" style={{ color: textColor }}>{label}</p>
        {description && <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nx-text-3)' }}>{description}</p>}
      </div>
    </div>
  )
}
