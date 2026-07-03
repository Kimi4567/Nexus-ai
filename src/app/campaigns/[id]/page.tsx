'use client'

import { useEffect, useState, useCallback, useRef, Suspense, type ReactNode } from 'react'
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
import CampaignProofOfWork from '@/components/campaign/CampaignProofOfWork'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import UpgradeModal from '@/components/UpgradeModal'
import { useBillingStatus } from '@/lib/useBillingStatus'
import PlatformNativeCard from '@/components/PlatformNativeCard'
import {
  deriveCampaignOperatingState,
  type CampaignOperatingInput,
  type CampaignOperatingStage,
} from '@/lib/campaignOperatingState'
import { derivePublishTabReadinessSummary } from '@/lib/publishReadiness'
import {
  deriveEngineRebuildAvailability,
  ENGINE_REBUILD_CREDIT_COST,
} from '@/lib/campaignDangerActions'
import {
  campaignRoomTabIndexFromQuery,
  campaignRoomTabKeyFromIndex,
} from '@/lib/campaignRoomTabs'
import { summarizeCreativeRequirements } from '@/lib/creativeRequirements'

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
  publishMode?: string | null
  manuallyPublishedAt?: string | null
  pageName?: string | null
}

type CampaignOperatingPost = NonNullable<CampaignOperatingInput['posts']>[number]

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
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
    >
      {copied ? '✓' : label}
    </button>
  )
}

function StrategyDocSection({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>
          )}
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function StrategyDocCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value?: ReactNode
  tone?: 'default' | 'muted' | 'warning' | 'positive'
}) {
  if (!value) return null
  const toneClass = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : tone === 'muted'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-slate-200 bg-slate-50 text-slate-800'
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="mt-1 text-sm leading-6">{value}</div>
    </div>
  )
}

