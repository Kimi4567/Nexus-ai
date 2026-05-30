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
  const cdT = t('campaignDetail') as Record<string, string>

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(isGenerating)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Unified product agent tabs
  const AGENT_TABS = [
    { name: cdT?.agentStrategyName || 'Strategist', icon: '🧠', title: cdT?.agentStrategyTitle, color: 'text-indigo-400',  border: 'border-indigo-500/30', bg: 'bg-indigo-500/5',  label: cdT?.tabStrategy },
    { name: cdT?.agentNexName     || 'NEX',         icon: '✍️', title: cdT?.agentNexTitle,      color: 'text-pink-400',    border: 'border-pink-500/30',   bg: 'bg-pink-500/5',    label: cdT?.tabContent },
    { name: cdT?.agentPulseName   || 'PULSE',       icon: '⚡', title: cdT?.agentPulseTitle,    color: 'text-amber-400',   border: 'border-amber-500/30',  bg: 'bg-amber-500/5',   label: cdT?.tabCalendar },
    { name: '',                                      icon: '🎨', title: '',                       color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/5',  label: cdT?.tabVisuals },
    { name: '',                                      icon: '📋', title: '',                       color: 'text-gray-400',    border: '',                     bg: '',                 label: cdT?.tabActivity },
  ]

  // Locale-aware timeAgo
  const timeAgo = useCallback((date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return cdT?.timeNow
    if (seconds < 3600) return cdT?.timeMinutesAgo?.replace('{n}', String(Math.floor(seconds / 60)))
    if (seconds < 86400) return cdT?.timeHoursAgo?.replace('{n}', String(Math.floor(seconds / 3600)))
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
          {agent.title && <span className="text-gray-500 text-xs ml-2">· {agent.title}</span>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${agent.color.replace('text-', 'bg-')} animate-pulse`} />
          <span className="text-xs text-gray-600">{cdT?.agentCompletedSection}</span>
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
            <h2 className="text-xl font-bold mb-2 text-white">{cdT?.notFoundTitle}</h2>
            <Link href="/campaigns" className="text-accent hover:text-accent-light transition text-sm">{cdT?.notFoundBack}</Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}
  const topHooks: string[] = aiOutput?.topHooks || strategy.topHooks || []
  const ctaVariations: string[] = aiOutput?.ctaVariations || strategy.ctaVariations || []
  const captionFormulas: string[] = aiOutput?.captionFormulas || []
  const scriptTemplate: string = aiOutput?.scriptTemplate || ''
  const contentCalendar: any[] = aiOutput?.contentCalendar || strategy.contentCalendar || []

  const visualContext = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignGoal: campaign.goal,
    campaignTone: campaign.tone,
    audience: campaign.audience,
  }

  // ── Empty section component ──────────────────────────────────────────────
  function EmptySection({ icon, message }: { icon: string; message: string }) {
    return (
      <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8 text-center">
        <div className="text-3xl mb-3">{icon}</div>
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    )
  }

  return (
    <AppShell>
      <AIPresenceBar authHeader={authHeader} />
      <div className="max-w-5xl mx-auto px-6 py-8 page-enter">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard" className="hover:text-white transition">{cdT?.breadcrumbHome}</Link>
          <span>/</span>
          <Link href="/campaigns" className="hover:text-white transition">{cdT?.breadcrumbCampaigns}</Link>
          <span>/</span>
          <span className="text-gray-300 truncate max-w-xs">{campaign.name}</span>
        </div>

        {/* Header card */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-dark-tertiary flex items-center justify-center text-3xl flex-shrink-0">
                {campaign.thumbnail || '🎯'}
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-1">{campaign.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                  <span className="capitalize">{campaign.goal?.toLowerCase()}</span>
                  <span>·</span>
                  <span>{campaign.tone}</span>
                  <span>·</span>
                  <span>{cdT?.createdLabel?.replace('{timeAgo}', timeAgo(campaign.createdAt) ?? '')}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {campaign.platforms.map(p => (
                    <span key={p} className="text-base" title={p}>{PLATFORM_ICONS[p] || '🌐'}</span>
                  ))}
                </div>
                {campaign.audience && (
                  <p className="text-xs text-gray-500 mt-2 max-w-md">{cdT?.audienceLabel}: {campaign.audience}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateCampaign({ favorite: !campaign.favorite })}
                disabled={saving}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${campaign.favorite ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'border-dark-tertiary text-gray-400 hover:text-yellow-400'}`}
              >
                {campaign.favorite ? cdT?.btnSaved : cdT?.btnSave}
              </button>
              <button
                onClick={duplicate}
                className="px-3 py-2 rounded-xl border border-dark-tertiary text-sm font-semibold text-gray-400 hover:text-white transition"
              >
                {cdT?.btnDuplicate}
              </button>
              <button
                onClick={() => updateCampaign({ status: campaign.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED' })}
                disabled={saving}
                className="px-3 py-2 rounded-xl border border-dark-tertiary text-sm font-semibold text-gray-400 hover:text-yellow-400 transition"
              >
                {campaign.status === 'ARCHIVED' ? cdT?.btnRestore : cdT?.btnArchive}
              </button>
              <button
                onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                className="px-3 py-2 rounded-xl border border-white/10 text-sm font-semibold text-gray-400 hover:text-white hover:border-white/20 transition"
              >
                {cdT?.btnExportPdf}
              </button>
              <Link
                href="/campaigns/new"
                className="px-3 py-2 rounded-xl bg-accent text-dark text-sm font-bold hover:bg-accent-light transition"
              >
                {cdT?.btnNewCampaign}
              </Link>
            </div>
          </div>
        </div>

        {/* Next Actions panel — only when aiOutput exists */}
        {aiOutput && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl px-5 py-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{cdT?.nextActionsTitle}</p>
            <div className="flex flex-wrap gap-2">
              {/* Working: Export PDF */}
              <button
                onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-accent/30 bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20 transition"
              >
                ⬇ {cdT?.btnExportPdf}
              </button>
              {/* Working: Sentinel review — links to Sentinel page */}
              <Link
                href="/sentinel"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-500/30 bg-green-500/8 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition"
              >
                🔍 {cdT?.actionSentinelReview}
              </Link>
              {/* Deferred: Push to Calendar */}
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-tertiary text-gray-600 text-xs font-semibold cursor-not-allowed opacity-50"
                title={cdT?.actionComingSoon}
              >
                📅 {cdT?.actionPushCalendar} — {cdT?.actionComingSoon}
              </button>
              {/* Deferred: Export Package */}
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dark-tertiary text-gray-600 text-xs font-semibold cursor-not-allowed opacity-50"
                title={cdT?.actionComingSoon}
              >
                📦 {cdT?.actionExportPackage} — {cdT?.actionComingSoon}
              </button>
            </div>
          </div>
        )}

        {/* Generating state */}
        {!aiOutput && generating && (
          <div className="bg-dark-secondary border border-amber-500/20 rounded-2xl p-12 text-center mb-6"
            style={{ background: 'rgba(245,158,11,0.03)' }}>
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-xl font-bold mb-2 text-amber-400">{cdT?.generatingTitle}</h3>
            <p className="text-gray-400 mb-6 text-sm">{cdT?.generatingSubtitle}</p>
            <div className="flex justify-center gap-4 mb-4 flex-wrap">
              {([cdT?.genStep1, cdT?.genStep2, cdT?.genStep3, cdT?.genStep4]).map((step, i) => (
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
            <h3 className="text-xl font-bold mb-2">{cdT?.noOutputTitle}</h3>
            <p className="text-gray-400 mb-6 text-sm">{cdT?.noOutputDesc}</p>
            <Link href="/campaigns/new" className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition">
              {cdT?.noOutputBtn}
            </Link>
          </div>
        )}

        {/* Tabs + content */}
        {aiOutput && (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {AGENT_TABS.map((tab, i) => (
                <button
                  key={i}
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

            {/* ── Tab 0: Strategy (Strategist) ─────────────────────────────── */}
            {activeTab === 0 && (
              <div className="space-y-4">
                <AgentBanner idx={0} />

                {/* Key Message — flagship section */}
                {strategy.keyMessage && (
                  <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-sm text-indigo-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <span>💬</span> {cdT?.sectionKeyMessage}
                    </h3>
                    <p className="text-white text-lg font-semibold leading-relaxed">"{strategy.keyMessage}"</p>
                    <div className="mt-3">
                      <CopyBtn text={strategy.keyMessage} label={cdT?.copyBtn || 'Copy'} />
                    </div>
                  </div>
                )}

                {/* Overview */}
                {strategy.overview && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>🧠</span> {cdT?.sectionOverview}</h3>
                    <p className="text-gray-300 leading-relaxed text-sm">{strategy.overview}</p>
                  </div>
                )}

                {/* Positioning */}
                {strategy.positioning && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>🎯</span> {cdT?.sectionPositioning}</h3>
                    <p className="text-gray-300 leading-relaxed text-sm">{strategy.positioning}</p>
                  </div>
                )}

                {/* Value Propositions */}
                {(strategy.valueProps?.length > 0 || strategy.estimatedResults) && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>💎</span> {cdT?.sectionValueProps}</h3>
                    {strategy.valueProps?.length > 0 ? (
                      <ul className="space-y-2">
                        {strategy.valueProps.map((vp: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <span className="text-accent mt-0.5">→</span> {vp}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-300 text-sm">{strategy.estimatedResults}</p>
                    )}
                  </div>
                )}

                {/* Content Pillars */}
                {strategy.contentPillars?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>📐</span> {cdT?.sectionContentPillars}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {strategy.contentPillars.map((p: string, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-3 text-sm text-center text-gray-300 border border-dark-tertiary">{p}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channel Mix */}
                {strategy.channelMix?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>📡</span> {cdT?.sectionChannelMix}</h3>
                    <div className="space-y-3">
                      {strategy.channelMix.map((ch: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 bg-dark rounded-xl p-3 text-sm">
                          <span className="text-gray-300 font-semibold w-28 flex-shrink-0 capitalize">{ch.platform}</span>
                          <div className="flex-1">
                            <div className="w-full bg-dark-tertiary rounded-full h-1.5 mb-1">
                              <div className="h-1.5 bg-accent rounded-full" style={{ width: `${Math.min(ch.budgetPercent, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-500">{ch.rationale}</p>
                          </div>
                          <span className="text-accent font-bold text-xs w-10 text-right">{ch.budgetPercent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* KPIs */}
                {strategy.kpis?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>📊</span> {cdT?.sectionKpis}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {strategy.kpis.map((kpi: any, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-4 border border-dark-tertiary text-center">
                          <p className="text-accent font-bold text-lg">{kpi.target}</p>
                          <p className="text-gray-400 text-xs mt-1">{kpi.metric}</p>
                          <p className="text-gray-600 text-xs">{kpi.timeframe}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visual Direction */}
                {strategy.visualDirection && (
                  <div className="bg-dark-secondary border border-purple-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-purple-400"><span>🎨</span> {cdT?.sectionVisualDirection}</h3>
                    <p className="text-gray-300 leading-relaxed text-sm">{strategy.visualDirection}</p>
                  </div>
                )}

                {/* Execution Checklist */}
                {strategy.executionChecklist?.length > 0 && (
                  <div className="bg-dark-secondary border border-green-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-green-400"><span>✅</span> {cdT?.sectionExecutionChecklist}</h3>
                    <ul className="space-y-2">
                      {strategy.executionChecklist.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <span className="text-green-500 mt-0.5 flex-shrink-0">□</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA Strategies from strategy (fallback) */}
                {strategy.ctaStrategies?.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>📣</span> {cdT?.sectionCtaStrategies}</h3>
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

            {/* ── Tab 1: Content & Hooks (NEX) ──────────────────────────────── */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <AgentBanner idx={1} />

                {/* Top Hooks */}
                <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>🪝</span> {cdT?.sectionTopHooks}</h3>
                  {topHooks.length > 0 ? (
                    <div className="space-y-3">
                      {topHooks.map((hook: string, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-accent font-semibold text-sm flex-1">"{hook}"</p>
                            <div className="flex gap-1 flex-shrink-0">
                              <SaveToMemoryBtn
                                text={hook}
                                field="winningHooks"
                                authHeader={authHeader}
                                saveLabel={cdT?.saveToMemoryBtn || '🧠 Save'}
                                savedLabel={cdT?.savedToMemoryBtn || '🧠 Saved'}
                                title={cdT?.saveToMemoryTitle || 'Save to Brand Memory'}
                              />
                              <CopyBtn text={hook} label={cdT?.copyBtn || 'Copy'} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptySection icon="🪝" message={cdT?.emptyHooksDesc || 'No hooks generated yet.'} />
                  )}
                </div>

                {/* CTA Variations */}
                {ctaVariations.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>📣</span> {cdT?.sectionCtaVariations}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ctaVariations.map((cta: string, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-dark rounded-xl p-3 border border-dark-tertiary gap-3">
                          <span className="text-gray-300 text-sm flex-1">{cta}</span>
                          <CopyBtn text={cta} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caption Formulas */}
                {captionFormulas.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>✍️</span> {cdT?.sectionCaptionFormulas}</h3>
                    <div className="space-y-3">
                      {captionFormulas.map((caption: string, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-gray-300 text-sm leading-relaxed flex-1">{caption}</p>
                            <CopyBtn text={caption} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script Template */}
                {scriptTemplate && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>📝</span> {cdT?.sectionScriptTemplate}</h3>
                    <div className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Script Template</span>
                        <CopyBtn text={scriptTemplate} label={cdT?.copyBtn || 'Copy'} />
                      </div>
                      <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{scriptTemplate}</pre>
                    </div>
                  </div>
                )}

                {/* Fallback if all empty */}
                {topHooks.length === 0 && ctaVariations.length === 0 && captionFormulas.length === 0 && (
                  <EmptySection icon="✍️" message={cdT?.emptyHooksDesc || 'No content generated yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 2: Calendar (PULSE) ───────────────────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <AgentBanner idx={2} />
                {contentCalendar.length > 0 ? (
                  contentCalendar.map((week: any, wi: number) => (
                    <div key={wi} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                      <h3 className="font-bold mb-2 text-amber-400">{week.week || `Week ${wi + 1}`}</h3>
                      {week.theme && <p className="text-xs text-gray-500 mb-4 italic">{week.theme}</p>}
                      <div className="space-y-2">
                        {(week.posts || []).map((post: any, pi: number) => (
                          <div key={pi} className="flex items-start gap-4 bg-dark rounded-xl p-3 text-sm">
                            <span className="text-gray-500 w-16 flex-shrink-0">{post.day}</span>
                            <span className="flex-shrink-0">{PLATFORM_ICONS[post.platform] || '🌐'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-300">{post.topic || post.contentPillar}</p>
                              {post.hook && <p className="text-accent text-xs mt-1 truncate">"{post.hook}"</p>}
                            </div>
                            <span className="text-xs text-gray-500 bg-dark-tertiary px-2 py-1 rounded-full flex-shrink-0">{post.type || post.format}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptySection icon="📅" message={cdT?.emptyCalendarDesc || 'Content calendar not available yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 3: Visuals ────────────────────────────────────────────── */}
            {activeTab === 3 && (
              <div className="space-y-4">
                {/* Visual Direction from strategy */}
                {strategy.visualDirection && (
                  <div className="bg-dark-secondary border border-purple-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-purple-400"><span>🎨</span> {cdT?.sectionVisualDirection}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">{strategy.visualDirection}</p>
                  </div>
                )}
                <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                  <VisualGenerator context={visualContext} />
                </div>
              </div>
            )}

            {/* ── Tab 4: Activity ───────────────────────────────────────────── */}
            {activeTab === 4 && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><span>📋</span> {cdT?.activityTitle}</h3>
                {campaign.activities.length === 0 ? (
                  <p className="text-gray-500 text-sm">{cdT?.noActivity}</p>
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
