'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import {
  ContentRunway,
  type DashboardContentRunwaySummary,
} from '@/components/dashboard/ContentRunway'
import OwnerCampaignStarterModal from '@/components/OwnerCampaignStarterModal'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { fetchWithTimeout, PRODUCT_READ_TIMEOUT_MS } from '@/lib/fetchWithTimeout'
import { getBrandBrainReadiness, type BrandReadinessResult } from '@/lib/brandReadiness'
import { getBrandIndicators } from '@/lib/brandIndicators'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { type PublishingState } from '@/lib/operatingBriefStatus'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import type { ExecutionQueueItem } from '@/lib/executionTruth'
import type { DashboardContentRunwayItem } from '@/lib/dashboardContentRunway'
import { newClientCreditOperationId } from '@/lib/creditOperationClient'
import type { OwnerCampaignOutcome } from '@/lib/ownerCampaignCommand'
import { derivePlatformReadiness, type SocialAccount } from '@/lib/platformReadiness'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Circle,
  Clock,
  FileText,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react'

interface Stats {
  campaigns: number
  draftCampaigns: number
  activeCampaigns: number
  totalGenerations: number
  creditsRemaining: number
  creditsMonthlyTotal: number
  isUnlimited: boolean
  lowCredits: boolean
  plan: string
  publishedPostsTotal: number
  publishedPostsThisMonth: number
  contentPostsTotal: number
  postsWithAnalytics: number
}

interface ActivityAlert {
  id: string
  title: string
  body: string
  bodyAr?: string
  bodyEn?: string
  time: string
  timeAr?: string
  timeEn?: string
  agent: string
  campaign?: string
}

interface Campaign {
  id: string
  name: string
  status: string
  thumbnail: string
  platforms: string[]
  goal: string
  createdAt: string
}

interface MarketingSignal {
  id: string
  label: string
  labelAr: string
  value: string
  valueAr: string
  severity: 'good' | 'watch' | 'risk'
}

interface MarketingAction {
  id: string
  title: string
  titleAr: string
  reason: string
  reasonAr: string
  href: string
  priority: 'high' | 'medium' | 'low'
}

interface MarketingRisk {
  id: string
  title: string
  titleAr: string
  detail: string
  detailAr: string
}

interface MarketingIntelligenceBrief {
  maturityScore: number
  stage: string
  stageAr: string
  summary: string
  summaryAr: string
  nextBestAction: MarketingAction
  actions: MarketingAction[]
  signals: MarketingSignal[]
  risks: MarketingRisk[]
  loop: {
    strategy: boolean
    content: boolean
    publishing: boolean
    learning: boolean
  }
  publishingState?: PublishingState
}

interface DashboardStatsResponse {
  stats?: {
    campaigns?: {
      total?: number
      draft?: number
      thisMonth?: number
    }
    generations?: {
      total?: number
    }
    credits?: {
      remaining?: number
      monthlyTotal?: number
      isUnlimited?: boolean
      lowCredits?: boolean
      plan?: string
    }
    publishedPosts?: {
      total?: number
      thisMonth?: number
    }
    contentPosts?: {
      total?: number
    }
    performanceEvidence?: {
      postsWithAnalytics?: number
    }
  }
  contentRunway?: {
    summary?: Partial<DashboardContentRunwaySummary>
    items?: DashboardContentRunwayItem[]
  }
  activities?: Array<{
    id?: string
    agent?: string
    action?: string
    actionAr?: string
    actionEn?: string
    time?: string
    timeAr?: string
    timeEn?: string
    campaign?: string
  }>
}

interface CampaignsResponse {
  campaigns?: Campaign[]
}

interface IntelligenceResponse {
  brief?: MarketingIntelligenceBrief
}

interface ExecutionQueueResponse {
  truth?: {
    queue?: ExecutionQueueItem[]
  }
}

interface BrandResponse {
  brandProfile?: Parameters<typeof getBrandBrainReadiness>[0]
}

type OwnerCampaignCommandStatus =
  | 'STARTING'
  | 'PREPARING'
  | 'QUEUED'
  | 'RUNNING'
  | 'RETRY_SCHEDULED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

interface OwnerCampaignCommand {
  version: 1
  operationId: string
  outcome: OwnerCampaignOutcome
  campaignId: string | null
  jobId: string | null
  status: OwnerCampaignCommandStatus
  message: string | null
  refunded: boolean | null
}

interface PublicAutomationJob {
  id: string
  status: OwnerCampaignCommandStatus
  campaignId: string | null
  message: string | null
  terminal: boolean
  canResume: boolean
  output?: unknown
}

const OWNER_COMMAND_STORAGE_PREFIX = 'nexus:owner-campaign:v1:'

function readOwnerCampaignCommand(userId: string): OwnerCampaignCommand | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(`${OWNER_COMMAND_STORAGE_PREFIX}${userId}`) || 'null',
    ) as Partial<OwnerCampaignCommand> | null
    if (
      parsed?.version !== 1
      || typeof parsed.operationId !== 'string'
      || typeof parsed.outcome !== 'string'
      || typeof parsed.status !== 'string'
    ) {
      return null
    }
    return parsed as OwnerCampaignCommand
  } catch {
    return null
  }
}

function writeOwnerCampaignCommand(userId: string, command: OwnerCampaignCommand): void {
  try {
    window.localStorage.setItem(
      `${OWNER_COMMAND_STORAGE_PREFIX}${userId}`,
      JSON.stringify(command),
    )
  } catch {
    // The durable server job remains the source of truth when browser storage
    // is unavailable; storage only restores the in-progress command surface.
  }
}

