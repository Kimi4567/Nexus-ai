import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  eyebrow?: ReactNode
  description?: ReactNode
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  eyebrow,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}: PageHeaderProps) {
  const hasActions = Boolean(primaryAction || secondaryAction)

  return (
    <header className={`nx-page-header flex-col sm:flex-row ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="nx-section-label mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="nx-page-title">
          {title}
        </h1>
        {description && (
          <p className="nx-page-subtitle">
            {description}
          </p>
        )}
      </div>

      {hasActions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </header>
  )
}
