'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

interface Activity {
  id: string
  type: string
  description: string
  createdAt: string
}

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
  aiOutput?: any
  lastViewedAt?: string
  createdAt: string
  updatedAt: string
  activities: Activity[]
}

const ACTIVITY_ICONS: Record<string, string> = {
  created: '✨', generated: '🤖', viewed: '👁', regenerated: '♻️',
  exported: '📤', duplicated: '📋', archived: '📦', favorited: '⭐',
  updated: '✏️',
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
  return new Date(date).toLocaleDateString()
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2 py-1 bg-dark-tertiary hover:bg-accent hover:text-dark rounded transition font-semibold"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return

    fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } })
      .then(r => r.json())
      .then(d => { if (d.campaign) setCampaign(d.campaign) })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [loading, isAuthenticated, campaignId, authHeader, router])

  const updateCampaign = async (data: Partial<Campaign>) => {
    const token = authHeader()
    if (!token || !campaign) return
    setSaving(true)
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify(data),
    })
    const d = await res.json()
    if (d.campaign) setCampaign(prev => prev ? { ...prev, ...d.campaign } : prev)
    setSaving(false)
  }

  const duplicate = async () => {
    const token = authHeader()
    if (!token) return
    const res = await fetch(`/api/campaigns/${campaignId}/duplicate`, { method: 'POST', headers: { Authorization: token } })
    const d = await res.json()
    if (d.campaign) router.push(`/campaigns/${d.campaign.id}`)
  }

  if (loading || fetching) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-5xl mb-4">😕</div>
            <h2 className="text-xl font-bold mb-2 text-white">Campaign not found</h2>
            <Link href="/campaigns" className="text-accent hover:text-accent-light transition text-sm">← Back to Campaigns</Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}
  const concepts = aiOutput?.concepts || []
  const tabs = ['Strategy', 'Ad Concepts', 'Content Calendar', 'Activity']

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          <span>/</span>
          <Link href="/campaigns" className="hover:text-white transition">Campaigns</Link>
          <span>/</span>
          <span className="text-gray-300 truncate max-w-xs">{campaign.name}</span>
        </div>

        {/* Header */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-dark-tertiary flex items-center justify-center text-4xl flex-shrink-0">
                {campaign.thumbnail || '🎯'}
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">{campaign.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                  <span className="capitalize">{campaign.goal?.toLowerCase()} campaign</span>
                  <span>•</span>
                  <span>{campaign.tone}</span>
                  <span>•</span>
                  <span>Created {timeAgo(campaign.createdAt)}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {campaign.platforms.map(p => (
                    <span key={p} className="text-base" title={p}>{PLATFORM_ICONS[p] || '🌐'}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateCampaign({ favorite: !campaign.favorite })}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${campaign.favorite ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'border-dark-tertiary text-gray-400 hover:text-yellow-400'}`}
              >
                {campaign.favorite ? '⭐ Saved' : '☆ Save'}
              </button>
              <button
                onClick={duplicate}
                className="px-4 py-2 rounded-xl border border-dark-tertiary text-sm font-semibold text-gray-400 hover:text-white transition"
              >
                📋 Duplicate
              </button>
              <button
                onClick={() => updateCampaign({ status: campaign.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED' })}
                className="px-4 py-2 rounded-xl border border-dark-tertiary text-sm font-semibold text-gray-400 hover:text-yellow-400 transition"
              >
                {campaign.status === 'ARCHIVED' ? '📂 Unarchive' : '📦 Archive'}
              </button>
              <Link
                href="/campaign/new"
                className="px-4 py-2 rounded-xl bg-accent text-dark text-sm font-bold hover:bg-accent-light transition"
              >
                + New Campaign
              </Link>
            </div>
          </div>

          {campaign.audience && (
            <div className="mt-6 pt-6 border-t border-dark-tertiary">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Target Audience</p>
              <p className="text-sm text-gray-300">{campaign.audience}</p>
            </div>
          )}
        </div>

        {/* No AI output state */}
        {!aiOutput && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-12 text-center mb-6">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold mb-2">AI content not yet generated</h3>
            <p className="text-gray-400 mb-6 text-sm">This campaign was saved without AI content. Generate a new campaign to see full strategy and concepts.</p>
            <Link href="/campaign/new" className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition">
              Generate Campaign →
            </Link>
          </div>
        )}

        {/* Tabs */}
        {aiOutput && (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {tabs.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${activeTab === i ? 'bg-accent text-dark' : 'bg-dark-secondary border border-dark-tertiary text-gray-400 hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Strategy Tab */}
            {activeTab === 0 && (
              <div className="space-y-4">
                {strategy.overview && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>🧠</span> Overview</h3>
                    <p className="text-gray-300 leading-relaxed">{strategy.overview}</p>
                  </div>
                )}
                {strategy.positioning && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>🎯</span> Positioning</h3>
                    <p className="text-gray-300 leading-relaxed">{strategy.positioning}</p>
                  </div>
                )}
                {strategy.valueProps?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>💎</span> Value Propositions</h3>
                    <ul className="space-y-2">
                      {strategy.valueProps.map((vp: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <span className="text-accent mt-0.5">→</span> {vp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {strategy.contentPillars?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>📐</span> Content Pillars</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {strategy.contentPillars.map((p: string, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-3 text-sm text-center text-gray-300 border border-dark-tertiary">{p}</div>
                      ))}
                    </div>
                  </div>
                )}
                {strategy.ctaStrategies?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>📣</span> CTA Strategies</h3>
                    <ul className="space-y-2">
                      {strategy.ctaStrategies.map((cta: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <span className="text-accent mt-0.5">→</span> {cta}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Concepts Tab */}
            {activeTab === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concepts.map((concept: any, i: number) => (
                  <div key={i} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-base mb-1">{concept.name}</h3>
                        <span className="text-xs bg-dark-tertiary px-2 py-1 rounded-full text-gray-400">{concept.angle}</span>
                      </div>
                      <span className="text-sm">{PLATFORM_ICONS[concept.platform] || '🌐'}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{concept.description}</p>
                    {concept.hook && (
                      <div className="bg-dark rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Hook</span>
                          <CopyBtn text={concept.hook} />
                        </div>
                        <p className="text-sm text-accent font-semibold">"{concept.hook}"</p>
                      </div>
                    )}
                    {concept.cta && (
                      <div className="flex items-center justify-between bg-dark rounded-xl p-3">
                        <span className="text-xs text-gray-400">CTA: <span className="text-white">{concept.cta}</span></span>
                        <CopyBtn text={concept.cta} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Calendar Tab */}
            {activeTab === 2 && (
              <div className="space-y-4">
                {(strategy.contentCalendar || []).map((week: any, wi: number) => (
                  <div key={wi} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold mb-4">{week.week || `Week ${wi + 1}`}</h3>
                    <div className="space-y-2">
                      {(week.posts || []).map((post: any, pi: number) => (
                        <div key={pi} className="flex items-center gap-4 bg-dark rounded-xl p-3 text-sm">
                          <span className="text-gray-500 w-16 flex-shrink-0">{post.day}</span>
                          <span>{PLATFORM_ICONS[post.platform] || '🌐'}</span>
                          <span className="text-gray-300 flex-1">{post.topic}</span>
                          <span className="text-xs text-gray-500 bg-dark-tertiary px-2 py-1 rounded-full">{post.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 3 && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><span>📋</span> Campaign Timeline</h3>
                {campaign.activities.length === 0 ? (
                  <p className="text-gray-500 text-sm">No activity yet.</p>
                ) : (
                  <div className="space-y-4">
                    {campaign.activities.map((activity, i) => (
                      <div key={activity.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-dark-tertiary flex items-center justify-center text-sm flex-shrink-0">
                            {ACTIVITY_ICONS[activity.type] || '•'}
                          </div>
                          {i < campaign.activities.length - 1 && (
                            <div className="w-px flex-1 bg-dark-tertiary mt-2" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm text-gray-300">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{timeAgo(activity.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
