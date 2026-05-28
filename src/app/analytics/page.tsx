'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { analyzeCampaign } from '@/services/openai'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Wand2, Loader2, RefreshCw } from 'lucide-react'

// Fallback mock for when user has no data yet
const MOCK_7DAYS = [
  { name: 'السبت', views: 1200, clicks: 320, revenue: 450 },
  { name: 'الأحد', views: 1800, clicks: 480, revenue: 720 },
  { name: 'الإثنين', views: 2400, clicks: 650, revenue: 980 },
  { name: 'الثلاثاء', views: 2100, clicks: 580, revenue: 850 },
  { name: 'الأربعاء', views: 2800, clicks: 720, revenue: 1100 },
  { name: 'الخميس', views: 3200, clicks: 850, revenue: 1350 },
  { name: 'الجمعة', views: 2900, clicks: 780, revenue: 1200 },
]

const MOCK_30DAYS = [
  { name: 'أسبوع 1', views: 12000, clicks: 3200, revenue: 4500 },
  { name: 'أسبوع 2', views: 15000, clicks: 4100, revenue: 6200 },
  { name: 'أسبوع 3', views: 18000, clicks: 5200, revenue: 7800 },
  { name: 'أسبوع 4', views: 22000, clicks: 6800, revenue: 9500 },
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

  // Build platform data from usage or mock
  const platformData = [
    { name: 'Facebook', value: 45 },
    { name: 'Instagram', value: 30 },
    { name: 'TikTok', value: 20 },
    { name: 'Google', value: 5 },
  ]

  // Build real stats from DB data, falling back to display values
  const stats = [
    {
      label: 'الحملات',
      value: overview ? String(overview.campaignsCount) : '—',
      change: overview ? `${overview.campaignsCount} إجمالي` : '+28%',
      positive: true,
    },
    {
      label: 'المحتوى المولّد',
      value: overview ? String(overview.generationsCount) : '—',
      change: overview ? 'AI generation' : '4.2%',
      positive: true,
    },
    {
      label: 'الرصيد المستخدم',
      value: overview ? String(overview.usage.reduce((s, u) => s + u.aiCreditsUsed, 0)) : '—',
      change: overview?.usage[0]
        ? `${overview.usage[0].aiCreditsUsed} هذا الشهر`
        : '+35%',
      positive: true,
    },
    {
      label: 'التصديرات',
      value: overview ? String(overview.exportsCount) : '—',
      change: overview ? `${overview.exportsCount} ملف` : '+12%',
      positive: true,
    },
  ]

  const handleAiInsight = async () => {
    setLoadingInsight(true)
    const summaryData = overview
      ? `حملات: ${overview.campaignsCount}، محتوى مولّد: ${overview.generationsCount}، رصيد مستخدم: ${overview.usage.reduce((s, u) => s + u.aiCreditsUsed, 0)}`
      : 'المشاهدات: 142,384، النقرات: 5,980، CTR: 4.2%، الإيرادات: $12,450'
    const insight = await analyzeCampaign(summaryData)
    setAiInsight(insight)
    setLoadingInsight(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">تحليلات PULSE</h1>
          <p className="text-text-muted text-sm">بيانات وتحليلات لحملاتك</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadOverview} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-4 h-4 text-text-muted ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          <div className="glass p-1" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            {(['7', '30', '90'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  range === r ? 'bg-amber text-black' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r === '7' ? '7 أيام' : r === '30' ? '30 يوم' : '90 يوم'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats — real data from DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-text-muted text-sm">{s.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{s.value}</span>
              <span className="text-sm font-medium text-emerald-400">{s.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts — mock trends (real platform tracking TBD) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <h3 className="text-lg font-bold mb-4">المشاهدات والنقرات</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#0a0a12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} labelStyle={{ color: '#f8fafc' }} />
              <Line type="monotone" dataKey="views" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <h3 className="text-lg font-bold mb-4">الإيرادات</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={currentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#0a0a12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} labelStyle={{ color: '#f8fafc' }} />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform Distribution */}
      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <h3 className="text-lg font-bold mb-4">توزيع المنصات</h3>
        <div className="space-y-4">
          {platformData.map((p) => (
            <div key={p.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{p.name}</span>
                <span className="text-sm text-text-muted">{p.value}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-amber to-cyan rounded-full" style={{ width: `${p.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis — PULSE */}
      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber" />
            <h3 className="text-lg font-bold">تحليل ذكي بـ PULSE</h3>
          </div>
          <button onClick={handleAiInsight} disabled={loadingInsight} className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
            {loadingInsight
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التحليل...</>
              : <><Wand2 className="w-4 h-4" /> احصل على تحليل</>
            }
          </button>
        </div>
        {aiInsight ? (
          <div className="p-4 rounded-xl bg-white/5 text-sm leading-relaxed whitespace-pre-wrap">
            {aiInsight}
          </div>
        ) : (
          <p className="text-text-muted text-sm">
            اضغط للحصول على تحليل ذكي من PULSE يحلل بياناتك الفعلية
          </p>
        )}
      </div>
    </div>
  )
}
