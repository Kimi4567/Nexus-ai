'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

interface Campaign {
  id: string
  name: string
  description?: string
  goal: string
  audience?: string
  tone: string
  platforms: string[]
  status: string
  favorite: boolean
  thumbnail?: string
  lastViewedAt?: string
  createdAt: string
  updatedAt: string
  _count?: { activities: number }
}

const GOAL_COLORS: Record<string, string> = {
  SALES: 'bg-green-500/20 text-green-400',
  AWARENESS: 'bg-blue-500/20 text-blue-400',
  LEADS: 'bg-yellow-500/20 text-yellow-400',
  ENGAGEMENT: 'bg-pink-500/20 text-pink-400',
  TRAFFIC: 'bg-purple-500/20 text-purple-400',
  BRAND_BUILDING: 'bg-orange-500/20 text-orange-400',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  ACTIVE: 'bg-green-500/20 text-green-400',
  COMPLETED: 'bg-blue-500/20 text-blue-400',
  ARCHIVED: 'bg-red-500/20 text-red-400',
  SCHEDULED: 'bg-yellow-500/20 text-yellow-400',
  PAUSED: 'bg-orange-500/20 text-orange-400',
}

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶️', LINKEDIN: '💼', SNAPCHAT: '👻',
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString()
}

export default function CampaignsPage() {
  const router = useRouter()
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState('createdAt')
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  const fetchCampaigns = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setFetching(true)
    try {
      const params = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(favoritesOnly ? { favorite: 'true' } : {}),
        sort,
      })
      const res = await fetch(`/api/campaigns?${params}`, { headers: { Authorization: token } })
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch {
      setCampaigns([])
    } finally {
      setFetching(false)
    }
  }, [authHeader, search, statusFilter, favoritesOnly, sort])

  useEffect(() => {
    if (isAuthenticated) fetchCampaigns()
  }, [isAuthenticated, fetchCampaigns])

  const toggleFavorite = async (id: string, current: boolean) => {
    const token = authHeader()
    if (!token) return
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, favorite: !current } : c))
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ favorite: !current }),
    })
  }

  const archiveCampaign = async (id: string) => {
    const token = authHeader()
    if (!token) return
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    })
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'ARCHIVED' } : c))
    setActionMenuId(null)
  }

  const deleteCampaign = async (id: string) => {
    const token = authHeader()
    if (!token) return
    setDeleting(id)
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE', headers: { Authorization: token } })
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
    setActionMenuId(null)
  }

  const duplicateCampaign = async (id: string) => {
    const token = authHeader()
    if (!token) return
    const res = await fetch(`/api/campaigns/${id}/duplicate`, {
      method: 'POST', headers: { Authorization: token },
    })
    const data = await res.json()
    if (data.campaign) {
      setCampaigns(prev => [data.campaign, ...prev])
    }
    setActionMenuId(null)
  }

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const visibleCampaigns = campaigns.filter(c => statusFilter !== 'active' || c.status !== 'ARCHIVED')

  return (
    <AppShell>

      <div className="max-w-7xl mx-auto px-6 py-10 page-enter">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Campaign History</h1>
            <p className="text-t2 text-sm">Your marketing system lives here — {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</p>
          </div>
          <Link
            href="/campaign/new"
            className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm whitespace-nowrap"
          >
            + New Campaign
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-dark-secondary border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-dark-secondary border border-dark-tertiary rounded-xl text-white focus:outline-none focus:border-accent transition text-sm"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-4 py-2.5 bg-dark-secondary border border-dark-tertiary rounded-xl text-white focus:outline-none focus:border-accent transition text-sm"
          >
            <option value="createdAt">Newest First</option>
            <option value="updatedAt">Recently Updated</option>
            <option value="name">Name A–Z</option>
            <option value="lastViewedAt">Recently Viewed</option>
          </select>
          <button
            onClick={() => setFavoritesOnly(f => !f)}
            className={`px-4 py-2.5 rounded-xl border transition text-sm font-semibold ${favoritesOnly ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-dark-secondary border-dark-tertiary text-gray-400 hover:text-white'}`}
          >
            ⭐ Favorites
          </button>
        </div>

        {/* Empty state */}
        {!fetching && visibleCampaigns.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold mb-2">No campaigns yet</h2>
            <p className="text-t2 mb-8">Generate your first AI marketing campaign and it'll live here permanently.</p>
            <Link href="/campaign/new" className="px-8 py-4 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition">
              Create Your First Campaign →
            </Link>
          </div>
        )}

        {/* Campaign Grid */}
        {fetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="surface-card rounded-card p-6 space-y-4">
                <div className="skeleton w-12 h-12 rounded-xl" />
                <div className="space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
                <div className="skeleton h-3 w-full rounded" />
                <div className="flex gap-2">
                  <div className="skeleton h-6 w-16 rounded-full" />
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCampaigns.map(campaign => (
              <div
                key={campaign.id}
                className="surface-card rounded-card p-6 hover:border-s5 hover:[border-color:rgba(99,102,241,0.3)] transition group relative"
              >
                {/* Thumbnail + Actions */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-s3 flex items-center justify-center text-3xl">
                    {campaign.thumbnail || '🎯'}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Favorite */}
                    <button
                      onClick={() => toggleFavorite(campaign.id, campaign.favorite)}
                      className={`text-lg transition ${campaign.favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`}
                    >
                      {campaign.favorite ? '⭐' : '☆'}
                    </button>
                    {/* Actions menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === campaign.id ? null : campaign.id)}
                        className="text-gray-500 hover:text-white transition text-xl leading-none px-1"
                      >
                        ···
                      </button>
                      {actionMenuId === campaign.id && (
                        <div className="absolute right-0 top-8 z-20 min-w-[160px] overflow-hidden rounded-[13px]"
                          style={{ background: '#131312', border: '1px solid #1c1c28', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 24px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="block px-3 py-2 text-[12px] text-t2 hover:text-white hover:bg-white/5 rounded-[8px] mx-1 my-1 transition"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={() => duplicateCampaign(campaign.id)}
                            className="w-full text-left px-3 py-2 text-[12px] text-t2 hover:text-white hover:bg-white/5 rounded-[8px] mx-1 transition"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => archiveCampaign(campaign.id)}
                            className="w-full text-left px-3 py-2 text-[12px] text-amber-400 hover:bg-amber-500/8 rounded-[8px] mx-1 transition"
                          >
                            Archive
                          </button>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
                          <button
                            onClick={() => deleteCampaign(campaign.id)}
                            disabled={deleting === campaign.id}
                            className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/8 rounded-[8px] mx-1 mb-1 transition"
                          >
                            {deleting === campaign.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Name & Status */}
                <Link href={`/campaigns/${campaign.id}`} className="block mb-3 group/link">
                  <h3 className="font-bold text-lg group-hover/link:text-accent transition leading-snug line-clamp-2">
                    {campaign.name}
                  </h3>
                </Link>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${GOAL_COLORS[campaign.goal] || 'bg-gray-500/20 text-gray-400'}`}>
                    {campaign.goal}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[campaign.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {campaign.status}
                  </span>
                </div>

                {/* Platforms */}
                <div className="flex gap-1 mb-4">
                  {campaign.platforms.slice(0, 4).map(p => (
                    <span key={p} className="text-sm" title={p}>{PLATFORM_ICONS[p] || '🌐'}</span>
                  ))}
                  {campaign.platforms.length > 4 && (
                    <span className="text-xs text-gray-500">+{campaign.platforms.length - 4}</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-t3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span>Created {timeAgo(campaign.createdAt)}</span>
                  {campaign.lastViewedAt && (
                    <span>Viewed {timeAgo(campaign.lastViewedAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close action menus on outside click */}
      {actionMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
      )}
    </AppShell>
  )
}
