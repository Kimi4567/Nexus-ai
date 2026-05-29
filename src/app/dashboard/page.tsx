'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, RefreshCw, Rocket, Eye, TrendingUp, Zap,
  Globe, Activity, ArrowUpRight, AlertTriangle, CheckCircle2,
  Clock, Film, Megaphone, BarChart3, Shield, Plus,
  Target, Flame, Bell, ChevronRight, Wifi
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS DASHBOARD — مركز القيادة الذكي
   Real-time overview: agents, campaigns, alerts, AI recommendations
   ═══════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────
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

// ── Static agent definitions ───────────────────────────────────
const AGENT_DEFS = [
  { name: 'NEX',      role: 'منتج الفيديو',     roleEn: 'Video Producer',    icon: Film,     color: '#f59e0b', glow: 'rgba(245,158,11,0.12)', href: '/studio',    status: 'جاهز',  statusEn: 'Ready',     statusColor: '#10b981' },
  { name: 'VEX',      role: 'مدير الإعلانات',   roleEn: 'Ads Manager',       icon: Megaphone,color: '#06b6d4', glow: 'rgba(6,182,212,0.12)',  href: '/vex',       status: 'نشط',   statusEn: 'Active',    statusColor: '#10b981' },
  { name: 'PULSE',    role: 'المحلل الذكي',     roleEn: 'Smart Analyst',     icon: BarChart3,color: '#8b5cf6', glow: 'rgba(139,92,246,0.12)', href: '/analytics', status: 'يحلّل', statusEn: 'Analyzing', statusColor: '#f59e0b' },
  { name: 'Sentinel', role: 'حارس العلامة',     roleEn: '24/7 Monitor',      icon: Shield,   color: '#10b981', glow: 'rgba(16,185,129,0.12)', href: '/sentinel',  status: 'يراقب', statusEn: 'Watching',  statusColor: '#10b981' },
]

