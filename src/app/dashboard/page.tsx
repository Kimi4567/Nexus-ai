'use client'

import AppShell from '@/components/AppShell'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import StatCard from '@/components/ui/StatCard'
import Link from 'next/link'
import {
  Video, Megaphone, Eye, MousePointer, Loader2, Plus, RefreshCw,
  Zap, TrendingUp, Globe, Sparkles, Activity, BarChart3, Rocket, Star
} from 'lucide-react'

import { useDemoData } from '@/hooks/useDemoData'
import OnboardingWizard from '@/components/ui/OnboardingWizard'

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — Cosmic Command Center
   Floating in infinite space. Data as starlight.
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

const AGENT_COLORS: Record<string, string> = {
  NEX: 'text-amber-400',
  VEX: 'text-cyan-400',
  PULSE: 'text-emerald-400',
  Sentinel: 'text-violet-400',
}

const AGENT_GLOW: Record<string, string> = {
  NEX: 'shadow-amber-500/20',
  VEX: 'shadow-cyan-500/20',
  PULSE: 'shadow-emerald-500/20',
  Sentinel: 'shadow-violet-500/20',
}

const STATUS_LABELS: Record<string, { label: string; color: string; glow: string }> = {
  DRAFT: { label: 'مسودة', color: 'bg-white/5 text-text-secondary border-white/10', glow: '' },
  ACTIVE: { label: 'نشطة', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-emerald-500/10' },
  PAUSED: { label: 'متوقفة', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', glow: 'shadow-amber-500/10' },
  COMPLETED: { label: 'مكتملة', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', glow: 'shadow-cyan-500/10' },
  ARCHIVED: { label: 'مؤرشفة', color: 'bg-white/3 text-text-muted border-white/5', glow: '' },
}

// Animated star field background
import StarField from '@/components/ui/StarField'

// Floating nebula orbs
function NebulaOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)',
          top: '10%',
          right: '5%',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[80px]"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)',
          bottom: '20%',
          left: '10%',
          animation: 'float 10s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full opacity-10 blur-[60px]"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)',
          top: '50%',
          left: '50%',
          animation: 'float 12s ease-in-out infinite',
        }}
      />
    </div>
  )
}

