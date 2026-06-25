import type { ReactNode } from 'react'

interface MetricCardProps {
  label: ReactNode
  value: ReactNode
  helper?: ReactNode
  status?: ReactNode
  trend?: ReactNode
  icon?: ReactNode
  className?: string
}

export function MetricCard({
  label,
  value,
  helper,
  status,
  trend,
  icon,
  className = '',
}: MetricCardProps) {
  return (
    <div className={`nx-section-card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--nx-text-3)]">
            {label}
          </p>
          <div className="mt-2 text-2xl font-bold leading-none text-[var(--nx-text-1)]">
            {value}
          </div>
        </div>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(94,92,230,0.18)] bg-[var(--nx-violet-dim)] text-[var(--nx-violet)]">
            {icon}
          </div>
        )}
      </div>

      {(helper || status || trend) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {helper && (
            <p className="text-xs leading-relaxed text-[var(--nx-text-3)]">
              {helper}
            </p>
          )}
          <div className="flex items-center gap-2">
            {status}
            {trend && <span className="text-xs font-semibold text-[var(--nx-text-2)]">{trend}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
