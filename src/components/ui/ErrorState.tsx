import type { ReactNode } from 'react'

interface ErrorStateProps {
  title: ReactNode
  description: ReactNode
  retryAction?: ReactNode
  className?: string
}

export function ErrorState({
  title,
  description,
  retryAction,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`nx-error-card ${className}`} role="alert">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-red-700">
            {description}
          </p>
        </div>
        {retryAction && (
          <div className="shrink-0">
            {retryAction}
          </div>
        )}
      </div>
    </div>
  )
}
