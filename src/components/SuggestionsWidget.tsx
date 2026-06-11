'use client'

/**
 * SuggestionsWidget
 *
 * Displays AgentSuggestion records on the dashboard.
 * Inbox model: only shows PENDING items. Cards disappear after approve/reject/dismiss.
 * Fetches from GET /api/suggestions (PENDING only by default).
 * Approve/Reject via PATCH /api/suggestions.
 * Dismiss via DELETE /api/suggestions?id=<id>.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Sparkles, XCircle, ExternalLink, CheckCircle2,
  ChevronRight, Lightbulb, AlertTriangle, X,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
type AgentType = 'STRATEGIST' | 'CONTENT_DIRECTOR' | 'CAMPAIGN_MANAGER' | 'REPORTING'

interface Suggestion {
  id: string
  agent: AgentType
  type: string
  status: SuggestionStatus
  priority: number
  title: string
  reasoning: string
  impact: string | null
  campaignId: string | null
  campaignName: string | null
  approvedAt: string | null
  rejectedAt: string | null
  executedAt: string | null
  expiresAt: string | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', // urgent
  2: '#FFB800', // normal
  3: '#64748b', // low
}

const AGENT_KEY: Record<AgentType, string> = {
  STRATEGIST:       'suggestions.agentStrategist',
  CONTENT_DIRECTOR: 'suggestions.agentContentDirector',
  CAMPAIGN_MANAGER: 'suggestions.agentCampaignManager',
  REPORTING:        'suggestions.agentReporting',
}

function relativeTime(dateStr: string, locale: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { numeric: 'auto' })
    const mins  = Math.round(diff / 60_000)
    const hours = Math.round(diff / 3_600_000)
    const days  = Math.round(diff / 86_400_000)
    if (mins  <  1) return locale === 'ar' ? 'الآن'    : 'just now'
    if (mins  < 60) return rtf.format(-mins,  'minute')
    if (hours < 24) return rtf.format(-hours, 'hour')
    return rtf.format(-days, 'day')
  } catch {
    return ''
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SuggestionsWidgetProps {
  refreshKey?: number
}

export default function SuggestionsWidget({ refreshKey = 0 }: SuggestionsWidgetProps) {
  const { authHeader } = useAuth()
  const { t, locale, dir } = useI18n()
  const router = useRouter()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  // exiting: set of IDs currently fading out
  const [exiting, setExiting]         = useState<Set<string>>(new Set())
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [acting, setActing]           = useState<Record<string, 'approving' | 'rejecting' | 'dismissing'>>({})
  const [feedback, setFeedback]       = useState<Record<string, { brandBrainUpdated: boolean; executionLabel?: string }>>({})

  const sg = t('suggestions') as Record<string, string>

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Only fetch PENDING — inbox model
      const res = await fetch('/api/suggestions?limit=6', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) throw new Error('Load failed')
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setExiting(new Set())
    } catch {
      setError(sg.errorLoad)
    } finally {
      setLoading(false)
    }
  }, [authHeader, sg.errorLoad])

  useEffect(() => { load() }, [load, refreshKey])

  /** Remove a card from view after a brief delay (for approve/reject visual feedback) */
  const removeAfterDelay = useCallback((id: string, delayMs = 800) => {
    setTimeout(() => {
      setExiting(prev => new Set(prev).add(id))
      setTimeout(() => {
        setSuggestions(prev => prev.filter(s => s.id !== id))
        setExiting(prev => { const n = new Set(prev); n.delete(id); return n })
      }, 300) // CSS transition duration
    }, delayMs)
  }, [])

  const act = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActing(prev => ({ ...prev, [id]: status === 'APPROVED' ? 'approving' : 'rejecting' }))
    try {
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error('Update failed')
      const data = await res.json()

      // Store Brand Brain feedback for APPROVE
      if (status === 'APPROVED') {
        setFeedback(prev => ({
          ...prev,
          [id]: {
            brandBrainUpdated: Boolean(data.brandBrainUpdated),
            executionLabel: typeof data.executionLabel === 'string' ? data.executionLabel : undefined,
          },
        }))
      }

      const nextHref = typeof data.nextHref === 'string' ? data.nextHref : null
      if (status === 'APPROVED' && nextHref) {
        setTimeout(() => router.push(nextHref), 650)
        removeAfterDelay(id, 1200)
      } else {
        // Remove card after brief visual feedback
        removeAfterDelay(id, 900)
      }
    } catch {
      // silently keep existing state — user can retry
    } finally {
      setActing(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }, [authHeader, removeAfterDelay, router])

  const dismiss = useCallback(async (id: string) => {
    setActing(prev => ({ ...prev, [id]: 'dismissing' }))
    try {
      await fetch(`/api/suggestions?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() },
      })
    } catch {
      // best-effort; remove from UI regardless
    } finally {
      setActing(prev => { const n = { ...prev }; delete n[id]; return n })
      removeAfterDelay(id, 0)
    }
  }, [authHeader, removeAfterDelay])

  const glassCard = {
    background: 'rgba(12,13,36,0.6)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(139,92,246,0.1)',
  }

  return (
    <div dir={dir} className="rounded-2xl p-5" style={glassCard}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-accent-purple" />
          <h3 className="font-bold text-sm text-white">{sg.sectionTitle}</h3>
          {suggestions.length > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}
            >
              {suggestions.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="text-[10px] text-text-muted hover:text-text-secondary transition flex items-center gap-0.5"
        >
          {sg.refresh} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)' }}
            />
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex items-center gap-2 py-4 px-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && suggestions.length === 0 && (
        <div className="text-center py-8">
          <div
            className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}
          >
            <Sparkles className="w-5 h-5 text-accent-purple/40" />
          </div>
          <p className="text-sm font-medium text-text-secondary mb-1">{sg.emptyTitle}</p>
          <p className="text-xs text-text-muted max-w-[220px] mx-auto leading-relaxed">{sg.emptyDesc}</p>
        </div>
      )}

      {/* ── Suggestion list ── */}
      {!loading && !error && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map(s => {
            const pc       = PRIORITY_COLOR[s.priority] ?? PRIORITY_COLOR[2]
            const isActing = Boolean(acting[s.id])
            const isExiting = exiting.has(s.id)
            const justActed = feedback[s.id] !== undefined

            return (
              <div
                key={s.id}
                className="rounded-xl p-3 transition-all duration-300"
                style={{
                  background: justActed
                    ? 'rgba(16,185,129,0.06)'
                    : 'rgba(255,184,0,0.06)',
                  border: justActed
                    ? '1px solid rgba(16,185,129,0.2)'
                    : '1px solid rgba(255,184,0,0.18)',
                  opacity: isExiting ? 0 : 1,
                  transform: isExiting ? 'translateY(-4px) scale(0.98)' : 'none',
                  pointerEvents: isExiting ? 'none' : 'auto',
                  overflow: 'hidden',
                  maxHeight: isExiting ? '0px' : '300px',
                }}
              >
                {/* Row 1: priority dot + title + dismiss × */}
                <div className="flex items-start gap-2 mb-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: pc, boxShadow: `0 0 4px ${pc}` }}
                  />
                  <p className="text-sm font-semibold text-white flex-1 leading-snug">{s.title}</p>
                  {/* Dismiss × button */}
                  <button
                    onClick={() => dismiss(s.id)}
                    disabled={isActing}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-40 hover:opacity-100 transition-opacity disabled:opacity-20"
                    title={sg.btnDismiss}
                    style={{ color: '#94a3b8' }}
                  >
                    {acting[s.id] === 'dismissing'
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      : <X className="w-3 h-3" />
                    }
                  </button>
                </div>

                {/* Row 2: reasoning (truncated) */}
                <p className="text-[11px] text-text-muted leading-relaxed mb-2 line-clamp-2">
                  {s.reasoning}
                </p>

                {/* Approval feedback */}
                {justActed && (
                  <p className="text-[10px] font-semibold mb-2" style={{ color: '#10B981' }}>
                    ✓ {feedback[s.id].executionLabel
                      ? feedback[s.id].executionLabel
                      : feedback[s.id].brandBrainUpdated
                      ? sg.approvedBrandUpdated
                      : sg.approvedOnly}
                  </p>
                )}

                {/* Row 3: meta (agent + campaign + impact + date) */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5">
                  {s.agent && (
                    <span className="text-[10px] text-text-muted">
                      {t(AGENT_KEY[s.agent] ?? 'suggestions.agentStrategist') as string}
                    </span>
                  )}
                  {s.campaignName && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a5a0ff' }}
                    >
                      {s.campaignName}
                    </span>
                  )}
                  {s.impact && (
                    <span className="text-[10px]" style={{ color: '#10B981' }}>
                      {s.impact}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted ms-auto">
                    {relativeTime(s.createdAt, locale)}
                  </span>
                </div>

                {/* Row 4: primary action = open campaign, secondary = dismiss */}
                <div className="flex items-center gap-2 flex-wrap">
                  {s.campaignId && (
                    <Link
                      href={`/campaigns/${s.campaignId}`}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#a5a0ff', border: '1px solid rgba(139,92,246,0.3)' }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {sg.btnViewCampaign}
                    </Link>
                  )}
                  <button
                    disabled={isActing}
                    onClick={() => act(s.id, 'APPROVED')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    {acting[s.id] === 'approving'
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      : <CheckCircle2 className="w-3 h-3" />
                    }
                    {locale === 'ar' ? 'موافقة ومتابعة' : 'Approve & Continue'}
                  </button>
                  <button
                    disabled={isActing}
                    onClick={() => act(s.id, 'REJECTED')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50 ms-auto"
                    style={{ background: 'rgba(239,68,68,0.06)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    {acting[s.id] === 'rejecting'
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      : <XCircle className="w-3 h-3" />
                    }
                    {sg.btnReject}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