const STATUS_MAP: Record<string, { ar: string; en: string; color: string }> = {
  DRAFT:     { ar: 'مسودة',   en: 'Draft',     color: '#64748b' },
  ACTIVE:    { ar: 'نشطة',    en: 'Active',    color: '#10b981' },
  PAUSED:    { ar: 'متوقفة',  en: 'Paused',    color: '#f59e0b' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed', color: '#06b6d4' },
  ARCHIVED:  { ar: 'مؤرشفة', en: 'Archived',  color: '#374151' },
}

const ALERT_ICONS = {
  critical: <AlertTriangle className="w-4 h-4 text-rose-400" />,
  warning:  <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info:     <Bell className="w-4 h-4 text-cyan-400" />,
  success:  <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
}

const ALERT_COLORS = {
  critical: { bg: 'rgba(244,63,94,0.06)',  border: 'rgba(244,63,94,0.2)' },
  warning:  { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
  info:     { bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.2)' },
  success:  { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
}

// ── Demo/placeholder alerts when no real data ──────────────────
const EMPTY_ALERTS: Alert[] = []

// ── Component ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { authHeader, user, isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState<Stats | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [alerts, setAlerts] = useState<Alert[]>(EMPTY_ALERTS)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasConnections, setHasConnections] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      // Load stats
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
        // Build alerts from activity data
        if (d.activities?.length > 0) {
          const builtAlerts: Alert[] = d.activities.slice(0, 4).map((a: any, i: number) => ({
            id: String(i),
            type: 'info' as const,
            title: a.agent || 'Nexus',
            body: a.action,
            time: a.time || 'الآن',
            agent: a.agent || 'NEX',
          }))
          setAlerts(builtAlerts)
        }
      }

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const d = await campaignsRes.value.json()
        setCampaigns(d.campaigns || [])
      }

      setLastUpdated(new Date())
    } catch {/* silent */}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [authHeader])

  // Check connections
  useEffect(() => {
    fetch('/api/social/accounts', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then(d => setHasConnections((d.accounts || []).length > 0))
      .catch(() => setHasConnections(false))
  }, [authHeader])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const iv = setInterval(() => load(true), 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [load])

  // Generate AI insights based on state
  useEffect(() => {
    const built: AIInsight[] = []
    if (!stats) return

    if (!hasConnections) {
      built.push({
        id: '1', priority: 'high',
        text: 'لم تربط أي منصة بعد — ربط Meta يفعّل النشر التلقائي وتحليل الأداء',
        action: 'ربط المنصات الآن', href: '/connections'
      })
    }
    if (stats.campaigns === 0) {
      built.push({
        id: '2', priority: 'high',
        text: 'أنشئ أول حملة — Nexus سيبني لك استراتيجية كاملة ومحتوى جاهز',
        action: 'إطلاق حملة', href: '/campaigns/new'
      })
    }
    if (stats.creditsRemaining < 15 && stats.plan !== 'ACTIVE') {
      built.push({
        id: '3', priority: 'high',
        text: `متبقي ${stats.creditsRemaining} وحدة AI فقط — الترقية تمنحك إمكانات غير محدودة`,
        action: 'ترقية الخطة', href: '/billing'
      })
    }
    if (stats.campaigns > 0 && stats.activeCampaigns === 0) {
      built.push({
        id: '4', priority: 'medium',
        text: 'كل حملاتك في وضع المسودة — فعّل PULSE لتحليل أفضل وقت للنشر',
        action: 'فتح PULSE', href: '/analytics'
      })
    }
    if (built.length === 0 && stats.campaigns > 0) {
      built.push({
        id: '5', priority: 'low',
        text: 'نظامك يعمل جيداً — Sentinel يراقب السوق والمنافسين ٢٤/٧',
        action: 'عرض التقرير', href: '/sentinel'
      })
    }
    setInsights(built)
  }, [stats, hasConnections])

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const timeStr = lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 relative">
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
              <Sparkles className="w-5 h-5 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-gray-500 text-sm">جاري التحميل...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── Header ── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 6px #10b981' }} />
                  <span className="text-[10px] text-emerald-400/70 font-mono tracking-widest">LIVE</span>
                </div>
                <span className="text-[10px] text-gray-600 font-mono">آخر تحديث {timeStr}</span>
              </div>
              <h1 className="text-2xl font-bold mb-1">
                {displayName ? `أهلاً، ${displayName}` : 'مركز القيادة'}
                {' '}<span className="text-gray-600">👋</span>
              </h1>
              <p className="text-gray-500 text-sm">كل ما يحتاجه عملك في مكان واحد</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => load(true)}
                className={`p-2.5 rounded-xl border border-white/8 text-gray-500 hover:text-white hover:border-white/15 transition-all ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link href="/campaigns/new"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-black transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <Rocket className="w-4 h-4" />
                حملة جديدة
              </Link>
            </div>
          </div>

          {/* ── Connection Banner ── */}
          {hasConnections === false && (
            <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-cyan-300">ربط المنصات / Connect Platforms</p>
                  <p className="text-xs text-gray-500">Meta · TikTok · Google · LinkedIn · Snapchat</p>
                </div>
              </div>
              <Link href="/connections"
                className="text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5"
                style={{ background: 'rgba(6,182,212,0.10)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.2)' }}>
                ربط الحسابات
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'الحملات / Campaigns', value: stats?.campaigns ?? 0, sub: `${stats?.activeCampaigns ?? 0} هذا الشهر`, icon: Target, color: '#f59e0b' },
              { label: 'توليدات AI / Generations', value: stats?.totalGenerations ?? 0, sub: 'إجمالي كل الوكلاء', icon: Sparkles, color: '#06b6d4' },
              { label: 'وحدات AI / Credits', value: stats?.creditsRemaining ?? 0, sub: stats?.plan === 'ACTIVE' ? 'غير محدود ∞' : 'متبقية', icon: Zap, color: '#8b5cf6' },
              { label: 'المنصات / Platforms', value: hasConnections ? '✓' : '0', sub: hasConnections ? 'متصل / Connected' : 'اربط الآن / Connect', icon: Globe, color: '#10b981' },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="rounded-2xl p-5 relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30"
                    style={{ background: s.color }} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] text-gray-500 font-medium leading-tight">{s.label}</p>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${s.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[11px] text-gray-600">{s.sub}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── AI Agents Status ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">الوكلاء الذكيون / AI Agents</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AGENT_DEFS.map(agent => {
                const Icon = agent.icon
                return (
                  <Link key={agent.name} href={agent.href}
                    className="group rounded-2xl p-4 transition-all hover:scale-[1.01]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${agent.color}20` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: agent.glow, border: `1px solid ${agent.color}30` }}>
                        <Icon className="w-4 h-4" style={{ color: agent.color }} />
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: agent.statusColor, boxShadow: `0 0 5px ${agent.statusColor}` }} />
                        <span className="text-[9px] font-medium" style={{ color: agent.statusColor }}>{agent.status}</span>
                      </div>
                    </div>
                    <p className="font-bold text-sm mb-0.5" style={{ color: agent.color }}>{agent.name}</p>
                    <p className="text-[11px] text-gray-500 mb-3">{agent.role}</p>
                    <div className="flex items-center gap-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: agent.color }}>
                      فتح الوكيل <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Campaigns — 2 cols */}
            <div className="lg:col-span-2 rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm">الحملات / Campaigns</h3>
                </div>
                <Link href="/vex" className="text-[11px] text-gray-500 hover:text-amber-400 transition flex items-center gap-1">
                  إدارة الكل <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <Plus className="w-6 h-6 text-amber-400/40" />
                  </div>
                  <p className="text-sm font-semibold text-gray-300 mb-1">لا توجد حملات بعد</p>
                  <p className="text-xs text-gray-600 mb-5 max-w-[200px] mx-auto">أطلق أول حملة وسيبني Nexus لك استراتيجية كاملة في دقائق</p>
                  <Link href="/campaigns/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <Rocket className="w-4 h-4" />
                    إطلاق أول حملة
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {campaigns.map(c => {
                    const si = STATUS_MAP[c.status] || STATUS_MAP.DRAFT
                    return (
                      <Link key={c.id} href={`/campaigns/${c.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/4 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-base flex-shrink-0">
                          {c.thumbnail || '🎯'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition">{c.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{c.platforms?.slice(0, 3).join(' · ') || '—'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: si.color }} />
                          <span className="text-[10px]" style={{ color: si.color }}>{si.ar}</span>
                        </div>
                      </Link>
                    )
                  })}
                  <Link href="/vex"
                    className="flex items-center gap-2 px-3 py-2 mt-2 rounded-xl text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/3 transition-all">
                    <Plus className="w-3.5 h-3.5" />
                    إضافة حملة جديدة / New Campaign
                  </Link>
                </div>
              )}
            </div>

            {/* Right col: Insights + Alerts */}
            <div className="space-y-4">

              {/* AI Insights */}
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm">توصيات AI / Insights</h3>
                </div>
                {insights.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">كل شيء يسير على ما يرام</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {insights.map(ins => {
                      const colors = { high: '#f59e0b', medium: '#06b6d4', low: '#10b981' }
                      const c = colors[ins.priority]
                      return (
                        <div key={ins.id} className="rounded-xl p-3" style={{ background: `${c}06`, border: `1px solid ${c}18` }}>
                          <p className="text-[11px] text-gray-300 leading-relaxed mb-2">{ins.text}</p>
                          <Link href={ins.href}
                            className="inline-flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: c }}>
                            {ins.action} <ArrowUpRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Alerts */}
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm">التنبيهات / Alerts</h3>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-center py-6">
                    <Shield className="w-8 h-8 text-emerald-400/30 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">لا توجد تنبيهات</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Sentinel يراقب ٢٤/٧</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.slice(0, 4).map(alert => {
                      const cols = ALERT_COLORS[alert.type]
                      return (
                        <div key={alert.id} className="rounded-xl p-3 flex gap-2.5"
                          style={{ background: cols.bg, border: `1px solid ${cols.border}` }}>
                          <div className="flex-shrink-0 mt-0.5">{ALERT_ICONS[alert.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-300 leading-relaxed truncate">{alert.body}</p>
                            <p className="text-[9px] text-gray-500 mt-0.5">{alert.agent} · {alert.time}</p>
                          </div>
                        </div>
                      )
                    })}
                    <Link href="/sentinel"
                      className="flex items-center justify-center gap-1 pt-1 text-[10px] text-gray-500 hover:text-cyan-400 transition">
                      عرض جميع التنبيهات <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Access Bar ── */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">وصول سريع / Quick Access</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'حملة جديدة', en: 'New Campaign', href: '/campaigns/new', color: '#f59e0b' },
                { label: 'سكريبت فيديو', en: 'Video Script', href: '/studio', color: '#f59e0b' },
                { label: 'نسخة إعلانية', en: 'Ad Copy', href: '/vex', color: '#06b6d4' },
                { label: 'تحليل الأداء', en: 'Analytics', href: '/analytics', color: '#8b5cf6' },
                { label: 'مراقبة السوق', en: 'Market Watch', href: '/sentinel', color: '#10b981' },
                { label: 'ربط المنصات', en: 'Connect', href: '/connections', color: '#06b6d4' },
              ].map(qa => (
                <Link key={qa.href} href={qa.href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
                  style={{ background: `${qa.color}08`, border: `1px solid ${qa.color}18`, color: qa.color }}>
                  {qa.label}
                  <span className="text-[9px] opacity-50">{qa.en}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
