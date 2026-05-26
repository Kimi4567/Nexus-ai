'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'
import AIPresenceBar from '@/components/AIPresenceBar'
import { SkeletonStatCard, SkeletonCampaignRow } from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────
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
  thumbnail?: string
  createdAt: string
  updatedAt: string
}

// ── Constants ──────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400', DRAFT: 'bg-amber-400',
  COMPLETED: 'bg-blue-400', ARCHIVED: 'bg-gray-600',
  SCHEDULED: 'bg-violet-400', PAUSED: 'bg-orange-400',
}
const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'text-emerald-400', DRAFT: 'text-amber-400',
  COMPLETED: 'text-blue-400', ARCHIVED: 'text-gray-500',
  SCHEDULED: 'text-violet-400', PAUSED: 'text-orange-400',
}
const STATUS_BG: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10', DRAFT: 'bg-amber-500/10',
  COMPLETED: 'bg-blue-500/10', ARCHIVED: 'bg-gray-600/10',
  SCHEDULED: 'bg-violet-500/10', PAUSED: 'bg-orange-500/10',
}
const GOAL_ICON: Record<string, string> = {
  SALES: '💰', AWARENESS: '📢', LEADS: '🎯',
  TRAFFIC: '🔥', ENGAGEMENT: '💬', BRAND_BUILDING: '🏆',
}
const PLATFORM_ICON: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶️', LINKEDIN: '💼',
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60)     return 'just now'
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent, loading }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent?: boolean; loading: boolean
}) {
  if (loading) return <SkeletonStatCard />
  return (
    <div className={`rounded-card p-5 transition-all duration-150
      ${accent ? 'surface-accent' : 'surface-card'}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-3
        ${accent ? 'bg-accent/20' : 'bg-s3'}`}>
        <span className={`text-sm ${accent ? 'text-accent' : 'text-t2'}`}>{icon}</span>
      </div>
      <div className="text-[10px] font-semibold text-t3 uppercase tracking-widest mb-1.5">{label}</div>
      <div className="text-2xl font-bold text-t1 tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-t4 mt-0.5">{sub}</div>}
    </div>
  )
}

