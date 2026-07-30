'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  FileClock,
  Filter,
  FlaskConical,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { FirstPartyMeasurementSummary } from '@/lib/firstPartyMeasurement'

type SignalStatus = 'pending' | 'accepted' | 'dismissed' | 'rolled_back' | string
type SignalFilter = 'pending' | 'accepted' | 'dismissed' | 'rolled_back' | 'all'
type LearningAction = 'accept' | 'dismiss' | 'rollback'

interface LearningEvidence {
  platform: string
  period: { start: string; end: string }
  sample: {
    eligiblePosts: number
    aboveThresholdPosts: number
    evidencePostIds?: string[]
    campaignIds?: string[]
  }
  comparison: {
    metricDefinition: string
    baselineEngagementRate: number
    candidateThresholdEngagementRate: number
  }
  confidence: { level: 'directional'; rationale: string }
  proposedChange: {
    field: string
    values: string[]
    affectsExistingApprovedRevisions: false
    affectsFutureStrategyAndContent: true
  }
  causalClaim: false
}

interface LearningSignal {
  id: string
  status: SignalStatus
  source: 'analytics' | 'review_signal'
  field: string
  displayName: string
  icon: string | null
  current: unknown
  proposed: unknown
  reason: string
  trigger: string | null
  traceability: 'analytics_evidence' | 'campaign_record' | 'external_sources' | 'source_not_attached' | 'internal_signal'
  sourceRefs: Array<{ url: string; title?: string; publisher?: string; publishedAt?: string }>
  canAccept: boolean
  evidence: LearningEvidence | null
  campaignId: string | null
  at: string | null
}

interface WorkflowSignal {
  id: string
  eventType: string
  actor: string
  campaignId: string | null
  socialPostId: string | null
  at: string | null
}

interface PerformanceSummary {
  hasEvidence: boolean
  organicEvidenceCount: number
  paidEvidenceCount: number
  totalEvidenceRows: number
  totals: {
    impressions: number
    reach: number
    engagements: number
    clicks: number
    conversions: number
    spend: number
    organicEngagementRate: number | null
    paidCtr: number | null
    paidRoas: number | null
  }
  channels: Array<{
    platform: string
    evidenceRows: number
    impressions: number
    engagements: number
    clicks: number
    conversions: number
    spend: number
  }>
  lastUpdatedAt: string | null
}

interface PilotProof {
  status: 'not_started' | 'provider_published' | 'analytics_ready' | 'learning_applied'
  providerPublishedPosts: number
  eligibleAnalyticsPosts: number
  appliedLearningProposals: number
  completedCampaigns: number
  completedCampaignIds: string[]
}

interface LearningOverview {
  stage: 'empty' | 'signals_building' | 'analytics_backed'
  counts: {
    totalSignals: number
    acceptedSignals: number
    pendingReview: number
    reviewedSignals: number
    dismissedSignals: number
    rolledBackLessons: number
    analyticsBackedLessons: number
    workflowSignals: number
    performanceEvidenceRows: number
    untraceableExternalSignals: number
  }
  signals: LearningSignal[]
  recentSignals: LearningSignal[]
  recentWorkflowSignals: WorkflowSignal[]
  performance: PerformanceSummary
  pilot: PilotProof
  firstParty: FirstPartyMeasurementSummary | null
}

