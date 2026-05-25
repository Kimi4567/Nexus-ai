'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

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
  favorite: boolean
  thumbnail?: string
  createdAt: string
  updatedAt: string
  lastViewedAt?: string
}

interface ActivityEvent {
  id: string
  eventType: string
  createdAt: string
  metadata?: { fileName?: string; mediaId?: string }
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400',
  DRAFT: 'bg-amber-400',
  COMPLETED: 'bg-blue-400',
  ARCHIVED: 'bg-gray-600',
  SCHEDULED: 'bg-violet-400',
  PAUSED: 'bg-orange-400',
}

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'text-emerald-400',
  DRAFT: 'text-amber-400',
  COMPLETED: 'text-blue-400',
  ARCHIVED: 'text-gray-500',
  SCHEDULED: 'text-violet-400',
  PAUSED: 'text-orange-400',
}

const GOAL_ICON: Record<string, string> = {
  SALES: '💰', AWARENESS: '📢', LEADS: '🎯', TRAFFIC: '🔥',
  ENGAGEMENT: '💬', BRAND_BUILDING: '🏆',
}

const PLATFORM_ICON: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶️', LINKEDIN: '💼', SNAPCHAT: '👻',
  TWITTER: '🐦', WEBSITE: '🌐',
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, sub, loading }: {
  label: string; value: string | number; sub?: string; loading: boolean
}) {
  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 hover:border-[#2a2a2a] transition-colors">
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-2xl font-bold text-white mb-0.5">
        {loading ? <span className="text-gray-700 animate-pulse">—</span> : value}
      </div>
      {sub && <div className="text-[11px] text-gray-600">{sub}</div>}
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-[#141414] rounded-lg transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-base flex-shrink-0 border border-[#252525]">
        {campaign.thumbnail || GOAL_ICON[campaign.goal] || '🎯'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
          {campaign.name}
        </div>
        <div className="text-[11px] text-gray-600 mt-0.5">
          {campaign.platforms.slice(0, 3).map(p => PLATFORM_ICON[p] || '🌐').join(' ')}
          {campaign.platforms.length > 3 && ` +${campaign.platforms.length - 3}`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[campaign.status] || 'bg-gray-600'}`} />
        <span className={`text-[11px] font-medium ${STATUS_TEXT[campaign.status] || 'text-gray-500'}`}>
          {campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}
        </span>
      </div>
      <div className="text-[11px] text-gray-600 flex-shrink-0 w-16 text-right">
        {timeAgo(campaign.updatedAt)}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
        className="text-gray-700 group-hover:text-gray-400 transition-colors flex-shrink-0">
        <path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

function OnboardingChecklist({ hasWorkspace, hasCampaign, hasGeneration }: {
  hasWorkspace: boolean; hasCampaign: boolean; hasGeneration: boolean
}) {
  const steps = [
    { label: 'Create your workspace', done: hasWorkspace },
    { label: 'Launch your first campaign', done: hasCampaign, href: '/campaign/new' },
    { label: 'Generate AI content', done: hasGeneration },
    { label: 'Set up your brand profile', done: false, href: '/brand' },
  ]
  const completedCount = steps.filter(s => s.done).length
  if (completedCount === steps.length) return null
  const firstIncomplete = steps.findIndex(s => !s.done)

  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-white">Getting started</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{completedCount} of {steps.length} complete</div>
        </div>
        <div className="text-[11px] font-semibold text-accent">
          {Math.round((completedCount / steps.length) * 100)}%
        </div>
      </div>
      <div className="w-full bg-[#1f1f1f] rounded-full h-1 mb-4">
        <div
          className="bg-accent h-1 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
              step.done ? 'bg-accent border-accent' : 'border-[#333]'
            }`}>
              {step.done && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M1.5 4l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-xs flex-1 ${step.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
              {step.label}
            </span>
            {'href' in step && !step.done && i === firstIncomplete && (
              <Link href={step.href!} className="text-[10px] text-accent hover:underline font-medium">
                Start →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightCard({ icon, title, body, cta, href }: {
  icon: string; title: string; body: string; cta: string; href: string
}) {
  return (
    <Link href={href} className="group block bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors">
      <div className="text-lg mb-2">{icon}</div>
      <div className="text-xs font-semibold text-white mb-1">{title}</div>
      <div className="text-[11px] text-gray-600 leading-relaxed mb-2">{body}</div>
      <div className="text-[10px] font-semibold text-accent group-hover:underline">{cta} →</div>
    </Link>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()

  const [overview, setOverview] = useState<Overview | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  const fetchDashboardData = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setDataLoading(true)
    try {
      const [overviewRes, campaignsRes, activityRes] = await Promise.allSettled([
        fetch('/api/analytics/overview', { headers: { Authorization: token } }),
        fetch('/api/campaigns?sort=updatedAt', { headers: { Authorization: token } }),
        fetch('/api/analytics/activity', { headers: { Authorization: token } }),
      ])
      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        setOverview(await overviewRes.value.json())
      }
      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const data = await campaignsRes.value.json()
        const list = Array.isArray(data) ? data : (data.campaigns || [])
        setCampaigns(list.slice(0, 8))
      }
      if (activityRes.status === 'fulfilled' && activityRes.value.ok) {
        const data = await activityRes.value.json()
        setActivity(data.uploads || [])
      }
    } catch (err) {
      console.error('Dashboard fetch error', err)
    } finally {
      setDataLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) fetchDashboardData()
  }, [isAuthenticated, fetchDashboardData])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'
  const firstName = displayName.split(' ')[0]
  const hasCampaign = (overview?.campaignsCount || 0) > 0
  const hasGeneration = (overview?.generationsCount || 0) > 0

  const statusCounts = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const recentCampaigns = campaigns.slice(0, 6)

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-[1100px]">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white mb-1">Good morning, {firstName}</h1>
          <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening with your marketing operations.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Campaigns" value={overview?.campaignsCount ?? '—'} sub="across all workspaces" loading={dataLoading} />
          <StatCard label="AI Generations" value={overview?.generationsCount ?? '—'} sub="content pieces created" loading={dataLoading} />
          <StatCard label="Exports" value={overview?.exportsCount ?? '—'} sub="packages delivered" loading={dataLoading} />
          <StatCard label="Plan" value="Free" sub="Upgrade for more →" loading={false} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — Campaign list (2 cols) */}
          <div className="lg:col-span-2 space-y-5">

            {/* Recent campaigns */}
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold text-white">Recent campaigns</span>
                  {!dataLoading && campaigns.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#1f1f1f] text-gray-500 rounded font-medium">
                      {campaigns.length}
                    </span>
                  )}
                </div>
                <Link href="/campaigns" className="text-[11px] text-gray-500 hover:text-white transition font-medium">
                  View all →
                </Link>
              </div>

              {dataLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg animate-pulse" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-[#1a1a1a] rounded animate-pulse w-3/4" />
                        <div className="h-2 bg-[#1a1a1a] rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentCampaigns.length === 0 ? (
                <div className="text-center py-14 px-6">
                  <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-xl mx-auto mb-3">
                    🚀
                  </div>
                  <div className="text-sm font-semibold text-gray-300 mb-1">No campaigns yet</div>
                  <div className="text-xs text-gray-600 mb-5">
                    Create your first AI marketing campaign.
                  </div>
                  <Link href="/campaign/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-light transition">
                    Create campaign
                  </Link>
                </div>
              ) : (
                <div className="p-2">
                  {recentCampaigns.map(c => <CampaignRow key={c.id} campaign={c} />)}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <Link href="/campaign/new"
                className="group bg-accent hover:bg-accent-light transition rounded-xl p-4 flex flex-col gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5.5v5M5.5 8h5" strokeLinecap="round" />
                </svg>
                <div className="text-xs font-semibold text-white">New Campaign</div>
                <div className="text-[10px] text-white/60">AI-powered in minutes</div>
              </Link>

              <Link href="/brand"
                className="group bg-[#141414] border border-[#1f1f1f] hover:border-[#2a2a2a] transition rounded-xl p-4 flex flex-col gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#818cf8" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 4.5v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-xs font-semibold text-white">Brand Memory</div>
                <div className="text-[10px] text-gray-600">Train your AI voice</div>
              </Link>

              <Link href="/media"
                className="group bg-[#141414] border border-[#1f1f1f] hover:border-[#2a2a2a] transition rounded-xl p-4 flex flex-col gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#34d399" strokeWidth="1.5">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
                  <circle cx="5.5" cy="5.5" r="1.5" />
                  <path d="M1.5 11l4-3.5 3 3 2.5-2.5 3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-xs font-semibold text-white">Media Library</div>
                <div className="text-[10px] text-gray-600">Upload assets</div>
              </Link>
            </div>

            {/* Pipeline summary */}
            {!dataLoading && campaigns.length > 0 && (
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-4">Campaign pipeline</div>
                <div className="grid grid-cols-4 gap-3">
                  {(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const).map(status => (
                    <div key={status} className="text-center">
                      <div className="text-xl font-bold text-white">{statusCounts[status] || 0}</div>
                      <div className={`text-[10px] mt-0.5 font-medium ${STATUS_TEXT[status]}`}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            <OnboardingChecklist
              hasWorkspace={true}
              hasCampaign={hasCampaign}
              hasGeneration={hasGeneration}
            />

            {/* Recommendations */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-3">
                Recommended
              </div>
              {!hasCampaign ? (
                <InsightCard
                  icon="🎯"
                  title="Create your first campaign"
                  body="Tell the AI about your business and get a full marketing strategy generated."
                  cta="Get started"
                  href="/campaign/new"
                />
              ) : (
                <InsightCard
                  icon="🧠"
                  title="Train your brand voice"
                  body="Set your tone and audience so every campaign speaks in your brand's language."
                  cta="Set up brand profile"
                  href="/brand"
                />
              )}
              <InsightCard
                icon="⚡"
                title="Upgrade to Pro"
                body="Remove limits on AI generations, exports, and team collaboration."
                cta="See plans"
                href="/billing"
              />
            </div>

            {/* Recent upload activity */}
            {activity.length > 0 && (
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  Recent activity
                </div>
                <div className="space-y-2.5">
                  {activity.slice(0, 4).map(event => (
                    <div key={event.id} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent/60 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-gray-400 leading-snug truncate">
                          {event.eventType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-gray-600">{timeAgo(event.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
