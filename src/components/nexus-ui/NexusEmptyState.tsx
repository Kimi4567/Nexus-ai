'use client'
import React from 'react'
import Link from 'next/link'

/**
 * NexusEmptyState — one consistent empty-state pattern across the app.
 *
 * Apple-level principle: every empty state is designed (icon + one line + one CTA),
 * never a bare string or blank panel. Token-driven; no inline hex.
 */
interface NexusEmptyStateProps {
  /** Icon or emoji shown above the title */
  icon?: React.ReactNode
  title: string
  description?: string
  /** Single primary action */
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

export function NexusEmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}: NexusEmptyStateProps) {
  const action = actionLabel ? (
    actionHref ? (
      <Link href={actionHref} className="nx-btn-primary text-sm px-5 py-2.5 inline-flex items-center justify-center font-bold">
        {actionLabel}
      </Link>
    ) : (
      <button onClick={onAction} className="nx-btn-primary text-sm px-5 py-2.5 inline-flex items-center justify-center font-bold">
        {actionLabel}
      </button>
    )
  ) : null

  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      {icon && (
        <div
          className="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--nx-violet-dim)', border: '1px solid var(--nx-border)' }}
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold" style={{ color: 'var(--nx-text-1)' }}>{title}</p>
      {description && (
        <p className="text-xs mt-1.5 max-w-xs leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