export default function DashboardPage() {
  const { authHeader, user } = useAuth()
  const { isDemo, campaigns: demoCampaigns, activities: demoActivities, stats: demoStats, dismissDemo } = useDemoData()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (isDemo) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setStats(data.stats)
      setActivities(data.activities || [])
      setRecentCampaigns(data.recentCampaigns || [])
    } catch {
      setError('تعذّر تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [authHeader, isDemo])

  useEffect(() => { load() }, [load])

  const changeLabel = (n: number) =>
    n > 0 ? `+${n}% هذا الشهر` : n < 0 ? `${n}% هذا الشهر` : 'لا تغيير'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] relative">
        <StarField />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full border-2 border-amber/20 border-t-amber animate-spin" />
            <Sparkles className="w-6 h-6 text-amber absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-text-muted text-sm">جاري تحميل البيانات الكونية...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
    <div className="space-y-6 relative min-h-screen">
      <StarField />
      <NebulaOrbs />

      {/* Static ambient glow — no mouse tracking for performance */}
      <div
        className="fixed w-[800px] h-[800px] rounded-full pointer-events-none opacity-8 blur-[150px]"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)',
          top: '20%',
          right: '-10%',
          animation: 'float 10s ease-in-out infinite',
        }}
      />

      <div className="relative z-10">
        <OnboardingWizard />
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-amber" />
              <span className="text-xs text-amber/70 font-mono tracking-wider">NEXUS COMMAND CENTER</span>
            </div>
            <h1 className="text-3xl font-bold">
              أهلاً بك{user?.user_metadata?.name ? `، ${user.user_metadata.name}` : ''} 👋
            </h1>
            <p className="text-text-muted text-sm">نظرة عامة على أداء حملاتك في الفضاء الرقمي</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 hover:border-amber/30"
            >
              <RefreshCw className="w-4 h-4 text-text-muted" />
            </button>
            <Link
              href="/campaigns/new"
              className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2 btn-3d"
            >
              <Rocket className="w-4 h-4" />
              إطلاق حملة جديدة
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Demo Mode Banner */}
        {isDemo && (
          <div
            className="p-4 mb-6 corner-accent flex items-center justify-between flex-wrap gap-3"
            style={{
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber" />
              </div>
              <div>
                <p className="font-bold text-sm">🚀 وضع العرض التوضيحي</p>
                <p className="text-xs text-text-muted">هذه بيانات تجريبية لمساعدتك على استكشاف المنصة. ابدأ حملتك الحقيقية الآن!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/campaigns/new" className="btn-primary text-xs py-2 px-4 btn-3d">
                <Rocket className="w-3 h-3" />
                ابدأ حقيقياً
              </Link>
              <button
                onClick={dismissDemo}
                className="text-xs text-text-muted hover:text-text-primary transition-colors px-3"
              >
                تجاهل
              </button>
            </div>
          </div>
        )}

        {/* Stats — Floating holographic cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="الحملات النشطة"
            value={isDemo ? String(demoStats.activeCampaigns) : String(stats?.campaigns.total ?? 0)}
            change={isDemo ? '+100% هذا الشهر' : changeLabel(stats?.campaigns.change ?? 0)}
            changeType="positive"
            icon={<Globe className="w-5 h-5" />}
            glow="amber"
          />
          <StatCard
            title="إجمالي المشاهدات"
            value={isDemo ? (demoStats.totalImpressions / 1000).toFixed(1) + 'K' : String(stats?.campaigns.thisMonth ?? 0)}
            change={isDemo ? '73,600 مشاهدة' : 'حملة جديدة'}
            changeType="positive"
            icon={<Eye className="w-5 h-5" />}
            glow="cyan"
          />
          <StatCard
            title="التحويلات"
            value={isDemo ? String(demoStats.totalConversions) : String(stats?.generations.total ?? 0)}
            change={isDemo ? '191 عميل جديد' : `${stats?.generations.thisMonth ?? 0} هذا الشهر`}
            changeType="positive"
            icon={<MousePointer className="w-5 h-5" />}
            glow="purple"
          />
          <StatCard
            title="متوسط CTR"
            value={isDemo ? demoStats.avgCtr + '%' : stats?.credits.plan === 'ACTIVE' ? '∞' : String(stats?.credits.remaining ?? 0)}
            change={isDemo ? 'أعلى من المتوسط 3.3%' : stats?.credits.plan === 'ACTIVE' ? 'طاقة غير محدودة' : 'وحدات طاقة'}
            changeType="positive"
            icon={<TrendingUp className="w-5 h-5" />}
            glow="emerald"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Campaigns — Holographic List */}
          <div
            className="p-6 corner-accent"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-amber" />
                <h3 className="text-lg font-bold">آخر الحملات</h3>
              </div>
              <Link href="/campaigns" className="text-xs text-amber hover:text-amber-300 transition-colors">
                عرض الكل →
              </Link>
            </div>
            {recentCampaigns.length === 0 && !isDemo ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <Megaphone className="w-8 h-8 text-text-muted/30" />
                </div>
                <p className="text-sm text-text-muted mb-2">لا توجد حملات بعد</p>
                <p className="text-xs text-text-muted/60">ابدأ رحلتك التسويقية الأولى</p>
                <Link href="/campaigns/new" className="text-amber text-sm hover:underline mt-3 block">
                  إطلاق حملة جديدة 🚀
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(isDemo ? demoCampaigns.map(c => ({
                  id: c.id,
                  name: c.name,
                  status: c.status.toUpperCase(),
                  thumbnail: c.platform === 'Meta' ? 'M' : c.platform === 'TikTok' ? 'T' : 'G',
                  platforms: [c.platform],
                  createdAt: c.createdAt,
                })) : recentCampaigns).map((c) => {
                  const statusInfo = STATUS_LABELS[c.status] || STATUS_LABELS.DRAFT
                  return (
                    <Link
                      key={c.id}
                      href={`/campaigns/${c.id}`}
                      className={`flex items-center justify-between p-4 rounded-xl bg-white/3 hover:bg-white/6 transition-all border border-transparent hover:border-white/10 ${statusInfo.glow}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber/20 to-orange/10 flex items-center justify-center text-lg">
                          {c.thumbnail}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-text-muted">
                            {c.platforms?.slice(0, 2).join(' · ') || 'بدون منصة'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Activity Feed — Cosmic Stream */}
          <div
            className="p-6 corner-accent"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-5 h-5 text-cyan" />
              <h3 className="text-lg font-bold">آخر النشاطات</h3>
            </div>
            {activities.length === 0 && !isDemo ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-text-muted/30" />
                </div>
                <p className="text-sm text-text-muted mb-2">لا توجد نشاطات حتى الآن</p>
                <p className="text-xs text-text-muted/60">الوكلاء بيستعدوا للعمل</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(isDemo ? demoActivities.map(a => ({
                  id: a.id,
                  action: a.action + ' ' + a.target,
                  agent: a.agent,
                  campaign: '',
                  time: a.time,
                })) : activities).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/3 hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AGENT_GLOW[item.agent] || ''}`}>
                        <span className={AGENT_COLORS[item.agent] || 'text-text-muted'}>
                          {item.agent[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className={`text-xs ${AGENT_COLORS[item.agent] || 'text-text-muted'}`}>
                          {item.agent}{item.campaign ? ` · ${item.campaign}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-text-muted shrink-0 mr-3 font-mono">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Credits upgrade nudge */}
        {stats?.credits.plan !== 'ACTIVE' && (stats?.credits.remaining ?? 30) < 20 && (
          <div
            className="p-6 flex items-center justify-between flex-wrap gap-4 corner-accent energy-ring"
            style={{
              background: 'rgba(245,158,11,0.03)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber" />
              </div>
              <div>
                <p className="font-semibold text-amber">الطاقة على وشك الانتهاء</p>
                <p className="text-sm text-text-muted">
                  متبقي لك {stats?.credits.remaining} وحدة — شحن مركبتك للاستمرار
                </p>
              </div>
            </div>
            <Link href="/billing" className="btn-primary text-sm py-2.5 px-6 btn-3d">
              شحن الطاقة ⚡️
            </Link>
          </div>
        )}
      </div>
    </div>
    </AppShell>
  )
}
