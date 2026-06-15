'use client'

/**
 * PlatformReadinessPanel — Operator Foundation PR-1A (Platform State Honesty)
 *
 * Presentational only. Renders honest, plain-language platform readiness from
 * pre-derived PlatformState[] (see lib/platformReadiness.ts). No data fetching,
 * no network, no technical jargon shown to the user.
 *
 * One row per platform = one status + one short explanation + one next action.
 */

import type { PlatformState, ReadinessStatus, ReadinessAction } from '@/lib/platformReadiness'

type TFn = (key: string) => string

const CHIP_CLASS: Record<ReadinessStatus, string> = {
  ready: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  needs_setup: 'text-amber-700 bg-amber-50 border-amber-200',
  not_connected: 'text-[var(--nx-text-3)] bg-[var(--nx-elevated)] border-[var(--nx-border)]',
  permission_unverified: 'text-amber-700 bg-amber-50 border-amber-200',
  planning_only: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  not_available: 'text-[var(--nx-text-3)] bg-[var(--nx-elevated)] border-[var(--nx-border)]',
}

export interface PlatformReadinessPanelProps {
  states: PlatformState[]
  t: TFn
  /** routes an action to an existing flow on the host page; 'none' rows never call this */
  onAction?: (action: ReadinessAction) => void
}

export default function PlatformReadinessPanel({ states, t, onAction }: PlatformReadinessPanelProps) {
  return (
    <div className="nx-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--nx-text-1)]">{t('connections.readiness.title')}</h3>
        <p className="text-xs text-[var(--nx-text-3)] mt-0.5">{t('connections.readiness.subtitle')}</p>
      </div>

      <div className="divide-y divide-[var(--nx-border)]">
        {states.map((s) => (
          <div key={s.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--nx-text-1)]">{t(s.nameKey)}</p>
              <p className="text-xs text-[var(--nx-text-2)] leading-snug mt-0.5">{t(s.lineKey)}</p>
            </div>

            <span
              className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CHIP_CLASS[s.status]}`}
            >
              {t(s.chipKey)}
            </span>

            {s.action !== 'none' && s.actionKey ? (
              <button
                type="button"
                onClick={() => onAction?.(s.action)}
                className="flex-shrink-0 text-xs font-semibold text-accent hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                {t(s.actionKey)}
              </button>
            ) : (
              <span className="flex-shrink-0 w-px" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