const PAGE_SIZE = 6
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${number.format(value / 1_000_000)}M`
  if (Math.abs(value) >= 1_000) return `${number.format(value / 1_000)}K`
  return number.format(value)
}

function formatDate(value: string | null, ar: boolean, dateOnly = false): string {
  if (!value) return ar ? 'الوقت غير متاح' : 'Time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ar ? 'الوقت غير متاح' : 'Time unavailable'
  return new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-US', dateOnly
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : '—'
}

function valueItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (value && typeof value === 'object') {
    try { return [JSON.stringify(value)] } catch { return [] }
  }
  return []
}

function fieldLabel(signal: LearningSignal, ar: boolean): string {
  const labels: Record<string, [string, string]> = {
    winningHooks: ['الخطافات الفائزة', 'Winning hooks'],
    winningAngles: ['زوايا المحتوى الفائزة', 'Winning content angles'],
    failedAngles: ['زوايا لم تنجح', 'Underperforming angles'],
    toneKeywords: ['نبرة العلامة', 'Brand tone'],
    audiencePainPoints: ['مشكلات الجمهور', 'Audience pain points'],
    audienceDesires: ['رغبات الجمهور', 'Audience desires'],
    uniqueAdvantages: ['المزايا الفريدة', 'Unique advantages'],
    topPlatforms: ['المنصات ذات الأولوية', 'Priority platforms'],
    strategicNotes: ['ملاحظات استراتيجية', 'Strategic notes'],
  }
  return labels[signal.field]?.[ar ? 0 : 1] || signal.displayName || (ar ? 'تحديث Brand Brain' : 'Brand Brain update')
}

function workflowLabel(eventType: string, ar: boolean): string {
  const labels: Record<string, [string, string]> = {
    POST_APPROVED: ['تم اعتماد منشور', 'Post approved'],
    POST_SCHEDULED: ['تمت جدولة منشور', 'Post scheduled'],
    POST_MANUALLY_PUBLISHED: ['سجل المستخدم نشرًا يدويًا', 'User recorded a manual publish'],
    POST_UNSCHEDULED: ['تم إلغاء جدولة منشور', 'Post unscheduled'],
    POST_REVERTED_TO_DRAFT: ['أعيد منشور إلى المسودة', 'Post returned to draft'],
    POST_FAILED: ['فشلت محاولة نشر', 'Publish attempt failed'],
    POST_AUTO_PUBLISHED: ['نُشر عبر تكامل موثّق', 'Published through a verified integration'],
    BRAND_LEARNING_ACCEPTED: ['طُبّق درس على Brand Brain', 'Learning applied to Brand Brain'],
    BRAND_LEARNING_DISMISSED: ['رُفض مقترح تعلم', 'Learning proposal dismissed'],
    BRAND_LEARNING_ROLLED_BACK: ['تم التراجع عن درس', 'Learning was rolled back'],
  }
  if (labels[eventType]) return labels[eventType][ar ? 0 : 1]
  const readable = eventType.trim().replace(/[_-]+/g, ' ').toLowerCase()
  return readable ? `${ar ? 'حدث:' : 'Event:'} ${readable}` : (ar ? 'حدث غير مصنف' : 'Unclassified event')
}

function statusLabel(status: SignalStatus, ar: boolean): string {
  if (status === 'pending') return ar ? 'بانتظار القرار' : 'Pending decision'
  if (status === 'accepted') return ar ? 'مطبق' : 'Applied'
  if (status === 'rolled_back') return ar ? 'تم التراجع' : 'Rolled back'
  if (status === 'dismissed') return ar ? 'مرفوض' : 'Dismissed'
  return status
}

function statusTone(status: SignalStatus): string {
  if (status === 'accepted') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'pending') return 'border-violet-100 bg-violet-50 text-violet-700'
  if (status === 'rolled_back') return 'border-amber-100 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function ChangeValue({ title, values, emptyLabel, tone }: { title: string; values: string[]; emptyLabel: string; tone: 'current' | 'proposed' }) {
  return (
    <div className={`rounded-[15px] border p-3 ${tone === 'proposed' ? 'border-violet-100 bg-violet-50/50' : 'border-[#e4e9f2] bg-[#fafbfe]'}`}>
      <p className={`text-[8px] font-black uppercase tracking-[0.12em] ${tone === 'proposed' ? 'text-violet-600' : 'text-[#8a95a9]'}`}>{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.length ? values.slice(0, 12).map((item, index) => (
          <span key={`${item}-${index}`} className="max-w-full break-words rounded-[9px] bg-white px-2 py-1 text-[9px] font-bold leading-4 text-[#44506a] shadow-sm">{item}</span>
        )) : <span className="text-[9px] font-semibold text-[#9aa5b8]">{emptyLabel}</span>}
      </div>
    </div>
  )
}

export default function LearningPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const [overview, setOverview] = useState<LearningOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [filter, setFilter] = useState<SignalFilter>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmation, setConfirmation] = useState<{ id: string; action: LearningAction } | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const copy = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async (quiet = false) => {
    if (!isAuthenticated) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/learning/overview', {
        headers: { Authorization: authHeader() },
        cache: 'no-store',
        signal: controller.signal,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Learning overview unavailable')
      setOverview(body)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Learning overview unavailable')
    } finally {
      if (requestRef.current === controller) setLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    void load()
    return () => requestRef.current?.abort()
  }, [load])

  const mutateLearning = useCallback(async (proposalId: string, action: LearningAction) => {
    const token = authHeader()
    if (!token) return
    setBusyId(proposalId)
    setNotice(null)
    try {
      const response = await fetch('/api/brain/proposals', {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, action }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || copy('تعذر حفظ القرار.', 'The decision could not be saved.'))
      const message = action === 'accept'
        ? copy('تم تطبيق التغيير على Brand Brain للرحلات المستقبلية فقط.', 'The change was applied to Brand Brain for future work only.')
        : action === 'rollback'
          ? copy(`تم التراجع بأمان وإزالة ${body.removedValues?.length ?? 0} قيمة أضافها هذا القرار فقط.`, `Rolled back safely; ${body.removedValues?.length ?? 0} decision-added values were removed.`)
          : copy('تم رفض المقترح دون تغيير Brand Brain.', 'The proposal was dismissed without changing Brand Brain.')
      setNotice({ tone: 'success', text: message })
      setConfirmation(null)
      await load(true)
    } catch (mutationError) {
      setNotice({
        tone: 'error',
        text: mutationError instanceof Error ? mutationError.message : copy('تعذر حفظ القرار.', 'The decision could not be saved.'),
      })
    } finally {
      setBusyId(null)
    }
  }, [authHeader, copy, load])

  const signals = useMemo(
    () => overview?.signals ?? overview?.recentSignals ?? [],
    [overview?.recentSignals, overview?.signals],
  )
  const filteredSignals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return signals.filter(signal => {
      if (filter !== 'all' && signal.status !== filter) return false
      if (!query) return true
      const searchable = [signal.field, signal.displayName, signal.reason, ...valueItems(signal.proposed)].join(' ').toLocaleLowerCase()
      return searchable.includes(query)
    })
  }, [filter, search, signals])
  const pageCount = Math.max(1, Math.ceil(filteredSignals.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleSignals = filteredSignals.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const stage = useMemo(() => {
    if (overview?.firstParty?.stage === 'directional' && overview?.stage !== 'analytics_backed') return {
      label: copy('دليل First-party قابل للمراجعة', 'First-party evidence is reviewable'),
      helper: copy('الإشارات وصفية واتجاهية فقط؛ لا يوجد ادعاء سببي أو تغيير تلقائي.', 'Signals are descriptive and directional only; no causal claim or automatic change.'),
      tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    }
    if (overview?.stage === 'analytics_backed') return {
      label: copy('تعلم مدعوم بالتحليلات', 'Analytics-backed learning'),
      helper: copy('توجد نتائج منصة مؤهلة ودروس مطبقة يمكن تتبعها والتراجع عنها.', 'Eligible provider results and applied, reversible lessons are available.'),
      tone: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    }
    if (overview?.stage === 'signals_building') return {
      label: copy('ذاكرة التشغيل قيد البناء', 'Operational memory is building'),
      helper: copy('توجد إشارات أو أحداث، لكن تعلم الأداء يظل مقيدًا بالدليل الحقيقي.', 'Signals or events exist, while performance learning remains evidence-gated.'),
      tone: 'border-violet-100 bg-violet-50 text-violet-700',
    }
    return {
      label: copy('لا توجد دروس مثبتة بعد', 'No verified lessons yet'),
      helper: copy('سيظل النظام صامتًا بدل اختلاق تعلم قبل النشر والتحليلات.', 'The system stays silent instead of inventing learning before publishing and analytics.'),
      tone: 'border-slate-200 bg-slate-50 text-slate-600',
    }
  }, [copy, overview?.firstParty?.stage, overview?.stage])

  const pilotSteps = useMemo(() => {
    const status = overview?.pilot.status ?? 'not_started'
    const rank = { not_started: 0, provider_published: 1, analytics_ready: 2, learning_applied: 3 }[status]
    return [
      { title: copy('نشر موثق من المنصة', 'Provider-confirmed publish'), count: overview?.pilot.providerPublishedPosts ?? 0, done: rank >= 1 },
      { title: copy('تحليلات مؤهلة', 'Eligible analytics'), count: overview?.pilot.eligibleAnalyticsPosts ?? 0, done: rank >= 2 },
      { title: copy('درس طُبق بموافقة', 'Approved learning applied'), count: overview?.pilot.appliedLearningProposals ?? 0, done: rank >= 3 },
      { title: copy('حملة أغلقت الحلقة', 'Campaign closed the loop'), count: overview?.pilot.completedCampaigns ?? 0, done: rank >= 3 },
    ]
  }, [copy, overview?.pilot])

  if (authLoading || (loading && !overview)) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مركز التعلّم" labelEn="Preparing learning center" />
  }
  if (!isAuthenticated) return null

  const primarySignal = signals.find(signal => signal.status === 'pending')

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            journeyStage="results"
            pageTitle={copy('مركز التعلم', 'Learning center')}
            pageSubtitle={copy('حوّل النتائج الحقيقية إلى تحسينات قابلة للمراجعة والتطبيق والتراجع.', 'Turn real outcomes into reviewable, applicable, and reversible improvements.')}
            primaryHref={primarySignal ? '#learning-decisions' : '/analytics'}
            primaryLabel={primarySignal ? copy('راجع القرار التالي', 'Review next decision') : copy('فتح التحليلات', 'Open analytics')}
            secondaryHref="/operations"
            secondaryLabel={copy('مركز العمليات', 'Operations center')}
          />

          <section className="nx-os-action-strip">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-violet-50 text-violet-600"><BookOpen className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-black text-[#111b3f]">{stage.label}</p>
                <p className="mt-1 text-[10px] font-semibold leading-5 text-[#687590]">{stage.helper}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${stage.tone}`}>{loading ? '—' : `${overview?.counts.pendingReview ?? 0} ${copy('قرار معلق', 'pending')}`}</span>
              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[#dbe2f0] bg-white px-3 text-[10px] font-black text-[#5366f6] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{copy('تحديث', 'Refresh')}</button>
            </div>
          </section>

          {notice ? <div role="status" className={`rounded-[16px] border px-4 py-3 text-[11px] font-bold ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{notice.text}</div> : null}

          {error ? (
            <section className="nx-os-card border-rose-100 p-8 text-center">
              <AlertTriangle className="mx-auto h-9 w-9 text-rose-500" />
              <p className="mt-3 text-[14px] font-black text-[#071236]">{copy('تعذر قراءة مركز التعلم', 'Learning center could not load')}</p>
              <p className="mt-2 text-[10px] font-semibold text-[#7b87a3]">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-4 rounded-[13px] bg-[#071236] px-5 py-3 text-[11px] font-black text-white">{copy('إعادة المحاولة', 'Try again')}</button>
            </section>
          ) : (
            <>
              <section className="nx-os-card overflow-hidden p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-[#5366f6]" /><h2 className="text-[17px] font-black text-[#071236]">{copy('إثبات الحلقة التشغيلية', 'Closed-loop pilot proof')}</h2></div>
                    <p className="mt-1 text-[10px] font-semibold leading-5 text-[#7b87a3]">{copy('لا تُعتبر الرحلة مكتملة إلا إذا اجتمع النشر والتحليلات والتعلم في الحملة نفسها.', 'The loop is complete only when publish, analytics, and learning belong to the same campaign.')}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-[9px] font-black ${overview?.pilot.status === 'learning_applied' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    {overview?.pilot.status === 'learning_applied' ? copy('مثبت', 'Proven') : copy('غير مكتمل', 'Not complete')}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {pilotSteps.map((step, index) => (
                    <div key={step.title} className={`relative rounded-[17px] border p-4 ${step.done ? 'border-emerald-100 bg-emerald-50/60' : 'border-[#e4e9f2] bg-[#fafbfe]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-black ${step.done ? 'bg-emerald-600 text-white' : 'bg-white text-[#8c97aa] shadow-sm'}`}>{step.done ? <Check className="h-4 w-4" /> : index + 1}</span>
                        <span className="text-[18px] font-black text-[#071236]">{step.count}</span>
                      </div>
                      <p className="mt-3 text-[10px] font-black leading-5 text-[#43506c]">{step.title}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="learning-decisions" className="nx-os-card p-5 scroll-mt-24">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-[#5366f6]" /><h2 className="text-[17px] font-black text-[#071236]">{copy('قرارات التعلم', 'Learning decisions')}</h2></div>
                    <p className="mt-1 text-[10px] font-semibold leading-5 text-[#7b87a3]">{copy('راجع المصدر والتغيير قبل تطبيقه على العمل المستقبلي. لا يتغير أي محتوى معتمد سابقًا.', 'Review source and change before applying it to future work. Existing approved revisions never change.')}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="relative">
                      <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa5b8]" />
                      <input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder={copy('ابحث في القرارات', 'Search decisions')} className="h-10 w-48 rounded-[12px] border border-[#dfe5ef] bg-white ps-9 pe-3 text-[10px] font-semibold outline-none focus:border-[#5366f6]" />
                    </label>
                    <span className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#dfe5ef] bg-white text-[#7b87a3]"><Filter className="h-4 w-4" /></span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {([
                    ['pending', copy('بانتظار القرار', 'Pending'), overview?.counts.pendingReview ?? 0],
                    ['accepted', copy('مطبق', 'Applied'), overview?.counts.acceptedSignals ?? 0],
                    ['dismissed', copy('مرفوض', 'Dismissed'), overview?.counts.dismissedSignals ?? 0],
                    ['rolled_back', copy('تم التراجع', 'Rolled back'), overview?.counts.rolledBackLessons ?? 0],
                    ['all', copy('الكل', 'All'), overview?.counts.totalSignals ?? 0],
                  ] as Array<[SignalFilter, string, number]>).map(([value, label, count]) => (
                    <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1) }} className={`rounded-full px-3 py-2 text-[9px] font-black ${filter === value ? 'bg-[#071236] text-white' : 'bg-[#f1f4f9] text-[#66728c]'}`}>{label} · {count}</button>
                  ))}
                </div>

                {(overview?.counts.untraceableExternalSignals ?? 0) > 0 ? (
                  <div className="mt-4 flex items-start gap-3 rounded-[15px] border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[10px] font-bold leading-5 text-amber-800">{copy(`${overview?.counts.untraceableExternalSignals ?? 0} إشارة خارجية محجوبة لأن المصدر غير مرفق. يمكن رفضها ولا يمكن تطبيقها.`, `${overview?.counts.untraceableExternalSignals ?? 0} external signals are withheld because their source is missing. They can be dismissed but not applied.`)}</p>
                  </div>
                ) : null}

                <div className="mt-5 space-y-4">
                  {loading && !overview ? [1, 2, 3].map(item => <div key={item} className="h-52 animate-pulse rounded-[18px] bg-[#eef2f8]" />) : visibleSignals.length ? visibleSignals.map(signal => {
                    const currentValues = valueItems(signal.current)
                    const proposedValues = valueItems(signal.proposed)
                    const isConfirming = confirmation?.id === signal.id
                    const isBusy = busyId === signal.id
                    const evidenceInvalid = signal.traceability === 'analytics_evidence' && !signal.canAccept
                    return (
                      <article key={signal.id} className="rounded-[19px] border border-[#e3e9f3] bg-[#fcfdff] p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`grid h-10 w-10 place-items-center rounded-[14px] ${!signal.canAccept ? 'bg-amber-50 text-amber-600' : signal.source === 'analytics' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                                {!signal.canAccept ? <AlertTriangle className="h-5 w-5" /> : signal.source === 'analytics' ? <BarChart3 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                              </span>
                              <div>
                                <h3 className="text-[13px] font-black text-[#111b3f]">{fieldLabel(signal, ar)}</h3>
                                <p className="mt-0.5 text-[9px] font-bold text-[#8b96aa]">{formatDate(signal.at, ar)}</p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black ${statusTone(signal.status)}`}>{statusLabel(signal.status, ar)}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[8px] font-black ${signal.canAccept ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {signal.canAccept ? copy('قابل للتطبيق', 'Applicable') : copy('محجوب بالدليل', 'Evidence blocked')}
                              </span>
                            </div>
                            <p className="mt-3 text-[10px] font-semibold leading-5 text-[#65718a]">
                              {evidenceInvalid
                                ? copy('عقد دليل الأداء غير مكتمل أو لا يطابق التغيير؛ لن يطبق NEXUS هذا المقترح.', 'The performance evidence contract is incomplete or mismatched; NEXUS will not apply this proposal.')
                                : signal.traceability === 'source_not_attached'
                                  ? copy('الادعاء الخارجي بلا مصدر قابل للتتبع، لذلك لم يُعرض كحقيقة.', 'The external claim has no traceable source, so it is not presented as fact.')
                                  : signal.reason || copy('لا يوجد تفسير محفوظ؛ لا تطبق المقترح قبل مراجعته.', 'No rationale is stored; do not apply before review.')}
                            </p>
                          </div>
                          {signal.campaignId ? <Link href={`/campaigns/${signal.campaignId}`} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-[#dbe2f0] px-3 text-[9px] font-black text-[#5366f6]">{copy('الحملة', 'Campaign')}<ArrowUpRight className="h-3.5 w-3.5" /></Link> : null}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <ChangeValue title={copy('الحقيقة الحالية', 'Current Brand Brain')} values={currentValues} emptyLabel={copy('لا توجد قيمة حالية محفوظة', 'No current value stored')} tone="current" />
                          <ChangeValue title={copy('التغيير المقترح', 'Proposed change')} values={proposedValues} emptyLabel={copy('لا يوجد تغيير صالح محفوظ', 'No valid proposed value stored')} tone="proposed" />
                        </div>

                        {signal.evidence ? (
                          <details className="mt-4 rounded-[15px] border border-emerald-100 bg-emerald-50/40 p-3">
                            <summary className="cursor-pointer list-none text-[9px] font-black text-emerald-800">{copy('تفاصيل دليل الأداء والثقة', 'Performance evidence and confidence')}</summary>
                            <div className="mt-3 grid gap-3 text-[9px] font-semibold leading-5 text-[#53617b] md:grid-cols-2 xl:grid-cols-4">
                              <div><p className="font-black text-[#233052]">{copy('المصدر والفترة', 'Source and period')}</p><p>{signal.evidence.platform} · {formatDate(signal.evidence.period.start, ar, true)} → {formatDate(signal.evidence.period.end, ar, true)}</p></div>
                              <div><p className="font-black text-[#233052]">{copy('العينة', 'Sample')}</p><p>{signal.evidence.sample.aboveThresholdPosts}/{signal.evidence.sample.eligiblePosts} {copy('فوق العتبة', 'above threshold')}</p></div>
                              <div><p className="font-black text-[#233052]">{copy('المقارنة', 'Comparison')}</p><p>{formatPercent(signal.evidence.comparison.baselineEngagementRate)} → {formatPercent(signal.evidence.comparison.candidateThresholdEngagementRate)}</p></div>
                              <div><p className="font-black text-[#233052]">{copy('الثقة', 'Confidence')}</p><p>{copy('اتجاهية فقط؛ لا ادعاء سببي', 'Directional only; no causal claim')}</p></div>
                            </div>
                            <p className="mt-3 border-t border-emerald-100 pt-3 text-[9px] font-semibold leading-5 text-emerald-900">{signal.evidence.confidence.rationale}</p>
                            <p className="mt-2 text-[8px] font-black text-emerald-700">{copy('الأثر: الاستراتيجيات والمحتوى المستقبلية فقط. النسخ المعتمدة الحالية لا تتغير.', 'Impact: future strategy and content only. Existing approved revisions stay unchanged.')}</p>
                          </details>
                        ) : null}

                        {signal.sourceRefs.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {signal.sourceRefs.slice(0, 4).map((source, index) => (
                              <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[#dbe2f0] bg-white px-2.5 py-1.5 text-[8px] font-black text-[#5366f6]"><ExternalLink className="h-3 w-3" />{source.publisher || source.title || copy(`المصدر ${index + 1}`, `Source ${index + 1}`)}</a>
                            ))}
                          </div>
                        ) : null}

                        {isConfirming ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-[#dce3f0] bg-white p-3">
                            <p className="text-[9px] font-bold leading-5 text-[#53617b]">
                              {confirmation.action === 'accept'
                                ? copy('تأكيد التطبيق على Brand Brain للأعمال المستقبلية؟', 'Apply this change to Brand Brain for future work?')
                                : confirmation.action === 'rollback'
                                  ? copy('تأكيد التراجع عن القيم التي أضافها هذا القرار فقط؟', 'Remove only the values added by this decision?')
                                  : copy('تأكيد الرفض دون تغيير Brand Brain؟', 'Dismiss without changing Brand Brain?')}
                            </p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setConfirmation(null)} disabled={isBusy} className="h-9 rounded-[11px] border border-[#dce3f0] px-3 text-[9px] font-black text-[#64708f]">{copy('إلغاء', 'Cancel')}</button>
                              <button type="button" onClick={() => void mutateLearning(signal.id, confirmation.action)} disabled={isBusy} className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-[#071236] px-4 text-[9px] font-black text-white disabled:opacity-50">{isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{copy('تأكيد القرار', 'Confirm')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f7] pt-4">
                            <p className="text-[8px] font-bold text-[#8d98aa]">{copy('كل قرار يُحفظ في سجل التعلم ويمكن تتبعه.', 'Every decision is stored in the learning ledger.')}</p>
                            <div className="flex flex-wrap gap-2">
                              {signal.status === 'pending' ? (
                                <>
                                  <button type="button" onClick={() => setConfirmation({ id: signal.id, action: 'dismiss' })} disabled={busyId !== null} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-[#dbe2f0] bg-white px-3 text-[9px] font-black text-[#64708f] disabled:opacity-50"><X className="h-3.5 w-3.5" />{copy('رفض', 'Dismiss')}</button>
                                  <button type="button" onClick={() => setConfirmation({ id: signal.id, action: 'accept' })} disabled={!signal.canAccept || proposedValues.length === 0 || busyId !== null} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[#071236] px-4 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><Check className="h-3.5 w-3.5" />{copy('تطبيق على Brand Brain', 'Apply to Brand Brain')}</button>
                                </>
                              ) : signal.status === 'accepted' && signal.traceability === 'analytics_evidence' && signal.canAccept ? (
                                <button type="button" onClick={() => setConfirmation({ id: signal.id, action: 'rollback' })} disabled={busyId !== null} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-amber-200 bg-amber-50 px-3 text-[9px] font-black text-amber-800 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />{copy('تراجع آمن', 'Safe rollback')}</button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  }) : (
                    <div className="rounded-[18px] border border-dashed border-[#d7deeb] bg-[#fbfcff] p-9 text-center">
                      <BrainCircuit className="mx-auto h-9 w-9 text-[#aab5c9]" />
                      <p className="mt-3 text-[12px] font-black text-[#233052]">{copy('لا توجد قرارات في هذا العرض', 'No decisions in this view')}</p>
                      <p className="mx-auto mt-2 max-w-lg text-[10px] font-semibold leading-5 text-[#8792aa]">{copy('لن نولد إشارات وهمية لملء الصفحة. غيّر الفلتر أو انتظر بيانات منصة مؤهلة.', 'NEXUS will not invent signals to fill the page. Change the filter or wait for eligible provider evidence.')}</p>
                    </div>
                  )}
                </div>

                {filteredSignals.length > PAGE_SIZE ? (
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#edf1f7] pt-4">
                    <p className="text-[9px] font-bold text-[#8792aa]">{copy(`صفحة ${currentPage} من ${pageCount}`, `Page ${currentPage} of ${pageCount}`)}</p>
                    <div className="flex gap-2">
                      <button type="button" aria-label={copy('الصفحة السابقة', 'Previous page')} onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} className="grid h-9 w-9 place-items-center rounded-[11px] border border-[#dbe2f0] text-[#5366f6] disabled:opacity-30">{dir === 'rtl' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}</button>
                      <button type="button" aria-label={copy('الصفحة التالية', 'Next page')} onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} className="grid h-9 w-9 place-items-center rounded-[11px] border border-[#dbe2f0] text-[#5366f6] disabled:opacity-30">{dir === 'rtl' ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="nx-os-card p-5" aria-labelledby="first-party-learning-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="first-party-learning-title" className="text-[16px] font-black text-[#071236]">{copy('تعلّم مسار التحويل First-party', 'First-party conversion learning')}</h2>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-black text-emerald-700">{copy('بدون تصريح منصة', 'No platform permission')}</span>
                    </div>
                    <p className="mt-1 max-w-3xl text-[9px] font-semibold leading-5 text-[#7b87a3]">{copy('يحلل NEXUS الفجوة بين الزيارة والضغط والنموذج والنتيجة المؤكدة. الملاحظة ليست سببًا، ولا تغيّر Brand Brain تلقائيًا.', 'NEXUS reviews gaps between visit, click, form, and confirmed outcome. Observation is not causation and never changes Brand Brain automatically.')}</p>
                  </div>
                  <Link href="/landing-pages" className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-[#dbe2f0] px-3 text-[9px] font-black text-[#5366f6]">{copy('وجهات التحويل', 'Conversion destinations')}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
                </div>

                {overview?.firstParty ? (
                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        [copy('زيارات', 'Views'), overview.firstParty.funnel.pageViews, 'CLIENT_REPORTED'],
                        [copy('نماذج Landing Page مؤكدة', 'Confirmed landing-page forms'), overview.firstParty.funnel.confirmedForms, 'SERVER_CONFIRMED'],
                        [copy('Leads', 'Leads'), overview.firstParty.funnel.leads, copy('مسجلة', 'RECORDED')],
                        [copy('مكتسب', 'Won'), overview.firstParty.funnel.wonLeads, 'MANUAL_CONFIRMED'],
                      ].map(([label, value, evidence]) => <div key={String(label)} className="rounded-[15px] border border-[#e8edf5] bg-[#fbfcff] p-3"><p className="text-[8px] font-black text-[#8a95aa]">{label}</p><p className="mt-1 text-[20px] font-black text-[#111b3f]">{value}</p><p className="mt-1 truncate font-mono text-[7px] font-bold text-[#9aa4b6]">{evidence}</p></div>)}
                    </div>
                    <div className="space-y-3">
                      {overview.firstParty.insights.map(insight => (
                        <article key={insight.code} className={`rounded-[15px] border p-4 ${insight.evidenceLevel === 'directional' ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
                          <div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-black text-[#233052]">{ar ? insight.titleAr : insight.title}</p><span className={`rounded-full px-2 py-1 text-[7px] font-black ${insight.evidenceLevel === 'directional' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{insight.evidenceLevel}</span></div>
                          <p className="mt-2 text-[9px] font-semibold leading-5 text-[#65718a]">{ar ? insight.rationaleAr : insight.rationale}</p>
                          <p className="mt-2 border-t border-black/5 pt-2 text-[9px] font-black leading-5 text-[#5366f6]">{copy('الخطوة التالية: ', 'Next action: ')}{ar ? insight.nextActionAr : insight.nextAction}</p>
                          <p className="mt-1 text-[7px] font-bold text-[#8b95a9]">causalClaim=false</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : <div className="mt-4 rounded-[16px] border border-dashed border-[#d9e0ed] p-5 text-center text-[10px] font-bold text-[#8792aa]">{copy('طبقة القياس غير متاحة حتى يكتمل تحديث قاعدة البيانات.', 'Measurement is unavailable until the database update is complete.')}</div>}
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="nx-os-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><h2 className="text-[16px] font-black text-[#071236]">{copy('دليل الأداء', 'Performance evidence')}</h2><p className="mt-1 text-[10px] font-semibold text-[#7b87a3]">{copy('أرقام من مصادر مؤهلة فقط، وليست تقديرات.', 'Eligible source rows only, never estimates.')}</p></div>
                    <ShieldCheck className="h-5 w-5 text-[#5366f6]" />
                  </div>
                  {overview?.performance.hasEvidence ? (
                    <div className="mt-4">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                          [copy('الظهور', 'Impressions'), formatNumber(overview.performance.totals.impressions)],
                          [copy('التفاعل', 'Engagements'), formatNumber(overview.performance.totals.engagements)],
                          [copy('النقرات', 'Clicks'), formatNumber(overview.performance.totals.clicks)],
                          [copy('التحويلات', 'Conversions'), formatNumber(overview.performance.totals.conversions)],
                        ].map(([label, value]) => <div key={label} className="rounded-[15px] border border-[#e8edf5] bg-[#fbfcff] p-3"><p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8a95aa]">{label}</p><p className="mt-1 text-[20px] font-black text-[#111b3f]">{value}</p></div>)}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[8px] font-black text-[#65718a]">
                        <span className="rounded-full bg-[#f1f4f9] px-3 py-1.5">{copy('عضوي', 'Organic')}: {overview.performance.organicEvidenceCount}</span>
                        <span className="rounded-full bg-[#f1f4f9] px-3 py-1.5">{copy('مدفوع', 'Paid')}: {overview.performance.paidEvidenceCount}</span>
                        <span className="rounded-full bg-[#f1f4f9] px-3 py-1.5">{copy('آخر تحديث', 'Last update')}: {formatDate(overview.performance.lastUpdatedAt, ar)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[17px] border border-dashed border-[#d5ddea] bg-[#fbfcff] p-6 text-center"><Database className="mx-auto h-8 w-8 text-[#aab5c9]" /><p className="mt-3 text-[11px] font-black text-[#233052]">{copy('بانتظار تحليلات حقيقية', 'Waiting for real analytics')}</p><p className="mt-2 text-[9px] font-semibold text-[#8792aa]">{copy('النشر اليدوي أو الموافقة وحدهما لا يثبتان الأداء.', 'Manual publishing or approval alone does not prove performance.')}</p></div>
                  )}
                  <Link href="/analytics" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#dbe2f0] py-2.5 text-[10px] font-black text-[#5366f6]">{copy('فتح مصدر القياس', 'Open measurement source')}<ArrowUpRight className="h-4 w-4" /></Link>
                </div>

                <div className="nx-os-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><h2 className="text-[16px] font-black text-[#071236]">{copy('سجل القرارات والأحداث', 'Decision and workflow ledger')}</h2><p className="mt-1 text-[10px] font-semibold text-[#7b87a3]">{copy('أثر زمني محفوظ، وليس استنتاج أداء.', 'A persisted timeline, not a performance inference.')}</p></div>
                    <FileClock className="h-5 w-5 text-[#5366f6]" />
                  </div>
                  <div className="mt-4 space-y-1">
                    {overview?.recentWorkflowSignals.length ? overview.recentWorkflowSignals.slice(0, 8).map(event => (
                      <div key={event.id} className="flex items-center gap-3 border-b border-[#eef2f8] py-3 last:border-b-0">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#6f72ff] bg-white" />
                        <div className="min-w-0 flex-1"><p className="text-[10px] font-black text-[#233052]">{workflowLabel(event.eventType, ar)}</p><p className="mt-1 text-[8px] font-bold text-[#8b95a9]">{formatDate(event.at, ar)} · {event.actor}</p></div>
                        {event.campaignId ? <Link href={`/campaigns/${event.campaignId}`} className="text-[#5366f6]"><ArrowUpRight className="h-3.5 w-3.5" /></Link> : null}
                      </div>
                    )) : <div className="rounded-[16px] border border-dashed border-[#d9e0ed] p-6 text-center"><Activity className="mx-auto h-8 w-8 text-[#abb6ca]" /><p className="mt-3 text-[10px] font-bold text-[#8792aa]">{copy('لم تُسجل أحداث تنفيذ بعد.', 'No execution events have been recorded yet.')}</p></div>}
                  </div>
                </div>
              </section>

              <section className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#dfe6f1] bg-white px-5 py-4 text-[9px] font-semibold text-[#7b87a3]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{copy('الملاحظة ليست سببية، والمقترح لا يصبح تعلمًا إلا بعد الموافقة.', 'Observation is not causation, and a proposal becomes learning only after approval.')}</span>
                <Link href="/brand" className="inline-flex items-center gap-1 font-black text-[#5366f6]">{copy('فتح Brand Brain', 'Open Brand Brain')}<ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}