function clearOwnerCampaignCommand(userId: string): void {
  try {
    window.localStorage.removeItem(`${OWNER_COMMAND_STORAGE_PREFIX}${userId}`)
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}

function automationRefunded(output: unknown): boolean | null {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return null
  return typeof (output as { refunded?: unknown }).refunded === 'boolean'
    ? (output as { refunded: boolean }).refunded
    : null
}

interface ConnectionSummary {
  linked: number
  deliveryReady: number
}

type WorkspaceGateState = 'checking' | 'hasWorkspace' | 'noWorkspace' | 'error'

const EMPTY_CONTENT_RUNWAY_SUMMARY: DashboardContentRunwaySummary = {
  scheduledWithEvidence: 0,
  manualScheduled: 0,
  autoDeliveryConfigured: 0,
  externallyPublished: 0,
  manuallyPublished: 0,
  mediaApproved: 0,
  approvedReady: 0,
}

const STATUS_MAP: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  DRAFT: { ar: 'مسودة', en: 'Draft', color: '#64748b', bg: '#f8fafc' },
  ACTIVE: { ar: 'نشطة', en: 'Active', color: '#10b981', bg: '#ecfdf5' },
  PAUSED: { ar: 'متوقفة', en: 'Paused', color: '#d97706', bg: '#fffbeb' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed', color: '#2563eb', bg: '#eff6ff' },
  ARCHIVED: { ar: 'مؤرشفة', en: 'Archived', color: '#64748b', bg: '#f8fafc' },
}

const GOAL_MAP: Record<string, { ar: string; en: string }> = {
  SALES: { ar: 'المبيعات', en: 'Sales' },
  AWARENESS: { ar: 'الوعي بالعلامة', en: 'Brand awareness' },
  LEADS: { ar: 'العملاء المحتملون', en: 'Lead generation' },
  TRAFFIC: { ar: 'الزيارات', en: 'Traffic' },
  ENGAGEMENT: { ar: 'التفاعل', en: 'Engagement' },
  BRAND_BUILDING: { ar: 'بناء العلامة', en: 'Brand building' },
}

function DashboardGateSurface({
  mode,
  ar,
  onRetry,
  framed = false,
}: {
  mode: 'loading' | 'error'
  ar: boolean
  onRetry?: () => void
  framed?: boolean
}) {
  const surface = (
    <div className="flex min-h-[55vh] items-center justify-center px-4" style={{ background: '#F4F7FB', color: '#0B1028' }}>
      <div
        className="w-full max-w-sm text-center rounded-[26px] bg-white px-6 py-8"
        style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 22px 70px rgba(15,23,42,0.10)' }}
      >
        {mode === 'loading' ? (
          <>
            <div className="w-11 h-11 mx-auto mb-4 rounded-full border-2 border-slate-200 border-t-[#5E63FF] animate-spin" />
            <p className="text-[13px] font-semibold text-slate-500">
              {ar ? 'جار تجهيز لوحة القيادة...' : 'Preparing your command center...'}
            </p>
            <p className="mt-2 text-[11px] font-medium leading-5 text-slate-400">
              {ar
                ? 'نتحقق من Brand Brain والحملات والاتصالات وقرار التنفيذ الحي. لن يظهر رقم جاهزية أو حالة فارغة قبل اكتمال القراءات.'
                : 'Verifying Brand Brain, campaigns, connections, and the live execution decision. No readiness number or empty state appears before every read settles.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-bold mb-2 text-slate-950">
              {ar ? 'تعذر التحقق من مساحة العمل.' : 'We could not verify your workspace.'}
            </p>
            <p className="text-[13px] mb-5 text-slate-500">
              {ar ? 'حاول مرة أخرى.' : 'Please try again.'}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-colors"
              style={{ background: '#101A4D' }}
            >
              {ar ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  if (!framed) return surface

  return (
    <AppShell>
      <div className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'اليوم' : 'Today'}
            pageSubtitle={ar ? 'نجهّز قرارات مساحة العمل دون إخفاء حالة النظام.' : 'Preparing workspace decisions without hiding system status.'}
            primaryHref={null}
            secondaryHref={null}
          />
          {surface}
        </div>
      </div>
    </AppShell>
  )
}

function SoftCard({
  children,
  className = '',
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`nx-os-card ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  accent = '#5E63FF',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  helper: string
  accent?: string
}) {
  return (
    <article className="nx-dashboard-metric min-h-[116px] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold leading-tight text-slate-500">{label}</div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${accent}14`, color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4 font-mono text-[24px] font-semibold leading-none tracking-[-0.04em] text-[#0B1028]" dir="ltr">
        {value}
      </div>
      <p className="mt-2 text-[10px] font-medium leading-4 text-slate-500">{helper}</p>
    </article>
  )
}

function CircularScore({
  score,
  label,
  helper,
  accent = '#5E63FF',
}: {
  score: number
  label: string
  helper: string
  accent?: string
}) {
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${accent} ${clamped * 3.6}deg, #E9EDF7 0deg)`,
        }}
      >
        <div className="absolute inset-2 rounded-full bg-white" />
        <div className="relative text-center">
          <div className="text-[24px] font-black leading-none text-[#0B1028]" dir="ltr">{clamped}</div>
          <div className="mt-1 text-[10px] font-bold text-slate-500">{label}</div>
        </div>
      </div>
      {helper ? <p className="text-[12px] leading-6 text-slate-500">{helper}</p> : null}
    </div>
  )
}

function EmptyOrImage({ thumbnail, label }: { thumbnail?: string; label: string }) {
  const isImage = Boolean(thumbnail && /^https?:\/\//.test(thumbnail))
  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbnail} alt={label} className="h-full w-full object-cover" />
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_25%_20%,rgba(94,99,255,0.22),transparent_34%),linear-gradient(135deg,#101A4D,#071126)] text-4xl">
      {thumbnail || '✦'}
    </div>
  )
}

export default function DashboardPage() {
  const { authHeader, isAuthenticated, loading: authLoading, user } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [alerts, setAlerts] = useState<ActivityAlert[]>([])
  const [intelligence, setIntelligence] = useState<MarketingIntelligenceBrief | null>(null)
  const [executionAction, setExecutionAction] = useState<ExecutionQueueItem | null>(null)
  const [contentRunwayItems, setContentRunwayItems] = useState<DashboardContentRunwayItem[]>([])
  const [contentRunwaySummary, setContentRunwaySummary] = useState<DashboardContentRunwaySummary>(EMPTY_CONTENT_RUNWAY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [connectionSummary, setConnectionSummary] = useState<ConnectionSummary | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [brandReadiness, setBrandReadiness] = useState<BrandReadinessResult | null>(null)
  const [brandCompletenessScore, setBrandCompletenessScore] = useState(0)
  const [brandTruthBlocked, setBrandTruthBlocked] = useState(false)
  const [workspaceGate, setWorkspaceGate] = useState<WorkspaceGateState>('checking')
  const [workspaceGateRetry, setWorkspaceGateRetry] = useState(0)
  const [ownerStarterOpen, setOwnerStarterOpen] = useState(false)
  const [ownerStartBusy, setOwnerStartBusy] = useState(false)
  const [ownerStartError, setOwnerStartError] = useState<string | null>(null)
  const [ownerCommand, setOwnerCommand] = useState<OwnerCampaignCommand | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setWorkspaceGate('checking')
      return
    }
    const token = authHeader()
    if (!token) {
      setWorkspaceGate('checking')
      return
    }

    let cancelled = false
    setWorkspaceGate('checking')

    fetchWithTimeout('/api/workspaces', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS)
      .then(r => {
        if (!r.ok) throw new Error('workspace-check-failed')
        return r.json()
      })
      .then((data: unknown) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length === 0) {
          setWorkspaceGate('noWorkspace')
          router.replace('/onboarding')
          return
        }
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaceGate('hasWorkspace')
          return
        }
        setWorkspaceGate('error')
      })
      .catch(() => {
        if (!cancelled) setWorkspaceGate('error')
      })

    return () => { cancelled = true }
  }, [authLoading, isAuthenticated, authHeader, router, workspaceGateRetry])

  const load = useCallback(async (silent = false) => {
    const token = authHeader()
    if (!token) return
    if (!silent) {
      setLoading(true)
      setLoadError(false)
    }
    try {
      // Start every read together. Keep the decision surface in its truthful
      // loading state until both core records and operational enrichment have
      // settled; showing a fast but false "no strategy / no connection" state
      // is worse than a stable skeleton for an action-oriented dashboard.
      const essentialReads = Promise.allSettled([
        fetchWithTimeout('/api/dashboard/stats', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout('/api/campaigns?limit=5&sort=updatedAt', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout('/api/brand', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS),
      ])
      const enrichmentReads = Promise.allSettled([
        fetchWithTimeout('/api/dashboard/intelligence', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout('/api/social/accounts', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout('/api/execution/queue', { headers: { Authorization: token } }, PRODUCT_READ_TIMEOUT_MS),
      ])

      const [statsRes, campaignsRes, brandRes] = await essentialReads

      const statsReady = statsRes.status === 'fulfilled' && statsRes.value.ok
      if (statsReady) {
        const d = await statsRes.value.json() as DashboardStatsResponse
        setStats({
          campaigns: d.stats?.campaigns?.total ?? 0,
          draftCampaigns: d.stats?.campaigns?.draft ?? 0,
          activeCampaigns: d.stats?.campaigns?.thisMonth ?? 0,
          totalGenerations: d.stats?.generations?.total ?? 0,
          creditsRemaining: d.stats?.credits?.remaining ?? 0,
          creditsMonthlyTotal: d.stats?.credits?.monthlyTotal ?? 20,
          isUnlimited: d.stats?.credits?.isUnlimited ?? false,
          lowCredits: d.stats?.credits?.lowCredits ?? false,
          plan: d.stats?.credits?.plan ?? 'FREE',
          publishedPostsTotal: d.stats?.publishedPosts?.total ?? 0,
          publishedPostsThisMonth: d.stats?.publishedPosts?.thisMonth ?? 0,
          contentPostsTotal: d.stats?.contentPosts?.total ?? 0,
          postsWithAnalytics: d.stats?.performanceEvidence?.postsWithAnalytics ?? 0,
        })
        setContentRunwayItems(Array.isArray(d.contentRunway?.items) ? d.contentRunway.items : [])
        setContentRunwaySummary({
          ...EMPTY_CONTENT_RUNWAY_SUMMARY,
          ...d.contentRunway?.summary,
        })

        const seen = new Set<string>()
        const activities = (d.activities ?? []).filter(a => {
          const key = `${a.agent ?? ''}|${a.actionEn ?? a.action ?? ''}|${a.actionAr ?? ''}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setAlerts(activities.slice(0, 5).map(a => ({
          id: a.id || `${a.agent ?? 'nexus'}-${a.time ?? Math.random()}`,
          title: a.agent || 'Nexus',
          body: a.actionAr || a.action || 'نشاط جديد',
          bodyAr: a.actionAr || a.action || 'نشاط جديد',
          bodyEn: a.actionEn || a.action || 'New activity',
          time: a.timeAr || a.time || 'الآن',
          timeAr: a.timeAr || a.time || 'الآن',
          timeEn: a.timeEn || a.time || 'now',
          agent: a.agent || 'NEXUS',
          campaign: a.campaign || '',
        })))
      }
      if (!silent) setLoadError(!statsReady)

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const d = await campaignsRes.value.json() as CampaignsResponse
        setCampaigns(d.campaigns || [])
      }

      if (brandRes.status === 'fulfilled' && brandRes.value.ok) {
        const data = await brandRes.value.json() as BrandResponse
        setBrandReadiness(getBrandBrainReadiness(data.brandProfile))
        setBrandCompletenessScore(getBrandIndicators(data.brandProfile).brandCompleteness.score)
        setBrandTruthBlocked(reviewBrandTruthConsistency(data.brandProfile).status === 'blocked')
      }

      setLastUpdated(new Date())

      const [intelligenceRes, connectionsRes, executionRes] = await enrichmentReads

      if (intelligenceRes.status === 'fulfilled' && intelligenceRes.value.ok) {
        const d = await intelligenceRes.value.json() as IntelligenceResponse
        setIntelligence(d.brief || null)
      }

      if (connectionsRes.status === 'fulfilled' && connectionsRes.value.ok) {
        const data = await connectionsRes.value.json() as { accounts?: SocialAccount[] }
        const connectedAccounts = Array.isArray(data.accounts)
          ? data.accounts.filter(account => account.status === 'CONNECTED')
          : []
        const deliveryReady = derivePlatformReadiness(data.accounts)
          .filter(state => state.key !== 'paid' && state.status === 'ready')
          .length
        setConnectionSummary({
          linked: connectedAccounts.length,
          deliveryReady,
        })
      }

      if (executionRes.status === 'fulfilled' && executionRes.value.ok) {
        const data = await executionRes.value.json() as ExecutionQueueResponse
        setExecutionAction(data.truth?.queue?.[0] ?? null)
      }

    } finally {
      setLoading(false)
    }
  }, [authHeader])

  const persistOwnerCommand = useCallback((command: OwnerCampaignCommand) => {
    setOwnerCommand(command)
    if (user?.id) writeOwnerCampaignCommand(user.id, command)
  }, [user?.id])

  const startOwnerCampaign = useCallback(async (
    outcome: OwnerCampaignOutcome,
    resumeCommand: OwnerCampaignCommand | null = null,
  ) => {
    const token = authHeader()
    if (!token) return

    setOwnerStartBusy(true)
    setOwnerStartError(null)
    const operationId = resumeCommand?.operationId ?? newClientCreditOperationId()
    let campaignId = resumeCommand?.campaignId ?? null
    let nextCommand: OwnerCampaignCommand = {
      version: 1,
      operationId,
      outcome,
      campaignId,
      jobId: resumeCommand?.jobId ?? null,
      status: 'STARTING',
      message: null,
      refunded: null,
    }
    persistOwnerCommand(nextCommand)

    try {
      if (!campaignId) {
        const prepareResponse = await fetch('/api/campaigns/prepare', {
          method: 'POST',
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            'Idempotency-Key': operationId,
          },
          body: JSON.stringify({ outcome, language: locale }),
        })
        const prepared = await prepareResponse.json().catch(() => ({})) as {
          campaign?: { id?: string }
          error?: string
          message?: string
        }
        if (!prepareResponse.ok || !prepared.campaign?.id) {
          throw new Error(prepared.message || prepared.error || (
            ar ? 'تعذر تجهيز مسودة الحملة.' : 'The campaign draft could not be prepared.'
          ))
        }
        campaignId = prepared.campaign.id
        nextCommand = { ...nextCommand, campaignId }
        persistOwnerCommand(nextCommand)
      }

      const engineResponse = await fetch(`/api/campaigns/${campaignId}/engine`, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          Prefer: 'respond-async',
          'Idempotency-Key': operationId,
        },
        body: JSON.stringify({ language: locale }),
      })
      const engineResult = await engineResponse.json().catch(() => ({})) as {
        jobId?: string
        job?: PublicAutomationJob
        error?: string
        message?: string
        refunded?: boolean
      }
      if (!engineResponse.ok) {
        const failure: OwnerCampaignCommand = {
          ...nextCommand,
          status: 'FAILED',
          message: engineResult.message || engineResult.error || (
            ar ? 'لم يكتمل تشغيل NEXUS.' : 'NEXUS could not start the work.'
          ),
          refunded: typeof engineResult.refunded === 'boolean' ? engineResult.refunded : null,
        }
        persistOwnerCommand(failure)
        setOwnerStarterOpen(false)
        await load(true)
        return
      }

      const job = engineResult.job
      const accepted: OwnerCampaignCommand = {
        ...nextCommand,
        campaignId,
        jobId: engineResult.jobId || job?.id || null,
        status: job?.status || (engineResponse.status === 200 ? 'COMPLETED' : 'QUEUED'),
        message: job?.message || engineResult.message || null,
        refunded: automationRefunded(job?.output),
      }
      persistOwnerCommand(accepted)
      setOwnerStarterOpen(false)
      await load(true)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : (ar ? 'تعذر بدء تجهيز الحملة.' : 'Campaign preparation could not start.')
      if (campaignId) {
        persistOwnerCommand({
          ...nextCommand,
          campaignId,
          status: 'FAILED',
          message,
          refunded: null,
        })
        setOwnerStarterOpen(false)
        await load(true)
      } else {
        setOwnerCommand(null)
        if (user?.id) clearOwnerCampaignCommand(user.id)
        setOwnerStartError(message)
      }
    } finally {
      setOwnerStartBusy(false)
    }
  }, [ar, authHeader, load, locale, persistOwnerCommand, user?.id])

  useEffect(() => {
    if (!user?.id) {
      setOwnerCommand(null)
      return
    }
    setOwnerCommand(readOwnerCampaignCommand(user.id))
  }, [user?.id])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    load()
  }, [authLoading, isAuthenticated, load])

  useEffect(() => {
    if (!ownerCommand?.jobId || !user?.id) return
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(ownerCommand.status)) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      const token = authHeader()
      if (!token || cancelled) return
      try {
        let response = await fetch(`/api/automation/jobs/${ownerCommand.jobId}`, {
          headers: { Authorization: token },
          cache: 'no-store',
        })
        let payload = await response.json().catch(() => ({})) as { job?: PublicAutomationJob }
        if (response.ok && payload.job?.canResume) {
          response = await fetch(`/api/automation/jobs/${ownerCommand.jobId}`, {
            method: 'POST',
            headers: { Authorization: token },
          })
          payload = await response.json().catch(() => ({})) as { job?: PublicAutomationJob }
        }
        const job = payload.job
        if (!response.ok || !job || cancelled) return

        const updated: OwnerCampaignCommand = {
          ...ownerCommand,
          campaignId: job.campaignId || ownerCommand.campaignId,
          status: job.status,
          message: job.message,
          refunded: automationRefunded(job.output),
        }
        persistOwnerCommand(updated)
        if (job.terminal) {
          await load(true)
          return
        }
      } catch {
        // A transient dashboard read must not overwrite durable server state.
      }
      if (!cancelled) timer = setTimeout(poll, 2_500)
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [
    authHeader,
    load,
    ownerCommand,
    persistOwnerCommand,
    user?.id,
  ])

  useEffect(() => {
    if (workspaceGate !== 'hasWorkspace') return
    const iv = setInterval(() => load(true), 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [load, workspaceGate])

  const timeStr = lastUpdated.toLocaleTimeString(ar ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  const topCampaign = campaigns[0]
  const linkedAccountCount = connectionSummary?.linked ?? 0
  const deliveryReadyCount = connectionSummary?.deliveryReady ?? 0
  const platformConnected = deliveryReadyCount > 0
  // Display the same core-profile completeness score used by Brand Brain.
  // getBrandBrainReadiness remains a functional generation gate and must not be
  // relabelled as completeness; the two answer different questions.
  const brandScore = brandCompletenessScore
  const contentCount = stats?.contentPostsTotal ?? 0
  const campaignCount = stats?.campaigns ?? campaigns.length
  const publishedCount = stats?.publishedPostsTotal ?? 0
  const postsWithAnalytics = stats?.postsWithAnalytics ?? 0
  const scheduledWithEvidence = contentRunwaySummary.scheduledWithEvidence
  const manualScheduled = contentRunwaySummary.manualScheduled
  const autoDeliveryConfigured = contentRunwaySummary.autoDeliveryConfigured
  const externallyPublished = contentRunwaySummary.externallyPublished
  const draftCount = stats?.draftCampaigns ?? campaigns.filter(c => c.status === 'DRAFT').length
  const brandContextLabel = !brandReadiness
    ? (ar ? 'بانتظار البيانات' : 'Waiting for data')
    : brandTruthBlocked
      ? (ar ? 'يوجد تعارض يجب حسمه' : 'A truth conflict must be resolved')
    : brandReadiness.missingRequired.length > 0
      ? (ar ? 'السياق الأساسي ناقص' : 'Core context incomplete')
      : brandReadiness.missingRecommended.length > 0
        ? (ar ? 'السياق الأساسي متاح' : 'Core context available')
        : (ar ? 'السياق مكتمل' : 'Context complete')
  const strategyAvailable = intelligence?.loop.strategy ?? false
  const brandUsable = brandReadiness?.ready === true && !brandTruthBlocked
  const workflowStages = [
    { label: ar ? 'العلامة' : 'Brand', ready: brandUsable },
    { label: ar ? 'الاستراتيجية' : 'Strategy', ready: strategyAvailable && brandUsable },
    { label: ar ? 'المحتوى' : 'Content', ready: contentCount > 0 && brandUsable },
    { label: ar ? 'التنفيذ' : 'Execution', ready: scheduledWithEvidence > 0 },
    { label: ar ? 'التعلّم' : 'Learning', ready: postsWithAnalytics > 0 },
  ]
  const workflowChecks = workflowStages.map(stage => stage.ready)
  const workflowCoverage = Math.round((workflowChecks.filter(Boolean).length / workflowChecks.length) * 100)
  const requiredBrandFields = 5 - (brandReadiness?.missingRequired.length ?? 5)
  const recommendedBrandFields = 5 - (brandReadiness?.missingRecommended.length ?? 5)
  const publishChecklistComplete = [contentCount > 0, platformConnected].filter(Boolean).length
  const nextAction = useMemo(() => {
    if (brandTruthBlocked) {
      return {
        href: '/brand',
        title: ar ? 'احسم تعارض Brand Brain أولاً' : 'Resolve the Brand Brain conflict first',
        body: ar ? 'المجال المحفوظ لا يطابق وصف النشاط. أوقف NEXUS الاستراتيجية والمحتوى والنشر المدفوع حتى تصحيح مصدر الحقيقة، ولن تُخصم كريديت بسبب هذا الإيقاف.' : 'The saved industry does not match the business description. NEXUS has paused paid strategy, content, and publishing until the source of truth is corrected, with no credits charged for this block.',
        cta: ar ? 'تصحيح Brand Brain' : 'Fix Brand Brain',
      }
    }
    if (!brandReadiness?.ready) {
      return {
        href: '/brand',
        title: ar ? 'أكمل Brand Brain أولاً' : 'Complete Brand Brain first',
        body: ar ? 'أكمل السوق والجمهور والعرض والهدف والمنصات حتى لا يضطر NEXUS إلى اختراع افتراضات.' : 'Complete the market, audience, offer, outcome, and channels so NEXUS does not invent assumptions.',
        cta: ar ? 'فتح Brand Brain' : 'Open Brand Brain',
      }
    }
    if (campaignCount === 0) {
      return {
        href: '/strategy',
        title: ar ? 'دع NEXUS يجهّز حملتك الأولى' : 'Let NEXUS prepare your first campaign',
        body: ar ? 'حدّد النتيجة التي تريدها، وسيجهّز NEXUS الاستراتيجية ومفاهيم الحملة وتقويمًا أوليًا لتراجعها قبل صناعة المحتوى أو النشر.' : 'Choose the outcome you want. NEXUS will prepare the strategy, campaign concepts, and an initial calendar for review before content production or publishing.',
        cta: ar ? 'اطلب من NEXUS تجهيزها' : 'Ask NEXUS to prepare it',
      }
    }
    if (topCampaign && contentCount === 0) {
      const strategyApproved = topCampaign.status === 'ACTIVE'
      return {
        href: `/campaigns/${topCampaign.id}`,
        title: strategyApproved
          ? (ar ? 'حوّل الاستراتيجية المعتمدة إلى محتوى' : 'Turn the approved strategy into content')
          : (ar ? 'راجع أول قرار للحملة' : 'Review the first campaign decision'),
        body: strategyApproved
          ? (ar
            ? 'الاستراتيجية محفوظة. افتح الحملة ليجهّز NEXUS حزمة المحتوى القابلة للمراجعة؛ لن يحدث نشر أو إنفاق.'
            : 'The strategy is saved. Open the campaign so NEXUS can prepare the reviewable content package; nothing will be published or spent.')
          : (ar
            ? 'جهّز NEXUS اتجاه الحملة. راجع الاستراتيجية ووافق على الانتقال، ثم سيبدأ تجهيز المحتوى تلقائيًا.'
            : 'NEXUS prepared the campaign direction. Review the strategy and approve the handoff, then content preparation starts automatically.'),
        cta: strategyApproved
          ? (ar ? 'متابعة تجهيز المحتوى' : 'Continue content preparation')
          : (ar ? 'مراجعة الاستراتيجية' : 'Review strategy'),
      }
    }
    if (topCampaign && contentCount > 0 && scheduledWithEvidence === 0) {
      return {
        href: `/campaigns/${topCampaign.id}/content-hub`,
        title: ar ? 'راجع النصوص والوسائط ثم سجّل الجدول' : 'Review copy and media, then record the schedule',
        body: ar
          ? 'جهّز NEXUS النصوص والوسائط والمواعيد المقترحة. احفظ اعتماد النصوص أولاً، ثم اعتماد الوسائط، ثم الجدولة الداخلية كقرار منفصل. لا ينشر أو يصرف ميزانية.'
          : 'NEXUS prepared the copy, media, and proposed dates. Save copy approval first, then media approval, then internal scheduling as a separate decision. Nothing is published or spent.',
        cta: ar ? 'مراجعة القرارات' : 'Review decisions',
      }
    }
    if (executionAction) {
      const monitorSchedule = executionAction.kind === 'MONITOR_SCHEDULE'
      const analyticsAction = executionAction.kind === 'SYNC_ANALYTICS'
        || executionAction.kind === 'REVIEW_PERFORMANCE'
      if (monitorSchedule && manualScheduled > 0) {
        return {
          href: '/calendar?tab=queue',
          title: ar ? 'راقب خطة التسليم الداخلية' : 'Monitor the internal delivery plan',
          body: ar
            ? `عدد المنشورات المجدولة داخل NEXUS: ${manualScheduled}. لكل قرار دليل ثابت، والتسليم يدوي؛ لا يوجد نشر خارجي موثق أو تلقائي لهذه المنشورات.`
            : `${manualScheduled} posts have immutable schedule evidence inside NEXUS. Delivery is manual; these posts have no verified or automatic external publication.`,
          cta: ar ? 'فتح خطة التنفيذ' : 'Open execution plan',
        }
      }
      return {
        href: monitorSchedule ? '/calendar?tab=queue' : executionAction.href,
        title: ar ? executionAction.title.ar : executionAction.title.en,
        body: ar ? executionAction.reason.ar : executionAction.reason.en,
        cta: monitorSchedule
          ? (ar ? 'فتح التنفيذ' : 'Open Execution')
          : analyticsAction
            ? (ar ? 'فتح النتائج' : 'Open Results')
            : (ar ? 'تنفيذ الخطوة التالية' : 'Take next action'),
      }
    }
    if (contentCount > 0 && publishedCount === 0 && topCampaign) {
      return {
        href: `/campaigns/${topCampaign.id}/content-hub`,
        title: ar ? 'راجع المحتوى واحسم قرارات الوسائط' : 'Review content and media decisions',
        body: ar ? 'لديك محتوى محفوظ. الخطوة العملية الآن هي مراجعة المنشورات والوسائط قبل أي نشر.' : 'You have saved content. The practical next step is reviewing posts and media before publishing.',
        cta: ar ? 'فتح مركز المحتوى' : 'Open Content Hub',
      }
    }
    if (!platformConnected) {
      return {
        href: '/connections',
        title: ar ? 'جهّز الربط قبل النشر' : 'Prepare platform connections',
        body: ar ? 'النشر وقياس الأداء يحتاجان حسابات ومنصات متصلة بصلاحيات واضحة.' : 'Publishing and measurement require connected accounts with clear permissions.',
        cta: ar ? 'فتح الربط' : 'Open Connections',
      }
    }
    return {
      href: '/analytics',
      title: ar ? 'راقب الأداء عند توفر التحليلات' : 'Monitor performance when analytics exists',
      body: ar ? 'التعلّم الحقيقي يبدأ فقط بعد وصول بيانات أداء من المنشورات أو الحملات.' : 'Real learning starts only after published content or campaigns collect performance data.',
      cta: ar ? 'فتح التحليلات' : 'Open Analytics',
    }
  }, [ar, brandReadiness?.ready, brandTruthBlocked, campaignCount, contentCount, executionAction, manualScheduled, platformConnected, publishedCount, topCampaign])

  const commandCampaign = ownerCommand?.campaignId
    ? campaigns.find(campaign => campaign.id === ownerCommand.campaignId)
    : null
  const ownerCommandRelevant = Boolean(
    ownerCommand
    && (
      !['COMPLETED', 'FAILED', 'CANCELLED'].includes(ownerCommand.status)
      || commandCampaign?.status === 'DRAFT'
    ),
  )
  const ownerStartEligible = brandUsable && campaignCount === 0 && !ownerCommandRelevant
  const effectiveAction = useMemo(() => {
    if (!ownerCommand || !ownerCommandRelevant) return nextAction

    if (ownerCommand.status === 'COMPLETED') {
      return {
        href: ownerCommand.campaignId ? `/campaigns/${ownerCommand.campaignId}` : '/campaigns',
        title: ar ? 'استراتيجيتك جاهزة للمراجعة' : 'Your strategy is ready for review',
        body: ar
          ? 'أكمل NEXUS الاستراتيجية ومسار التنفيذ الأولي. راجع القرار الآن؛ لم يحدث نشر أو إنفاق إعلاني.'
          : 'NEXUS completed the strategy and initial execution path. Review the decision now; nothing was published and no ad budget was spent.',
        cta: ar ? 'راجع الاستراتيجية' : 'Review strategy',
      }
    }

    if (ownerCommand.status === 'FAILED' || ownerCommand.status === 'CANCELLED') {
      const refundCopy = ownerCommand.refunded === true
        ? (ar ? ' تم تأكيد إعادة الكريديت المحجوز.' : ' Reserved credits were confirmed returned.')
        : ''
      return {
        href: ownerCommand.campaignId ? `/campaigns/${ownerCommand.campaignId}` : '/campaigns',
        title: ar ? 'توقف التجهيز قبل اكتمال الاستراتيجية' : 'Preparation stopped before completion',
        body: `${ownerCommand.message || (
          ar ? 'يمكن إعادة المحاولة بأمان على نفس المسودة.' : 'You can safely retry on the same draft.'
        )}${refundCopy}`,
        cta: ar ? 'إعادة المحاولة بأمان' : 'Retry safely',
      }
    }

    return {
      href: ownerCommand.campaignId ? `/campaigns/${ownerCommand.campaignId}` : '/campaigns',
      title: ar ? 'NEXUS يجهّز حملتك الآن' : 'NEXUS is preparing your campaign',
      body: ar
        ? 'العمل محفوظ في الخلفية ويمكنك مغادرة الصفحة. ستعود هنا للمراجعة فقط، ولن يحدث نشر أو إنفاق.'
        : 'The work is durable in the background, so you can leave this page. You will return for review only; nothing will be published or spent.',
      cta: ar ? 'فتح مسار الحملة' : 'Open campaign workstream',
    }
  }, [ar, nextAction, ownerCommand, ownerCommandRelevant])

  if (authLoading || workspaceGate === 'checking' || workspaceGate === 'noWorkspace') {
    return <DashboardGateSurface mode="loading" ar={ar} framed={!authLoading && isAuthenticated} />
  }

  if (workspaceGate === 'error') {
    return <DashboardGateSurface mode="error" ar={ar} framed={isAuthenticated} onRetry={() => setWorkspaceGateRetry(v => v + 1)} />
  }

  if (!isAuthenticated) return null

  if (loading) {
    return <DashboardGateSurface mode="loading" ar={ar} framed />
  }

  if (loadError) {
    return <DashboardGateSurface mode="error" ar={ar} framed onRetry={() => load()} />
  }

  return (
    <AppShell>
      <main className="nx-os-page nx-dashboard-page" dir={ar ? 'rtl' : 'ltr'}>
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'اليوم' : 'Today'}
            pageSubtitle={ar ? 'NEXUS يجهّز العمل؛ أنت تراجع فقط القرارات التي تحتاجك.' : 'NEXUS prepares the work; you only review decisions that need you.'}
            primaryHref={null}
            secondaryHref={null}
          />

          <SoftCard className="nx-dashboard-command overflow-hidden p-5 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
              <div dir={ar ? 'rtl' : 'ltr'}>
                <div className="nx-dashboard-ai-chip">
                  <span className="nx-ai-core" aria-hidden="true" />
                  {ar ? 'توصية NEXUS' : 'NEXUS recommends'}
                </div>
                <h2 className="mt-3.5 max-w-3xl text-[25px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[32px]">
                  {effectiveAction.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[13px] font-medium leading-6 text-slate-300">
                  {effectiveAction.body}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {ownerStartEligible ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerStartError(null)
                        setOwnerStarterOpen(true)
                      }}
                      className="nx-dashboard-command-action"
                    >
                      {effectiveAction.cta}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ) : ownerCommandRelevant && ownerCommand?.status === 'FAILED' ? (
                    <button
                      type="button"
                      disabled={ownerStartBusy}
                      onClick={() => void startOwnerCampaign(ownerCommand.outcome, ownerCommand)}
                      className="nx-dashboard-command-action disabled:cursor-wait disabled:opacity-60"
                    >
                      {ownerStartBusy
                        ? (ar ? 'جارٍ إعادة التشغيل…' : 'Restarting…')
                        : effectiveAction.cta}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <Link
                      href={effectiveAction.href}
                      className="nx-dashboard-command-action"
                    >
                      {effectiveAction.cta}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )}
                  <Link
                    href={topCampaign && scheduledWithEvidence > 0
                      ? `/campaigns/${topCampaign.id}/content-hub`
                      : '/approvals'}
                    className="nx-dashboard-command-secondary"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {topCampaign && scheduledWithEvidence > 0
                      ? (ar ? 'مراجعة المحتوى والأدلة' : 'Review content evidence')
                      : (ar ? 'فتح قراراتي' : 'Open my decisions')}
                  </Link>
                  <span className="text-[11px] font-semibold text-slate-400/90">
                    {ar ? `آخر تحديث ${timeStr}` : `Updated ${timeStr}`}
                  </span>
                </div>
              </div>

              <div className="nx-dashboard-command-side p-[18px]" dir={ar ? 'rtl' : 'ltr'}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-200">{ar ? 'حالة عمل NEXUS' : 'NEXUS work status'}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{ar ? 'جاهزية مبنية على عمل محفوظ فعليًا' : 'Readiness based on saved work'}</p>
                  </div>
                  <span className="font-mono text-[26px] font-semibold leading-none text-white" dir="ltr">
                    {workflowChecks.filter(Boolean).length}/5
                  </span>
                </div>
                <p className="mt-3 text-[11px] font-medium leading-5 text-slate-300">
                  {ar ? 'يعرض ما يستطيع NEXUS تشغيله الآن، وليس توقعًا للنتائج.' : 'Shows what NEXUS can run now—not a prediction of results.'}
                </p>
                <div className="mt-3 grid grid-cols-5 gap-2" aria-label={ar ? 'حالة مراحل مسار العمل' : 'Workflow stage status'}>
                  {workflowStages.map(stage => (
                    <div key={stage.label} className="min-w-0">
                      <span
                        className={`block h-1.5 rounded-full ${stage.ready ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.55)]' : 'bg-white/10'}`}
                        title={stage.ready ? (ar ? 'موثق' : 'Evidenced') : (ar ? 'بانتظار بيانات' : 'Waiting for data')}
                      />
                      <span className={`mt-1.5 block truncate text-center text-[8px] font-bold ${stage.ready ? 'text-cyan-100' : 'text-slate-500'}`}>
                        {stage.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SoftCard>

          <ContentRunway
            ar={ar}
            items={contentRunwayItems}
            summary={contentRunwaySummary}
          />

          <SoftCard className="nx-dashboard-intelligence relative p-5 sm:p-6">
            <Link
              href="/analytics"
              className="nx-workspace-button absolute end-5 top-5 hidden xl:inline-flex"
            >
              <BarChart3 className="h-4 w-4 text-[#5E63FF]" />
              {ar ? 'عرض تقرير النظام' : 'System report'}
            </Link>
            <div dir="ltr" className="grid min-h-[132px] gap-6 xl:grid-cols-[minmax(330px,0.76fr)_minmax(560px,1.24fr)] xl:items-center">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="nx-dashboard-orb">
                  <div className="absolute inset-3 rounded-full border border-white/65" />
                  <div className="absolute inset-8 rounded-full bg-white/25 blur-xl" />
                  <Sparkles className="relative h-8 w-8 text-white drop-shadow-[0_0_18px_rgba(94,99,255,0.8)]" />
                </div>
                <div className="min-w-0" dir={ar ? 'rtl' : 'ltr'}>
                  <div className="nx-ai-chip mb-3"><span className="nx-ai-core" aria-hidden="true" />{ar ? 'قراءة النظام الآن' : 'Live system read'}</div>
                  <h2 className="max-w-3xl text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[#0B1028] sm:text-[26px]">
                    {ar ? 'ملخص التشغيل' : 'Operating summary'}
                  </h2>
                  <p className="mt-2 max-w-xl text-[12px] leading-5 text-slate-600">
                    {ar
                      ? 'ملخص لحالة Brand Brain والاستراتيجية والمحتوى والتنفيذ والتعلّم. كل رقم هنا مرتبط بسجل فعلي.'
                      : 'A summary of Brand Brain, strategy, content, execution, and learning. Every number here traces to a real record.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  icon={<Activity className="h-5 w-5" />}
                  label={ar ? 'اكتمال سياق العلامة' : 'Brand context completeness'}
                  value={`${brandScore}%`}
                  helper={ar ? `${brandContextLabel} · لا يمثل أداء السوق` : `${brandContextLabel} · not market performance`}
                  accent="#10B981"
                />
                <MetricCard
                  icon={<Sparkles className="h-5 w-5" />}
                  label={ar ? 'تغطية دورة التشغيل' : 'Operating loop coverage'}
                  value={`${workflowCoverage}%`}
                  helper={ar ? `${workflowChecks.filter(Boolean).length} من 5 مراحل موثقة` : `${workflowChecks.filter(Boolean).length} of 5 evidenced stages`}
                  accent="#7C3AED"
                />
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  label={ar ? 'سجلات التشغيل' : 'Operating records'}
                  value={contentCount + campaignCount}
                  helper={ar
                    ? `الحملات: ${campaignCount} · المنشورات: ${contentCount}`
                    : `${campaignCount} ${campaignCount === 1 ? 'campaign' : 'campaigns'} · ${contentCount} ${contentCount === 1 ? 'post' : 'posts'}`}
                  accent="#2563EB"
                />
                <MetricCard
                  icon={<Radio className="h-5 w-5" />}
                  label={ar ? 'نشر خارجي موثق' : 'Provider-verified publications'}
                  value={externallyPublished}
                  helper={ar ? 'يتطلب مرجع نشر صادرًا من المنصة' : 'Requires a provider publication reference'}
                  accent="#F59E0B"
                />
              </div>
            </div>
          </SoftCard>

          <div dir="ltr" className="grid grid-cols-1 gap-5 xl:grid-cols-[0.72fr_1.28fr]">
            <SoftCard className="nx-dashboard-panel p-5" dir="ltr">
              <div className="mb-3 flex items-center justify-between">
                <Link href="/brand" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5E63FF]">
                  {ar ? 'عرض تفاصيل Brand Brain' : 'View Brand Brain'}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5E63FF]">Brand Brain</p>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-[#0B1028]">{ar ? 'اكتمال سياق العلامة' : 'Brand context completeness'}</h3>
                </div>
              </div>
              <div className="grid items-center gap-4 md:grid-cols-[124px_1fr]">
                <div className="flex justify-center">
                  <CircularScore
                    score={brandScore}
                    label={brandContextLabel}
                    helper=""
                  />
                </div>
                <div className="space-y-2 text-right" dir={ar ? 'rtl' : 'ltr'}>
                  {[
                    { label: ar ? 'الحقول الأساسية' : 'Required context', value: `${requiredBrandFields}/5`, good: requiredBrandFields === 5 },
                    { label: ar ? 'السياق الداعم' : 'Supporting context', value: `${recommendedBrandFields}/5`, good: recommendedBrandFields === 5 },
                    { label: ar ? 'وثيقة استراتيجية' : 'Strategy document', value: strategyAvailable ? (ar ? 'متاحة' : 'Available') : (ar ? 'غير متاحة' : 'Missing'), good: strategyAvailable },
                    {
                      label: ar ? 'اتصالات المنصات' : 'Platform connections',
                      value: linkedAccountCount > 0
                        ? (ar
                            ? `${linkedAccountCount} هوية محفوظة · ${deliveryReadyCount} بصلاحية نشر مثبتة`
                            : `${linkedAccountCount} identities saved · ${deliveryReadyCount} publish-ready`)
                        : (ar ? 'لا توجد' : 'None'),
                      good: deliveryReadyCount > 0,
                    },
                    { label: ar ? 'دليل أداء' : 'Performance evidence', value: postsWithAnalytics > 0 ? String(postsWithAnalytics) : (ar ? 'بانتظار' : 'Waiting'), good: postsWithAnalytics > 0 },
                  ].map(item => (
                    <div key={item.label} className="grid grid-cols-[1fr_minmax(42px,auto)_8px] items-center gap-2 text-[12px]">
                      <span className="font-semibold text-slate-600">{item.label}</span>
                      <span className="text-left font-black text-[#0B1028]" dir="ltr">{item.value}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${item.good ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </SoftCard>

            <SoftCard className="nx-dashboard-panel overflow-hidden p-5 sm:p-6" dir="ltr">
              <div className="flex items-start justify-between gap-4">
                <Link href="/campaigns" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5E63FF]">
                  {ar ? 'عرض الكل' : 'View all'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Link>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5E63FF]">{ar ? 'أحدث الحملات' : 'Recent campaigns'}</p>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-[#0B1028]">{ar ? 'مسارات العمل الحالية' : 'Current workstreams'}</h3>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {campaigns.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                    <Target className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-3 text-[14px] font-bold text-slate-700">{ar ? 'لا توجد حملات بعد' : 'No campaigns yet'}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{ar ? 'حدّد هدفك وسيبني NEXUS مسودة حملة قابلة للمراجعة.' : 'Choose an outcome and NEXUS will build a reviewable campaign draft.'}</p>
                  </div>
                ) : campaigns.slice(0, 3).map((campaign) => {
                  const status = brandTruthBlocked
                    ? { ar: 'محجوبة حتى التصحيح', en: 'Blocked pending fix', color: '#c2410c', bg: '#fff7ed' }
                    : STATUS_MAP[campaign.status] || STATUS_MAP.DRAFT
                  const platform = getCampaignPlatformSummary(campaign.platforms, locale)
                  const goal = GOAL_MAP[campaign.goal]
                  const goalLabel = goal ? (ar ? goal.ar : goal.en) : campaign.goal
                  return (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}`}
                      className="nx-dashboard-row grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 p-2.5 md:grid-cols-[42px_minmax(0,1fr)_110px_110px]"
                    >
                      <div className="h-[42px] w-[42px] overflow-hidden rounded-[13px]">
                        <EmptyOrImage thumbnail={campaign.thumbnail} label={campaign.name} />
                      </div>
                      <div className="min-w-0 text-right" dir={ar ? 'rtl' : 'ltr'}>
                        <p className="truncate text-[14px] font-black text-[#0B1028]">{campaign.name}</p>
                        <p className="mt-1 truncate text-[12px] text-slate-500">
                          {platform.isEmpty ? platform.emptyLabel : platform.labels.slice(0, 3).join(' · ')}
                          <span className="md:hidden"> · {goalLabel}</span>
                        </p>
                      </div>
                      <div className="hidden min-w-0 text-center md:block">
                        <p className="text-[9px] font-bold text-slate-400">{ar ? 'الهدف' : 'Goal'}</p>
                        <p className="truncate text-[11px] font-black text-[#0B1028]">{goalLabel}</p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-center text-[10px] font-bold" style={{ background: status.bg, color: status.color }}>
                        {ar ? status.ar : status.en}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </SoftCard>

            <SoftCard id="approvals" className="hidden scroll-mt-6 p-4" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#5E63FF]">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'الخطوة الموصى بها' : 'Recommended next step'}</p>
                  <h3 className="text-[17px] font-black leading-6 text-[#0B1028]">{nextAction.title}</h3>
                </div>
              </div>
              <div className="rounded-[18px] border border-[#5E63FF]/18 bg-[#F5F7FF] px-4 py-3">
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600">
                  {ar ? 'فرصة عالية التأثير' : 'High-impact opportunity'}
                </span>
                <p className="mt-2 text-[12px] leading-5 text-slate-700">{nextAction.body}</p>
              </div>
              <Link
                href={nextAction.href}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#101A4D] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_16px_34px_rgba(16,26,77,0.18)]"
              >
                {nextAction.cta}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/analytics" className="mt-3 inline-flex w-full items-center justify-center text-[12px] font-bold text-[#5E63FF]">
                {ar ? 'عرض جميع التوصيات' : 'View all recommendations'}
              </Link>
            </SoftCard>
          </div>

          <div dir="ltr" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <SoftCard className="nx-dashboard-panel h-full p-5 sm:p-6" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5E63FF]">{ar ? 'نقاط تحقق التشغيل' : 'Operating checkpoints'}</p>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-[#0B1028]">{ar ? 'ما نعرفه وما ينتظر قراراً' : 'Evidence and pending decisions'}</h3>
                </div>
                <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-black text-[#5E63FF]" dir="ltr">
                  {workflowChecks.filter(Boolean).length}/5
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { title: 'Brand Brain', meta: brandTruthBlocked ? (ar ? 'المجال لا يطابق وصف النشاط' : 'Industry conflicts with the business description') : brandReadiness?.ready ? (ar ? 'السياق الأساسي جاهز' : 'Core context is ready') : (ar ? 'يحتاج استكمال السياق الأساسي' : 'Core context needs completion'), tone: brandTruthBlocked ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600', state: brandTruthBlocked ? (ar ? 'تعارض' : 'Conflict') : brandReadiness?.ready ? (ar ? 'جاهز' : 'Ready') : (ar ? 'يحتاج إدخالاً' : 'Needs input'), stateTone: brandTruthBlocked ? 'text-orange-700' : brandReadiness?.ready ? 'text-emerald-700' : 'text-amber-700' },
                  { title: ar ? 'الاستراتيجية' : 'Strategy', meta: strategyAvailable ? (ar ? 'يوجد سجل محفوظ، لكن صلاحيته تتبع Brand Brain الحالي' : 'A record exists, but its validity follows the current Brand Brain') : (ar ? 'لا يوجد سجل استراتيجية بعد' : 'No strategy record yet'), tone: 'bg-violet-50 text-violet-600', state: brandTruthBlocked && strategyAvailable ? (ar ? 'مرجعية فقط' : 'Reference only') : strategyAvailable ? (ar ? 'موثق' : 'Evidenced') : (ar ? 'الخطوة التالية' : 'Next step'), stateTone: brandTruthBlocked ? 'text-orange-700' : strategyAvailable ? 'text-emerald-700' : 'text-violet-700' },
                  { title: ar ? 'حزم المنشورات' : 'Post packages', meta: ar ? `السجلات المحفوظة في Content Hub: ${contentCount}` : `${contentCount} records saved in Content Hub`, tone: 'bg-[#EEF2FF] text-[#5E63FF]', state: brandTruthBlocked && contentCount > 0 ? (ar ? 'موقوفة للمراجعة' : 'Held for review') : contentCount > 0 ? (ar ? 'سجل موثق' : 'Verified record') : (ar ? 'لا توجد سجلات' : 'No records'), stateTone: brandTruthBlocked ? 'text-orange-700' : contentCount > 0 ? 'text-emerald-700' : 'text-slate-500' },
                  {
                    title: ar ? 'دليل خطة التنفيذ' : 'Execution schedule evidence',
                    meta: scheduledWithEvidence > 0
                      ? (ar
                          ? `قرارات الجدولة الداخلية: ${scheduledWithEvidence} · التسليم اليدوي: ${manualScheduled} · التلقائي المهيأ: ${autoDeliveryConfigured}`
                          : `${scheduledWithEvidence} evidenced internal schedules · ${manualScheduled} manual · ${autoDeliveryConfigured} auto configured`)
                      : (ar ? 'لا يوجد قرار جدولة ثابت حتى الآن' : 'No immutable scheduling decision yet'),
                    tone: 'bg-amber-50 text-amber-600',
                    state: scheduledWithEvidence > 0
                      ? (manualScheduled > 0 ? (ar ? 'داخلي · يدوي' : 'Internal · manual') : (ar ? 'موثق' : 'Evidenced'))
                      : (ar ? 'بانتظار قرار' : 'Waiting for decision'),
                    stateTone: scheduledWithEvidence > 0 ? 'text-violet-700' : 'text-amber-700',
                  },
                  { title: ar ? 'دليل الأداء' : 'Performance evidence', meta: postsWithAnalytics > 0 ? (ar ? `${postsWithAnalytics} منشور بتحليلات حقيقية` : `${postsWithAnalytics} posts with real analytics`) : (ar ? 'بانتظار تحليلات حقيقية' : 'Waiting for real analytics'), tone: 'bg-slate-100 text-slate-500', state: postsWithAnalytics > 0 ? (ar ? 'موثق' : 'Verified') : (ar ? 'بانتظار البيانات' : 'Waiting for data'), stateTone: postsWithAnalytics > 0 ? 'text-emerald-700' : 'text-slate-500' },
                ].map(item => (
                  <div key={item.title} className="nx-dashboard-row grid grid-cols-[42px_1fr_auto] items-center gap-3 px-3 py-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black text-[#0B1028]">{item.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{item.meta}</p>
                    </div>
                    <span className={`rounded-full bg-white px-2.5 py-1 text-[11px] font-bold ${item.stateTone}`}>{item.state}</span>
                  </div>
                ))}
              </div>
            </SoftCard>

            <SoftCard className="hidden" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'سجل مسار المحتوى' : 'Content workflow ledger'}</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'حالة السجلات الفعلية' : 'Actual record state'}</h3>
                </div>
                <FileText className="h-5 w-5 text-[#5E63FF]" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: ar ? 'حملات' : 'Campaigns', value: campaignCount },
                  { label: ar ? 'مسودات حملات' : 'Campaign drafts', value: draftCount },
                  { label: ar ? 'حزم منشورات' : 'Post packages', value: contentCount },
                  { label: ar ? 'سجل نشر' : 'Publish records', value: publishedCount },
                ].map((item, index) => (
                  <div key={item.label} className={`rounded-2xl border px-3 py-4 ${index === 3 ? 'border-[#5E63FF]/30 bg-[#F2F4FF]' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="text-[22px] font-black text-[#0B1028]" dir="ltr">{item.value}</div>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#5E63FF,#8B5CF6,#10B981)]"
                  style={{ width: `${workflowCoverage}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
                <span className="font-semibold text-slate-500">{ar ? 'إجمالي المحتوى' : 'Total content'}</span>
                <span className="font-black text-[#0B1028]" dir="ltr">{contentCount}</span>
              </div>
            </SoftCard>

            <SoftCard className="hidden" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'جاهزية النشر' : 'Publishing readiness'}</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'اكتمال قائمة التحقق' : 'Checklist completion'}</h3>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <CircularScore
                score={publishChecklistComplete * 50}
                label={ar ? `${publishChecklistComplete}/2 تحقق` : `${publishChecklistComplete}/2 checks`}
                helper={ar ? 'يجب توفر محتوى وحساب متصل؛ النشر نفسه يحتاج تأكيداً صريحاً.' : 'Content and a connected account are required; publishing still needs explicit confirmation.'}
              />
            </SoftCard>

            <SoftCard className="nx-dashboard-panel h-full p-5 sm:p-6" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5E63FF]">Nexus</p>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-[#0B1028]">{ar ? 'آخر إجراءات Nexus' : 'Latest Nexus actions'}</h3>
                </div>
                <Activity className="h-5 w-5 text-[#5E63FF]" />
              </div>
              {alerts.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center">
                  <Circle className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-[13px] font-bold text-slate-600">{ar ? 'لا يوجد نشاط حملة حديث' : 'No recent campaign activity'}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{ar ? 'سيظهر هنا النشاط الحقيقي فقط.' : 'Only real activity appears here.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.slice(0, 4).map(alert => (
                    <div key={alert.id} className="grid grid-cols-[42px_1fr] gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF] text-[#5E63FF]">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 border-b border-slate-100 pb-3">
                        <p className="truncate text-[12px] font-bold text-[#0B1028]">{ar ? (alert.bodyAr || alert.body) : (alert.bodyEn || alert.body)}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {alert.campaign ? `${alert.campaign} · ` : ''}{ar ? (alert.timeAr || alert.time) : (alert.timeEn || alert.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SoftCard>
          </div>

          <div dir="ltr" className="hidden">
            {[
              { icon: <CalendarDays className="h-5 w-5" />, label: ar ? 'وقت النشر المقترح اليوم' : 'Suggested posting time today', value: ar ? 'بانتظار بيانات نشر' : 'Waiting for publish data' },
              { icon: <BarChart3 className="h-5 w-5" />, label: ar ? 'منصات تحقق أفضل أداء' : 'Best-performing platforms', value: ar ? 'تظهر بعد Analytics' : 'Shown after analytics' },
              { icon: <Radio className="h-5 w-5" />, label: ar ? 'نوع المحتوى الأفضل أداء' : 'Best-performing content type', value: ar ? 'لا توجد بيانات أداء بعد' : 'No performance data yet' },
              { icon: <Sparkles className="h-5 w-5" />, label: ar ? 'الفرصة الأكبر' : 'Biggest opportunity', value: nextAction.title },
            ].map(card => (
              <SoftCard key={card.label} className="p-4" dir={ar ? 'rtl' : 'ltr'}>
                <div className="mb-3 flex items-center gap-3 text-[#5E63FF]">{card.icon}<span className="text-[12px] font-bold text-slate-500">{card.label}</span></div>
                <p className="text-[14px] font-black leading-6 text-[#0B1028]">{card.value}</p>
              </SoftCard>
            ))}
            <div className="flex items-center justify-between rounded-[24px] bg-[linear-gradient(135deg,#101A4D,#211B72)] px-5 py-4 text-white shadow-[0_20px_50px_rgba(16,26,77,0.22)]" dir={ar ? 'rtl' : 'ltr'}>
              <div>
                <p className="text-[14px] font-black">{ar ? 'مساعد Nexus' : 'Nexus Assistant'}</p>
                <p className="mt-1 text-[12px] text-white/70">{ar ? 'جاهز لمساعدتك' : 'Ready to help'}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </main>
      <OwnerCampaignStarterModal
        open={ownerStarterOpen}
        busy={ownerStartBusy}
        error={ownerStartError}
        locale={locale}
        authHeader={authHeader}
        onClose={() => {
          if (ownerStartBusy) return
          setOwnerStarterOpen(false)
          setOwnerStartError(null)
        }}
        onStart={outcome => {
          void startOwnerCampaign(outcome)
        }}
      />
    </AppShell>
  )
}
