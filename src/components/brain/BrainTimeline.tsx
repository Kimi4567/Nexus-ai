'use client'

/**
 * BrainTimeline — Operator Foundation PR-1B ("What NEXUS Learned")
 *
 * Read-only, honest timeline of real Brand Brain learnings. Primary home: Brand Brain page.
 * Sources (existing GET routes only):
 *   - GET /api/brain/proposals?status=pending  → Suggested items (Accept / Dismiss)
 *   - GET /api/brain/score-history (.updates)  → Applied / Dismissed history
 * The ONLY write is the user-initiated Accept/Dismiss via existing PATCH /api/brain/proposals.
 *
 * No raw field keys, no proposed JSON, no trigger enums shown. Design System v3 only.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  deriveBrainTimeline,
  fieldLabel,
  type RawLearning,
  type TimelineItem,
  type TimelineStatus,
} from '@/lib/brainTimeline'

type TFn = (key: string) => string

const STATUS_CHIP: Record<TimelineStatus, string> = {
  suggested: 'bg-amber-50 text-amber-700 border border-amber-200',
  applied: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  dismissed: 'bg-[var(--nx-elevated)] text-[var(--nx-text-3)] border border-[var(--nx-border)]',
}

const INITIAL_VISIBLE = 10

export function BrainTimeline({ onUpdate }: { onUpdate?: () => void }) {
  const { authHeader } = useAuth()
  const { t, locale, dir } = useI18n()
  const tt = t as TFn
  const router = useRouter()

  const [pending, setPending] = useState<RawLearning[]>([])
  const [history, setHistory] = useState<RawLearning[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    try {
      const token = authHeader()
      if (!token) { setLoading(false); return }
      const [pRes, hRes] = await Promise.all([
        fetch('/api/brain/proposals?status=pending', { headers: { Authorization: token } }),
        fetch('/api/brain/score-history', { headers: { Authorization: token } }),
      ])
      if (pRes.ok) {
        const d = await pRes.json()
        setPending(Array.isArray(d.proposals) ? d.proposals : [])
      }
      if (hRes.ok) {
        const d = await hRes.json()
        setHistory(Array.isArray(d.updates) ? d.updates : [])
      }
    } catch { /* non-critical surface */ }
    finally { setLoading(false) }
  }, [authHeader])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'accept' | 'dismiss') => {
    setActing(id)
    try {
      const token = authHeader()
      if (!token) { setActing(null); return }
      const res = await fetch('/api/brain/proposals', {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: id, action }),
      })
      if (res.ok) {
        // reload from source so the item moves into Applied/Dismissed history honestly
        await load()
        onUpdate?.()
      }
    } catch { /* silent */ }
    finally { setActing(null) }
  }

  if (loading) return null

  const items = deriveBrainTimeline(pending, history)

  // ── Honest empty state ────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <section className="nx-card p-6" dir={dir}>
        <h3 className="text-sm font-bold text-[var(--nx-text-1)]">{tt('brain.timeline.title')}</h3>
        <p className="mt-2 text-sm text-[var(--nx-text-2)] leading-relaxed max-w-[60ch]">
          {tt('brain.timeline.emptyBody')}
        </p>
        <button
          onClick={() => router.push('/campaigns/new')}
          className="mt-4 text-sm font-semibold text-accent hover:opacity-80 transition-opacity"
        >
          {tt('brain.timeline.emptyCta')}
        </button>
      </section>
    )
  }

  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE)

  return (
    <section className="nx-card overflow-hidden" dir={dir}>
      <div className="px-5 py-4 border-b border-[var(--nx-border)]">
        <h3 className="text-sm font-bold text-[var(--nx-text-1)]">{tt('brain.timeline.title')}</h3>
        <p className="mt-0.5 text-xs text-[var(--nx-text-3)]">{tt('brain.timeline.subtitle')}</p>
      </div>

      <ul className="divide-y divide-[var(--nx-border)]">
        {visible.map((item) => (
          <Row
            key={item.id}
            item={item}
            tt={tt}
            locale={locale}
            acting={acting === item.id}
            onAccept={() => act(item.id, 'accept')}
            onDismiss={() => act(item.id, 'dismiss')}
            onViewCampaign={item.campaignId ? () => router.push(`/campaigns/${item.campaignId}`) : undefined}
          />
        ))}
      </ul>

      {items.length > INITIAL_VISIBLE && !showAll && (
        <div className="px-5 py-3 border-t border-[var(--nx-border)]">
          <button
            onClick={() => setShowAll(true)}
            className="text-xs font-semibold text-accent hover:opacity-80 transition-opacity"
          >
            {tt('brain.timeline.showMore')}
          </button>
        </div>
      )}
    </section>
  )
}

function Row({
  item, tt, locale, acting, onAccept, onDismiss, onViewCampaign,
}: {
  item: TimelineItem
  tt: TFn
  locale: string
  acting: boolean
  onAccept: () => void
  onDismiss: () => void
  onViewCampaign?: () => void
}) {
  const label = fieldLabel(item, locale)
  const title = `${tt('brain.timeline.learnedAbout')} ${label}`.trim()

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        {item.icon && (
          <span className="text-base leading-6 shrink-0" aria-hidden>{item.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-[var(--nx-text-1)]">{title}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CHIP[item.status]}`}>
              {tt(item.statusKey)}
            </span>
            {item.sourceKey && (
              <span className="text-[11px] text-[var(--nx-text-3)]">· {tt(item.sourceKey)}</span>
            )}
          </div>

          {item.reason && (
            <p className="mt-1.5 text-sm text-[var(--nx-text-2)] leading-relaxed">{item.reason}</p>
          )}

          {(item.canAccept || item.canViewCampaign) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.canAccept && (
                <>
                  <button
                    disabled={acting}
                    onClick={onAccept}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--nx-text-1)] text-[var(--nx-surface)] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {acting ? tt('brain.timeline.applying') : tt('brain.timeline.accept')}
                  </button>
                  <button
                    disabled={acting}
                    onClick={onDismiss}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--nx-border)] text-[var(--nx-text-2)] hover:border-[var(--nx-border-hi)] transition-colors disabled:opacity-50"
                  >
                    {tt('brain.timeline.dismiss')}
                  </button>
                </>
              )}
              {item.canViewCampaign && onViewCampaign && (
                <button
                  onClick={onViewCampaign}
                  className="text-xs font-semibold text-accent hover:opacity-80 transition-opacity"
                >
                  {tt('brain.timeline.viewCampaign')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export default BrainTimeline
