'use client'

import AppShell from '@/components/AppShell'
import RunFullStrategyModal from '@/components/RunFullStrategyModal'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, Rocket, Zap,
  Globe, ArrowUpRight, AlertTriangle, CheckCircle2,
  Film, Megaphone, BarChart3, Shield, Plus,
  Target, Flame, Bell, ChevronRight, Wifi
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS DASHBOARD — مركز القيادة الذكي
   Design: bg-base #0A0E27, glass-card, accent-purple #6C63FF
   ═══════════════════════════════════════════════════════════════ */

interface Stats {
  campaigns: number
  activeCampaigns: number
  totalGenerations: number
  creditsRemaining: number
  plan: string
}
interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  body: string
  time: string
  agent: string
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

// Agent definitions — colors match landing page
const AGENT_DEFS = [
  { name: 'NEX',      role: 'dashboard.nexRole',      roleEn: 'dashboard.nexRole',      statusKey: 'dashboard.agentReady',     icon: Film,     color: '#00BFA6', glow: 'rgba(0,191,166,0.12)',  href: '/studio',    statusColor: '#00BFA6' },
  { name: 'VEX',      role: 'dashboard.vexRole',      roleEn: 'dashboard.vexRole',      statusKey: 'dashboard.agentActive',    icon: Megaphone,color: '#FF6B35', glow: 'rgba(255,107,53,0.12)', href: '/vex',                          statusColor: '#00BFA6' },
  { name: 'PULSE',    role: 'dashboard.pulseRole',    roleEn: 'dashboard.pulseRole',    statusKey: 'dashboard.agentAnalyzing', icon: BarChart3,color: '#00D4FF', glow: 'rgba(0,212,255,0.12)',  href: '/analytics',                    statusColor: '#FFB800' },
  { name: 'SENTINEL', role: 'dashboard.sentinelRole', roleEn: 'dashboard.sentinelRole', statusKey: 'dashboard.agentMonitoring',icon: Shield,   color: '#FFD700', glow: 'rgba(255,215,0,0.12)',  href: '/sentinel',                     statusColor: '#00BFA6' },
]

