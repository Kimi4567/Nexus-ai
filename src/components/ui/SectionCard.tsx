import type { ReactNode } from 'react'

type SectionCardVariant = 'default' | 'subtle' | 'elevated'

interface SectionCardProps {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  variant?: SectionCardVariant
  className?: string
  contentClassName?: string
}

const variantClass: Record<SectionCardVariant, string> = {
  default: 'nx-section-card',
  subtle: 'nx-section-card bg-[var(--nx-surface-2)] shadow-none',
  elevated: 'nx-section-card shadow-[var(--shadow-card)]',
}

export function SectionCard({
  title,
  description,
  action,
  children,
  variant = 'default',
  className = '',
  contentClassName = '',
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || action)

  return (
    <section className={`${variantClass[variant]} ${className}`}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--nx-border)] px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-bold leading-tight text-[var(--nx-text-1)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-[var(--nx-text-3)]">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={`p-5 ${contentClassName}`}>
        {children}
      </div>
    </section>
  )
}
