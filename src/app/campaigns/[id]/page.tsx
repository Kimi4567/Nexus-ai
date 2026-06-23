'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import VisualGenerator from '@/components/VisualGenerator'
import SocialPublisher from '@/components/SocialPublisher'
import SocialAnalytics from '@/components/SocialAnalytics'
import AIPresenceBar from '@/components/AIPresenceBar'
import BrandDNABadge, { type BrandDNAData } from '@/components/BrandDNABadge'
import StrategySection from '@/components/StrategySection'
import StrategyActionCard from '@/components/StrategyActionCard'
import CampaignProofOfWork from '@/components/campaign/CampaignProofOfWork'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { getBrandIndicators } from '@/lib/brandIndicators'
import StrategyBrief from '@/components/StrategyBrief'
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

// Suspense wrapper required: useSearchParams() is used inside.
export default function CampaignDetailPage() {
  return (
    <Suspense fallback={null}>
      <CampaignDetailPageInner />
    </Suspense>
  )
}

function CampaignDetailPageInner() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const campaignId = params?.id as string
  const isGenerating = searchParams?.get('generating') === 'true'
  // Capture ?new=1 immediately — router.replace() will strip it later
  const isNewCampaign = searchParams?.get('new') === '1'
  // Capture ?action=generate-plan — from Marketing Brief "Act now" → auto-trigger content plan
  const actionGeneratePlan = searchParams?.get('action') === 'generate-plan'
  // Capture ?from=brief — show a contextual banner
  const fromBrief = searchParams?.get('from') === 'brief' || actionGeneratePlan
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
  const [briefBannerDismissed, setBriefBannerDismissed] = useState(false)
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
        // Restore sentinel state from stored review so we never show stale errors
        // when the user navigates back to a campaign that already passed
        const storedReview = (d.campaign?.aiOutput as any)?.sentinelReview
        if (storedReview?.status === 'passed') setSentinelState('done')

        // Fix 4: Background generation persistence
        // If _generatingAt is set and < 5 minutes old, the engine is still running.
        // Restore the generating UI and start polling so the user sees progress even
        // after navigating away and coming back.
        const generatingAt = (d.campaign?.aiOutput as any)?._generatingAt
        if (generatingAt && !d.campaign?.aiOutput?.strategy) {
          const ageMs = Date.now() - new Date(generatingAt).getTime()
          if (ageMs < 5 * 60 * 1000) { // < 5 minutes = still in-flight
            setGenerating(true)
          }
        }

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

  // Auto-trigger content plan generation when arriving from Marketing Brief
  const briefPlanTriggeredRef = useRef(false)
  useEffect(() => {
    if (!actionGeneratePlan) return
    if (!campaign) return                    // wait for campaign to load
    if (!campaign.aiOutput) return           // strategy must exist first
    if (launchState !== 'idle') return       // already running
    if (briefPlanTriggeredRef.current) return
    if (loading) return
    if (!authHeader()) return
    briefPlanTriggeredRef.current = true
    // Strip the query param to keep URL clean, then trigger
    router.replace(`/campaigns/${campaignId}`, { scroll: false })
    handleApproveAndLaunch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, actionGeneratePlan, launchState, loading])

  // Poll for AI output when generating=true
  // Stops when strategy is populated OR _generatingAt is cleared (done / error) OR max attempts
  useEffect(() => {
    if (!generating || !isAuthenticated) return
    let attempts = 0
    const MAX_ATTEMPTS = 36  // 36 × 5s = 3 minutes max

    pollRef.current = setInterval(async () => {
      attempts++
      const c = await fetchCampaign()
      const strategyDone = !!(c?.aiOutput as any)?.strategy
      const flagGone     = !(c?.aiOutput as any)?._generatingAt
      const timedOut     = attempts >= MAX_ATTEMPTS

      if (strategyDone || flagGone || timedOut) {
        setGenerating(false)
        if (pollRef.current) clearInterval(pollRef.current)
        // If strategy was generated (not just flag cleared by error), navigate to refresh view
        if (strategyDone) {
          router.replace(`/campaigns/${campaignId}`)
        }
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
        setLaunchError(approveData.message || approveData.error || (locale === 'ar' ? 'فشل الاعتماد، حاول مرة أخرى' : 'Approval failed, please try again'))
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
        // Generate content plan — use MIXED so all workspace media gets assigned to posts
        const genRes = await fetch(`/api/campaigns/${campaignId}/generate-content-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ mediaSource: 'MIXED' }),
        })
        const genData = await genRes.json()
        if (!genRes.ok) {
          setApprovalState('idle')
          setLaunchState('idle')
          if (genData.code === 'INSUFFICIENT_CREDITS') {
            setUpgradeReason('no_credits')
            setShowUpgrade(true)
          } else {
            setLaunchError(genData.error ?? (locale === 'ar' ? 'فشل توليد خطة المحتوى' : 'Failed to generate content plan'))
          }
          return
        }
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
  // PR-2B1 — honesty scaffold (server-authoritative confidence/missing-data)
  const assumptions: string[] = (strategy as any).assumptions || []
  const missingDataKeys: string[] = (strategy as any).missingData || []
  const confidenceReport: any = (strategy as any).confidenceReport || null
  const competitorAnalysisComplete: boolean | null =
    typeof (strategy as any).competitorAnalysisComplete === 'boolean' ? (strategy as any).competitorAnalysisComplete : null
  // Localized labels for stable readiness keys (mirrors PR-2A Brand Brain wording).
  const MISSING_KEY_LABELS: Record<string, { en: string; ar: string }> = {
    brandName: { en: 'brand name', ar: 'اسم العلامة' },
    industry: { en: 'industry', ar: 'المجال' },
    description: { en: 'business description', ar: 'وصف النشاط' },
    targetAudience: { en: 'target audience', ar: 'الجمهور المستهدف' },
    topPlatforms: { en: 'platforms', ar: 'المنصات' },
    businessGoal: { en: 'main business goal', ar: 'الهدف التجاري' },
    primaryOffer: { en: 'primary offer', ar: 'العرض الأساسي' },
    audienceLocation: { en: 'location', ar: 'الموقع الجغرافي' },
    uniqueAdvantages: { en: 'differentiator', ar: 'الميزة التنافسية' },
    marketingBudget: { en: 'monthly budget', ar: 'الميزانية الشهرية' },
    conversionDestination: { en: 'conversion destination', ar: 'وجهة التحويل' },
    leadHandling: { en: 'lead handling', ar: 'إدارة العملاء المحتملين' },
    competitors: { en: 'competitors', ar: 'المنافسون' },
    pixel: { en: 'pixel / analytics', ar: 'بكسل / تحليلات' },
  }
  const missingDataLabels: string[] = missingDataKeys.map(k => MISSING_KEY_LABELS[k] ? (locale === 'ar' ? MISSING_KEY_LABELS[k].ar : MISSING_KEY_LABELS[k].en) : k)
  const confLevelLabel = (lvl: string): string => {
    const map: Record<string, { en: string; ar: string }> = {
      high: { en: 'High confidence', ar: 'ثقة عالية' },
      medium: { en: 'Medium confidence', ar: 'ثقة متوسطة' },
      low: { en: 'Low confidence — needs more data', ar: 'ثقة منخفضة — تحتاج بيانات أكثر' },
    }
    return map[lvl] ? (locale === 'ar' ? map[lvl].ar : map[lvl].en) : lvl
  }
  const confLevelColor = (lvl: string): string => (lvl === 'high' ? '#10b981' : lvl === 'medium' ? '#f59e0b' : '#ef4444')
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
      <div className="max-w-[1200px] mx-auto px-6 py-8 page-enter">
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

        {/* What NEXUS did here — Proof of Work (Operator Foundation PR-1C1, read-only) */}
        <CampaignProofOfWork campaignId={campaign.id} campaign={campaign as any} />

        {/* Brief banner — shown when arriving from Marketing Operating Brief */}
        {fromBrief && !briefBannerDismissed && (
          <div className="rounded-2xl overflow-hidden mb-4"
            style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.3)', backdropFilter: 'blur(12px)' }}>
            <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)' }} />
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Sparkles className="w-4 h-4" style={{ color: '#A78BFA' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold mb-0.5" style={{ color: '#C4B5FD' }}>
                    {locale === 'ar' ? 'NEXUS يقترح إنشاء خطة محتوى' : 'NEXUS recommends generating a content plan'}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--nx-text-3)' }}>
                    {locale === 'ar'
                      ? 'الاستراتيجية جاهزة — ابدأ بإنشاء خطة محتوى كاملة الآن لتحريك الحملة.'
                      : 'Strategy is ready — generate a full content plan now to activate this campaign.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBriefBannerDismissed(true)}
                className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:opacity-70"
                style={{ color: 'var(--nx-text-3)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
              {([...]
