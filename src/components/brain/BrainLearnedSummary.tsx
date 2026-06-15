'use client'

/**
 * BrainLearnedSummary — Operator Foundation PR-1B
 *
 * ONE compact, honest dashboard line summarizing Brand Brain learning.
 * Read-only: derives counts from the same two existing GET routes used by the
 * Brand Brain timeline. No feed, no card stack. Links to the Brand Brain page.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { deriveBrainTimeline, summarizeLearning, type RawLearning } from '@/lib/brainTimeline'

type TFn = (key: string) => string

export default function BrainLearnedSummary() {
  const { authHeader } = useAuth()
  const { t, locale, dir } = useI18n()
  const tt = t as TFn

  const [pending, setPending] = useState<RawLearning[]>([])
  const [history, setHistory] = useState<RawLearning[]>([])
  const [loading, setLoading] = useState(true)

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
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [authHeader])

  useEffect(() => { load() }, [load])

  if (loading) return null

  const { appliedCount, pendingCount, mode } = summarizeLearning(deriveBrainTimeline(pending, history))
  const arrow = locale === 'ar' ? ' ←' : ' →'

  let text: string
  if (mode === 'empty') {
    text = tt('brain.timeline.dash.empty')
  } else if (mode === 'pendingOnly') {
    text = pendingCount === 1
      ? tt('brain.timeline.dash.pendingOnlyOne')
      : tt('brain.timeline.dash.pendingOnly').replace('{m}', String(pendingCount))
  } else {
    text = appliedCount === 1
      ? tt('brain.timeline.dash.learnedOne')
      : tt('brain.timeline.dash.learned').replace('{n}', String(appliedCount))
    if (pendingCount > 0) {
      text += pendingCount === 1
        ? tt('brain.timeline.dash.waitingOne')
        : tt('brain.timeline.dash.waiting').replace('{m}', String(pendingCount))
    }
  }

  return (
    <Link
      href="/brand"
      dir={dir}
      className="nx-card flex items-center gap-2 px-4 py-3 hover:border-[var(--nx-border-hi)] transition-colors"
    >
      <span className="text-sm shrink-0" aria-hidden>🧠</span>
      <span className="text-sm text-[var(--nx-text-2)]">
        {text}
        <span className="font-semibold text-accent whitespace-nowrap">{arrow}</span>
      </span>
    </Link>
  )
}
