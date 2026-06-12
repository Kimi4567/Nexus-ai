'use client'
import React from 'react'

/**
 * NexusErrorState — one consistent error pattern across the app.
 *
 * Apple-level principle: errors are calm, legible, and offer a recovery path.
 * Uses the single semantic warning/error tokens; no inline hex.
 */
interface NexusErrorStateProps {
  title?: string
  message?: string
  /** Single recovery action (e.g. "Try again") */
  retryLabel?: string
  onRetry?: () => void
  className?: string
  /** 'error' = red (failure), 'warning' = amber (caution) */
  tone?: 'error' | 'warning'
}

export function NexusErrorState({
  title = 'Something went wrong',
  message,
  retryLabel = 'Try again',
  onRetry,
  className = '',
  tone = 'error',
}: NexusErrorStateProps) {
  const isWarning = tone === 'warning'
  const accent = isWarning ? 'var(--nx-warning)' : '#EF4444'
  const tint = isWarning ? 'var(--nx-warning-dim)' : 'rgba(239,68,68,0.10)'

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-10 rounded-2xl ${className}`}
      style={{ background: tint, border: `1px solid ${accent}` }}
      role="alert"
    >
      <div className="w-11 h-11 mb-3 rounded-full flex items-center justify-center" style={{ background: tint }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--nx-text-1)' }}>{title}</p>
      {message && (
        <p className="text-xs mt-1.5 max-w-sm leading-relaxed" style={{ color: 'var(--nx-text-2)' }}>{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-xs font-bold px-4 py-2 rounded-lg transition-all"
          style={{ background: accent, color: '#FFFFFF' }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
