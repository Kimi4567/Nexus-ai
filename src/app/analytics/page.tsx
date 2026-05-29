'use client'

import AppShell from '@/components/AppShell'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { analyzeCampaign } from '@/services/openai'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from '@/components/ui/DynamicChart'
import {
  Loader2, RefreshCw, Brain, Activity, TrendingUp, Globe,
  Target, Eye, MousePointer, DollarSign, ArrowUpRight, ArrowDownRight,
  Sparkles, Clock, Layers
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   PULSE OBSERVATORY — Data Vision from the Cosmos
   Reading the digital universe's pulse. Every data point is a star.
   ═══════════════════════════════════════════════════════════════ */

import StarField from '@/components/ui/StarField'

// Holographic chart glow
const CHART_GLOW = {
  views: '#f59e0b',
  clicks: '#06b6d4',
  revenue: '#10b981',
  conversions: '#8b5cf6',
}

const MOCK_7DAYS = [
  { name: 'السبت', views: 1200, clicks: 320, revenue: 450, conversions: 28 },
  { name: 'الأحد', views: 1800, clicks: 480, revenue: 720, conversions: 42 },
  { name: 'الإثنين', views: 2400, clicks: 650, revenue: 980, conversions: 58 },
  { name: 'الثلاثاء', views: 2100, clicks: 580, revenue: 850, conversions: 51 },
  { name: 'الأربعاء', views: 2800, clicks: 720, revenue: 1100, conversions: 67 },
  { name: 'الخميس', views: 3200, clicks: 850, revenue: 1350, conversions: 83 },
  { name: 'الجمعة', views: 2900, clicks: 780, revenue: 1200, conversions: 74 },
]

const MOCK_30DAYS = [
  { name: 'أسبوع 1', views: 12000, clicks: 3200, revenue: 4500, conversions: 284 },
  { name: 'أسبوع 2', views: 15000, clicks: 4100, revenue: 6200, conversions: 392 },
  { name: 'أسبوع 3', views: 18000, clicks: 5200, revenue: 7800, conversions: 512 },
  { name: 'أسبوع 4', views: 22000, clicks: 6800, revenue: 9500, conversions: 628 },
]

const PLATFORM_DISTRIBUTION = [
  { name: 'Meta', value: 45, color: '#1877F2' },
  { name: 'TikTok', value: 30, color: '#FE2C55' },
  { name: 'Google', value: 20, color: '#4285F4' },
  { name: 'Snapchat', value: 5, color: '#FFFC00' },
]

const AGENT_PERFORMANCE = [
  { name: 'NEX', videos: 24, engagement: 87, color: '#f59e0b' },
  { name: 'VEX', campaigns: 12, roas: 3.2, color: '#06b6d4' },
  { name: 'PULSE', insights: 48, accuracy: 94, color: '#8b5cf6' },
  { name: 'Sentinel', alerts: 3, uptime: 99.9, color: '#10b981' },
]

interface OverviewData {
  campaignsCount: number
  generationsCount: number
  exportsCount: number
  usage: { month: number; year: number; aiCreditsUsed: number; generationsCount: number }[]
}

export default function AnalyticsPage() {
  const { authHeader } = useAuth()
  const [range, setRange] = useState<'7' | '30' | '90'>('7')
  const [aiInsight, setAiInsight] = useState('')
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const loadOverview = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/analytics/overview', {
        headers: { Authorization: authHeader() },
      })
      if (res.ok) {
        const data = await res.json()
        setOverview(data)
      }
    } catch { /* use mock fallback */ }
    finally { setLoadingData(false) }
  }, [authHeader])

  useEffect(() => { loadOverview() }, [loadOverview])

  const currentData = range === '7' ? MOCK_7DAYS : MOCK_30DAYS

  const stats = [
    {
      label: 'إجمالي المشاهدات',
      value: '142,384',
      change: '+28.4%',
      changeType: 'up' as const,
      icon: Eye,
      color: 'amber',
      detail: 'vs الشهر الماضي',
    },
    {
      label: 'نسبة النقر CTR',
      value: '4.2%',
      change: '+0.8%',
      changeType: 'up' as const,
      icon: MousePointer,
      color: 'cyan',
      detail: 'أعلى من المتوسط',
    },
    {
      label: 'الإيرادات',
      value: '$12,450',
      change: '+35.2%',
      changeType: 'up' as const,
      icon: DollarSign,
      color: 'emerald',
      detail: 'هذا الشهر',
    },
    {
      label: 'التحويلات',
      value: '1,284',
      change: '+18.7%',
      changeType: 'up' as const,
      icon: Target,
      color: 'purple',
      detail: 'عميل جديد',
    },
  ]

  const handleAiInsight = async () => {
    setLoadingInsight(true)
    const summaryData = overview
      ? `حملات: ${overview.campaignsCount}، محتوى مولّد: ${overview.generationsCount}، رصيد مستخدم: ${overview.usage.reduce((s, u) => s + u.aiCreditsUsed, 0)}`
      : 'المشاهدات: 142,384، النقرات: 5,980، CTR: 4.2%، الإيرادات: $12,450، التحويلات: 1,284'
    const insight = await analyzeCampaign(summaryData)
    setAiInsight(insight)
    setLoadingInsight(false)
  }

  return (
    <AppShell>
    <div className="relative min-h-screen space-y-8">
      <StarField density="high" />

      {/* Static ambient glow — no mouse tracking for performance */}
      <div
        className="fixed w-[700px] h-[700px] rounded-full pointer-events-none opacity-6 blur-[150px]"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)',
          top: '30%',
          left: '-5%',
          animation: 'float 12s ease-in-out infinite',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple/20 to-pink/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs text-purple-400/70 font-mono tracking-wider">PULSE OBSERVATORY</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">مرصد PULSE</h1>
          <p className="text-text-muted text-sm">
            تحليلات عميقة لأداء حملاتك. كل بيانة هي نجمة في كونك الرقمي.
          </p>
        </div>

        {/* Demo data notice */}
        <div
          className="flex items-center gap-3 px-5 py-3 mb-8 rounded-xl"
          style={{
            background: 'rgba(245,158,11,0.05)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300/80">
            <span className="font-bold text-amber-400">بيانات توضيحية</span> — هذه الأرقام للعرض فقط. ستظهر بياناتك الحقيقية بعد ربط حملاتك بالمنصات.
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="flex items-center gap-1 p-1"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
            }}
          >
            {(['7', '30', '90'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  range === r
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r === '7' ? '7 أيام' : r === '30' ? '30 يوم' : '90 يوم'}
              </button>
            ))}
          </div>
          <button
            onClick={loadOverview}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 text-text-muted ${loadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Grid — Holographic Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            const isUp = stat.changeType === 'up'
            return (
              <div
                key={stat.label}
                className="p-6 corner-accent group hover:scale-[1.02] transition-all duration-500"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `rgba(${stat.color === 'amber' ? '245,158,11' : stat.color === 'cyan' ? '6,182,212' : stat.color === 'emerald' ? '16,185,129' : '139,92,246'},0.1)`,
                      border: `1px solid rgba(${stat.color === 'amber' ? '245,158,11' : stat.color === 'cyan' ? '6,182,212' : stat.color === 'emerald' ? '16,185,129' : '139,92,246'},0.2)`,
                    }}
                  >
                    <Icon className="w-5 h-5" style={{
                      color: stat.color === 'amber' ? '#fbbf24' : stat.color === 'cyan' ? '#67e8f9' : stat.color === 'emerald' ? '#6ee7b7' : '#c4b5fd'
                    }} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
                </div>
                <p className="text-xs text-text-muted">{stat.label}</p>
                <p className="text-[10px] text-text-muted/60 mt-1">{stat.detail}</p>
              </div>
            )
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Views & Clicks — Area Chart */}
          <div
            className="p-6 corner-accent"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-amber" />
              <h3 className="text-lg font-bold">المشاهدات والتفاعل</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={currentData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(2,2,4,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(20px)',
                  }}
                  labelStyle={{ color: '#f8fafc', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="views" stroke="#f59e0b" strokeWidth={2} fill="url(#viewsGradient)" dot={{ r: 3, fill: '#f59e0b' }} />
                <Area type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} fill="url(#clicksGradient)" dot={{ r: 3, fill: '#06b6d4' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue — Bar Chart */}
          <div
            className="p-6 corner-accent"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold">الإيرادات</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(2,2,4,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(20px)',
                  }}
                  labelStyle={{ color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} opacity={0.8} />
                <Bar dataKey="conversions" fill="#8b5cf6" radius={[8, 8, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Distribution & Agent Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Platform Pie Chart */}
          <div
            className="p-6 corner-accent lg:col-span-1"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Globe className="w-5 h-5 text-cyan" />
              <h3 className="text-lg font-bold">توزيع المنصات</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={PLATFORM_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {PLATFORM_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(2,2,4,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(20px)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {PLATFORM_DISTRIBUTION.map((platform) => (
                <div key={platform.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: platform.color }} />
                  <span className="text-xs text-text-muted">{platform.name} {platform.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Performance */}
          <div
            className="p-6 corner-accent lg:col-span-2"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <Layers className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold">أداء الوكلاء</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {AGENT_PERFORMANCE.map((agent) => (
                <div
                  key={agent.name}
                  className="p-4 rounded-xl text-center group hover:scale-[1.02] transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${agent.color}20`,
                  }}
                >
                  <div
                    className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{
                      background: `${agent.color}15`,
                      color: agent.color,
                      border: `1px solid ${agent.color}30`,
                    }}
                  >
                    {agent.name[0]}
                  </div>
                  <h4 className="font-bold mb-1">{agent.name}</h4>
                  <div className="space-y-1">
                    {Object.entries(agent).filter(([k]) => !['name', 'color'].includes(k)).map(([key, val]) => (
                      <p key={key} className="text-xs text-text-muted">
                        {key === 'videos' ? `${val} فيديو` :
                         key === 'campaigns' ? `${val} حملة` :
                         key === 'engagement' ? `${val}% engagement` :
                         key === 'roas' ? `ROAS ${val}x` :
                         key === 'insights' ? `${val} insight` :
                         key === 'accuracy' ? `${val}% دقة` :
                         key === 'alerts' ? `${val} تنبيه` :
                         `${val}% uptime`}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Insight — PULSE Oracle */}
        <div
          className="p-8 corner-accent energy-ring"
          style={{
            background: 'rgba(139,92,246,0.03)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderRadius: '24px',
          }}
        >
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Brain className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">تحليل PULSE الذكي</h3>
                <p className="text-xs text-text-muted">AI-powered insights based on your real data</p>
              </div>
            </div>
            <button
              onClick={handleAiInsight}
              disabled={loadingInsight}
              className="btn-primary btn-3d text-sm py-2.5 px-6 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(168,85,247,0.6))',
              }}
            >
              {loadingInsight ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  PULSE يُحلل البيانات...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  احصل على تحليل ذكي
                </>
              )}
            </button>
          </div>

          {aiInsight ? (
            <div
              className="p-6 rounded-xl"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(139,92,246,0.1)',
              }}
            >
              <pre className="text-sm text-text-secondary whitespace-pre-wrap font-medium leading-relaxed">
                {aiInsight}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/5 flex items-center justify-center border border-purple-500/10">
                <Brain className="w-8 h-8 text-purple-400/30" />
              </div>
              <p className="text-text-muted text-sm mb-1">PULSE جاهز لتحليل بياناتك</p>
              <p className="text-xs text-text-muted/60">اضغط على الزر للحصول على تحليل عميق وتوصيات قابلة للتنفيذ</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </AppShell>
  )
}
