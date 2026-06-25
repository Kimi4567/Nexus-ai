'use client'

import Link from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ActionButtonSize = 'sm' | 'md'

interface ActionButtonProps {
  children: ReactNode
  variant?: ActionButtonVariant
  size?: ActionButtonSize
  href?: string
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  'aria-label'?: string
}

const variantClass: Record<ActionButtonVariant, string> = {
  primary:
    'bg-[var(--nx-text-1)] text-white border-transparent shadow-[0_8px_20px_rgba(17,24,39,0.12)] hover:shadow-[0_12px_28px_rgba(17,24,39,0.16)]',
  secondary:
    'bg-[var(--nx-violet-dim)] text-[var(--nx-violet)] border-[rgba(94,92,230,0.18)] hover:bg-[rgba(94,92,230,0.12)]',
  ghost:
    'bg-white text-[var(--nx-text-2)] border-[var(--nx-border)] hover:bg-[var(--nx-surface-2)] hover:text-[var(--nx-text-1)]',
  danger:
    'bg-[var(--nx-danger-bg)] text-[var(--nx-danger)] border-[var(--nx-danger-border)] hover:bg-red-100',
}

const sizeClass: Record<ActionButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
}

export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  href,
  type = 'button',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  className = '',
  onClick,
  'aria-label': ariaLabel,
}: ActionButtonProps) {
  const inactive = disabled || loading
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-[10px] border font-bold leading-none no-underline transition-all',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(94,92,230,0.35)] focus-visible:ring-offset-2',
    variantClass[variant],
    sizeClass[size],
    inactive ? 'pointer-events-none opacity-55' : '',
    className,
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {loading ? (
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
      {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
    </>
  )

  if (href && !inactive) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={inactive}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {content}
    </button>
  )
}
