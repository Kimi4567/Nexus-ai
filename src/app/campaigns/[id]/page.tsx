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
                {activeTab !== 0 && !engineRunning && sentinelStatus !== 'passed' && campaign.status !== 'ACTIVE' && approvalState !== 'done' && (
                  <button
                    onClick={handleSentinelReview}
                    disabled={sentinelState === 'reviewing'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
                    style={{ background: 'rgba(37,99,235,0.85)' }}
                  >
                    {sentinelState === 'reviewing'
                      ? '⏳...'
                      : sentinelStatus === 'needs_attention'
                        ? (locale === 'ar' ? '🔄 أعد المراجعة' : '🔄 Re-review')
                        : (locale === 'ar' ? '🔍 مراجعة Sentinel' : '🔍 Sentinel Review')}
                  </button>
                )}

                {activeTab !== 0 && !engineRunning && sentinelStatus === 'passed' && campaign.status !== 'ACTIVE' && approvalState !== 'done' && (
                  <button
                    onClick={handleApproveAndLaunch}
                    disabled={approvalState === 'approving' || launchState === 'approving' || launchState === 'generating'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
                    style={{ background: 'rgba(5,150,105,0.85)' }}
                  >
                    {launchState === 'approving'
                      ? (locale === 'ar' ? '⏳ جارٍ الاعتماد...' : '⏳ Approving...')
                      : launchState === 'generating'
                        ? (locale === 'ar' ? '⚙️ جارٍ إنشاء الخطة...' : '⚙️ Generating plan...')
                        : (locale === 'ar' ? '🚀 اعتماد وإطلاق' : '🚀 Approve & Launch')}
                  </button>
                )}

                {activeTab !== 0 && (campaign.status === 'ACTIVE' || approvalState === 'done') && (
                  <Link
                    href={`/campaigns/${campaignId}/content-hub?buildPlan=1`}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
                    style={{ background: 'rgba(124,58,237,0.85)' }}
                  >
                    {locale === 'ar' ? 'Content Hub' : 'Content Hub'}
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
                {/* ── Idle: confirm prompt ── */}
                {launchState === 'idle' && (
                  <>
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
                        className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition"
                      >
                        {locale === 'ar' ? '🚀 نعم، اعتماد وإطلاق' : '🚀 Yes, Approve & Launch'}
                      </button>
                      <button
                        onClick={() => setApprovalState('idle')}
                        className="px-4 py-2 bg-dark-tertiary text-gray-400 text-xs font-semibold rounded-xl hover:text-white transition"
                      >
                        {cdT?.approveCancelBtn || 'Cancel'}
                      </button>
                    </div>
                  </>
                )}

                {/* ── In-progress: step tracker ── */}
                {(launchState === 'approving' || launchState === 'generating') && (
                  <div>
                    <p className="text-sm font-semibold text-green-400 mb-3">
                      {locale === 'ar' ? '⏳ جارٍ الإطلاق...' : '⏳ Launching...'}
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
                          {locale === 'ar' ? 'اعتماد الحملة' : 'Approving campaign'}
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
                        {locale === 'ar'
                          ? 'هذه هي الاستراتيجية الغنية الحالية للحملة. راجع الاتجاه والافتراضات والقيود قبل تحويلها إلى خطة محتوى.'
                          : 'This is the current rich strategy output for the campaign. Review the direction, assumptions, and limits before turning it into content planning.'}
                      </p>
                      <p className="mt-3 text-xs text-slate-400">
                        {locale === 'ar' ? 'آخر تحديث' : 'Last updated'}: {new Date(campaign.updatedAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Link
                        href={`/campaigns/${campaignId}/content-hub`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
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

                {/* ── Paid Planning Pack Card (planning/brief only — not execution) ── */}
                <div className="rounded-2xl p-6" style={{ background: 'rgba(10,11,28,0.6)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">📋</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-base text-white">
                        {locale === 'ar' ? 'موجز حملة مدفوعة' : 'Paid Campaign Brief'}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {locale === 'ar'
                          ? 'جمهور مستهدف + نسخ إعلانية + دليل تخطيط + تحديث Brand Brain تلقائياً'
                          : 'AI targeting brief + ad copy + step-by-step planning guide + Brand Brain learning loop'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] mb-4 nx-trust-note">
                    {locale === 'ar'
                      ? 'للتخطيط فقط — لن تُطلق أي إعلانات ولن يُصرف أي مبلغ دون موافقة صريحة.'
                      : 'Planning only — ads will not launch and no budget will be spent without explicit approval.'}
                  </p>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {['𝓕 Meta', 'G Google', '♪ TikTok', 'in LinkedIn'].map(p => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)' }}>{p}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => window.open(`/campaigns/${campaign.id}/paid-launch`, '_blank')}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e5e7eb' }}
                  >
                    {locale === 'ar' ? 'فتح حزمة التخطيط المدفوع' : 'Open Paid Planning Pack'}
                    <span className="text-gray-400 text-xs">↗</span>
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
                    contentApproved={campaign.status === 'ACTIVE' || approvalState === 'done'}
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
                        {locale === 'ar' ? 'الأوتوبايلوت' : 'Autopilot'}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {locale === 'ar'
                          ? 'ينشر الأوتوبايلوت المحتوى الذي وافقتَ عليه وفق الجدول الذي اعتمدته — فقط بعد تفعيلك له.'
                          : 'Auto-publishes the content you approved, on the schedule you approved — only after you enable it.'}
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

                  {/* Trust contract — always visible (enabled or not). Light-lavender card → darken (not on-dark muted). */}
                  <p className="text-[11px] text-gray-700 leading-relaxed">
                    {locale === 'ar'
                      ? 'ينشر الأوتوبايلوت المحتوى الذي وافقتَ عليه فقط، وفق الجدول الذي اعتمدته، بعد تفعيلك الصريح له. بدون أي إنفاق إعلاني. يمكنك الإيقاف في أي وقت.'
                      : 'Autopilot only publishes content you approved, on the schedule you approved, after you explicitly enable it. No ad spend. Pause anytime.'}
                  </p>

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
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40"
                        style={{
                          background: autopilotActivating || !aiOutput || weeklyExecutionPlan.length === 0
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(139,92,246,0.15)',
                          color: autopilotActivating || !aiOutput || weeklyExecutionPlan.length === 0
                            ? '#6b7280' : '#c4b5fd',
                          border: '1px solid rgba(139,92,246,0.3)',
                        }}>
                        {autopilotActivating
                          ? (locale === 'ar' ? 'جاري التفعيل…' : 'Enabling…')
                          : (locale === 'ar' ? 'تفعيل الأوتوبايلوت' : 'Enable Autopilot')}
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
                        { icon: '📤', label: 'في كل موعد مجدول، ينشر على منصاتك المتصلة — فقط بعد تفعيلك للأوتوبايلوت' },
                      ] : [
                        { icon: '🧠', label: 'Reads the weekly execution plan from your strategy' },
                        { icon: '✍️', label: 'Generates a professional caption for each post based on the key message + CTA' },
                        { icon: '🎨', label: '48h before each post, auto-generates an image with DALL-E 3' },
                        { icon: '📤', label: 'At each scheduled time, publishes to your connected platforms — only after you enable Autopilot' },
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
