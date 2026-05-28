'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { analyzeCampaign } from '@/services/openai'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  BarChart3, TrendingUp, Users, Eye, MousePointer, DollarSign, Wand2, Loader2, Calendar,
} from 'lucide-react'

const data7days = [
  { name: 'السبت', views: 1200, clicks: 320, revenue: 450 },
  { name: 'الأحد', views: 1800, clicks: 480, revenue: 720 },
  { name: 'الإثنين', views: 2400, clicks: 650, revenue: 980 },
  { name: 'الثلاثاء', views: 2100, clicks: 580, revenue: 850 },
  { name: 'الأربعاء', views: 2800, clicks: 720, revenue: 1100 },
  { name: 'الخميس', views: 3200, clicks: 850, revenue: 1350 },
  { name: 'الجمعة', views: 2900, clicks: 780, revenue: 1200 },
]

const data30days = [
  { name: 'أسبوع 1', views: 12000, clicks: 3200, revenue: 4500 },
  { name: 'أسبوع 2', views: 15000, clicks: 4100, revenue: 6200 },
  { name: 'أسبوع 3', views: 18000, clicks: 5200, revenue: 7800 },
  { name: 'أسبوع 4', views: 22000, clicks: 6800, revenue: 9500 },
]

const platformData = [
  { name: 'Facebook', value: 45 },
  { name: 'Instagram', value: 30 },
  { name: 'TikTok', value: 20 },
  { name: 'Google', value: 5 },
]

export default function AnalyticsPage() {
  const [range, setRange] = useState<'7' | '30' | '90'>('7')
  const [aiInsight, setAiInsight] = useState('')
  const [loadingInsight, setLoadingInsight] = useState(false)

  const currentData = range === '7' ? data7days : data30days

  const stats = [
    { label: 'المشاهدات', value: '142,384', change: '+28%', icon: <Eye className="w-5 h-5" /> },
    { label: 'التفاعل', value: '4.2%', change: '-0.3%', icon: <MousePointer className="w-5 h-5" /> },
    { label: 'الإيرادات', value: '$12,450', change: '+35%', icon: <DollarSign className="w-5 h-5" /> },
    { label: 'المستخدمين', value: '3,284', change: '+12%', icon: <Users className="w-5 h-5" /> },
  ]

  const handleAiInsight = async () => {
    setLoadingInsight(true)
    const insight = await analyzeCampaign(`Views: 142,384, Clicks: 5,980, CTR: 4.2%, Revenue: $12,450, Conversions: 1,240`)
    setAiInsight(insight)
    setLoadingInsight(false)
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">تحليلات PULSE</h1>
            <p className="text-text-muted text-sm">بيانات وتحليلات لحملاتك</p>
          </div>
          <div className="flex items-center gap-2 glass p-1" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
            {(['7', '30', '90'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  range === r
                    ? 'bg-amber text-black'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r === '7' ? '7 أيام' : r === '30' ? '30 يوم' : '90 يوم'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-muted text-sm">{s.label}</span>
                <div className="p-2 rounded-lg bg-white/5 text-amber">{s.icon}</div>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold">{s.value}</span>
                <span className={`text-sm font-medium ${s.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>{s.change}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <h3 className="text-lg font-bold mb-4">المشاهدات والنقرات</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#0a0a12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
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
                <Tooltip
                  contentStyle={{ background: '#0a0a12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
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

        {/* AI Insights */}
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-amber" />
              <h3 className="text-lg font-bold">تحليل ذكي بالذكاء الاصطناعي</h3>
            </div>
            <button onClick={handleAiInsight} disabled={loadingInsight} className="btn-primary text-sm py-2 px-4">
              {loadingInsight ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {loadingInsight ? 'جاري التحليل...' : 'احصل على تحليل'}
            </button>
          </div>
          {aiInsight ? (
            <div className="p-4 rounded-xl bg-white/5 text-sm leading-relaxed whitespace-pre-wrap">
              {aiInsight}
            </div>
          ) : (
            <p className="text-text-muted text-sm">اضغط على الزر للحصول على تحليل ذكي لبيانات حملاتك</p>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
