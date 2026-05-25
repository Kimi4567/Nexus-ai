'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'

interface Overview {
  campaignsCount: number
  generationsCount: number
  exportsCount: number
}

interface Campaign {
  id: string
  name: string
  goal: string
  platforms: string[]
  status: string
  createdAt: string
}

interface ActivityEvent {
  id: string
  eventType: string
  createdAt: string
  metadata?: { fileName?: string; mediaId?: string }
}

export default function Dashboard() {
  const router = useRouter()
  const { user, isAuthenticated, loading, logout, authHeader } = useAuth()

  const [overview, setOverview] = useState<Overview | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, loading, router])

  const fetchDashboardData = useCallback(async () => {
    const token = authHeader()
    if (!token) return

    setDataLoading(true)
    try {
      const [overviewRes, campaignsRes, activityRes] = await Promise.allSettled([
        fetch('/api/analytics/overview', { headers: { Authorization: token } }),
        fetch('/api/campaigns', { headers: { Authorization: token } }),
        fetch('/api/analytics/activity', { headers: { Authorization: token } }),
      ])

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        const data = await overviewRes.value.json()
        setOverview(data)
      }

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const data = await campaignsRes.value.json()
        setCampaigns(Array.isArray(data) ? data.slice(0, 5) : [])
      }

      if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
        const data = await activityRes.value.json()
        setActivity(data.uploads || [])
      }
    } catch (err) {
      console.error('Dashboard data fetch error', err)
    } finally {
      setDataLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData()
    }
  }, [isAuthenticated, fetchDashboardData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'

  const stats = [
    { label: 'Total Campaigns', value: overview ? String(overview.campaignsCount) : '—', icon: '📊' },
    { label: 'AI Generations', value: overview ? String(overview.generationsCount) : '—', icon: '⚡' },
    { label: 'Exports', value: overview ? String(overview.exportsCount) : '—', icon: '📦' },
    { label: 'Plan', value: 'Free', icon: '🏢' },
  ]

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-500/20 text-green-300',
    DRAFT: 'bg-yellow-500/20 text-yellow-300',
    COMPLETED: 'bg-blue-500/20 text-blue-300',
    ARCHIVED: 'bg-gray-500/20 text-gray-300',
    PAUSED: 'bg-orange-500/20 text-orange-300',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary">
      <NavBar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-2">Welcome back, {displayName}! 👋</h2>
          <p className="text-gray-400">Your AI marketing command center</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-dark-secondary border border-dark-tertiary rounded-lg p-6 hover:border-accent/50 transition">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
              <div className="text-2xl font-bold mt-2">
                {dataLoading ? <span className="text-gray-500 text-base animate-pulse">...</span> : stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link
            href="/campaign/new"
            className="bg-accent text-dark rounded-lg p-8 hover:bg-accent-light transition font-semibold text-lg text-center"
          >
            ➕ Create New Campaign
          </Link>
          <Link
            href="/media"
            className="bg-dark-secondary border border-dark-tertiary rounded-lg p-8 hover:border-accent/50 transition font-semibold text-center"
          >
            📤 Upload Media
          </Link>
          <Link
            href="/billing"
            className="bg-dark-secondary border border-dark-tertiary rounded-lg p-8 hover:border-accent/50 transition font-semibold text-center"
          >
            ⚡ Upgrade Plan
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Activity Feed */}
          <div className="lg:col-span-2 bg-dark-secondary border border-dark-tertiary rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
            {dataLoading ? (
              <div className="text-sm text-gray-500 animate-pulse">Loading...</div>
            ) : activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((event) => (
                  <div key={event.id} className="rounded-xl border border-dark-tertiary bg-dark p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {event.eventType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {event.metadata?.fileName || event.metadata?.mediaId || 'Event recorded'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🚀</div>
                <p className="text-gray-400 text-sm">No activity yet — create your first campaign to get started.</p>
                <Link href="/campaign/new" className="mt-4 inline-block text-accent hover:text-accent-light text-sm font-semibold">
                  Create Campaign →
                </Link>
              </div>
            )}
          </div>

          {/* Upgrade CTA */}
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/30 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-2">🔥 Go Pro</h3>
            <p className="text-sm text-gray-400 mb-4">Unlock unlimited campaigns, AI credits, and team collaboration.</p>
            <ul className="text-sm text-gray-300 space-y-2 mb-6">
              <li>✅ Unlimited AI generations</li>
              <li>✅ Campaign exports (PDF, ZIP)</li>
              <li>✅ Priority support</li>
              <li>✅ Advanced analytics</li>
            </ul>
            <Link
              href="/billing"
              className="block w-full text-center py-2 bg-accent text-dark font-semibold rounded-lg hover:bg-accent-light transition text-sm"
            >
              Upgrade Now
            </Link>
          </div>
        </div>

        {/* Real Campaigns */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-lg overflow-hidden">
          <div className="p-6 border-b border-dark-tertiary flex items-center justify-between">
            <h3 className="text-xl font-bold">Your Campaigns</h3>
            <Link href="/campaign/new" className="text-sm text-accent hover:text-accent-light font-semibold">
              + New
            </Link>
          </div>

          {dataLoading ? (
            <div className="p-6 text-gray-400 text-sm animate-pulse">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📊</div>
              <h4 className="text-xl font-semibold mb-2">No campaigns yet</h4>
              <p className="text-gray-400 mb-6 text-sm">Create your first AI-powered marketing campaign in minutes.</p>
              <Link
                href="/campaign/new"
                className="inline-block px-6 py-3 bg-accent text-dark font-semibold rounded-lg hover:bg-accent-light transition"
              >
                Create First Campaign
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-tertiary text-sm text-gray-400 bg-dark-tertiary/50">
                    <th className="text-left p-4 font-semibold">Campaign</th>
                    <th className="text-left p-4 font-semibold">Goal</th>
                    <th className="text-left p-4 font-semibold">Platforms</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Created</th>
                    <th className="text-left p-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-dark-tertiary hover:bg-dark/50 transition">
                      <td className="p-4 font-semibold">{campaign.name}</td>
                      <td className="p-4 text-sm text-gray-300 capitalize">{campaign.goal?.toLowerCase()}</td>
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {(campaign.platforms || []).map((p) => (
                            <span key={p} className="text-xs bg-dark-tertiary px-2 py-1 rounded capitalize">
                              {p.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded ${statusColors[campaign.status] || 'bg-gray-500/20 text-gray-300'}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Link href={`/campaign/${campaign.id}`} className="text-accent hover:text-accent-light transition text-sm font-semibold">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
