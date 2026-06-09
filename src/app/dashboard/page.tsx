'use client'

import AppShell from '@/components/AppShell'
import RunFullStrategyModal from '@/components/RunFullStrategyModal'
import SuggestionsWidget from '@/components/SuggestionsWidget'
import OnboardingChecklist from '@/components/OnboardingChecklist'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getBrandBrainReadiness, BrandReadinessResult } from '@/lib/brandReadiness'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, Rocket, Zap,
  Globe, ArrowUpRight, AlertTriangle, CheckCircle2,
  Film, Megaphone, BarChart3, Shield, Plus,
  Target, Flame, Bell, ChevronRight, Wifi, Brain,
  TrendingUp, Send, X,
} from 'lucide-react'
import {
  NexusMetricCard,
  NexusAgentCard,
  NexusSectionHeader,
  NexusButton,
  NexusBadge,
  NexusStatusDot,
  NexusGlassCard,
} from '@/components/nexus-ui'
import type { AgentId } from '@/components/nexus-ui/NexusAgentAvatar'

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

// Agent definitions mapped to new NEXUS UI AgentId system
const AGENT_DEFS: Array<{
  agentId: AgentId
  name: string
  roleKey: string
  statusKey: string
  href: string
  accentColor: string
}> = [
  { agentId: 'nex',       name: 'NEX',      roleKey: 'dashboard.nexRole',      statusKey: 'dashboard.agentReady',      href: '/studio',    accentColor: '#06B6D4' },
  { agentId: 'vex',       name: 'VEX',      roleKey: 'dashboard.vexRole',      statusKey: 'dashboard.agentActive',     href: '/vex',       accentColor: '#F97316' },
  { agentId: 'pulse',     name: 'PULSE',    roleKey: 'dashboard.pulseRole',    statusKey: 'dashboard.agentAnalyzing',  href: '/analytics', accentColor: '#10B981' },
  { agentId: 'sentinel',  name: 'SENTINEL', roleKey: 'dashboard.sentinelRole', statusKey: 'dashboard.agentMonitoring', href: '/sentinel',  accentColor: '#EAB308' },
]

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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasConnections, setHasConnections] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [runStrategyOpen, setRunStrategyOpen] = useState(false)
  const [suggestionsKey, setSuggestionsKey] = useState(0)

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
  const [brandCardDismissed, setBrandCardDismissed] = useState(false)
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
    else setRefreshing(true)
    try {
      const [statsRes, campaignsRes] = await Promise.allSettled([
        fetch('/api/dashboard/stats', { headers: { Authorization: authHeader() } }),
        fetch('/api/campaigns?limit=5&sort=updatedAt', { headers: { Authorization: authHeader() } }),
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAlerts(d.activities.slice(0, 4).map((a: any) => ({
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
      setLastUpdated(new Date())
    } catch {/* silent */}
    finally { setLoading(false); setRefreshing(false) }
  }, [authHeader])

  useEffect(() => {
    fetch('/api/social/accounts', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then(d => setHasConnections((d.accounts || []).length > 0))
      .catch(() => setHasConnections(false))
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
      text:   isAr ? 'لم تربط أي منصة بعد — ربط Meta يفعّل النشر التلقائي وتحليل الأداء' : 'No platform connected yet — linking Meta enables auto-publishing and performance analytics',
      action: isAr ? 'ربط المنصات الآن' : 'Connect Platforms Now', href: '/connections' })
    if (stats.campaigns === 0) built.push({ id: '2', priority: 'high',
      text:   isAr ? 'أنشئ أول حملة — Nexus سيبني لك استراتيجية كاملة ومحتوى جاهز' : 'Create your first campaign — Nexus will build a full strategy and ready-to-use content',
      action: isAr ? 'إطلاق حملة' : 'Launch Campaign', href: '/campaigns/new' })
    if (stats.creditsRemaining < 15 && stats.plan !== 'ACTIVE') built.push({ id: '3', priority: 'high',
      text:   isAr ? `متبقي ${stats.creditsRemaining} وحدة AI فقط — الترقية تمنحك إمكانات غير محدودة` : `Only ${stats.creditsRemaining} AI credits left — upgrade for unlimited power`,
      action: isAr ? 'ترقية الخطة' : 'Upgrade Plan', href: '/billing' })
    if (stats.campaigns > 0 && stats.activeCampaigns === 0) built.push({ id: '4', priority: 'medium',
      text:   isAr ? 'كل حملاتك في وضع المسودة — فعّل PULSE لتحليل أفضل وقت للنشر' : 'All campaigns are drafts — activate PULSE to find the best publishing time',
      action: isAr ? 'فتح PULSE' : 'Open PULSE', href: '/analytics' })
    if (built.length === 0 && stats.campaigns > 0) built.push({ id: '5', priority: 'low',
      text:   isAr ? 'نظامك يعمل جيداً — Sentinel يراقب السوق والمنافسين ٢٤/٧' : 'Your system is running great — Sentinel is watching your market 24/7',
      action: isAr ? 'عرض التقرير' : 'View Report', href: '/sentinel' })
    setInsights(built)
  }, [stats, hasConnections, locale])

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const timeStr = lastUpdated.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })

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

  const creditPct = Math.min(100, Math.round(((stats?.creditsRemaining ?? 0) / (stats?.creditsMonthlyTotal ?? 15)) * 100))

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(true)}
                className="p-2.5 rounded-xl transition-all"
                style={{
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  color: 'var(--nx-text-3)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139,92,246,0.35)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139,92,246,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-3)' }}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <NexusButton
                variant="ghost"
                size="sm"
                onClick={() => setRunStrategyOpen(true)}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                <span className="hidden sm:inline">{t('runStrategy.btnDashboard')}</span>
                <span className="sm:hidden">{t('runStrategy.btnDashboard')}</span>
              </NexusButton>
              <NexusButton
                variant="primary"
                size="sm"
                href="/campaigns/new"
                icon={<Rocket className="w-3.5 h-3.5" />}
              >
                {t('dashboard.createCampaign')}
              </NexusButton>
            </div>
          </div>

          {/* ── First-Login Welcome Banner ── */}
          {!welcomeDismissed && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.35)', backdropFilter: 'blur(20px)', boxShadow: '0 0 48px rgba(139,92,246,0.1)' }}>
              <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #10b981, #f59e0b)' }} />
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                    style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 0 24px rgba(139,92,246,0.15)' }}>
                    🚀
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-white mb-1">
                      {ar
                        ? `مرحباً${displayName ? ` يا ${displayName}` : ''} في NEXUS AI 👋`
                        : `Welcome${displayName ? `, ${displayName}` : ''} to NEXUS AI 👋`}
                    </p>
                    <p className="text-sm mb-1" style={{ color: 'var(--nx-text-2)' }}>
                      {ar
                        ? 'قسم التسويق الذكي الكامل — استراتيجي، مخطط محتوى، ناشر تلقائي.'
                        : 'Your full AI marketing department — strategist, content planner, auto-publisher.'}
                    </p>
                    <p className="text-xs mb-3" style={{ color: 'var(--nx-text-4)' }}>
                      {ar
                        ? '⚡ ابدأ بإعداد Brand Brain — الوكلاء سيعرفون علامتك ويولدون محتوى مخصصاً 100%.'
                        : '⚡ Start with Brand Brain — agents will know your brand and generate 100% personalised content.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a href="/brand"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                        style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
                        onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                      >
                        🧠 {ar ? 'إعداد Brand Brain' : 'Set up Brand Brain'}
                      </a>
                      <a href="/campaigns/new"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                        style={{ background: 'rgba(6,182,212,0.1)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.2)' }}
                        onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                      >
                        🚀 {ar ? 'إنشاء حملة' : 'Create a campaign'}
                      </a>
                      <a href="/connections"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}
                        onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                      >
                        📡 {ar ? 'ربط المنصات' : 'Connect platforms'}
                      </a>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { localStorage.setItem('nexus_welcome_v1', '1'); setWelcomeDismissed(true) }}
                  className="p-1.5 rounded-lg transition-all hover:bg-white/5 flex-shrink-0"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Connection Banner ── */}
          {hasConnections === false && (
            <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <Wifi className="w-4 h-4" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#10B981' }}>{t('dashboard.connectPlatforms')}</p>
                  <p className="text-xs" style={{ color: 'var(--nx-text-4)' }}>Meta · TikTok · Google · LinkedIn · Snapchat</p>
                </div>
              </div>
              <NexusButton variant="ghost" size="xs" href="/connections" icon={<ArrowUpRight className="w-3 h-3" />}>
                {t('dashboard.connectAccounts')}
              </NexusButton>
            </div>
          )}

          {/* ── Brand Brain Incomplete Card ── */}
          {brandReadiness && !brandReadiness.ready && !brandCardDismissed && (() => {
            const bg = t('brandGate') as Record<string, string>
            const missing = brandReadiness.missingRequired.length
            return (
              <div className="rounded-2xl p-4 flex items-start justify-between flex-wrap gap-3"
                style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(249,115,22,0.1)' }}>
                    <Brain className="w-4 h-4" style={{ color: '#F97316' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#F97316' }}>{bg.dashCardTitle}</p>
                    <p className="text-xs mb-2" style={{ color: 'var(--nx-text-3)' }}>{bg.dashCardDesc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brandReadiness.missingRequired.slice(0, 4).map(key => (
                        <NexusBadge
                          key={key}
                          label={bg[`field${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? key}
                          variant="red"
                          size="xs"
                        />
                      ))}
                      {missing > 4 && (
                        <span className="text-[10px]" style={{ color: 'var(--nx-text-4)' }}>+{missing - 4}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <NexusButton variant="orange" size="xs" href="/brand">{bg.dashCardBtn}</NexusButton>
                  <button
                    onClick={() => setBrandCardDismissed(true)}
                    className="text-xs px-2 py-2 rounded-lg transition-all"
                    style={{ color: 'var(--nx-text-4)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-1)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-4)' }}
                  >
                    {bg.dashCardDismiss}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* ── Brand Ready — First Campaign CTA (only when brand complete + no campaigns yet) ── */}
          {brandReadiness?.ready && stats?.campaigns === 0 && brandName && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.25)', backdropFilter: 'blur(20px)', boxShadow: '0 0 40px rgba(139,92,246,0.06)' }}>
              <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #8b5cf6 50%, #10b981 100%)' }}/>
              <div className="p-5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 0 24px rgba(139,92,246,0.12)' }}>
                    <Brain className="w-6 h-6" style={{ color: '#8B5CF6' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white">
                        {ar ? `عقل ${brandName} جاهز ✓` : `${brandName}'s brain is ready ✓`}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                        {ar ? 'مفعّل' : 'Active'}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--nx-text-4)' }}>
                      {ar
                        ? 'كل الوكلاء يعرفون علامتك — أطلق أول حملة وشاهد الفرق'
                        : 'All agents know your brand — launch your first campaign and see the difference'}
                    </p>
                  </div>
                </div>
                <NexusButton variant="primary" size="sm" href="/campaigns/new" icon={<Rocket className="w-3.5 h-3.5" />}>
                  {ar ? 'إطلاق أول حملة' : 'Launch First Campaign'}
                </NexusButton>
              </div>
            </div>
          )}

          {/* ── Onboarding Checklist ── */}
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
                  <div className="w-full h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
                    {ar ? `من ${stats?.creditsMonthlyTotal ?? 15} وحدة` : `of ${stats?.creditsMonthlyTotal ?? 15}`}
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

          {/* ── Growth Insight Bar ── */}
          {stats && stats.campaigns > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}>
              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8B5CF6' }} />
              <p className="text-[11px]" style={{ color: 'var(--nx-text-4)' }}>
                {ar
                  ? `${stats.campaigns} حملة · ${stats.totalGenerations} توليد AI · ${stats.publishedPostsTotal} منشور منشور — الرحلة من الفكرة للنشر كاملة`
                  : `${stats.campaigns} campaign${stats.campaigns !== 1 ? 's' : ''} · ${stats.totalGenerations} AI generation${stats.totalGenerations !== 1 ? 's' : ''} · ${stats.publishedPostsTotal} post${stats.publishedPostsTotal !== 1 ? 's' : ''} published — idea to publish, end to end`}
              </p>
            </div>
          )}

          {/* ── AI Agents Status ── */}
          <div>
            <NexusSectionHeader
              label={ar ? 'فريق الذكاء الاصطناعي' : 'AI SQUAD'}
              title={t('dashboard.aiAgents')}
              icon={<Sparkles className="w-4 h-4" />}
              accentColor="#8B5CF6"
              className="mb-4"
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AGENT_DEFS.map(agent => (
                <NexusAgentCard
                  key={agent.agentId}
                  agentId={agent.agentId}
                  name={agent.name}
                  role={t(agent.roleKey)}
                  statusLabel={t(agent.statusKey)}
                  statusActive
                  href={agent.href}
                  accentColor={agent.accentColor}
                  launchLabel={t('dashboard.launchAgent')}
                />
              ))}
            </div>
          </div>

          {/* ── Sprint B: AI Suggestions Feed ── */}
          <SuggestionsWidget refreshKey={suggestionsKey} />

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
                  href="/vex"
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
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)' }}
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
                  <Link href="/vex"
                    className="flex items-center gap-2 px-3 py-2 mt-2 rounded-xl text-[11px] transition-all"
                    style={{ color: 'var(--nx-text-4)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nx-text-2)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--nx-text-4)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('dashboard.createCampaign')}
                  </Link>
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
                      href="/sentinel"
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

          {/* ── Quick Access ── */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(12,13,36,0.5)', border: '1px solid rgba(139,92,246,0.08)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5" style={{ color: '#8B5CF6' }} />
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--nx-text-4)' }}>
                {t('dashboard.quickAccess')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'dashboard.quickNewCampaign',  href: '/campaigns/new', color: '#8B5CF6' },
                { key: 'dashboard.quickVideoScript',  href: '/studio',        color: '#06B6D4' },
                { key: 'dashboard.quickAdCopy',       href: '/vex',           color: '#F97316' },
                { key: 'dashboard.quickAnalytics',    href: '/analytics',     color: '#10B981' },
                { key: 'dashboard.quickMarketWatch',  href: '/sentinel',      color: '#EAB308' },
                { key: 'dashboard.quickConnect',      href: '/connections',   color: '#10B981' },
              ].map(qa => (
                <Link
                  key={qa.href}
                  href={qa.href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: `${qa.color}08`, border: `1px solid ${qa.color}18`, color: qa.color }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = `${qa.color}14`
                    el.style.borderColor = `${qa.color}30`
                    el.style.transform = 'scale(1.02)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = `${qa.color}08`
                    el.style.borderColor = `${qa.color}18`
                    el.style.transform = ''
                  }}
                >
                  {t(qa.key)}
                </Link>
              ))}
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
