'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { generateAdCopy } from '@/services/openai'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { Wand2, Loader2, Megaphone, Plus, Play, Pause, Trash2, TrendingUp, DollarSign, Target, BarChart3 } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused'
  platform: string
  budget: number
  spent: number
  roi: number
  ctr: number
}

export default function VexPage() {
  const [productName, setProductName] = useState('')
  const [platform, setPlatform] = useState('Facebook')
  const [objective, setObjective] = useState('مبيعات')
  const [copies, setCopies] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: '1', name: 'حملة صيف 2026', status: 'active', platform: 'Facebook', budget: 2500, spent: 1800, roi: 2.4, ctr: 3.2 },
    { id: '2', name: 'إطلاق منتج جديد', status: 'active', platform: 'Instagram', budget: 1500, spent: 900, roi: 3.1, ctr: 4.1 },
    { id: '3', name: 'تسويق TikTok', status: 'paused', platform: 'TikTok', budget: 1000, spent: 750, roi: 1.8, ctr: 2.8 },
    { id: '4', name: 'Google Search', status: 'active', platform: 'Google', budget: 3000, spent: 2100, roi: 4.2, ctr: 5.5 },
  ])

  const handleGenerate = async () => {
    if (!productName) return
    setLoading(true)
    const result = await generateAdCopy(productName, platform, objective)
    setCopies(result.split('\n\n').filter(Boolean))
    setLoading(false)
  }

  const toggleCampaign = (id: string) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'active' ? 'paused' : 'active' } : c))
  }

  const deleteCampaign = (id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0)
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0)
  const avgRoi = campaigns.length > 0 ? campaigns.reduce((sum, c) => sum + c.roi, 0) / campaigns.length : 0

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">VEX - مدير الإعلانات</h1>
            <p className="text-text-muted text-sm">أنشئ وادر حملاتك الإعلانية بالذكاء الاصطناعي</p>
          </div>
          <Link href="/campaigns/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            حملة جديدة
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span className="text-text-muted text-sm">إجمالي الميزانية</span>
            </div>
            <p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p>
          </div>
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-amber" />
              <span className="text-text-muted text-sm">المصروف</span>
            </div>
            <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
          </div>
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-cyan" />
              <span className="text-text-muted text-sm">متوسط العائد</span>
            </div>
            <p className="text-2xl font-bold">{avgRoi.toFixed(1)}x</p>
          </div>
        </div>

        {/* Campaign List */}
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <h3 className="font-bold mb-4">الحملات النشطة</h3>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Megaphone className={`w-5 h-5 ${c.status === 'active' ? 'text-emerald-400' : 'text-text-muted'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-text-muted">{c.platform} · CTR {c.ctr}%</p>
                </div>
                <div className="hidden sm:block w-32">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-muted">${c.spent}</span>
                    <span className="text-text-muted">${c.budget}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber rounded-full" style={{ width: `${(c.spent / c.budget) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-400">{c.roi}x ROI</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Ad Copy Generator */}
        <div className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-5 h-5 text-amber" />
            <h3 className="font-bold">مولد النسخ الإعلانية بالذكاء الاصطناعي</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">اسم المنتج</label>
              <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="اسم المنتج" className="input-nexus" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">المنصة</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input-nexus">
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google Ads</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">الهدف</label>
              <select value={objective} onChange={(e) => setObjective(e.target.value)} className="input-nexus">
                <option value="مبيعات">مبيعات</option>
                <option value="وعي">وعي بالعلامة</option>
                <option value="تفاعل">تفاعل</option>
                <option value="قيادة">قيادة</option>
              </select>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={loading || !productName} className="btn-primary w-full">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {loading ? 'جاري الإنشاء...' : 'إنشاء 3 نسخ إعلانية'}
          </button>
        </div>

        {copies.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold">النسخ المقترحة:</h3>
            {copies.map((copy, i) => (
              <div key={i} className="glass p-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone className="w-4 h-4 text-cyan" />
                  <span className="text-sm font-medium text-cyan">نسخة {i + 1}</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{copy}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
