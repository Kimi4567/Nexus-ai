import type { ReactNode } from 'react'

export type StatusBadgeStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'autoScheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'pending'
  | 'learned'

interface StatusBadgeProps {
  status: StatusBadgeStatus
  children?: ReactNode
  className?: string
}

const statusConfig: Record<StatusBadgeStatus, { label: string; tone?: string }> = {
  draft: { label: 'Draft' },
  review: { label: 'Needs review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'warning' },
  autoScheduled: { label: 'Auto-plan queued', tone: 'warning' },
  publishing: { label: 'Publishing', tone: 'info' },
  published: { label: 'Published', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
  learned: { label: 'Learned', tone: 'success' },
}

export function StatusBadge({ status, children, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span className={`nx-status-badge ${className}`} data-tone={config.tone}>
      {children ?? config.label}
    </span>
  )
}

export const STATUS_BADGE_LABELS = Object.freeze(
  Object.fromEntries(
    Object.entries(statusConfig).map(([key, value]) => [key, value.label])
  ) as Record<StatusBadgeStatus, string>
)
