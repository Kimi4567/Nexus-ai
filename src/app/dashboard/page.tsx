'use client'

import AppShell from '@/components/AppShell'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import {
  Eye, MousePointer, Loader2, RefreshCw,
  Zap, TrendingUp, Globe, Sparkles, Activity, BarChart3,
  Rocket, Star, Film, Megaphone, Shield, Wand2,
  Plus, ArrowUpRight, Clock, CheckCircle2
} from 'lucide-react'
import { useDemoData } from '@/hooks/useDemoData'
import OnboardingWizard from '@/components/ui/OnboardingWizard'
import StarField from '@/components/ui/StarField'

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — Nexus Command Center
   ═══════════════════════════════════════════════════════════════ */

interface DashboardStats {
  campaigns: { total: number; thisMonth: number; change: number }
  generations: { total: number; thisMonth: number }
  credits: { remaining: number; plan: string }
}

interface Activity {
  id: string
  action: string
  agent: string
  campaign: string
  time: string
}

interface RecentCampaign {
  id: string
  name: string
  status: string
  thumbnail: string
  platforms: string[]
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'مسودة',   color: 'bg-white/5 text-gray-400 border-white/10' },
  ACTIVE:    { label: 'نشطة',    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  PAUSED:    { label: 'متوقفة',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  COMPLETED: { label: 'مكتملة', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  ARCHIVED:  { label: 'مؤرشفة', color: 'bg-white/3 text-gray-500 border-white/5' },
}

const AGENTS = [
  {
    name: 'NEX',
    role: 'منتج الفيديو',
    icon: Film,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.2)',
    status: 'جاهز',
    statusColor: '#10b981',
    href: '/studio',
    action: 'إنشاء فيديو',
    metric: '—',
    metricLabel: 'فيديو منتج',
  },
  {
    name: 'VEX',
    role: 'مدير الإعلانات',
    icon: Megaphone,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.15)',
    border: 'rgba(6,182,212,0.2)',
    status: 'نشط',
    statusColor: '#10b981',
    href: '/vex',
    action: 'إطلاق إعلان',
    metric: '—',
    metricLabel: 'حملة تعمل',
  },
  {
    name: 'PULSE',
    role: 'المحلل الذكي',
    icon: BarChart3,
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.2)',
    status: 'يحلّل',
    statusColor: '#f59e0b',
    href: '/analytics',
    action: 'عرض التحليلات',
    metric: '—',
    metricLabel: 'insight',
  },
  {
    name: 'Sentinel',
    role: 'حارس العلامة',
    icon: Shield,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.2)',
    status: 'يراقب',
    statusColor: '#10b981',
    href: '/sentinel',
    action: 'عرض التنبيهات',
    metric: '0',
    metricLabel: 'تنبيه حرج',
  },
]

