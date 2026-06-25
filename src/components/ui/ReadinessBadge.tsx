import type { ReactNode } from 'react'

export type ReadinessBadgeStatus =
  | 'ready'
  | 'needsSetup'
  | 'permissionNeeded'
  | 'planningOnly'
  | 'notAvailable'
  | 'locked'

interface ReadinessBadgeProps {
  status: ReadinessBadgeStatus
  children?: ReactNode
  className?: string
}

const readinessConfig: Record<ReadinessBadgeStatus, { label: string; tone?: string }> = {
  ready: { label: 'Ready', tone: 'success' },
  needsSetup: { label: 'Needs setup', tone: 'warning' },
  permissionNeeded: { label: 'Permission needed', tone: 'warning' },
  planningOnly: { label: 'Planning only', tone: 'info' },
  notAvailable: { label: 'Not available' },
  locked: { label: 'Locked' },
}

export function ReadinessBadge({ status, children, className = '' }: ReadinessBadgeProps) {
  const config = readinessConfig[status]

  return (
    <span className={`nx-status-badge ${className}`} data-tone={config.tone}>
      {children ?? config.label}
    </span>
  )
}

export const READINESS_BADGE_LABELS = Object.freeze(
  Object.fromEntries(
    Object.entries(readinessConfig).map(([key, value]) => [key, value.label])
  ) as Record<ReadinessBadgeStatus, string>
)
