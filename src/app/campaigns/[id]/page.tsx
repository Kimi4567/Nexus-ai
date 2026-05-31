'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import VisualGenerator from '@/components/VisualGenerator'
import AIPresenceBar from '@/components/AIPresenceBar'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'

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
  const [brandScore, setBrandScore] = useState<number | null>(null)
  const [brandNoticeDismissed, setBrandNoticeDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(isGenerating)
  const [approvalState, setApprovalState] = useState<'idle' | 'confirming' | 'approving' | 'done'>('idle')
  const [sentinelState, setSentinelState] = useState<'idle' | 'reviewing' | 'done'>('idle')
  const [sentinelError, setSentinelError] = useState('')
  // Sprint H — Push to Calendar
  const [calendarPushState, setCalendarPushState] = useState<'idle' | 'pushing' | 'done' | 'already'>('idle')
  const [calendarPushCount, setCalendarPushCount] = useState(0)
  const [calendarPushError, setCalendarPushError] = useState('')
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
    // Fetch brand readiness for the quality notice
    const token = authHeader()
    if (token) {
      fetch('/api/brand', { headers: { Authorization: token } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setBrandScore(getBrandBrainReadiness(data.brandProfile).score)
        })
        .catch(() => {})
    }
  }, [loading, isAuthenticated, fetchCampaign, router, authHeader])

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

  const handleApprove = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    setApprovalState('approving')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      const d = await res.json()
      if (d.campaign) {
        setCampaign(prev => prev ? { ...prev, status: 'ACTIVE' } : prev)
        setApprovalState('done')
      } else {
        setApprovalState('idle')
      }
    } catch {
      setApprovalState('idle')
    }
  }

  const handleSentinelReview = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    setSentinelState('reviewing')
    setSentinelError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sentinel-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ language: locale }),
      })
      const d = await res.json()
      if (d.sentinelReview) {
        // Patch local campaign state with updated aiOutput
        setCampaign(prev => {
          if (!prev) return prev
          const existing = (prev.aiOutput as any) || {}
          return { ...prev, aiOutput: { ...existing, sentinelReview: d.sentinelReview } }
        })
        setSentinelState('done')
      } else if (d.error === 'INSUFFICIENT_CREDITS') {
        setSentinelError(`Not enough credits (need ${d.requiredCredits}, have ${d.currentCredits}). Upgrade to continue.`)
        setSentinelState('idle')
      } else {
        setSentinelError(d.error || 'Review failed')
        setSentinelState('idle')
      }
    } catch {
      setSentinelError('Network error — please try again')
      setSentinelState('idle')
    }
  }

  // Sprint H — Push to Calendar
  const handlePushToCalendar = async (force = false) => {
    const token = authHeader()
    if (!token || !campaign) return
    setCalendarPushState('pushing')
    setCalendarPushError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/push-to-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ force }),
      })
      const d = await res.json()
      if (d.alreadyPushed && !force) {
        setCalendarPushCount(d.count ?? 0)
        setCalendarPushState('already')
      } else if (d.success) {
        setCalendarPushCount(d.count ?? 0)
        setCalendarPushState('done')
        // Update local aiOutput with calendarPushedAt
        setCampaign(prev => prev ? {
          ...prev,
          aiOutput: { ...(prev.aiOutput as any), calendarPushedAt: d.pushedAt }
        } : prev)
      } else if (d.error === 'NO_CONTENT_CALENDAR') {
        setCalendarPushError(cdT?.pushCalendarNoContent || 'No content calendar found. Run Full Strategy first.')
        setCalendarPushState('idle')
      } else {
        setCalendarPushError(d.error || cdT?.pushCalendarFailed || 'Push failed. Please try again.')
        setCalendarPushState('idle')
      }
    } catch {
      setCalendarPushError(cdT?.pushCalendarFailed || 'Push failed. Please try again.')
      setCalendarPushState('idle')
    }
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
  // Sprint D2 — deep strategy fields
  const contentAngles: string[] = strategy.contentAngles || []
  const audienceSegments: string[] = strategy.audienceSegments || []
  const weeklyPlan: any[] = strategy.weeklyPlan || []
  const channelStrategy: any[] = strategy.channelStrategy || []
  const successMetrics: string[] = strategy.successMetrics || []
  const riskNotes: string[] = strategy.riskNotes || []
  // Sprint F — creative brief
  const creativeBrief = aiOutput?.creativeBrief || null
  const creativeMode: 'asset' | 'concept' | null = aiOutput?.creativeMode || null
  // Sprint G — sentinel review
  const sentinelReview = aiOutput?.sentinelReview || null
  const sentinelStatus: 'not_reviewed' | 'passed' | 'needs_attention' =
    sentinelReview ? sentinelReview.status : 'not_reviewed'
  // Sprint H — calendar push state from stored aiOutput
  const storedCalendarPushedAt: string | null = aiOutput?.calendarPushedAt || null
  const storedCalendarCount: number = (aiOutput?.calendarItems ?? []).length
  const hasContentCalendar: boolean =
    (aiOutput?.contentCalendar?.length > 0) ||
    (aiOutput?.strategy?.contentCalendar?.length > 0) ||
    (aiOutput?.strategy?.weeklyPlan?.length > 0) ||
    (aiOutput?.strategy?.contentPillars?.length > 0)

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

        {/* Brand Brain quality notice (shown when score < 60 and not dismissed) */}
        {brandScore !== null && brandScore < 60 && !brandNoticeDismissed && (() => {
          const bg = t('brandGate') as Record<string, string>
          return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 justify-between"
              style={{ background: 'rgba(255,184,0,0.05)', border: '1px solid rgba(255,184,0,0.18)' }}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="text-sm" style={{ color: '#FFB800' }}>⚠</span>
                <p className="text-xs text-text-muted">{bg.campaignNotice}</p>
                <Link href="/brand"
                  className="text-[11px] font-bold flex-shrink-0"
                  style={{ color: '#FFB800' }}>
                  {bg.campaignNoticeBtn} →
                </Link>
              </div>
              <button
                onClick={() => setBrandNoticeDismissed(true)}
                className="text-text-muted hover:text-white transition-all text-xs px-1 flex-shrink-0">
                ✕
              </button>
            </div>
          )
        })()}

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

        {/* ── Execution Pipeline Panel — only when aiOutput exists ──────── */}
        {aiOutput && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl px-5 py-5 mb-6">

            {/* Pipeline stage tracker */}
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{cdT?.pipelineLabel || 'Campaign Pipeline'}</p>
            <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 flex-nowrap">
              {[
                { key: 'strategy',  label: cdT?.pipelineStrategy  || 'Strategy',  done: true },
                { key: 'content',   label: cdT?.pipelineContent   || 'Content',   done: !!(topHooks.length > 0 || contentCalendar.length > 0) },
                { key: 'creative',  label: cdT?.pipelineCreative  || 'Creative',  done: !!creativeBrief },
                { key: 'sentinel',  label: cdT?.pipelineSentinel  || 'Sentinel',  done: sentinelStatus === 'passed', warn: sentinelStatus === 'needs_attention' },
                { key: 'approved',  label: cdT?.pipelineApproved  || 'Approved',  done: campaign.status === 'ACTIVE' || approvalState === 'done' },
                { key: 'executing', label: cdT?.pipelineExecuting || 'Executing', done: false, dim: true },
              ].map((stage, i, arr) => (
                <div key={stage.key} className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                    stage.done
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : (stage as any).warn
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : stage.dim
                          ? 'bg-transparent text-gray-700 border-dark-tertiary'
                          : 'bg-accent/10 text-accent border-accent/25'
                  }`}>
                    {stage.done ? '✓ ' : (stage as any).warn ? '⚠ ' : ''}{stage.label}
                  </span>
                  {i < arr.length - 1 && <span className="text-gray-700 text-xs flex-shrink-0">→</span>}
                </div>
              ))}
            </div>

            {/* Action groups */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Group 1: Prepare */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">{cdT?.stepGroupPrepare || 'Prepare'}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/content-pack`, '_blank')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-accent/30 bg-accent/8 text-accent text-xs font-semibold hover:bg-accent/15 transition text-left"
                  >
                    {cdT?.stepContentPack || '📦 Content Pack'}
                    <span className="ml-auto text-accent/50 text-xs">↗</span>
                  </button>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/execution-package`, '_blank')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/8 text-purple-400 text-xs font-semibold hover:bg-purple-500/15 transition text-left"
                  >
                    {cdT?.stepExecutionPkg || '📋 Execution Package'}
                    <span className="ml-auto text-purple-400/50 text-xs">↗</span>
                  </button>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-tertiary text-gray-400 text-xs font-semibold hover:text-white hover:border-white/20 transition text-left"
                  >
                    {cdT?.stepExportPdf || '⬇ Export PDF'}
                  </button>
                </div>
              </div>

              {/* Group 2: Launch */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">{cdT?.stepGroupLaunch || 'Launch'}</p>
                <div className="space-y-2">
                  {campaign.status === 'ACTIVE' || approvalState === 'done' ? (
                    <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-green-500/30 bg-green-500/8 text-green-400 text-xs font-semibold">
                      {cdT?.stepApprovedBadge || '✅ Campaign Approved'}
                    </div>
                  ) : (
                    <button
                      onClick={() => setApprovalState('confirming')}
                      disabled={approvalState === 'approving'}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-green-500/30 bg-green-500/8 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition text-left disabled:opacity-60"
                    >
                      {approvalState === 'approving' ? '...' : (cdT?.stepApproveCampaign || '✅ Approve for Execution')}
                    </button>
                  )}
                  {/* Push to Calendar — Sprint H */}
                  {calendarPushState === 'done' || (calendarPushState === 'idle' && storedCalendarPushedAt) ? (
                    <div className="space-y-1">
                      <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/8 text-cyan-400 text-xs font-semibold">
                        {cdT?.pushCalendarSuccess?.replace('{count}', String(calendarPushState === 'done' ? calendarPushCount : storedCalendarCount)) || `✅ ${calendarPushState === 'done' ? calendarPushCount : storedCalendarCount} items pushed`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href="/calendar" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-cyan-500/20 text-cyan-500 text-xs font-semibold hover:bg-cyan-500/10 transition">
                          {cdT?.pushCalendarOpenLink || '→ Open Calendar'}
                        </Link>
                        <button
                          onClick={() => handlePushToCalendar(true)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dark-tertiary text-gray-500 text-xs hover:text-gray-300 transition"
                        >
                          {cdT?.pushCalendarRepush || 'Re-push'}
                        </button>
                      </div>
                    </div>
                  ) : calendarPushState === 'already' ? (
                    <div className="space-y-1">
                      <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/8 text-cyan-400 text-xs font-semibold">
                        {cdT?.pushCalendarAlready || '✅ Already on calendar'}
                        <span className="ml-auto text-cyan-600 font-normal">{calendarPushCount} items</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href="/calendar" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-cyan-500/20 text-cyan-500 text-xs font-semibold hover:bg-cyan-500/10 transition">
                          {cdT?.pushCalendarOpenLink || '→ Open Calendar'}
                        </Link>
                        <button
                          onClick={() => handlePushToCalendar(true)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dark-tertiary text-gray-500 text-xs hover:text-gray-300 transition"
                        >
                          {cdT?.pushCalendarRepush || 'Re-push'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* Sentinel warning */}
                      {sentinelStatus === 'not_reviewed' && (
                        <p className="text-amber-500/70 text-xs px-1">{cdT?.pushCalendarSentinelWarn || '⚠ Sentinel review not complete.'}</p>
                      )}
                      {/* Approval warning */}
                      {campaign.status !== 'ACTIVE' && approvalState !== 'done' && (
                        <p className="text-gray-600 text-xs px-1">{cdT?.pushCalendarApprovalWarn || '⚠ Campaign not yet approved.'}</p>
                      )}
                      <button
                        onClick={() => handlePushToCalendar(false)}
                        disabled={calendarPushState === 'pushing' || !hasContentCalendar}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition text-left disabled:opacity-50 ${
                          hasContentCalendar
                            ? 'border-cyan-500/30 bg-cyan-500/8 text-cyan-400 hover:bg-cyan-500/15'
                            : 'border-dark-tertiary text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {calendarPushState === 'pushing'
                          ? (cdT?.pushCalendarPushing || '⏳ Pushing...')
                          : (cdT?.stepPushCalendar || '📅 Push to Calendar')
                        }
                        {hasContentCalendar && calendarPushState !== 'pushing' && (
                          <span className="ml-auto text-cyan-600 text-xs">→</span>
                        )}
                      </button>
                      {calendarPushError && (
                        <p className="text-red-400 text-xs px-1">{calendarPushError}</p>
                      )}
                      {!hasContentCalendar && (
                        <p className="text-gray-600 text-xs px-1">{cdT?.pushCalendarNoContent || 'Run Full Strategy first to enable.'}</p>
                      )}
                    </div>
                  )}
                  <button disabled className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-tertiary text-gray-700 text-xs font-semibold cursor-not-allowed opacity-40 text-left">
                    {cdT?.stepAdsSoon || '🎯 Ad Campaign — Coming Soon'}
                  </button>
                </div>
              </div>

              {/* Group 3: Review */}
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-2">{cdT?.stepGroupReview || 'Review'}</p>
                <div className="space-y-2">
                  <button
                    onClick={handleSentinelReview}
                    disabled={sentinelState === 'reviewing'}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition text-left disabled:opacity-60 ${
                      sentinelStatus === 'passed'
                        ? 'border-green-500/30 bg-green-500/8 text-green-400 hover:bg-green-500/15'
                        : sentinelStatus === 'needs_attention'
                          ? 'border-amber-500/30 bg-amber-500/8 text-amber-400 hover:bg-amber-500/15'
                          : 'border-blue-500/30 bg-blue-500/8 text-blue-400 hover:bg-blue-500/15'
                    }`}
                  >
                    {sentinelState === 'reviewing'
                      ? (cdT?.sentinelReviewing || '⏳ Reviewing...')
                      : sentinelStatus === 'passed'
                        ? (cdT?.sentinelPassedBtn || '✅ Review Passed — Re-run')
                        : sentinelStatus === 'needs_attention'
                          ? (cdT?.sentinelReRunBtn || '⚠️ Needs Attention — Re-run')
                          : (cdT?.stepSentinelRun || '🔍 Run Sentinel Review')
                    }
                  </button>
                  <Link
                    href="/sentinel"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dark-tertiary text-gray-500 text-xs font-semibold hover:text-gray-300 transition"
                  >
                    {cdT?.stepSentinelPage || '↗ Open Sentinel'}
                    <span className="ml-auto text-gray-700 text-xs">↗</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Inline Sentinel review error */}
            {sentinelError && sentinelState === 'idle' && (
              <div className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-xs text-red-400">⚠️ {sentinelError}</p>
              </div>
            )}

            {/* Inline approval confirmation */}
            {approvalState === 'confirming' && (
              <div className="mt-4 p-4 bg-green-500/5 border border-green-500/25 rounded-xl">
                {/* Sentinel warning — shown if not reviewed or needs attention */}
                {sentinelStatus === 'not_reviewed' && (
                  <div className="mb-3 p-3 bg-amber-500/8 border border-amber-500/25 rounded-lg">
                    <p className="text-xs font-semibold text-amber-400 mb-0.5">⚠️ {cdT?.sentinelNoReviewWarning || 'Sentinel review has not been completed yet.'}</p>
                    <p className="text-xs text-gray-500">{cdT?.sentinelNoReviewWarningDesc || 'We recommend running a Sentinel review before approving. You can still approve without it.'}</p>
                  </div>
                )}
                {sentinelStatus === 'needs_attention' && (
                  <div className="mb-3 p-3 bg-amber-500/8 border border-amber-500/25 rounded-lg">
                    <p className="text-xs font-semibold text-amber-400 mb-0.5">⚠️ {cdT?.sentinelNeedsAttentionWarning || 'Sentinel review flagged issues that need attention.'}</p>
                    <p className="text-xs text-gray-500">{cdT?.sentinelNeedsAttentionDesc || 'Review the Sentinel findings below before executing. You can still approve if you choose.'}</p>
                  </div>
                )}
                <p className="text-sm font-semibold text-green-400 mb-1">{cdT?.approveConfirmTitle || 'Approve campaign for execution?'}</p>
                <p className="text-xs text-gray-400 mb-3">{cdT?.approveConfirmBody || 'This marks the campaign as Active. Your team can start executing all deliverables.'}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition"
                  >
                    {cdT?.approveConfirmBtn || 'Yes, Approve'}
                  </button>
                  <button
                    onClick={() => setApprovalState('idle')}
                    className="px-4 py-2 bg-dark-tertiary text-gray-400 text-xs font-semibold rounded-xl hover:text-white transition"
                  >
                    {cdT?.approveCancelBtn || 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sentinel Review Card — Sprint G ──────────────────────────── */}
        {aiOutput && (
          <div className={`bg-dark-secondary rounded-2xl px-5 py-5 mb-6 border ${
            sentinelStatus === 'passed'
              ? 'border-green-500/30'
              : sentinelStatus === 'needs_attention'
                ? 'border-amber-500/30'
                : 'border-dark-tertiary'
          }`}>

            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🔍</span>
                <h3 className="font-bold text-sm text-white">{cdT?.sentinelReviewTitle || 'Sentinel Review'}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                  sentinelStatus === 'passed'
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : sentinelStatus === 'needs_attention'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-dark-tertiary text-gray-600 border-dark-tertiary'
                }`}>
                  {sentinelStatus === 'passed'
                    ? (cdT?.sentinelStatusPassed || '✓ Passed')
                    : sentinelStatus === 'needs_attention'
                      ? (cdT?.sentinelStatusNeeds || '⚠ Needs Attention')
                      : (cdT?.sentinelStatusNotReviewed || 'Not Reviewed')
                  }
                </span>
              </div>
              {sentinelReview && (
                <span className="text-xs text-gray-600">
                  {new Date(sentinelReview.reviewedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                </span>
              )}
            </div>

            {/* Scores row — shown when review exists */}
            {sentinelReview && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Risk Score */}
                <div className="bg-dark-primary/40 border border-dark-tertiary rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">{cdT?.sentinelRiskScore || 'Risk Score'}</span>
                    <span className={`text-sm font-bold ${
                      sentinelReview.riskScore < 30 ? 'text-green-400'
                      : sentinelReview.riskScore < 50 ? 'text-amber-400'
                      : 'text-red-400'
                    }`}>{sentinelReview.riskScore}/100</span>
                  </div>
                  <div className="h-1.5 bg-dark-tertiary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      sentinelReview.riskScore < 30 ? 'bg-green-500'
                      : sentinelReview.riskScore < 50 ? 'bg-amber-500'
                      : 'bg-red-500'
                    }`} style={{ width: `${sentinelReview.riskScore}%` }} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{cdT?.sentinelRiskLow || 'Lower is better'}</p>
                </div>
                {/* Brand Consistency */}
                <div className="bg-dark-primary/40 border border-dark-tertiary rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">{cdT?.sentinelBrandScore || 'Brand Consistency'}</span>
                    <span className={`text-sm font-bold ${
                      sentinelReview.brandConsistencyScore >= 75 ? 'text-green-400'
                      : sentinelReview.brandConsistencyScore >= 55 ? 'text-amber-400'
                      : 'text-red-400'
                    }`}>{sentinelReview.brandConsistencyScore}/100</span>
                  </div>
                  <div className="h-1.5 bg-dark-tertiary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      sentinelReview.brandConsistencyScore >= 75 ? 'bg-green-500'
                      : sentinelReview.brandConsistencyScore >= 55 ? 'bg-amber-500'
                      : 'bg-red-500'
                    }`} style={{ width: `${sentinelReview.brandConsistencyScore}%` }} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{cdT?.sentinelBrandHigh || 'Higher is better'}</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {sentinelReview?.summary && (
              <p className="text-sm text-gray-300 leading-relaxed mb-4">{sentinelReview.summary}</p>
            )}

            {/* Detail notes — collapsible sections */}
            {sentinelReview && (
              <div className="space-y-3">
                {/* Claim Safety */}
                {sentinelReview.claimSafetyNotes && (
                  <div className="border border-dark-tertiary rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{cdT?.sentinelClaimSafety || 'Claim Safety'}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{sentinelReview.claimSafetyNotes}</p>
                  </div>
                )}
                {/* Tone Consistency */}
                {sentinelReview.toneConsistencyNotes && (
                  <div className="border border-dark-tertiary rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">{cdT?.sentinelToneConsistency || 'Tone Consistency'}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{sentinelReview.toneConsistencyNotes}</p>
                  </div>
                )}
                {/* Compliance Warnings */}
                {sentinelReview.complianceWarnings?.length > 0 && (
                  <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">{cdT?.sentinelComplianceWarnings || 'Compliance Warnings'}</p>
                    <ul className="space-y-1.5">
                      {sentinelReview.complianceWarnings.map((w: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-300">
                          <span className="flex-shrink-0 mt-0.5">⚠</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Recommended Fixes */}
                {sentinelReview.recommendedFixes?.length > 0 && (
                  <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2">{cdT?.sentinelRecommendedFixes || 'Recommended Fixes'}</p>
                    <ul className="space-y-1.5">
                      {sentinelReview.recommendedFixes.map((fix: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-blue-300">
                          <span className="flex-shrink-0 mt-0.5 text-blue-500">→</span>
                          <span>{fix}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Empty state — not reviewed yet */}
            {!sentinelReview && sentinelState !== 'reviewing' && (
              <p className="text-xs text-gray-600 text-center py-2">
                {cdT?.sentinelNotReviewedDesc || 'Run a Sentinel review to check brand consistency, claim safety, and execution readiness before approving.'}
              </p>
            )}

            {/* Reviewing state */}
            {sentinelState === 'reviewing' && (
              <div className="flex items-center gap-3 py-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs text-blue-400">{cdT?.sentinelReviewingMsg || 'Sentinel is reviewing your campaign content...'}</p>
              </div>
            )}
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

                {/* Diagnosis — first section, sets the stage */}
                {strategy.diagnosis && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-sm text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <span>🔎</span> {cdT?.sectionDiagnosis || 'Marketing Diagnosis'}
                    </h3>
                    <p className="text-gray-200 text-sm leading-relaxed">{strategy.diagnosis}</p>
                  </div>
                )}

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

                {/* Positioning */}
                {strategy.positioning && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>🎯</span> {cdT?.sectionPositioning}</h3>
                    <p className="text-gray-300 leading-relaxed text-sm">{strategy.positioning}</p>
                  </div>
                )}

                {/* Differentiation */}
                {strategy.differentiation && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>⚡</span> {cdT?.sectionDifferentiation || 'Differentiation'}</h3>
                    <p className="text-gray-300 leading-relaxed text-sm">{strategy.differentiation}</p>
                  </div>
                )}

                {/* Audience Segments */}
                {audienceSegments.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>👥</span> {cdT?.sectionAudienceSegments || 'Audience Segments'}</h3>
                    <div className="space-y-2">
                      {audienceSegments.map((seg: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 bg-dark rounded-xl p-3 border border-dark-tertiary text-sm">
                          <span className="text-accent font-bold flex-shrink-0">{i + 1}</span>
                          <span className="text-gray-300">{seg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Funnel Strategy */}
                {strategy.funnelStrategy && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>🔻</span> {cdT?.sectionFunnelStrategy || 'Funnel Strategy'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {([
                        { key: 'awareness',     icon: '📢', label: cdT?.funnelAwareness     || 'Awareness',     color: 'border-blue-500/30 bg-blue-500/5 text-blue-400' },
                        { key: 'consideration', icon: '🤔', label: cdT?.funnelConsideration || 'Consideration', color: 'border-purple-500/30 bg-purple-500/5 text-purple-400' },
                        { key: 'conversion',    icon: '✅', label: cdT?.funnelConversion    || 'Conversion',    color: 'border-green-500/30 bg-green-500/5 text-green-400' },
                        { key: 'retention',     icon: '🔄', label: cdT?.funnelRetention     || 'Retention',     color: 'border-amber-500/30 bg-amber-500/5 text-amber-400' },
                      ] as const).map(({ key, icon, label, color }) => (
                        strategy.funnelStrategy[key] && (
                          <div key={key} className={`rounded-xl p-4 border ${color}`}>
                            <p className="font-semibold text-xs uppercase tracking-wide mb-2">{icon} {label}</p>
                            <p className="text-gray-300 text-sm leading-relaxed">{strategy.funnelStrategy[key]}</p>
                          </div>
                        )
                      ))}
                    </div>
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

                {/* Offer & CTA Strategy */}
                {strategy.offerCTAStrategy && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>📣</span> {cdT?.sectionOfferCTA || 'Offer & CTA Strategy'}</h3>
                    <div className="space-y-3">
                      {strategy.offerCTAStrategy.primaryCTA && (
                        <div className="flex items-start gap-3 bg-dark rounded-xl p-3 border border-accent/20">
                          <span className="text-xs text-accent font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{cdT?.ctaPrimary || 'Primary CTA'}</span>
                          <p className="text-white text-sm font-semibold flex-1">{strategy.offerCTAStrategy.primaryCTA}</p>
                          <CopyBtn text={strategy.offerCTAStrategy.primaryCTA} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      )}
                      {strategy.offerCTAStrategy.secondaryCTA && (
                        <div className="flex items-start gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-xs text-gray-500 font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{cdT?.ctaSecondary || 'Secondary CTA'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.secondaryCTA}</p>
                          <CopyBtn text={strategy.offerCTAStrategy.secondaryCTA} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      )}
                      {strategy.offerCTAStrategy.leadMagnet && (
                        <div className="flex items-start gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-xs text-blue-400 font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{cdT?.ctaLeadMagnet || 'Lead Magnet'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.leadMagnet}</p>
                        </div>
                      )}
                      {strategy.offerCTAStrategy.betaOffer && (
                        <div className="flex items-start gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-xs text-purple-400 font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{cdT?.ctaBetaOffer || 'Beta Offer'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.betaOffer}</p>
                        </div>
                      )}
                      {strategy.offerCTAStrategy.contactFlow && (
                        <div className="flex items-start gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-xs text-green-400 font-bold uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{cdT?.ctaContactFlow || 'Contact Flow'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.contactFlow}</p>
                        </div>
                      )}
                    </div>
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

                {/* Channel Mix (budget allocation) */}
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

                {/* Channel Strategy — per-platform detail */}
                {channelStrategy.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>🗺️</span> {cdT?.sectionChannelStrategy || 'Channel Strategy'}</h3>
                    <div className="space-y-3">
                      {channelStrategy.map((ch: any, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                          <p className="font-bold text-sm text-accent capitalize mb-3">{ch.platform}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            {ch.role && (
                              <div>
                                <span className="text-gray-500 uppercase tracking-wide">{cdT?.channelRole || 'Role'}: </span>
                                <span className="text-gray-300">{ch.role}</span>
                              </div>
                            )}
                            {ch.contentType && (
                              <div>
                                <span className="text-gray-500 uppercase tracking-wide">{cdT?.channelContentType || 'Content Type'}: </span>
                                <span className="text-gray-300">{ch.contentType}</span>
                              </div>
                            )}
                            {ch.postingApproach && (
                              <div>
                                <span className="text-gray-500 uppercase tracking-wide">{cdT?.channelApproach || 'Approach'}: </span>
                                <span className="text-gray-300">{ch.postingApproach}</span>
                              </div>
                            )}
                            {ch.cta && (
                              <div>
                                <span className="text-gray-500 uppercase tracking-wide">CTA: </span>
                                <span className="text-accent">{ch.cta}</span>
                              </div>
                            )}
                          </div>
                          {ch.rationale && (
                            <p className="text-gray-500 text-xs mt-2 italic">{ch.rationale}</p>
                          )}
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

                {/* Success Metrics */}
                {successMetrics.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2"><span>📈</span> {cdT?.sectionSuccessMetrics || 'Success Metrics'}</h3>
                    <ul className="space-y-2">
                      {successMetrics.map((metric: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                          <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span> {metric}
                        </li>
                      ))}
                    </ul>
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

                {/* Risk & Compliance Notes */}
                {riskNotes.length > 0 && (
                  <div className="bg-dark-secondary border border-red-500/15 rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-red-400"><span>⚠️</span> {cdT?.sectionRiskNotes || 'Risk & Compliance Notes'}</h3>
                    <ul className="space-y-2">
                      {riskNotes.map((note: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-gray-400 text-sm">
                          <span className="text-red-400 mt-0.5 flex-shrink-0">!</span> {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next Best Action — prominent closing callout */}
                {strategy.nextBestAction && (
                  <div className="bg-accent/8 border border-accent/30 rounded-2xl p-6">
                    <h3 className="font-bold text-sm text-accent uppercase tracking-wide mb-2 flex items-center gap-2">
                      <span>🚀</span> {cdT?.sectionNextBestAction || 'Next Best Action'}
                    </h3>
                    <p className="text-white text-base font-semibold leading-relaxed">{strategy.nextBestAction}</p>
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

                {/* Content Angles */}
                {contentAngles.length > 0 && (
                  <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>💡</span> {cdT?.sectionContentAngles || 'Content Angles'}</h3>
                    <div className="space-y-2">
                      {contentAngles.map((angle: string, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="text-accent font-bold text-xs w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-gray-300 text-sm leading-relaxed">{angle}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <SaveToMemoryBtn
                              text={angle}
                              field="winningAngles"
                              authHeader={authHeader}
                              saveLabel={cdT?.saveToMemoryBtn || '🧠 Save'}
                              savedLabel={cdT?.savedToMemoryBtn || '🧠 Saved'}
                              title={cdT?.saveToMemoryTitle || 'Save to Brand Memory'}
                            />
                            <CopyBtn text={angle} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback if all empty */}
                {topHooks.length === 0 && ctaVariations.length === 0 && captionFormulas.length === 0 && contentAngles.length === 0 && (
                  <EmptySection icon="✍️" message={cdT?.emptyHooksDesc || 'No content generated yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 2: Calendar (PULSE) ───────────────────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <AgentBanner idx={2} />

                {/* Weekly Execution Plan (Sprint D2 — rich version) */}
                {weeklyPlan.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide px-1">{cdT?.sectionWeeklyPlan || '4-Week Execution Plan'}</p>
                    {weeklyPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="bg-dark-secondary border border-amber-500/20 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-amber-400">{cdT?.weekLabel || 'Week'} {wk.week}</h3>
                          {wk.cta && (
                            <span className="text-xs bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-full font-semibold">
                              CTA: {wk.cta}
                            </span>
                          )}
                        </div>
                        {wk.objective && (
                          <div className="mb-3">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">{cdT?.weekObjective || 'Objective'}: </span>
                            <span className="text-gray-200 text-sm font-semibold">{wk.objective}</span>
                          </div>
                        )}
                        {wk.keyMessage && (
                          <div className="mb-3 bg-dark rounded-xl p-3 border border-indigo-500/20">
                            <span className="text-xs text-indigo-400 uppercase tracking-wide">{cdT?.weekKeyMessage || 'Key Message'}: </span>
                            <span className="text-gray-300 text-sm">"{wk.keyMessage}"</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          {wk.contentThemes?.length > 0 && (
                            <div className="bg-dark rounded-xl p-3 border border-dark-tertiary">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{cdT?.weekThemes || 'Themes'}</p>
                              <ul className="space-y-1">
                                {wk.contentThemes.map((theme: string, ti: number) => (
                                  <li key={ti} className="text-gray-300 text-xs flex items-start gap-1">
                                    <span className="text-accent mt-0.5">·</span> {theme}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {wk.deliverables?.length > 0 && (
                            <div className="bg-dark rounded-xl p-3 border border-dark-tertiary">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{cdT?.weekDeliverables || 'Deliverables'}</p>
                              <ul className="space-y-1">
                                {wk.deliverables.map((d: string, di: number) => (
                                  <li key={di} className="text-gray-300 text-xs flex items-start gap-1">
                                    <span className="text-green-400 mt-0.5">□</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {wk.channels?.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {wk.channels.map((ch: string, ci: number) => (
                              <span key={ci} className="text-xs bg-dark border border-dark-tertiary px-2 py-1 rounded-full text-gray-400 capitalize">
                                {PLATFORM_ICONS[ch.toUpperCase()] || '🌐'} {ch}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Content Calendar (NEX-generated posts) */}
                {contentCalendar.length > 0 && (
                  <div className="space-y-4">
                    {weeklyPlan.length > 0 && (
                      <p className="text-xs text-gray-500 uppercase tracking-wide px-1 pt-2">Content Calendar</p>
                    )}
                    {contentCalendar.map((week: any, wi: number) => (
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
                    ))}
                  </div>
                )}

                {weeklyPlan.length === 0 && contentCalendar.length === 0 && (
                  <EmptySection icon="📅" message={cdT?.emptyCalendarDesc || 'Content calendar not available yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 3: Visuals ────────────────────────────────────────────── */}
            {activeTab === 3 && (
              <div className="space-y-4">
                {/* ── Creative Brief Entry Card — Sprint F ── */}
                <div className="bg-dark-secondary border border-purple-500/30 rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎨</span>
                      <div>
                        <h3 className="font-bold text-base text-purple-400">{cdT?.creativeBriefTitle || 'AI Creative Brief'}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{cdT?.creativeBriefSubtitle || 'Analyze your assets or generate visual concepts'}</p>
                      </div>
                    </div>
                    {creativeBrief && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 font-semibold flex-shrink-0">
                        ✓ {creativeMode === 'asset' ? (cdT?.creativeModeAsset || 'Assets Analyzed') : (cdT?.creativeModeConceptGen || 'Concepts Generated')}
                      </span>
                    )}
                  </div>

                  {/* Mode badges */}
                  <div className="flex gap-3 mb-5">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-500/20 bg-purple-500/5 flex-1">
                      <span>🖼️</span>
                      <div>
                        <p className="text-xs font-bold text-purple-300">{cdT?.creativeModeAssetLabel || 'User Asset Mode'}</p>
                        <p className="text-xs text-gray-500">{cdT?.creativeModeAssetDesc || 'AI analyzes your real photos & logos'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-pink-500/20 bg-pink-500/5 flex-1">
                      <span>🤖</span>
                      <div>
                        <p className="text-xs font-bold text-pink-300">{cdT?.creativeModeConceptLabel || 'AI Concept Mode'}</p>
                        <p className="text-xs text-gray-500">{cdT?.creativeModeConceptDesc || 'Generates image prompts & storyboards'}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/creative-brief`, '_blank')}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2"
                  >
                    <span>🎨</span>
                    {creativeBrief
                      ? (cdT?.openCreativeBriefBtn || 'View / Update Creative Brief')
                      : (cdT?.startCreativeBriefBtn || 'Create Creative Brief')
                    }
                    <span className="text-purple-300 text-xs">↗</span>
                  </button>
                </div>

                {/* Visual Direction from strategy */}
                {strategy.visualDirection && (
                  <div className="bg-dark-secondary border border-purple-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-purple-400"><span>🎯</span> {cdT?.sectionVisualDirection}</h3>
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
