'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { getBrandBrainReadiness, type BrandReadinessResult } from '@/lib/brandReadiness'
import { getBrandIndicators } from '@/lib/brandIndicators'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { type PublishingState } from '@/lib/operatingBriefStatus'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import type { ExecutionQueueItem } from '@/lib/executionTruth'
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

type WorkspaceGateState = 'checking' | 'hasWorkspace' | 'noWorkspace' | 'error'

const STATUS_MAP: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  DRAFT: { ar: 'مسودة', en: 'Draft', color: '#64748b', bg: '#f8fafc' },
  ACTIVE: { ar: 'نشطة', en: 'Active', color: '#10b981', bg: '#ecfdf5' },
  PAUSED: { ar: 'متوقفة', en: 'Paused', color: '#d97706', bg: '#fffbeb' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed', color: '#2563eb', bg: '#eff6ff' },
  ARCHIVED: { ar: 'مؤرشفة', en: 'Archived', color: '#64748b', bg: '#f8fafc' },
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
    <div className="min-h-[70px] rounded-[16px] border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold leading-tight text-slate-500">{label}</div>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-xl"
          style={{ background: `${accent}14`, color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="mt-1 text-[22px] font-black leading-none tracking-normal text-[#0B1028]" dir="ltr">
        {value}
      </div>
      <p className="mt-1 text-[10px] leading-tight text-slate-500">{helper}</p>
    </div>
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
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [alerts, setAlerts] = useState<ActivityAlert[]>([])
  const [intelligence, setIntelligence] = useState<MarketingIntelligenceBrief | null>(null)
  const [executionAction, setExecutionAction] = useState<ExecutionQueueItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [hasConnections, setHasConnections] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [brandReadiness, setBrandReadiness] = useState<BrandReadinessResult | null>(null)
  const [brandCompletenessScore, setBrandCompletenessScore] = useState(0)
  const [brandName, setBrandName] = useState<string | null>(null)
  const [brandTruthBlocked, setBrandTruthBlocked] = useState(false)
  const [workspaceGate, setWorkspaceGate] = useState<WorkspaceGateState>('checking')
  const [workspaceGateRetry, setWorkspaceGateRetry] = useState(0)

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

    fetchWithTimeout('/api/workspaces', { headers: { Authorization: token } }, 6_000)
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
      const [statsRes, campaignsRes, intelligenceRes, brandRes, connectionsRes, executionRes] = await Promise.allSettled([
        fetchWithTimeout('/api/dashboard/stats', { headers: { Authorization: token } }, 9_000),
        fetchWithTimeout('/api/campaigns?limit=5&sort=updatedAt', { headers: { Authorization: token } }, 9_000),
        fetchWithTimeout('/api/dashboard/intelligence', { headers: { Authorization: token } }, 9_000),
        fetchWithTimeout('/api/brand', { headers: { Authorization: token } }, 9_000),
        fetchWithTimeout('/api/social/accounts', { headers: { Authorization: token } }, 9_000),
        fetchWithTimeout('/api/execution/queue', { headers: { Authorization: token } }, 9_000),
      ])

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

      if (intelligenceRes.status === 'fulfilled' && intelligenceRes.value.ok) {
        const d = await intelligenceRes.value.json() as IntelligenceResponse
        setIntelligence(d.brief || null)
      }

      if (brandRes.status === 'fulfilled' && brandRes.value.ok) {
        const data = await brandRes.value.json() as BrandResponse
        setBrandReadiness(getBrandBrainReadiness(data.brandProfile))
        setBrandCompletenessScore(getBrandIndicators(data.brandProfile).brandCompleteness.score)
        setBrandName(data.brandProfile?.brandName || null)
        setBrandTruthBlocked(reviewBrandTruthConsistency(data.brandProfile).status === 'blocked')
      }

      if (connectionsRes.status === 'fulfilled' && connectionsRes.value.ok) {
        const data = await connectionsRes.value.json() as { accounts?: unknown[] }
        setHasConnections(Array.isArray(data.accounts) && data.accounts.length > 0)
      }

      if (executionRes.status === 'fulfilled' && executionRes.value.ok) {
        const data = await executionRes.value.json() as ExecutionQueueResponse
        setExecutionAction(data.truth?.queue?.[0] ?? null)
      }

      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (workspaceGate !== 'hasWorkspace') return
    load()
  }, [load, workspaceGate])

  useEffect(() => {
    if (workspaceGate !== 'hasWorkspace') return
    const iv = setInterval(() => load(true), 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [load, workspaceGate])

  const timeStr = lastUpdated.toLocaleTimeString(ar ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  const topCampaign = campaigns[0]
  const platformConnected = hasConnections === true
  // Display the same core-profile completeness score used by Brand Brain.
  // getBrandBrainReadiness remains a functional generation gate and must not be
  // relabelled as completeness; the two answer different questions.
  const brandScore = brandCompletenessScore
  const contentCount = stats?.contentPostsTotal ?? 0
  const campaignCount = stats?.campaigns ?? campaigns.length
  const publishedCount = stats?.publishedPostsTotal ?? 0
  const postsWithAnalytics = stats?.postsWithAnalytics ?? 0
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
  const workflowChecks = [
    brandUsable,
    strategyAvailable && brandUsable,
    contentCount > 0 && brandUsable,
    platformConnected,
    postsWithAnalytics > 0,
  ]
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
    if (!brandName) {
      return {
        href: '/brand',
        title: ar ? 'أكمل Brand Brain أولاً' : 'Complete Brand Brain first',
        body: ar ? 'الاستراتيجية والمحتوى يصبحان أقوى عندما يعرف NEXUS السوق والجمهور والعرض.' : 'Strategy and content get stronger when NEXUS understands the market, audience, and offer.',
        cta: ar ? 'فتح Brand Brain' : 'Open Brand Brain',
      }
    }
    if (campaignCount === 0) {
      return {
        href: '/strategy',
        title: ar ? 'أنشئ استراتيجية تشغيل واضحة' : 'Create a clear operating strategy',
        body: ar ? 'ابدأ من الاستراتيجية قبل المحتوى أو التصميم حتى يبقى المسار منظمًا.' : 'Start with strategy before content or design so the workflow stays coherent.',
        cta: ar ? 'فتح الاستراتيجية' : 'Open Strategy',
      }
    }
    if (executionAction) {
      const monitorSchedule = executionAction.kind === 'MONITOR_SCHEDULE'
      const analyticsAction = executionAction.kind === 'SYNC_ANALYTICS'
        || executionAction.kind === 'REVIEW_PERFORMANCE'
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
  }, [ar, brandName, brandTruthBlocked, campaignCount, contentCount, executionAction, platformConnected, publishedCount, topCampaign])

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
      <div className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'اليوم' : 'Today'}
            pageSubtitle={ar ? 'قرار واحد واضح الآن، ثم يتحرك NEXUS معك إلى الخطوة التالية.' : 'One clear decision now, then NEXUS moves with you to the next step.'}
            primaryHref={nextAction.href}
            primaryLabel={nextAction.cta}
            secondaryHref="/approvals"
            secondaryLabel={ar ? 'الموافقات' : 'Approvals'}
          />

          <SoftCard className="overflow-hidden border-[#D9DEFF] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F7FF_62%,#EEF2FF_100%)] p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
              <div dir={ar ? 'rtl' : 'ltr'}>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D8DDFF] bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#5E63FF]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {ar ? 'قرارك التالي' : 'Your next decision'}
                </div>
                <h2 className="mt-3 max-w-3xl text-[24px] font-black leading-tight tracking-[-0.025em] text-[#0B1028] sm:text-[30px]">
                  {nextAction.title}
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] font-medium leading-6 text-slate-600">
                  {nextAction.body}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href={nextAction.href}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-5 text-[13px] font-black text-white shadow-[0_16px_34px_rgba(16,26,77,0.18)] transition hover:bg-[#18245B]"
                  >
                    {nextAction.cta}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {ar ? `آخر تحديث ${timeStr}` : `Updated ${timeStr}`}
                  </span>
                </div>
              </div>

              <div className="rounded-[20px] border border-white/80 bg-white/85 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]" dir={ar ? 'rtl' : 'ltr'}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-slate-500">{ar ? 'تغطية مسار العمل' : 'Workflow evidence'}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{ar ? 'مراحل تستند إلى سجلات حقيقية' : 'Stages backed by real records'}</p>
                  </div>
                  <span className="text-[28px] font-black leading-none text-[#0B1028]" dir="ltr">{workflowCoverage}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#5E63FF,#8B5CF6)]" style={{ width: `${workflowCoverage}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2" aria-label={ar ? 'حالة مراحل مسار العمل' : 'Workflow stage status'}>
                  {workflowChecks.map((ready, index) => (
                    <span
                      key={index}
                      className={`h-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      title={ready ? (ar ? 'موثق' : 'Evidenced') : (ar ? 'بانتظار بيانات' : 'Waiting for data')}
                    />
                  ))}
                </div>
              </div>
            </div>
          </SoftCard>

          <SoftCard className="hidden">
            <Link
              href="/analytics"
              className="absolute right-5 top-4 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[12px] font-bold text-slate-600 shadow-sm transition hover:border-[#5E63FF]/30 xl:inline-flex"
            >
              <BarChart3 className="h-4 w-4 text-[#5E63FF]" />
              {ar ? 'عرض تقرير النظام' : 'System report'}
            </Link>
            <div dir="ltr" className="grid min-h-[132px] gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(560px,1.28fr)] xl:items-center">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,#DDE4FF_0%,#AAB5FF_31%,rgba(94,99,255,0.42)_52%,transparent_72%)] shadow-[0_0_54px_rgba(94,99,255,0.34)]">
                  <div className="absolute inset-3 rounded-full border border-white/65" />
                  <div className="absolute inset-8 rounded-full bg-white/25 blur-xl" />
                  <Sparkles className="relative h-8 w-8 text-white drop-shadow-[0_0_18px_rgba(94,99,255,0.8)]" />
                </div>
                <div className="min-w-0" dir={ar ? 'rtl' : 'ltr'}>
                  <h2 className="max-w-3xl whitespace-nowrap text-[23px] font-black leading-tight tracking-normal text-[#0B1028] sm:text-[26px]">
                    {ar ? 'حالة نظام التسويق الذكي' : 'AI marketing system status'}
                  </h2>
                  <p className="mt-2 max-w-xl text-[12px] leading-5 text-slate-600">
                    {ar
                      ? 'يقرأ NEXUS السجلات المحفوظة عبر Brand Brain والاستراتيجية والمحتوى والربط والتحليلات. كل حالة هنا مرتبطة بدليل فعلي.'
                      : 'NEXUS reads saved records across Brand Brain, strategy, content, connections, and analytics. Every status here traces to real evidence.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MetricCard
                  icon={<Activity className="h-5 w-5" />}
                  label={ar ? 'اكتمال سياق العلامة' : 'Brand context completeness'}
                  value={`${brandScore}%`}
                  helper={brandContextLabel}
                  accent="#10B981"
                />
                <MetricCard
                  icon={<Sparkles className="h-5 w-5" />}
                  label={ar ? 'التغطية التشغيلية' : 'Workflow coverage'}
                  value={`${workflowCoverage}%`}
                  helper={ar ? `${workflowChecks.filter(Boolean).length} من 5 مراحل موثقة` : `${workflowChecks.filter(Boolean).length} of 5 evidenced stages`}
                  accent="#7C3AED"
                />
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  label={ar ? 'سجلات التشغيل' : 'Operating records'}
                  value={contentCount + campaignCount}
                  helper={ar ? `${campaignCount} حملات · ${contentCount} منشورات` : `${campaignCount} campaigns · ${contentCount} posts`}
                  accent="#2563EB"
                />
                <MetricCard
                  icon={<Zap className="h-5 w-5" />}
                  label={ar ? 'النشاطات المسجلة' : 'Recorded activities'}
                  value={alerts.length}
                  helper={ar ? 'من سجل النشاط الحقيقي' : 'From the activity ledger'}
                  accent="#F59E0B"
                />
              </div>
            </div>
          </SoftCard>

          <div dir="ltr" className="grid grid-cols-1 gap-4">
            <SoftCard className="hidden" dir="ltr">
              <div className="mb-3 flex items-center justify-between">
                <Link href="/brand" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5E63FF]">
                  {ar ? 'عرض تفاصيل Brand Brain' : 'View Brand Brain'}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-[#5E63FF]">Brand Brain</p>
                  <h3 className="mt-1 text-[17px] font-black text-[#0B1028]">{ar ? 'اكتمال سياق العلامة' : 'Brand context completeness'}</h3>
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
                    { label: ar ? 'حسابات متصلة' : 'Connected accounts', value: platformConnected ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No'), good: platformConnected },
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

            <SoftCard className="overflow-hidden p-4 sm:p-5" dir="ltr">
              <div className="flex items-start justify-between gap-4">
                <Link href="/campaigns" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5E63FF]">
                  {ar ? 'عرض الكل' : 'View all'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Link>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'الحملات النشطة' : 'Current campaigns'}</p>
                  <h3 className="mt-1 text-[17px] font-black text-[#0B1028]">{ar ? 'مسارات العمل الحالية' : 'Current workstreams'}</h3>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {campaigns.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                    <Target className="mx-auto h-9 w-9 text-slate-300" />
                    <p className="mt-3 text-[14px] font-bold text-slate-700">{ar ? 'لا توجد حملات بعد' : 'No campaigns yet'}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{ar ? 'ابدأ من الاستراتيجية لتوليد مسار عمل منظم.' : 'Start from strategy to create a coherent workflow.'}</p>
                  </div>
                ) : campaigns.slice(0, 3).map((campaign) => {
                  const status = brandTruthBlocked
                    ? { ar: 'محجوبة حتى التصحيح', en: 'Blocked pending fix', color: '#c2410c', bg: '#fff7ed' }
                    : STATUS_MAP[campaign.status] || STATUS_MAP.DRAFT
                  const platform = getCampaignPlatformSummary(campaign.platforms, locale)
                  const updatedLabel = new Date(campaign.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })
                  return (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}`}
                      className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-slate-200 bg-white p-2 transition hover:border-[#5E63FF]/30 hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)] md:grid-cols-[42px_minmax(0,1fr)_90px_72px]"
                    >
                      <div className="h-[42px] w-[42px] overflow-hidden rounded-[13px]">
                        <EmptyOrImage thumbnail={campaign.thumbnail} label={campaign.name} />
                      </div>
                      <div className="min-w-0 text-right" dir={ar ? 'rtl' : 'ltr'}>
                        <p className="truncate text-[14px] font-black text-[#0B1028]">{campaign.name}</p>
                        <p className="mt-1 truncate text-[12px] text-slate-500">
                          {platform.isEmpty ? platform.emptyLabel : platform.labels.slice(0, 3).join(' · ')}
                        </p>
                      </div>
                      <div className="hidden text-center md:block">
                        <p className="text-[9px] font-bold text-slate-400">{ar ? 'أُنشئت' : 'Created'}</p>
                        <p className="text-[12px] font-black text-[#0B1028]">{updatedLabel}</p>
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

          <div dir="ltr" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <SoftCard className="p-4" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'نقاط تحقق التشغيل' : 'Operating checkpoints'}</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'ما نعرفه وما ينتظر قراراً' : 'Evidence and pending decisions'}</h3>
                </div>
                <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-black text-[#5E63FF]" dir="ltr">
                  {workflowChecks.filter(Boolean).length}/5
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { title: 'Brand Brain', meta: brandTruthBlocked ? (ar ? 'المجال لا يطابق وصف النشاط' : 'Industry conflicts with the business description') : brandReadiness?.ready ? (ar ? 'السياق الأساسي جاهز' : 'Core context is ready') : (ar ? 'يحتاج استكمال السياق الأساسي' : 'Core context needs completion'), tone: brandTruthBlocked ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600', state: brandTruthBlocked ? (ar ? 'تعارض' : 'Conflict') : brandReadiness?.ready ? (ar ? 'جاهز' : 'Ready') : (ar ? 'يحتاج إدخالاً' : 'Needs input'), stateTone: brandTruthBlocked ? 'text-orange-700' : brandReadiness?.ready ? 'text-emerald-700' : 'text-amber-700' },
                  { title: ar ? 'الاستراتيجية' : 'Strategy', meta: strategyAvailable ? (ar ? 'يوجد سجل محفوظ، لكن صلاحيته تتبع Brand Brain الحالي' : 'A record exists, but its validity follows the current Brand Brain') : (ar ? 'لا يوجد سجل استراتيجية بعد' : 'No strategy record yet'), tone: 'bg-violet-50 text-violet-600', state: brandTruthBlocked && strategyAvailable ? (ar ? 'مرجعية فقط' : 'Reference only') : strategyAvailable ? (ar ? 'موثق' : 'Evidenced') : (ar ? 'الخطوة التالية' : 'Next step'), stateTone: brandTruthBlocked ? 'text-orange-700' : strategyAvailable ? 'text-emerald-700' : 'text-violet-700' },
                  { title: ar ? 'حزم المنشورات' : 'Post packages', meta: ar ? `${contentCount} سجل محفوظ في Content Hub` : `${contentCount} records saved in Content Hub`, tone: 'bg-[#EEF2FF] text-[#5E63FF]', state: brandTruthBlocked && contentCount > 0 ? (ar ? 'موقوفة للمراجعة' : 'Held for review') : contentCount > 0 ? (ar ? 'سجل موثق' : 'Verified record') : (ar ? 'لا توجد سجلات' : 'No records'), stateTone: brandTruthBlocked ? 'text-orange-700' : contentCount > 0 ? 'text-emerald-700' : 'text-slate-500' },
                  { title: ar ? 'جاهزية النشر العضوي' : 'Organic publishing readiness', meta: platformConnected ? (ar ? 'يوجد حساب نشر عضوي متصل واحد على الأقل' : 'At least one organic publishing account is connected') : (ar ? 'لا توجد حسابات نشر عضوي متصلة؛ حسابات الإعلانات تُراجع منفصلة في الربط' : 'No organic publishing accounts are connected; ad accounts are reviewed separately in Connections'), tone: 'bg-amber-50 text-amber-600', state: platformConnected ? (ar ? 'موثق' : 'Verified') : (ar ? 'مفقود' : 'Missing'), stateTone: platformConnected ? 'text-emerald-700' : 'text-amber-700' },
                  { title: ar ? 'دليل الأداء' : 'Performance evidence', meta: postsWithAnalytics > 0 ? (ar ? `${postsWithAnalytics} منشور بتحليلات حقيقية` : `${postsWithAnalytics} posts with real analytics`) : (ar ? 'بانتظار تحليلات حقيقية' : 'Waiting for real analytics'), tone: 'bg-slate-100 text-slate-500', state: postsWithAnalytics > 0 ? (ar ? 'موثق' : 'Verified') : (ar ? 'بانتظار البيانات' : 'Waiting for data'), stateTone: postsWithAnalytics > 0 ? 'text-emerald-700' : 'text-slate-500' },
                ].map(item => (
                  <div key={item.title} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
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

            <SoftCard className="p-4" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">Nexus</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'آخر إجراءات Nexus' : 'Latest Nexus actions'}</h3>
                </div>
                <Activity className="h-5 w-5 text-[#5E63FF]" />
              </div>
              {alerts.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center">
                  <Circle className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-[13px] font-bold text-slate-600">{ar ? 'لا يوجد نشاط حديث' : 'No recent activity'}</p>
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
                        <p className="mt-1 text-[11px] text-slate-400">{ar ? (alert.timeAr || alert.time) : (alert.timeEn || alert.time)}</p>
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
      </div>
    </AppShell>
  )
}
