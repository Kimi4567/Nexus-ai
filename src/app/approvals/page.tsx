'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { ApprovalDecisionCard } from '@/components/approvals/ApprovalDecisionCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { ExecutionQueueItem, WorkspaceExecutionTruth } from '@/lib/executionTruth'
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
  } | null
  createdAt?: string | null
  updatedAt?: string | null
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
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)

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
        const [proposalRes, suggestionRes, proposalHistoryRes, suggestionHistoryRes, executionRes] = await Promise.all([
          fetch('/api/brain/proposals?status=pending', { headers: { Authorization: token } }),
          fetch('/api/agents/suggestions?status=PENDING&limit=50', { headers: { Authorization: token } }),
          fetch('/api/brain/proposals?status=all', { headers: { Authorization: token } }),
          fetch('/api/agents/suggestions?status=all&limit=100', { headers: { Authorization: token } }),
          fetch('/api/execution/queue', { headers: { Authorization: token } }),
        ])
        if (cancelled) return
        const [proposalData, suggestionData, proposalHistoryData, suggestionHistoryData, executionData] = await Promise.all([
          proposalRes.json().catch(() => ({})),
          suggestionRes.json().catch(() => ({})),
          proposalHistoryRes.json().catch(() => ({})),
          suggestionHistoryRes.json().catch(() => ({})),
          executionRes.json().catch(() => ({})),
        ])
        setProposals(Array.isArray(proposalData.proposals) ? proposalData.proposals : [])
        setSuggestions(Array.isArray(suggestionData.suggestions) ? suggestionData.suggestions : [])
        setProposalHistory(Array.isArray(proposalHistoryData.proposals)
          ? proposalHistoryData.proposals.filter((item: BrainProposal) => item.status !== 'pending')
          : [])
        setSuggestionHistory(Array.isArray(suggestionHistoryData.suggestions)
          ? suggestionHistoryData.suggestions.filter((item: AgentSuggestion) => item.status !== 'PENDING')
          : [])
        const executionTruth = executionData.truth as WorkspaceExecutionTruth | undefined
        const persistedCampaignIds = new Set(
          (Array.isArray(suggestionData.suggestions) ? suggestionData.suggestions : [])
            .map((item: AgentSuggestion) => item.campaignId)
            .filter((id: string | null | undefined): id is string => typeof id === 'string' && id.length > 0),
        )
        setLiveApprovalActions(Array.isArray(executionTruth?.queue)
          ? executionTruth.queue.filter(action => action.requiresApproval && !persistedCampaignIds.has(action.campaignId))
          : [])
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
    })),
    ...suggestionHistory.map(item => ({
      id: `agent-${item.id}`,
      label: ar ? item.payload?.titleAr || item.title : item.title,
      status: item.status,
      at: item.updatedAt || item.createdAt || '',
      kind: copy('قرار تشغيلي', 'Operational decision'),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10), [ar, copy, proposalHistory, suggestionHistory])

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
      setNotice({ tone: 'success', text: copy(`تم رفض ${data.count || 0} إشارة بلا مصدر وتسجيلها.`, `${data.count || 0} unsourced signals were dismissed and recorded.`) })
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
            primaryHref="/automation"
            primaryLabel={copy('عرض الأتمتة', 'View automation')}
            secondaryHref="/content-hub"
            secondaryLabel={copy('مراجعة المحتوى', 'Review content')}
          />

          <section className="nx-os-action-strip">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><ShieldCheck size={17} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">
                  {pendingTotal > 0
                    ? copy(`${pendingTotal} قرار بانتظار المراجعة`, `${pendingTotal} decisions need review`)
                    : copy('لا توجد قرارات معلقة', 'Nothing is waiting for review')}
                </p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">
                  {copy('لن ينفذ NEXUS أي قرار من دون موافقتك.', 'NEXUS will not execute a decision without your approval.')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {blockedCount > 0 && (
                <button type="button" onClick={dismissBlocked} disabled={busyKey !== null} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 disabled:opacity-50">
                  {busyKey === 'brain:dismiss-blocked' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                  {copy(`ارفض ${blockedCount} بلا مصدر`, `Dismiss ${blockedCount} unsourced`)}
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

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="nx-os-card p-5">
              <div className="mb-5">
                <h2 className="text-xl font-black text-[#071236]">{copy('قرارات التشغيل', 'Operational decisions')}</h2>
                <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">{copy('أنشأها مراقب التنفيذ من حالة العمل الفعلية.', 'Created by the execution monitor from verified workflow state.')}</p>
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
                      meta={`${action.stage} · ${action.campaignName}`}
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
                  const title = ar ? suggestion.payload?.titleAr || suggestion.title : suggestion.title
                  const reason = ar ? suggestion.payload?.reasoningAr || suggestion.reasoning : suggestion.reasoning
                  const evidenceCount = Array.isArray(suggestion.payload?.evidence) ? suggestion.payload.evidence.length : 0
                  const sourceItems = Array.isArray(suggestion.payload?.items)
                    ? suggestion.payload.items.filter(item => typeof item.url === 'string' && item.url)
                    : []
                  return (
                    <ApprovalDecisionCard key={suggestion.id} title={title} reason={reason} badge={suggestion.priority === 1 ? copy('عاجل', 'Urgent') : copy('مراجعة', 'Review')} badgeTone={suggestion.priority === 1 ? 'amber' : 'violet'} meta={`${suggestion.type} · ${sourceItems.length || evidenceCount} ${copy('أدلة', 'evidence items')}`} actions={(
                      <>
                        <button type="button" disabled={busyKey !== null} onClick={() => decideSuggestion(suggestion.id, 'reject')} className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-rose-200 bg-white px-3 text-[11px] font-black text-rose-600 disabled:opacity-50"><XCircle size={14} />{copy('رفض', 'Reject')}</button>
                        <button type="button" disabled={busyKey !== null} onClick={() => decideSuggestion(suggestion.id, 'approve')} className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#071236] px-3 text-[11px] font-black text-white disabled:opacity-50">{busyKey === `suggestion:${suggestion.id}:approve` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{suggestion.payload?.href ? copy('اعتمد وافتح الخطوة', 'Approve and open step') : copy('اعتماد', 'Approve')}</button>
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
                  return (
                    <ApprovalDecisionCard key={proposal.id} title={proposalLabel(proposal, ar)} reason={blocked ? copy('لا يمكن تطبيق الادعاء الخارجي لأن رابط المصدر غير مرفق.', 'This external claim cannot be applied because no source URL is attached.') : proposal.reason || copy('إشارة محفوظة للمراجعة.', 'Saved signal for review.')} badge={blocked ? copy('محجوب', 'Blocked') : copy('قابل للتطبيق', 'Applicable')} badgeTone={blocked ? 'amber' : 'green'} meta={proposal.traceability || 'internal_signal'} actions={(
                      <>
                        <button type="button" disabled={busyKey !== null} onClick={() => decideBrain(proposal.id, 'dismiss')} className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-rose-200 bg-white px-3 text-[11px] font-black text-rose-600 disabled:opacity-50"><XCircle size={14} />{copy('رفض', 'Dismiss')}</button>
                        <button type="button" disabled={busyKey !== null || blocked} onClick={() => decideBrain(proposal.id, 'accept')} className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#071236] px-3 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busyKey === `brain:${proposal.id}:accept` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{copy('قبول وتطبيق', 'Accept and apply')}</button>
                      </>
                    )}>
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
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8a96ad]">{row.kind}</p>
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
