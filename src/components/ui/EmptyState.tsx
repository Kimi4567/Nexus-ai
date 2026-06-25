import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`nx-empty-state ${className}`}>
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(94,92,230,0.18)] bg-[var(--nx-violet-dim)] text-[var(--nx-violet)]">
          {icon}
        </div>
      )}
      <h2 className="text-base font-bold text-[var(--nx-text-1)]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--nx-text-3)]">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5 flex justify-center">
          {action}
        </div>
      )}
    </div>
  )
}