const QUICK_ACTIONS = [
  { label: 'حملة جديدة', desc: 'ابدأ حملة AI في 3 خطوات', icon: Rocket, href: '/campaigns/new', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { label: 'سكريبت فيديو', desc: 'اكتب سكريبت بالـ AI', icon: Film, href: '/studio', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
  { label: 'نسخة إعلانية', desc: 'جهّز ad copy للمنصات', icon: Wand2, href: '/vex', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { label: 'ربط المنصات', desc: 'Meta, TikTok, Google...', icon: Globe, href: '/connections', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
]

export default function DashboardPage() {
  const { authHeader, user, isAuthenticated, loading: authLoading } = useAuth()
  const { isDemo, campaigns: demoCampaigns, activities: demoActivities, stats: demoStats, dismissDemo } = useDemoData()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasConnections, setHasConnections] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    if (isDemo) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/stats', { headers: { Authorization: authHeader() } })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setStats(data.stats)
      setActivities(data.activities || [])
      setRecentCampaigns(data.recentCampaigns || [])
    } catch { setError('تعذّر تحميل البيانات') }
    finally { setLoading(false) }
  }, [authHeader, isDemo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (isDemo) { setHasConnections(true); return }
    fetch('/api/social/accounts', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then(d => setHasConnections((d.accounts || []).length > 0))
      .catch(() => setHasConnections(true))
  }, [authHeader, isDemo])

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 relative">
              <div className="absolute inset-0 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
              <Sparkles className="w-5 h-5 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-gray-500 text-sm">جاري التحميل...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const campaignCount = isDemo ? demoStats.activeCampaigns : (stats?.campaigns.total ?? 0)
  const viewCount = isDemo ? Math.round(demoStats.totalImpressions / 1000) + 'K' : (stats?.campaigns.thisMonth ?? 0)
  const convCount = isDemo ? demoStats.totalConversions : (stats?.generations.total ?? 0)
  const ctrVal = isDemo ? demoStats.avgCtr + '%' : (stats?.credits.plan === 'ACTIVE' ? '∞' : String(stats?.credits.remaining ?? 0))

  return (
    <AppShell>
      <OnboardingWizard />
      <div className="relative min-h-screen">
        <StarField />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

          {/* ── Header ── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-amber-400/60 font-mono tracking-widest uppercase">Nexus Command Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">
                {displayName ? `أهلاً، ${displayName} 👋` : 'أهلاً بك 👋'}
              </h1>
              <p className="text-gray-500 text-sm">نظرة شاملة على وكلائك وحملاتك اليوم</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load}
                className="p-2.5 rounded-xl border border-white/8 text-gray-500 hover:text-white hover:border-white/15 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link href="/campaigns/new"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000' }}>
                <Rocket className="w-4 h-4" />
                حملة جديدة
              </Link>
            </div>
          </div>

          {/* ── Banners ── */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {hasConnections === false && !isDemo && (
            <div className="p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.18)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-cyan-300">ربط منصاتك خطوة أساسية 🔗</p>
                  <p className="text-xs text-gray-500">اربط Meta, TikTok, Google لتفعيل النشر والتحليل</p>
                </div>
              </div>
              <Link href="/connections"
                className="text-xs font-bold px-4 py-2 rounded-lg"
                style={{ background: 'rgba(6,182,212,0.10)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.2)' }}>
                ربط الحسابات ←
              </Link>
            </div>
          )}

          {isDemo && (
            <div className="p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3"
              style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)' }}>
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-amber-300">وضع العرض التجريبي</p>
                  <p className="text-xs text-gray-500">بيانات توضيحية — ابدأ حملتك الحقيقية الآن</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/campaigns/new"
                  className="text-xs font-bold px-4 py-2 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }}>
                  ابدأ حقيقياً →
                </Link>
                <button onClick={dismissDemo} className="text-xs text-gray-500 hover:text-gray-300 transition px-2">تجاهل</button>
              </div>
            </div>
          )}

          {/* ── Stats Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'الحملات', value: String(campaignCount), sub: 'إجمالي', color: '#f59e0b', icon: Rocket },
              { label: 'المشاهدات', value: String(viewCount), sub: 'هذا الشهر', color: '#06b6d4', icon: Eye },
              { label: 'التحويلات', value: String(convCount), sub: 'إجمالي', color: '#8b5cf6', icon: MousePointer },
              { label: 'متوسط CTR', value: String(ctrVal), sub: isDemo ? 'أعلى من المتوسط' : 'نسبة النقر', color: '#10b981', icon: TrendingUp },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="rounded-2xl p-5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${s.color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[11px] text-gray-600">{s.sub}</p>
                </div>
              )
            })}
          </div>

          {/* ── AI Agents Status ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">وكلاء الذكاء الاصطناعي</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {AGENTS.map(agent => {
                const Icon = agent.icon
                return (
                  <Link key={agent.name} href={agent.href}
                    className="group rounded-2xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.01] cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${agent.border}`,
                    }}>
                    {/* Top row */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: agent.glow, border: `1px solid ${agent.border}` }}>
                        <Icon className="w-5 h-5" style={{ color: agent.color }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: agent.statusColor, boxShadow: `0 0 6px ${agent.statusColor}` }} />
                        <span className="text-[10px] font-medium" style={{ color: agent.statusColor }}>{agent.status}</span>
                      </div>
                    </div>

                    {/* Name + Role */}
                    <div>
                      <p className="font-bold text-sm" style={{ color: agent.color }}>{agent.name}</p>
                      <p className="text-[11px] text-gray-500">{agent.role}</p>
                    </div>

                    {/* Metric */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold text-white">{agent.metric}</p>
                        <p className="text-[10px] text-gray-600">{agent.metricLabel}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: agent.color }}>
                        {agent.action}
                        <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">إجراءات سريعة</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map(qa => {
                const Icon = qa.icon
                return (
                  <Link key={qa.label} href={qa.href}
                    className="group rounded-2xl p-4 flex items-center gap-3 transition-all hover:scale-[1.01]"
                    style={{ background: qa.bg, border: `1px solid ${qa.color}20` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${qa.color}15`, border: `1px solid ${qa.color}25` }}>
                      <Icon className="w-4 h-4" style={{ color: qa.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{qa.label}</p>
                      <p className="text-[10px] text-gray-500 truncate">{qa.desc}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* ── Main grid: Campaigns + Activity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Recent Campaigns — 3 cols */}
            <div className="lg:col-span-3 rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold">آخر الحملات</h3>
                </div>
                <Link href="/campaigns" className="text-[11px] text-gray-500 hover:text-amber-400 transition flex items-center gap-1">
                  عرض الكل <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              {recentCampaigns.length === 0 && !isDemo ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                    <Plus className="w-6 h-6 text-amber-400/50" />
                  </div>
                  <p className="text-sm font-semibold mb-1">لا توجد حملات بعد</p>
                  <p className="text-xs text-gray-500 mb-5 max-w-[180px] mx-auto">
                    أطلق حملتك الأولى وسيبني Nexus لك استراتيجية كاملة
                  </p>
                  <Link href="/campaigns/new"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <Rocket className="w-4 h-4" />
                    إطلاق أول حملة
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {(isDemo ? demoCampaigns.map(c => ({
                    id: c.id, name: c.name, status: c.status.toUpperCase(),
                    thumbnail: c.platform === 'Meta' ? '📣' : c.platform === 'TikTok' ? '🎵' : '🎯',
                    platforms: [c.platform], createdAt: c.createdAt,
                  })) : recentCampaigns).map(c => {
                    const si = STATUS_LABELS[c.status] || STATUS_LABELS.DRAFT
                    return (
                      <Link key={c.id} href={`/campaigns/${c.id}`}
                        className="flex items-center justify-between p-3.5 rounded-xl hover:bg-white/4 transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-base">
                            {c.thumbnail}
                          </div>
                          <div>
                            <p className="text-sm font-medium group-hover:text-white transition">{c.name}</p>
                            <p className="text-[11px] text-gray-500">{c.platforms?.slice(0, 2).join(' · ') || '—'}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2.5 py-1 rounded-full border ${si.color}`}>{si.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Activity Feed — 2 cols */}
            <div className="lg:col-span-2 rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold">آخر النشاطات</h3>
              </div>

              {activities.length === 0 && !isDemo ? (
                <div className="text-center py-10">
                  <Clock className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">لا توجد نشاطات</p>
                  <p className="text-xs text-gray-600 mt-1">ستظهر هنا بعد أول حملة</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(isDemo ? demoActivities.map(a => ({
                    id: a.id, action: a.action + ' ' + a.target,
                    agent: a.agent, campaign: '', time: a.time,
                  })) : activities).map(item => {
                    const agentColors: Record<string, string> = {
                      NEX: '#f59e0b', VEX: '#06b6d4', PULSE: '#8b5cf6', Sentinel: '#10b981'
                    }
                    const c = agentColors[item.agent] || '#64748b'
                    return (
                      <div key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/3 transition-all">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
                          style={{ background: `${c}15`, color: c, border: `1px solid ${c}25` }}>
                          {item.agent[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-300 leading-relaxed">{item.action}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: c }}>{item.agent}</p>
                        </div>
                        <span className="text-[10px] text-gray-600 shrink-0 font-mono">{item.time}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Low credits nudge ── */}
          {!isDemo && stats?.credits.plan !== 'ACTIVE' && (stats?.credits.remaining ?? 30) < 20 && (
            <div className="p-5 rounded-2xl flex items-center justify-between flex-wrap gap-4"
              style={{ background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-300 text-sm">الطاقة على وشك الانتهاء</p>
                  <p className="text-xs text-gray-500">متبقي {stats?.credits.remaining} وحدة — ترقية الخطة للاستمرار</p>
                </div>
              </div>
              <Link href="/billing"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <Zap className="w-4 h-4" />
                شحن الطاقة
              </Link>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
