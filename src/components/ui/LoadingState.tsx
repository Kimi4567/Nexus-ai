import type { ReactNode } from 'react'

interface LoadingStateProps {
  label?: ReactNode
  description?: ReactNode
  className?: string
}

export function LoadingState({
  label = 'Loading',
  description,
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`nx-loading-card flex items-center gap-4 ${className}`} role="status" aria-live="polite">
      <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[var(--nx-border-hi)] border-t-[var(--nx-violet)]" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--nx-text-1)]">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--nx-text-3)]">
            {description}
          </span>
        )}
      </span>
    </div>
  )
}
