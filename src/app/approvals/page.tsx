'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { ApprovalDecisionCard } from '@/components/approvals/ApprovalDecisionCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { ExecutionQueueItem } from '@/lib/executionTruth'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface BrainProposal {
  id: string
  field?: string | null
  displayName?: string | null
  reason?: string | null
  trigger?: string | null
  traceability?: 'analytics_evidence' | 'campaign_record' | 'external_sources' | 'source_not_attached' | 'internal_signal'
  sourceRefs?: Array<{ url: string; title?: string; publisher?: string }>
  canAccept?: boolean
  evidence?: {
    platform?: string
    period?: { start?: string; end?: string }
    sample?: { eligiblePosts?: number; aboveThresholdPosts?: number; evidencePostIds?: string[] }
    comparison?: { baselineEngagementRate?: number; candidateThresholdEngagementRate?: number }
    confidence?: { level?: string; rationale?: string }
    causalClaim?: boolean
    rollback?: { strategy?: string }
  } | null
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

interface AgentSuggestion {
  id: string
  title: string
  reasoning: string
  impact?: string | null
  type: string
  status: string
  priority?: number
  campaignId?: string | null
  payload?: {
    source?: string
    href?: string
    titleAr?: string
    reasoningAr?: string
    evidence?: unknown[]
    items?: Array<{ url?: string; title?: string; source?: string }>
    safety?: string
    campaignId?: string
  } | null
  createdAt?: string | null
  updatedAt?: string | null
}

function isExecutionMonitorNavigation(suggestion: AgentSuggestion): boolean {
  return suggestion.payload?.source === 'execution-monitor'
}

function liveApprovalMeta(action: ExecutionQueueItem, ar: boolean): string {
  if (action.kind === 'REVIEW_MEDIA') {
    const missing = action.evidence.posts.approvedMissingMedia ?? 0
    return ar
      ? `${action.campaignName} · ${missing} منشورًا بلا اعتماد وسائط نهائي`
      : `${action.campaignName} · ${missing} posts missing final media approval`
  }
  return ar
    ? `${executionStageLabel(action.stage, true)} · ${action.campaignName} · ${action.evidence.strategyEvidenceCount} أدلة استراتيجية`
    : `${executionStageLabel(action.stage, false)} · ${action.campaignName} · ${action.evidence.strategyEvidenceCount} strategy evidence items`
}

interface ContentDecisionEvent {
  id: string
  postId: string
  campaignId?: string | null
  campaignName: string
  platform?: string | null
  caption: string
  fromStatus?: string | null
  toStatus: string
  currentStatus?: string | null
  actor: string
  approvedAt?: string | null
  snapshotVersion?: number | null
  snapshotScope?: string | null
  snapshotHash?: string | null
  createdAt: string
}

function proposalLabel(proposal: BrainProposal, ar: boolean): string {
  const labels: Record<string, [string, string]> = {
    winningHooks: ['إشارات الخطافات', 'Hook signals'],
    winningAngles: ['إشارات زوايا المحتوى', 'Content angle signals'],
    toneKeywords: ['نبرة العلامة', 'Brand tone'],
    audiencePainPoints: ['مشكلات الجمهور', 'Audience pain points'],
    audienceDesires: ['رغبات الجمهور', 'Audience desires'],
    uniqueAdvantages: ['المزايا الفريدة', 'Unique advantages'],
    strategicNotes: ['ملاحظات استراتيجية', 'Strategic notes'],
  }
  return labels[proposal.field || '']?.[ar ? 0 : 1]
    || proposal.displayName
    || (ar ? 'إشارة Brand Brain' : 'Brand Brain signal')
}

function contentDecisionStatusLabel(status: string | null | undefined, ar: boolean): string {
  const labels: Record<string, [string, string]> = {
    NEW: ['جديد', 'New'],
    DRAFT: ['مسودة', 'Draft'],
    APPROVED: ['معتمد', 'Approved'],
    SCHEDULED: ['مجدول', 'Scheduled'],
    PROCESSING: ['قيد النشر', 'Processing'],
    PUBLISHED: ['منشور', 'Published'],
    FAILED: ['فشل', 'Failed'],
  }
  const key = String(status || 'NEW').toUpperCase()
  return labels[key]?.[ar ? 0 : 1] ?? key
}

function decisionActorLabel(actor: string, ar: boolean): string {
  const key = actor.toUpperCase()
  if (key === 'USER') return ar ? 'المستخدم' : 'User'
  if (key === 'SYSTEM') return ar ? 'النظام' : 'System'
  if (key === 'CRON') return ar ? 'المراقب الآلي' : 'Automated monitor'
  return actor
}

function executionStageLabel(stage: ExecutionQueueItem['stage'], ar: boolean): string {
  const labels: Record<ExecutionQueueItem['stage'], [string, string]> = {
    ARCHIVED: ['مؤرشفة', 'Archived'],
    PAUSED: ['متوقفة', 'Paused'],
    STRATEGY_REQUIRED: ['إنشاء الاستراتيجية', 'Strategy required'],
    STRATEGY_REVIEW: ['مراجعة الاستراتيجية', 'Strategy review'],
    CONTENT_PLANNING: ['تخطيط المحتوى', 'Content planning'],
    CONTENT_REVIEW: ['مراجعة المحتوى', 'Content review'],
    MEDIA_REVIEW: ['مراجعة الوسائط', 'Media review'],
    SCHEDULING: ['قرار الجدولة', 'Scheduling'],
    IN_FLIGHT: ['قيد التنفيذ', 'In flight'],
    LEARNING: ['جمع الأدلة', 'Evidence collection'],
    OPTIMIZING: ['مراجعة النتائج', 'Results review'],
    NEEDS_ATTENTION: ['يحتاج تدخلاً', 'Needs attention'],
  }
  return labels[stage][ar ? 0 : 1]
}

export default function ApprovalsPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const copy = useCallback((arabic: string, english: string) => (ar ? arabic : english), [ar])
  const [proposals, setProposals] = useState<BrainProposal[]>([])
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([])
  const [liveApprovalActions, setLiveApprovalActions] = useState<ExecutionQueueItem[]>([])
  const [proposalHistory, setProposalHistory] = useState<BrainProposal[]>([])
  const [suggestionHistory, setSuggestionHistory] = useState<AgentSuggestion[]>([])
  const [contentDecisionHistory, setContentDecisionHistory] = useState<ContentDecisionEvent[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const [brandTruthBlocked, setBrandTruthBlocked] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    let cancelled = false

    async function loadDecisionQueue() {
      setDataLoading(true)
      try {
        const [inboxRes, proposalHistoryRes, suggestionHistoryRes, brandRes, contentLedgerRes] = await Promise.all([
          fetch('/api/approvals/inbox', { headers: { Authorization: token }, cache: 'no-store' }),
          fetch('/api/brain/proposals?status=all', { headers: { Authorization: token } }),
          fetch('/api/agents/suggestions?status=all&limit=100', { headers: { Authorization: token } }),
          fetch('/api/brand', { headers: { Authorization: token } }),
          fetch('/api/approvals/content-ledger', { headers: { Authorization: token } }),
        ])
        if (cancelled) return
        const [inboxData, proposalHistoryData, suggestionHistoryData, brandData, contentLedgerData] = await Promise.all([
          inboxRes.json().catch(() => ({})),
          proposalHistoryRes.json().catch(() => ({})),
          suggestionHistoryRes.json().catch(() => ({})),
          brandRes.json().catch(() => ({})),
          contentLedgerRes.json().catch(() => ({})),
        ])
        if (!inboxRes.ok || !inboxData?.inbox) {
          throw new Error(inboxData?.error || copy('تعذر تحميل مصدر الموافقات الموحد.', 'Could not load the canonical approval inbox.'))
        }
        const inbox = inboxData.inbox
        setBrandTruthBlocked(!brandData?.brandProfile || reviewBrandTruthConsistency(brandData.brandProfile).status === 'blocked')
        setProposals(Array.isArray(inbox.proposals) ? inbox.proposals : [])
        setSuggestions(Array.isArray(inbox.suggestions) ? inbox.suggestions : [])
        setProposalHistory(Array.isArray(proposalHistoryData.proposals)
          ? proposalHistoryData.proposals.filter((item: BrainProposal) => item.status !== 'pending')
          : [])
        setSuggestionHistory(Array.isArray(suggestionHistoryData.suggestions)
          ? suggestionHistoryData.suggestions.filter((item: AgentSuggestion) => item.status !== 'PENDING')
          : [])
        setContentDecisionHistory(Array.isArray(contentLedgerData.events) ? contentLedgerData.events : [])
        setLiveApprovalActions(Array.isArray(inbox.liveApprovalActions) ? inbox.liveApprovalActions : [])
        setLastLoadedAt(new Date())
      } catch {
        if (!cancelled) setNotice({ tone: 'error', text: copy('تعذر تحميل قائمة القرارات.', 'Could not load the decision queue.') })
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }

    loadDecisionQueue()
    return () => { cancelled = true }
  }, [authHeader, copy, isAuthenticated, refreshKey])

  const blockedCount = useMemo(
    () => proposals.filter(proposal => proposal.traceability === 'source_not_attached' || proposal.canAccept === false).length,
    [proposals],
  )
  const pendingTotal = suggestions.length + liveApprovalActions.length + proposals.length
  const historyRows = useMemo(() => [
    ...proposalHistory.map(item => ({
      id: `brain-${item.id}`,
      label: proposalLabel(item, ar),
      status: item.status || 'reviewed',
      at: item.updatedAt || item.createdAt || '',
      kind: copy('Brand Brain', 'Brand Brain'),
      evidence: null as string | null,
    })),
    ...suggestionHistory.map(item => ({
      id: `agent-${item.id}`,
      label: ar ? item.payload?.titleAr || item.title : item.title,
      status: isExecutionMonitorNavigation(item)
        ? copy('تم فتح الخطوة', 'Guided step opened')
        : item.status,
      at: item.updatedAt || item.createdAt || '',
      kind: isExecutionMonitorNavigation(item)
        ? copy('سجل تنقل إرشادي', 'Guided navigation record')
        : copy('قرار تشغيلي', 'Operational decision'),
      evidence: null as string | null,
    })),
    ...contentDecisionHistory.map(item => ({
      id: `content-${item.id}`,
      label: item.snapshotScope === 'CONTENT_MEDIA_APPROVAL'
        ? `${item.campaignName} · ${item.platform || copy('قناة غير محددة', 'Channel not set')} · ${copy('تم اعتماد الوسائط النهائية', 'Final media approved')}`
        : `${item.campaignName} · ${item.platform || copy('قناة غير محددة', 'Channel not set')} · ${contentDecisionStatusLabel(item.fromStatus, ar)} → ${contentDecisionStatusLabel(item.toStatus, ar)}`,
      status: decisionActorLabel(item.actor, ar),
      at: item.createdAt,
      kind: item.snapshotScope === 'CONTENT_MEDIA_APPROVAL'
        ? copy('اعتماد وسائط', 'Media approval')
        : item.toStatus === 'APPROVED'
        ? copy('اعتماد محتوى', 'Content approval')
        : copy('انتقال تنفيذ المحتوى', 'Content execution transition'),
      evidence: item.snapshotVersion
        ? `v${item.snapshotVersion} · ${item.snapshotScope || 'DECISION'} · ${item.snapshotHash?.slice(0, 8) || copy('بصمة محفوظة', 'saved hash')}`
        : copy('سجل قديم بلا Snapshot — يلزم إعادة المراجعة قبل التنفيذ', 'Legacy record without a snapshot — re-review before execution'),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20), [ar, contentDecisionHistory, copy, proposalHistory, suggestionHistory])

  async function decideBrain(proposalId: string, action: 'accept' | 'dismiss') {
    const token = authHeader()
    if (!token) return
    const key = `brain:${proposalId}:${action}`
    setBusyKey(key)
    setNotice(null)
    try {
      const res = await fetch('/api/brain/proposals', {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || copy('تعذر حفظ القرار.', 'Could not save the decision.'))
      setNotice({
        tone: 'success',
        text: action === 'accept'
          ? copy('تم تطبيق الإشارة وتسجيل القرار.', 'Signal applied and decision recorded.')
          : copy('تم رفض الإشارة وتسجيل القرار.', 'Signal dismissed and decision recorded.'),
      })
      setRefreshKey(value => value + 1)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر حفظ القرار.', 'Could not save the decision.') })
    } finally {
      setBusyKey(null)
    }
  }

  async function dismissBlocked() {
    const token = authHeader()
    if (!token) return
    setBusyKey('brain:dismiss-blocked')
    setNotice(null)
    try {
      const res = await fetch('/api/brain/proposals', {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss_blocked' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || copy('تعذر تنظيف الطلبات المحجوبة.', 'Could not clear blocked requests.'))
      setNotice({ tone: 'success', text: copy(`تم رفض ${data.count || 0} إشارة محجوبة وتسجيلها.`, `${data.count || 0} blocked signals were dismissed and recorded.`) })
      setRefreshKey(value => value + 1)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر تنظيف الطلبات المحجوبة.', 'Could not clear blocked requests.') })
    } finally {
      setBusyKey(null)
    }
  }

  async function decideSuggestion(suggestionId: string, action: 'approve' | 'reject') {
    const token = authHeader()
    if (!token) return
    const key = `suggestion:${suggestionId}:${action}`
    setBusyKey(key)
    setNotice(null)
    try {
      const res = await fetch(`/api/agents/suggestions/${suggestionId}`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || copy('تعذر حفظ القرار التشغيلي.', 'Could not save the operational decision.'))
      setNotice({ tone: 'success', text: action === 'approve' ? copy('تم اعتماد القرار وتسجيله.', 'Decision approved and recorded.') : copy('تم رفض القرار وتسجيله.', 'Decision rejected and recorded.') })
      setRefreshKey(value => value + 1)
      if (action === 'approve' && typeof data.nextHref === 'string') router.push(data.nextHref)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر حفظ القرار التشغيلي.', 'Could not save the operational decision.') })
    } finally {
      setBusyKey(null)
    }
  }

  if (loading || !isAuthenticated) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center bg-[#f6f8fc]"><Loader2 className="h-8 w-8 animate-spin text-[#5366f6]" /></div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            pageTitle={copy('الموافقات', 'Approvals')}
            pageSubtitle={copy('راجع فقط القرارات التي تحتاج تأكيدك.', 'Review only the decisions that need your confirmation.')}
            primaryHref="/operations"
            primaryLabel={copy('عرض الأتمتة', 'View automation')}
            secondaryHref="/content-hub"
            secondaryLabel={copy('مراجعة المحتوى', 'Review content')}
          />

          <section className="nx-os-action-strip">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><ShieldCheck size={17} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">
                  {dataLoading
                    ? copy('جارٍ تحديث مصدر الموافقات الموحد…', 'Refreshing the canonical approval queue…')
                    : pendingTotal > 0
                    ? copy(`${pendingTotal} قرار بانتظار المراجعة`, `${pendingTotal} decisions need review`)
                    : copy('لا توجد قرارات معلقة', 'Nothing is waiting for review')}
                </p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">
                  {dataLoading
                    ? copy('لن نعرض حالة فارغة قبل اكتمال قراءة القرارات الحية والسجل.', 'No empty state is shown until live decisions and history finish loading.')
                    : lastLoadedAt
                      ? copy(
                          `آخر تحقق ${lastLoadedAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} · لن ينفذ NEXUS أي قرار من دون موافقتك.`,
                          `Verified ${lastLoadedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · NEXUS will not execute a decision without your approval.`,
                        )
                      : copy('لن ينفذ NEXUS أي قرار من دون موافقتك.', 'NEXUS will not execute a decision without your approval.')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {blockedCount > 0 && (
                <button type="button" onClick={dismissBlocked} disabled={busyKey !== null} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 disabled:opacity-50">
                  {busyKey === 'brain:dismiss-blocked' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                  {copy(`ارفض ${blockedCount} إشارة محجوبة`, `Dismiss ${blockedCount} blocked`)}
                </button>
              )}
              <button type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={dataLoading} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#d7def0] bg-white px-4 text-sm font-black text-[#111b3f] disabled:opacity-50">
                <RefreshCw size={16} className={dataLoading ? 'animate-spin' : ''} />
                {copy('تحديث', 'Refresh')}
              </button>
            </div>
          </section>

          {notice && (
            <div className={`rounded-[16px] border px-4 py-3 text-[12px] font-bold ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {notice.text}
            </div>
          )}

          {brandTruthBlocked && (
            <section className="rounded-[18px] border border-orange-200 bg-orange-50 px-4 py-4 text-orange-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-black">{copy('القرارات المشتقة محجوبة حتى تصحيح Brand Brain', 'Derived decisions are blocked until Brand Brain is corrected')}</p>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-orange-800">
                    {copy('المجال المحفوظ لا يطابق وصف النشاط. السجلات القديمة للمرجعية فقط؛ لا يمكن اعتمادها أو تشغيلها، ولن يخصم هذا الإيقاف أي كريديت.', 'The saved industry conflicts with the business description. Older records are reference-only; they cannot be approved or executed, and this block spends no credits.')}
                  </p>
                </div>
                <Link href="/brand" className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-orange-700 px-4 text-[11px] font-black text-white">
                  {copy('تصحيح Brand Brain', 'Fix Brand Brain')}<ArrowUpRight size={14} />
                </Link>
              </div>
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="nx-os-card p-5">
              <div className="mb-5">
                <h2 className="text-xl font-black text-[#071236]">{copy('قرارات التشغيل', 'Operational decisions')}</h2>
                <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">{copy('مشتقة من حالة العمل الحالية؛ تُخفى الاقتراحات التي تجاوزتها الحالة.', 'Derived from current workflow state; superseded suggestions are hidden.')}</p>
              </div>
              <div className="space-y-3">
                {dataLoading ? <div className="h-32 animate-pulse rounded-[20px] bg-[#edf1f8]" /> : suggestions.length === 0 && liveApprovalActions.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[#d7def0] p-6 text-center text-[12px] font-semibold text-[#7b87a3]">{copy('لا توجد قرارات تشغيلية معلقة.', 'No operational decisions are pending.')}</div>
                ) : <>
                  {liveApprovalActions.map(action => (
                    <ApprovalDecisionCard
                      key={`live-${action.id}`}
                      title={ar ? action.title.ar : action.title.en}
                      reason={ar ? action.reason.ar : action.reason.en}
                      badge={copy('حالة حية', 'Live state')}
                      badgeTone="amber"
                      meta={liveApprovalMeta(action, ar)}
                      actions={(
                        <Link href={action.href} className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#071236] px-3 text-[11px] font-black text-white">
                          {copy('افتح المراجعة المحمية', 'Open guarded review')}<ArrowUpRight size={14} />
                        </Link>
                      )}
                    >
                      <p className="text-[11px] font-semibold text-[#7b87a3]">
                        {copy('مستمد مباشرة من حالة الحملة الحالية؛ لا يُنفذ أي إجراء من هذه البطاقة.', 'Derived directly from current campaign state; this card executes nothing by itself.')}
                      </p>
                    </ApprovalDecisionCard>
                  ))}
                  {suggestions.map(suggestion => {
                  const blockedByBrandTruth = brandTruthBlocked && suggestion.type !== 'CAMPAIGN_PAUSE'
                  const title = blockedByBrandTruth
                    ? copy('قرار سابق محجوب حتى تصحيح مصدر الحقيقة', 'Previous decision blocked until the source of truth is fixed')
                    : ar ? suggestion.payload?.titleAr || suggestion.title : suggestion.title
                  const reason = blockedByBrandTruth
                    ? copy('بُني هذا السجل على سياق علامة متعارض. احتفظ به كمرجع أو ارفضه؛ لا يمكن اعتماده أو تشغيله.', 'This record was derived from contradictory brand context. Keep it as reference or reject it; it cannot be approved or executed.')
                    : ar ? suggestion.payload?.reasoningAr || suggestion.reasoning : suggestion.reasoning
                  const evidenceCount = Array.isArray(suggestion.payload?.evidence) ? suggestion.payload.evidence.length : 0
                  const sourceItems = Array.isArray(suggestion.payload?.items)
                    ? suggestion.payload.items.filter(item => typeof item.url === 'string' && item.url)
                    : []
                  return (
                    <ApprovalDecisionCard key={suggestion.id} title={title} reason={reason} badge={blockedByBrandTruth ? copy('محجوب', 'Blocked') : suggestion.priority === 1 ? copy('عاجل', 'Urgent') : copy('مراجعة', 'Review')} badgeTone={blockedByBrandTruth || suggestion.priority === 1 ? 'amber' : 'violet'} meta={`${suggestion.type} · ${sourceItems.length || evidenceCount} ${copy('أدلة', 'evidence items')}`} actions={(
                      <>
                        <button type="button" disabled={busyKey !== null} onClick={() => decideSuggestion(suggestion.id, 'reject')} className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-rose-200 bg-white px-3 text-[11px] font-black text-rose-600 disabled:opacity-50"><XCircle size={14} />{copy('رفض', 'Reject')}</button>
                        {blockedByBrandTruth ? (
                          <Link href="/brand" className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-orange-700 px-3 text-[11px] font-black text-white"><ArrowUpRight size={14} />{copy('تصحيح Brand Brain', 'Fix Brand Brain')}</Link>
                        ) : (
                          <button type="button" disabled={busyKey !== null} onClick={() => decideSuggestion(suggestion.id, 'approve')} className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#071236] px-3 text-[11px] font-black text-white disabled:opacity-50">{busyKey === `suggestion:${suggestion.id}:approve` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{suggestion.payload?.href ? copy('اعتمد وافتح الخطوة', 'Approve and open step') : copy('اعتماد', 'Approve')}</button>
                        )}
                      </>
                    )}>
                      {sourceItems.length > 0 && <div className="flex flex-wrap gap-2">{sourceItems.slice(0, 4).map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#dbe2f0] bg-white px-2 py-1 text-[10px] font-black text-[#5366f6]"><ExternalLink size={11} />{source.source || source.title || copy(`المصدر ${index + 1}`, `Source ${index + 1}`)}</a>)}</div>}
                    </ApprovalDecisionCard>
                  )
                  })}
                </>}
              </div>
            </div>

            <div className="nx-os-card p-5">
              <div className="mb-5">
                <h2 className="text-xl font-black text-[#071236]">{copy('تحديثات Brand Brain', 'Brand Brain updates')}</h2>
                <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">{copy('لا يُطبق أي اقتراح قبل قرارك.', 'No proposal is applied before your decision.')}</p>
              </div>
              <div className="space-y-3">
                {dataLoading ? <div className="h-32 animate-pulse rounded-[20px] bg-[#edf1f8]" /> : proposals.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[#d7def0] p-6 text-center text-[12px] font-semibold text-[#7b87a3]">{copy('لا توجد تحديثات Brand Brain معلقة.', 'No Brand Brain updates are pending.')}</div>
                ) : proposals.map(proposal => {
                  const blocked = proposal.canAccept === false || proposal.traceability === 'source_not_attached'
                  const analyticsEvidence = proposal.traceability === 'analytics_evidence' ? proposal.evidence : null
                  const blockedReason = proposal.traceability === 'analytics_evidence'
                    ? copy('لا يمكن تطبيق التعلم لأن عقد دليل الأداء المنظم مفقود أو غير صالح.', 'This learning cannot be applied because its structured performance-evidence contract is missing or invalid.')
                    : copy('لا يمكن تطبيق الادعاء الخارجي لأن رابط المصدر غير مرفق.', 'This external claim cannot be applied because no source URL is attached.')
                  return (
                    <ApprovalDecisionCard key={proposal.id} title={proposalLabel(proposal, ar)} reason={blocked ? blockedReason : proposal.reason || copy('إشارة محفوظة للمراجعة.', 'Saved signal for review.')} badge={blocked ? copy('محجوب', 'Blocked') : copy('قابل للتطبيق', 'Applicable')} badgeTone={blocked ? 'amber' : 'green'} meta={analyticsEvidence ? `${analyticsEvidence.platform || 'PLATFORM'} · n=${analyticsEvidence.sample?.eligiblePosts ?? 0} · ${copy('ثقة اتجاهية', 'directional confidence')}` : proposal.traceability || 'internal_signal'} actions={(
                      <>
                        <button type="button" disabled={busyKey !== null} onClick={() => decideBrain(proposal.id, 'dismiss')} className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-rose-200 bg-white px-3 text-[11px] font-black text-rose-600 disabled:opacity-50"><XCircle size={14} />{copy('رفض', 'Dismiss')}</button>
                        <button type="button" disabled={busyKey !== null || blocked} onClick={() => decideBrain(proposal.id, 'accept')} className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#071236] px-3 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busyKey === `brain:${proposal.id}:accept` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{copy('قبول وتطبيق', 'Accept and apply')}</button>
                      </>
                    )}>
                      {analyticsEvidence ? (
                        <div className="space-y-2 rounded-[14px] border border-emerald-100 bg-emerald-50/50 p-3 text-[10px] font-bold leading-5 text-emerald-950">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-2 py-1">{copy('العينة', 'Sample')}: {analyticsEvidence.sample?.eligiblePosts ?? 0}</span>
                            <span className="rounded-full bg-white px-2 py-1">{copy('فوق العتبة', 'Above threshold')}: {analyticsEvidence.sample?.aboveThresholdPosts ?? 0}</span>
                            <span className="rounded-full bg-white px-2 py-1">{copy('الخط الأساسي', 'Baseline')}: {analyticsEvidence.comparison?.baselineEngagementRate ?? '—'}%</span>
                            <span className="rounded-full bg-white px-2 py-1">{copy('عتبة المرشح', 'Candidate threshold')}: {analyticsEvidence.comparison?.candidateThresholdEngagementRate ?? '—'}%</span>
                          </div>
                          <p>{copy('ملاحظة ارتباطية وليست إثبات سببية أو إيراد. التطبيق يؤثر على الدورات المستقبلية فقط.', 'Observational association, not proof of causality or revenue. Applying it affects future cycles only.')}</p>
                          <p>{copy('التراجع:', 'Rollback:')} {analyticsEvidence.rollback?.strategy === 'remove_only_values_added_by_this_proposal' ? copy('إزالة القيم التي أضافها هذا الاقتراح فقط', 'remove only values added by this proposal') : copy('غير موثق', 'not documented')}</p>
                        </div>
                      ) : null}
                      {proposal.sourceRefs?.length ? <div className="flex flex-wrap gap-2">{proposal.sourceRefs.slice(0, 3).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#dbe2f0] bg-white px-2 py-1 text-[10px] font-black text-[#5366f6]"><ExternalLink size={11} />{source.publisher || source.title || copy('المصدر', 'Source')}</a>)}</div> : null}
                    </ApprovalDecisionCard>
                  )
                })}
              </div>
            </div>

          </section>

          {historyRows.length > 0 && (
            <section className="nx-os-card p-5">
                <h2 className="text-lg font-black text-[#071236]">{copy('سجل القرارات', 'Decision ledger')}</h2>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#7b87a3]">{copy('آخر القرارات المنفذة أو المرفوضة في مساحة العمل.', 'Latest applied or rejected workspace decisions.')}</p>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {historyRows.slice(0, 6).map(row => (
                    <div key={row.id} className="rounded-[14px] border border-[#e7ecf6] bg-[#fbfcff] p-3">
                      <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-black leading-4 text-[#111b3f]">{row.label}</p><span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">{row.status}</span></div>
                      <p className="mt-1 text-[9px] font-bold text-[#8a96ad]">
                        {row.kind} · {row.at ? new Date(row.at).toLocaleString(ar ? 'ar-AE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : copy('الوقت غير متاح', 'Time unavailable')}
                      </p>
                      {row.evidence ? <p className="mt-1 break-all font-mono text-[8px] font-bold text-[#69758f]">{row.evidence}</p> : null}
                    </div>
                  ))}
                </div>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  )
}
