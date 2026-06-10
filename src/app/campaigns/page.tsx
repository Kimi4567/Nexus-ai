'use client'

import AppShell from '@/components/AppShell'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  FolderKanban, Plus, Megaphone, Search, Filter,
  Loader2, Star, MoreHorizontal, RefreshCw, Wand2,
  ExternalLink, Archive, Trash2,
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

export default function CampaignsPage() {
  const { authHeader } = useAuth()
  const { t, locale } = useI18n()
  const router = useRouter()
  const cT = t('campaigns')

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name'>('updatedAt')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Status config — labels from i18n, colors/badges stay static
  const STATUS_MAP: Record<string, { label: string; dot: string; badge: string }> = {
    DRAFT:     { label: cT?.statusDraft     as string, dot: 'bg-white/30',      badge: 'bg-white/5 text-text-secondary' },
    ACTIVE:    { label: cT?.statusActive    as string, dot: 'bg-emerald-400',   badge: 'bg-emerald-500/10 text-emerald-400' },
    PAUSED:    { label: cT?.statusPaused    as string, dot: 'bg-amber-400',     badge: 'bg-amber-500/10 text-amber-400' },
    COMPLETED: { label: cT?.statusCompleted as string, dot: 'bg-cyan-400',      badge: 'bg-cyan-500/10 text-cyan-400' },
    ARCHIVED:  { label: cT?.statusArchived  as string, dot: 'bg-white/20',      badge: 'bg-white/5 text-text-muted' },
  }

  const GOAL_MAP: Record<string, string> = {
    SALES:     cT?.goalSales      as string,
    AWARENESS: cT?.goalAwareness  as string,
    ENGAGEMENT:cT?.goalEngagement as string,
    LEADS:     cT?.goalLeads      as string,
    TRAFFIC:   cT?.goalTraffic    as string,
  }

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

  const deleteCampaign = async (id: string) => {
    if (!window.confirm((cT as Record<string, string>)?.menuDeleteConfirm || 'Delete this campaign permanently?')) return
    setDeletingId(id)
    setOpenMenuId(null)
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() },
      })
      setCampaigns(prev => prev.filter(c => c.id !== id))
    } catch { /* silent */ }
    finally { setDeletingId(null) }
  }

  const archiveCampaign = async (id: string) => {
    setOpenMenuId(null)
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      })
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'ARCHIVED' } : c))
    } catch { /* silent */ }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenuId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  const activeCount  = campaigns.filter(c => c.status === 'ACTIVE').length
  const draftCount   = campaigns.filter(c => c.status === 'DRAFT').length
  const totalCount   = campaigns.length

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US'

  return (
    <AppShell>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{cT?.pageTitle as string}</h1>
          <p className="text-text-muted text-sm">{cT?.pageSubtitle as string}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCw className={`w-4 h-4 text-text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/campaigns/new" className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            {cT?.btnNewCampaign as string}
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: cT?.statTotal as string,  value: totalCount,  icon: <FolderKanban className="w-5 h-5 text-cyan-400" /> },
          { label: cT?.statActive as string, value: activeCount, icon: <Megaphone className="w-5 h-5 text-emerald-400" /> },
          { label: cT?.statDraft as string,  value: draftCount,  icon: <Wand2 className="w-5 h-5 text-amber" /> },
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
            placeholder={cT?.searchPlaceholder as string}
            className="input-nexus pr-10 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-nexus text-sm w-auto"
        >
          <option value="">{cT?.filterAll as string}</option>
          {Object.entries(STATUS_MAP).map(([v, s]) => (
            <option key={v} value={v}>{s.label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="input-nexus text-sm w-auto"
        >
          <option value="updatedAt">{cT?.sortNewest as string}</option>
          <option value="createdAt">{cT?.sortOldest as string}</option>
          <option value="name">{cT?.sortName as string}</option>
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
          {cT?.btnFavorites as string}
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
            {search || statusFilter ? cT?.emptyNoResults as string : cT?.emptyNoCampaigns as string}
          </h3>
          <p className="text-text-muted text-sm mb-6">
            {search || statusFilter ? cT?.emptyNoResultsDesc as string : cT?.emptyNoCampaignsDesc as string}
          </p>
          {!search && !statusFilter && (
            <Link href="/campaigns/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {cT?.btnNewCampaign as string}
            </Link>
          )}
        </div>
      ) : (
        <div className="glass overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">{cT?.colCampaign as string}</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">{cT?.colStatus as string}</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">{cT?.colGoal as string}</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">{cT?.colPlatforms as string}</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">{cT?.colActivity as string}</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-text-muted uppercase tracking-wider">{cT?.colDate as string}</th>
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
                            {(cT?.activityCount as string)?.replace('{n}', String(c._count.activities))}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-text-muted">
                        {new Date(c.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
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
                          {/* 3-dot menu */}
                          <div className="relative" ref={openMenuId === c.id ? menuRef : undefined}>
                            <button
                              onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === c.id ? null : c.id) }}
                              disabled={deletingId === c.id}
                              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
                            >
                              {deletingId === c.id
                                ? <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                                : <MoreHorizontal className="w-4 h-4" />
                              }
                            </button>
                            {openMenuId === c.id && (
                              <div
                                className="absolute end-0 top-full mt-1 w-36 rounded-xl overflow-hidden z-50 shadow-xl"
                                style={{ background: 'rgba(15,16,40,0.97)', border: '1px solid rgba(139,92,246,0.2)' }}
                              >
                                <button
                                  onClick={() => { setOpenMenuId(null); router.push(`/campaigns/${c.id}`) }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  {(cT as Record<string, string>)?.menuOpen || 'Open'}
                                </button>
                                <button
                                  onClick={() => archiveCampaign(c.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  {(cT as Record<string, string>)?.menuArchive || 'Archive'}
                                </button>
                                <button
                                  onClick={() => deleteCampaign(c.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {(cT as Record<string, string>)?.menuDelete || 'Delete'}
                                </button>
                              </div>
                            )}
                          </div>
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
