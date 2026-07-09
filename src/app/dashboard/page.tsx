'use client'

import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getBrandBrainReadiness, getBrandReadinessCopy, type BrandReadinessResult, type BrandReadinessStatus } from '@/lib/brandReadiness'
import { getBrandMemoryStatusCopy, type PublishingState } from '@/lib/operatingBriefStatus'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import { formatCreditDisplay } from '@/lib/creditDisplay'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  FileText,
  Gauge,
  Layers3,
  Megaphone,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WalletCards,
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

interface BrandResponse {
  brandProfile?: Parameters<typeof getBrandBrainReadiness>[0]
  maturity?: {
    status?: BrandReadinessStatus
  }
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
}: {
  mode: 'loading' | 'error'
  ar: boolean
  onRetry?: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F4F7FB', color: '#0B1028' }}>
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
      className={`rounded-[20px] border border-slate-200/80 bg-white/90 shadow-[0_14px_42px_rgba(15,23,42,0.055)] ${className}`}
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

function MiniIcon({
  children,
  tone = 'violet',
}: {
  children: React.ReactNode
  tone?: 'violet' | 'blue' | 'amber' | 'green' | 'slate'
}) {
  const tones = {
    violet: 'bg-[#EEF2FF] text-[#5E63FF]',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  return <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{children}</div>
}

function ProgressLine({ value, color = '#5E63FF' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

export default function DashboardPage() {
  const { authHeader, user, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [alerts, setAlerts] = useState<ActivityAlert[]>([])
  const [intelligence, setIntelligence] = useState<MarketingIntelligenceBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasConnections, setHasConnections] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [brandReadiness, setBrandReadiness] = useState<BrandReadinessResult | null>(null)
  const [brandStatus, setBrandStatus] = useState<BrandReadinessStatus | null>(null)
  const [brandName, setBrandName] = useState<string | null>(null)
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

    fetch('/api/workspaces', { headers: { Authorization: token } })
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
    if (!silent) setLoading(true)
    try {
      const [statsRes, campaignsRes, intelligenceRes] = await Promise.allSettled([
        fetch('/api/dashboard/stats', { headers: { Authorization: token } }),
        fetch('/api/campaigns?limit=5&sort=updatedAt', { headers: { Authorization: token } }),
        fetch('/api/dashboard/intelligence', { headers: { Authorization: token } }),
      ])

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
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

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const d = await campaignsRes.value.json() as CampaignsResponse
        setCampaigns(d.campaigns || [])
      }

      if (intelligenceRes.status === 'fulfilled' && intelligenceRes.value.ok) {
        const d = await intelligenceRes.value.json() as IntelligenceResponse
        setIntelligence(d.brief || null)
      }

      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (workspaceGate !== 'hasWorkspace') return
    const token = authHeader()
    if (!token) return
    fetch('/api/social/accounts', { headers: { Authorization: token } })
      .then(r => r.json())
      .then((d: { accounts?: unknown[] }) => setHasConnections((d.accounts || []).length > 0))
      .catch(() => setHasConnections(false))
  }, [authHeader, workspaceGate])

  useEffect(() => {
    if (workspaceGate !== 'hasWorkspace') return
    load()
  }, [load, workspaceGate])

  useEffect(() => {
    if (!isAuthenticated || workspaceGate !== 'hasWorkspace') return
    const token = authHeader()
    if (!token) return
    fetch('/api/brand', { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : null)
      .then((data: BrandResponse | null) => {
        if (!data) return
        setBrandReadiness(getBrandBrainReadiness(data.brandProfile))
        setBrandStatus(data.maturity?.status ?? null)
        setBrandName(data.brandProfile?.brandName || null)
      })
      .catch(() => {})
  }, [authHeader, isAuthenticated, workspaceGate])

  useEffect(() => {
    if (workspaceGate !== 'hasWorkspace') return
    const iv = setInterval(() => load(true), 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [load, workspaceGate])

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const timeStr = lastUpdated.toLocaleTimeString(ar ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  const topCampaign = campaigns[0]
  const platformConnected = hasConnections === true
  const brandScore = brandReadiness?.score ?? 0
  const contentCount = stats?.contentPostsTotal ?? 0
  const campaignCount = stats?.campaigns ?? campaigns.length
  const publishedCount = stats?.publishedPostsTotal ?? 0
  const draftCount = stats?.draftCampaigns ?? campaigns.filter(c => c.status === 'DRAFT').length
  const creditDisp = formatCreditDisplay({
    availableCredits: stats?.creditsRemaining ?? 0,
    monthlyCredits: stats?.isUnlimited ? -1 : (stats?.creditsMonthlyTotal ?? 0),
    locale: ar ? 'ar' : 'en',
  })
  const setupScore = useMemo(() => {
    const brand = brandScore * 0.35
    const campaign = Math.min(campaignCount, 3) / 3 * 18
    const content = Math.min(contentCount, 14) / 14 * 22
    const publishing = platformConnected ? 15 : publishedCount > 0 ? 10 : 0
    const learning = publishedCount > 0 ? 10 : 0
    return Math.round(Math.max(0, Math.min(100, brand + campaign + content + publishing + learning)))
  }, [brandScore, campaignCount, contentCount, platformConnected, publishedCount])

  const brandCopy = getBrandReadinessCopy(brandStatus, locale, brandName)
  const brandMemory = getBrandMemoryStatusCopy(brandStatus)
  const publishingState = intelligence?.publishingState ?? (publishedCount > 0 ? 'live' : contentCount > 0 ? 'pending' : 'none')
  const nextAction = useMemo(() => {
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
  }, [ar, brandName, campaignCount, contentCount, platformConnected, publishedCount, topCampaign])

  const checks = [
    {
      label: ar ? 'ذاكرة Brand Brain' : 'Brand Brain memory',
      value: ar ? brandMemory.valueAr : brandMemory.value,
      good: brandMemory.severity === 'good',
    },
    {
      label: ar ? 'الاستراتيجية' : 'Strategy',
      value: campaignCount > 0 ? (ar ? 'موجودة' : 'Available') : (ar ? 'لم تبدأ' : 'Not started'),
      good: campaignCount > 0,
    },
    {
      label: ar ? 'المحتوى' : 'Content',
      value: contentCount > 0 ? (ar ? `${contentCount} عنصر` : `${contentCount} items`) : (ar ? 'لا يوجد' : 'None'),
      good: contentCount > 0,
    },
    {
      label: ar ? 'الربط' : 'Connections',
      value: platformConnected ? (ar ? 'متصل' : 'Connected') : (ar ? 'غير متصل' : 'Not connected'),
      good: platformConnected,
    },
  ]

  if (authLoading || workspaceGate === 'checking' || workspaceGate === 'noWorkspace') {
    return <DashboardGateSurface mode="loading" ar={ar} />
  }

  if (workspaceGate === 'error') {
    return <DashboardGateSurface mode="error" ar={ar} onRetry={() => setWorkspaceGateRetry(v => v + 1)} />
  }

  if (!isAuthenticated) return null

  if (loading) {
    return <DashboardGateSurface mode="loading" ar={ar} />
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#F4F7FB] text-[#0B1028]">
        <div className="mx-auto flex w-full max-w-[1620px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-7">
          <header dir="ltr" className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101A4D] text-white shadow-[0_16px_34px_rgba(16,26,77,0.20)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div dir={ar ? 'rtl' : 'ltr'}>
                <p className="text-[12px] font-semibold text-slate-500">{ar ? 'مساحة العمل' : 'Workspace'}</p>
                <h1 className="text-[18px] font-black tracking-normal text-[#0B1028]">
                  {ar ? 'نظام التسويق الذكي' : 'AI Marketing OS'}
                </h1>
              </div>
              <button type="button" className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 md:flex">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
              <div className="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-slate-400 lg:w-[360px]">
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate text-[13px]" dir={ar ? 'rtl' : 'ltr'}>{ar ? 'ابحث في Nexus...' : 'Search in Nexus...'}</span>
                <span className="ms-auto rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] text-slate-400">⌘K</span>
              </div>
              <Link href="/strategy" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#101A4D] px-4 text-[13px] font-bold text-white shadow-[0_16px_34px_rgba(16,26,77,0.18)]">
                <Plus className="h-4 w-4" />
                {ar ? 'عمل جديد' : 'New work'}
              </Link>
              <Link href="/brand" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#5E63FF]">
                <Sparkles className="h-4 w-4" />
              </Link>
              <Link href="/analytics" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                <Bell className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2" dir={ar ? 'rtl' : 'ltr'}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2FF] text-[13px] font-black text-[#5E63FF]">
                  {(displayName || 'N').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[#0B1028]">
                    {displayName ? (ar ? `مرحباً ${displayName}` : `Hi, ${displayName}`) : (ar ? 'مرحباً' : 'Welcome')}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{ar ? 'مدير النمو' : 'Growth operator'}</p>
                </div>
              </div>
            </div>
          </header>

          <SoftCard className="relative overflow-hidden p-4">
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
                      ? 'جميع الأنظمة تعمل كلوحة قيادة واحدة: استراتيجية، محتوى، إبداع، نشر وتحليلات بدون ادعاءات أداء غير مثبتة.'
                      : 'All systems work as one command center: strategy, content, creative, publishing, and analytics without unsupported performance claims.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MetricCard
                  icon={<Activity className="h-5 w-5" />}
                  label={ar ? 'الأداء العام' : 'Overall health'}
                  value={setupScore}
                  helper={ar ? 'ممتاز تشغيلياً' : 'Operating score'}
                  accent="#10B981"
                />
                <MetricCard
                  icon={<Sparkles className="h-5 w-5" />}
                  label={ar ? 'التغطية التشغيلية' : 'Workflow coverage'}
                  value={`${Math.min(100, Math.max(0, Math.round((contentCount > 0 ? 40 : 0) + (campaignCount > 0 ? 25 : 0) + (platformConnected ? 20 : 0) + (publishedCount > 0 ? 15 : 0))))}%`}
                  helper={ar ? 'جاهزية المسار' : 'Path readiness'}
                  accent="#7C3AED"
                />
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  label={ar ? 'المهام المكتملة' : 'Completed tasks'}
                  value={contentCount + campaignCount}
                  helper={ar ? 'هذا الأسبوع' : 'From system records'}
                  accent="#2563EB"
                />
                <MetricCard
                  icon={<Zap className="h-5 w-5" />}
                  label={ar ? 'التحسينات النشطة' : 'Active improvements'}
                  value={alerts.length}
                  helper={ar ? 'نشطة الآن' : 'Active now'}
                  accent="#F59E0B"
                />
              </div>
            </div>
          </SoftCard>

          <div dir="ltr" className="grid grid-cols-1 gap-4 xl:grid-cols-[1.06fr_1.48fr_1fr]">
            <SoftCard className="p-4" dir="ltr">
              <div className="mb-3 flex items-center justify-between">
                <Link href="/brand" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5E63FF]">
                  {ar ? 'عرض تفاصيل Brand Brain' : 'View Brand Brain'}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-[#5E63FF]">Brand Brain</p>
                  <h3 className="mt-1 text-[17px] font-black text-[#0B1028]">{ar ? 'نضج الذاكرة' : 'Memory maturity'}</h3>
                </div>
              </div>
              <div className="grid items-center gap-4 md:grid-cols-[124px_1fr]">
                <div className="flex justify-center">
                  <CircularScore
                    score={brandScore}
                    label={ar ? 'ممتاز' : 'Excellent'}
                    helper=""
                  />
                </div>
                <div className="space-y-2 text-right" dir={ar ? 'rtl' : 'ltr'}>
                  {[
                    { label: ar ? 'هوية العلامة' : 'Brand identity', value: brandScore },
                    { label: ar ? 'الجمهور والمشاعر' : 'Audience & emotion', value: Math.max(0, Math.min(100, brandScore - (platformConnected ? 4 : 12))) },
                    { label: ar ? 'الرسائل الرئيسية' : 'Core messages', value: Math.max(0, Math.min(100, brandScore - 6)) },
                    { label: ar ? 'المحتوى والمعرفة' : 'Content knowledge', value: Math.max(0, Math.min(100, contentCount > 0 ? 88 : 52)) },
                    { label: ar ? 'الاتجاهات والرؤى' : 'Insights & trends', value: Math.max(0, Math.min(100, publishedCount > 0 ? 84 : 48)) },
                  ].map(item => (
                    <div key={item.label} className="grid grid-cols-[1fr_42px_8px] items-center gap-2 text-[12px]">
                      <span className="font-semibold text-slate-600">{item.label}</span>
                      <span className="text-left font-black text-[#0B1028]" dir="ltr">{item.value}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${item.value >= 70 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </SoftCard>

            <SoftCard className="overflow-hidden p-4" dir="ltr">
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
                ) : campaigns.slice(0, 3).map((campaign, index) => {
                  const status = STATUS_MAP[campaign.status] || STATUS_MAP.DRAFT
                  const platform = getCampaignPlatformSummary(campaign.platforms, locale)
                  const progress = Math.max(28, Math.min(88, (contentCount > 0 ? 58 : 32) + index * 7 + (publishedCount > 0 ? 12 : 0)))
                  return (
                    <Link
                      key={campaign.id}
                      href={`/campaigns/${campaign.id}`}
                      className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-slate-200 bg-white p-2 transition hover:border-[#5E63FF]/30 hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)] md:grid-cols-[42px_minmax(0,1fr)_120px_58px_72px]"
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
                      <div className="hidden min-w-0 items-center gap-2 md:flex">
                        <ProgressLine value={progress} />
                        <span className="w-8 text-[11px] font-black text-slate-500" dir="ltr">{progress}%</span>
                      </div>
                      <div className="hidden text-center md:block">
                        <p className="text-[9px] font-bold text-slate-400">ROAS</p>
                        <p className="text-[12px] font-black text-[#0B1028]">--</p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-center text-[10px] font-bold" style={{ background: status.bg, color: status.color }}>
                        {ar ? status.ar : status.en}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </SoftCard>

            <SoftCard id="approvals" className="scroll-mt-6 p-4" dir={ar ? 'rtl' : 'ltr'}>
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

          <div dir="ltr" className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_1fr_0.86fr_0.86fr]">
            <SoftCard className="p-4" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'قائمة الموافقات' : 'Approvals queue'}</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'مواد تحتاج مراجعة' : 'Items needing review'}</h3>
                </div>
                <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-black text-[#5E63FF]" dir="ltr">
                  {Math.min(contentCount, 8)}
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { title: ar ? 'منشورات الحملة' : 'Campaign posts', meta: ar ? `${contentCount} عنصر للمراجعة` : `${contentCount} items for review`, tone: 'bg-[#EEF2FF] text-[#5E63FF]' },
                  { title: ar ? 'قرارات الوسائط' : 'Media decisions', meta: ar ? 'اربط الصورة النهائية من Content Hub' : 'Attach final media from Content Hub', tone: 'bg-amber-50 text-amber-600' },
                  { title: ar ? 'تعلم الأداء' : 'Performance learning', meta: ar ? 'بانتظار Analytics حقيقية' : 'Waiting for real analytics', tone: 'bg-slate-100 text-slate-500' },
                ].map(item => (
                  <div key={item.title} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-black text-[#0B1028]">{item.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{item.meta}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#5E63FF]">{ar ? 'مراجعة' : 'Review'}</span>
                  </div>
                ))}
              </div>
            </SoftCard>

            <SoftCard className="p-4" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'خط أنابيب المحتوى' : 'Content pipeline'}</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'من فكرة إلى جاهزية' : 'Idea to readiness'}</h3>
                </div>
                <FileText className="h-5 w-5 text-[#5E63FF]" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: ar ? 'أفكار' : 'Ideas', value: Math.max(0, campaignCount - contentCount) },
                  { label: ar ? 'تخطيط' : 'Planning', value: campaignCount },
                  { label: ar ? 'إنتاج' : 'Production', value: contentCount },
                  { label: ar ? 'جاهز للنشر' : 'Ready', value: publishedCount },
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
                  style={{ width: `${Math.max(8, Math.min(100, (contentCount > 0 ? 58 : 18) + (publishedCount > 0 ? 24 : 0) + (platformConnected ? 18 : 0)))}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
                <span className="font-semibold text-slate-500">{ar ? 'إجمالي المحتوى' : 'Total content'}</span>
                <span className="font-black text-[#0B1028]" dir="ltr">{contentCount}</span>
              </div>
            </SoftCard>

            <SoftCard className="p-4" dir={ar ? 'rtl' : 'ltr'}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-[#5E63FF]">{ar ? 'جاهزية النشر' : 'Publishing readiness'}</p>
                  <h3 className="mt-1 text-[18px] font-black text-[#0B1028]">{ar ? 'جاهز للنشر' : 'Ready to publish'}</h3>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <CircularScore
                score={Math.round((contentCount > 0 ? 40 : 0) + (platformConnected ? 35 : 0) + (publishedCount > 0 ? 25 : 0))}
                label={ar ? 'جاهزية' : 'Ready'}
                helper={ar ? 'نشر المنصات يتطلب ربطاً وتأكيداً صريحاً.' : 'Platform publishing requires connection and explicit confirmation.'}
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

          <div dir="ltr" className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_260px]">
            {[
              { icon: <CalendarDays className="h-5 w-5" />, label: ar ? 'أفضل وقت للنشر اليوم' : 'Best posting time today', value: ar ? 'بانتظار بيانات نشر' : 'Waiting for publish data' },
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
