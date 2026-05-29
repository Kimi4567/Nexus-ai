'use client'

import AppShell from '@/components/AppShell'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  FolderKanban, Plus, Megaphone, Search, Filter,
  Loader2, Star, MoreHorizontal, RefreshCw, Wand2
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  goal: string
  status: string
  favorite: boolean
  thumbnail: string
  platforms: string[]
  createdAt: string
  updatedAt: string
  _count: { activities: number }
}

const STATUS_MAP: Record<string, { label: string; dot: string; badge: string }> = {
  DRAFT:     { label: 'مسودة',   dot: 'bg-white/30',      badge: 'bg-white/5 text-text-secondary' },
  ACTIVE:    { label: 'نشطة',    dot: 'bg-emerald-400',   badge: 'bg-emerald-500/10 text-emerald-400' },
  PAUSED:    { label: 'متوقفة',  dot: 'bg-amber-400',     badge: 'bg-amber-500/10 text-amber-400' },
  COMPLETED: { label: 'مكتملة', dot: 'bg-cyan-400',       badge: 'bg-cyan-500/10 text-cyan-400' },
  ARCHIVED:  { label: 'مؤرشفة', dot: 'bg-white/20',       badge: 'bg-white/5 text-text-muted' },
}

const GOAL_MAP: Record<string, string> = {
  SALES:     'مبيعات',
  AWARENESS: 'وعي',
  ENGAGEMENT:'تفاعل',
  LEADS:     'Leads',
  TRAFFIC:   'زيارات',
}

export default function CampaignsPage() {
  const { authHeader } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name'>('updatedAt')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search)       params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (favoriteOnly) params.set('favorite', 'true')
      params.set('sort', sortBy)
      params.set('limit', '50')

      const res = await fetch(`/api/campaigns?${params}`, {
        headers: { Authorization: authHeader() },
      })
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns || [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [authHeader, search, statusFilter, favoriteOnly, sortBy])

  useEffect(() => { load() }, [load])

  const toggleFavorite = async (id: string, current: boolean) => {
    setTogglingId(id)
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ favorite: !current }),
      })
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, favorite: !current } : c))
    } catch { /* silent */ }
    finally { setTogglingId(null) }
  }

  const activeCount  = campaigns.filter(c => c.status === 'ACTIVE').length
  const draftCount   = campaigns.filter(c => c.status === 'DRAFT').length
  const totalCount   = campaigns.length

  return (
    <AppShell>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">الحملات</h1>
          <p className="text-text-muted text-sm">إدارة ومتابعة جميع حملاتك</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-4 h-4 text-text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/campaigns/new" className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            حملة جديدة
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الحملات', value: totalCount, icon: <FolderKanban className="w-5 h-5 text-cyan-400" /> },
          { label: 'الحملات النشطة', value: activeCount, icon: <Megaphone className="w-5 h-5 text-emerald-400" /> },
          { label: 'المسودات', value: draftCount, icon: <Wand2 className="w-5 h-5 text-amber" /> },
        ].map((s) => (
          <div key={s.label} className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <div className="flex items-center gap-2 mb-2">{s.icon}<span className="text-text-muted text-sm">{s.label}</span></div>
            <p className="text-2xl font-bold">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الحملات..."
            className="input-nexus pr-10 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-nexus text-sm w-auto"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_MAP).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="input-nexus text-sm w-auto"
        >
          <option value="updatedAt">الأحدث تعديلاً</option>
          <option value="createdAt">الأحدث إنشاءً</option>
          <option value="name">الاسم</option>
        </select>

        <button
          onClick={() => setFavoriteOnly(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
            favoriteOnly
              ? 'border-amber/40 bg-amber/10 text-amber'
              : 'border-white/10 text-text-secondary hover:border-white/20'
          }`}
        >
          <Star className="w-4 h-4" />
          المحفوظة
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass p-16 text-center" style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' }}>
          <Megaphone className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-bold mb-2">
            {search || statusFilter ? 'لا توجد نتائج' : 'لا توجد حملات بعد'}
          </h3>
          <p className="text-text-muted text-sm mb-6">
            {search || statusFilter ? 'جرّب تغيير الفلتر أو البحث' : 'أنشئ حملتك الأولى ودع الذكاء الاصطناعي يعمل'}
          </p>
          {!search && !statusFilter && (
            <Link href="/campaigns/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              حملة جديدة
            </Link>
          )}
        </div>
      ) : (
        <div className="glass overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">الحملة</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">الحالة</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">الهدف</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">المنصات</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">النشاط</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">التاريخ</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {campaigns.map((c) => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.DRAFT
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/campaigns/${c.id}`} className="flex items-center gap-3">
                          <span className="text-2xl w-9 h-9 flex items-center justify-center rounded-xl bg-white/5">
                            {c.thumbnail || '🎯'}
                          </span>
                          <div>
                            <p className="text-sm font-medium group-hover:text-amber transition-colors">{c.name}</p>
                            {c.description && (
                              <p className="text-xs text-text-muted mt-0.5 max-w-[200px] truncate">{c.description}</p>
                            )}
                          </div>
                        </Link>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {GOAL_MAP[c.goal] || c.goal}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {(c.platforms || []).slice(0, 3).map((p, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-text-secondary">{p}</span>
                          ))}
                          {c.platforms?.length > 3 && (
                            <span className="text-xs text-text-muted">+{c.platforms.length - 3}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {c._count.activities > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400">
                            {c._count.activities} نشاط
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-text-muted">
                        {new Date(c.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleFavorite(c.id, c.favorite)}
                            disabled={togglingId === c.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              c.favorite ? 'text-amber' : 'text-text-muted hover:text-amber'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${c.favorite ? 'fill-amber' : ''}`} />
                          </button>
                          <Link href={`/campaigns/${c.id}`} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  )
}
