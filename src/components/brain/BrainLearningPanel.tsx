'use client'

/**
 * BrainLearningPanel
 *
 * Shows pending Brand Brain proposals so the user can accept or dismiss them.
 * Displayed on the dashboard and Brand Brain page whenever there are new learnings.
 *
 * Each proposal shows:
 * - The field being updated (e.g. "Winning Hooks")
 * - What NEXUS wants to add
 * - Why it's suggesting this
 * - Accept / Dismiss buttons
 */

import { useState, useEffect, useCallback } from 'react'

interface Proposal {
  id: string
  field: string
  displayName: string
  icon: string | null
  trigger: string
  current: unknown
  proposed: unknown
  reason: string
  status: string
  createdAt: string
}

interface BrainLearningPanelProps {
  /** If provided, only show proposals triggered from this campaign */
  campaignId?: string
  /** Compact mode for dashboard widget (fewer proposals shown) */
  compact?: boolean
  /** Called after any accept/dismiss action so parent can refresh */
  onUpdate?: () => void
}

export function BrainLearningPanel({ campaignId, compact = false, onUpdate }: BrainLearningPanelProps) {
  const [proposals, setProposals]   = useState<Proposal[]>([])
  const [loading, setLoading]       = useState(true)
  const [acting, setActing]         = useState<string | null>(null) // proposalId being acted on

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/proposals?status=pending', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return
      const data = await res.json()
      let list: Proposal[] = Array.isArray(data.proposals) ? data.proposals : []
      if (campaignId) list = list.filter(p => (p as any).campaignId === campaignId)
      if (compact) list = list.slice(0, 3)
      setProposals(list)
    } catch {
      // silently fail — widget is non-critical
    } finally {
      setLoading(false)
    }
  }, [campaignId, compact])

  useEffect(() => { load() }, [load])

  const act = async (proposalId: string, action: 'accept' | 'dismiss') => {
    setActing(proposalId)
    try {
      const res = await fetch('/api/brain/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, action }),
      })
      if (res.ok) {
        setProposals(prev => prev.filter(p => p.id !== proposalId))
        onUpdate?.()
      }
    } catch { /* silently fail */ }
    finally { setActing(null) }
  }

  if (loading) return null
  if (proposals.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--nx-border)] bg-[var(--nx-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--nx-border)] bg-[var(--nx-bg)]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400">
          🧠
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--nx-text)]">
            NEXUS learned {proposals.length} thing{proposals.length !== 1 ? 's' : ''} about your brand
          </p>
          <p className="text-xs text-[var(--nx-muted)] mt-0.5">
            Review and accept to update your Brand Brain
          </p>
        </div>
      </div>

      {/* Proposal cards */}
      <div className="divide-y divide-[var(--nx-border)]">
        {proposals.map(proposal => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            acting={acting === proposal.id}
            onAccept={() => act(proposal.id, 'accept')}
            onDismiss={() => act(proposal.id, 'dismiss')}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Proposal Card ─────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  acting,
  onAccept,
  onDismiss,
}: {
  proposal: Proposal
  acting: boolean
  onAccept: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Format the proposed value for display
  const proposedDisplay = Array.isArray(proposal.proposed)
    ? (proposal.proposed as string[]).slice(0, 3).map((v, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs border border-violet-500/20 mr-1 mb-1">
          {v}
        </span>
      ))
    : (
      <span className="text-sm text-[var(--nx-text)]">{String(proposal.proposed).slice(0, 200)}</span>
    )

  const proposedCount = Array.isArray(proposal.proposed) ? proposal.proposed.length : 1

  return (
    <div className="p-4">
      {/* Field label */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{proposal.icon || '🔹'}</span>
        <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
          {proposal.displayName}
        </span>
        <span className="ml-auto text-xs text-[var(--nx-muted)]">
          +{proposedCount} new
        </span>
      </div>

      {/* Proposed values */}
      <div className="mb-2 flex flex-wrap">
        {proposedDisplay}
      </div>

      {/* Reason (collapsible) */}
      <button
        className="text-xs text-[var(--nx-muted)] hover:text-[var(--nx-text)] transition-colors mb-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? '▲ Less' : '▼ Why?'}
      </button>
      {expanded && (
        <p className="text-xs text-[var(--nx-muted)] bg-[var(--nx-bg)] rounded-lg px-3 py-2 mb-3 border border-[var(--nx-border)]">
          {proposal.reason}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          disabled={acting}
          onClick={onAccept}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50"
        >
          {acting ? 'Applying…' : '✓ Accept'}
        </button>
        <button
          disabled={acting}
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--nx-border)] text-[var(--nx-muted)] hover:text-[var(--nx-text)] hover:border-[var(--nx-text)]/30 transition-colors disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
