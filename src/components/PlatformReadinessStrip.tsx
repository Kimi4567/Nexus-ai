'use client'

/**
 * PlatformReadinessStrip — Operator Foundation PR-1A (Platform State Honesty)
 *
 * Compact, read-only dashboard strip. One slim row of plain-language chips
 * (Facebook · Instagram · TikTok · LinkedIn · Paid) + a link to Connections.
 * Not a feature block, not a diagnostics panel. Presentational only.
 */

import Link from 'next/link'
import { summarizeForStrip, type PlatformState, type ReadinessStatus } from '@/lib/platformReadiness'

type TFn = (key: string) => string

const DOT_CLASS: Record<ReadinessStatus, string> = {
  ready: 'bg-emerald-500',
  needs_setup: 'bg-amber-500',
  not_connected: 'bg-[var(--nx-text-4,#9CA3AF)]',
  permission_unverified: 'bg-amber-500',
  planning_only: 'bg-indigo-500',
  not_available: 'bg-[var(--nx-text-4,#9CA3AF)]',
}

export interface PlatformReadinessStripProps {
  states: PlatformState[]
  t: TFn
}

export default function PlatformReadinessStrip({ states, t }: PlatformReadinessStripProps) {
  const items = summarizeForStrip(states)
  if (!items.length) return null

  return (
    <div className="nx-card px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--nx-text-3)]">
        {t('connections.readiness.stripTitle')}
      </span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 flex-1 min-w-0">
        {items.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-[var(--nx-text-2)] whitespace-nowrap">
            <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[s.status]}`} aria-hidden />
            <span className="font-medium text-[var(--nx-text-1)]">{t(s.nameKey)}</span>
            <span className="text-[var(--nx-text-3)]">{t(s.chipKey)}</span>
          </span>
        ))}
      </div>

      <Link
        href="/connections"
        className="text-xs font-semibold text-accent hover:opacity-80 transition-opacity whitespace-nowrap"
      >
        {t('connections.readiness.openConnections')}
      </Link>
    </div>
  )
}