const STATUS_MAP: Record<string, { ar: string; en: string; color: string }> = {
  DRAFT:     { ar: 'مسودة',   en: 'Draft',     color: '#64748b' },
  ACTIVE:    { ar: 'نشطة',    en: 'Active',    color: '#00BFA6' },
  PAUSED:    { ar: 'متوقفة',  en: 'Paused',   color: '#FFB800' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed', color: '#00D4FF' },
  ARCHIVED:  { ar: 'مؤرشفة', en: 'Archived',  color: '#374151' },
}

const ALERT_ICONS = {
  critical: <AlertTriangle className="w-4 h-4 text-rose-400" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info:     <Bell className="w-4 h-4 text-cyan-400" />,
  success:  <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
}

const ALERT_BG = {
  critical: { bg: 'rgba(244,63,94,0.06)',   border: 'rgba(244,63,94,0.2)' },
  warning:  { bg: 'rgba(255,184,0,0.06)',   border: 'rgba(255,184,0,0.2)' },
  info:     { bg: 'rgba(108,99,255,0.06)',  border: 'rgba(108,99,255,0.2)' },
  success:  { bg: 'rgba(0,191,166,0.06)',   border: 'rgba(0,191,166,0.2)' },
}

// ─────────────────────────────────────────────
export default function DashboardPage() {
  const { authHeader, user, isAuthenticated, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

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
          plan: d.stats?.credits?.plan ?? 'FREE',
        })
        if (d.activities?.length > 0) {
          setAlerts(d.activities.slice(0, 4).map((a: Record<string,string>, i: number) => ({
            id: String(i), type: 'info' as const,
            title: a.agent || 'Nexus', body: a.action,
            time: a.time || 'الآن', agent: a.agent || 'NEX',
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

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 relative">
              <div className="absolute inset-0 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
              <Sparkles className="w-5 h-5 text-accent-purple absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-text-muted text-sm">{t('common.loading')}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  // Card style helpers
  const glassCard = { background: 'rgba(17,21,54,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(108,99,255,0.1)' }
  const glassCardHover = 'hover:border-[rgba(108,99,255,0.25)] hover:shadow-[0_8px_32px_rgba(108,99,255,0.15)] transition-all duration-300'

  return (
    <AppShell>
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse" style={{ boxShadow: '0 0 6px #00BFA6' }} />
                  <span className="text-[10px] font-mono tracking-widest text-accent-teal/70">LIVE</span>
                </div>
                <span className="text-[10px] text-text-muted font-mono">{t('dashboard.updatedAt')} {timeStr}</span>
              </div>
              <h1 className="text-2xl font-bold font-heading mb-1 text-white">
                {displayName ? `${t('dashboard.greeting')}، ${displayName}` : t('dashboard.commandCenter')}
                {' '}<span className="text-text-muted">👋</span>
              </h1>
              <p className="text-text-secondary text-sm">{t('dashboard.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => load(true)}
                className={`p-2.5 rounded-xl border border-[rgba(108,99,255,0.15)] text-text-muted hover:text-white hover:border-[rgba(108,99,255,0.3)] transition-all ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-4 h-4" />
              </button>
              {/* Sprint A: Run Full Strategy — re-triggers the full orchestration */}
              <button
                onClick={() => setRunStrategyOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                style={{ background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.4)', color: '#a5a0ff' }}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">{t('runStrategy.btnDashboard')}</span>
                <span className="sm:hidden">{t('runStrategy.btnDashboard')}</span>
              </button>
              <Link href="/campaigns/new" className="btn-gradient flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white">
                <Rocket className="w-4 h-4" />
                {t('dashboard.createCampaign')}
              </Link>
            </div>
          </div>

          {/* ── Connection Banner ── */}
          {hasConnections === false && (
            <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'rgba(0,191,166,0.05)', border: '1px solid rgba(0,191,166,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,191,166,0.1)' }}>
                  <Wifi className="w-4 h-4 text-accent-teal" />
                </div>
                <div>
                  <p className="text-sm font-bold text-accent-teal">{t('dashboard.connectPlatforms')}</p>
                  <p className="text-xs text-text-muted">Meta · TikTok · Google · LinkedIn · Snapchat</p>
                </div>
              </div>
              <Link href="/connections"
                className="text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5"
                style={{ background: 'rgba(0,191,166,0.1)', color: '#00BFA6', border: '1px solid rgba(0,191,166,0.2)' }}>
                {t('dashboard.connectAccounts')} <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('dashboard.statCampaignLabel'), value: stats?.campaigns ?? 0,       sub: `${stats?.activeCampaigns ?? 0} ${t('dashboard.thisMonth')}`,  icon: Target,   color: '#6C63FF' },
              { label: t('dashboard.statGenerations'),   value: stats?.totalGenerations ?? 0, sub: t('dashboard.allAgentsTotal'),  icon: Sparkles, color: '#00BFA6' },
              { label: t('dashboard.statCredits'),       value: stats?.creditsRemaining ?? 0, sub: stats?.plan === 'ACTIVE' ? t('dashboard.unlimitedCredits') : t('dashboard.remaining'), icon: Zap, color: '#00D4FF' },
              { label: t('dashboard.statPlatforms'),     value: hasConnections ? '✓' : '0',  sub: hasConnections ? t('dashboard.connected') : t('dashboard.connectNow'), icon: Globe, color: '#FFD700' },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className={`rounded-2xl p-5 relative overflow-hidden ${glassCardHover}`}
                  style={glassCard}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-20"
                    style={{ background: s.color }} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] text-text-muted font-medium leading-tight">{s.label}</p>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${s.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[11px] text-text-muted">{s.sub}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── AI Agents Status ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t('dashboard.aiAgents')}</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AGENT_DEFS.map(agent => {
                const Icon = agent.icon
                return (
                  <Link key={agent.name} href={agent.href}
                    className={`group rounded-2xl p-4 ${glassCardHover}`}
                    style={{ background: 'rgba(17,21,54,0.5)', border: `1px solid ${agent.color}20` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: agent.glow, border: `1px solid ${agent.color}30` }}>
                        <Icon className="w-4 h-4" style={{ color: agent.color }} />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: agent.statusColor, boxShadow: `0 0 5px ${agent.statusColor}` }} />
                        <span className="text-[9px] font-medium" style={{ color: agent.statusColor }}>{t(agent.statusKey)}</span>
                      </div>
                    </div>
                    <p className="font-bold text-sm mb-0.5" style={{ color: agent.color }}>{agent.name}</p>
                    <p className="text-[11px] text-text-muted mb-3">{t(agent.role)}</p>
                    <div className="flex items-center gap-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: agent.color }}>
                      {t('dashboard.launchAgent')} <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Campaigns — 2 cols */}
            <div className={`lg:col-span-2 rounded-2xl p-5 ${glassCardHover}`} style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-accent-purple" />
                  <h3 className="font-bold text-sm text-white">{t('dashboard.campaignsTitle')}</h3>
                </div>
                <Link href="/vex" className="text-[11px] text-text-muted hover:text-accent-purple transition flex items-center gap-1">
                  {t('dashboard.manageAll')} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.12)' }}>
                    <Plus className="w-6 h-6 text-accent-purple/40" />
                  </div>
                  <p className="text-sm font-semibold text-text-secondary mb-1">{t('dashboard.noCampaigns')}</p>
                  <p className="text-xs text-text-muted mb-5 max-w-[200px] mx-auto">{t('dashboard.noCampaignsDesc')}</p>
                  <Link href="/campaigns/new" className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white">
                    <Rocket className="w-4 h-4" />
                    {t('dashboard.createCampaign')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {campaigns.map(c => {
                    const si = STATUS_MAP[c.status] || STATUS_MAP.DRAFT
                    return (
                      <Link key={c.id} href={`/campaigns/${c.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.12)' }}>
                          {c.thumbnail || '🎯'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-secondary truncate group-hover:text-white transition">{c.name}</p>
                          <p className="text-[11px] text-text-muted truncate">{c.platforms?.slice(0, 3).join(' · ') || '—'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: si.color }} />
                          <span className="text-[10px]" style={{ color: si.color }}>{locale === 'ar' ? si.ar : si.en}</span>{/* STATUS_MAP keeps ar/en for brevity */}
                        </div>
                      </Link>
                    )
                  })}
                  <Link href="/vex"
                    className="flex items-center gap-2 px-3 py-2 mt-2 rounded-xl text-[11px] text-text-muted hover:text-text-secondary hover:bg-white/3 transition-all">
                    <Plus className="w-3.5 h-3.5" />
                    {t('dashboard.createCampaign')}
                  </Link>
                </div>
              )}
            </div>

            {/* Right col */}
            <div className="space-y-4">

              {/* AI Insights */}
              <div className={`rounded-2xl p-5 ${glassCardHover}`} style={glassCard}>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-accent-purple" />
                  <h3 className="font-bold text-sm text-white">{t('dashboard.aiInsights')}</h3>
                </div>
                {insights.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-accent-teal/40 mx-auto mb-2" />
                    <p className="text-xs text-text-muted">{t('dashboard.allGood')}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {insights.map(ins => {
                      const colors = { high: '#6C63FF', medium: '#00BFA6', low: '#00D4FF' }
                      const c = colors[ins.priority]
                      return (
                        <div key={ins.id} className="rounded-xl p-3" style={{ background: `${c}06`, border: `1px solid ${c}18` }}>
                          <p className="text-[11px] text-text-secondary leading-relaxed mb-2">{ins.text}</p>
                          <Link href={ins.href} className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: c }}>
                            {ins.action} <ArrowUpRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Alerts */}
              <div className={`rounded-2xl p-5 ${glassCardHover}`} style={glassCard}>
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-accent-teal" />
                  <h3 className="font-bold text-sm text-white">{t('sentinel.alertsTitle')}</h3>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-center py-6">
                    <Shield className="w-8 h-8 text-accent-teal/30 mx-auto mb-2" />
                    <p className="text-xs text-text-muted">{t('sentinel.noAlerts')}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{t('dashboard.sentinelMonitors')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.slice(0, 4).map(alert => {
                      const cols = ALERT_BG[alert.type]
                      return (
                        <div key={alert.id} className="rounded-xl p-3 flex gap-2.5"
                          style={{ background: cols.bg, border: `1px solid ${cols.border}` }}>
                          <div className="flex-shrink-0 mt-0.5">{ALERT_ICONS[alert.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-text-secondary leading-relaxed truncate">{alert.body}</p>
                            <p className="text-[9px] text-text-muted mt-0.5">{alert.agent} · {alert.time}</p>
                          </div>
                        </div>
                      )
                    })}
                    <Link href="/sentinel" className="flex items-center justify-center gap-1 pt-1 text-[10px] text-text-muted hover:text-accent-teal transition">
                      {t('dashboard.viewAllAlerts')} <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Access ── */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(17,21,54,0.3)', border: '1px solid rgba(108,99,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-accent-purple" />
              <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider">{t('dashboard.quickAccess')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'dashboard.quickNewCampaign',   href: '/campaigns/new', color: '#6C63FF' },
                { key: 'dashboard.quickVideoScript',   href: '/studio',        color: '#00BFA6' },
                { key: 'dashboard.quickAdCopy',        href: '/vex',           color: '#FF6B35' },
                { key: 'dashboard.quickAnalytics',     href: '/analytics',     color: '#00D4FF' },
                { key: 'dashboard.quickMarketWatch',   href: '/sentinel',      color: '#FFD700' },
                { key: 'dashboard.quickConnect',       href: '/connections',   color: '#00BFA6' },
              ].map(qa => (
                <Link key={qa.href} href={qa.href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
                  style={{ background: `${qa.color}08`, border: `1px solid ${qa.color}18`, color: qa.color }}>
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
          // Refresh dashboard data after a successful run
          load(true)
        }}
      />
    </AppShell>
  )
}
