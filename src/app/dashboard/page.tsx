'use client'

import AppShell from '@/components/AppShell'
import MarketingJourneyBar from '@/components/MarketingJourneyBar'
import RunFullStrategyModal from '@/components/RunFullStrategyModal'
import SuggestionsWidget from '@/components/SuggestionsWidget'
import OnboardingChecklist from '@/components/OnboardingChecklist'
import { getOnboardingVisibility } from '@/lib/dashboardOnboarding'
import BrainLearnedSummary from '@/components/brain/BrainLearnedSummary'
import PlatformReadinessStrip from '@/components/PlatformReadinessStrip'
import { derivePlatformReadiness } from '@/lib/platformReadiness'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getBrandBrainReadiness, BrandReadinessResult } from '@/lib/brandReadiness'
import { formatCreditDisplay } from '@/lib/creditDisplay'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, Rocket, Zap,
  ArrowUpRight, AlertTriangle, CheckCircle2,
  Target, Bell,
  Send, X,
  BarChart3, ChevronRight, Plus, Flame, Shield,
} from 'lucide-react'
import {
  NexusMetricCard,
  NexusButton,
  NexusStatusDot,
  NexusGlassCard,
} from '@/components/nexus-ui'

/* ═══════════════════════════════════════════════════════════════
   NEXUS DASHBOARD — مركز القيادة الذكي
   Design: NEXUS UI system — #06071A base, violet/orange accents
   ═══════════════════════════════════════════════════════════════ */

interface Stats {
  campaigns: number
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
interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success'
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
interface AIInsight {
  id: string
  text: string
  action: string
  href: string
  priority: 'high' | 'medium' | 'low'
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
}

// BETA: AGENT_DEFS (the decorative "AI squad" card data) removed along with the
// squad grid — it linked to pages hidden for beta and showed non-real statuses.

const STATUS_MAP: Record<string, { ar: string; en: string; color: string }> = {
  DRAFT:     { ar: 'مسودة',   en: 'Draft',     color: '#64748b' },
  ACTIVE:    { ar: 'نشطة',    en: 'Active',    color: '#10B981' },
  PAUSED:    { ar: 'متوقفة',  en: 'Paused',    color: '#EAB308' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed',  color: '#06B6D4' },
  ARCHIVED:  { ar: 'مؤرشفة', en: 'Archived',   color: '#374151' },
}

const ALERT_BG = {
  critical: { bg: 'rgba(244,63,94,0.06)',  border: 'rgba(244,63,94,0.2)' },
  warning:  { bg: 'rgba(234,179,8,0.06)',  border: 'rgba(234,179,8,0.2)' },
  info:     { bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)' },
  success:  { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
}

const ALERT_ICONS = {
  critical: <AlertTriangle className="w-4 h-4 text-rose-400" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info:     <Bell className="w-4 h-4" style={{ color: '#A78BFA' }} />,
  success:  <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
}

// ─────────────────────────────────────────────
export default function DashboardPage() {
  const { authHeader, user, isAuthenticated, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
  const ar = locale === 'ar'
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [intelligence, setIntelligence] = useState<MarketingIntelligenceBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasConnections, setHasConnections] = useState<boolean | null>(null)
  const [socialAccounts, setSocialAccounts] = useState<any[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [runStrategyOpen, setRunStrategyOpen] = useState(false)
  const [suggestionsKey, setSuggestionsKey] = useState(0)
  const [briefActionState, setBriefActionState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const suggestionsSectionRef = useRef<HTMLDivElement | null>(null)

  // Auto-open RunFullStrategy modal when redirected from Brand Brain (?runStrategy=1)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('runStrategy') === '1') {
      setRunStrategyOpen(true)
      // Clean up URL so back-button doesn't re-trigger
      router.replace('/dashboard', { scroll: false })
    }
    // Show welcome banner for first-time users
    if (!localStorage.getItem('nexus_welcome_v1')) {
      setWelcomeDismissed(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [brandReadiness, setBrandReadiness] = useState<BrandReadinessResult | null>(null)
  const [brandName, setBrandName] = useState<string | null>(null)
  const [brandLoaded, setBrandLoaded] = useState(false)
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(false)
  const [welcomeDismissed, setWelcomeDismissed] = useState(true) // true until localStorage checked

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  // New user: if no workspace exists → redirect to onboarding
  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/workspaces', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length === 0) {
          router.push('/onboarding')
        }
      })
      .catch(() => {})
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [statsRes, campaignsRes, intelligenceRes] = await Promise.allSettled([
        fetch('/api/dashboard/stats', { headers: { Authorization: authHeader() } }),
        fetch('/api/campaigns?limit=5&sort=updatedAt', { headers: { Authorization: authHeader() } }),
        fetch('/api/dashboard/intelligence', { headers: { Authorization: authHeader() } }),
      ])
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const d = await statsRes.value.json()
        setStats({
          campaigns: d.stats?.campaigns?.total ?? 0,
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
        if (d.activities?.length > 0) {
          // Display-level de-duplication only (no API/data change): collapse
          // identical activity rows — same agent + message + campaign — that the
          // feed sometimes returns more than once, then cap to 4 distinct items.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const seenAlertKeys = new Set<string>()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const distinctActivities = (d.activities as any[]).filter((a: any) => {
            const key = `${a.agent || ''}|${a.actionEn || a.action || ''}|${a.actionAr || ''}|${a.campaign || ''}`
            if (seenAlertKeys.has(key)) return false
            seenAlertKeys.add(key)
            return true
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAlerts(distinctActivities.slice(0, 4).map((a: any) => ({
            id: a.id || String(Math.random()), type: 'info' as const,
            title: a.agent || 'Nexus',
            body: a.actionAr || a.action || 'نشاط جديد',
            bodyAr: a.actionAr || a.action || 'نشاط جديد',
            bodyEn: a.actionEn || a.action || 'New activity',
            time: a.timeAr || a.time || 'الآن',
            timeAr: a.timeAr || a.time || 'الآن',
            timeEn: a.timeEn || a.time || 'now',
            agent: a.agent || 'NEX',
            campaign: a.campaign || '',
          })))
        }
      }
      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const d = await campaignsRes.value.json()
        setCampaigns(d.campaigns || [])
      }
      if (intelligenceRes.status === 'fulfilled' && intelligenceRes.value.ok) {
        const d = await intelligenceRes.value.json()
        setIntelligence(d.brief || null)
      }
      setLastUpdated(new Date())
    } catch {/* silent */}
    finally { setLoading(false) }
  }, [authHeader])

