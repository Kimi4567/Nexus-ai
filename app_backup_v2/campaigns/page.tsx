'use client'

import Link from 'next/link'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { FolderKanban, Plus, TrendingUp, DollarSign, BarChart3, Megaphone } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'ended'
  platform: string
  budget: number
  spent: number
  roi: number
  ctr: number
  conversions: number
}

export default function CampaignsPage() {
  const campaigns: Campaign[] = [
    { id: '1', name: 'حملة صيف 2026', status: 'active', platform: 'Facebook', budget: 2500, spent: 1800, roi: 2.4, ctr: 3.2, conversions: 145 },
    { id: '2', name: 'إطلاق منتج جديد', status: 'active', platform: 'Instagram', budget: 1500, spent: 900, roi: 3.1, ctr: 4.1, conversions: 210 },
    { id: '3', name: 'تسويق TikTok', status: 'paused', platform: 'TikTok', budget: 1000, spent: 750, roi: 1.8, ctr: 2.8, conversions: 89 },
    { id: '4', name: 'Google Search', status: 'active', platform: 'Google', budget: 3000, spent: 2100, roi: 4.2, ctr: 5.5, conversions: 340 },
    { id: '5', name: 'Snapchat Reach', status: 'ended', platform: 'Snapchat', budget: 800, spent: 800, roi: 1.5, ctr: 1.9, conversions: 67 },
  ]

  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0)
  const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0)
  const activeCount = campaigns.filter(c => c.status === 'active').length

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">الحملات</h1>
            <p className="text-text-muted text-sm">إدارة ومراقبة حملاتك الإعلانية</p>
          </div>
          <Link href="/campaigns/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            حملة جديدة
          </Link>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <FolderKanban className="w-5 h-5 text-cyan" />
              <span className="text-text-muted text-sm">الحملات النشطة</span>
            </div>
            <p className="text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span className="text-text-muted text-sm">إجمالي الميزانية</span>
            </div>
            <p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p>
          </div>
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-amber" />
              <span className="text-text-muted text-sm">المصروف</span>
            </div>
            <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
          </div>
          <div className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span className="text-text-muted text-sm">التحويلات</span>
            </div>
            <p className="text-2xl font-bold">{totalConversions.toLocaleString()}</p>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="glass overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">الحملة</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">الحالة</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">المنصة</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">الميزانية</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">المصروف</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">CTR</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">ROI</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-muted">تحويلات</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.status === 'paused' ? 'bg-amber/10 text-amber' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          c.status === 'active' ? 'bg-emerald-400' :
                          c.status === 'paused' ? 'bg-amber' :
                          'bg-red-400'
                        }`} />
                        {c.status === 'active' ? 'نشطة' : c.status === 'paused' ? 'متوقفة' : 'منتهية'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{c.platform}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">${c.budget.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">${c.spent.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{c.ctr}%</td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-400">{c.roi}x</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{c.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