function StrategyDocList({
  items,
  ordered = false,
}: {
  items: ReactNode[]
  ordered?: boolean
}) {
  const clean = items.filter(Boolean)
  if (!clean.length) return null
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className="space-y-2">
      {clean.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
            {ordered ? i + 1 : '•'}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </Tag>
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
  const [campaignPosts, setCampaignPosts] = useState<CampaignOperatingPost[]>([])
  const [operatingSnapshotsLoaded, setOperatingSnapshotsLoaded] = useState(false)
  const [pendingLearningCount, setPendingLearningCount] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [activeTab, setActiveTab] = useState(() => campaignRoomTabIndexFromQuery(searchParams?.get('tab')))
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
  const [showEngineRebuildModal, setShowEngineRebuildModal] = useState(false)
  const [engineRebuildAcknowledged, setEngineRebuildAcknowledged] = useState(false)

  // Unified product agent tabs — indices 0-4 are visible; 5-6 are accessible via Publish tab
  const AGENT_TABS = [
    { name: cdT?.agentStrategyName || 'Strategist', icon: '🧠', title: cdT?.agentStrategyTitle, color: 'text-indigo-400',  border: 'border-indigo-500/30', bg: 'bg-indigo-500/5',  label: cdT?.tabStrategy },
    {
      name: locale === 'ar' ? 'سير عمل المحتوى' : 'Content workflow',
      icon: '✍️',
      title: locale === 'ar' ? 'مسودات وهوكس للمراجعة' : 'Drafts and hooks for review',
      color: 'text-pink-500',
      border: 'border-pink-200',
      bg: 'bg-pink-50',
      label: cdT?.tabContent,
    },
    {
      name: locale === 'ar' ? 'تقويم الحملة' : 'Campaign calendar',
      icon: '⚡',
      title: locale === 'ar' ? 'خطة تنفيذ قابلة للمراجعة' : 'Reviewable execution plan',
      color: 'text-amber-600',
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      label: cdT?.tabCalendar,
    },
    { name: '',                                      icon: '🎨', title: '',                       color: 'text-purple-400',  border: 'border-purple-500/30', bg: 'bg-purple-500/5',  label: cdT?.tabCreative || (locale === 'ar' ? 'الإبداع' : 'Creative') },
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

  useEffect(() => {
    setActiveTab(campaignRoomTabIndexFromQuery(searchParams?.get('tab')))
  }, [searchParams])

  const handleCampaignRoomTabClick = useCallback((index: number) => {
    const tabKey = campaignRoomTabKeyFromIndex(index)
    setActiveTab(index)
    const nextParams = new URLSearchParams(searchParams?.toString())
    nextParams.set('tab', tabKey)
    const query = nextParams.toString()
    router.replace(`/campaigns/${campaignId}${query ? `?${query}` : ''}`, { scroll: false })
  }, [campaignId, router, searchParams])

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

  const fetchOperatingSnapshots = useCallback(async () => {
    const token = authHeader()
    if (!token) {
      setOperatingSnapshotsLoaded(false)
      return
    }

    setOperatingSnapshotsLoaded(false)
    let loadedPosts = false
    try {
      const [contentPlanRes, proposalsRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/content-plan`, { headers: { Authorization: token } }),
        fetch('/api/brain/proposals?status=pending', { headers: { Authorization: token } }),
      ])

      if (contentPlanRes.ok) {
        const data = await contentPlanRes.json().catch(() => ({}))
        setCampaignPosts(Array.isArray(data.posts) ? data.posts : [])
        loadedPosts = true
      }

      if (proposalsRes.ok) {
        const data = await proposalsRes.json().catch(() => ({}))
        const proposals = Array.isArray(data.proposals) ? data.proposals : []
        setPendingLearningCount(proposals.filter((proposal: any) => proposal?.campaignId === campaignId).length)
      }
    } catch {
      // Operating state is display-only. If these optional reads fail, keep the
      // campaign room usable and let the helper fall back conservatively.
    } finally {
      setOperatingSnapshotsLoaded(loadedPosts)
    }
  }, [authHeader, campaignId])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    fetchCampaign().finally(() => setFetching(false))
    fetchOperatingSnapshots()
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
  }, [loading, isAuthenticated, fetchCampaign, fetchOperatingSnapshots, router, authHeader])

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

  const handleRunEngine = async (
    force = false,
    confirmation?: {
      explicitEngineRebuildConfirmed: true
      acknowledgedCreditCost: number
      acknowledgedOutputOverwrite: true
    },
  ) => {
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
        body: JSON.stringify({ language: locale, force, ...(force ? confirmation : {}) }),
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
        if (force) {
          setShowEngineRebuildModal(false)
          setEngineRebuildAcknowledged(false)
        }
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
        ? 'لا يمكن تجهيز الحملة قبل اكتمال فحص الجودة وبناء التقويم.'
        : 'Complete the quality check and build the calendar before preparing the campaign.')
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
            <h2 className="mb-2 text-xl font-bold text-slate-950">{cdT?.notFoundTitle}</h2>
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
  const engineBlocked = sentinelStatus === 'needs_attention'
  const operatingState = deriveCampaignOperatingState({
    campaign: {
      status: campaign.status,
      aiOutput: campaign.aiOutput,
      autopilotEnabled: campaign.autopilotEnabled,
      autopilotActivatedAt: campaign.autopilotActivatedAt,
    },
    posts: campaignPosts,
    pendingLearningCount,
  })
  const operatingLabel = locale === 'ar' ? operatingState.stageLabelAr : operatingState.stageLabel
  const operatingHelper = locale === 'ar' ? operatingState.stageHelperAr : operatingState.stageHelper
  const operatingActionLabel = locale === 'ar'
    ? operatingState.primaryAction.labelAr
    : operatingState.primaryAction.label
  const strategyGuidanceCopy = operatingState.truthFlags.hasContentPlan
    ? {
        hint: locale === 'ar'
          ? '📌 الاستراتيجية أصبحت مادة مرجعية. حالة التنفيذ الحالية موجودة في Content Hub.'
          : '📌 Strategy is reference material. Content Hub shows the current execution state.',
        brief: locale === 'ar'
          ? 'هذه هي الاستراتيجية الغنية الحالية للحملة كمادة مرجعية. راجع الاتجاه والافتراضات والقيود، لكن حالة المنشورات والتنفيذ الحالية موجودة في Content Hub.'
          : 'This is the current rich strategy output for the campaign as reference material. Review the direction, assumptions, and limits, but use Content Hub for the current post and execution state.',
      }
    : {
        hint: locale === 'ar'
          ? '🔍 راجع جودة الاستراتيجية قبل إنشاء أول خطة محتوى.'
          : '🔍 Review strategy quality before building the first content plan.',
        brief: locale === 'ar'
          ? 'هذه هي الاستراتيجية الغنية الحالية للحملة. راجع الاتجاه والافتراضات والقيود قبل إنشاء أول خطة محتوى.'
          : 'This is the current rich strategy output for the campaign. Review the direction, assumptions, and limits before building the first content plan.',
      }
  const operatingTone: Record<CampaignOperatingStage, string> = {
    strategy_missing: 'border-amber-200 bg-amber-50 text-amber-800',
    strategy_review_needed: 'border-blue-200 bg-blue-50 text-blue-700',
    content_plan_missing: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    content_review_needed: 'border-amber-200 bg-amber-50 text-amber-800',
    content_approved_not_scheduled: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    scheduled_manual: 'border-violet-200 bg-violet-50 text-violet-700',
    scheduled_auto: 'border-violet-200 bg-violet-50 text-violet-700',
    auto_publish_enabled: 'border-violet-200 bg-violet-50 text-violet-700',
    published_waiting_for_analytics: 'border-sky-200 bg-sky-50 text-sky-700',
    performance_ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    learning_review_needed: 'border-purple-200 bg-purple-50 text-purple-700',
    paused_or_archived: 'border-slate-200 bg-slate-100 text-slate-600',
  }

  const operatingActionHref = (() => {
    if (operatingState.primaryAction.href === '/content-hub') return `/campaigns/${campaign.id}/content-hub`
    if (operatingState.primaryAction.href === '#autopilot') return `/campaigns/${campaign.id}?tab=autopilot`
    if (operatingState.primaryAction.href === '#performance') return `/campaigns/${campaign.id}?tab=performance`
    if (operatingState.primaryAction.href === '#strategy' || operatingState.primaryAction.href === '#campaign') return `/campaigns/${campaign.id}?tab=strategy`
    return operatingState.primaryAction.href
  })()
  const engineRebuildStatusPending = !operatingSnapshotsLoaded
  const engineRebuildAvailability = deriveEngineRebuildAvailability({
    postStatuses: engineRebuildStatusPending ? ['APPROVED'] : campaignPosts.map(post => post.status),
    explicitEngineRebuildConfirmed: engineRebuildAcknowledged,
    acknowledgedCreditCost: engineRebuildAcknowledged ? ENGINE_REBUILD_CREDIT_COST : undefined,
    acknowledgedOutputOverwrite: engineRebuildAcknowledged,
  })
  const engineRebuildLockedByProgress = engineRebuildAvailability.reason === 'LOCKED_BY_PROGRESS'

  // This page does not fetch platform readiness. Keep Autopilot conservative
  // instead of implying connected publishing accounts from campaign state alone.
  const hasVerifiedPublishingConnection = false
  const autopilotRequirementsMet = Boolean(
    aiOutput &&
    weeklyExecutionPlan.length > 0 &&
    (campaign.status === 'ACTIVE' || approvalState === 'done') &&
    hasVerifiedPublishingConnection,
  )
  const publishTabSummary = derivePublishTabReadinessSummary({
    posts: campaignPosts,
    hasConnectedPublishingAccount: hasVerifiedPublishingConnection,
    hasAutopilotEnabled: campaign.autopilotEnabled,
    hasAnalyticsData: operatingState.truthFlags.hasAnalyticsData,
  })
  const autopilotQueueScheduledCount = autopilotQueue.filter(post => post.status === 'SCHEDULED' && post.scheduledAt).length
  const autopilotQueueManualPublishedCount = autopilotQueue.filter(post =>
    post.status === 'PUBLISHED' &&
    (post.publishMode === 'MANUAL' || Boolean(post.manuallyPublishedAt))
  ).length
  const autopilotQueueHasScheduled = autopilotQueueScheduledCount > 0
  const autopilotQueueHasMixedManualAndScheduled = autopilotQueueManualPublishedCount > 0 && autopilotQueueScheduledCount > 0
  const hasManualOrScheduledWorkflowRecords = operatingState.truthFlags.hasScheduledContent || operatingState.truthFlags.hasManualPublishedContent

  const nextCreativeAction = (() => {
    if (!operatingState.truthFlags.hasStrategy) {
      return {
        title: locale === 'ar' ? 'راجع الاستراتيجية قبل الإنتاج الإبداعي' : 'Review strategy before creative production',
        helper: locale === 'ar'
          ? 'ابدأ من اتجاه الحملة حتى تأتي المخرجات البصرية منسجمة مع الرسالة والجمهور.'
          : 'Start from the campaign direction so creative work follows the message and audience.',
        cta: locale === 'ar' ? 'راجع الاستراتيجية' : 'Review strategy',
        href: `/campaigns/${campaign.id}?tab=strategy`,
      }
    }

    if (operatingState.truthFlags.hasContentPlan && operatingState.counts.pendingGenerationPosts > 0) {
      return {
        title: locale === 'ar' ? 'راجع وسائط المنشورات في مركز المحتوى' : 'Review post media in Content Hub',
        helper: locale === 'ar'
          ? 'Content Hub هو مصدر المراجعة النهائي للمنشورات ووسائطها المرتبطة. راجع الصور أو الأصول الناقصة هناك.'
          : 'Content Hub is the final review surface for posts and their linked media. Review missing images or assets there.',
        cta: locale === 'ar' ? 'راجع وسائط المنشورات' : 'Review post media',
        href: `/campaigns/${campaign.id}/content-hub`,
      }
    }

    if (operatingState.truthFlags.hasContentPlan && operatingState.truthFlags.hasDraftContent) {
      return {
        title: locale === 'ar' ? 'راجع مسودات المحتوى' : 'Review draft posts',
        helper: locale === 'ar'
          ? 'المسودات ومعاينات المنصات تحتاج مراجعة في Content Hub قبل قرارات الجدولة أو النشر.'
          : 'Draft posts and platform previews need Content Hub review before scheduling or publishing decisions.',
        cta: locale === 'ar' ? 'افتح Content Hub' : 'Open Content Hub',
        href: `/campaigns/${campaign.id}/content-hub`,
      }
    }

    if (!creativeBrief) {
      return {
        title: locale === 'ar' ? 'أنشئ موجزاً إبداعياً' : 'Create creative brief',
        helper: locale === 'ar'
          ? 'موجز تخطيطي فقط يحوّل الاستراتيجية إلى احتياجات أصول، اتجاهات مفاهيمية، وملاحظات إنتاج. لا يعتمد أو يجدول أو ينشر شيئاً.'
          : 'A planning artifact that turns strategy into asset needs, concept direction, and production notes. It does not approve, schedule, or publish anything.',
        cta: locale === 'ar' ? 'إنشاء موجز إبداعي' : 'Create creative brief',
        href: `/campaigns/${campaign.id}/creative-brief`,
      }
    }

    return {
      title: locale === 'ar' ? 'راجع المرئيات المفهومية للحملة' : 'Review campaign concept visuals',
      helper: locale === 'ar'
        ? 'المرئيات المفهومية تظل في معرض الحملة للمراجعة فقط. لا تُرفق بالمنشورات أو تُنشر أو تُستخدم في الإعلانات تلقائياً.'
        : 'Concept visuals stay in the campaign gallery for review only. They are not attached to posts, published, or used in ads automatically.',
      cta: locale === 'ar' ? 'راجع المرئيات المفهومية' : 'Review concept visuals',
      href: '#campaign-visual-generator',
    }
  })()

  const progressSteps = ([
    {
      key: 'strategy',
      label: locale === 'ar' ? 'الاستراتيجية' : 'Strategy',
      done: operatingState.truthFlags.hasStrategy,
      active: operatingState.stage === 'strategy_missing' || operatingState.stage === 'strategy_review_needed',
    },
    {
      key: 'content',
      label: locale === 'ar' ? 'خطة المحتوى' : 'Content plan',
      done: operatingState.truthFlags.hasContentPlan,
      active: operatingState.stage === 'content_plan_missing',
    },
    {
      key: 'review',
      label: locale === 'ar' ? 'مراجعة المحتوى' : 'Content review',
      done: !operatingState.truthFlags.hasDraftContent && (
        operatingState.truthFlags.hasApprovedContent ||
        operatingState.truthFlags.hasScheduledContent ||
        operatingState.truthFlags.hasPublishedContent
      ),
      active: operatingState.stage === 'content_review_needed',
    },
    {
      key: 'execution',
      label: locale === 'ar' ? 'التنفيذ' : 'Execution',
      done: operatingState.truthFlags.hasPublishedContent,
      active: operatingState.truthFlags.hasScheduledContent || operatingState.stage === 'content_approved_not_scheduled',
    },
  ] as Array<{ key: string; label: string; done: boolean; active?: boolean }>)

  const visualContext = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignGoal: campaign.goal,
    campaignTone: campaign.tone,
    audience: campaign.audience,
  }
  const totalPostMediaSlots = operatingState.counts.totalPosts
  const pendingPostMediaSlots = operatingState.counts.pendingGenerationPosts
  const readyPostMediaSlots = Math.max(0, totalPostMediaSlots - pendingPostMediaSlots)
  const creativeRequirementsSummary = summarizeCreativeRequirements(
    campaignPosts.map((post: any) => ({
      postId: post.id,
      platform: post.platform,
      caption: post.caption,
      status: post.status,
      imageUrl: post.imageUrl,
      uploadedMediaId: post.uploadedMediaId,
      mediaSource: post.mediaSource,
      generationStatus: post.generationStatus,
      isVideoPost: post.isVideoPost,
      campaignGoal: campaign.goal,
      campaignName: campaign.name,
      brandName: brandDNA?.brandName,
    })),
  )

  // ── Empty section component ──────────────────────────────────────────────
  function EmptySection({ icon, message }: { icon: string; message: string }) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-3xl mb-3">{icon}</div>
        <p className="text-sm text-slate-500">{message}</p>
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
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/dashboard" className="transition hover:text-slate-950">{cdT?.breadcrumbHome}</Link>
          <span>/</span>
          <Link href="/campaigns" className="transition hover:text-slate-950">{cdT?.breadcrumbCampaigns}</Link>
          <span>/</span>
          <span className="max-w-xs truncate text-slate-800">{campaign.name}</span>
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
                className="flex-shrink-0 px-1 text-xs text-slate-400 transition-all hover:text-slate-700">
                ✕
              </button>
            </div>
          )
        })()}

        {/* FL4: Content-plan banner — shown when stored content-plan posts exist. */}
        {operatingState.truthFlags.hasContentPlan && (() => {
          const postCount = operatingState.counts.totalPosts
          return (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-green-400 text-sm flex-shrink-0">✅</span>
                <p className="text-xs" style={{ color: 'rgba(74,222,128,0.85)' }}>
                  {locale === 'ar'
                    ? `${postCount} عنصر محتوى في الخطة — راجع الحالة في Content Hub`
                    : `${postCount} content item${postCount !== 1 ? 's' : ''} in the plan — review status in Content Hub`}
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
                      ? 'الاستراتيجية جاهزة — ابدأ بإنشاء خطة محتوى كاملة عند استعدادك للمراجعة.'
                      : 'Strategy is ready — generate a full content plan when you are ready to review it.'}
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

        {/* Header card — light campaign summary */}
        <div className="mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="h-px bg-gradient-to-r from-indigo-200 via-sky-100 to-emerald-100" />
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #eef2ff, #f8fafc)', border: '1px solid rgb(226,232,240)' }}>
                  {campaign.thumbnail || '🎯'}
                </div>
                <div>
                  <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-950">{campaign.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="capitalize">{campaign.goal?.toLowerCase()}</span>
                    <span className="text-slate-300">·</span>
                    <span>{locale === 'ar' ? 'نبرة: ' : 'Tone: '}{campaign.tone}</span>
                    <span className="text-slate-300">·</span>
                    <span>{cdT?.createdLabel?.replace('{timeAgo}', timeAgo(campaign.createdAt) ?? '')}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {campaign.platforms.map(p => (
                      <span key={p} className="text-base" title={p}>{PLATFORM_ICONS[p] || '🌐'}</span>
                    ))}
                  </div>
                  {campaign.audience && (
                    <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{cdT?.audienceLabel}: {campaign.audience}</p>
                  )}
                  {/* Campaign operating state badge */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${operatingTone[operatingState.stage]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {operatingLabel}
                    </span>
                    <span className="text-xs text-slate-400">
                      {operatingHelper}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions — primary CTA + overflow menu */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/campaigns/new"
                  className="px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap"
                  style={{ background: '#4f46e5', color: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.12)' }}
                >
                  {cdT?.btnNewCampaign || '+ New Campaign'}
                </Link>
                {/* Overflow menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowHeaderMenu(v => !v)}
                    className="px-3 py-2 rounded-xl text-sm font-bold transition"
                    style={{ background: '#f8fafc', border: '1px solid rgb(226,232,240)', color: '#475569' }}
                    title={locale === 'ar' ? 'المزيد' : 'More options'}
                  >
                    ···
                  </button>
                  {showHeaderMenu && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setShowHeaderMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded-xl shadow-2xl overflow-hidden"
                        style={{ background: '#fff', border: '1px solid rgb(226,232,240)' }}>
                        <button
                          onClick={() => { updateCampaign({ favorite: !campaign.favorite }); setShowHeaderMenu(false) }}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: campaign.favorite ? '#ca8a04' : '#334155' }}
                        >
                          {campaign.favorite ? `★ ${cdT?.btnSaved || 'Saved'}` : `☆ ${cdT?.btnSave || 'Save'}`}
                        </button>
                        <button
                          onClick={() => { duplicate(); setShowHeaderMenu(false) }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: '#334155' }}
                        >
                          {`⧉ ${cdT?.btnDuplicate || 'Duplicate'}`}
                        </button>
                        <button
                          onClick={() => window.open(`/campaigns/${campaign.id}/print`, '_blank')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: '#334155' }}
                        >
                          {`⬇ ${cdT?.btnExportPdf || 'Export PDF'}`}
                        </button>
                        <div className="h-px mx-3 bg-slate-100" />
                        <button
                          onClick={() => { updateCampaign({ status: campaign.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED' }); setShowHeaderMenu(false) }}
                          disabled={saving}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition hover:bg-slate-50"
                          style={{ color: campaign.status === 'ARCHIVED' ? '#4f46e5' : '#64748b' }}
                        >
                          {campaign.status === 'ARCHIVED' ? `↩ ${cdT?.btnRestore || 'Restore'}` : `📦 ${cdT?.btnArchive || 'Archive'}`}
                        </button>
                        <div className="h-px mx-3 bg-slate-100" />
                        <div className="px-4 py-3 text-left">
                          <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                            {locale === 'ar' ? 'إجراء حساس' : 'Dangerous action'}
                          </p>
                          {engineRebuildStatusPending ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {locale === 'ar'
                                ? 'يتم التحقق من حالة المنشورات قبل إتاحة أي إعادة بناء مدفوعة.'
                                : 'Checking post status before any credit-spending rebuild can be available.'}
                            </p>
                          ) : engineRebuildLockedByProgress ? (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {locale === 'ar'
                                ? 'إعادة البناء مقفلة لأن هذه الحملة لديها منشورات معتمدة أو مجدولة أو منشورة. يلزم مسار خطة مسودة جديدة قبل إعادة توليد مخرجات الحملة.'
                                : 'Rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan flow is required before regenerating campaign outputs.'}
                            </p>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setShowHeaderMenu(false)
                                  setEngineRebuildAcknowledged(false)
                                  setShowEngineRebuildModal(true)
                                }}
                                disabled={engineRunning}
                                className="mt-2 w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                              >
                                {locale === 'ar' ? 'إعادة بناء حزمة الحملة' : 'Rebuild campaign package'}
                              </button>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {locale === 'ar'
                                  ? `يكلف ${ENGINE_REBUILD_CREDIT_COST} كريديت ويستبدل مخرجات استراتيجية/حزمة الحملة. لا ينشر أو يجدول أو يحدّث المنشورات الحالية.`
                                  : `Costs ${ENGINE_REBUILD_CREDIT_COST} credits and overwrites campaign strategy/package output. Does not publish, schedule, or update existing SocialPosts.`}
                              </p>
                            </>
                          )}
                        </div>
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
          <div className="mb-6 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">

            {/* ── 4-step progress stepper ── */}
            <div className="flex items-center gap-0 mb-5 overflow-x-auto pb-1 flex-nowrap">
              {progressSteps.map((step, i, arr) => (
                <div key={step.key} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    step.done ? 'text-emerald-700' : step.active ? 'text-indigo-700' : 'text-slate-500'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border ${
                      step.done
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : step.active
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      {step.done ? '✓' : i + 1}
                    </span>
                    {step.label}
                  </div>
                  {i < arr.length - 1 && (
                    <span className="mx-1 flex-shrink-0 text-xs text-slate-300">—</span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Status message + context-aware primary CTA ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${engineRunning ? 'text-amber-700' : 'text-slate-950'}`}>
                  {engineRunning
                    ? (locale === 'ar' ? '⏳ يجري إعداد المخرجات...' : '⏳ Preparing campaign outputs...')
                    : operatingLabel}
                </p>
                {!engineRunning && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{operatingHelper}</p>
                )}
                {(engineError || generateError) && (
                  <p className="text-xs text-red-400 mt-1">{engineError || generateError}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Primary CTA — context aware, one at a time */}
                {activeTab !== 0 && !engineRunning && operatingState.stage === 'strategy_review_needed' && (
                  <button
                    onClick={handleSentinelReview}
                    disabled={sentinelState === 'reviewing'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                    style={{ background: '#2563eb', color: '#fff' }}
                  >
                    {sentinelState === 'reviewing'
                      ? '⏳...'
                      : sentinelStatus === 'needs_attention'
                        ? (locale === 'ar' ? '🔄 أعد المراجعة' : '🔄 Re-review')
                        : (locale === 'ar' ? '🔍 فحص الجودة' : '🔍 Review quality')}
                  </button>
                )}

                {activeTab !== 0 && !engineRunning && sentinelStatus === 'passed' && operatingState.stage === 'content_plan_missing' && (
                  <button
                    onClick={handleApproveAndLaunch}
                    disabled={approvalState === 'approving' || launchState === 'approving' || launchState === 'generating'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                    style={{ background: '#059669', color: '#fff' }}
                  >
                    {launchState === 'approving'
                      ? (locale === 'ar' ? '⏳ يجري إعداد المحتوى...' : '⏳ Preparing content...')
                      : launchState === 'generating'
                        ? (locale === 'ar' ? '⚙️ جارٍ إنشاء الخطة...' : '⚙️ Generating plan...')
                        : (locale === 'ar' ? 'إنشاء خطة المحتوى' : 'Build content plan')}
                  </button>
                )}

                {activeTab !== 0 && operatingState.truthFlags.hasContentPlan && (
                  <Link
                    href={operatingActionHref}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={{ background: '#4f46e5', color: '#fff' }}
                  >
                    {operatingActionLabel}
                  </Link>
                )}

                {engineRunning && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-500">
                    <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
                    {locale === 'ar' ? 'جاري التشغيل...' : 'Running...'}
                  </div>
                )}
              </div>
            </div>

            {/* ── Quality review detail — collapsible ── */}
            {sentinelReview && (
              <details className="mt-4">
                <summary className={`cursor-pointer text-xs font-semibold select-none ${
                  sentinelStatus === 'passed' ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {sentinelStatus === 'passed'
                    ? (locale === 'ar' ? '✓ فحص الجودة مكتمل — عرض التفاصيل ▾' : '✓ Quality check complete — see details ▾')
                    : (locale === 'ar' ? '⚠ فحص الجودة يحتاج انتباه — عرض التفاصيل ▾' : '⚠ Quality check needs attention — see details ▾')}
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500">{cdT?.sentinelRiskScore || 'Risk Score'}</span>
                        <span className={`text-sm font-bold ${sentinelReview.riskScore < 30 ? 'text-green-400' : sentinelReview.riskScore < 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {sentinelReview.riskScore}/100
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${sentinelReview.riskScore < 30 ? 'bg-green-500' : sentinelReview.riskScore < 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sentinelReview.riskScore}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{cdT?.sentinelRiskLow || 'Lower is better'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500">{cdT?.sentinelBrandScore || 'Brand Match'}</span>
                        <span className={`text-sm font-bold ${sentinelReview.brandConsistencyScore >= 75 ? 'text-green-400' : sentinelReview.brandConsistencyScore >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                          {sentinelReview.brandConsistencyScore}/100
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${sentinelReview.brandConsistencyScore >= 75 ? 'bg-green-500' : sentinelReview.brandConsistencyScore >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sentinelReview.brandConsistencyScore}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{cdT?.sentinelBrandHigh || 'Higher is better'}</p>
                    </div>
                  </div>
                  {sentinelReview.summary && (
                    <p className="text-sm leading-relaxed text-slate-600">{sentinelReview.summary}</p>
                  )}
                  {sentinelReview.complianceWarnings?.length > 0 && (
                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                      <p className="text-xs font-bold text-amber-400 mb-2">{cdT?.sentinelComplianceWarnings || 'Compliance Warnings'}</p>
                      {sentinelReview.complianceWarnings.map((w: string, i: number) => (
                        <p key={i} className="mb-1 flex items-start gap-2 text-xs text-amber-700"><span className="flex-shrink-0">⚠</span>{w}</p>
                      ))}
                    </div>
                  )}
                  {sentinelReview.recommendedFixes?.length > 0 && (
                    <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <p className="text-xs font-bold text-blue-400 mb-2">{cdT?.sentinelRecommendedFixes || 'Recommended Fixes'}</p>
                      {sentinelReview.recommendedFixes.map((fix: string, i: number) => (
                        <p key={i} className="mb-1 flex items-start gap-2 text-xs text-blue-700"><span className="flex-shrink-0 text-blue-500">→</span>{fix}</p>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Not yet reviewed hint */}
            {!sentinelReview && sentinelState !== 'reviewing' && (
              <p className="mt-3 text-xs text-gray-600">
                {strategyGuidanceCopy.hint}
              </p>
            )}
            {sentinelState === 'reviewing' && (
              <div className="mt-3 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-xs text-blue-600">{locale === 'ar' ? 'يجري فحص جودة الحملة...' : 'Reviewing campaign quality...'}</p>
              </div>
            )}
            {sentinelError && sentinelState === 'idle' && (
              <p className="mt-2 text-xs text-red-400">⚠️ {sentinelError}</p>
            )}

            {/* Content planning confirmation dialog */}
            {approvalState === 'confirming' && (
              <div className="mt-4 p-4 bg-green-500/5 border border-green-500/25 rounded-xl">
                {/* ── Idle: confirm prompt ── */}
                {launchState === 'idle' && (
                  <>
                    <p className="text-sm font-semibold text-green-700 mb-1">
                      {locale === 'ar' ? 'هل أنت جاهز لإنشاء خطة المحتوى؟' : 'Ready to build the content plan?'}
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                      {locale === 'ar'
                        ? 'سيتم إنشاء خطة محتوى كاملة ثم انتقالك إلى Content Hub للمراجعة. لا يتم نشر شيء من هنا.'
                        : 'This will generate the full content plan and take you to Content Hub for review. Nothing publishes from here.'}
                    </p>
                    {launchError && (
                      <p className="text-xs text-red-400 mb-2">⚠️ {launchError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleApproveAndLaunch}
                        className="px-4 py-2 bg-green-500 text-xs font-bold rounded-xl hover:bg-green-600 transition"
                        style={{ color: '#fff' }}
                      >
                        {locale === 'ar' ? 'نعم، إنشاء خطة المحتوى' : 'Yes, build content plan'}
                      </button>
                      <button
                        onClick={() => setApprovalState('idle')}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                      >
                        {cdT?.approveCancelBtn || 'Cancel'}
                      </button>
                    </div>
                  </>
                )}

                {/* ── In-progress: step tracker ── */}
                {(launchState === 'approving' || launchState === 'generating') && (
                  <div>
                    <p className="text-sm font-semibold text-green-700 mb-3">
                      {locale === 'ar' ? '⏳ يجري إعداد خطة المحتوى...' : '⏳ Preparing the content plan...'}
                    </p>
                    <div className="space-y-2">
                      {/* Step 1 */}
                      <div className="flex items-center gap-3">
                        {launchState === 'approving' ? (
                          <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        ) : (
                          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-green-400 font-bold text-xs">✓</span>
                        )}
                        <p className={`text-xs ${launchState === 'approving' ? 'text-green-400 font-semibold' : 'text-gray-500'}`}>
                          {locale === 'ar' ? 'تجهيز الحملة لتخطيط المحتوى' : 'Preparing campaign for content planning'}
                        </p>
                      </div>
                      {/* Step 2 */}
                      <div className="flex items-center gap-3">
                        {launchState === 'generating' ? (
                          <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        ) : (
                          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-600 text-xs">○</span>
                        )}
                        <p className={`text-xs ${launchState === 'generating' ? 'text-green-400 font-semibold' : 'text-gray-600'}`}>
                          {locale === 'ar' ? 'إنشاء خطة المحتوى (قد يستغرق 20-30 ثانية)' : 'Generating content plan (may take 20-30s)'}
                        </p>
                      </div>
                      {/* Step 3 */}
                      <div className="flex items-center gap-3">
                        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-gray-600 text-xs">○</span>
                        <p className="text-xs text-gray-600">
                          {locale === 'ar' ? 'الانتقال إلى Content Hub' : 'Redirecting to Content Hub'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generating state */}
        {!aiOutput && generating && (
          <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 p-12 text-center shadow-sm">
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-xl font-bold mb-2 text-amber-900">{cdT?.generatingTitle}</h3>
            <p className="mb-6 text-sm text-amber-800">{cdT?.generatingSubtitle}</p>
            <div className="flex justify-center gap-4 mb-4 flex-wrap">
              {([cdT?.genStep1, cdT?.genStep2, cdT?.genStep3, cdT?.genStep4]).map((step, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500/50 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  {step}
                </div>
              ))}
            </div>
            <div className="w-48 h-1 bg-amber-100 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* No AI output state (not generating) — NEXUS UI */}
        {!aiOutput && !generating && (
          <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <span className="text-3xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-slate-950">{cdT?.noOutputTitle}</h3>
            <p className="mb-6 text-sm text-slate-500">{cdT?.noOutputDesc}</p>
            <button
              onClick={() => handleRunEngine()}
              disabled={engineRunning}
              className="px-6 py-3 rounded-xl font-bold transition disabled:opacity-60"
              style={{ background: '#4f46e5', color: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.12)' }}>
              {engineRunning
                ? (locale === 'ar' ? '⏳ جاري التوليد...' : '⏳ Generating...')
                : (cdT?.noOutputBtn || (locale === 'ar' ? 'توليد الاستراتيجية الكاملة' : 'Generate Full Strategy'))}
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
            <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1 pb-1">
              {AGENT_TABS.map((tab, i) => tab.hidden ? null : (
                <button
                  key={i}
                  onClick={() => handleCampaignRoomTabClick(i)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                  style={activeTab === i ? {
                    background: '#fff',
                    border: '1px solid rgb(199,210,254)',
                    color: '#3730a3',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                  } : {
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: '#64748b',
                  }}
                  onMouseEnter={e => {
                    if (activeTab !== i) (e.currentTarget as HTMLButtonElement).style.color = '#334155'
                  }}
                  onMouseLeave={e => {
                    if (activeTab !== i) (e.currentTarget as HTMLButtonElement).style.color = '#64748b'
                  }}
                >
                  <span className="text-xs">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab 0: Strategy (Strategist) ─────────────────────────────── */}
            {activeTab === 0 && (
              <div className="space-y-5">
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                          {locale === 'ar' ? 'مبني على Brand Brain' : 'Generated from Brand Brain'}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                          {locale === 'ar' ? 'موجز استراتيجية' : 'Strategy brief'}
                        </span>
                      </div>
                      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        {campaign.name}
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                        {strategyGuidanceCopy.brief}
                      </p>
                      <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'ملاحظات الحملة المحفوظة للمراجعة. مركز المحتوى يعرض الحالة الحالية للمنشورات.'
                          : 'Saved campaign notes are for review. Content Hub shows the current post-ready state.'}
                      </p>
                      <p className="mt-3 text-xs text-slate-400">
                        {locale === 'ar' ? 'آخر تحديث' : 'Last updated'}: {new Date(campaign.updatedAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Link
                        href={`/campaigns/${campaignId}/content-hub`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-800"
                        style={{ color: '#fff' }}
                      >
                        {hasContentCalendar
                          ? (locale === 'ar' ? 'المتابعة إلى مركز المحتوى' : 'Continue to Content Hub')
                          : (locale === 'ar' ? 'فتح مركز المحتوى' : 'Open Content Hub')}
                      </Link>
                      <Link
                        href="/strategy"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {locale === 'ar' ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
                      </Link>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <StrategyDocCard
                    label={locale === 'ar' ? 'المصدر' : 'Source'}
                    value={locale === 'ar' ? 'Brand Brain وبيانات الحملة' : 'Brand Brain and campaign inputs'}
                  />
                  <StrategyDocCard
                    label={locale === 'ar' ? 'الخطة العضوية' : 'Organic plan'}
                    value={hasContentCalendar
                      ? (locale === 'ar' ? 'متاحة للمراجعة في مركز المحتوى' : 'Available for review in Content Hub')
                      : (locale === 'ar' ? 'جاهزة للتخطيط' : 'Ready for content planning')}
                    tone="positive"
                  />
                  <StrategyDocCard
                    label={locale === 'ar' ? 'الإعلانات المدفوعة' : 'Paid planning'}
                    value={locale === 'ar' ? 'تخطيط فقط — لا صرف بدون موافقة صريحة' : 'Planning-only — no spend without explicit approval'}
                    tone="warning"
                  />
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StrategyDocCard
                      label={locale === 'ar' ? 'التحليلات' : 'Analytics'}
                      value={confidenceReport?.byCapability?.measurement === 'high'
                        ? (locale === 'ar' ? 'بيانات متاحة جزئياً' : 'Partial data available')
                        : (locale === 'ar' ? 'تحتاج خط أساس' : 'Baseline needed')}
                      tone="muted"
                    />
                    <StrategyDocCard
                      label={locale === 'ar' ? 'النشر' : 'Publishing'}
                      value={locale === 'ar' ? 'غير مفعّل من هذه الاستراتيجية' : 'Not enabled from this strategy'}
                      tone="muted"
                    />
                    <StrategyDocCard
                      label={locale === 'ar' ? 'حدود التنفيذ' : 'Execution limits'}
                      value={locale === 'ar' ? 'لا إعلانات ولا نشر بدون مراجعة صريحة' : 'No ads or publishing without explicit review'}
                      tone="muted"
                    />
                  </div>
                </div>

                {(strategy.diagnosis || strategy.keyMessage || strategy.positioning || strategy.differentiation || strategy.targetAudienceRefined || weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
                  <StrategyDocSection
                    eyebrow="01"
                    title={locale === 'ar' ? 'الاستراتيجية التنفيذية' : 'Executive Strategy'}
                    description={locale === 'ar'
                      ? 'الاتجاه الأساسي، لماذا يناسب العلامة، وما يجب التركيز عليه أولاً.'
                      : 'The core direction, why it fits the brand, and what to focus on first.'}
                  >
                    <div className="space-y-4">
                      {strategy.keyMessage && (
                        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500">
                            {cdT?.sectionKeyMessage || 'Key Message'}
                          </p>
                          <p className="mt-2 text-xl font-semibold leading-8 text-slate-950">"{strategy.keyMessage}"</p>
                          <div className="mt-3">
                            <CopyBtn text={strategy.keyMessage} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <StrategyDocCard label={cdT?.sectionPositioning || 'Positioning'} value={strategy.positioning} />
                        <StrategyDocCard label={cdT?.sectionDifferentiation || 'Differentiation'} value={strategy.differentiation} />
                      </div>
                      {strategy.nextBestAction && (
                        <StrategyDocCard
                          label={locale === 'ar' ? 'الخطوة التالية المقترحة' : 'Suggested next step'}
                          value={strategy.nextBestAction}
                          tone="muted"
                        />
                      )}
                    </div>
                  </StrategyDocSection>
                )}

                {(strategy.diagnosis || diagnosisDetails) && (
                  <StrategyDocSection
                    eyebrow="02"
                    title={cdT?.sectionDiagnosis || 'Marketing Diagnosis'}
                    description={strategy.diagnosis}
                  >
                    {diagnosisDetails && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <StrategyDocCard label={cdT?.diagStage || 'Business stage'} value={diagnosisDetails.stage} />
                        <StrategyDocCard label={cdT?.diagBottleneck || 'Main bottleneck'} value={diagnosisDetails.bottleneck} />
                        <StrategyDocCard label={cdT?.diagTrustGap || 'Trust gap'} value={diagnosisDetails.trustGap} tone="warning" />
                        <StrategyDocCard label={cdT?.diagRisk || 'Main risk'} value={diagnosisDetails.mainRisk} tone="warning" />
                        <StrategyDocCard
                          label={locale === 'ar' ? 'جاهزية التخطيط المدفوع' : 'Paid planning status'}
                          value={diagnosisDetails.readyForPaidAds
                            ? (locale === 'ar' ? 'يمكن إعداد خطة للمراجعة' : 'Can prepare a plan for review')
                            : (locale === 'ar' ? 'يحتاج إعداداً قبل الصرف' : 'Needs setup before any spend')}
                          tone="warning"
                        />
                        <StrategyDocCard label={locale === 'ar' ? 'السبب' : 'Reason'} value={diagnosisDetails.readyForPaidAdsReason} />
                      </div>
                    )}
                  </StrategyDocSection>
                )}

                {businessObjective && (
                  <StrategyDocSection eyebrow="03" title={cdT?.sectionBusinessObjective || 'Business Objective'}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        { label: cdT?.businessObjPrimary || 'Business objective', value: businessObjective.primary },
                        { label: cdT?.businessObjMarketing || 'Marketing objective', value: businessObjective.marketing },
                        { label: cdT?.businessObjConversion || 'Conversion action', value: businessObjective.conversionAction },
                        { label: cdT?.businessObjAction || 'Expected user action', value: businessObjective.expectedUserAction },
                        { label: cdT?.businessObjWhyNow || 'Why now', value: businessObjective.whyNow },
                        { label: cdT?.businessObjSuccess30 || 'Success definition', value: businessObjective.successIn30Days },
                      ].map((item, i) => (
                        <StrategyDocCard key={i} label={item.label} value={item.value} />
                      ))}
                    </div>
                  </StrategyDocSection>
                )}

                {(audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0) && (
                  <StrategyDocSection eyebrow="04" title={cdT?.sectionAudienceSegmentsDetailed || cdT?.sectionAudienceSegments || 'Audience Segments'}>
                    {audienceSegmentsDetailed.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {audienceSegmentsDetailed.map((seg: any, i: number) => (
                          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-950">{i + 1}. {seg.segment}</p>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700">
                              <StrategyDocCard label="Situation" value={seg.situation} />
                              <StrategyDocCard label="Pain" value={seg.pain} tone="warning" />
                              <StrategyDocCard label="Want" value={seg.desiredOutcome} tone="positive" />
                              <StrategyDocCard label="Objection" value={seg.objection} tone="warning" />
                              <StrategyDocCard label="Message" value={seg.message} />
                              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                {seg.platform && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{seg.platform}</span>}
                                {seg.format && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{seg.format}</span>}
                                {seg.cta && <span className="rounded-full bg-white px-2 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">{seg.cta}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <StrategyDocList ordered items={audienceSegments.map((seg: string) => seg)} />
                    )}
                  </StrategyDocSection>
                )}

                {(strategy.valueProps?.length > 0 || strategy.valuePropositions?.length > 0 || strategy.estimatedResults || topHooks.length > 0 || ctaVariations.length > 0 || strategy.contentPillars?.length > 0 || contentAngles.length > 0 || contentAnglesDetailed.length > 0) && (
                  <StrategyDocSection
                    eyebrow="05"
                    title={locale === 'ar' ? 'خطة المحتوى العضوي' : 'Organic Content Plan'}
                    description={locale === 'ar'
                      ? 'الرسائل والركائز والخطافات التي تحوّل الاستراتيجية إلى محتوى قابل للمراجعة.'
                      : 'The messages, pillars, hooks, and angles that turn the strategy into reviewable content.'}
                  >
                    <div className="space-y-5">
                      {strategy.contentPillars?.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionContentPillars || 'Content Pillars'}</p>
                          <div className="flex flex-wrap gap-2">
                            {strategy.contentPillars.map((p: string, i: number) => (
                              <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(strategy.valueProps?.length > 0 || strategy.valuePropositions?.length > 0 || strategy.estimatedResults) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionValueProps || 'Value Propositions'}</p>
                          {(strategy.valueProps?.length > 0 || strategy.valuePropositions?.length > 0) ? (
                            <StrategyDocList items={(strategy.valueProps || strategy.valuePropositions).map((vp: string) => vp)} />
                          ) : (
                            <p className="text-sm leading-6 text-slate-700">{strategy.estimatedResults}</p>
                          )}
                        </div>
                      )}
                      {topHooks.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionTopHooks || 'Top Hooks'}</p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {topHooks.slice(0, 8).map((hook: string, i: number) => (
                              <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <span className="text-xs font-bold text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                                <p className="flex-1 text-sm leading-6 text-slate-700">{hook}</p>
                                <CopyBtn text={hook} label={cdT?.copyBtn || 'Copy'} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ctaVariations.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionCtaVariations || 'CTAs'}</p>
                          <div className="flex flex-wrap gap-2">
                            {ctaVariations.map((cta: string, i: number) => (
                              <span key={i} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">{cta}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(contentAnglesDetailed.length > 0 || contentAngles.length > 0) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionContentAnglesDetailed || cdT?.sectionContentAngles || 'Content Angles'}</p>
                          {contentAnglesDetailed.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {contentAnglesDetailed.map((angle: any, i: number) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-sm font-semibold text-slate-950">{angle.title || `${locale === 'ar' ? 'زاوية' : 'Angle'} ${i + 1}`}</p>
                                  {angle.hook && <p className="mt-2 text-sm leading-6 text-slate-700">"{angle.hook}"</p>}
                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                    {angle.pain && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{angle.pain}</span>}
                                    {angle.format && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{angle.format}</span>}
                                    {angle.platform && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{angle.platform}</span>}
                                    {angle.cta && <span className="rounded-full bg-white px-2 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">{angle.cta}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <StrategyDocList items={contentAngles.map((angle: string) => angle)} />
                          )}
                        </div>
                      )}
                    </div>
                  </StrategyDocSection>
                )}

                {(funnelStages.length > 0 || strategy.funnelStrategy || strategy.channelMix?.length > 0 || channelStrategy.length > 0 || strategy.offerCTAStrategy || strategy.visualDirection || weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
                  <StrategyDocSection eyebrow="06" title={cdT?.chapterExecution || 'Execution Plan'}>
                    <div className="space-y-5">
                      {(funnelStages.length > 0 || strategy.funnelStrategy) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionFunnelStages || cdT?.sectionFunnelStrategy || 'Funnel stages'}</p>
                          {funnelStages.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {funnelStages.map((stage: any, i: number) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-sm font-semibold capitalize text-slate-950">{stage.stage || `${locale === 'ar' ? 'مرحلة' : 'Stage'} ${i + 1}`}</p>
                                  <div className="mt-3 grid gap-2">
                                    <StrategyDocCard label={cdT?.funnelMindset || 'Mindset'} value={stage.userMindset} />
                                    <StrategyDocCard label="Message" value={stage.message} />
                                    <StrategyDocCard label="Format" value={stage.contentType} />
                                    <StrategyDocCard label="Platform" value={stage.platform} />
                                    <StrategyDocCard label="CTA" value={stage.cta} />
                                    <StrategyDocCard label={cdT?.weekSuccessMetric || 'Metric'} value={stage.successMetric} tone="muted" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {Object.entries(strategy.funnelStrategy || {}).map(([key, value]) => (
                                value ? <StrategyDocCard key={key} label={key} value={String(value)} /> : null
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {(strategy.channelMix?.length > 0 || channelStrategy.length > 0) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionChannelMix || cdT?.sectionChannelStrategy || 'Channel Strategy'}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {(channelStrategy.length > 0 ? channelStrategy : strategy.channelMix).map((ch: any, i: number) => (
                              <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-semibold capitalize text-slate-950">{ch.platform}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">{ch.role || ch.rationale || ch.postingApproach}</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                  {ch.contentType && <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{ch.contentType}</span>}
                                  {ch.cta && <span className="rounded-full bg-white px-2 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">{ch.cta}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {strategy.offerCTAStrategy && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionOfferCTA || 'Offer & CTA'}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {[
                              { label: cdT?.ctaPrimary || 'Primary CTA', value: strategy.offerCTAStrategy.primaryCTA },
                              { label: cdT?.ctaSecondary || 'Secondary CTA', value: strategy.offerCTAStrategy.secondaryCTA },
                              { label: cdT?.ctaLeadMagnet || 'Lead magnet', value: strategy.offerCTAStrategy.leadMagnet },
                              { label: cdT?.ctaBetaOffer || 'Beta offer', value: strategy.offerCTAStrategy.betaOffer },
                              { label: cdT?.ctaContactFlow || 'Contact flow', value: strategy.offerCTAStrategy.contactFlow },
                            ].map((item, i) => (
                              <StrategyDocCard key={i} label={item.label} value={item.value} />
                            ))}
                          </div>
                        </div>
                      )}
                      {strategy.visualDirection && (
                        <StrategyDocCard label={cdT?.sectionVisualDirection || 'Visual Direction'} value={strategy.visualDirection} />
                      )}
                      {(weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionWeeklyPlan || '30-Day Execution Plan'}</p>
                          <div className="space-y-3">
                            {(weeklyExecutionPlan.length > 0 ? weeklyExecutionPlan : weeklyPlan).map((w: any) => (
                              <div key={w.week} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-sm font-semibold text-slate-950">{locale === 'ar' ? 'الأسبوع' : 'Week'} {w.week}: {w.objective}</p>
                                  {w.cta && <span className="text-xs font-semibold text-indigo-600">{w.cta}</span>}
                                </div>
                                {w.keyMessage && <p className="mt-2 text-sm leading-6 text-slate-600">"{w.keyMessage}"</p>}
                                {w.deliverables?.length > 0 && (
                                  <div className="mt-3">
                                    <StrategyDocList items={w.deliverables.map((d: string) => d)} />
                                  </div>
                                )}
                                {(w.platforms?.length > 0 || w.channels?.length > 0) && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {(w.platforms || w.channels).map((p: string, pi: number) => (
                                      <span key={pi} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">{p}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </StrategyDocSection>
                )}

                {(strategy.kpis?.length > 0 || successMetricsDetailed.length > 0 || successMetrics.length > 0) && (
                  <StrategyDocSection
                    eyebrow="07"
                    title={cdT?.sectionKpis || 'KPIs & Metrics'}
                    description={locale === 'ar'
                      ? 'المؤشرات هنا فرضيات حتى يتم إنشاء خط أساس من بيانات حقيقية.'
                      : 'These indicators are hypotheses until a real baseline is available.'}
                  >
                    <div className="space-y-5">
                      {strategy.kpis?.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {strategy.kpis.map((kpi: any, i: number) => (
                            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-lg font-semibold text-slate-950">{kpi.target || (locale === 'ar' ? 'يُحدد لاحقاً' : 'Target to define')}</p>
                              <p className="mt-1 text-sm text-slate-600">{kpi.metric}</p>
                              <p className="mt-2 text-xs text-slate-400">{kpi.timeframe || (locale === 'ar' ? 'بعد أول 30 يوماً' : 'After the first 30 days')}</p>
                              <span className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                                {locale === 'ar' ? 'فرضية' : 'Hypothesis'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {successMetricsDetailed.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {successMetricsDetailed.map((m: any, i: number) => (
                            <StrategyDocCard
                              key={i}
                              label={m.category || (locale === 'ar' ? 'مؤشر' : 'Metric')}
                              value={`${m.metric}${m.target ? ` — ${m.target}` : ''}${m.timeframe ? ` (${m.timeframe})` : ''}`}
                              tone="muted"
                            />
                          ))}
                        </div>
                      )}
                      {successMetrics.length > 0 && successMetricsDetailed.length === 0 && (
                        <StrategyDocList items={successMetrics.map((metric: string) => metric)} />
                      )}
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                        {locale === 'ar'
                          ? 'خط أساس مطلوب. تُعرّف الأهداف النهائية بعد أول 30 يوماً من البيانات.'
                          : 'Baseline needed. Final targets should be defined after the first 30 days of real data.'}
                      </div>
                    </div>
                  </StrategyDocSection>
                )}

                {(readinessChecklist.length > 0 || assetRequirements || strategy.executionChecklist?.length > 0 || adSetupPlan) && (
                  <StrategyDocSection
                    eyebrow="08"
                    title={locale === 'ar' ? 'الجاهزية والتخطيط المدفوع' : 'Readiness & Paid Planning'}
                    description={locale === 'ar'
                      ? 'تخطيط فقط. لا يتم صرف ميزانية أو نشر محتوى من هذه الصفحة.'
                      : 'Planning only. No budget is spent and no content goes out from this page.'}
                  >
                    <div className="space-y-5">
                      {readinessChecklist.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionReadinessChecklist || 'Readiness Checklist'}</p>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {readinessChecklist.map((item: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                <span className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className="flex-1">{item.label || item.item}</span>
                                <span className="text-xs text-slate-400">{item.done ? (cdT?.readinessComplete || 'Done') : (locale === 'ar' ? 'قيد الانتظار' : 'Pending')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {assetRequirements && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <StrategyDocCard label={cdT?.assetMustHave || 'Must have'} value={assetRequirements.mustHave?.length ? <StrategyDocList items={assetRequirements.mustHave.map((a: string) => a)} /> : null} tone="warning" />
                          <StrategyDocCard label={cdT?.assetNiceToHave || 'Nice to have'} value={assetRequirements.niceToHave?.length ? <StrategyDocList items={assetRequirements.niceToHave.map((a: string) => a)} /> : null} />
                          <StrategyDocCard label={cdT?.assetForAds || 'For paid planning'} value={assetRequirements.forAds?.length ? <StrategyDocList items={assetRequirements.forAds.map((a: string) => a)} /> : null} tone="warning" />
                          <StrategyDocCard label={cdT?.assetForProof || 'Social proof'} value={assetRequirements.forProof?.length ? <StrategyDocList items={assetRequirements.forProof.map((a: string) => a)} /> : null} />
                        </div>
                      )}
                      {strategy.executionChecklist?.length > 0 && (
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{cdT?.sectionExecutionChecklist || 'Execution Checklist'}</p>
                          <StrategyDocList items={strategy.executionChecklist.map((item: string) => item)} />
                        </div>
                      )}
                      {(() => {
                        const hasAdContent = adSetupPlan && (
                          adSetupPlan.testBudget || adSetupPlan.duration || adSetupPlan.targeting ||
                          adSetupPlan.abTestPlan || adSetupPlan.landingPath || adSetupPlan.trackingRequired ||
                          adSetupPlan.adCopyAngles?.length > 0 || adSetupPlan.notReadyIf?.length > 0 ||
                          adSetupPlan.objective || adSetupPlan.platformPriority?.length > 0
                        )
                        if (!hasAdContent) {
                          return (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                              {locale === 'ar'
                                ? 'التخطيط المدفوع غير جاهز بعد — أضف الميزانية ووجهة التحويل والتحليلات في Brand Brain.'
                                : 'Paid planning is not ready yet — add budget, conversion destination, and analytics context in Brand Brain.'}
                            </div>
                          )
                        }
                        return (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <button
                              type="button"
                              onClick={() => setAdSetupOpen(v => !v)}
                              className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-amber-950"
                            >
                              <span>{locale === 'ar' ? 'خطة مدفوعة للمراجعة' : 'Paid plan for review'}</span>
                              <span className="text-xs text-amber-700">{adSetupOpen ? (locale === 'ar' ? 'إخفاء' : 'Hide') : (locale === 'ar' ? 'عرض' : 'Show')}</span>
                            </button>
                            {adSetupOpen && (
                              <div className="mt-4 space-y-3">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                  {[
                                    { label: cdT?.adTestBudget || 'Test budget', value: adSetupPlan.testBudget },
                                    { label: cdT?.adDuration || 'Duration', value: adSetupPlan.duration },
                                    { label: cdT?.adAbTest || 'A/B test plan', value: adSetupPlan.abTestPlan },
                                    { label: cdT?.adLandingPath || 'Landing path', value: adSetupPlan.landingPath },
                                    { label: cdT?.adTracking || 'Tracking', value: adSetupPlan.trackingRequired },
                                    { label: 'Objective', value: adSetupPlan.objective },
                                  ].map((item, i) => <StrategyDocCard key={i} label={item.label} value={item.value} />)}
                                </div>
                                <StrategyDocCard label={cdT?.adTargeting || 'Targeting'} value={adSetupPlan.targeting} />
                                <StrategyDocCard label="Exclusions" value={adSetupPlan.exclusions} />
                                {adSetupPlan.adCopyAngles?.length > 0 && (
                                  <StrategyDocCard label="Ad copy angles" value={<StrategyDocList items={adSetupPlan.adCopyAngles.map((angle: string) => angle)} />} />
                                )}
                                {adSetupPlan.notReadyIf?.length > 0 && (
                                  <StrategyDocCard
                                    label={locale === 'ar' ? 'لا تشغّل الإعلانات إذا' : 'Do not run ads if'}
                                    value={<StrategyDocList items={adSetupPlan.notReadyIf.map((item: string) => item)} />}
                                    tone="warning"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </StrategyDocSection>
                )}

                {(doNotDoYet.length > 0 || riskNotes.length > 0 || executionAssumptions.length > 0 || assumptions.length > 0 || missingDataLabels.length > 0 || confidenceReport || competitorAnalysisComplete === false) && (
                  <StrategyDocSection
                    eyebrow="09"
                    title={locale === 'ar' ? 'المخاطر والافتراضات والبيانات الناقصة' : 'Risks, Assumptions & Missing Data'}
                    description={locale === 'ar'
                      ? 'هذه الحدود تساعد على مراجعة الاستراتيجية بصدق قبل الانتقال إلى المحتوى.'
                      : 'These limits keep the strategy honest before it moves into content planning.'}
                  >
                    <div className="space-y-4">
                      {confidenceReport?.overall && (
                        <StrategyDocCard label={locale === 'ar' ? 'الثقة' : 'Confidence'} value={confLevelLabel(confidenceReport.overall)} tone="muted" />
                      )}
                      {missingDataLabels.length > 0 && (
                        <StrategyDocCard
                          label={locale === 'ar' ? 'بيانات ناقصة' : 'Missing data'}
                          value={<StrategyDocList items={missingDataLabels.map(label => label)} />}
                          tone="warning"
                        />
                      )}
                      {competitorAnalysisComplete === false && (
                        <StrategyDocCard
                          label={locale === 'ar' ? 'تحليل المنافسين' : 'Competitor analysis'}
                          value={locale === 'ar'
                            ? 'غير مكتمل — لم تُضف منافسين، ولن يتم اختراع منافسين.'
                            : 'Incomplete — no competitors were provided, and competitors will not be invented.'}
                          tone="warning"
                        />
                      )}
                      {doNotDoYet.length > 0 && (
                        <StrategyDocCard label={cdT?.sectionDoNotDoYet || 'Do not do yet'} value={<StrategyDocList items={doNotDoYet.map((item: string) => item)} />} tone="warning" />
                      )}
                      {riskNotes.length > 0 && (
                        <StrategyDocCard label={cdT?.sectionRiskNotes || 'Risk notes'} value={<StrategyDocList items={riskNotes.map((note: string) => note)} />} tone="warning" />
                      )}
                      {executionAssumptions.length > 0 && (
                        <StrategyDocCard label={locale === 'ar' ? 'افتراضات التنفيذ' : 'Execution assumptions'} value={<StrategyDocList items={executionAssumptions.map((item: string) => item)} />} />
                      )}
                      {assumptions.length > 0 && (
                        <StrategyDocCard label={locale === 'ar' ? 'افتراضات' : 'Assumptions'} value={<StrategyDocList items={assumptions.map((item: string) => item)} />} />
                      )}
                    </div>
                  </StrategyDocSection>
                )}
              </div>
            )}

            {/* ── Tab 1: Content & Hooks (content workflow) ─────────────────── */}
            {activeTab === 1 && (
              <div className="space-y-4">
                <AgentBanner idx={1} />
                <BrandDNABadge brand={brandDNA} locale={locale} />
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                  <p className="text-sm font-semibold text-indigo-900">
                    {locale === 'ar'
                      ? 'Content Hub هو المسار النهائي لمعاينة المنشورات'
                      : 'Content Hub is the final post preview path'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-indigo-800">
                    {locale === 'ar'
                      ? 'راجع النسخ، جاهزية الوسائط، حالة دورة الحياة، وحالة النشر اليدوي في Content Hub. ملاحظات الحملة المحفوظة هنا للمراجعة فقط.'
                      : 'Review copy, media readiness, lifecycle state, and manual publish status in Content Hub. Saved campaign notes here are review material only.'}
                  </p>
                  <p className="mt-3 rounded-xl border border-indigo-200 bg-white/70 px-3 py-2 text-xs leading-5 text-indigo-800">
                    {locale === 'ar'
                      ? 'الهوكس والزوايا هنا مواد مراجعة للحملة. تحديثات Brand Brain تتم عبر مقترحات إشارات مراجَعة أو من أسطح Brand Brain؛ الموافقات والتفضيلات إشارات وليست تعلّماً مدعوماً بالتحليلات.'
                      : 'Hooks and angles shown here are campaign review material. Brand Brain updates happen through reviewed signal proposals or Brand Brain surfaces; approvals and preferences are signals, not analytics-backed learning.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/campaigns/${campaignId}/content-hub`}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800"
                    >
                      {locale === 'ar' ? 'راجع معاينات المنشورات النهائية' : 'Review final post previews'}
                    </Link>
                    <Link
                      href="/brand"
                      className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      {locale === 'ar' ? 'راجع إشارات Brand Brain' : 'Review Brand Brain signals'}
                    </Link>
                  </div>
                </div>

                {/* Top Hooks */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>🪝</span> {cdT?.sectionTopHooks}</h3>
                  {topHooks.length > 0 ? (
                    <div className="space-y-3">
                      {topHooks.map((hook: string, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="flex-1 text-sm font-semibold leading-6 text-indigo-700">"{hook}"</p>
                            <div className="flex gap-1 flex-shrink-0">
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>📣</span> {cdT?.sectionCtaVariations}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ctaVariations.map((cta: string, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 gap-3">
                          <span className="flex-1 text-sm text-slate-700">{cta}</span>
                          <CopyBtn text={cta} label={cdT?.copyBtn || 'Copy'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caption Formulas */}
                {captionFormulas.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>✍️</span> {cdT?.sectionCaptionFormulas}</h3>
                    <div className="space-y-3">
                      {captionFormulas.map((caption: string, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="flex-1 text-sm leading-6 text-slate-700">{caption}</p>
                            <CopyBtn text={caption} label={cdT?.copyBtn || 'Copy'} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script Template */}
                {scriptTemplate && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>📝</span> {cdT?.sectionScriptTemplate}</h3>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-xs uppercase tracking-wide text-slate-400">Script Template</span>
                        <CopyBtn text={scriptTemplate} label={cdT?.copyBtn || 'Copy'} />
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{scriptTemplate}</pre>
                    </div>
                  </div>
                )}

                {/* Content Angles — Sprint M detailed view (show both) */}
                {contentAnglesDetailed.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>💡</span> {cdT?.sectionContentAnglesDetailed || cdT?.sectionContentAngles || 'Content Angles'}</h3>
                    <div className="space-y-3">
                      {contentAnglesDetailed.map((angle: any, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{i + 1}</span>
                              <p className="text-sm font-semibold text-slate-950">{angle.title}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <CopyBtn text={`${angle.title}\n${angle.hook}`} label={cdT?.copyBtn || 'Copy'} />
                            </div>
                          </div>
                          {angle.hook && (
                            <p className="mb-2 text-sm italic text-indigo-700">"{angle.hook}"</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            {angle.pain && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">{cdT?.anglePain || 'Pain'}: </span>
                                <span className="text-slate-600">{angle.pain}</span>
                              </div>
                            )}
                            {angle.format && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">Format: </span>
                                <span className="text-slate-600">{angle.format}</span>
                              </div>
                            )}
                            {angle.platform && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">Platform: </span>
                                <span className="text-slate-600">{angle.platform}</span>
                              </div>
                            )}
                            {angle.asset && (
                              <div>
                                <span className="uppercase tracking-wide text-slate-400">{cdT?.angleAsset || 'Asset'}: </span>
                                <span className="text-slate-600">{angle.asset}</span>
                              </div>
                            )}
                          </div>
                          {(angle.cta || angle.funnelStage) && (
                            <div className="mt-2 flex items-center gap-3 border-t border-slate-200 pt-2 text-xs">
                              {angle.funnelStage && (
                                <span className="capitalize text-slate-500">{angle.funnelStage}</span>
                              )}
                              {angle.cta && (
                                <span className="ml-auto font-semibold text-indigo-700">{angle.cta}</span>
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950"><span>💡</span> {cdT?.sectionContentAngles || 'Content Angles'}</h3>
                    <div className="space-y-2">
                      {contentAngles.map((angle: string, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="mt-0.5 w-5 flex-shrink-0 text-xs font-bold text-indigo-700">{i + 1}</span>
                            <p className="text-sm leading-6 text-slate-700">{angle}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
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

            {/* ── Tab 2: Calendar (campaign calendar) ───────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <AgentBanner idx={2} />

                {/* Weekly Execution Plan — Sprint M detailed (shown when available) */}
                {weeklyExecutionPlan.length > 0 && (
                  <div className="space-y-4">
                    <p className="px-1 text-xs uppercase tracking-wide text-slate-500">{cdT?.sectionWeeklyExecutionPlan || '4-Week Execution Plan'}</p>
                    {weeklyExecutionPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-amber-700">{cdT?.weekLabel || 'Week'} {wk.week}</h3>
                          {wk.cta && (
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              CTA: {wk.cta}
                            </span>
                          )}
                        </div>
                        {wk.objective && (
                          <div className="mb-3">
                            <span className="text-xs uppercase tracking-wide text-slate-400">{cdT?.weekObjective || 'Objective'}: </span>
                            <span className="text-sm font-semibold text-slate-800">{wk.objective}</span>
                          </div>
                        )}
                        {wk.keyMessage && (
                          <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                            <span className="text-xs uppercase tracking-wide text-indigo-600">{cdT?.weekKeyMessage || 'Key Message'}: </span>
                            <span className="text-sm text-slate-700">"{wk.keyMessage}"</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          {wk.deliverables?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekDeliverables || 'Deliverables'}</p>
                              <ul className="space-y-1">
                                {wk.deliverables.map((d: string, di: number) => (
                                  <li key={di} className="flex items-start gap-1 text-xs text-slate-700">
                                    <span className="mt-0.5 text-indigo-500">·</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {wk.assetsNeeded?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekAssets || 'Assets Needed'}</p>
                              <ul className="space-y-1">
                                {wk.assetsNeeded.map((a: string, ai: number) => (
                                  <li key={ai} className="flex items-start gap-1 text-xs text-slate-600">
                                    <span className="mt-0.5 text-amber-500">◦</span> {a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {wk.successMetric && (
                          <div className="mt-3 text-xs">
                            <span className="uppercase tracking-wide text-slate-400">{cdT?.weekSuccessMetric || 'Metric'}: </span>
                            <span className="text-emerald-700">{wk.successMetric}</span>
                          </div>
                        )}
                        {wk.executionNote && (
                          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                            <p className="text-xs italic text-blue-700">{cdT?.weekExecutionNote || 'Note'}: {wk.executionNote}</p>
                          </div>
                        )}
                        {wk.reviewPoints?.length > 0 && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekReviewPoints || 'Review at end of week'}</p>
                            <ul className="space-y-1">
                              {wk.reviewPoints.map((rp: string, ri: number) => (
                                <li key={ri} className="flex items-start gap-1.5 text-xs text-slate-500">
                                  <span className="mt-0.5 text-slate-400">→</span>{rp}
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
                    <p className="px-1 text-xs uppercase tracking-wide text-slate-500">{cdT?.sectionWeeklyPlan || '4-Week Execution Plan'}</p>
                    {weeklyPlan.map((wk: any, wi: number) => (
                      <div key={wi} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-amber-700">{cdT?.weekLabel || 'Week'} {wk.week}</h3>
                          {wk.cta && (
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              CTA: {wk.cta}
                            </span>
                          )}
                        </div>
                        {wk.objective && (
                          <div className="mb-3">
                            <span className="text-xs uppercase tracking-wide text-slate-400">{cdT?.weekObjective || 'Objective'}: </span>
                            <span className="text-sm font-semibold text-slate-800">{wk.objective}</span>
                          </div>
                        )}
                        {wk.keyMessage && (
                          <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                            <span className="text-xs uppercase tracking-wide text-indigo-600">{cdT?.weekKeyMessage || 'Key Message'}: </span>
                            <span className="text-sm text-slate-700">"{wk.keyMessage}"</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          {wk.contentThemes?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekThemes || 'Themes'}</p>
                              <ul className="space-y-1">
                                {wk.contentThemes.map((theme: string, ti: number) => (
                                  <li key={ti} className="flex items-start gap-1 text-xs text-slate-700">
                                    <span className="mt-0.5 text-indigo-500">·</span> {theme}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {wk.deliverables?.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{cdT?.weekDeliverables || 'Deliverables'}</p>
                              <ul className="space-y-1">
                                {wk.deliverables.map((d: string, di: number) => (
                                  <li key={di} className="flex items-start gap-1 text-xs text-slate-700">
                                    <span className="mt-0.5 text-emerald-500">□</span> {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {wk.channels?.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {wk.channels.map((ch: string, ci: number) => (
                              <span key={ci} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs capitalize text-slate-500">
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
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {locale === 'ar' ? 'خطة الشهر حسب المنصة' : 'Monthly plan by platform'}
                          </p>
                          <h3 className="mt-1 font-semibold text-slate-950">
                            {locale === 'ar'
                              ? `${monthlyPreviewItems.length} كارت محتوى جاهز للمراجعة`
                              : `${monthlyPreviewItems.length} content cards ready for review`}
                          </h3>
                        </div>
                        <div className="md:ml-auto flex flex-wrap gap-2">
                          <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] text-cyan-700">
                            {mediaStrategy?.mode === 'client_assets'
                              ? (locale === 'ar' ? `${mediaStrategy.sourceCount} ملف من الميديا دخلوا في الخطة` : `${mediaStrategy.sourceCount} media assets used`)
                              : (locale === 'ar' ? 'بدون ميديا: الصور هتتولد بالـ AI' : 'No media: AI visuals planned')}
                          </span>
                          {creativeAssets.some((asset: any) => asset.type === 'VIDEO') && (
                            <span className="rounded-full border border-pink-100 bg-pink-50 px-2.5 py-1 text-[11px] text-pink-700">
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
                            <h3 className="font-semibold text-slate-950">{theme.label}</h3>
                            <span className="text-xs text-slate-500">· {posts.length} {locale === 'ar' ? 'بوست' : 'posts'}</span>
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

            {/* ── Tab 3: Creative ───────────────────────────────────────────── */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {locale === 'ar' ? 'الإبداع' : 'Creative'}
                  </p>
                  <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {locale === 'ar' ? 'متطلبات الإبداع وجاهزية الوسائط' : 'Creative requirements and media readiness'}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-slate-800">{nextCreativeAction.title}</p>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                        {nextCreativeAction.helper}
                      </p>
                      <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'يتبع العمل الإبداعي حالة الحملة. لا ينشر NEXUS أو يجدول المحتوى أو يطلق إعلانات من هذا التبويب. وسائط المنشورات النهائية تُراجع في Content Hub.'
                          : 'Creative work follows the campaign state. NEXUS does not publish, schedule, or start paid campaigns from this tab. Final post media is reviewed in Content Hub.'}
                      </p>
                    </div>
                    <a
                      href={nextCreativeAction.href}
                      target={nextCreativeAction.href.startsWith('#') ? undefined : '_blank'}
                      rel={nextCreativeAction.href.startsWith('#') ? undefined : 'noopener noreferrer'}
                      className="inline-flex flex-shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
                    >
                      {nextCreativeAction.cta}
                      {!nextCreativeAction.href.startsWith('#') && <span className="ml-2 text-xs text-indigo-100">↗</span>}
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        {locale === 'ar' ? 'متطلبات الإبداع للمنشورات' : 'Post creative requirements'}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-950">
                        {locale === 'ar'
                          ? 'متطلبات قبل أي توليد أو ربط وسائط'
                          : 'Requirements before any media generation or attachment'}
                      </h3>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                        {locale === 'ar'
                          ? 'تُستمد متطلبات الإبداع من الحملة وسياق Brand Brain والمنصة ونص المنشور. هي توجه قرارات الوسائط ولا تولّد أو تنشر أي شيء.'
                          : 'Creative requirements are derived from the campaign, Brand Brain context, platform, and post copy. They guide media decisions; they do not generate or publish anything.'}
                      </p>
                    </div>
                    <a
                      href={`/campaigns/${campaign.id}/content-hub`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      {locale === 'ar' ? 'افتح Content Hub' : 'Open Content Hub'}
                      <span className="ml-2 text-xs text-indigo-400">↗</span>
                    </a>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                      <div className="text-lg font-semibold text-amber-700">{creativeRequirementsSummary.mediaNeeded}</div>
                      <div className="text-[10px] leading-4 text-amber-700">{locale === 'ar' ? 'تحتاج وسائط للمنشور' : 'need post media'}</div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                      <div className="text-lg font-semibold text-blue-700">{creativeRequirementsSummary.readinessPending}</div>
                      <div className="text-[10px] leading-4 text-blue-700">{locale === 'ar' ? 'معاينات تحتاج تأكيداً' : 'previews need confirmation'}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                      <div className="text-lg font-semibold text-emerald-700">{creativeRequirementsSummary.attachedToPost}</div>
                      <div className="text-[10px] leading-4 text-emerald-700">{locale === 'ar' ? 'مرتبطة بالمنشورات' : 'attached to posts'}</div>
                    </div>
                  </div>
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                    {locale === 'ar'
                      ? 'Content Hub هو مكان مراجعة وربط وسائط المنشورات النهائية. Creative Studio مساحة مستقبلية تبدأ لاحقاً من منشور محدد لطبقات النص والشعار وCTA، ولا تنشر أو تطلق إعلانات.'
                      : 'Content Hub is where final post media is reviewed and attached. Creative Studio is a future context-first workspace opened later from a specific post for headline, logo, and CTA layers; it does not publish or launch ads.'}
                  </p>
                </div>

                {/* ── Creative Brief Entry Card — Sprint F ── */}
                <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎨</span>
                      <div>
                        <h3 className="text-base font-semibold text-purple-700">{cdT?.creativeBriefTitle || 'Creative Brief'}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{cdT?.creativeBriefSubtitle || 'Plan art direction, asset needs, prompts, and production notes before creating assets.'}</p>
                      </div>
                    </div>
                    {creativeBrief && (
                      <span className="flex-shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                        ✓ {creativeMode === 'asset' ? (cdT?.creativeModeAsset || 'Assets Analyzed') : (cdT?.creativeModeConceptGen || 'Concepts Generated')}
                      </span>
                    )}
                  </div>

                  <p className="mb-4 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-[11px] leading-5 text-purple-800">
                    {locale === 'ar'
                      ? 'موجز الإبداع أداة تخطيط فقط. لا يعتمد المحتوى أو يجدوله أو ينشره، ولا يطلق حملات مدفوعة.'
                      : 'The creative brief is a planning artifact only. It does not approve, schedule, publish, or launch paid campaigns.'}
                  </p>

                  {/* Mode badges */}
                  <div className="flex gap-3 mb-5">
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-3 py-2">
                      <span>🖼️</span>
                      <div>
                        <p className="text-xs font-bold text-purple-700">{cdT?.creativeModeAssetLabel || 'User Asset Mode'}</p>
                        <p className="text-xs text-slate-500">{cdT?.creativeModeAssetDesc || 'Use uploaded photos and logos when available'}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-pink-100 bg-pink-50 px-3 py-2">
                      <span>🤖</span>
                      <div>
                        <p className="text-xs font-bold text-pink-700">{cdT?.creativeModeConceptLabel || 'AI Concept Mode'}</p>
                        <p className="text-xs text-slate-500">{cdT?.creativeModeConceptDesc || 'Generate concept directions for review'}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/creative-brief`, '_blank')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold transition-all hover:bg-purple-500"
                    style={{ color: '#fff' }}
                  >
                    <span>🎨</span>
                    {creativeBrief
                      ? (cdT?.openCreativeBriefBtn || 'View / Update Creative Brief')
                      : (cdT?.startCreativeBriefBtn || 'Create Creative Brief')
                    }
                    <span className="text-purple-300 text-xs">↗</span>
                  </button>
                </div>

                {/* ── Post Media Readiness / Content Hub Entry Card ── */}
                <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">📅</span>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-indigo-700">
                        {locale === 'ar' ? 'جاهزية وسائط المنشورات' : 'Post media readiness'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {locale === 'ar'
                          ? 'Content Hub هو مصدر الحقيقة لمعاينات المنشورات النهائية والوسائط المرتبطة بكل SocialPost.'
                          : 'Content Hub is the source of truth for final post previews and media linked to each SocialPost.'}
                      </p>
                    </div>
                  </div>
                  {totalPostMediaSlots > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                        <div className="text-lg font-semibold text-indigo-700">{readyPostMediaSlots}</div>
                        <div className="text-[10px] text-indigo-600">{locale === 'ar' ? 'وسائط جاهزة' : 'media ready'}</div>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                        <div className="text-lg font-semibold text-amber-700">{pendingPostMediaSlots}</div>
                        <div className="text-[10px] text-amber-700">{locale === 'ar' ? 'تحتاج قراراً' : 'need a decision'}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['📘 Facebook', '📸 Instagram', '💼 LinkedIn', '✕ X', '🎵 TikTok'].map(p => (
                      <span key={p} className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{p}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/content-hub`, '_blank')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold transition-all hover:bg-indigo-500"
                    style={{ color: '#fff' }}
                  >
                    <span>📅</span>
                    {locale === 'ar' ? 'راجع وسائط المنشورات في مركز المحتوى' : 'Review post media in Content Hub'}
                    <span className="text-purple-300 text-xs">↗</span>
                  </button>
                </div>

                {/* ── Paid Creative Requirements / Paid Planning Brief Card ── */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">📋</span>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-slate-950">
                        {locale === 'ar' ? 'متطلبات الإبداع للإعلانات المدفوعة' : 'Paid creative requirements'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {locale === 'ar'
                          ? 'موجز التخطيط المدفوع يوضح احتياجات الإبداع والزوايا للمراجعة فقط، مستنداً إلى Brand Brain.'
                          : 'The paid planning brief captures creative needs and angles for review only, informed by Brand Brain.'}
                      </p>
                    </div>
                  </div>
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                    {locale === 'ar'
                      ? 'تخطيط ومراجعة فقط — لا يتم إطلاق إعلانات أو صرف ميزانية أو دفع أصول إلى المنصات من تبويب الإبداع.'
                      : 'Planning and review only — no ads launch, no budget is spent, and no assets are pushed to platforms from Creative.'}
                  </p>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['𝓕 Meta', 'G Google', '♪ TikTok', 'in LinkedIn'].map(p => (
                      <span key={p} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{p}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/paid-launch`, '_blank')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                  >
                    {locale === 'ar' ? 'راجع موجز التخطيط المدفوع' : 'Review paid planning brief'}
                    <span className="text-xs text-slate-400">↗</span>
                  </button>
                </div>

                {/* Visual Direction from strategy */}
                {strategy.visualDirection && (
                  <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-purple-700"><span>🎯</span> {cdT?.sectionVisualDirection}</h3>
                    <p className="text-sm leading-6 text-slate-700">{strategy.visualDirection}</p>
                  </div>
                )}

                <div id="campaign-visual-generator" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                    {locale === 'ar'
                      ? 'المرئيات المفهومية للحملة هي أصول معرض للمراجعة. لا تُرفق بالمنشورات تلقائياً، ولا تُجدول أو تُنشر أو تُستخدم في الإعلانات تلقائياً.'
                      : 'Campaign concept visuals are gallery assets for review. They are not attached to posts automatically, scheduled, published, or used in ads automatically.'}
                  </p>
                  <VisualGenerator context={visualContext} />
                </div>

              </div>
            )}

            {/* ── Tab 4: Publish to Social ─────────────────────────────────── */}
            {activeTab === 4 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">
                          {locale === 'ar' ? publishTabSummary.safeCopy.title.ar : publishTabSummary.safeCopy.title.en}
                        </p>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-800">
                          {locale === 'ar' ? publishTabSummary.safeCopy.helper.ar : publishTabSummary.safeCopy.helper.en}
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {locale === 'ar' ? 'جاهزية فقط' : 'Readiness only'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {[
                        publishTabSummary.safeCopy.scheduled,
                        publishTabSummary.safeCopy.manual,
                        publishTabSummary.safeCopy.api,
                        publishTabSummary.safeCopy.accounts,
                        publishTabSummary.safeCopy.automation,
                        publishTabSummary.safeCopy.performance,
                      ].map((item, index) => (
                        <div key={index} className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs leading-5 text-slate-700">
                          {locale === 'ar' ? item.ar : item.en}
                        </div>
                      ))}
                    </div>
                    {publishTabSummary.manualPublishedWithoutUrl > 0 && (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        {locale === 'ar'
                          ? `${publishTabSummary.manualPublishedWithoutUrl} منشور مؤكد يدويًا بدون رابط مباشر محفوظ. هذا تسجيل من المستخدم، وليس إثبات منصة أو API.`
                          : `${publishTabSummary.manualPublishedWithoutUrl} manually published post has no live URL saved. This is a user record, not platform/API proof.`}
                      </p>
                    )}
                  </div>
                  {!(campaign.status === 'ACTIVE' || approvalState === 'done') && (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">
                        {locale === 'ar' ? 'النشر عبر المنصات مقفل حاليًا' : 'Platform publishing is locked for now'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        {locale === 'ar'
                          ? 'المنشورات المجدولة محفوظة داخل NEXUS، لكن النشر عبر المنصات/API يتطلب حساب نشر متصلًا، والتحقق من الصفحة والصلاحيات والوسائط، وتأكيدًا صريحًا.'
                          : 'Scheduled posts are saved in NEXUS, but platform/API publishing requires a connected publishing account, page/permission checks, media readiness, and explicit confirmation.'}
                      </p>
                    </div>
                  )}
                  <SocialPublisher
                    campaignId={campaign.id}
                    campaignName={campaign.name}
                    contentApproved={campaign.status === 'ACTIVE' || approvalState === 'done'}
                    topHooks={topHooks}
                    captionFormulas={captionFormulas}
                    ctaVariations={ctaVariations}
                    keyMessage={strategy.keyMessage}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-lg">
                      📊
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">
                        {locale === 'ar' ? 'التحليلات مطلوبة للتعلّم' : 'Analytics required for learning'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {locale === 'ar'
                          ? 'التحليلات مطلوبة للتعلّم. لا يستطيع NEXUS تعلّم أنماط الأداء إلا بعد توفر تحليلات حقيقية للمنشورات المنشورة. هذا التبويب يعرض جاهزية النشر فقط.'
                          : 'Analytics required for learning. NEXUS can only learn performance patterns after published posts collect real analytics. This tab only shows publishing readiness.'}
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {locale === 'ar'
                          ? 'الاعتماد والجدولة والنشر اليدوي إشارات سير عمل فقط، وليست تعلمًا مدعومًا بالتحليلات.'
                          : 'Approval, scheduling, and manual publish are workflow signals only, not analytics-backed learning.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analytics section */}
                <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                  <SocialAnalytics campaignId={campaign.id} />
                </div>
              </div>
            )}

            {/* ── Tab 5: Autopilot ──────────────────────────────────────────── */}
            {activeTab === 5 && (
              <div className="space-y-4">

                {/* Header card */}
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                      <span className="text-lg">🤖</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {locale === 'ar' ? 'الأوتوبايلوت' : 'Autopilot'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {locale === 'ar'
                          ? 'يدعم سير عمل النشر فقط بعد موافقتك الصريحة وتفعيلك له.'
                          : 'Supports your publishing workflow only after explicit review and enablement.'}
                      </p>
                    </div>
                    {campaign.autopilotEnabled && (
                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                        {locale === 'ar' ? 'نشط' : 'Active'}
                      </div>
                    )}
                  </div>

                  {/* Trust contract — always visible (enabled or not). Light-lavender card → darken (not on-dark muted). */}
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    {locale === 'ar'
                      ? 'لا يتم نشر أي محتوى أو صرف أي ميزانية من هذه الصفحة بدون مراجعة وتفعيل صريح.'
                      : 'No content publishes and no budget is spent from this page without explicit review and enablement.'}
                  </p>

                  {/* Requirements checklist */}
                  {!campaign.autopilotEnabled && (
                    <div className="mt-4 space-y-1.5">
                      {[
                        { label: locale === 'ar' ? 'استراتيجية مولَّدة' : 'Strategy generated', done: !!aiOutput },
                        { label: locale === 'ar' ? 'خطة تنفيذ أسبوعية' : 'Weekly execution plan', done: weeklyExecutionPlan.length > 0 },
                        { label: locale === 'ar' ? 'مراجعة المحتوى مكتملة أو جاهزة صراحةً' : 'Content review complete or explicitly ready', done: campaign.status === 'ACTIVE' || approvalState === 'done' },
                        { label: locale === 'ar' ? 'حساب نشر متصل' : 'Publishing account connected', done: hasVerifiedPublishingConnection },
                      ].map((req, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={req.done ? 'text-green-600' : 'text-slate-400'}>
                            {req.done ? '✓' : '○'}
                          </span>
                          <span className={req.done ? 'text-slate-700' : 'text-slate-400'}>{req.label}</span>
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
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
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
                          style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' }}>
                          {locale === 'ar' ? '↻ تحديث القائمة' : '↻ Refresh Queue'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          const token = authHeader()
                          if (!token || autopilotActivating || !autopilotRequirementsMet) return
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
                        disabled={autopilotActivating || !autopilotRequirementsMet}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                        style={{
                          background: autopilotActivating || !autopilotRequirementsMet
                            ? '#f1f5f9'
                            : '#f5f3ff',
                          color: autopilotActivating || !autopilotRequirementsMet
                            ? '#94a3b8' : '#6d28d9',
                          border: '1px solid #ddd6fe',
                        }}>
                        {autopilotActivating
                          ? (locale === 'ar' ? 'جاري التفعيل…' : 'Enabling…')
                          : (locale === 'ar' ? 'تفعيل الأوتوبايلوت' : 'Enable Autopilot')}
                      </button>
                    )}
                  </div>

                  {autopilotError && (
                    <p className="mt-3 text-xs text-red-600">⚠ {autopilotError}</p>
                  )}
                  {!aiOutput && (
                    <p className="mt-3 text-xs text-amber-700">
                      {locale === 'ar'
                        ? '⚠ يجب تشغيل "الاستراتيجية الكاملة" أولاً لتفعيل الأوتوبايلوت'
                        : '⚠ Run Full Strategy first to enable Autopilot'}
                    </p>
                  )}
                  {aiOutput && weeklyExecutionPlan.length === 0 && (
                    <p className={`mt-3 text-xs ${hasManualOrScheduledWorkflowRecords ? 'text-slate-600' : 'text-amber-700'}`}>
                      {hasManualOrScheduledWorkflowRecords
                        ? (locale === 'ar'
                            ? '📌 الأوتوبايلوت غير مفعّل. المنشورات المجدولة أو المؤكدة يدويًا هي سجلات سير عمل، ولا تحتاج إعادة توليد الاستراتيجية لمجرد غياب خطة تنفيذ أسبوعية.'
                            : '📌 Autopilot is not enabled. Scheduled or manually published posts are workflow records; they do not require strategy regeneration just because a weekly execution plan is missing.')
                        : (locale === 'ar'
                            ? '⚠ خطة التنفيذ الأسبوعية غير موجودة في هذه الاستراتيجية — راجع الاستراتيجية قبل إعداد الأوتوبايلوت'
                            : '⚠ No weekly execution plan found — review strategy before setting up Autopilot')}
                    </p>
                  )}
                  {aiOutput && weeklyExecutionPlan.length > 0 && !hasVerifiedPublishingConnection && (
                    <p className="mt-3 text-xs text-amber-700">
                      {locale === 'ar'
                        ? '⚠ يحتاج الأوتوبايلوت إلى حساب نشر متصل ومراجعة المحتوى قبل التفعيل.'
                        : '⚠ Autopilot needs a connected publishing account and content review before enablement.'}
                    </p>
                  )}
                </div>

                {/* Queue table */}
                {autopilotQueue.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <span>📅</span>
                        {locale === 'ar'
                          ? campaign.autopilotEnabled
                            ? `${autopilotQueueHasScheduled ? 'قائمة الأوتوبايلوت المجدولة' : 'قائمة الأوتوبايلوت المخططة'} — ${autopilotQueue.length} منشور`
                            : autopilotQueueHasMixedManualAndScheduled
                              ? `${autopilotQueueManualPublishedCount} منشور مؤكد يدويًا · ${autopilotQueueScheduledCount} مجدولة — الأوتوبايلوت غير مفعّل`
                              : `${autopilotQueueHasScheduled ? 'محتوى مجدول — الأوتوبايلوت غير مفعّل' : 'محتوى مخطط — الأوتوبايلوت غير مفعّل'} — ${autopilotQueue.length} منشور`
                          : campaign.autopilotEnabled
                            ? `${autopilotQueueHasScheduled ? 'Autopilot scheduled queue' : 'Autopilot planned queue'} — ${autopilotQueue.length} posts`
                            : autopilotQueueHasMixedManualAndScheduled
                              ? `${autopilotQueueManualPublishedCount} manually published · ${autopilotQueueScheduledCount} scheduled — Autopilot not enabled`
                              : `${autopilotQueueHasScheduled ? 'Scheduled content — Autopilot not enabled' : 'Planned content — Autopilot not enabled'} — ${autopilotQueue.length} posts`}
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {autopilotQueue.map((post) => {
                        const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                          SCHEDULED:  { bg: '#f5f3ff', text: '#6d28d9', label: post.scheduledAt ? (locale === 'ar' ? 'مجدول' : 'Scheduled') : (locale === 'ar' ? 'مخطط' : 'Planned') },
                          PUBLISHED:  { bg: '#ecfdf5', text: '#047857', label: locale === 'ar' ? 'منشور' : 'Published' },
                          FAILED:     { bg: '#fef2f2', text: '#b91c1c', label: locale === 'ar' ? 'فشل' : 'Failed' },
                          DRAFT:      { bg: '#f1f5f9', text: '#64748b', label: locale === 'ar' ? 'مسودة' : 'Draft' },
                        }
                        const sc = statusColors[post.status] || statusColors.DRAFT
                        const platformIcons: Record<string, string> = { META: '👥', LINKEDIN: '💼', TIKTOK: '🎵' }

                        return (
                          <div key={post.id} className="flex items-start gap-4 px-5 py-4">
                            {/* Image preview */}
                            <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              {post.imageUrl ? (
                                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg text-slate-400">🖼</span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {post.weekNumber && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                                    {locale === 'ar' ? `الأسبوع ${post.weekNumber}` : `Week ${post.weekNumber}`}
                                  </span>
                                )}
                                <span className="text-xs font-medium" style={{ color: '#64748b' }}>
                                  {platformIcons[post.platform] || '🌐'} {post.pageName || post.platform}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                  style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}30` }}>
                                  {sc.label}
                                </span>
                                {!post.imageUrl && post.status === 'SCHEDULED' && (
                                  <span className="text-xs text-amber-700">
                                    {locale === 'ar' ? 'الوسائط بانتظار التوليد — لا يوجد توليد صور نشط' : 'Media pending — no image generation running'}
                                  </span>
                                )}
                              </div>
                              <p className="line-clamp-2 text-xs text-slate-600">{post.caption}</p>
                              {post.scheduledAt && (
                                <p className="mt-1 text-xs text-slate-400">
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="text-3xl mb-3">🤖</div>
                    <p className="text-sm text-slate-500">
                      {locale === 'ar'
                        ? 'جاري تحميل قائمة المنشورات...'
                        : 'Loading content queue...'}
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
                      className="mt-3 text-xs text-violet-700 transition hover:text-violet-600">
                      {locale === 'ar' ? '↻ تحميل' : '↻ Load queue'}
                    </button>
                  </div>
                )}

                {/* How it works */}
                {!campaign.autopilotEnabled && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="mb-3 text-sm font-semibold text-slate-700">
                      {locale === 'ar' ? '⚡ كيف يعمل الأوتوبايلوت' : '⚡ How Autopilot works'}
                    </h4>
                    <div className="space-y-2.5">
                      {(locale === 'ar' ? [
                        { icon: '🧠', label: 'يقرأ خطة التنفيذ الأسبوعية من الاستراتيجية' },
                        { icon: '✍️', label: 'يولد كابشن احترافي لكل منشور بناءً على الرسالة والـ CTA' },
                        { icon: '🎨', label: 'يمكن إعداد صورة لكل منشور قبل الموعد عند اكتمال المتطلبات' },
                        { icon: '📤', label: 'لا ينشر أي محتوى إلا بعد مراجعة وتفعيل صريح' },
                      ] : [
                        { icon: '🧠', label: 'Reads the weekly execution plan from your strategy' },
                        { icon: '✍️', label: 'Generates a professional caption for each post based on the key message + CTA' },
                        { icon: '🎨', label: 'Can prepare an image for each post when requirements are complete' },
                        { icon: '📤', label: 'Does not publish content without explicit review and enablement' },
                      ]).map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-sm flex-shrink-0 mt-0.5">{step.icon}</span>
                          <p className="text-xs text-slate-500">{step.label}</p>
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="text-4xl mb-3">📊</div>
                    <h3 className="mb-1 text-base font-semibold text-slate-950">No published performance data yet</h3>
                    <p className="text-sm text-slate-500">Data appears here only after posts are published and analytics are fetched.</p>
                  </div>
                )}

                {!perfLoading && perfData && (() => {
                  const s = perfData.summary
                  if (!s || Number(s.publishedPosts ?? 0) <= 0) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="text-4xl mb-3">📊</div>
                        <h3 className="mb-1 text-base font-semibold text-slate-950">No published performance data yet</h3>
                        <p className="mx-auto max-w-xl text-sm text-slate-500">
                          This campaign has planned or draft content, but performance appears only after posts are published and analytics are fetched.
                        </p>
                      </div>
                    )
                  }
                  if (Number(s.postsWithAnalytics ?? 0) <= 0) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                        <div className="text-4xl mb-3">📊</div>
                        <h3 className="mb-1 text-base font-semibold text-slate-950">
                          {locale === 'ar' ? 'لا توجد بيانات أداء منشورة بعد' : 'No published performance data yet'}
                        </h3>
                        <p className="mx-auto max-w-xl text-sm text-slate-500">
                          {locale === 'ar'
                            ? 'تم تسجيل محتوى منشور أو منشور يدويًا، لكن لم يتم جلب بيانات تحليلية بعد. لا يعرض NEXUS مؤشرات أداء حتى توجد بيانات تحليلية حقيقية.'
                            : 'Published or manually recorded content exists, but analytics have not been fetched yet. NEXUS does not show KPI cards until real analytics data is available.'}
                        </p>
                      </div>
                    )
                  }
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
                          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-base">{kpi.icon}</span>
                              <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                            </div>
                            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Posts status row */}
                      <div className="flex flex-wrap gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        {[
                          ['Total Posts', s.totalPosts, '#9ca3af'],
                          ['Published',   s.publishedPosts, '#34d399'],
                          ['Scheduled',   s.scheduledPosts, '#a78bfa'],
                          ['Awaiting analytics', s.pendingAnalytics, '#fb923c'],
                        ].map(([label, val, color]) => (
                          <div key={String(label)} className="text-center">
                            <div className="text-xl font-bold" style={{ color: String(color) }}>{val}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{label}</div>
                          </div>
                        ))}
                        {s.pendingAnalytics > 0 && (
                          <p className="ml-auto self-center text-xs text-amber-700">
                            Analytics are fetched automatically 24-72h after publishing
                          </p>
                        )}
                      </div>

                      {/* Platform breakdown */}
                      {Object.keys(platforms).length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h4 className="mb-4 text-sm font-semibold text-slate-950">Platform Breakdown</h4>
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
                                      <span className="text-sm font-medium text-slate-800">{platform}</span>
                                      <span className="text-xs text-slate-500">{data.posts} posts</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                      <span>{data.reach?.toLocaleString()} reach</span>
                                      <span className="font-semibold" style={{ color }}>{data.avgEngagementRate}%</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
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
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h4 className="mb-4 text-sm font-semibold text-slate-950">Engagement Trend</h4>
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
                          <div className="mt-1 flex justify-between text-xs text-slate-400">
                            <span>{trend[0]?.date?.slice(5)}</span>
                            <span>{trend[trend.length - 1]?.date?.slice(5)}</span>
                          </div>
                        </div>
                      )}

                      {/* Top posts */}
                      {topPosts.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h4 className="mb-4 text-sm font-semibold text-slate-950">🏆 Top Performing Posts</h4>
                          <div className="space-y-3">
                            {topPosts.map((post, i) => (
                              <div key={post.id} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{
                                    background: i === 0 ? '#fef3c7' : '#f1f5f9',
                                    color: i === 0 ? '#b45309' : '#64748b',
                                    border: `1px solid ${i === 0 ? '#fde68a' : '#e2e8f0'}`,
                                  }}>
                                  {i + 1}
                                </div>
                                {post.imageUrl && (
                                  <img src={post.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="line-clamp-2 text-sm text-slate-700">{post.caption}</p>
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

    {showEngineRebuildModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                {locale === 'ar' ? 'إجراء حساس' : 'Dangerous action'}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">
                {locale === 'ar' ? 'إعادة بناء حزمة الحملة' : 'Rebuild campaign package'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEngineRebuildModal(false)
                setEngineRebuildAcknowledged(false)
              }}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-800">
                {locale === 'ar'
                  ? `تأكيد إعادة البناء — ${ENGINE_REBUILD_CREDIT_COST} كريديت`
                  : `Confirm rebuild — ${ENGINE_REBUILD_CREDIT_COST} credits`}
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-rose-900">
                <li>
                  {locale === 'ar'
                    ? 'يستبدل هذا مخرجات استراتيجية/حزمة الحملة وقد تتغير النتائج.'
                    : 'This overwrites campaign strategy/package output and the results may change.'}
                </li>
                <li>
                  {locale === 'ar'
                    ? 'لا يتم استرجاع المخرجات القديمة تلقائيًا.'
                    : 'Old output is not automatically restored.'}
                </li>
                <li>
                  {locale === 'ar'
                    ? 'لا ينشر ولا يجدول ولا يحدّث المنشورات الاجتماعية الحالية.'
                    : 'It does not publish, schedule, or update existing SocialPosts.'}
                </li>
              </ul>
            </div>

            {(engineRebuildStatusPending || engineRebuildLockedByProgress) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {engineRebuildStatusPending
                  ? (locale === 'ar'
                    ? 'يتم التحقق من حالة المنشورات قبل إتاحة أي إعادة بناء مدفوعة.'
                    : 'Checking post status before any credit-spending rebuild can be available.')
                  : (locale === 'ar'
                    ? 'إعادة البناء مقفلة لأن هذه الحملة لديها منشورات معتمدة أو مجدولة أو منشورة. يلزم مسار خطة مسودة جديدة قبل إعادة توليد مخرجات الحملة.'
                    : 'Rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan flow is required before regenerating campaign outputs.')}
              </div>
            )}

            {!engineRebuildStatusPending && !engineRebuildLockedByProgress && (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  checked={engineRebuildAcknowledged}
                  onChange={e => setEngineRebuildAcknowledged(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  {locale === 'ar'
                    ? `أفهم أن هذا يكلف ${ENGINE_REBUILD_CREDIT_COST} كريديت ويستبدل مخرجات حزمة الحملة.`
                    : `I understand this costs ${ENGINE_REBUILD_CREDIT_COST} credits and overwrites the campaign package output.`}
                </span>
              </label>
            )}

            {engineError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {engineError}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowEngineRebuildModal(false)
                setEngineRebuildAcknowledged(false)
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => handleRunEngine(true, {
                explicitEngineRebuildConfirmed: true,
                acknowledgedCreditCost: ENGINE_REBUILD_CREDIT_COST,
                acknowledgedOutputOverwrite: true,
              })}
              disabled={engineRunning || !engineRebuildAvailability.available}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {engineRunning
                ? (locale === 'ar' ? 'جارٍ إعادة البناء...' : 'Rebuilding...')
                : (locale === 'ar' ? `تأكيد إعادة البناء — ${ENGINE_REBUILD_CREDIT_COST} كريديت` : `Confirm rebuild — ${ENGINE_REBUILD_CREDIT_COST} credits`)}
            </button>
          </div>
        </div>
      </div>
    )}

    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      reason={upgradeReason}
    />
  </>
  )
}
