'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import VisualGenerator from '@/components/VisualGenerator'
import SocialPublisher from '@/components/SocialPublisher'
import SocialAnalytics from '@/components/SocialAnalytics'
import AIPresenceBar from '@/components/AIPresenceBar'
import BrandDNABadge, { type BrandDNAData } from '@/components/BrandDNABadge'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import UpgradeModal from '@/components/UpgradeModal'
import { useBillingStatus } from '@/lib/useBillingStatus'
import PlatformNativeCard from '@/components/PlatformNativeCard'

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
  autopilotEnabled?: boolean
  autopilotActivatedAt?: string
  socialPostCount?: number
}

interface AutopilotPost {
  id: string
  platform: string
  caption: string
  imageUrl?: string | null
  imagePrompt?: string | null
  weekNumber?: number | null
  scheduledAt?: string | null
  status: string
  pageName?: string | null
}

const ACTIVITY_ICONS: Record<string, string> = {
  created: '✨', generated: '🤖', viewed: '👁', regenerated: '♻️',
  exported: '📤', duplicated: '📋', archived: '📦', favorited: '⭐',
  updated: '✏️', engine_run: '⚙️',
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
  // Capture ?new=1 immediately — router.replace() will strip it later
  const isNewCampaign = searchParams?.get('new') === '1'
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { t, locale } = useI18n()
  const cdT = t('campaignDetail') as Record<string, string>
  const { isPaid, status: billingStatus } = useBillingStatus()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [brandScore, setBrandScore] = useState<number | null>(null)
  const [brandDNA, setBrandDNA] = useState<BrandDNAData | null>(null)
  const [brandNoticeDismissed, setBrandNoticeDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(isGenerating)
  const [generateError, setGenerateError] = useState('')
  const [engineRunning, setEngineRunning] = useState(false)
  const [engineError, setEngineError] = useState('')
  const [approvalState, setApprovalState] = useState<'idle' | 'confirming' | 'approving' | 'done'>('idle')
  const [launchState, setLaunchState] = useState<'idle' | 'approving' | 'generating' | 'done'>('idle')
  const [launchError, setLaunchError] = useState('')
  const [sentinelState, setSentinelState] = useState<'idle' | 'reviewing' | 'done'>('idle')
  const [sentinelError, setSentinelError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<'no_credits' | 'first_campaign'>('no_credits')
  // Autopilot
  const [autopilotQueue, setAutopilotQueue] = useState<AutopilotPost[]>([])
  const [autopilotActivating, setAutopilotActivating] = useState(false)
  const [autopilotError, setAutopilotError] = useState('')
  const [autopilotPausing, setAutopilotPausing] = useState(false)

  // VEX Ad Setup expand/collapse
  const [adSetupOpen, setAdSetupOpen] = useState(false)

  // Performance / ROI Dashboard (Tab 6)
  const [perfData, setPerfData] = useState<any>(null)
  const [perfLoading, setPerfLoading] = useState(false)

  // Sprint H — Push to Calendar
  const [calendarPushState, setCalendarPushState] = useState<'idle' | 'pushing' | 'done' | 'already'>('idle')
  const [calendarPushCount, setCalendarPushCount] = useState(0)
  const [calendarPushError, setCalendarPushError] = useState('')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  // UX: header overflow menu
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)

  // Unified product agent tabs — indices 0-4 are visible; 5-6 are accessible via Publish tab
  const AGENT_TABS = [
    { name: cdT?.agentStrategyName || 'Strategist', icon: '🧠', title: cdT?.agentStrategyTitle, color: 'text-indigo-400',  border: 'border-indigo-500/30', bg: 'bg-indigo-500/5',  label: cdT?.tabStrategy },
    { name: cdT?.agentNexName     || 'NEX',         icon: '✍️', title: cdT?.agentNexTitle,      color: 'text-pink-400',    border: 'border-pink-500/30',   bg: 'bg-pink-500/5',    label: cdT?.tabContent },
    { name: cdT?.agentPulseName   || 'PULSE',       icon: '⚡', title: cdT?.agentPulseTitle,    color: 'text-amber-400',   border: 'border-amber-500/30',  bg: 'bg-amber-500/5',   label: cdT?.tabCalendar },
    { name: '',                                      icon: '🎨', title: '',                       color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/5',  label: cdT?.tabVisuals },
    { name: '',                                      icon: '📤', title: '',                       color: 'text-green-400',   border: 'border-green-500/30',  bg: 'bg-green-500/5',   label: cdT?.tabPublish || (locale === 'ar' ? 'النشر' : 'Publish') },
    { name: '', hidden: false,                       icon: '🤖', title: '',                       color: 'text-violet-400',  border: 'border-violet-500/30', bg: 'bg-violet-500/5',  label: locale === 'ar' ? 'أوتوبايلوت' : 'Autopilot' },
    { name: '', hidden: false,                       icon: '📊', title: '',                       color: 'text-cyan-400',    border: 'border-cyan-500/30',   bg: 'bg-cyan-500/5',    label: locale === 'ar' ? 'الأداء' : 'Performance' },
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
          if (data) {
            setBrandScore(getBrandBrainReadiness(data.brandProfile).score)
            if (data.brandProfile) setBrandDNA(data.brandProfile as BrandDNAData)
          }
        })
        .catch(() => {})
    }
  }, [loading, isAuthenticated, fetchCampaign, router, authHeader])

  // Load autopilot queue when tab 5 is active
  useEffect(() => {
    if (activeTab !== 5 || !isAuthenticated) return
    const token = authHeader()
    if (!token) return
    fetch(`/api/autopilot/queue?campaignId=${campaignId}`, { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.posts) setAutopilotQueue(d.posts) })
      .catch(() => {})
  }, [activeTab, isAuthenticated, campaignId, authHeader])

  // Load performance data when tab 6 is active
  useEffect(() => {
    if (activeTab !== 6 || !isAuthenticated || perfData) return
    const token = authHeader()
    if (!token) return
    setPerfLoading(true)
    fetch(`/api/campaigns/${campaignId}/performance`, { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPerfData(d) })
      .catch(() => {})
      .finally(() => setPerfLoading(false))
  }, [activeTab, isAuthenticated, campaignId, authHeader, perfData])

  // Auto-trigger generation for new campaigns that have no aiOutput yet
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (!isNewCampaign) return
    if (!campaign) return                   // wait for campaign to load
    if (campaign.aiOutput) return           // already has content — nothing to do
    if (generating) return                  // already in progress
    if (autoTriggeredRef.current) return    // already triggered once this mount
    if (loading) return                     // wait for auth to settle before checking token
    if (!authHeader()) return               // no token yet — will re-run when auth resolves
    autoTriggeredRef.current = true
    handleRunEngine()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, isNewCampaign, generating, engineRunning, loading])

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

  // Y3 — post-campaign upgrade nudge
  // Show after generation completes (or immediately for draft) if user is on free plan
  useEffect(() => {
    if (!isNewCampaign) return
    // Wait for billing status to resolve (avoid showing while loading)
    if (billingStatus === null) return
    if (isPaid) return
    // If still generating: the poll effect will set generating=false, then this runs again
    if (generating) return
    const t = setTimeout(() => {
      setUpgradeReason('first_campaign')
      setShowUpgrade(true)
    }, 3000)
    return () => clearTimeout(t)
  }, [isNewCampaign, isPaid, billingStatus, generating])

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

  const handleRunEngine = async (force = false) => {
    const token = authHeader()
    if (!token || !campaignId || engineRunning) return
    setEngineRunning(true)
    setGenerating(true)
    setEngineError('')
    setGenerateError('')
    setSentinelError('')
    setCalendarPushError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ language: locale, force }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (res.status === 402 || d.error === 'INSUFFICIENT_CREDITS') {
          setUpgradeReason('no_credits')
          setShowUpgrade(true)
        }
        setEngineError(d.message || d.error || (locale === 'ar' ? 'فشل تشغيل NEXUS Engine' : 'NEXUS Engine failed'))
        return
      }
      if (d.campaign) {
        setCampaign(d.campaign)
        const count = d.engine?.calendarCount || d.campaign.aiOutput?.calendarItems?.length || 0
        if (count > 0) {
          setCalendarPushCount(count)
          setCalendarPushState('done')
        }
        if (d.engine?.sentinelStatus === 'passed') setSentinelState('done')
      } else {
        await fetchCampaign()
      }
    } catch {
      setEngineError(locale === 'ar' ? 'خطأ في الشبكة أثناء تشغيل الماكينة' : 'Network error while running the engine')
    } finally {
      setEngineRunning(false)
      setGenerating(false)
    }
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
    const review = (campaign.aiOutput as any)?.sentinelReview
    const calendarItems = (campaign.aiOutput as any)?.calendarItems || []
    if (review?.status !== 'passed' || calendarItems.length === 0) {
      setApprovalState('idle')
      setEngineError(locale === 'ar'
        ? 'لا يمكن اعتماد الحملة قبل تشغيل الماكينة واجتياز Sentinel وبناء التقويم.'
        : 'Run the engine, pass Sentinel, and build the calendar before approval.')
      return
    }
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

  const handleApproveAndLaunch = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    setApprovalState('approving')
    setLaunchState('approving')
    setLaunchError('')
    try {
      // Step 1: Approve campaign (set ACTIVE)
      const approveRes = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      const approveData = await approveRes.json()
      if (!approveData.campaign) {
        setApprovalState('idle')
        setLaunchState('idle')
        return
      }
      setCampaign(prev => prev ? { ...prev, status: 'ACTIVE' } : prev)

      // Step 2: Check if content plan already exists
      setLaunchState('generating')
      const existingRes = await fetch(`/api/campaigns/${campaignId}/content-plan`, {
        headers: { Authorization: token },
      })
      const existingData = await existingRes.json()

      if (!existingData.posts || existingData.posts.length === 0) {
        // Generate content plan
        await fetch(`/api/campaigns/${campaignId}/generate-content-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
        })
      }

      // Step 3: Navigate to Content Hub
      setApprovalState('done')
      setLaunchState('done')
      router.push(`/campaigns/${campaignId}/content-hub`)
    } catch {
      setApprovalState('idle')
      setLaunchState('idle')
      setLaunchError(locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong, please try again')
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
        setUpgradeReason('no_credits')
        setShowUpgrade(true)
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

  // Generate AI strategy for this campaign (used when aiOutput is empty)
  const handleGenerateStrategy = async () => {
    const token = authHeader()
    if (!token || !campaignId) return
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ campaignId, language: locale }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 402) {
          setUpgradeReason('no_credits')
          setShowUpgrade(true)
        } else {
          setGenerateError(err.error || (locale === 'ar' ? 'فشل التوليد، حاول مرة أخرى' : 'Generation failed — please try again'))
        }
        console.error('[handleGenerateStrategy]', err)
        setGenerating(false)
        return
      }
      const d = await res.json()
      if (d.strategy) {
        setCampaign(prev => prev ? { ...prev, aiOutput: { strategy: d.strategy, concepts: d.concepts } } : prev)
      } else {
        // Fallback: refetch the campaign to get updated aiOutput
        await fetchCampaign()
      }
    } catch (e: any) {
      console.error('[handleGenerateStrategy] network error', e)
      setGenerateError(locale === 'ar' ? 'خطأ في الشبكة، حاول مرة أخرى' : 'Network error — please try again')
    } finally {
      setGenerating(false)
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
  // Sprint M — operational strategy fields
  const businessObjective: any = strategy.businessObjective || null
  const diagnosisDetails: any = strategy.diagnosisDetails || null
  const audienceSegmentsDetailed: any[] = strategy.audienceSegmentsDetailed || []
  const funnelStages: any[] = strategy.funnelStages || []
  const contentAnglesDetailed: any[] = strategy.contentAnglesDetailed || []
  const weeklyExecutionPlan: any[] = strategy.weeklyExecutionPlan || []
  const assetRequirements: any = strategy.assetRequirements || null
  const adSetupPlan: any = strategy.adSetupPlan || null
  const readinessChecklist: any[] = strategy.readinessChecklist || []
  const doNotDoYet: string[] = strategy.doNotDoYet || []
  const successMetricsDetailed: any[] = strategy.successMetricsDetailed || []
  const executionAssumptions: string[] = strategy.executionAssumptions || []
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
  const engineState = aiOutput?.nexusEngine || null
  const engineScore: number = engineState?.score ?? Math.round(([
    !!strategy && Object.keys(strategy).length > 0,
    topHooks.length > 0 || contentCalendar.length > 0 || weeklyExecutionPlan.length > 0,
    !!creativeBrief,
    sentinelStatus === 'passed',
    storedCalendarCount > 0,
    campaign.status === 'ACTIVE' || campaign.status === 'SCHEDULED',
    campaign.autopilotEnabled || campaign.status === 'SCHEDULED',
  ].filter(Boolean).length / 7) * 100)
  const engineReadyForApproval = sentinelStatus === 'passed' && storedCalendarCount > 0
  const engineBlocked = sentinelStatus === 'needs_attention'

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
      <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(10,11,28,0.7)', border: '1px solid rgba(139,92,246,0.1)' }}>
        <div className="text-3xl mb-3">{icon}</div>
        <p className="text-sm" style={{ color: 'var(--nx-text-4)' }}>{message}</p>
      </div>
    )
  }

  const mediaStrategy = aiOutput?.mediaStrategy || null
  const creativeAssets: any[] = mediaStrategy?.assets?.length
    ? mediaStrategy.assets
    : creativeBrief?.assetAnalyses || []

  const platformTheme = (platformRaw: string) => {
    const platform = (platformRaw || 'GENERAL').toUpperCase()
    if (platform.includes('INSTAGRAM')) return {
      key: 'INSTAGRAM', label: 'Instagram', icon: '📸', accent: '#e879f9',
      bg: 'linear-gradient(145deg, rgba(236,72,153,0.14), rgba(249,115,22,0.08))',
      border: 'rgba(236,72,153,0.28)',
    }
    if (platform.includes('TIKTOK')) return {
      key: 'TIKTOK', label: 'TikTok', icon: '🎵', accent: '#22d3ee',
      bg: 'linear-gradient(145deg, rgba(34,211,238,0.14), rgba(244,63,94,0.08))',
      border: 'rgba(34,211,238,0.28)',
    }
    if (platform.includes('LINKEDIN')) return {
      key: 'LINKEDIN', label: 'LinkedIn', icon: '💼', accent: '#60a5fa',
      bg: 'linear-gradient(145deg, rgba(37,99,235,0.16), rgba(14,165,233,0.06))',
      border: 'rgba(96,165,250,0.26)',
    }
    if (platform.includes('FACEBOOK') || platform.includes('META')) return {
      key: 'FACEBOOK', label: 'Facebook', icon: '👥', accent: '#818cf8',
      bg: 'linear-gradient(145deg, rgba(99,102,241,0.14), rgba(59,130,246,0.06))',
      border: 'rgba(129,140,248,0.26)',
    }
    return {
      key: platform || 'GENERAL', label: platform || 'General', icon: '🌐', accent: '#a78bfa',
      bg: 'rgba(139,92,246,0.08)',
      border: 'rgba(139,92,246,0.2)',
    }
  }

  const resolvePreviewAsset = (item: any, index: number) => {
    if (item.imageUrl || item.url) return item.imageUrl || item.url
    const assetByName = creativeAssets.find((asset: any) => {
      const haystack = `${item.visualNote || ''} ${item.topic || ''} ${item.title || ''}`.toLowerCase()
      return asset.fileName && haystack.includes(String(asset.fileName).toLowerCase())
    })
    if (assetByName?.url) return assetByName.url
    const usable = creativeAssets.filter((asset: any) => asset.type !== 'VIDEO' && asset.url)
    return usable.length > 0 ? usable[index % usable.length].url : null
  }

  const monthlyPreviewItems = (() => {
    const items: any[] = []
    const pushed = Array.isArray(aiOutput?.calendarItems) ? aiOutput.calendarItems : []
    if (pushed.length > 0) {
      return pushed.map((item: any, index: number) => ({
        id: item.id || `pushed-${index}`,
        date: item.date,
        week: item.week,
        platform: item.platform || 'GENERAL',
        topic: item.topic || item.title || 'Campaign Post',
        title: item.title,
        hook: item.hook,
        caption: item.caption,
        cta: item.cta,
        visualNote: item.visualNote,
        contentType: item.contentType,
        assetUrl: resolvePreviewAsset(item, index),
      }))
    }

    contentCalendar.forEach((week: any, wi: number) => {
      ;(week.posts || []).forEach((post: any, pi: number) => {
        items.push({
          id: `week-${wi}-post-${pi}`,
          date: post.date || post.day || `${cdT?.weekLabel || 'Week'} ${week.week || wi + 1}`,
          week: week.week || wi + 1,
          platform: post.platform || 'GENERAL',
          topic: post.topic || post.contentPillar || post.title || 'Campaign Post',
          title: post.title || post.headline,
          hook: post.hook,
          caption: post.caption || post.content,
          cta: post.cta || post.callToAction,
          visualNote: post.visual || post.visualNote || post.visualDirection,
          contentType: post.type || post.format || post.contentType,
          assetUrl: resolvePreviewAsset(post, items.length),
        })
      })
    })
    return items
  })()

  const postsByPlatform = monthlyPreviewItems.reduce((acc: Record<string, any[]>, item: any) => {
    const key = platformTheme(item.platform).key
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  // Platform-native card is now handled by PlatformNativeCard component
  const _postBrandName = brandDNA?.brandName || campaign.name || 'NEXUS'

  return (
    <>
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

        {/* FL4: Content-ready banner — shown when AI has generated posts for this campaign */}
        {(campaign.socialPostCount ?? 0) > 0 && (() => {
          const postCount = campaign.socialPostCount!
          return (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-green-400 text-sm flex-shrink-0">✅</span>
                <p className="text-xs" style={{ color: 'rgba(74,222,128,0.85)' }}>
                  {locale === 'ar'
                    ? `${postCount} بوست جاهز للمراجعة والنشر`
                    : `${postCount} post${postCount !== 1 ? 's' : ''} ready — review and schedule in Content Hub`}
                </p>
              </div>
              <Link
                href={`/campaigns/${campaign.id}/content-hub`}
                className="text-xs font-bold flex-shrink-0 px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#4ade80' }}>
                {locale === 'ar' ? 'مركز المحتوى →' : 'View Content Hub →'}
              </Link>
            </div>
          )
        })()}

        {/* Header card — NEXUS UI */}
        <div className="rounded-2xl mb-4 overflow-hidden"
          style={{
            background: 'rgba(10,11,28,0.9)',
            border: '1px solid rgba(139,92,246,0.2)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 40px rgba(139,92,246,0.05)',
          }}>
          {/* Gradient accent bar */}
          <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #06b6d4 50%, #10b981 100%)' }} />
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 0 20px rgba(139,92,246,0.1)' }}>
                  {campaign.thumbnail || '🎯'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--nx-text-1)' }}>{campaign.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--nx-text-3)' }}>
                    <span className="capitalize">{campaign.goal?.toLowerCase()}</span>
                    <span style={{ color: 'rgba(139,92,246,0.4)' }}>·</span>
                    <span>{locale === 'ar' ? 'نبرة: ' : 'Tone: '}{campaign.tone}</span>
                    <span style={{ color: 'rgba(139,92,246,0.4)' }}>·</span>
                    <span>{cdT?.createdLabel?.replace('{timeAgo}', timeAgo(campaign.createdAt) ?? '')}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {campaign.platforms.map(p => (
                      <span key={p} className="text-base" title={p}>{PLATFORM_ICONS[p] || '🌐'}</span>
                    ))}
                  </div>
                  {campaign.audience && (
                    <p className="text-xs mt-2 max-w-md" style={{ color: 'var(--nx-text-4)' }}>{cdT?.audienceLabel}: {campaign.audience}</p>
                  )}
                  {/* Campaign status badge */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        background: campaign.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)',
                        border: `1px solid ${campaign.status === 'ACTIVE' ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.2)'}`,
                        color: campaign.status === 'ACTIVE' ? '#10b981' : '#a78bfa',
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: campaign.status === 'ACTIVE' ? '#10b981' : '#8b5cf6' }} />
                      {campaign.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions — primary CTA + overflow menu */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/campaigns/new"
                  className="px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', boxShadow: '0 0 16px rgba(139,92,246,0.3)' }}
                >
                  {cdT?.btnNewCampaign || '+ New Campaign'}
                </Link>
                {/* Overflow menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowHeaderMenu(v => !v)}
                    className="px-3 py-2 rounded-xl text-sm font-bold transition"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--nx-text-3)' }}
                    title={locale === 'ar' ? 'المزيد' : 'More options'}
                  >
                    ···
                  </button>
                  {showHeaderMenu && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setShowHeaderMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded-xl shadow-2xl overflow-hidden"
                        style={{ background: 'rgba(18,19,40,0.98)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(20px)' }}>
                        <button
                          onClick={() => { updateCampaign({ favorite: !campaign.favorite }); setShowHeaderMenu(false) }}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-white/5"
                          style={{ color: campaign.favorite ? '#eab308' : 'var(--nx-text-2)' }}
                        >
                          {campaign.favorite ? `★ ${cdT?.btnSaved || 'Saved'}` : `☆ ${cdT?.btnSave || 'Save'}`}
                        </button>
                        <button
                          onClick={() => { duplicate(); setShowHeaderMenu(false) }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-white/5"
                          style={{ color: 'var(--nx-text-2)' }}
                        >
                          {`⧉ ${cdT?.btnDuplicate || 'Duplicate'}`}
                        </button>
                        <button
                          onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-white/5"
                          style={{ color: 'var(--nx-text-2)' }}
                        >
                          {`⬇ ${cdT?.btnExportPdf || 'Export PDF'}`}
                        </button>
                        <div className="h-px mx-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <button
                          onClick={() => { updateCampaign({ status: campaign.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED' }); setShowHeaderMenu(false) }}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-white/5"
                          style={{ color: campaign.status === 'ARCHIVED' ? '#a78bfa' : '#6b7280' }}
                        >
                          {campaign.status === 'ARCHIVED' ? `↩ ${cdT?.btnRestore || 'Restore'}` : `📦 ${cdT?.btnArchive || 'Archive'}`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Campaign Progress Panel ───────────────────────────────────── */}
        {aiOutput && (
          <div className="rounded-2xl px-5 py-5 mb-6"
            style={{
              background: 'rgba(10,11,28,0.85)',
              border: '1px solid rgba(139,92,246,0.15)',
              backdropFilter: 'blur(16px)',
            }}>

            {/* ── 4-step progress stepper ── */}
            <div className="flex items-center gap-0 mb-5 overflow-x-auto pb-1 flex-nowrap">
              {([
                {
                  key: 'generate',
                  label: locale === 'ar' ? 'التوليد' : 'Generate',
                  done: true,
                  active: false,
                },
                {
                  key: 'review',
                  label: locale === 'ar' ? 'المراجعة' : 'Review',
                  done: sentinelStatus === 'passed',
                  warn: sentinelStatus === 'needs_attention',
                  active: sentinelStatus === 'not_reviewed',
                },
                {
                  key: 'approve',
                  label: locale === 'ar' ? 'الاعتماد' : 'Approve',
                  done: campaign.status === 'ACTIVE' || approvalState === 'done',
                  active: sentinelStatus === 'passed' && campaign.status !== 'ACTIVE' && approvalState !== 'done',
                },
                {
                  key: 'live',
                  label: locale === 'ar' ? 'مباشر' : 'Live',
                  done: !!campaign.autopilotEnabled,
                  active: (campaign.status === 'ACTIVE' || approvalState === 'done') && !campaign.autopilotEnabled,
                },
              ] as Array<{key:string; label:string; done:boolean; active?:boolean; warn?:boolean}>).map((step, i, arr) => (
                <div key={step.key} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    step.done ? 'text-green-400' : step.warn ? 'text-amber-400' : step.active ? 'text-accent' : 'text-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border ${
                      step.done
                        ? 'bg-green-500/15 border-green-500/30 text-green-400'
                        : step.warn
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : step.active
                            ? 'bg-accent/15 border-accent/30 text-accent'
                            : 'bg-dark-tertiary border-dark-tertiary text-gray-600'
                    }`}>
                      {step.done ? '✓' : step.warn ? '!' : i + 1}
                    </span>
                    {step.label}
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-gray-800 text-xs mx-1 flex-shrink-0">—</span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Status message + context-aware primary CTA ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: engineRunning ? '#fbbf24' : 'var(--nx-text-1)' }}>
                  {engineRunning
                    ? (locale === 'ar' ? '⏳ الماكينة شغالة...' : '⏳ Engine running...')
                    : campaign.status === 'ACTIVE' || approvalState === 'done'
                      ? (locale === 'ar' ? '✅ الحملة نشطة وجاهزة للتنفيذ' : '✅ Campaign is active and ready to execute')
                      : engineReadyForApproval
                        ? (locale === 'ar' ? '🟢 الحملة جاهزة للاعتماد' : '🟢 Campaign ready for approval')
                        : sentinelStatus === 'needs_attention'
                          ? (locale === 'ar' ? '⚠️ Sentinel وجد مشاكل — راجع التفاصيل أدناه' : '⚠️ Sentinel found issues — review details below')
                          : sentinelStatus === 'passed'
                            ? (locale === 'ar' ? '✅ مراجعة Sentinel ناجحة' : '✅ Sentinel review passed')
                            : (locale === 'ar' ? 'الاستراتيجية جاهزة — شغّل Sentinel للمتابعة' : 'Strategy ready — run Sentinel review to continue')}
                </p>
                {(engineError || generateError) && (
                  <p className="text-xs text-red-400 mt-1">{engineError || generateError}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Re-run (small secondary) */}
                <button
                  onClick={() => handleRunEngine(true)}
                  disabled={engineRunning}
                  title={locale === 'ar' ? 'إعادة توليد كل المخرجات من الصفر' : 'Regenerate all outputs from scratch'}
                  className="w-8 h-8 rounded-xl border border-white/10 flex items-center justify-center text-sm text-gray-500 hover:text-gray-300 hover:border-white/20 disabled:opacity-40 transition"
                >
                  ↻
                </button>

                {/* Primary CTA — context aware, one at a time */}
                {!engineRunning && sentinelStatus !== 'passed' && campaign.status !== 'ACTIVE' && approvalState !== 'done' && (
                  <button
                    onClick={handleSentinelReview}
                    disabled={sentinelState === 'reviewing'}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)', boxShadow: '0 0 16px rgba(79,70,229,0.25)' }}
                  >
                    {sentinelState === 'reviewing'
                      ? '⏳...'
                      : sentinelStatus === 'needs_attention'
                        ? (locale === 'ar' ? '🔄 أعد المراجعة' : '🔄 Re-review')
                        : (locale === 'ar' ? '🔍 مراجعة Sentinel' : '🔍 Sentinel Review')}
                  </button>
                )}

                {!engineRunning && sentinelStatus === 'passed' && campaign.status !== 'ACTIVE' && approvalState !== 'done' && (
                  <button
                    onClick={() => setApprovalState('confirming')}
                    disabled={approvalState === 'approving' || launchState === 'approving' || launchState === 'generating'}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}
                  >
                    {launchState === 'approving'
                      ? (locale === 'ar' ? '⏳ جارٍ الاعتماد...' : '⏳ Approving...')
                      : launchState === 'generating'
                        ? (locale === 'ar' ? '⚙️ جارٍ إنشاء الخطة...' : '⚙️ Generating plan...')
                        : (locale === 'ar' ? '🚀 اعتماد وإطلاق' : '🚀 Approve & Launch')}
                  </button>
                )}

                {(campaign.status === 'ACTIVE' || approvalState === 'done') && (
                  <Link
                    href={`/campaigns/${campaignId}/content-hub`}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', boxShadow: '0 0 16px rgba(139,92,246,0.22)' }}
                  >
                    {locale === 'ar' ? '📋 Content Hub' : '📋 Content Hub'}
                  </Link>
                )}

                {engineRunning && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white/50"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin flex-shrink-0" />
                    {locale === 'ar' ? 'جاري التشغيل...' : 'Running...'}
                  </div>
                )}
              </div>
            </div>

            {/* ── Sentinel review detail — collapsible ── */}
            {sentinelReview && (
              <details className="mt-4">
                <summary className={`cursor-pointer text-xs font-semibold select-none ${
                  sentinelStatus === 'passed' ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {sentinelStatus === 'passed'
                    ? (locale === 'ar' ? '✓ Sentinel اجتاز المراجعة — عرض التفاصيل ▾' : '✓ Sentinel passed — see details ▾')
                    : (locale === 'ar' ? '⚠ Sentinel: يحتاج انتباه — عرض التفاصيل ▾' : '⚠ Sentinel needs attention — see details ▾')}
                </summary>
                <div className="mt-3 pt-3 border-t border-dark-tertiary space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-dark-primary/40 border border-dark-tertiary rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">{cdT?.sentinelRiskScore || 'Risk Score'}</span>
                        <span className={`text-sm font-bold ${sentinelReview.riskScore < 30 ? 'text-green-400' : sentinelReview.riskScore < 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {sentinelReview.riskScore}/100
                        </span>
                      </div>
                      <div className="h-1 bg-dark-tertiary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sentinelReview.riskScore < 30 ? 'bg-green-500' : sentinelReview.riskScore < 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sentinelReview.riskScore}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">{cdT?.sentinelRiskLow || 'Lower is better'}</p>
                    </div>
                    <div className="bg-dark-primary/40 border border-dark-tertiary rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">{cdT?.sentinelBrandScore || 'Brand Match'}</span>
                        <span className={`text-sm font-bold ${sentinelReview.brandConsistencyScore >= 75 ? 'text-green-400' : sentinelReview.brandConsistencyScore >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                          {sentinelReview.brandConsistencyScore}/100
                        </span>
                      </div>
                      <div className="h-1 bg-dark-tertiary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sentinelReview.brandConsistencyScore >= 75 ? 'bg-green-500' : sentinelReview.brandConsistencyScore >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sentinelReview.brandConsistencyScore}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">{cdT?.sentinelBrandHigh || 'Higher is better'}</p>
                    </div>
                  </div>
                  {sentinelReview.summary && (
                    <p className="text-sm text-gray-300 leading-relaxed">{sentinelReview.summary}</p>
                  )}
                  {sentinelReview.complianceWarnings?.length > 0 && (
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <p className="text-xs font-bold text-amber-400 mb-2">{cdT?.sentinelComplianceWarnings || 'Compliance Warnings'}</p>
                      {sentinelReview.complianceWarnings.map((w: string, i: number) => (
                        <p key={i} className="text-xs text-amber-300 flex items-start gap-2 mb-1"><span className="flex-shrink-0">⚠</span>{w}</p>
                      ))}
                    </div>
                  )}
                  {sentinelReview.recommendedFixes?.length > 0 && (
                    <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <p className="text-xs font-bold text-blue-400 mb-2">{cdT?.sentinelRecommendedFixes || 'Recommended Fixes'}</p>
                      {sentinelReview.recommendedFixes.map((fix: string, i: number) => (
                        <p key={i} className="text-xs text-blue-300 flex items-start gap-2 mb-1"><span className="flex-shrink-0 text-blue-500">→</span>{fix}</p>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Not yet reviewed hint */}
            {!sentinelReview && sentinelState !== 'reviewing' && (
              <p className="mt-3 text-xs text-gray-600">
                {locale === 'ar'
                  ? '🔍 شغّل Sentinel Review للتحقق من جودة الحملة قبل الاعتماد.'
                  : '🔍 Run Sentinel Review to check campaign quality before approving.'}
              </p>
            )}
            {sentinelState === 'reviewing' && (
              <div className="mt-3 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs text-blue-400">{cdT?.sentinelReviewingMsg || 'Sentinel is reviewing your campaign...'}</p>
              </div>
            )}
            {sentinelError && sentinelState === 'idle' && (
              <p className="mt-2 text-xs text-red-400">⚠️ {sentinelError}</p>
            )}

            {/* Approval & Launch confirmation dialog */}
            {approvalState === 'confirming' && (
              <div className="mt-4 p-4 bg-green-500/5 border border-green-500/25 rounded-xl">
                <p className="text-sm font-semibold text-green-400 mb-1">
                  {locale === 'ar' ? '🚀 هل أنت جاهز للإطلاق؟' : '🚀 Ready to approve and launch?'}
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  {locale === 'ar'
                    ? 'سيتم اعتماد الحملة وإنشاء خطة المحتوى الكاملة، ثم انتقالك تلقائياً إلى Content Hub.'
                    : 'This will approve the campaign, generate your full content plan, and take you straight to the Content Hub.'}
                </p>
                {launchError && (
                  <p className="text-xs text-red-400 mb-2">⚠️ {launchError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleApproveAndLaunch}
                    disabled={launchState === 'approving' || launchState === 'generating'}
                    className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition disabled:opacity-60"
                  >
                    {launchState === 'approving'
                      ? (locale === 'ar' ? '⏳ جارٍ الاعتماد...' : '⏳ Approving...')
                      : launchState === 'generating'
                        ? (locale === 'ar' ? '⚙️ جارٍ إنشاء الخطة...' : '⚙️ Generating plan...')
                        : (locale === 'ar' ? '🚀 نعم، اعتماد وإطلاق' : '🚀 Yes, Approve & Launch')}
                  </button>
                  <button
                    onClick={() => setApprovalState('idle')}
                    disabled={launchState === 'approving' || launchState === 'generating'}
                    className="px-4 py-2 bg-dark-tertiary text-gray-400 text-xs font-semibold rounded-xl hover:text-white transition disabled:opacity-50"
                  >
                    {cdT?.approveCancelBtn || 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generating state */}
        {!aiOutput && generating && (
          <div className="rounded-2xl p-12 text-center mb-6"
            style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(234,179,8,0.2)', backdropFilter: 'blur(16px)' }}>
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

        {/* No AI output state (not generating) — NEXUS UI */}
        {!aiOutput && !generating && (
          <div className="rounded-2xl p-12 text-center mb-6"
            style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.12)', backdropFilter: 'blur(16px)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <span className="text-3xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--nx-text-1)' }}>{cdT?.noOutputTitle}</h3>
            <p className="mb-6 text-sm" style={{ color: 'var(--nx-text-3)' }}>{cdT?.noOutputDesc}</p>
            <button
              onClick={() => handleRunEngine()}
              disabled={engineRunning}
              className="px-6 py-3 rounded-xl font-bold transition disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
              {engineRunning
                ? (locale === 'ar' ? '⏳ جاري التوليد...' : '⏳ Generating...')
                : (cdT?.noOutputBtn || (locale === 'ar' ? '🚀 توليد الاستراتيجية الكاملة' : '🚀 Generate Full Strategy'))}
            </button>
            {generateError && (
              <p className="mt-3 text-sm text-red-400">{generateError}</p>
            )}
          </div>
        )}

        {/* Tabs + content */}
        {aiOutput && (
          <>
            {/* NEXUS tab navigation */}
            <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 p-1 rounded-2xl"
              style={{ background: 'rgba(10,11,28,0.6)', border: '1px solid rgba(139,92,246,0.08)' }}>
              {AGENT_TABS.map((tab, i) => tab.hidden ? null : (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                  style={activeTab === i ? {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.1))',
                    border: '1px solid rgba(139,92,246,0.3)',
                    color: '#e2d9f3',
                    boxShadow: '0 0 12px rgba(139,92,246,0.15)',
                  } : {
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--nx-text-4)',
                  }}
                  onMouseEnter={e => {
                    if (activeTab !== i) (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-2)'
                  }}
                  onMouseLeave={e => {
                    if (activeTab !== i) (e.currentTarget as HTMLButtonElement).style.color = 'var(--nx-text-4)'
                  }}
                >
                  <span className="text-xs">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab 0: Strategy (Strategist) ─────────────────────────────── */}
            {activeTab === 0 && (
              <div className="space-y-3">
                <AgentBanner idx={0} />
                <BrandDNABadge brand={brandDNA} locale={locale} />

                {/* ── Strategy TL;DR Intelligence Card ────────────────────── */}
                {(engineScore > 0 || strategy.keyMessage || topHooks.length > 0) && (() => {
                  const brandFields: Array<keyof BrandDNAData> = ['brandName','industry','toneKeywords','targetAudience','writingStyle','uniqueAdvantages','audiencePainPoints','topPlatforms']
                  const brandFilled = brandDNA ? brandFields.filter(k => {
                    const v = (brandDNA as any)[k]
                    return Array.isArray(v) ? v.length > 0 : !!v
                  }).length : 0
                  const brandTotal = brandFields.length
                  const brandPct = Math.round((brandFilled / brandTotal) * 100)
                  const confColor = engineScore >= 75 ? '#10b981' : engineScore >= 50 ? '#f59e0b' : '#ef4444'
                  const confLabel = engineScore >= 75 ? (locale === 'ar' ? 'ثقة عالية' : 'High Confidence') : engineScore >= 50 ? (locale === 'ar' ? 'ثقة متوسطة' : 'Moderate Confidence') : (locale === 'ar' ? 'ثقة منخفضة' : 'Low Confidence')
                  const topAngle = contentAnglesDetailed[0]?.angle || contentAnglesDetailed[0]?.title || null
                  return (
                    <div className="rounded-2xl overflow-hidden"
                      style={{ background: 'rgba(10,11,28,0.7)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 0 30px rgba(139,92,246,0.06)' }}>
                      {/* Header bar */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'rgba(139,92,246,0.12)', background: 'rgba(139,92,246,0.06)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🧠</span>
                          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--nx-accent)' }}>
                            {locale === 'ar' ? 'ملخص الاستراتيجية' : 'Strategy Intelligence'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${engineScore}%`, background: `linear-gradient(90deg, ${confColor}, ${confColor}bb)` }} />
                          </div>
                          <span className="text-[10px] font-black" style={{ color: confColor }}>{engineScore}%</span>
                          <span className="text-[10px] font-semibold" style={{ color: confColor }}>{confLabel}</span>
                        </div>
                      </div>
                      {/* Content grid */}
                      <div className="p-4 grid grid-cols-1 gap-3">
                        {/* Key Message */}
                        {strategy.keyMessage && (
                          <div className="flex gap-3 items-start">
                            <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>💬</div>
                            <div className="min-w-0">
                              <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'rgba(139,92,246,0.8)' }}>
                                {locale === 'ar' ? 'الرسالة الجوهرية' : 'Core Message'}
                              </p>
                              <p className="text-white text-sm font-semibold leading-snug">"{strategy.keyMessage}"</p>
                            </div>
                          </div>
                        )}
                        {/* Top Hook + Top Angle in a 2-col row */}
                        {(topHooks[0] || topAngle) && (
                          <div className={`grid gap-3 ${topHooks[0] && topAngle ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {topHooks[0] && (
                              <div className="rounded-xl p-3" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
                                <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgba(6,182,212,0.8)' }}>
                                  {locale === 'ar' ? 'أقوى هوك' : 'Top Hook'}
                                </p>
                                <p className="text-gray-200 text-xs leading-relaxed line-clamp-3">{topHooks[0]}</p>
                              </div>
                            )}
                            {topAngle && (
                              <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: 'rgba(245,158,11,0.8)' }}>
                                  {locale === 'ar' ? 'الزاوية الأقوى' : 'Primary Angle'}
                                </p>
                                <p className="text-gray-200 text-xs leading-relaxed line-clamp-3">{topAngle}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Brand Brain completeness */}
                        {brandDNA && (
                          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs">🧬</span>
                              <span className="text-[10px] text-gray-400">{locale === 'ar' ? 'اكتمال Brand Brain' : 'Brand Brain'}</span>
                              <div className="flex items-center gap-0.5">
                                {brandFields.map((k, i) => {
                                  const v = (brandDNA as any)[k]
                                  const filled = Array.isArray(v) ? v.length > 0 : !!v
                                  return <div key={i} className="w-1.5 h-2.5 rounded-sm" style={{ background: filled ? '#8b5cf6' : 'rgba(255,255,255,0.08)' }} />
                                })}
                              </div>
                              <span className="text-[10px] font-bold" style={{ color: brandPct >= 70 ? '#10b981' : brandPct >= 40 ? '#f59e0b' : '#ef4444' }}>{brandPct}%</span>
                            </div>
                            {brandPct < 100 && (
                              <a href="/brand" className="text-[9px] font-semibold px-2 py-0.5 rounded-lg transition-opacity hover:opacity-80"
                                style={{ background: 'rgba(139,92,246,0.12)', color: 'rgba(139,92,246,0.9)', border: '1px solid rgba(139,92,246,0.2)' }}>
                                {locale === 'ar' ? 'أكمل الملف ←' : 'Complete Profile →'}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* 🚀 Next Best Action — pinned banner, shown once */}
                {strategy.nextBestAction && (
                  <div className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.08))', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 20px rgba(139,92,246,0.08)' }}>
                    <span className="text-2xl flex-shrink-0">🚀</span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-accent uppercase tracking-widest font-bold mb-0.5">{cdT?.nextActionBannerLabel || 'Your Next Action'}</p>
                      <p className="text-white text-sm font-semibold leading-relaxed">{strategy.nextBestAction}</p>
                    </div>
                  </div>
                )}

                {/* ══ CHAPTER 01 — THE BRIEF ═══════════════════════════════════ */}
                {(strategy.diagnosis || businessObjective) && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-black tabular-nums leading-none" style={{ fontSize: '24px', color: 'rgba(139,92,246,0.2)' }}>01</span>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.25) 0%, transparent 100%)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{cdT?.chapterBrief || 'The Brief'}</span>
                  </div>
                )}

                {/* Diagnosis + inline diagnosis details */}
                {strategy.diagnosis && (
                  <div className="rounded-2xl p-5 space-y-3"
                    style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">🔎</span>
                      <div>
                        <p className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-1">{cdT?.sectionDiagnosis || 'Marketing Diagnosis'}</p>
                        <p className="text-gray-200 text-sm leading-relaxed">{strategy.diagnosis}</p>
                      </div>
                    </div>
                    {diagnosisDetails && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-amber-500/10">
                        {[
                          { label: cdT?.diagStage || 'Stage', value: diagnosisDetails.stage, color: 'text-amber-400' },
                          { label: cdT?.diagBottleneck || 'Bottleneck', value: diagnosisDetails.bottleneck, color: 'text-orange-400' },
                          { label: cdT?.diagTrustGap || 'Trust Gap', value: diagnosisDetails.trustGap, color: 'text-red-400' },
                          { label: cdT?.diagRisk || 'Main Risk', value: diagnosisDetails.mainRisk, color: 'text-red-400' },
                          { label: cdT?.diagPaidAdsReady || 'Paid Ads Ready', value: diagnosisDetails.readyForPaidAds ? '✓ Yes' : '✗ Not yet', color: diagnosisDetails.readyForPaidAds ? 'text-green-400' : 'text-amber-400' },
                          diagnosisDetails.readyForPaidAdsReason ? { label: 'Why', value: diagnosisDetails.readyForPaidAdsReason, color: 'text-gray-400' } : null,
                        ].filter(Boolean).map((item: any, i: number) => (
                          <div key={i} className="bg-dark/60 rounded-lg p-2.5 border border-dark-tertiary">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">{item.label}</p>
                            <p className={`text-xs font-semibold leading-snug ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Business Objective */}
                {businessObjective && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span>🎯</span> {cdT?.sectionBusinessObjective || 'Business Objective'}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { label: cdT?.businessObjPrimary || 'Business Goal', value: businessObjective.primary, icon: '🏆' },
                        { label: cdT?.businessObjMarketing || 'Marketing Goal', value: businessObjective.marketing, icon: '📣' },
                        { label: cdT?.businessObjConversion || 'Conversion Action', value: businessObjective.conversionAction, icon: '⚡' },
                        { label: cdT?.businessObjAction || 'Expected Action', value: businessObjective.expectedUserAction, icon: '👆' },
                        { label: cdT?.businessObjWhyNow || 'Why Now', value: businessObjective.whyNow, icon: '⏰' },
                        { label: cdT?.businessObjSuccess30 || 'Win in 30 Days', value: businessObjective.successIn30Days, icon: '📅' },
                      ].filter(item => item.value).map((item, i) => (
                        <div key={i} className="bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">{item.icon} {item.label}</p>
                          <p className="text-sm text-gray-200 leading-snug">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ══ CHAPTER 02 — THE STRATEGY ════════════════════════════════ */}
                {(strategy.keyMessage || strategy.positioning || strategy.differentiation || audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0 || strategy.valueProps?.length > 0 || strategy.estimatedResults) && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-black tabular-nums leading-none" style={{ fontSize: '24px', color: 'rgba(139,92,246,0.2)' }}>02</span>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.25) 0%, transparent 100%)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{cdT?.chapterStrategy || 'The Strategy'}</span>
                  </div>
                )}

                {/* Key Message — flagship */}
                {strategy.keyMessage && (
                  <div className="rounded-2xl p-5"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 0 24px rgba(99,102,241,0.06)' }}>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2">{cdT?.sectionKeyMessage || 'Core Message'}</p>
                    <p className="text-white text-xl font-bold leading-relaxed mb-3">"{strategy.keyMessage}"</p>
                    <CopyBtn text={strategy.keyMessage} label={cdT?.copyBtn || 'Copy'} />
                  </div>
                )}

                {/* Positioning + Differentiation — side by side */}
                {(strategy.positioning || strategy.differentiation) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {strategy.positioning && (
                      <div className="rounded-2xl p-4" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5"><span>🎯</span> {cdT?.sectionPositioning || 'Positioning'}</p>
                        <p className="text-gray-300 text-sm leading-relaxed">{strategy.positioning}</p>
                      </div>
                    )}
                    {strategy.differentiation && (
                      <div className="rounded-2xl p-4" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5"><span>⚡</span> {cdT?.sectionDifferentiation || 'Differentiation'}</p>
                        <p className="text-gray-300 text-sm leading-relaxed">{strategy.differentiation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Audience Segments */}
                {(audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <span>👥</span> {cdT?.sectionAudienceSegmentsDetailed || cdT?.sectionAudienceSegments || 'Audience Segments'}
                    </h3>
                    {audienceSegmentsDetailed.length > 0 ? (
                      <div className="space-y-3">
                        {audienceSegmentsDetailed.map((seg: any, i: number) => (
                          <div key={i} className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">#{i + 1}</span>
                              <p className="text-sm font-bold text-white">{seg.segment}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                              {seg.situation && (
                                <div className="col-span-2">
                                  <span className="text-gray-600 text-[9px] uppercase tracking-wide">Situation: </span>
                                  <span className="text-gray-300">{seg.situation}</span>
                                </div>
                              )}
                              {seg.pain && <div><span className="text-red-400 text-[9px] uppercase">Pain: </span><span className="text-gray-400">{seg.pain}</span></div>}
                              {seg.desiredOutcome && <div><span className="text-green-400 text-[9px] uppercase">Wants: </span><span className="text-gray-400">{seg.desiredOutcome}</span></div>}
                              {seg.objection && <div><span className="text-amber-400 text-[9px] uppercase">Objection: </span><span className="text-gray-400">{seg.objection}</span></div>}
                              {seg.message && (
                                <div className="col-span-2">
                                  <span className="text-indigo-400 text-[9px] uppercase">Message: </span>
                                  <span className="text-gray-200 font-medium">{seg.message}</span>
                                </div>
                              )}
                            </div>
                            {(seg.platform || seg.format || seg.cta) && (
                              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-dark-tertiary text-xs">
                                {seg.platform && <span className="text-gray-500">📱 {seg.platform}</span>}
                                {seg.format && <span className="text-gray-500">📄 {seg.format}</span>}
                                {seg.cta && <span className="text-accent font-semibold ml-auto">{seg.cta}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {audienceSegments.map((seg: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-dark rounded-xl p-3 border border-dark-tertiary text-sm">
                            <span className="text-accent font-bold flex-shrink-0">{i + 1}</span>
                            <span className="text-gray-300">{seg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Value Propositions */}
                {(strategy.valueProps?.length > 0 || strategy.estimatedResults) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><span>💎</span> {cdT?.sectionValueProps || 'Value Propositions'}</h3>
                    {strategy.valueProps?.length > 0 ? (
                      <ul className="space-y-1.5">
                        {strategy.valueProps.map((vp: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <span className="text-accent mt-0.5 flex-shrink-0">→</span> {vp}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-300 text-sm">{strategy.estimatedResults}</p>
                    )}
                  </div>
                )}

                {/* ══ TOP HOOKS — Copyable scroll-stopping lines ══════════════ */}
                {topHooks.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                      <span>🎯</span> {cdT?.sectionTopHooks || 'Top Hooks'}
                    </h3>
                    <div className="space-y-2">
                      {topHooks.slice(0, 6).map((hook: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl p-3 border border-dark-tertiary hover:border-accent/30 transition-colors" style={{ background: 'rgba(139,92,246,0.03)' }}>
                          <span className="text-[10px] font-black text-accent/50 mt-0.5 w-4 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <p className="text-gray-200 text-sm flex-1 leading-snug">{hook}</p>
                          <CopyBtn text={hook} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ══ CHAPTER 03 — EXECUTION PLAN ══════════════════════════════ */}
                {(funnelStages.length > 0 || strategy.funnelStrategy || strategy.channelMix?.length > 0 || channelStrategy.length > 0 || strategy.contentPillars?.length > 0 || strategy.offerCTAStrategy || strategy.visualDirection || weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-black tabular-nums leading-none" style={{ fontSize: '24px', color: 'rgba(139,92,246,0.2)' }}>03</span>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.25) 0%, transparent 100%)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{cdT?.chapterExecution || 'Execution Plan'}</span>
                  </div>
                )}

                {/* Funnel */}
                {(funnelStages.length > 0 || strategy.funnelStrategy) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <span>🔻</span> {cdT?.sectionFunnelStages || cdT?.sectionFunnelStrategy || 'Marketing Funnel'}
                    </h3>
                    {funnelStages.length > 0 ? (
                      <div className="space-y-2">
                        {funnelStages.map((stage: any, i: number) => {
                          const stageColors: Record<string, string> = {
                            awareness: 'border-blue-500/25 bg-blue-500/5',
                            consideration: 'border-purple-500/25 bg-purple-500/5',
                            conversion: 'border-green-500/25 bg-green-500/5',
                            followUp: 'border-amber-500/25 bg-amber-500/5',
                          }
                          const stageIcons: Record<string, string> = {
                            awareness: '📢', consideration: '🤔', conversion: '✅', followUp: '🔄',
                          }
                          return (
                            <div key={i} className={`rounded-xl p-3.5 border ${stageColors[stage.stage] || 'border-dark-tertiary bg-dark'}`}>
                              <p className="font-bold text-xs uppercase tracking-wide text-white mb-2">
                                {stageIcons[stage.stage] || '📌'} {stage.stage}
                                {stage.productArea && <span className="ml-2 text-[10px] text-gray-600 normal-case font-normal">({stage.productArea})</span>}
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                                {stage.userMindset && <div><span className="text-gray-600 text-[9px] uppercase">{cdT?.funnelMindset || 'Mindset'}: </span><span className="text-gray-400 italic">{stage.userMindset}</span></div>}
                                {stage.message && <div><span className="text-gray-600 text-[9px] uppercase">Message: </span><span className="text-gray-200 font-medium">{stage.message}</span></div>}
                                {stage.contentType && <div><span className="text-gray-600 text-[9px] uppercase">Format: </span><span className="text-gray-400">{stage.contentType}</span></div>}
                                {stage.platform && <div><span className="text-gray-600 text-[9px] uppercase">Platform: </span><span className="text-gray-400">{stage.platform}</span></div>}
                                {stage.cta && <div><span className="text-gray-600 text-[9px] uppercase">CTA: </span><span className="text-accent font-semibold">{stage.cta}</span></div>}
                                {stage.successMetric && <div><span className="text-gray-600 text-[9px] uppercase">{cdT?.weekSuccessMetric || 'Metric'}: </span><span className="text-gray-400">{stage.successMetric}</span></div>}
                              </div>
                              {stage.nextStep && (
                                <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-dark-tertiary/50">
                                  → {cdT?.funnelNextStep || 'Next'}: {stage.nextStep}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : strategy.funnelStrategy && (
                      <div className="grid grid-cols-2 gap-2.5">
                        {([
                          { key: 'awareness',     icon: '📢', label: cdT?.funnelAwareness     || 'Awareness',     color: 'border-blue-500/25 bg-blue-500/5 text-blue-400' },
                          { key: 'consideration', icon: '🤔', label: cdT?.funnelConsideration || 'Consideration', color: 'border-purple-500/25 bg-purple-500/5 text-purple-400' },
                          { key: 'conversion',    icon: '✅', label: cdT?.funnelConversion    || 'Conversion',    color: 'border-green-500/25 bg-green-500/5 text-green-400' },
                          { key: 'retention',     icon: '🔄', label: cdT?.funnelRetention     || 'Retention',     color: 'border-amber-500/25 bg-amber-500/5 text-amber-400' },
                        ] as const).map(({ key, icon, label, color }) => (
                          strategy.funnelStrategy[key] && (
                            <div key={key} className={`rounded-xl p-3.5 border ${color}`}>
                              <p className="font-semibold text-xs uppercase tracking-wide mb-1.5">{icon} {label}</p>
                              <p className="text-gray-300 text-xs leading-relaxed">{strategy.funnelStrategy[key]}</p>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Channel Strategy — unified mix + detail */}
                {(strategy.channelMix?.length > 0 || channelStrategy.length > 0) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <span>📡</span> {cdT?.sectionChannelMix || cdT?.sectionChannelStrategy || 'Channel Strategy'}
                    </h3>
                    <div className="space-y-2.5">
                      {channelStrategy.length > 0 ? (
                        channelStrategy.map((ch: any, i: number) => {
                          const mixData = strategy.channelMix?.find((m: any) =>
                            m.platform?.toLowerCase() === ch.platform?.toLowerCase()
                          )
                          const pct = mixData?.budgetPercent || ch.budgetPercent
                          return (
                            <div key={i} className="bg-dark rounded-xl p-3.5 border border-dark-tertiary">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold text-accent capitalize flex-1">{ch.platform}</span>
                                {pct && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 bg-dark-tertiary rounded-full h-1">
                                      <div className="h-1 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--accent)' }} />
                                    </div>
                                    <span className="text-xs text-accent font-bold w-8 text-right">{pct}%</span>
                                  </div>
                                )}
                              </div>
                              {(ch.role || ch.rationale || mixData?.rationale) && (
                                <p className="text-xs text-gray-500 italic mb-1.5">{ch.role || ch.rationale || mixData?.rationale}</p>
                              )}
                              {(ch.contentType || ch.postingApproach || ch.cta) && (
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                  {ch.contentType && <span className="text-gray-400">📄 {ch.contentType}</span>}
                                  {ch.postingApproach && <span className="text-gray-500">{ch.postingApproach}</span>}
                                  {ch.cta && <span className="text-accent font-semibold">{ch.cta}</span>}
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        strategy.channelMix?.map((ch: any, i: number) => (
                          <div key={i} className="flex items-center gap-4 bg-dark rounded-xl p-3 border border-dark-tertiary">
                            <span className="text-gray-300 font-semibold w-28 flex-shrink-0 capitalize text-sm">{ch.platform}</span>
                            <div className="flex-1">
                              <div className="w-full bg-dark-tertiary rounded-full h-1.5 mb-1">
                                <div className="h-1.5 rounded-full" style={{ width: `${Math.min(ch.budgetPercent, 100)}%`, background: 'var(--accent)' }} />
                              </div>
                              <p className="text-xs text-gray-500">{ch.rationale}</p>
                            </div>
                            <span className="text-accent font-bold text-xs w-10 text-right">{ch.budgetPercent}%</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Content Pillars */}
                {strategy.contentPillars?.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><span>📐</span> {cdT?.sectionContentPillars || 'Content Pillars'}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {strategy.contentPillars.map((p: string, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-3 text-xs text-center text-gray-300 border border-dark-tertiary">{p}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Offer & CTA Strategy */}
                {strategy.offerCTAStrategy && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><span>📣</span> {cdT?.sectionOfferCTA || 'Offer & CTA'}</h3>
                    <div className="space-y-2">
                      {strategy.offerCTAStrategy.primaryCTA && (
                        <div className="flex items-center gap-3 rounded-xl p-3 border border-accent/20" style={{ background: 'rgba(139,92,246,0.06)' }}>
                          <span className="text-[10px] text-accent font-bold uppercase tracking-wide w-20 flex-shrink-0">{cdT?.ctaPrimary || 'Primary CTA'}</span>
                          <p className="text-white text-sm font-semibold flex-1">{strategy.offerCTAStrategy.primaryCTA}</p>
                          <CopyBtn text={strategy.offerCTAStrategy.primaryCTA} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      )}
                      {strategy.offerCTAStrategy.secondaryCTA && (
                        <div className="flex items-center gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide w-20 flex-shrink-0">{cdT?.ctaSecondary || 'Secondary'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.secondaryCTA}</p>
                          <CopyBtn text={strategy.offerCTAStrategy.secondaryCTA} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      )}
                      {strategy.offerCTAStrategy.leadMagnet && (
                        <div className="flex items-center gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wide w-20 flex-shrink-0">{cdT?.ctaLeadMagnet || 'Lead Magnet'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.leadMagnet}</p>
                        </div>
                      )}
                      {strategy.offerCTAStrategy.betaOffer && (
                        <div className="flex items-center gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wide w-20 flex-shrink-0">{cdT?.ctaBetaOffer || 'Beta Offer'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.betaOffer}</p>
                        </div>
                      )}
                      {strategy.offerCTAStrategy.contactFlow && (
                        <div className="flex items-center gap-3 bg-dark rounded-xl p-3 border border-dark-tertiary">
                          <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide w-20 flex-shrink-0">{cdT?.ctaContactFlow || 'Contact Flow'}</span>
                          <p className="text-gray-300 text-sm flex-1">{strategy.offerCTAStrategy.contactFlow}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Visual Direction */}
                {strategy.visualDirection && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
                    <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-purple-400">
                      <span>🎨</span> {cdT?.sectionVisualDirection || 'Visual Direction'}
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">{strategy.visualDirection}</p>
                  </div>
                )}

                {/* ══ WEEKLY EXECUTION PLAN ════════════════════════════════════ */}
                {(weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <span>📅</span> {cdT?.sectionWeeklyPlan || '4-Week Execution Plan'}
                    </h3>
                    {weeklyExecutionPlan.length > 0 ? (
                      <div className="space-y-3">
                        {weeklyExecutionPlan.map((w: any) => (
                          <div key={w.week} className="rounded-xl overflow-hidden border border-dark-tertiary">
                            {/* Week header */}
                            <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(139,92,246,0.08)' }}>
                              <span className="text-[10px] font-black text-accent">W{w.week}</span>
                              <span className="text-sm font-semibold text-white flex-1">{w.objective}</span>
                              {w.cta && <span className="text-[10px] text-accent font-semibold hidden md:block">{w.cta}</span>}
                            </div>
                            {/* Week body */}
                            <div className="px-4 py-3 space-y-2">
                              {w.keyMessage && (
                                <p className="text-xs text-gray-400 italic">"{w.keyMessage}"</p>
                              )}
                              {w.deliverables?.length > 0 && (
                                <ul className="space-y-1">
                                  {w.deliverables.map((d: string, di: number) => (
                                    <li key={di} className="flex items-start gap-2 text-xs text-gray-300">
                                      <span className="text-accent/60 mt-0.5 flex-shrink-0">→</span> {d}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="flex items-center gap-3 pt-1">
                                {w.platforms?.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {w.platforms.map((p: string, pi: number) => (
                                      <span key={pi} className="text-[10px] bg-dark rounded-md px-2 py-0.5 text-gray-500 border border-dark-tertiary">{p}</span>
                                    ))}
                                  </div>
                                )}
                                {w.successMetric && (
                                  <span className="text-[10px] text-green-400 ml-auto">📈 {w.successMetric}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Fallback: simple weeklyPlan array */
                      <div className="space-y-3">
                        {weeklyPlan.map((w: any) => (
                          <div key={w.week} className="rounded-xl overflow-hidden border border-dark-tertiary">
                            <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(139,92,246,0.08)' }}>
                              <span className="text-[10px] font-black text-accent">W{w.week}</span>
                              <span className="text-sm font-semibold text-white flex-1">{w.objective}</span>
                            </div>
                            <div className="px-4 py-3 space-y-1">
                              {w.keyMessage && <p className="text-xs text-gray-400 italic">"{w.keyMessage}"</p>}
                              {w.deliverables?.length > 0 && (
                                <ul className="space-y-1">
                                  {w.deliverables.map((d: string, di: number) => (
                                    <li key={di} className="flex items-start gap-2 text-xs text-gray-300">
                                      <span className="text-accent/60 mt-0.5 flex-shrink-0">→</span> {d}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ══ CHAPTER 04 — METRICS & READINESS ════════════════════════ */}
                {(strategy.kpis?.length > 0 || successMetricsDetailed.length > 0 || successMetrics.length > 0 || readinessChecklist.length > 0 || assetRequirements || strategy.executionChecklist?.length > 0 || doNotDoYet.length > 0 || riskNotes.length > 0 || adSetupPlan) && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-black tabular-nums leading-none" style={{ fontSize: '24px', color: 'rgba(139,92,246,0.2)' }}>04</span>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.25) 0%, transparent 100%)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{cdT?.chapterMetrics || 'Metrics & Readiness'}</span>
                  </div>
                )}

                {/* KPIs + Success Metrics — unified */}
                {(strategy.kpis?.length > 0 || successMetricsDetailed.length > 0 || successMetrics.length > 0) && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <span>📊</span> {cdT?.sectionKpis || 'KPIs & Metrics'}
                    </h3>
                    {strategy.kpis?.length > 0 && (
                      <div className={`grid gap-2 mb-4 ${strategy.kpis.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                        {strategy.kpis.map((kpi: any, i: number) => (
                          <div key={i} className="bg-dark rounded-xl p-3 border border-dark-tertiary text-center">
                            <p className="text-accent font-bold text-lg">{kpi.target}</p>
                            <p className="text-gray-400 text-[10px] mt-0.5">{kpi.metric}</p>
                            <p className="text-gray-600 text-[10px]">{kpi.timeframe}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {successMetricsDetailed.length > 0 && (
                      <div className="space-y-2">
                        {(['lead', 'engagement', 'conversion', 'operational'] as const).map((cat) => {
                          const catMetrics = successMetricsDetailed.filter((m: any) => m.category === cat)
                          if (!catMetrics.length) return null
                          const catLabels: Record<string, string> = {
                            lead: cdT?.metricLead || 'Lead',
                            engagement: cdT?.metricEngagement || 'Engagement',
                            conversion: cdT?.metricConversion || 'Conversion',
                            operational: cdT?.metricOperational || 'Operational',
                          }
                          const catColors: Record<string, string> = {
                            lead: 'text-blue-400', engagement: 'text-pink-400',
                            conversion: 'text-green-400', operational: 'text-amber-400',
                          }
                          return (
                            <div key={cat}>
                              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${catColors[cat]}`}>{catLabels[cat]}</p>
                              <div className="grid grid-cols-2 gap-2">
                                {catMetrics.map((m: any, idx: number) => (
                                  <div key={idx} className="bg-dark rounded-xl p-3 border border-dark-tertiary flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-xs text-gray-300">{m.metric}</p>
                                      <p className="text-[10px] text-gray-600">{m.timeframe}</p>
                                    </div>
                                    <span className={`text-sm font-bold flex-shrink-0 ${catColors[cat]}`}>{m.target}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {successMetrics.length > 0 && successMetricsDetailed.length === 0 && (
                      <ul className="space-y-1.5">
                        {successMetrics.map((metric: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span> {metric}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Launch Readiness */}
                {readinessChecklist.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                      <span>✅</span> {cdT?.sectionReadinessChecklist || 'Launch Readiness'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {readinessChecklist.map((item: any, i: number) => {
                        const lc = (item.label || item.item || '').toLowerCase()
                        const atype = (item.actionType || '').toUpperCase()
                        const isBrandBrain = atype === 'BRAND_BRAIN' || lc.includes('brand brain') || lc.includes('brand profile')
                        const isAssets = atype === 'ASSETS' || (lc.includes('asset') && !lc.includes('sentinel')) || lc.includes('upload') || lc.includes('photo')
                        const isSentinel = atype === 'SENTINEL' || lc.includes('sentinel') || (lc.includes('review') && !lc.includes('brand'))
                        const isCalendar = atype === 'CALENDAR' || lc.includes('calendar') || lc.includes('schedule') || lc.includes('push')
                        const isApproval = atype === 'APPROVAL' || lc.includes('approv')
                        return (
                          <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                            item.done ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-dark-tertiary text-gray-400'
                          }`}>
                            <span className="flex-shrink-0">{item.done ? '✓' : '○'}</span>
                            <span className="flex-1">{item.label || item.item}</span>
                            {item.done ? (
                              <span className="text-[10px] text-green-500/70">{cdT?.readinessComplete || 'Done'}</span>
                            ) : isBrandBrain ? (
                              <Link href="/brand" className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition whitespace-nowrap">{cdT?.readinessActionBrand || '→ Brand'}</Link>
                            ) : isAssets ? (
                              <Link href="/media" className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition whitespace-nowrap">{cdT?.readinessActionMedia || '→ Media'}</Link>
                            ) : isSentinel ? (
                              <button onClick={handleSentinelReview} disabled={sentinelState === 'reviewing'} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition disabled:opacity-50 whitespace-nowrap">
                                {sentinelState === 'reviewing' ? (cdT?.readinessActionReviewing || '⏳') : (cdT?.readinessActionReview || '→ Review')}
                              </button>
                            ) : isCalendar ? (
                              <button onClick={() => handlePushToCalendar(false)} disabled={calendarPushState === 'pushing'} className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition disabled:opacity-50 whitespace-nowrap">
                                {calendarPushState === 'pushing' ? (cdT?.readinessActionPushing || '⏳') : (cdT?.readinessActionPush || '→ Push')}
                              </button>
                            ) : isApproval ? (
                              <button onClick={handleApprove} disabled={approvalState === 'approving' || approvalState === 'done'} className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-500 hover:bg-green-500/30 transition disabled:opacity-50 whitespace-nowrap">
                                {approvalState === 'done' ? '✓' : (cdT?.readinessActionApprove || '→ Approve')}
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Asset Requirements */}
                {assetRequirements && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                      <span>📦</span> {cdT?.sectionAssetRequirements || 'Asset Requirements'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {assetRequirements.mustHave?.length > 0 && (
                        <div>
                          <p className="text-xs text-red-400 font-bold uppercase tracking-wide mb-1.5">{cdT?.assetMustHave || 'Must Have'}</p>
                          <ul className="space-y-1">
                            {assetRequirements.mustHave.map((a: string, i: number) => (
                              <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                                <span className="text-red-400 mt-0.5 flex-shrink-0">✦</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {assetRequirements.niceToHave?.length > 0 && (
                        <div>
                          <p className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-1.5">{cdT?.assetNiceToHave || 'Nice to Have'}</p>
                          <ul className="space-y-1">
                            {assetRequirements.niceToHave.map((a: string, i: number) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                <span className="text-amber-400/60 mt-0.5 flex-shrink-0">◦</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {assetRequirements.forAds?.length > 0 && (
                        <div>
                          <p className="text-xs text-blue-400 font-bold uppercase tracking-wide mb-1.5">{cdT?.assetForAds || 'For Paid Ads'}</p>
                          <ul className="space-y-1">
                            {assetRequirements.forAds.map((a: string, i: number) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                <span className="text-blue-400/60 mt-0.5 flex-shrink-0">◦</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {assetRequirements.forProof?.length > 0 && (
                        <div>
                          <p className="text-xs text-green-400 font-bold uppercase tracking-wide mb-1.5">{cdT?.assetForProof || 'Social Proof'}</p>
                          <ul className="space-y-1">
                            {assetRequirements.forProof.map((a: string, i: number) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                                <span className="text-green-400/60 mt-0.5 flex-shrink-0">◦</span>{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {assetRequirements.nextToCreate?.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-dark-tertiary">
                        <p className="text-xs text-accent font-bold uppercase tracking-wide mb-2">{cdT?.assetNextToCreate || 'Create These First'}</p>
                        <ol className="space-y-1">
                          {assetRequirements.nextToCreate.map((a: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
                              <span className="text-accent font-bold w-4 flex-shrink-0">{i + 1}.</span>{a}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {assetRequirements.canStartWithoutNote && (
                      <p className="text-xs text-gray-500 mt-3 italic">
                        {assetRequirements.canStartWithout
                          ? `✓ ${cdT?.assetCanStart || 'Can start without these'}`
                          : `⚠ ${cdT?.assetCannotStart || 'Required before starting'}`}: {assetRequirements.canStartWithoutNote}
                      </p>
                    )}
                  </div>
                )}

                {/* Execution Checklist */}
                {strategy.executionChecklist?.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.12)' }}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-green-400">
                      <span>✅</span> {cdT?.sectionExecutionChecklist || 'Execution Checklist'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {strategy.executionChecklist.map((item: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-gray-300 text-xs">
                          <span className="text-green-500 mt-0.5 flex-shrink-0">□</span> {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks & Constraints — collapsible */}
                {(doNotDoYet.length > 0 || riskNotes.length > 0 || executionAssumptions.length > 0) && (
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer select-none list-none rounded-xl p-3 transition-colors hover:bg-red-500/5"
                      style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                      <span>⚠️</span>
                      <span className="text-sm font-semibold text-red-400">{cdT?.sectionRiskNotes || 'Risks & Constraints'}</span>
                      <span className="text-xs text-gray-600 ml-1">({doNotDoYet.length + riskNotes.length + executionAssumptions.length})</span>
                      <span className="ml-auto text-gray-600 text-xs group-open:rotate-180 transition-transform duration-200">▾</span>
                    </summary>
                    <div className="mt-2 space-y-3">
                      {doNotDoYet.length > 0 && (
                        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                          <p className="text-xs text-red-400 font-bold uppercase tracking-wide mb-2">{cdT?.sectionDoNotDoYet || 'Do Not Do Yet'}</p>
                          <ul className="space-y-1">
                            {doNotDoYet.map((item: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-red-300/80">
                                <span className="text-red-500 mt-0.5 flex-shrink-0">✗</span>{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {riskNotes.length > 0 && (
                        <ul className="space-y-1.5 px-1">
                          {riskNotes.map((note: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-gray-400 text-xs">
                              <span className="text-red-400 mt-0.5 flex-shrink-0">!</span>{note}
                            </li>
                          ))}
                        </ul>
                      )}
                      {executionAssumptions.length > 0 && (
                        <ul className="space-y-1 px-1">
                          {executionAssumptions.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-gray-500 text-xs">
                              <span className="text-gray-600 mt-0.5 flex-shrink-0">·</span>{item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                )}

                {/* VEX Ad Setup Plan — React-state collapsible */}
                {(() => {
                  const hasAdContent = adSetupPlan && (
                    adSetupPlan.testBudget || adSetupPlan.duration || adSetupPlan.targeting ||
                    adSetupPlan.abTestPlan || adSetupPlan.landingPath || adSetupPlan.trackingRequired ||
                    adSetupPlan.adCopyAngles?.length > 0 || adSetupPlan.notReadyIf?.length > 0 ||
                    adSetupPlan.objective || adSetupPlan.platformPriority?.length > 0
                  )
                  return (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
                      {/* Header — always clickable */}
                      <button
                        type="button"
                        onClick={() => setAdSetupOpen(v => !v)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-blue-500/5"
                        style={{ background: 'transparent' }}
                      >
                        <span>📡</span>
                        <span className="text-sm font-semibold text-blue-400">{cdT?.sectionAdSetupPlan || 'VEX Ad Setup Plan'}</span>
                        <span className="text-xs text-gray-600 ml-1">{cdT?.advanced || 'Advanced'}</span>
                        <span className="ml-auto text-gray-500 text-sm transition-transform duration-200" style={{ transform: adSetupOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                      </button>

                      {/* Body */}
                      {adSetupOpen && (
                        <div className="px-4 pb-4 pt-1" style={{ background: 'rgba(59,130,246,0.03)', borderTop: '1px solid rgba(59,130,246,0.1)' }}>
                          {!hasAdContent ? (
                            /* Empty state — campaign was generated before adSetupPlan schema */
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <span className="text-3xl">📡</span>
                              <p className="text-sm text-gray-400 max-w-xs">
                                {locale === 'ar' ? 'خطة الإعلانات غير متاحة لهذه الحملة. أعد تشغيل الاستراتيجية للحصول على خطة إعلانية كاملة.' : 'Ad setup plan not available for this campaign. Regenerate the strategy to get a full ad plan.'}
                              </p>
                              <button
                                type="button"
                                disabled={engineRunning}
                                onClick={() => handleRunEngine(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}
                              >
                                {engineRunning ? (locale === 'ar' ? 'جارٍ التشغيل...' : 'Running...') : (locale === 'ar' ? '🔄 أعد تشغيل الاستراتيجية' : '🔄 Regenerate Strategy')}
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Quick stat chips */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3 mt-2">
                                {[
                                  { label: cdT?.adTestBudget || 'Test Budget', value: adSetupPlan.testBudget },
                                  { label: cdT?.adDuration || 'Duration', value: adSetupPlan.duration },
                                  { label: cdT?.adAbTest || 'A/B Test Plan', value: adSetupPlan.abTestPlan },
                                  { label: cdT?.adLandingPath || 'Landing Path', value: adSetupPlan.landingPath },
                                  { label: cdT?.adTracking || 'Tracking', value: adSetupPlan.trackingRequired },
                                  { label: 'Objective', value: adSetupPlan.objective },
                                ].filter(item => item.value).map((item, i) => (
                                  <div key={i} className="bg-dark rounded-lg p-2.5 border border-dark-tertiary">
                                    <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">{item.label}</p>
                                    <p className="text-xs text-gray-200 leading-snug">{item.value}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Platform priority */}
                              {adSetupPlan.platformPriority?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {adSetupPlan.platformPriority.map((p: string, i: number) => (
                                    <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full text-blue-300" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                      #{i + 1} {p}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Targeting */}
                              {adSetupPlan.targeting && (
                                <div className="bg-dark rounded-xl p-3 border border-dark-tertiary mb-2">
                                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{cdT?.adTargeting || 'Targeting'}</p>
                                  <p className="text-sm text-gray-300">{adSetupPlan.targeting}</p>
                                </div>
                              )}

                              {/* Exclusions */}
                              {adSetupPlan.exclusions && (
                                <div className="bg-dark rounded-xl p-3 border border-dark-tertiary mb-2">
                                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Exclusions</p>
                                  <p className="text-sm text-gray-300">{adSetupPlan.exclusions}</p>
                                </div>
                              )}

                              {/* Ad Copy Angles */}
                              {adSetupPlan.adCopyAngles?.length > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Ad Copy Angles</p>
                                  <div className="space-y-1">
                                    {adSetupPlan.adCopyAngles.map((angle: string, i: number) => (
                                      <div key={i} className="flex items-start gap-2 text-xs text-gray-300 bg-dark rounded-lg p-2 border border-dark-tertiary">
                                        <span className="text-blue-400 font-bold flex-shrink-0">{i + 1}</span>{angle}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Creative formats */}
                              {adSetupPlan.creativeFormats?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  <p className="w-full text-xs text-gray-500 uppercase tracking-wide mb-1">Creative Formats</p>
                                  {adSetupPlan.creativeFormats.map((f: string, i: number) => (
                                    <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full text-purple-300" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>{f}</span>
                                  ))}
                                </div>
                              )}

                              {/* Do not launch if */}
                              {adSetupPlan.notReadyIf?.length > 0 && (
                                <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)' }}>
                                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wide mb-1.5">{cdT?.adNotReadyIf || 'Do not launch ads if'}</p>
                                  <ul className="space-y-0.5">
                                    {adSetupPlan.notReadyIf.map((item: string, i: number) => (
                                      <li key={i} className="text-xs text-amber-300/70 flex items-start gap-1.5">
                                        <span className="flex-shrink-0">⚠</span>{item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── Tab 1: Content & Hooks (NEX) ──────────────────────────────── */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <AgentBanner idx={1} />
                <BrandDNABadge brand={brandDNA} locale={locale} />

                {/* Top Hooks */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
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
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
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
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
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
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
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

                {/* Content Angles — Sprint M detailed view (show both) */}
                {contentAnglesDetailed.length > 0 && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2"><span>💡</span> {cdT?.sectionContentAnglesDetailed || cdT?.sectionContentAngles || 'Content Angles'}</h3>
                    <div className="space-y-3">
                      {contentAnglesDetailed.map((angle: any, i: number) => (
                        <div key={i} className="bg-dark rounded-xl p-4 border border-dark-tertiary">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-accent font-bold text-xs bg-accent/10 px-2 py-0.5 rounded">{i + 1}</span>
                              <p className="text-sm font-bold text-white">{angle.title}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <SaveToMemoryBtn
                                text={angle.title}
                                field="winningAngles"
                                authHeader={authHeader}
                                saveLabel={cdT?.saveToMemoryBtn || '🧠 Save'}
                                savedLabel={cdT?.savedToMemoryBtn || '🧠 Saved'}
                                title={cdT?.saveToMemoryTitle || 'Save to Brand Memory'}
                              />
                              <CopyBtn text={`${angle.title}\n${angle.hook}`} label={cdT?.copyBtn || 'Copy'} />
                            </div>
                          </div>
                          {angle.hook && (
                            <p className="text-sm text-indigo-300 italic mb-2">"{angle.hook}"</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            {angle.pain && (
                              <div>
                                <span className="text-gray-600 uppercase tracking-wide">{cdT?.anglePain || 'Pain'}: </span>
                                <span className="text-gray-400">{angle.pain}</span>
                              </div>
                            )}
                            {angle.format && (
                              <div>
                                <span className="text-gray-600 uppercase tracking-wide">Format: </span>
                                <span className="text-gray-400">{angle.format}</span>
                              </div>
                            )}
                            {angle.platform && (
                              <div>
                                <span className="text-gray-600 uppercase tracking-wide">Platform: </span>
                                <span className="text-gray-400">{angle.platform}</span>
                              </div>
                            )}
                            {angle.asset && (
                              <div>
                                <span className="text-gray-600 uppercase tracking-wide">{cdT?.angleAsset || 'Asset'}: </span>
                                <span className="text-gray-400">{angle.asset}</span>
                              </div>
                            )}
                          </div>
                          {(angle.cta || angle.funnelStage) && (
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-dark-tertiary text-xs">
                              {angle.funnelStage && (
                                <span className="text-gray-600 capitalize">{angle.funnelStage}</span>
                              )}
                              {angle.cta && (
                                <span className="ml-auto text-accent font-semibold">{angle.cta}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Angles — legacy string list */}
                {contentAngles.length > 0 && contentAnglesDetailed.length === 0 && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
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
                {topHooks.length === 0 && ctaVariations.length === 0 && captionFormulas.length === 0 && contentAngles.length === 0 && contentAnglesDetailed.length === 0 && (
                  <EmptySection icon="✍️" message={cdT?.emptyHooksDesc || 'No content generated yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 2: Calendar (PULSE) ───────────────────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <AgentBanner idx={2} />

                {/* Weekly Execution Plan — Sprint M detailed (shown when available) */}
                {weeklyExecutionPlan.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide px-1">{cdT?.sectionWeeklyExecutionPlan || '4-Week Execution Plan'}</p>
                    {weeklyExecutionPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(12px)' }}>
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
                          {wk.deliverables?.length > 0 && (
                            <div className="bg-dark rounded-xl p-3 border border-dark-tertiary">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{cdT?.weekDeliverables || 'Deliverables'}</p>
                              <ul className="space-y-1">
                                {wk.deliverables.map((d: string, di: number) => (
                                  <li key={di} className="text-gray-300 text-xs flex items-start gap-1">
                                    <span className="text-accent mt-0.5">·</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {wk.assetsNeeded?.length > 0 && (
                            <div className="bg-dark rounded-xl p-3 border border-dark-tertiary">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{cdT?.weekAssets || 'Assets Needed'}</p>
                              <ul className="space-y-1">
                                {wk.assetsNeeded.map((a: string, ai: number) => (
                                  <li key={ai} className="text-gray-400 text-xs flex items-start gap-1">
                                    <span className="text-amber-400/60 mt-0.5">◦</span> {a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {wk.successMetric && (
                          <div className="mt-3 text-xs">
                            <span className="text-gray-500 uppercase tracking-wide">{cdT?.weekSuccessMetric || 'Metric'}: </span>
                            <span className="text-green-400">{wk.successMetric}</span>
                          </div>
                        )}
                        {wk.executionNote && (
                          <div className="mt-2 px-3 py-2 bg-blue-500/5 border border-blue-500/15 rounded-lg">
                            <p className="text-xs text-blue-300 italic">{cdT?.weekExecutionNote || 'Note'}: {wk.executionNote}</p>
                          </div>
                        )}
                        {wk.reviewPoints?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-dark-tertiary">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">{cdT?.weekReviewPoints || 'Review at end of week'}</p>
                            <ul className="space-y-1">
                              {wk.reviewPoints.map((rp: string, ri: number) => (
                                <li key={ri} className="text-xs text-gray-500 flex items-start gap-1.5">
                                  <span className="text-gray-600 mt-0.5">→</span>{rp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Weekly Execution Plan (Sprint D2 — rich version, shown when M version not available) */}
                {weeklyPlan.length > 0 && weeklyExecutionPlan.length === 0 && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide px-1">{cdT?.sectionWeeklyPlan || '4-Week Execution Plan'}</p>
                    {weeklyPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(12px)' }}>
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

                {/* Platform preview calendar */}
                {monthlyPreviewItems.length > 0 && (
                  <div className="space-y-5">
                    <div className="rounded-2xl p-5 border"
                      style={{ background: 'rgba(10,11,28,0.82)', borderColor: 'rgba(139,92,246,0.18)' }}>
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            {locale === 'ar' ? 'خطة الشهر حسب المنصة' : 'Monthly plan by platform'}
                          </p>
                          <h3 className="text-white font-bold mt-1">
                            {locale === 'ar'
                              ? `${monthlyPreviewItems.length} كارت محتوى جاهز للمراجعة`
                              : `${monthlyPreviewItems.length} content cards ready for review`}
                          </h3>
                        </div>
                        <div className="md:ml-auto flex flex-wrap gap-2">
                          <span className="text-[11px] px-2.5 py-1 rounded-full border border-cyan-500/20 text-cyan-300 bg-cyan-500/5">
                            {mediaStrategy?.mode === 'client_assets'
                              ? (locale === 'ar' ? `${mediaStrategy.sourceCount} ملف من الميديا دخلوا في الخطة` : `${mediaStrategy.sourceCount} media assets used`)
                              : (locale === 'ar' ? 'بدون ميديا: الصور هتتولد بالـ AI' : 'No media: AI visuals planned')}
                          </span>
                          {creativeAssets.some((asset: any) => asset.type === 'VIDEO') && (
                            <span className="text-[11px] px-2.5 py-1 rounded-full border border-pink-500/20 text-pink-300 bg-pink-500/5">
                              {locale === 'ar' ? 'الفيديوهات محسوبة في الخطة' : 'Videos considered in plan'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {Object.entries(postsByPlatform).map(([platformKey, postsUnknown]) => {
                      const posts = postsUnknown as any[]
                      const theme = platformTheme(platformKey)
                      return (
                        <div key={platformKey} className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <span className="text-lg">{theme.icon}</span>
                            <h3 className="font-bold text-white">{theme.label}</h3>
                            <span className="text-xs text-gray-600">· {posts.length} {locale === 'ar' ? 'بوست' : 'posts'}</span>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {posts.map((item: any, index: number) => (
                              <PlatformNativeCard
                                key={item.id || index}
                                item={item}
                                index={index}
                                locale={locale}
                                brandName={_postBrandName}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {weeklyExecutionPlan.length === 0 && weeklyPlan.length === 0 && contentCalendar.length === 0 && monthlyPreviewItems.length === 0 && (
                  <EmptySection icon="📅" message={cdT?.emptyCalendarDesc || 'Content calendar not available yet.'} />
                )}
              </div>
            )}

            {/* ── Tab 3: Visuals ────────────────────────────────────────────── */}
            {activeTab === 3 && (
              <div className="space-y-4">
                {/* ── Creative Brief Entry Card — Sprint F ── */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(168,85,247,0.3)', backdropFilter: 'blur(12px)' }}>
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

                {/* ── Content Hub Entry Card ── */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.25)', backdropFilter: 'blur(12px)' }}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">📅</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-purple-400">Content Hub</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {locale === 'ar'
                          ? 'كل المنشورات الشهرية — معاينة حقيقية + توليد الصور'
                          : 'All monthly posts — real platform previews + AI image generation'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['📘 Facebook', '📸 Instagram', '💼 LinkedIn', '✕ X', '🎵 TikTok'].map(p => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>{p}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/content-hub`, '_blank')}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.9), rgba(109,40,217,0.9))', border: '1px solid rgba(139,92,246,0.4)' }}
                  >
                    <span>📅</span>
                    {locale === 'ar' ? 'فتح مركز المحتوى' : 'Open Content Hub'}
                    <span className="text-purple-300 text-xs">↗</span>
                  </button>
                </div>

                {/* ── Paid Launch Pack Card ── */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(245,158,11,0.3)', backdropFilter: 'blur(12px)' }}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">🚀</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-amber-400">
                        {locale === 'ar' ? 'حملة مدفوعة' : 'Paid Campaign Launch'}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {locale === 'ar'
                          ? 'جمهور مستهدف + نسخ إعلانية + دليل تشغيل + تحديث Brand Brain تلقائياً'
                          : 'AI targeting brief + ad copy + step-by-step launch guide + Brand Brain learning loop'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['𝓕 Meta', 'G Google', '♪ TikTok', 'in LinkedIn'].map(p => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>{p}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/paid-launch`, '_blank')}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))', border: '1px solid rgba(245,158,11,0.4)' }}
                  >
                    <span>🚀</span>
                    {locale === 'ar' ? 'فتح حزمة الإطلاق المدفوع' : 'Open Paid Launch Pack'}
                    <span className="text-amber-300 text-xs">↗</span>
                  </button>
                </div>

                {/* Visual Direction from strategy */}
                {strategy.visualDirection && (
                  <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(168,85,247,0.2)', backdropFilter: 'blur(12px)' }}>
                    <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-purple-400"><span>🎯</span> {cdT?.sectionVisualDirection}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">{strategy.visualDirection}</p>
                  </div>
                )}

                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }}>
                  <VisualGenerator context={visualContext} />
                </div>

              </div>
            )}

            {/* ── Tab 4: Publish to Social ─────────────────────────────────── */}
            {activeTab === 4 && (
              <div className="space-y-4">
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(34,197,94,0.2)', backdropFilter: 'blur(12px)' }}>
                  <SocialPublisher
                    campaignId={campaign.id}
                    campaignName={campaign.name}
                    topHooks={topHooks}
                    captionFormulas={captionFormulas}
                    ctaVariations={ctaVariations}
                    keyMessage={strategy.keyMessage}
                  />
                </div>

                {/* ── Learning Loop card — save winning hook back to Brand Brain ── */}
                {topHooks.length > 0 && (
                  <div className="rounded-2xl p-5 flex items-start gap-4"
                    style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                      <span className="text-lg">🧠</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white mb-1">
                        {locale === 'ar' ? 'علّم عقلك من هذه الحملة' : 'Teach your Brain from this campaign'}
                      </p>
                      <p className="text-xs mb-3" style={{ color: '#64748b' }}>
                        {locale === 'ar'
                          ? 'إذا نجح هذا الـ hook، احفظه في ذاكرة علامتك — سيستخدمه الـ AI في كل الحملات القادمة'
                          : 'If this hook worked, save it to your brand memory — the AI will use it in all future campaigns'}
                      </p>
                      <div className="space-y-2">
                        {topHooks.slice(0, 3).map((hook, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-xl"
                            style={{ background: 'rgba(12,13,36,0.6)', border: '1px solid rgba(139,92,246,0.12)' }}>
                            <p className="text-xs flex-1 leading-relaxed" style={{ color: '#94a3b8' }}>
                              "{hook.length > 100 ? hook.slice(0, 100) + '…' : hook}"
                            </p>
                            <SaveToMemoryBtn
                              text={hook}
                              field="winningHooks"
                              authHeader={authHeader}
                              saveLabel={locale === 'ar' ? '+ حفظ' : '+ Save'}
                              savedLabel={locale === 'ar' ? '✓ محفوظ' : '✓ Saved'}
                              title={locale === 'ar' ? 'حفظ في ذاكرة العلامة التجارية' : 'Save to Brand Brain memory'}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Analytics section */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(59,130,246,0.2)', backdropFilter: 'blur(12px)' }}>
                  <SocialAnalytics campaignId={campaign.id} />
                </div>
              </div>
            )}

            {/* ── Tab 5: Autopilot ──────────────────────────────────────────── */}
            {activeTab === 5 && (
              <div className="space-y-4">

                {/* Header card */}
                <div className="rounded-2xl p-6 border"
                  style={{ background: 'rgba(109,40,217,0.05)', borderColor: 'rgba(139,92,246,0.25)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                      <span className="text-lg">🤖</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {locale === 'ar' ? 'وضع الأوتوبايلوت' : 'Autopilot Mode'}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {locale === 'ar'
                          ? 'بعد الموافقة على الاستراتيجية، NEXUS يولد المحتوى والصور وينشر على جدولك تلقائياً'
                          : 'After strategy approval, NEXUS generates content & images and publishes on your schedule automatically'}
                      </p>
                    </div>
                    {campaign.autopilotEnabled && (
                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)', color: '#a78bfa' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        {locale === 'ar' ? 'نشط' : 'Active'}
                      </div>
                    )}
                  </div>

                  {/* Requirements checklist */}
                  {!campaign.autopilotEnabled && (
                    <div className="mt-4 space-y-1.5">
                      {[
                        { label: locale === 'ar' ? 'استراتيجية مولَّدة' : 'Strategy generated', done: !!aiOutput },
                        { label: locale === 'ar' ? 'خطة تنفيذ أسبوعية' : 'Weekly execution plan', done: weeklyExecutionPlan.length > 0 },
                        { label: locale === 'ar' ? 'الحملة معتمدة' : 'Campaign approved', done: campaign.status === 'ACTIVE' || approvalState === 'done' },
                        { label: locale === 'ar' ? 'منصات اجتماعية متصلة' : 'Social platforms connected', done: true /* checked server-side */ },
                      ].map((req, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={req.done ? 'text-green-400' : 'text-gray-600'}>
                            {req.done ? '✓' : '○'}
                          </span>
                          <span className={req.done ? 'text-gray-300' : 'text-gray-600'}>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action row */}
                  <div className="mt-5 flex gap-2 flex-wrap">
                    {campaign.autopilotEnabled ? (
                      <>
                        <button
                          onClick={async () => {
                            const token = authHeader()
                            if (!token || autopilotPausing) return
                            setAutopilotPausing(true)
                            try {
                              const res = await fetch(`/api/autopilot/queue?campaignId=${campaignId}`, {
                                method: 'DELETE',
                                headers: { Authorization: token },
                              })
                              if (res.ok) {
                                setCampaign(prev => prev ? { ...prev, autopilotEnabled: false } : prev)
                                setAutopilotQueue([])
                              }
                            } finally {
                              setAutopilotPausing(false)
                            }
                          }}
                          disabled={autopilotPausing}
                          className="px-4 py-2 rounded-xl border text-xs font-semibold transition"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                          {autopilotPausing ? '...' : (locale === 'ar' ? '⏸ إيقاف الأوتوبايلوت' : '⏸ Pause Autopilot')}
                        </button>
                        <button
                          onClick={async () => {
                            const token = authHeader()
                            if (!token) return
                            const res = await fetch(`/api/autopilot/queue?campaignId=${campaignId}`, {
                              headers: { Authorization: token },
                            })
                            const d = await res.json()
                            if (d.posts) setAutopilotQueue(d.posts)
                          }}
                          className="px-4 py-2 rounded-xl border text-xs font-semibold transition"
                          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                          {locale === 'ar' ? '↻ تحديث القائمة' : '↻ Refresh Queue'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          const token = authHeader()
                          if (!token || autopilotActivating) return
                          setAutopilotActivating(true)
                          setAutopilotError('')
                          try {
                            const res = await fetch('/api/autopilot/activate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: token },
                              body: JSON.stringify({ campaignId }),
                            })
                            const d = await res.json()
                            if (d.ok) {
                              setCampaign(prev => prev ? { ...prev, autopilotEnabled: true } : prev)
                              setAutopilotQueue(d.posts || [])
                            } else {
                              setAutopilotError(d.error || 'Activation failed')
                            }
                          } catch {
                            setAutopilotError('Network error — please try again')
                          } finally {
                            setAutopilotActivating(false)
                          }
                        }}
                        disabled={autopilotActivating || !aiOutput || weeklyExecutionPlan.length === 0}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40"
                        style={{
                          background: autopilotActivating || !aiOutput || weeklyExecutionPlan.length === 0
                            ? 'rgba(255,255,255,0.05)'
                            : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                          color: autopilotActivating || !aiOutput || weeklyExecutionPlan.length === 0
                            ? '#6b7280' : '#fff',
                          boxShadow: !autopilotActivating && aiOutput && weeklyExecutionPlan.length > 0
                            ? '0 0 24px rgba(139,92,246,0.3)' : 'none',
                        }}>
                        {autopilotActivating
                          ? (locale === 'ar' ? '⏳ جاري التفعيل...' : '⏳ Activating...')
                          : (locale === 'ar' ? '🚀 تفعيل الأوتوبايلوت' : '🚀 Activate Autopilot')}
                      </button>
                    )}
                  </div>

                  {autopilotError && (
                    <p className="text-red-400 text-xs mt-3">⚠ {autopilotError}</p>
                  )}
                  {!aiOutput && (
                    <p className="text-amber-500/70 text-xs mt-3">
                      {locale === 'ar'
                        ? '⚠ يجب تشغيل "الاستراتيجية الكاملة" أولاً لتفعيل الأوتوبايلوت'
                        : '⚠ Run Full Strategy first to enable Autopilot'}
                    </p>
                  )}
                  {aiOutput && weeklyExecutionPlan.length === 0 && (
                    <p className="text-amber-500/70 text-xs mt-3">
                      {locale === 'ar'
                        ? '⚠ خطة التنفيذ الأسبوعية غير موجودة في هذه الاستراتيجية — أعد توليد الاستراتيجية'
                        : '⚠ No weekly execution plan found — regenerate the strategy'}
                    </p>
                  )}
                </div>

                {/* Queue table */}
                {autopilotQueue.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden"
                    style={{ background: 'rgba(12,13,36,0.6)', borderColor: 'rgba(139,92,246,0.15)' }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(139,92,246,0.1)' }}>
                      <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                        <span>📅</span>
                        {locale === 'ar'
                          ? `قائمة الجدولة — ${autopilotQueue.length} منشور`
                          : `Scheduled Queue — ${autopilotQueue.length} posts`}
                      </h4>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'rgba(139,92,246,0.08)' }}>
                      {autopilotQueue.map((post) => {
                        const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                          SCHEDULED:  { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', label: locale === 'ar' ? 'مجدول' : 'Scheduled' },
                          PUBLISHED:  { bg: 'rgba(16,185,129,0.12)', text: '#34d399', label: locale === 'ar' ? 'منشور' : 'Published' },
                          FAILED:     { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', label: locale === 'ar' ? 'فشل' : 'Failed' },
                          DRAFT:      { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', label: locale === 'ar' ? 'موقف' : 'Paused' },
                        }
                        const sc = statusColors[post.status] || statusColors.DRAFT
                        const platformIcons: Record<string, string> = { META: '👥', LINKEDIN: '💼', TIKTOK: '🎵' }

                        return (
                          <div key={post.id} className="flex items-start gap-4 px-5 py-4">
                            {/* Image preview */}
                            <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                              {post.imageUrl ? (
                                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-gray-600 text-lg">🖼</span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {post.weekNumber && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                                    {locale === 'ar' ? `الأسبوع ${post.weekNumber}` : `Week ${post.weekNumber}`}
                                  </span>
                                )}
                                <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>
                                  {platformIcons[post.platform] || '🌐'} {post.pageName || post.platform}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                  style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}30` }}>
                                  {sc.label}
                                </span>
                                {!post.imageUrl && post.status === 'SCHEDULED' && (
                                  <span className="text-xs text-amber-500/60">
                                    {locale === 'ar' ? '⏳ الصورة تُولَّد تلقائياً' : '⏳ Image auto-generating'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 line-clamp-2">{post.caption}</p>
                              {post.scheduledAt && (
                                <p className="text-xs text-gray-600 mt-1">
                                  📅 {new Date(post.scheduledAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state when autopilot is active but queue was just loaded */}
                {campaign.autopilotEnabled && autopilotQueue.length === 0 && (
                  <div className="rounded-2xl p-8 text-center border"
                    style={{ background: 'rgba(12,13,36,0.4)', borderColor: 'rgba(139,92,246,0.1)' }}>
                    <div className="text-3xl mb-3">🤖</div>
                    <p className="text-gray-500 text-sm">
                      {locale === 'ar'
                        ? 'جاري تحميل قائمة المنشورات...'
                        : 'Loading scheduled queue...'}
                    </p>
                    <button
                      onClick={async () => {
                        const token = authHeader()
                        if (!token) return
                        const res = await fetch(`/api/autopilot/queue?campaignId=${campaignId}`, {
                          headers: { Authorization: token },
                        })
                        const d = await res.json()
                        if (d.posts) setAutopilotQueue(d.posts)
                      }}
                      className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition">
                      {locale === 'ar' ? '↻ تحميل' : '↻ Load queue'}
                    </button>
                  </div>
                )}

                {/* How it works */}
                {!campaign.autopilotEnabled && (
                  <div className="rounded-2xl p-5 border"
                    style={{ background: 'rgba(12,13,36,0.4)', borderColor: 'rgba(255,255,255,0.05)' }}>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">
                      {locale === 'ar' ? '⚡ كيف يعمل الأوتوبايلوت' : '⚡ How Autopilot works'}
                    </h4>
                    <div className="space-y-2.5">
                      {(locale === 'ar' ? [
                        { icon: '🧠', label: 'يقرأ خطة التنفيذ الأسبوعية من الاستراتيجية' },
                        { icon: '✍️', label: 'يولد كابشن احترافي لكل منشور بناءً على الرسالة والـ CTA' },
                        { icon: '🎨', label: 'قبل 48 ساعة من الموعد، يولد صورة تلقائياً بـ DALL-E 3' },
                        { icon: '📤', label: 'في الموعد المحدد، ينشر على جميع المنصات المتصلة تلقائياً' },
                      ] : [
                        { icon: '🧠', label: 'Reads the weekly execution plan from your strategy' },
                        { icon: '✍️', label: 'Generates a professional caption for each post based on the key message + CTA' },
                        { icon: '🎨', label: '48h before each post, auto-generates an image with DALL-E 3' },
                        { icon: '📤', label: 'At the scheduled time, publishes to all connected platforms automatically' },
                      ]).map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-sm flex-shrink-0 mt-0.5">{step.icon}</span>
                          <p className="text-xs text-gray-500">{step.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 6: Performance / ROI Dashboard ───────────────────── */}
            {activeTab === 6 && (
              <div className="space-y-4">
                {perfLoading && (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                )}

                {!perfLoading && !perfData && (
                  <div className="rounded-2xl p-8 text-center"
                    style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(6,182,212,0.15)' }}>
                    <div className="text-4xl mb-3">📊</div>
                    <h3 className="font-bold text-white text-base mb-1">No performance data yet</h3>
                    <p className="text-sm text-gray-400">Data appears here after posts are published and analytics are fetched (24-48h after publishing).</p>
                  </div>
                )}

                {!perfLoading && perfData && (() => {
                  const s = perfData.summary
                  const platforms: Record<string, any> = perfData.platformBreakdown ?? {}
                  const topPosts: any[] = perfData.topPosts ?? []
                  const trend: any[] = perfData.trend ?? []

                  const PLATFORM_COLORS: Record<string, string> = {
                    META: '#1877F2', LINKEDIN: '#0A66C2', TIKTOK: '#010101', YOUTUBE: '#FF0000',
                  }
                  const PLATFORM_ICONS: Record<string, string> = {
                    META: '📘', LINKEDIN: '💼', TIKTOK: '🎵', YOUTUBE: '▶️',
                  }

                  return (
                    <>
                      {/* KPI summary row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Total Reach',      value: s.totalReach.toLocaleString(),       icon: '👥', color: '#22d3ee' },
                          { label: 'Impressions',      value: s.totalImpressions.toLocaleString(), icon: '👁',  color: '#a78bfa' },
                          { label: 'Engagements',      value: s.totalEngagements.toLocaleString(), icon: '💬', color: '#34d399' },
                          { label: 'Avg Engagement',   value: `${s.avgEngagementRate}%`,           icon: '📈', color: '#fb923c' },
                        ].map(kpi => (
                          <div key={kpi.label} className="rounded-2xl p-4"
                            style={{ background: 'rgba(10,11,28,0.85)', border: `1px solid ${kpi.color}25` }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-base">{kpi.icon}</span>
                              <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
                            </div>
                            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Posts status row */}
                      <div className="rounded-2xl p-4 flex flex-wrap gap-6"
                        style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          ['Total Posts', s.totalPosts, '#9ca3af'],
                          ['Published',   s.publishedPosts, '#34d399'],
                          ['Scheduled',   s.scheduledPosts, '#a78bfa'],
                          ['Awaiting analytics', s.pendingAnalytics, '#fb923c'],
                        ].map(([label, val, color]) => (
                          <div key={String(label)} className="text-center">
                            <div className="text-xl font-bold" style={{ color: String(color) }}>{val}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                          </div>
                        ))}
                        {s.pendingAnalytics > 0 && (
                          <p className="text-xs text-amber-400/70 ml-auto self-center">
                            Analytics are fetched automatically 24-72h after publishing
                          </p>
                        )}
                      </div>

                      {/* Platform breakdown */}
                      {Object.keys(platforms).length > 0 && (
                        <div className="rounded-2xl p-5"
                          style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <h4 className="font-semibold text-white text-sm mb-4">Platform Breakdown</h4>
                          <div className="space-y-3">
                            {Object.entries(platforms).map(([platform, data]: [string, any]) => {
                              const color = PLATFORM_COLORS[platform] ?? '#6366f1'
                              const icon  = PLATFORM_ICONS[platform]  ?? '📣'
                              const maxReach = Math.max(...Object.values(platforms).map((d: any) => d.reach ?? 0), 1)
                              const barWidth = Math.round((data.reach / maxReach) * 100)
                              return (
                                <div key={platform}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span>{icon}</span>
                                      <span className="text-sm text-white font-medium">{platform}</span>
                                      <span className="text-xs text-gray-500">{data.posts} posts</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-400">
                                      <span>{data.reach?.toLocaleString()} reach</span>
                                      <span className="font-semibold" style={{ color }}>{data.avgEngagementRate}%</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${barWidth}%`, background: color }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Engagement trend */}
                      {trend.length > 1 && (
                        <div className="rounded-2xl p-5"
                          style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <h4 className="font-semibold text-white text-sm mb-4">Engagement Trend</h4>
                          <div className="flex items-end gap-1 h-20">
                            {(() => {
                              const maxEng = Math.max(...trend.map(t => t.engagements), 1)
                              return trend.map((t, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                  <div
                                    className="w-full rounded-sm transition-all duration-500 group-hover:opacity-100"
                                    style={{
                                      height: `${Math.max(4, Math.round((t.engagements / maxEng) * 72))}px`,
                                      background: 'linear-gradient(to top, #22d3ee, #06b6d4)',
                                      opacity: 0.7,
                                    }}
                                    title={`${t.date}: ${t.engagements} engagements`}
                                  />
                                </div>
                              ))
                            })()}
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>{trend[0]?.date?.slice(5)}</span>
                            <span>{trend[trend.length - 1]?.date?.slice(5)}</span>
                          </div>
                        </div>
                      )}

                      {/* Top posts */}
                      {topPosts.length > 0 && (
                        <div className="rounded-2xl p-5"
                          style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <h4 className="font-semibold text-white text-sm mb-4">🏆 Top Performing Posts</h4>
                          <div className="space-y-3">
                            {topPosts.map((post, i) => (
                              <div key={post.id} className="flex gap-3 p-3 rounded-xl"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{
                                    background: i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                                    color: i === 0 ? '#fbbf24' : '#6b7280',
                                    border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                  }}>
                                  {i + 1}
                                </div>
                                {post.imageUrl && (
                                  <img src={post.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-300 line-clamp-2">{post.caption}</p>
                                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                    <span>{PLATFORM_ICONS[String(post.platform)] ?? '📣'} {post.platform}</span>
                                    <span>❤️ {post.likes}</span>
                                    <span>💬 {post.comments}</span>
                                    <span>🔁 {post.shares}</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-base font-bold text-cyan-400">{post.engagementRate}%</div>
                                  <div className="text-xs text-gray-600">engagement</div>
                                  {post.platformUrl && (
                                    <a href={post.platformUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-purple-400 hover:text-purple-300 mt-1 block">
                                      View →
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>

    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      reason={upgradeReason}
    />
  </>
  )
}
