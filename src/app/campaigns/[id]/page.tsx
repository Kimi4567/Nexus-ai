'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import VisualGenerator from '@/components/VisualGenerator'
import AIPresenceBar from '@/components/AIPresenceBar'

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

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs px-2 py-1 bg-dark-tertiary hover:bg-accent hover:text-dark rounded transition font-semibold"
    >
      {copied ? '✓' : label}
    </button>
  )
}

function SaveToMemoryBtn({
  text, field, authHeader, saveLabel, savedLabel, title,
}: {
  text: string
  field: 'winningHooks' | 'winningAngles'
  authHeader: () => string | null
  saveLabel: string
  savedLabel: string
  title: string
}) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const token = authHeader()
    if (!token || saving || saved) return
    setSaving(true)
    try {
      const res = await fetch('/api/brand', { headers: { Authorization: token } })
      const data = await res.json()
      const current = data.brandProfile || {}
      const existing: string[] = current[field] || []
      if (existing.includes(text)) { setSaved(true); return }
      const updated = [...existing, text]
      await fetch('/api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ ...current, [field]: updated }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // silent fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={save}
      disabled={saving}
      title={title}
      className={`text-xs px-2 py-1 rounded transition font-semibold ${
        saved
          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
          : 'bg-dark-tertiary hover:bg-indigo-500/20 hover:text-indigo-400 text-gray-500'
      }`}
    >
      {saved ? savedLabel : saving ? '...' : saveLabel}
    </button>
  )
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const campaignId = params?.id as string
  const isGenerating = searchParams?.get('generating') === 'true'
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { t, locale } = useI18n()
  const cdT = t('campaignDetail')

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(isGenerating)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Locale-aware agent tabs — labels from i18n keys
  const AGENT_TABS = [
    { name: 'SAGE',  icon: '🧠', title: cdT?.agentStrategyTitle  as string, color: 'text-indigo-400',  border: 'border-indigo-500/30', bg: 'bg-indigo-500/5',  label: cdT?.tabStrategy  as string },
    { name: 'MUSE',  icon: '🎨', title: cdT?.agentCreativeTitle  as string, color: 'text-pink-400',    border: 'border-pink-500/30',   bg: 'bg-pink-500/5',    label: cdT?.tabConcepts  as string },
    { name: 'MUSE',  icon: '🎨', title: cdT?.agentCreativeTitle  as string, color: 'text-pink-400',    border: 'border-pink-500/30',   bg: 'bg-pink-500/5',    label: cdT?.tabVisuals   as string },
    { name: 'PULSE', icon: '⚡', title: cdT?.agentOperationsTitle as string, color: 'text-amber-400',   border: 'border-amber-500/30',  bg: 'bg-amber-500/5',   label: cdT?.tabCalendar  as string },
    { name: '',      icon: '📋', title: '',                                  color: 'text-gray-400',    border: '',                     bg: '',                 label: cdT?.tabActivity  as string },
  ]

  // Locale-aware timeAgo
  const timeAgo = useCallback((date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return cdT?.timeNow as string
    if (seconds < 3600) return (cdT?.timeMinutesAgo as string)?.replace('{n}', String(Math.floor(seconds / 60)))
    if (seconds < 86400) return (cdT?.timeHoursAgo as string)?.replace('{n}', String(Math.floor(seconds / 3600)))
    return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')
  }, [cdT, locale])

  function AgentBanner({ idx }: { idx: number }) {
    const agent = AGENT_TABS[idx]
    if (!agent.name) return null
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${agent.border} ${agent.bg} mb-5`}>
        <span className="text-lg">{agent.icon}</span>
        <div>
          <span className={`font-bold text-sm ${agent.color}`}>{agent.name}</span>
          <span className="text-gray-500 text-xs ml-2">· {agent.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${agent.color.replace('text-', 'bg-')} animate-pulse`} />
          <span className="text-xs text-gray-600">{cdT?.agentCompletedSection as string}</span>
        </div>
      </div>
    )
  }

  const fetchCampaign = useCallback(async () => {
    const token = authHeader()
    if (!token) return null
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } })
      const d = await res.json()
      if (d.campaign) {
        setCampaign(d.campaign)
        return d.campaign
      }
    } catch {}
    return null
  }, [campaignId, authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    fetchCampaign().finally(() => setFetching(false))
  }, [loading, isAuthenticated, fetchCampaign, router])

  // Poll for AI output when generating=true
  useEffect(() => {
    if (!generating || !isAuthenticated) return
    let attempts = 0
    const MAX_ATTEMPTS = 24

    pollRef.current = setInterval(async () => {
      attempts++
      const c = await fetchCampaign()
      if (c?.aiOutput || attempts >= MAX_ATTEMPTS) {
        setGenerating(false)
        if (pollRef.current) clearInterval(pollRef.current)
        router.replace(`/campaigns/${campaignId}`)
      }
    }, 5000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [generating, isAuthenticated, campaignId, fetchCampaign, router])

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
            <h2 className="text-xl font-bold mb-2 text-white">{cdT?.notFoundTitle as string}</h2>
            <Link href="/campaigns" className="text-accent hover:text-accent-light transition text-sm">{cdT?.notFoundBack as string}</Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}
  const concepts = aiOutput?.concepts || []

  const visualContext = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignGoal: campaign.goal,
    campaignTone: campaign.tone,
    audience: campaign.audience,
  }

  return (
    <AppShell>
      <AIPresenceBar authHeader={authHeader} />
      <div className="max-w-4xl mx-auto px-8 py-8 page-enter">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard" className="hover:text-white transition">{cdT?.breadcrumbHome as string}</Link>
          <span>/</span>
          <Link href="/campaigns" className="hover:text-white transition">{cdT?.breadcrumbCampaigns as string}</Link>
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
                  <span>{campaign.goal?.toLowerCase()}</span>
                  <span>•</span>
                  <span>{campaign.tone}</span>
                  <span>•</span>
                  <span>
                    {(cdT?.createdLabel as string)?.replace('{timeAgo}', timeAgo(campaign.createdAt))}
                  </span>
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
                {campaign.favorite ? cdT?.btnSaved as string : cdT?.btnSave as string}
              </button>
              <button
                onClick={duplicate}
                className="px-4 py-2 rounded-xl border border-dark-tertiary text-sm font-semibold text-gray-400 hover:text-white transition"
              >
                {cdT?.btnDuplicate as string}
              </button>
              <button
                onClick={() => updateCampaign({ status: campaign.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED' })}
                className="px-4 py-2 rounded-xl border border-dark-tertiary text-sm font-semibold text-gray-400 hover:text-yellow-400 transition"
              >
                {campaign.status === 'ARCHIVED' ? cdT?.btnRestore as string : cdT?.btnArchive as string}
              </button>
              <button
                onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:border-white/20 transition"
                title={cdT?.btnExportPdf as string}
              >
                {cdT?.btnExportPdf as string}
              </button>
              <Link
                href="/campaigns/new"
                className="px-4 py-2 rounded-xl bg-accent text-dark text-sm font-bold hover:bg-accent-light transition"
              >
                {cdT?.btnNewCampaign as string}
              </Link>
            </div>
          </div>

          {campaign.audience && (
            <div className="mt-6 pt-6 border-t border-dark-tertiary">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{cdT?.audienceLabel as string}</p>
              <p className="text-sm text-gray-300">{campaign.audience}</p>
            </div>
          )}
        </div>

        {/* Generating state */}
        {!aiOutput && generating && (
          <div className="bg-dark-secondary border border-amber-500/20 rounded-2xl p-12 text-center mb-6"
            style={{ background: 'rgba(245,158,11,0.03)' }}>
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-xl font-bold mb-2 text-amber-400">{cdT?.generatingTitle as string}</h3>
            <p className="text-gray-400 mb-6 text-sm">
              {cdT?.generatingSubtitle as string}
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {([cdT?.genStep1, cdT?.genStep2, cdT?.genStep3, cdT?.genStep4] as string[]).map((step, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500/40 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  {step}
                </div>
              ))}
            </div>
            <div className="w-48 h-1 bg-dark-tertiary rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* No AI output state (not generating) */}
        {!aiOutput && !generating && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-12 text-center mb-6">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-bold mb-2">{cdT?.noOutputTitle as string}</h3>
            <p className="text-gray-400 mb-6 text-sm">{cdT?.noOutputDesc as string}</p>
            <Link href="/campaigns/new" className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition">
              {cdT?.noOutputBtn as string}
            </Link>
          </div>
        )}

        {/* Tabs */}
        {aiOutput && (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {AGENT_TABS.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                    activeTab === i
                      ? 'bg-accent text-dark'
                      : 'bg-dark-secondary border border-dark-tertiary text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Strategy Tab — SAGE */}
            {activeTab === 0 && (
              <div className="space-y-4">
                <AgentBanner idx={0} />
                {strategy.overview && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>🧠</span> {cdT?.sectionOverview as string}</h3>
                    <p className="text-gray-300 leading-relaxed">{strategy.overview}</p>
                  </div>
                )}
                {strategy.positioning && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>🎯</span> {cdT?.sectionPositioning as string}</h3>
                    <p className="text-gray-300 leading-relaxed">{strategy.positioning}</p>
                  </div>
                )}
                {strategy.valueProps?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>💎</span> {cdT?.sectionValueProps as string}</h3>
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
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>📐</span> {cdT?.sectionContentPillars as string}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {strategy.contentPillars.map((p: string, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-3 text-sm text-center text-gray-300 border border-dark-tertiary">{p}</div>
                      ))}
                    </div>
                  </div>
                )}
                {strategy.ctaStrategies?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><span>📣</span> {cdT?.sectionCtaStrategies as string}</h3>
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

            {/* Concepts Tab — MUSE */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <AgentBanner idx={1} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {concepts.map((concept: any, i: number) => (
                    <div key={i} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-base mb-1">{concept.name}</h3>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs bg-dark-tertiary px-2 py-1 rounded-full text-gray-400">{concept.angle}</span>
                            {concept.angle && (
                              <SaveToMemoryBtn
                                text={concept.angle}
                                field="winningAngles"
                                authHeader={authHeader}
                                saveLabel={cdT?.saveToMemoryBtn as string}
                                savedLabel={cdT?.savedToMemoryBtn as string}
                                title={cdT?.saveToMemoryTitle as string}
                              />
                            )}
                          </div>
                        </div>
                        <span className="text-sm">{PLATFORM_ICONS[concept.platform] || '🌐'}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{concept.description}</p>
                      {concept.hook && (
                        <div className="bg-dark rounded-xl p-3 mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">{cdT?.hookLabel as string}</span>
                            <div className="flex items-center gap-1">
                              <SaveToMemoryBtn
                                text={concept.hook}
                                field="winningHooks"
                                authHeader={authHeader}
                                saveLabel={cdT?.saveToMemoryBtn as string}
                                savedLabel={cdT?.savedToMemoryBtn as string}
                                title={cdT?.saveToMemoryTitle as string}
                              />
                              <CopyBtn text={concept.hook} label={cdT?.copyBtn as string} />
                            </div>
                          </div>
                          <p className="text-sm text-accent font-semibold">"{concept.hook}"</p>
                        </div>
                      )}
                      {concept.cta && (
                        <div className="flex items-center justify-between bg-dark rounded-xl p-3">
                          <span className="text-xs text-gray-400">CTA: <span className="text-white">{concept.cta}</span></span>
                          <CopyBtn text={concept.cta} label={cdT?.copyBtn as string} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visuals Tab — MUSE */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <AgentBanner idx={2} />
                <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                  <VisualGenerator context={visualContext} />
                </div>
              </div>
            )}

            {/* Calendar Tab — PULSE */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <AgentBanner idx={3} />
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
            {activeTab === 4 && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><span>📋</span> {cdT?.activityTitle as string}</h3>
                {campaign.activities.length === 0 ? (
                  <p className="text-gray-500 text-sm">{cdT?.noActivity as string}</p>
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