function CampaignRow({ campaign, index }: { campaign: Campaign; index: number }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-150 group"
      style={{ animationDelay: `${index * 40}ms`, animation: 'slideUp 0.2s ease both' }}
    >
      <div className="w-8 h-8 rounded-lg bg-s3 border border-s4 flex items-center justify-center text-sm flex-shrink-0 group-hover:border-s5 transition-colors">
        {campaign.thumbnail || GOAL_ICON[campaign.goal] || '🎯'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-t1 truncate group-hover:text-white transition-colors">
          {campaign.name}
        </div>
        <div className="text-[11px] text-t3 mt-0.5 flex items-center gap-1">
          {campaign.platforms.slice(0, 3).map(p => (
            <span key={p}>{PLATFORM_ICON[p] || '🌐'}</span>
          ))}
          {campaign.platforms.length > 3 && (
            <span className="text-[10px]">+{campaign.platforms.length - 3}</span>
          )}
        </div>
      </div>
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BG[campaign.status] || ''}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[campaign.status] || 'bg-gray-600'}`} />
        <span className={`text-[10px] font-semibold ${STATUS_TEXT[campaign.status] || 'text-gray-500'}`}>
          {campaign.status.charAt(0) + campaign.status.slice(1).toLowerCase()}
        </span>
      </div>
      <div className="text-[11px] text-t3 flex-shrink-0 w-14 text-right hidden sm:block">
        {timeAgo(campaign.updatedAt)}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
        className="text-t4 group-hover:text-t2 transition-colors flex-shrink-0">
        <path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

function OnboardingBar({ hasCampaign, hasGeneration, hasBrand }: {
  hasCampaign: boolean; hasGeneration: boolean; hasBrand: boolean
}) {
  const steps = [
    { label: 'Create workspace', done: true },
    { label: 'First campaign', done: hasCampaign, href: '/campaign/new' },
    { label: 'Brand profile', done: hasBrand, href: '/brand' },
    { label: 'Generate content', done: hasGeneration },
  ]
  const completed = steps.filter(s => s.done).length
  if (completed === steps.length) return null
  const next = steps.find(s => !s.done)

  return (
    <div className="surface-card rounded-card p-4 flex items-center gap-4 mb-6">
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#161622" strokeWidth="3" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#6366f1" strokeWidth="3"
            strokeDasharray={`${(completed / steps.length) * 94.2} 94.2`}
            strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
          {completed}/{steps.length}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-t3 mb-2 font-medium">Getting started</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-1.5 text-[11px] font-medium ${step.done ? 'text-gray-600' : 'text-gray-300'}`}>
              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors
                ${step.done ? 'bg-accent border-accent' : 'border-[#333]'}`}>
                {step.done && (
                  <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="white" strokeWidth="1.5">
                    <path d="M1 3l1.5 1.5 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={step.done ? 'line-through opacity-50' : ''}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
      {next?.href && (
        <Link href={next.href}
          className="flex-shrink-0 text-[11px] font-semibold text-accent hover:text-accent-light transition px-3 py-1.5 bg-accent/10 rounded-lg whitespace-nowrap">
          Continue →
        </Link>
      )}
    </div>
  )
}

function PipelineWidget({ campaigns }: { campaigns: Campaign[] }) {
  const counts = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const stages = [
    { key: 'DRAFT', label: 'Draft', color: 'bg-amber-400', text: 'text-amber-400' },
    { key: 'ACTIVE', label: 'Active', color: 'bg-emerald-400', text: 'text-emerald-400' },
    { key: 'COMPLETED', label: 'Done', color: 'bg-blue-400', text: 'text-blue-400' },
  ]
  return (
    <div className="surface-card rounded-card p-5">
      <div className="text-[10px] font-semibold text-t3 uppercase tracking-widest mb-4">Campaign pipeline</div>
      <div className="space-y-3">
        {stages.map(stage => {
          const count = counts[stage.key] || 0
          const max = Math.max(...stages.map(s => counts[s.key] || 0), 1)
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div className={`text-[10px] font-semibold w-12 flex-shrink-0 ${stage.text}`}>{stage.label}</div>
              <div className="flex-1 h-1.5 bg-s3 rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all duration-700 ${stage.color}`}
                  style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <div className="text-xs font-bold text-white w-4 text-right tabular-nums">{count}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()

  const [overview, setOverview] = useState<Overview | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [hasBrand, setHasBrand] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [aiCredits, setAiCredits] = useState<number | null>(null)
  const [isPaidUser, setIsPaidUser] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  const fetchData = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setDataLoading(true)
    try {
      const [overviewRes, campaignsRes, brandRes, billingRes] = await Promise.allSettled([
        fetch('/api/analytics/overview', { headers: { Authorization: token } }),
        fetch('/api/campaigns?sort=updatedAt&limit=8', { headers: { Authorization: token } }),
        fetch('/api/brand', { headers: { Authorization: token } }),
        fetch('/api/billing/status', { headers: { Authorization: token } }),
      ])
      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        setOverview(await overviewRes.value.json())
      }
      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const d = await campaignsRes.value.json()
        setCampaigns(Array.isArray(d) ? d.slice(0, 8) : (d.campaigns || []).slice(0, 8))
      }
      if (brandRes.status === 'fulfilled' && brandRes.value.ok) {
        const d = await brandRes.value.json()
        setHasBrand(!!(d.brandProfile?.brandName || d.brandProfile?.toneKeywords?.length))
      }
      if (billingRes.status === 'fulfilled' && billingRes.value.ok) {
        const d = await billingRes.value.json()
        setAiCredits(d.credits ?? null)
        setIsPaidUser(d.status === 'ACTIVE')
      }
    } catch (err) {
      console.error('Dashboard fetch error', err)
    } finally {
      setDataLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) fetchData()
  }, [isAuthenticated, fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'
  const firstName = displayName.split(' ')[0]
  const hasCampaign = (overview?.campaignsCount ?? campaigns.length) > 0
  const hasGeneration = (overview?.generationsCount || 0) > 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell>
      {/* AI Presence Bar */}
      <AIPresenceBar authHeader={authHeader} />

      <div className="px-6 py-7 max-w-[1100px] page-enter">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-t1 tracking-tight">{greeting}, {firstName}</h1>
            <p className="text-[13px] text-t3 mt-0.5">Your marketing operations at a glance.</p>
          </div>
          <Link href="/campaign/new"
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-light text-white text-xs font-semibold rounded-lg transition-colors">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6" cy="6" r="5" /><path d="M6 4v4M4 6h4" strokeLinecap="round" />
            </svg>
            New campaign
          </Link>
        </div>

        {/* Onboarding */}
        {!dataLoading && (
          <OnboardingBar hasCampaign={hasCampaign} hasGeneration={hasGeneration} hasBrand={hasBrand} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
          <StatCard label="Campaigns" value={overview?.campaignsCount ?? '—'} sub="all time" loading={dataLoading}
            icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 3.5h12M1 7h8M1 10.5h5" strokeLinecap="round" /></svg>} />
          <StatCard label="AI Generations" value={overview?.generationsCount ?? '—'} sub="content pieces" loading={dataLoading}
            icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 1.5L8.5 5H12l-2.8 2 1.1 3.5L7 8.5l-3.3 2 1.1-3.5L2 5h3.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
          <StatCard label="Exports" value={overview?.exportsCount ?? '—'} sub="packages delivered" loading={dataLoading}
            icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 9.5v2h9v-2M7 1.5v7M4.5 6l2.5 2.5L9.5 6" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
          <StatCard
            label="AI Credits"
            value={isPaidUser ? '∞' : (aiCredits !== null ? String(aiCredits) : '—')}
            sub={isPaidUser ? 'Unlimited · Pro' : 'remaining · Free'}
            loading={dataLoading} accent
            icon="⚡" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left 2 cols */}
          <div className="lg:col-span-2 space-y-4">

            {/* Campaign list */}
            <div className="surface-card rounded-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  {!dataLoading && hasCampaign && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-white">Recent campaigns</span>
                  {!dataLoading && campaigns.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-s3 text-t3 rounded-md font-medium tabular-nums">
                      {campaigns.length}
                    </span>
                  )}
                </div>
                <Link href="/campaigns" className="text-[11px] text-t3 hover:text-white transition font-medium">
                  All campaigns →
                </Link>
              </div>

              {dataLoading ? (
                <div className="p-3 space-y-1">
                  {[...Array(5)].map((_, i) => <SkeletonCampaignRow key={i} />)}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 px-6">
                  <div className="w-10 h-10 rounded-xl bg-s2 border border-s4 flex items-center justify-center text-lg mb-3">🚀</div>
                  <div className="text-[13px] font-semibold text-t1 mb-1">No campaigns yet</div>
                  <div className="text-[11px] text-t3 mb-5 max-w-xs">
                    Describe your business and Nexus AI will build a full marketing strategy in under 60 seconds.
                  </div>
                  <Link href="/campaign/new"
                    className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-light transition">
                    Create first campaign
                  </Link>
                </div>
              ) : (
                <div className="p-2">
                  {campaigns.map((c, i) => <CampaignRow key={c.id} campaign={c} index={i} />)}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  href: '/campaign/new', accent: true, label: 'New Campaign', sub: 'AI strategy in 60s',
                  icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v5M4.5 7h5" strokeLinecap="round" /></svg>,
                },
                {
                  href: '/brand', accent: false, label: 'Brand Memory', sub: 'Train your AI voice',
                  icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#818cf8" strokeWidth="1.5"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  href: '/media', accent: false, label: 'Media Library', sub: 'Upload assets',
                  icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#34d399" strokeWidth="1.5"><rect x="1" y="1" width="12" height="12" rx="2.5" /><circle cx="4.5" cy="4.5" r="1.5" /><path d="M1 9.5l3.5-3 2.5 2.5 2-2 3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
              ].map(({ href, accent, label, sub, icon }) => (
                <Link key={href} href={href}
                  className={`group rounded-card p-4 flex items-center gap-3 transition-all duration-150
                    ${accent ? 'bg-accent hover:bg-accent-light border border-transparent' : 'surface-card hover:border-s5'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent ? 'bg-white/15' : 'bg-s3 group-hover:bg-s4 transition-colors'}`}>
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold leading-none mb-1 ${accent ? 'text-white' : 'text-t1'}`}>{label}</div>
                    <div className={`text-[10px] leading-none ${accent ? 'text-white/60' : 'text-t3'}`}>{sub}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pipeline */}
            {!dataLoading && campaigns.length > 0 && <PipelineWidget campaigns={campaigns} />}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Brand status */}
            {dataLoading ? (
              <div className="skeleton h-28 rounded-xl" />
            ) : (
              <Link href="/brand"
                className={`group block rounded-card p-5 transition-all duration-150
                  ${hasBrand ? 'surface-card' : 'surface-accent'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-t3">Brand Memory</div>
                  <div className={`w-2 h-2 rounded-full ${hasBrand ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </div>
                {hasBrand ? (
                  <>
                    <div className="text-[13px] font-semibold text-white mb-1">Voice active</div>
                    <div className="text-[11px] text-t3">AI using your brand context. Update anytime to refine output.</div>
                  </>
                ) : (
                  <>
                    <div className="text-[13px] font-semibold text-amber-300 mb-1">Brand memory empty</div>
                    <div className="text-[11px] text-t2 mb-3">Campaigns generating without your voice. Configure now.</div>
                    <div className="text-[11px] font-semibold text-accent group-hover:text-accent-light transition">Configure brand →</div>
                  </>
                )}
              </Link>
            )}

            {/* Workspace status */}
            {!dataLoading && campaigns.length > 0 && (
              <div className="surface-card rounded-card p-5">
                <div className="text-[10px] font-semibold text-t3 uppercase tracking-widest mb-3">Workspace status</div>
                <div className="space-y-2.5">
                  {[
                    { label: `${campaigns.filter(c => c.status === 'ACTIVE').length} active`, sub: 'campaigns running', dot: 'bg-emerald-400' },
                    { label: `${campaigns.filter(c => c.status === 'DRAFT').length} in draft`, sub: 'ready to activate', dot: 'bg-amber-400'},
                    { label: hasBrand ? 'Brand voice on' : 'Brand voice off', sub: hasBrand ? 'AI trained on your tone' : 'configure brand profile', dot: hasBrand ? 'bg-accent' : 'bg-gray-600' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dot}`} />
                      <div>
                        <div className="text-[12px] font-semibold text-t1 leading-none mb-0.5">{item.label}</div>
                        <div className="text-[10px] text-t3">{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {dataLoading && <div className="skeleton h-32 rounded-xl" />}

            {/* AI Credits Widget */}
            {!isPaidUser && aiCredits !== null && (
              <div className="surface-card rounded-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold text-t3 uppercase tracking-widest">AI Credits</div>
                  <span className="text-[11px] font-bold text-white">{aiCredits} left</span>
                </div>
                <div className="w-full h-1.5 bg-s3 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${aiCredits <= 10 ? 'bg-red-400' : aiCredits <= 20 ? 'bg-amber-400' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, (aiCredits / 30) * 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-t3 mb-3">{Math.floor(aiCredits / 10)} generation{Math.floor(aiCredits / 10) !== 1 ? 's' : ''} remaining · 10 credits each</div>
                {aiCredits < 20 && (
                  <Link href="/billing"
                    className="block text-center text-[11px] font-semibold text-white py-2 rounded-lg bg-accent hover:bg-accent-light transition">
                    Upgrade for unlimited →
                  </Link>
                )}
              </div>
            )}

            {/* Upgrade */}
            <Link href="/billing"
              className="group block surface-card rounded-card p-5 transition-all duration-150 hover:border-accent/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent text-sm">⚡</span>
                <span className="text-[12px] font-semibold text-t1">Go Pro</span>
              </div>
              <div className="text-[11px] text-t3 mb-3">Unlimited campaigns, AI credits, and visual generation.</div>
              <div className="text-[11px] font-semibold text-accent group-hover:text-accent-light transition">See plans →</div>
            </Link>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