  useEffect(() => {
    fetch('/api/social/accounts', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then(d => {
        const accts = d.accounts || []
        setSocialAccounts(accts)
        setHasConnections(accts.length > 0)
      })
      .catch(() => { setSocialAccounts([]); setHasConnections(false) })
  }, [authHeader])

  useEffect(() => { load() }, [load])

  // Brand readiness — single fetch on mount after auth confirmed
  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/brand', { headers: { Authorization: authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setBrandReadiness(getBrandBrainReadiness(data.brandProfile))
          setBrandName(data.brandProfile?.brandName || null)
        }
      })
      .catch(() => {})
      .finally(() => setBrandLoaded(true))
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iv = setInterval(() => load(true), 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => {
    if (!stats) return
    const built: AIInsight[] = []
    const isAr = locale === 'ar'
    if (!hasConnections) built.push({ id: '1', priority: 'high',
      text:   isAr ? 'لم تربط أي منصة بعد — اربط Meta لجدولة المنشورات، ولرؤية الأداء عند توفر البيانات' : 'No platform connected yet — connect Meta to schedule posts and, once data is available, see performance',
      action: isAr ? 'ربط المنصات الآن' : 'Connect Platforms Now', href: '/connections' })
    if (stats.campaigns === 0) built.push({ id: '2', priority: 'high',
      text:   isAr ? 'أنشئ أول حملة — Nexus سيبني لك استراتيجية كاملة ومحتوى جاهز' : 'Create your first campaign — Nexus will build a full strategy and ready-to-use content',
      action: isAr ? 'خطة محتوى جديدة' : 'New Content Plan', href: '/campaigns/new' })
    if (stats.creditsRemaining < 15 && stats.plan !== 'ACTIVE') built.push({ id: '3', priority: 'high',
      text:   isAr ? `متبقي ${stats.creditsRemaining} وحدة AI فقط — الترقية تمنحك إمكانات غير محدودة` : `Only ${stats.creditsRemaining} AI credits left — upgrade for unlimited power`,
      action: isAr ? 'ترقية الخطة' : 'Upgrade Plan', href: '/billing' })
    if (stats.campaigns > 0 && stats.activeCampaigns === 0) built.push({ id: '4', priority: 'medium',
      text:   isAr ? 'كل حملاتك في وضع المسودة — فعّل PULSE لتحليل أفضل وقت للنشر' : 'All campaigns are drafts — activate PULSE to find the best publishing time',
      action: isAr ? 'فتح PULSE' : 'Open PULSE', href: '/analytics' })
    if (built.length === 0 && stats.campaigns > 0) built.push({ id: '5', priority: 'low',
      text:   isAr ? 'نظامك يعمل جيداً — راجع الأداء وخطّط حملتك التالية' : 'Your system is running well — review performance and plan your next campaign',
      action: isAr ? 'عرض التحليلات' : 'View Analytics', href: '/analytics' })
    setInsights(built)
  }, [stats, hasConnections, locale])

  const turnBriefIntoSuggestion = useCallback(async () => {
    setBriefActionState('saving')
    try {
      const res = await fetch('/api/dashboard/intelligence', {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json().catch(() => ({}))
      if (data?.skipped) {
        suggestionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setBriefActionState('idle')
        return
      }
      setBriefActionState('saved')
      setSuggestionsKey(k => k + 1)
      setTimeout(() => {
        suggestionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
      setTimeout(() => setBriefActionState('idle'), 4000)
    } catch {
      setBriefActionState('idle')
    }
  }, [authHeader])

  const actOnBriefNow = useCallback(() => {
    const href = intelligence?.nextBestAction.href
    if (!href || href === '/dashboard') {
      suggestionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    router.push(href)
  }, [intelligence?.nextBestAction.href, router])

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const timeStr = lastUpdated.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  // ── Onboarding surface consolidation ──
  // Decide which (if any) onboarding surface to show, by real user state, so
  // established users don't see beginner welcome/checklist clutter and so we
  // never flash a new-user state while the brand fetch is still in flight.
  const onboarding = getOnboardingVisibility({
    hasCampaigns: (stats?.campaigns ?? 0) > 0,
    brandReady: brandReadiness?.ready ?? false,
    hasBrandName: !!brandName,
    brandLoaded,
  })

  // ── Loading state ──
  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 relative">
              <div className="absolute inset-0 rounded-full border-2 border-[rgba(139,92,246,0.2)] border-t-[#8B5CF6] animate-spin" />
              <Sparkles className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: '#8B5CF6' }} />
            </div>
            <p className="text-[13px]" style={{ color: 'var(--nx-text-3)' }}>{t('common.loading')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  // Overflow-safe credit display: clamps the bar to 100% and, when the balance
  // exceeds the monthly grant (rollover / bonus / refunds), avoids the confusing
  // "246 of 150" by surfacing a bonus note instead.
  const creditDisp = formatCreditDisplay({
    availableCredits: stats?.creditsRemaining ?? 0,
    monthlyCredits: stats?.isUnlimited ? -1 : (stats?.creditsMonthlyTotal ?? 0),
    locale: ar ? 'ar' : 'en',
  })
  const creditPct = creditDisp.percent

  return (
    <AppShell>
      <div className="min-h-screen">
        {/* Ambient background grid */}
        <div className="nx-bg-grid pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 relative">

          {/* ── Header ── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <NexusStatusDot status="online" size="sm" pulse label="LIVE" />
                <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--nx-text-4)' }}>
                  {t('dashboard.updatedAt')} {timeStr}
                </span>
              </div>
              <h1 className="text-2xl font-bold font-heading mb-1" style={{ color: 'var(--nx-text-1)' }}>
                {displayName ? `${t('dashboard.greeting')}، ${displayName}` : t('dashboard.commandCenter')}
                {' '}<span style={{ color: 'var(--nx-text-3)' }}>👋</span>
              </h1>
              <p className="text-sm" style={{ color: 'var(--nx-text-3)' }}>
                {brandReadiness?.ready && brandName
                  ? (ar ? `عقل ${brandName} جاهز — الوكلاء يعرفون علامتك التجارية` : `${brandName}'s brain is ready — all agents know your brand`)
                  : t('dashboard.subtitle')}
              </p>
            </div>
            {/* Strategy-first hierarchy: exactly ONE filled primary action
                (Run Full Strategy) + one quiet secondary (New Content Plan).
                Strategy is the signature action of a strategist-led marketing OS —
                it puts the brand brain to work and feeds the rest of the loop.
                The manual refresh button was removed (auto-refresh every 5 min). */}
            <div className="flex items-center gap-2">
              <NexusButton
                variant="ghost"
                size="sm"
                href="/campaigns/new"
                icon={<Rocket className="w-3.5 h-3.5" />}
              >
                {t('dashboard.createCampaign')}
              </NexusButton>
              <NexusButton
                variant="primary"
                size="sm"
                onClick={() => setRunStrategyOpen(true)}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                <span className="hidden sm:inline">{t('runStrategy.btnDashboard')}</span>
                <span className="sm:hidden">{t('runStrategy.btnDashboard')}</span>
              </NexusButton>
            </div>
          </div>

          {/* ── Marketing Journey Bar ──
              The single compact next-action surface. Hidden during the brief
              brand-loading window so we don't flash step 1 for a returning user. */}
          {onboarding.showJourneyBar && (
            <MarketingJourneyBar
              brandReady={brandReadiness?.ready ?? false}
              hasCampaigns={(stats?.campaigns ?? 0) > 0}
              hasContent={(stats?.contentPostsTotal ?? 0) > 0}
              hasConnections={hasConnections ?? false}
              hasPublished={(stats?.publishedPostsTotal ?? 0) > 0}
              locale={locale}
            />
          )}

          {/* ── Platform Readiness strip (Operator Foundation PR-1A) ── */}
          <div className="mt-4">
            <PlatformReadinessStrip
              states={derivePlatformReadiness(socialAccounts)}
              t={t as (k: string) => string}
            />
          </div>

          {/* ── First-Login Welcome Banner — brand-new users only ── */}
          {onboarding.showWelcome && !welcomeDismissed && (
            <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8B5CF6, #F97316, #10B981)' }} />
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    🚀
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-slate-950 mb-1">
                      {ar
                        ? `مرحباً${displayName ? ` يا ${displayName}` : ''} في NEXUS AI 👋`
                        : `Welcome${displayName ? `, ${displayName}` : ''} to NEXUS AI 👋`}
                    </p>
                    <p className="text-[13px] text-slate-500 mb-3 leading-relaxed">
                      {ar
                        ? 'مساعدك التسويقي بالذكاء الاصطناعي — يضع الاستراتيجية، ويكتب المحتوى، ويساعدك على النشر. ابدأ من الخطوة الأولى في الأسفل.'
                        : 'Your AI marketing assistant — it plans strategy, drafts content, and helps you publish. Follow the steps below to get started.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a href="/brand"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-slate-100 text-slate-700"
                        style={{ border: '1px solid rgba(15,23,42,0.1)' }}
                        onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                      >
                        🧠 {ar ? 'Brand Brain' : 'Brand Brain'}
                      </a>
                      <a href="/campaigns/new"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-slate-100 text-slate-700"
                        style={{ border: '1px solid rgba(15,23,42,0.1)' }}
                        onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                      >
                        🎯 {ar ? 'أول حملة' : 'First campaign'}
                      </a>
                      <a href="/connections"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:bg-slate-100 text-slate-700"
                        style={{ border: '1px solid rgba(15,23,42,0.1)' }}
                        onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                      >
                        📡 {ar ? 'ربط المنصات' : 'Connect platforms'}
                      </a>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                  className="p-1.5 rounded-lg transition-all hover:bg-slate-100 flex-shrink-0 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}


          {/* ── Onboarding Checklist — brand-new users only ── */}
          {onboarding.showChecklist && (
            <OnboardingChecklist
              stats={stats ? {
                campaigns: stats.campaigns,
                publishedPostsTotal: stats.publishedPostsTotal,
                strategiesRun: stats.campaigns,
                contentPlans: stats.contentPostsTotal,
              } : null}
              brandReadiness={brandReadiness}
              hasConnections={hasConnections}
            />
          )}

          {/* ── Low Credits Upgrade Banner ── */}
          {stats?.lowCredits && !upgradeBannerDismissed && (
            <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(249,115,22,0.12)' }}>
                  <Zap className="w-4 h-4" style={{ color: '#F97316' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#F97316' }}>
                    {ar ? `${stats.creditsRemaining} وحدة AI متبقية فقط` : `Only ${stats.creditsRemaining} AI credits left`}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--nx-text-3)' }}>
                    {ar ? 'قرّب الانتهاء — الترقية تمنحك 200 وحدة / شهر' : 'Running low — upgrade for 200 credits/month'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <NexusButton variant="orange" size="xs" href="/billing" icon={<ArrowUpRight className="w-3 h-3" />}>
                  {ar ? 'ترقية الآن' : 'Upgrade Now'}
                </NexusButton>
                <button
                  onClick={() => setUpgradeBannerDismissed(true)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--nx-text-4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-4)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <NexusMetricCard
              label={t('dashboard.statCampaignLabel')}
              value={stats?.campaigns ?? 0}
              sub={`${stats?.activeCampaigns ?? 0} ${t('dashboard.thisMonth')}`}
              accentColor="#8B5CF6"
              icon={<Target className="w-3.5 h-3.5" />}
            />

            <NexusMetricCard
              label={ar ? 'منشورات' : 'Published'}
              value={stats?.publishedPostsTotal ?? 0}
              sub={`${stats?.publishedPostsThisMonth ?? 0} ${ar ? 'هذا الشهر' : 'this month'}`}
              accentColor="#F97316"
              icon={<Send className="w-3.5 h-3.5" />}
            />

            <NexusMetricCard
              label={t('dashboard.statGenerations')}
              value={stats?.totalGenerations ?? 0}
              sub={t('dashboard.allAgentsTotal')}
              accentColor="#10B981"
              icon={<Sparkles className="w-3.5 h-3.5" />}
            />

            {/* Credits with progress bar */}
            <NexusMetricCard
              label={t('dashboard.statCredits')}
              value={stats?.isUnlimited ? '∞' : (stats?.creditsRemaining ?? 0)}
              accentColor={stats?.lowCredits ? '#F97316' : '#06B6D4'}
              icon={<Zap className="w-3.5 h-3.5" />}
            >
              {!stats?.isUnlimited && (
                <>
                  <div className="w-full h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(15,23,42,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${creditPct}%`,
                        background: stats?.lowCredits
                          ? 'linear-gradient(90deg, #F97316, #EAB308)'
                          : 'linear-gradient(90deg, #10B981, #06B6D4)',
                      }}
                    />
                  </div>
                  <p className="text-[10px]" style={{ color: 'var(--nx-text-4)' }}>
                    {creditDisp.overGrant
                      ? (ar ? `خطتك: ${stats?.creditsMonthlyTotal ?? 0}/شهر · رصيد إضافي` : `Plan: ${stats?.creditsMonthlyTotal ?? 0}/mo · incl. bonus`)
                      : (ar ? `من ${stats?.creditsMonthlyTotal ?? 0} وحدة` : `of ${stats?.creditsMonthlyTotal ?? 0}`)}
                    {stats?.lowCredits && (
                      <Link href="/billing" className="ml-1 font-bold" style={{ color: '#F97316' }}>
                        {ar ? '· ترقية' : '· upgrade'}
                      </Link>
                    )}
                  </p>
                </>
              )}
              {stats?.isUnlimited && (
                <p className="text-[11px]" style={{ color: 'var(--nx-text-4)' }}>{t('dashboard.unlimitedCredits')}</p>
              )}
            </NexusMetricCard>
          </div>

          {/* ── Next Best Action (fallback) ──
              Guarantees one clear next step even before the server-driven
              Marketing Operating Brief loads (new users / API hiccup).
              Hidden once `intelligence` is present to avoid duplication. */}
          {!intelligence && insights.length > 0 && (
            <div className="rounded-2xl p-5 flex items-start gap-4"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(94,92,230,0.1)', border: '1px solid rgba(94,92,230,0.22)' }}>
                <ArrowUpRight className="w-5 h-5" style={{ color: '#5E5CE6' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#5E5CE6' }}>
                  {ar ? 'الخطوة التالية' : 'Next best action'}
                </p>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--nx-text-2)' }}>
                  {insights[0].text}
                </p>
                <Link href={insights[0].href}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white transition"
                  style={{ background: '#5E5CE6' }}>
                  {insights[0].action} <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* ── Marketing Operating Brief ── */}
          {intelligence && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 12px 36px rgba(15,23,42,0.08)' }}>
              <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #10b981)' }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div className="flex items-start gap-4 flex-1 min-w-[240px]">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.22)' }}>
                      <BarChart3 className="w-5 h-5" style={{ color: '#06B6D4' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold" style={{ color: 'var(--nx-text-1)' }}>
                          {ar ? 'موجز تشغيل التسويق' : 'Marketing Operating Brief'}
                        </p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.22)' }}>
                          {ar ? intelligence.stageAr : intelligence.stage}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed max-w-3xl" style={{ color: 'var(--nx-text-3)' }}>
                        {ar ? intelligence.summaryAr : intelligence.summary}
                      </p>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[170px]">
                    <div className="flex items-end justify-between gap-3 mb-2">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--nx-text-4)' }}>
                        {ar ? 'اكتمال ذاكرة العلامة' : 'Brand memory completeness'}
                      </span>
                      <span className="text-2xl font-bold" style={{ color: '#06B6D4' }}>{intelligence.maturityScore}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.08)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${intelligence.maturityScore}%`, background: 'linear-gradient(90deg, #06B6D4, #8B5CF6)' }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-1 rounded-xl p-4"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.14)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5E5CE6' }}>
                      {ar ? 'الخطوة التالية' : 'Next best action'}
                    </p>
                    <p className="text-sm font-bold mb-1" style={{ color: 'var(--nx-text-1)' }}>
                      {ar ? intelligence.nextBestAction.titleAr : intelligence.nextBestAction.title}
                    </p>
                    <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--nx-text-3)' }}>
                      {ar ? intelligence.nextBestAction.reasonAr : intelligence.nextBestAction.reason}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={actOnBriefNow}
                        className="inline-flex items-center gap-1 text-[11px] font-bold"
                        style={{ color: '#5E5CE6' }}>
                        {ar ? 'افتح الخطوة' : 'Open next step'} <ArrowUpRight className="w-3 h-3" />
                      </button>
                      {intelligence.nextBestAction.id !== 'review-suggestions' && (
                        <button
                          onClick={turnBriefIntoSuggestion}
                          disabled={briefActionState === 'saving'}
                          className="inline-flex items-center gap-1 text-[11px] font-bold disabled:opacity-60"
                          style={{ color: briefActionState === 'saved' ? '#10B981' : '#06B6D4' }}
                        >
                          {briefActionState === 'saving'
                            ? (ar ? 'جار الحفظ...' : 'Saving...')
                            : briefActionState === 'saved'
                            ? (ar ? 'تمت إضافتها للتوصيات' : 'Added to recommendations')
                            : (ar ? 'حوّلها لموافقة' : 'Queue for approval')}
                          <Sparkles className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed" style={{ color: 'var(--nx-text-4)' }}>
                      {ar
                        ? 'الزر يفتح مسار العمل المطلوب. التوصيات بالأسفل للموافقة فقط، وليست بديلا عن الخطوة الأساسية.'
                        : 'This opens the required workflow. Suggestions below are approvals, not the primary operating step.'}
                    </p>
                    {briefActionState === 'saved' && (
                      <div className="mt-3 rounded-xl px-3 py-2"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                        <p className="text-[11px] font-bold" style={{ color: '#059669' }}>
                          {ar ? 'تم إنشاء توصية جديدة في صندوق توصيات الوكلاء بالأسفل.' : 'A new agent recommendation was added below.'}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--nx-text-4)' }}>
                          {ar ? 'راجعها هناك ثم وافق عليها أو ارفضها.' : 'Review it there, then approve or reject it.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--nx-text-4)' }}>
                        {ar ? 'دورة التشغيل' : 'Operating loop'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'strategy', en: 'Strategy', ar: 'استراتيجية' },
                          { key: 'content', en: 'Content', ar: 'محتوى' },
                          { key: 'publishing', en: 'Publishing', ar: 'نشر' },
                          { key: 'learning', en: 'Learning', ar: 'تعلم' },
                        ].map(step => {
                          const active = intelligence.loop[step.key as keyof MarketingIntelligenceBrief['loop']]
                          return (
                            <div key={step.key} className="rounded-xl px-3 py-2 flex items-center gap-2"
                              style={{ background: active ? '#ECFDF5' : '#F9FAFB', border: `1px solid ${active ? 'rgba(16,185,129,0.18)' : 'rgba(15,23,42,0.08)'}` }}>
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: active ? '#059669' : '#CBD5E1' }} />
                              <span className="text-[11px]" style={{ color: active ? 'var(--nx-text-2)' : 'var(--nx-text-4)' }}>
                                {ar ? step.ar : step.en}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--nx-text-4)' }}>
                        {ar ? 'إشارات النظام' : 'System signals'}
                      </p>
                      <div className="space-y-2">
                        {intelligence.signals.slice(0, 4).map(signal => {
                          const color = signal.severity === 'good' ? '#10B981' : signal.severity === 'watch' ? '#EAB308' : '#F43F5E'
                          return (
                            <div key={signal.id} className="flex items-center justify-between gap-3 text-[11px]">
                              <span className="truncate" style={{ color: 'var(--nx-text-4)' }}>{ar ? signal.labelAr : signal.label}</span>
                              <span className="font-bold shrink-0" style={{ color }}>{ar ? signal.valueAr : signal.value}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Display-only: hide the 'pending-approvals' risk
                    ("Recommendations need decisions"). It duplicates the AI
                    Suggestions section, which is the single place to act on
                    suggestion decisions (its count lives in that section header).
                    The intelligence API/data is untouched — only this one risk is
                    filtered from the Brief's rendering; all other risks still show. */}
                {intelligence.risks.filter(r => r.id !== 'pending-approvals').length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {intelligence.risks.filter(r => r.id !== 'pending-approvals').map(risk => (
                      <div key={risk.id} className="inline-flex items-start gap-2 rounded-xl px-3 py-2 max-w-full md:max-w-[360px]"
                        style={{ background: 'rgba(249,115,22,0.055)', border: '1px solid rgba(249,115,22,0.14)' }}>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#F97316' }} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold" style={{ color: '#B45309' }}>{ar ? risk.titleAr : risk.title}</p>
                          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--nx-text-4)' }}>{ar ? risk.detailAr : risk.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AI Agents Status ──
              BETA: removed. The squad cards showed decorative "active/monitoring"
              statuses (not real data) and 3 of 4 linked to pages hidden for beta
              (/studio, /vex, /sentinel). Agents now surface only where they produce
              real output (strategy, content, analytics). Re-introduce only with live
              status data if needed. */}

          {/* ── What NEXUS Learned — one compact summary line (Operator Foundation PR-1B) ── */}
          <BrainLearnedSummary />

          {/* ── Sprint B: AI Suggestions Feed ── */}
          <div ref={suggestionsSectionRef} className="scroll-mt-6">
            <SuggestionsWidget refreshKey={suggestionsKey} />
          </div>

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Campaigns — 2 cols */}
            <NexusGlassCard className="lg:col-span-2" padding="lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                  <h3 className="font-bold text-sm" style={{ color: 'var(--nx-text-1)' }}>{t('dashboard.campaignsTitle')}</h3>
                </div>
                <Link
                  href="/campaigns"
                  className="flex items-center gap-1 text-[11px] transition-colors"
                  style={{ color: 'var(--nx-text-4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#A78BFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nx-text-4)' }}
                >
                  {t('dashboard.manageAll')} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                    <Plus className="w-6 h-6" style={{ color: 'rgba(139,92,246,0.4)' }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--nx-text-2)' }}>{t('dashboard.noCampaigns')}</p>
                  <p className="text-xs mb-5 max-w-[200px] mx-auto" style={{ color: 'var(--nx-text-4)' }}>{t('dashboard.noCampaignsDesc')}</p>
                  <NexusButton variant="primary" size="sm" href="/campaigns/new" icon={<Rocket className="w-4 h-4" />}>
                    {t('dashboard.createCampaign')}
                  </NexusButton>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {campaigns.map(c => {
                    const si = STATUS_MAP[c.status] || STATUS_MAP.DRAFT
                    return (
                      <Link key={c.id} href={`/campaigns/${c.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl transition-all group"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F9FAFB' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.12)' }}>
                          {c.thumbnail || '🎯'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate transition-colors" style={{ color: 'var(--nx-text-2)' }}>{c.name}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--nx-text-4)' }}>{c.platforms?.slice(0, 3).join(' · ') || '—'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <NexusStatusDot color={si.color} size="xs" pulse={c.status === 'ACTIVE'} />
                          <span className="text-[10px]" style={{ color: si.color }}>{locale === 'ar' ? si.ar : si.en}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </NexusGlassCard>

            {/* Right col */}
            <div className="space-y-4">

              {/* AI Insights */}
              <NexusGlassCard padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4" style={{ color: '#F97316' }} />
                  <h3 className="font-bold text-sm" style={{ color: 'var(--nx-text-1)' }}>{t('dashboard.aiInsights')}</h3>
                </div>
                {insights.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(16,185,129,0.4)' }} />
                    <p className="text-xs" style={{ color: 'var(--nx-text-4)' }}>{t('dashboard.allGood')}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {insights.map(ins => {
                      const colors = { high: '#8B5CF6', medium: '#10B981', low: '#06B6D4' }
                      const c = colors[ins.priority]
                      return (
                        <div key={ins.id} className="rounded-xl p-3" style={{ background: `${c}06`, border: `1px solid ${c}18` }}>
                          <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--nx-text-3)' }}>{ins.text}</p>
                          <Link href={ins.href} className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: c }}>
                            {ins.action} <ArrowUpRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </NexusGlassCard>

              {/* Alerts */}
              <NexusGlassCard padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4" style={{ color: '#10B981' }} />
                  <h3 className="font-bold text-sm" style={{ color: 'var(--nx-text-1)' }}>{t('sentinel.alertsTitle')}</h3>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-center py-6">
                    <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(16,185,129,0.3)' }} />
                    <p className="text-xs" style={{ color: 'var(--nx-text-4)' }}>{t('sentinel.noAlerts')}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--nx-text-4)' }}>{t('dashboard.sentinelMonitors')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.slice(0, 4).map(alert => {
                      const cols = ALERT_BG[alert.type]
                      const displayBody = ar ? (alert.bodyAr || alert.body) : (alert.bodyEn || alert.body)
                      const displayTime = ar ? (alert.timeAr || alert.time) : (alert.timeEn || alert.time)
                      return (
                        <div key={alert.id} className="rounded-xl p-3 flex gap-2.5"
                          style={{ background: cols.bg, border: `1px solid ${cols.border}` }}>
                          <div className="flex-shrink-0 mt-0.5">{ALERT_ICONS[alert.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>{displayBody}</p>
                            {alert.campaign && (
                              <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(167,139,250,0.6)' }}>{alert.campaign}</p>
                            )}
                            <p className="text-[9px] mt-0.5" style={{ color: 'var(--nx-text-4)' }}>{alert.agent} · {displayTime}</p>
                          </div>
                        </div>
                      )
                    })}
                    <Link
                      href="/analytics"
                      className="flex items-center justify-center gap-1 pt-1 text-[10px] transition-colors"
                      style={{ color: 'var(--nx-text-4)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#34D399' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nx-text-4)' }}
                    >
                      {t('dashboard.viewAllAlerts')} <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </NexusGlassCard>
            </div>
          </div>

        </div>
      </div>

      {/* Sprint A: Run Full Strategy modal */}
      <RunFullStrategyModal
        isOpen={runStrategyOpen}
        onClose={() => {
          setRunStrategyOpen(false)
          load(true)
        }}
        onSuccess={() => setSuggestionsKey(k => k + 1)}
      />
    </AppShell>
  )
}
