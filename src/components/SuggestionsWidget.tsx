'use client'

/**
 * SuggestionsWidget
 *
 * Displays AgentSuggestion records on the dashboard.
 * Fetches from GET /api/suggestions.
 * Allows APPROVE / REJECT on PENDING items via PATCH /api/suggestions.
 * Self-contained — no props required except auth.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Sparkles, CheckCircle2, XCircle, ExternalLink,
  ChevronRight, Lightbulb, AlertTriangle,
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

const STATUS_STYLE: Record<SuggestionStatus, { bg: string; border: string; color: string }> = {
  PENDING:  { bg: 'rgba(255,184,0,0.08)',   border: 'rgba(255,184,0,0.25)',   color: '#FFB800' },
  APPROVED: { bg: 'rgba(0,191,166,0.08)',   border: 'rgba(0,191,166,0.25)',   color: '#00BFA6' },
  REJECTED: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',    color: '#EF4444' },
  EXECUTED: { bg: 'rgba(108,99,255,0.08)',  border: 'rgba(108,99,255,0.25)',  color: '#6C63FF' },
}

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
  /**
   * Increment this number to trigger a fresh data load from outside.
   * Useful after a Run Full Strategy completes to show new suggestions immediately.
   */
  refreshKey?: number
}

export default function SuggestionsWidget({ refreshKey = 0 }: SuggestionsWidgetProps) {
  const { authHeader } = useAuth()
  const { t, locale, dir } = useI18n()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [acting, setActing]           = useState<Record<string, 'approving' | 'rejecting'>>({})
  const [feedback, setFeedback]       = useState<Record<string, { brandBrainUpdated: boolean }>>({})

  const sg = t('suggestions') as Record<string, string>

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/suggestions?limit=6', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) throw new Error('Load failed')
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {
      setError(sg.errorLoad)
    } finally {
      setLoading(false)
    }
  }, [authHeader, sg.errorLoad])

  // Re-load when refreshKey changes (triggered externally after a strategy run)
  useEffect(() => { load() }, [load, refreshKey])

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
      // Optimistically update local state
      setSuggestions(prev =>
        prev.map(s => s.id === id ? { ...s, status } : s)
      )
      // Store Brand Brain feedback for APPROVE actions
      if (status === 'APPROVED') {
        setFeedback(prev => ({
          ...prev,
          [id]: { brandBrainUpdated: Boolean(data.brandBrainUpdated) },
        }))
      }
    } catch {
      // silently keep existing state — user can retry
    } finally {
      setActing(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }, [authHeader])

  // Glass card shared style
  const glassCard = {
    background: 'rgba(17,21,54,0.5)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(108,99,255,0.1)',
  }

  return (
    <div dir={dir} className="rounded-2xl p-5" style={glassCard}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-accent-purple" />
          <h3 className="font-bold text-sm text-white">{sg.sectionTitle}</h3>
          {suggestions.filter(s => s.status === 'PENDING').length > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,184,0,0.15)', color: '#FFB800', border: '1px solid rgba(255,184,0,0.3)' }}
            >
              {suggestions.filter(s => s.status === 'PENDING').length}
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
              style={{ background: 'rgba(108,99,255,0.04)', border: '1px solid rgba(108,99,255,0.08)' }}
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
            style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.12)' }}
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
            const st  = STATUS_STYLE[s.status]
            const pc  = PRIORITY_COLOR[s.priority] ?? PRIORITY_COLOR[2]
            const isActing = Boolean(acting[s.id])

            return (
              <div
                key={s.id}
                className="rounded-xl p-3 transition-all"
                style={{ background: st.bg, border: `1px solid ${st.border}` }}
              >
                {/* Row 1: priority dot + title + status badge */}
                <div className="flex items-start gap-2 mb-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: pc, boxShadow: `0 0 4px ${pc}` }}
                  />
                  <p className="text-sm font-semibold text-white flex-1 leading-snug">{s.title}</p>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                  >
                    {sg[`status${s.status[0]}${s.status.slice(1).toLowerCase()}`] ?? s.status}
                  </span>
                </div>

                {/* Row 2: reasoning (truncated) */}
                <p className="text-[11px] text-text-muted leading-relaxed mb-2 line-clamp-2">
                  {s.reasoning}
                </p>

                {/* Row 2b: approval feedback (shown after the user just approved this item) */}
                {s.status === 'APPROVED' && feedback[s.id] !== undefined && (
                  <p
                    className="text-[10px] font-semibold mb-2"
                    style={{ color: '#00BFA6' }}
                  >
                    ✓ {feedback[s.id].brandBrainUpdated ? sg.approvedBrandUpdated : sg.approvedOnly}
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
                      style={{ background: 'rgba(108,99,255,0.1)', color: '#a5a0ff' }}
                    >
                      {s.campaignName}
                    </span>
                  )}
                  {s.impact && (
                    <span className="text-[10px]" style={{ color: '#00BFA6' }}>
                      {s.impact}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted ms-auto">
                    {relativeTime(s.createdAt, locale)}
                  </span>
                </div>

                {/* Row 4: actions (PENDING only) */}
                {s.status === 'PENDING' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      disabled={isActing}
                      onClick={() => act(s.id, 'APPROVED')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                      style={{ background: 'rgba(0,191,166,0.12)', color: '#00BFA6', border: '1px solid rgba(0,191,166,0.25)' }}
                    >
                      {acting[s.id] === 'approving'
                        ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                        : <CheckCircle2 className="w-3 h-3" />
                      }
                      {sg.btnApprove}
                    </button>
                    <button
                      disabled={isActing}
                      onClick={() => act(s.id, 'REJECTED')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      {acting[s.id] === 'rejecting'
                        ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                        : <XCircle className="w-3 h-3" />
                      }
                      {sg.btnReject}
                    </button>
                    {s.campaignId && (
                      <Link
                        href={`/campaigns/${s.campaignId}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ms-auto"
                        style={{ background: 'rgba(108,99,255,0.1)', color: '#a5a0ff', border: '1px solid rgba(108,99,255,0.2)' }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {sg.btnViewCampaign}
                      </Link>
                    )}
                  </div>
                )}

                {/* Non-PENDING: show campaign link only */}
                {s.status !== 'PENDING' && s.campaignId && (
                  <div className="flex justify-end">
                    <Link
                      href={`/campaigns/${s.campaignId}`}
                      className="flex items-center gap-1 text-[10px] font-medium transition-all"
                      style={{ color: '#a5a0ff' }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {sg.btnViewCampaign}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
