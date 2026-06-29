'use client'

/**
 * Content Hub — /campaigns/[id]/content-hub
 *
 * Shows ALL planned posts for the month in a beautiful hub:
 * - Platform filter tabs (All / Facebook / Instagram / X / LinkedIn / TikTok)
 * - Realistic platform-native post preview cards
 * - Per-post media source toggle: Generate AI / Use Uploaded / Upload Now
 * - Editable captions + image prompts inline
 * - "Generate All Images" — triggers bulk generation for approved posts
 * - Progress bar showing generation status
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { deriveCampaignOperatingState } from '@/lib/campaignOperatingState'
import { summarizeByDisplayState } from '@/lib/postVisibility'
import { getCreditActionTruth } from '@/lib/creditActionTruth'
import { useBillingStatus } from '@/lib/useBillingStatus'
import AppShell from '@/components/AppShell'

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'ALL' | 'META' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'TIKTOK' | 'TWITTER'
type MediaSource = 'GENERATE' | 'UPLOAD' | 'UPLOAD_RAW'
type GenStatus = 'PENDING' | 'GENERATING' | 'DONE' | 'FAILED' | 'AWAITING_UPLOAD' | 'SKIPPED'

interface ContentPost {
  id: string
  platform: string
  caption: string
  imageUrl: string | null
  imagePrompt: string | null
  videoPrompt: string | null
  isVideoPost: boolean
  generationStatus: GenStatus
  mediaSource: MediaSource
  uploadedMediaId: string | null
  contentPlanIndex: number
  scheduledAt: string | null
  status: 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  // Publishing lifecycle (manual publishing checklist — PR4)
  publishMode?: 'MANUAL' | 'AUTO' | null
  manuallyPublishedAt?: string | null
  platformUrl?: string | null
  // A/B Testing fields
  variantGroup: string | null
  variantLabel: string | null   // 'A' | 'B' | null
  variantWinner: boolean
}

interface MediaItem {
  id: string
  url: string
  fileName: string
  type: string
}

interface Campaign {
  id: string
  name: string
  platforms: string[]
  status?: string | null
  aiOutput?: unknown
  autopilotEnabled?: boolean | null
  autopilotActivatedAt?: string | Date | null
}

interface BrandProfile {
  brandName: string | null
  logoUrl: string | null
  colorPalette: string[]
}

interface StrategyHandoff {
  campaignId: string
  language?: string
  selectedMediaIds?: string[]
  ts?: number
}

const STRATEGY_HANDOFF_KEY = 'nexus_strategy_handoff'

function loadStrategyHandoff(campaignId: string): StrategyHandoff | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${STRATEGY_HANDOFF_KEY}:${campaignId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StrategyHandoff
    if (parsed.campaignId !== campaignId) return null
    return parsed
  } catch {
    return null
  }
}

// ── Platform config ────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
  icon: string
  cardStyle: string
}> = {
  META: {
    label: 'Facebook',
    color: '#1877F2',
    bg: '#f0f7ff',
    border: '#1877F2',
    icon: '📘',
    cardStyle: 'facebook',
  },
  INSTAGRAM: {
    label: 'Instagram',
    color: '#E1306C',
    bg: '#fff0f5',
    border: '#E1306C',
    icon: '📸',
    cardStyle: 'instagram',
  },
  X: {
    label: 'X',
    color: '#000000',
    bg: '#f7f7f7',
    border: '#000000',
    icon: '✕',
    cardStyle: 'twitter',
  },
  TWITTER: {
    label: 'X',
    color: '#000000',
    bg: '#f7f7f7',
    border: '#000000',
    icon: '✕',
    cardStyle: 'twitter',
  },
  LINKEDIN: {
    label: 'LinkedIn',
    color: '#0A66C2',
    bg: '#f0f5ff',
    border: '#0A66C2',
    icon: '💼',
    cardStyle: 'linkedin',
  },
  TIKTOK: {
    label: 'TikTok',
    color: '#010101',
    bg: '#f5f5f5',
    border: '#010101',
    icon: '🎵',
    cardStyle: 'tiktok',
  },
}

const getPlatformConfig = (p: string) =>
  PLATFORM_CONFIG[p.toUpperCase()] ?? {
    label: p,
    color: '#6366f1',
    bg: '#f0f0ff',
    border: '#6366f1',
    icon: '📣',
    cardStyle: 'default',
  }

// ── Main Component ─────────────────────────────────────────────────────────────

// Where to open each platform for manual posting (PR4 — no API, just a deep link home).
const PLATFORM_HOME_URLS: Record<string, string> = {
  META: 'https://facebook.com', FACEBOOK: 'https://facebook.com', INSTAGRAM: 'https://instagram.com',
  LINKEDIN: 'https://linkedin.com', TIKTOK: 'https://tiktok.com', TWITTER: 'https://x.com',
  YOUTUBE: 'https://youtube.com', SNAPCHAT: 'https://snapchat.com',
}
function platformHomeUrl(platform: string): string | null {
  return PLATFORM_HOME_URLS[platform?.toUpperCase()] ?? null
}

function hasValidDate(value: string | Date | null | undefined): boolean {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

export default function ContentHubPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
  const { creditsRemaining, isUnlimited, loading: billingLoading } = useBillingStatus()
  const isAr = locale === 'ar'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({ brandName: null, logoUrl: null, colorPalette: [] })
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
  const [activePlatform, setActivePlatform] = useState<Platform>('ALL')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState<string | null>(null) // postId
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<ContentPost>>>({})
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  // Manual publishing checklist (PR4) — for MANUAL + SCHEDULED posts
  const [manualPublishPost, setManualPublishPost] = useState<ContentPost | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const [manualPublishing, setManualPublishing] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [approveResult, setApproveResult] = useState<{
    kind: 'approved' | 'scheduled'
    approved: number
    linked: number
    unlinked: number
    learned: { hooks: number; angles: number }
    platforms: string[]
    firstDate: string | null
    lastDate: string | null
    pendingImages: number
    totalImages: number
    videoSlots: number
  } | null>(null)
  const [rewritingPost, setRewritingPost] = useState<string | null>(null)
  const [enableABTesting, setEnableABTesting] = useState(false)
  const [pickingWinner, setPickingWinner] = useState<string | null>(null)
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE' | 'SCHEDULED' | 'PUBLISHED'>('ALL')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const autoBuildStartedRef = useRef(false)

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (): Promise<ContentPost[]> => {
    if (!isAuthenticated) return []
    let loadedPosts: ContentPost[] = []
    try {
      // Load campaign
      const cRes = await fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: authHeader() } })
      if (!cRes.ok) throw new Error('Campaign not found')
      const { campaign: c } = await cRes.json()
      setCampaign({
        id: c.id,
        name: c.name,
        platforms: c.platforms ?? [],
        status: c.status ?? null,
        aiOutput: c.aiOutput ?? null,
        autopilotEnabled: c.autopilotEnabled ?? null,
        autopilotActivatedAt: c.autopilotActivatedAt ?? null,
      })

      // Load content plan posts
      const pRes = await fetch(`/api/campaigns/${campaignId}/content-plan`, {
        headers: { Authorization: authHeader() },
      })
      if (pRes.ok) {
        const { posts: rawPosts } = await pRes.json()
        loadedPosts = rawPosts ?? []
        setPosts(loadedPosts)
      }

      // Load media library
      const mRes = await fetch('/api/media', { headers: { Authorization: authHeader() } })
      if (mRes.ok) {
        const mData = await mRes.json()
        setMediaLibrary(mData.media ?? mData.items ?? [])
      }

      // Load brand profile (for name + logo in mockups)
      const bRes = await fetch('/api/brand', { headers: { Authorization: authHeader() } })
      if (bRes.ok) {
        const bData = await bRes.json()
        if (bData.brandProfile) {
          setBrandProfile({
            brandName: bData.brandProfile.brandName ?? null,
            logoUrl: bData.brandProfile.logoUrl ?? null,
            colorPalette: bData.brandProfile.colorPalette ?? [],
          })
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
    return loadedPosts
  }, [authHeader, campaignId])

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData()
  }, [authLoading, isAuthenticated, loadData])

  // ── Poll generating status ────────────────────────────────────────────────────

  useEffect(() => {
    const generating = posts.some(p => p.generationStatus === 'GENERATING')
    if (generating && !pollRef.current) {
      pollRef.current = setInterval(loadData, 4000)
    } else if (!generating && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [posts, loadData])

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const filteredPosts = posts
    .filter(p => activePlatform === 'ALL' || p.platform.toUpperCase() === activePlatform)
    .filter(p => {
      if (statusFilter === 'ALL') return true
      if (statusFilter === 'PENDING') return p.generationStatus === 'PENDING' || p.generationStatus === 'AWAITING_UPLOAD'
      if (statusFilter === 'DONE') return p.generationStatus === 'DONE'
      if (statusFilter === 'SCHEDULED') return p.status === 'SCHEDULED'
      if (statusFilter === 'PUBLISHED') return p.status === 'PUBLISHED'
      return true
    })

  const platforms = ['ALL', ...Array.from(new Set(posts.map(p => p.platform.toUpperCase())))]

  const doneCount = posts.filter(p => p.generationStatus === 'DONE').length
  const totalImagePosts = posts.filter(p => !p.isVideoPost).length
  const progress = totalImagePosts > 0 ? Math.round((doneCount / totalImagePosts) * 100) : 0
  const draftCount = posts.filter(p => p.status === 'DRAFT').length
  const approvedCount = posts.filter(p => p.status === 'APPROVED').length
  const scheduledCount = posts.filter(p => p.status === 'SCHEDULED' && hasValidDate(p.scheduledAt)).length
  const publishedCount = posts.filter(p => p.status === 'PUBLISHED').length
  const videoPostCount = posts.filter(p => p.isVideoPost).length
  const approvedOnlyCount = draftCount === 0 && approvedCount > 0 && scheduledCount === 0 && publishedCount === 0
  const operatingState = deriveCampaignOperatingState({ campaign, posts })
  const operatingLabel = isAr ? operatingState.stageLabelAr : operatingState.stageLabel
  const operatingHelper = isAr ? operatingState.stageHelperAr : operatingState.stageHelper
  const visualReadyLabel = isAr ? 'الوسائط جاهزة' : 'Media ready'
  const mediaPendingLabel = isAr ? 'الوسائط بانتظار التوليد' : 'Media pending'
  const contentStatusSummary = (() => {
    if (approvedOnlyCount) {
      return isAr
        ? `${approvedCount} منشورات معتمدة بانتظار الجدولة · ${totalImagePosts} خانات صور · ${videoPostCount} خانات فيديو · ${doneCount} عناصر مرئية جاهزة`
        : `${approvedCount} approved posts awaiting scheduling · ${totalImagePosts} image slots · ${videoPostCount} video slots · ${doneCount} visuals generated`
    }

    return `${posts.length} ${t('contentHub.draftsToReview')} · ${totalImagePosts} ${t('contentHub.imageSlots')} · ${videoPostCount} ${t('contentHub.videoSlots')} · ${doneCount} ${t('contentHub.visualsGenerated')}`
  })()
  const contentStatusExplainer = approvedOnlyCount
    ? (isAr
      ? 'تم اعتماد المحتوى. الصور والوسائط ما زالت مرحلة منفصلة، والجدولة والنشر يحتاجان قراراً منفصلاً.'
      : 'Content has been approved. Media generation remains separate, and scheduling or publishing still requires a separate decision.')
    : t('contentHub.countExplainer')
  const imageGenerationTruth = getCreditActionTruth({
    action: 'IMAGE_GENERATION',
    creditsRemaining,
    isUnlimited,
  })
  const contentPlanTruth = getCreditActionTruth({
    action: 'CONTENT_PLAN_GENERATION',
    creditsRemaining,
    isUnlimited,
  })
  const imageGenerationLocked = !billingLoading && !imageGenerationTruth.canAfford
  const contentPlanLocked = !billingLoading && !contentPlanTruth.canAfford
  const addCreditsForImagesLabel = isAr ? 'أضف رصيداً لتوليد الصور' : 'Add credits to generate images'
  const contentPlanCostLabel = isAr
    ? `${contentPlanTruth.cost} كريديت`
    : `${contentPlanTruth.cost} credit${contentPlanTruth.cost === 1 ? '' : 's'}`
  const draftPlanLabel = isAr
    ? `توليد خطة محتوى مسودة — ${contentPlanCostLabel}`
    : `Generate draft content plan — ${contentPlanCostLabel}`
  const regenerateDraftPlanLabel = isAr
    ? `إعادة توليد خطة محتوى مسودة — ${contentPlanCostLabel}`
    : `Regenerate draft content plan — ${contentPlanCostLabel}`
  const addCreditsForDraftPlanLabel = isAr
    ? `أضف رصيداً لتوليد خطة محتوى مسودة — ${contentPlanCostLabel}`
    : `Add credits to generate draft content plan — ${contentPlanCostLabel}`
  const addCreditsForRegenerateDraftPlanLabel = isAr
    ? `أضف رصيداً لإعادة توليد خطة محتوى مسودة — ${contentPlanCostLabel}`
    : `Add credits to regenerate draft content plan — ${contentPlanCostLabel}`
  const contentPlanRequirementDisclosure = isAr
    ? `يتطلب ${contentPlanCostLabel}.`
    : `Requires ${contentPlanCostLabel}.`
  const contentPlanDisclosure = approvedOnlyCount
    ? (isAr
      ? 'المنشورات المعتمدة محفوظة. إعادة التوليد تنشئ خطة مسودة جديدة للمراجعة فقط ولا تجدول أو تنشر المحتوى الحالي.'
      : 'Approved posts are saved. Regenerating creates a new draft plan for review only and does not schedule or publish current content.')
    : (isAr
      ? 'ينشئ مسودات للمراجعة فقط. لا يتم الاعتماد أو الجدولة أو النشر.'
      : 'Creates draft posts for review only. Nothing is approved, scheduled, or published.')
  const contentPlanAutopilotDisclosure = isAr
    ? 'لا يتم تفعيل الأوتوبايلوت.'
    : 'Autopilot is not activated.'
  const creditBalanceLabel = billingLoading
    ? (isAr ? 'جارٍ تحديث الرصيد' : 'Checking credit balance')
    : isUnlimited
      ? (isAr ? 'رصيد غير محدود' : 'Unlimited credits')
      : isAr
        ? `رصيدك الحالي: ${Math.max(0, Math.trunc(creditsRemaining))} كريديت`
        : `Current balance: ${Math.max(0, Math.trunc(creditsRemaining))} credits`

  const getPendingEdit = (postId: string) => pendingEdits[postId] ?? {}

  // ── Generate content plan ────────────────────────────────────────────────────

  async function generatePlan(mediaSource: 'GENERATE' | 'MIXED' = 'GENERATE') {
    if (!isAuthenticated) return
    if (contentPlanLocked) {
      setError(addCreditsForDraftPlanLabel)
      return
    }
    setGeneratingPlan(true)
    setError(null)
    try {
      const handoff = loadStrategyHandoff(campaignId)
      const res = await fetch(`/api/campaigns/${campaignId}/generate-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaSource,
          enableABTesting,
          ...(handoff?.language ? { language: handoff.language } : {}),
          ...(handoff && Array.isArray(handoff.selectedMediaIds)
            ? { selectedMediaIds: handoff.selectedMediaIds }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      // PR-1J.2: summary.total = base posts; A/B variants are added on top. Show the
      // honest math (base + variants = drafts) so "18" and "36" never look contradictory.
      // "drafts to review" — not "ready for review" — since they still need approval.
      const bVariants = data.summary?.abTesting?.enabled ? (data.summary.abTesting.bVariants ?? 0) : 0
      const totalDrafts = (data.summary?.total ?? 0) + bVariants
      setSuccessMsg(
        bVariants > 0
          ? `Content plan created: ${data.summary.total} base posts + ${bVariants} A/B variants = ${totalDrafts} drafts to review`
          : `Content plan created: ${data.summary.total} drafts to review`,
      )
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingPlan(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (autoBuildStartedRef.current || authLoading || loading || !isAuthenticated || generatingPlan || posts.length > 0) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('buildPlan') !== '1') return

    autoBuildStartedRef.current = true
    params.delete('buildPlan')
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState(null, '', nextUrl)
    void generatePlan('MIXED')
  }, [authLoading, loading, isAuthenticated, generatingPlan, posts.length])

  // ── Save inline edits ────────────────────────────────────────────────────────

  async function savePostEdit(postId: string, updates: Partial<ContentPost>) {
    if (!isAuthenticated) return
    try {
      await fetch(`/api/campaigns/${campaignId}/content-plan/${postId}`, {
        method: 'PATCH',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p))
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    } catch (err) {
      console.error('Failed to save edit', err)
    }
  }

  // ── Assign uploaded media to a post ─────────────────────────────────────────

  async function assignMedia(postId: string, mediaId: string, mediaUrl: string) {
    await savePostEdit(postId, {
      uploadedMediaId: mediaId,
      imageUrl: mediaUrl,
      mediaSource: 'UPLOAD_RAW',
      generationStatus: 'DONE',
    })
    setMediaPickerOpen(null)
  }

  // ── Bulk generate images ─────────────────────────────────────────────────────

  async function generateAllImages() {
    if (!isAuthenticated) return
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-content-plan/generate`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).map(p => p.id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setSuccessMsg('Image generation started — this may take a few minutes')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Approve all posts → scheduled ────────────────────────────────────────────

  async function approveAll() {
    if (!isAuthenticated) return
    setApproving(true)
    setShowApproveConfirm(false)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/approve-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Approval failed')

      // Reload posts and compute the summary from fresh data, not stale React state.
      const freshPosts = await loadData()

      // Build approval result for the summary modal (approved posts keep their
      // planned dates from generation — they are not "scheduled" until the user
      // schedules them in the next step).
      const approvedPosts = freshPosts.filter(p => p.status === 'APPROVED' && hasValidDate(p.scheduledAt))
      const scheduledDates = approvedPosts
        .map(p => p.scheduledAt!)
        .sort()
      const platformsUsed = [...new Set(approvedPosts.map(p => p.platform.toUpperCase()))]
      const totalFreshImagePosts = freshPosts.filter(p => !p.isVideoPost).length
      const pendingFreshImages = freshPosts.filter(p =>
        !p.isVideoPost &&
        (p.generationStatus === 'PENDING' || p.generationStatus === 'AWAITING_UPLOAD' || p.generationStatus === 'FAILED')
      ).length

      setApproveResult({
        kind: 'approved',
        approved:  data.approved  ?? 0,
        linked:    data.linked    ?? 0,
        unlinked:  data.unlinked  ?? 0,
        learned: {
          hooks:  data.learned?.hooks  ?? 0,
          angles: data.learned?.angles ?? 0,
        },
        platforms: platformsUsed.length > 0 ? platformsUsed : (data.summary?.platforms ?? []),
        firstDate: scheduledDates[0] ?? null,
        lastDate:  scheduledDates[scheduledDates.length - 1] ?? null,
        pendingImages: pendingFreshImages,
        totalImages: totalFreshImagePosts,
        videoSlots: freshPosts.filter(p => p.isVideoPost).length,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(false)
    }
  }

  // ── Schedule approved posts → SCHEDULED (separate decision from approval) ──────

  async function scheduleAll() {
    if (!isAuthenticated) return
    setScheduling(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/schedule-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scheduling failed')

      const freshPosts = await loadData()
      const scheduledPosts = freshPosts.filter(p => p.status === 'SCHEDULED' && hasValidDate(p.scheduledAt))
      const scheduledDates = scheduledPosts.map(p => p.scheduledAt!).sort()
      const platformsUsed = [...new Set(scheduledPosts.map(p => p.platform.toUpperCase()))]

      setApproveResult({
        kind: 'scheduled',
        approved:  data.scheduled ?? 0,
        linked:    data.linked    ?? 0,
        unlinked:  0,
        learned: { hooks: 0, angles: 0 },
        platforms: platformsUsed,
        firstDate: scheduledDates[0] ?? null,
        lastDate:  scheduledDates[scheduledDates.length - 1] ?? null,
        pendingImages: 0,
        totalImages: 0,
        videoSlots: 0,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScheduling(false)
    }
  }

  // ── Manual publishing (PR4): record the user's own confirmation they posted it ──
  // NEXUS does NOT publish to any platform here — no social API call.

  async function copyCaption(text: string) {
    try { await navigator.clipboard.writeText(text); setCaptionCopied(true); setTimeout(() => setCaptionCopied(false), 1800) } catch { /* clipboard blocked */ }
  }

  async function confirmManualPublish() {
    const post = manualPublishPost
    if (!post || !isAuthenticated) return
    setManualPublishing(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content-plan/${post.id}/manual-publish`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveUrl: manualUrl.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to mark as published')
      await loadData()
      setManualPublishPost(null)
      setManualUrl('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setManualPublishing(false)
    }
  }

  // ── AI Rewrite a post caption ─────────────────────────────────────────────────

  async function rewritePost(postId: string, instruction: string) {
    if (!isAuthenticated) return
    setRewritingPost(postId)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content-plan/${postId}/rewrite`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') {
          setError('Not enough credits to rewrite. Upgrade your plan.')
        } else {
          throw new Error(data.error ?? 'Rewrite failed')
        }
        return
      }
      // Update caption in state immediately (no re-fetch needed)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption: data.post.caption } : p))
      // Clear any pending edit for this post so it shows the fresh caption
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRewritingPost(null)
    }
  }

  // ── Generate real AI image for a single post ─────────────────────────────────
  // Calls /api/visuals/generate → gpt-image-1 or Flux → Cloudinary + brand overlay

  async function generatePostImage(postId: string, platform: string) {
    if (!isAuthenticated) return
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    const post = posts.find(p => p.id === postId)
    if (!post) return

    // Cost confirmation before spending credits (failed generations are refunded).
    if (typeof window !== 'undefined' &&
        !window.confirm('Generate image for 3 credits? Failed generations are refunded.')) {
      return
    }

    setGeneratingImageId(postId)
    setError(null)
    try {
      // Platform mapping — drives both image dimensions and Cloudinary crop.
      // META feed posts are square (1:1) same as INSTAGRAM; FACEBOOK is landscape.
      // TIKTOK is portrait 4:5. LINKEDIN is landscape 1.91:1.
      const platformMap: Record<string, string> = {
        META:      'INSTAGRAM',  // Meta feed → square 1024×1024
        INSTAGRAM: 'INSTAGRAM',  // Instagram → square 1024×1024
        FACEBOOK:  'FACEBOOK',   // Facebook  → landscape 1536×1024
        LINKEDIN:  'LINKEDIN',   // LinkedIn  → landscape 1536×1024
        TIKTOK:    'TIKTOK',     // TikTok    → portrait  1024×1536
        X:         'FACEBOOK',   // X/Twitter → landscape
        TWITTER:   'FACEBOOK',   // X/Twitter → landscape
      }
      const mappedPlatform = platformMap[platform.toUpperCase()] || 'INSTAGRAM'

      // Call the existing brand-aware image generation route
      // postCaption drives the scene; brand colors + logo overlay applied server-side
      const res = await fetch('/api/visuals/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({
          campaignId:  campaign?.id,
          platform:    mappedPlatform,
          visualType:  'SOCIAL_PREVIEW',
          visualStyle: 'Premium',
          postCaption: post.caption || post.imagePrompt || '',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Image generation failed')
      }

      const data = await res.json()
      const imageUrl = data?.visual?.imageUrl
      if (!imageUrl) throw new Error('No image URL returned')

      await savePostEdit(postId, { imageUrl, generationStatus: 'DONE' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingImageId(null)
    }
  }

  // ── Pick A/B winner ───────────────────────────────────────────────────────────

  async function pickWinner(postId: string) {
    if (!isAuthenticated) return
    setPickingWinner(postId)
    setError(null)
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/content-plan/${postId}/pick-winner`,
        { method: 'PATCH', headers: { Authorization: authHeader() } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to pick winner')

      // Remove the loser from local state, mark winner
      setPosts(prev => {
        const winner = prev.find(p => p.id === postId)
        if (!winner) return prev
        const varGroup = winner.variantGroup
        // Keep posts where: not in this variantGroup OR same id as winner
        return prev
          .filter(p => !varGroup || p.variantGroup !== varGroup || p.id === postId)
          .map(p => p.id === postId
            ? { ...p, variantWinner: true, variantGroup: null, variantLabel: null }
            : p,
          )
      })

      setSuccessMsg(
        data.hookLearned
          ? '🏆 Winner selected! Hook added to Brand Brain.'
          : '🏆 Winner selected!',
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPickingWinner(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-slate-500">Campaign not found</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <button
              onClick={() => router.push(`/campaigns/${campaignId}`)}
              className="text-sm text-slate-500 hover:text-[#5E5CE6] flex items-center gap-1 mb-2 transition-colors"
            >
              ← {campaign.name}
            </button>
            <h1 className="text-2xl font-bold text-slate-950">{t('contentHub.title')}</h1>
            {/* PR-1J.2 — every count labeled distinctly so 36/32/4/done can't read as
                a contradiction: 36 drafts (incl. A/B variants) = 32 image slots + 4
                video slots; "visuals generated" tracks generation progress separately. */}
            {posts.length > 0 ? (
              <>
                <p className="text-sm text-slate-500 mt-0.5">
                  {contentStatusSummary}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">{contentStatusExplainer}</p>
                <div className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-violet-500" />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">{operatingLabel}</span>
                    <span className="block text-xs text-slate-500">{operatingHelper}</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5">{t('contentHub.generatePrompt')}</p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {posts.length > 0 && (
              <>
                {/* Primary CTA — honest two-step lifecycle:
                    DRAFT → Approve → APPROVED → Schedule → SCHEDULED */}
                {draftCount > 0 ? (
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={approving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                    style={{
                      background: '#059669',
                      color: 'white',
                      opacity: approving ? 0.6 : 1,
                    }}
                  >
                    {approving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {t('contentHub.approving')}
                      </>
                    ) : (
                      <>
                        ✓ {t('contentHub.approveAll')}
                        <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                          {draftCount}
                        </span>
                      </>
                    )}
                  </button>
                ) : approvedCount > 0 ? (
                  <button
                    onClick={scheduleAll}
                    disabled={scheduling}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                    style={{
                      background: '#4F46E5',
                      color: 'white',
                      opacity: scheduling ? 0.6 : 1,
                    }}
                  >
                    {scheduling ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {t('contentHub.scheduling')}
                      </>
                    ) : (
                      <>
                        🗓 {t('contentHub.scheduleAll')}
                        <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                          {approvedCount}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{ background: '#ECFDF5', color: '#047857', border: '1px solid rgba(5,150,105,0.18)' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13.5 4.5l-7 7-3-3"/></svg>
                    {scheduledCount > 0
                      ? (isAr ? 'المحتوى المعتمد مجدول' : 'Approved content scheduled')
                      : (isAr ? 'اكتملت مراجعة المحتوى' : 'Content review complete')}
                  </div>
                )}

                <button
                  onClick={imageGenerationLocked ? () => router.push('/billing') : generateAllImages}
                  disabled={generating || posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                  style={{
                    background: imageGenerationLocked ? '#F8FAFC' : '#111827',
                    color: imageGenerationLocked ? '#475569' : 'white',
                    border: imageGenerationLocked ? '1px solid rgba(15,23,42,0.12)' : '1px solid transparent',
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  {generating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {t('contentHub.generatingImages')}
                    </>
                  ) : (
                    <>
                      ✨ {imageGenerationLocked ? addCreditsForImagesLabel : t('contentHub.generateImages')}
                      {posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length > 0 && (
                        <span className="rounded-full px-1.5 py-0.5 text-xs" style={{ background: imageGenerationLocked ? '#EEF2FF' : 'rgba(255,255,255,0.20)' }}>
                          {posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length}
                        </span>
                      )}
                    </>
                  )}
                </button>
                <div className="flex max-w-sm flex-col items-start gap-1 sm:items-end">
                  <button
                    onClick={contentPlanLocked ? () => router.push('/billing') : () => generatePlan()}
                    disabled={generatingPlan}
                    className="px-4 py-2 rounded-xl text-sm border transition-all"
                    style={{ borderColor: contentPlanLocked ? 'rgba(239,68,68,0.18)' : 'rgba(15,23,42,0.14)', color: contentPlanLocked ? '#B91C1C' : '#374151', background: contentPlanLocked ? '#FEF2F2' : '#FFFFFF' }}
                  >
                    {generatingPlan ? t('contentHub.regenerating') : contentPlanLocked ? addCreditsForRegenerateDraftPlanLabel : `↻ ${regenerateDraftPlanLabel}`}
                  </button>
                  <p className="text-xs leading-relaxed text-slate-500 sm:text-right">
                    {contentPlanLocked ? `${contentPlanRequirementDisclosure} ` : ''}{contentPlanDisclosure} {contentPlanAutopilotDisclosure}
                  </p>
                  <p className="text-[11px] text-slate-400">{creditBalanceLabel}</p>
                </div>
              </>
            )}

            {posts.length === 0 && (
              <div className="flex items-center gap-3">
                {/* A/B Testing toggle */}
                <button
                  onClick={() => setEnableABTesting(prev => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: enableABTesting ? '#FFFBEB' : '#FFFFFF',
                    border: enableABTesting ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(15,23,42,0.10)',
                    color: enableABTesting ? '#B45309' : '#6b7280',
                  }}
                  title="Generate A/B variants for each post — compare two hook styles and pick the winner"
                >
                  <span>A/B</span>
                  <span className={`w-6 h-3 rounded-full relative transition-all ${enableABTesting ? 'bg-yellow-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-2 h-2 bg-white rounded-full shadow transition-all ${enableABTesting ? 'left-3.5' : 'left-0.5'}`} />
                  </span>
                </button>
                <div className="flex max-w-sm flex-col items-start gap-1 sm:items-end">
                  <button
                    onClick={contentPlanLocked ? () => router.push('/billing') : () => generatePlan()}
                    disabled={generatingPlan}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                    style={{
                      background: contentPlanLocked ? '#FEF2F2' : '#111827',
                      color: contentPlanLocked ? '#B91C1C' : 'white',
                      border: contentPlanLocked ? '1px solid rgba(239,68,68,0.18)' : '1px solid transparent',
                      opacity: generatingPlan ? 0.6 : 1,
                    }}
                  >
                    {generatingPlan ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {t('contentHub.buildingPlanShort')}
                      </>
                    ) : contentPlanLocked ? addCreditsForDraftPlanLabel : `✨ ${draftPlanLabel}`}
                  </button>
                  <p className="text-xs leading-relaxed text-slate-500 sm:text-right">
                    {contentPlanLocked ? `${contentPlanRequirementDisclosure} ` : ''}{contentPlanDisclosure} {contentPlanAutopilotDisclosure}
                  </p>
                  <p className="text-[11px] text-slate-400">{creditBalanceLabel}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Messages ─────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl text-sm text-green-700 bg-green-50 border border-green-200 flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-400">×</button>
          </div>
        )}

        {/* ── Progress bar ─────────────────────────────────────────── */}
        {totalImagePosts > 0 && (
          <div className="mb-5 p-3 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-700 font-medium">{t('contentHub.imageProgress')}</span>
              <span className="text-slate-500">{doneCount} / {totalImagePosts} {t('contentHub.images')}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #111827, #5E5CE6)' }}
              />
            </div>
          </div>
        )}

        {/* ── Filter bar (sticky) ──────────────────────────────────── */}
        {posts.length > 0 && (
          <div className="sticky top-0 z-10 mb-5 -mx-6 px-6 py-3"
            style={{ background: 'rgba(245,245,247,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
            {/* Platform tabs */}
            <div className="flex gap-2 flex-wrap mb-2.5">
              {platforms.map(p => {
                const cfg = p === 'ALL' ? null : getPlatformConfig(p)
                const count = p === 'ALL' ? posts.length : posts.filter(post => post.platform.toUpperCase() === p).length
                const isActive = activePlatform === p
                return (
                  <button
                    key={p}
                    onClick={() => setActivePlatform(p as Platform)}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5"
                    style={{
                      background: isActive ? (cfg ? cfg.color : '#111827') : '#FFFFFF',
                      color: isActive ? '#fff' : '#6b7280',
                      border: isActive ? `1px solid ${cfg ? cfg.color : '#111827'}` : '1px solid rgba(15,23,42,0.10)',
                    }}
                  >
                    {cfg && <span>{cfg.icon}</span>}
                    {p === 'ALL' ? t('contentHub.allPlatforms') : (cfg?.label ?? p)}
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6', color: isActive ? '#fff' : '#6b7280' }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            {/* PR5: honest execution-state summary — keeps published posts visible */}
            {posts.length > 0 && (() => {
              const sum = summarizeByDisplayState(posts as any)
              const scheduled = sum.scheduledManual + sum.scheduledAuto
              const chips = [
                sum.draft     > 0 && { label: t('contentHub.sumDraft'),     n: sum.draft,     color: '#7c3aed' },
                sum.approved  > 0 && { label: t('contentHub.sumApproved'),  n: sum.approved,  color: '#059669' },
                scheduled     > 0 && { label: t('contentHub.sumScheduled'), n: scheduled,     color: '#6366f1' },
                sum.published > 0 && { label: t('contentHub.sumPublished'), n: sum.published, color: '#10b981' },
                sum.failed    > 0 && { label: t('contentHub.sumFailed'),    n: sum.failed,    color: '#ef4444' },
              ].filter(Boolean) as { label: string; n: number; color: string }[]
              return chips.length > 0 ? (
                <div className="flex gap-1.5 items-center flex-wrap mb-2">
                  {chips.map((c, i) => (
                    <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={{ background: `${c.color}12`, color: c.color, border: `1px solid ${c.color}33` }}>
                      {c.n} {c.label}
                    </span>
                  ))}
                </div>
              ) : null
            })()}
            {/* Status filter */}
            <div className="flex gap-1.5 items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-1">{t('contentHub.statusLabel')}</span>
              {(['ALL', 'PENDING', 'DONE', 'SCHEDULED', 'PUBLISHED'] as const).map(s => {
                const isActive = statusFilter === s
                const label = s === 'ALL' ? t('contentHub.filterAll') : s === 'PENDING' ? mediaPendingLabel : s === 'DONE' ? `✓ ${visualReadyLabel}` : s === 'SCHEDULED' ? `🗓 ${t('contentHub.filterScheduled')}` : `✅ ${t('contentHub.filterPublished')}`
                const activeColor = s === 'DONE' ? '#10b981' : s === 'PENDING' ? '#f59e0b' : s === 'SCHEDULED' ? '#6366f1' : s === 'PUBLISHED' ? '#10b981' : '#7c3aed'
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isActive ? `${activeColor}18` : '#FFFFFF',
                      color: isActive ? activeColor : '#6b7280',
                      border: isActive ? `1px solid ${activeColor}44` : '1px solid rgba(15,23,42,0.08)',
                    }}>
                    {label}
                  </button>
                )
              })}
              {(activePlatform !== 'ALL' || statusFilter !== 'ALL') && (
                <button onClick={() => { setActivePlatform('ALL'); setStatusFilter('ALL') }}
                  className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-900 transition-all ml-1"
                  style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                  ✕ {t('contentHub.clear')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {posts.length === 0 && !generatingPlan && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
              📅
            </div>
            <h3 className="text-lg font-semibold text-slate-950 mb-2">{t('contentHub.emptyTitle')}</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              {t('contentHub.emptyDesc')}
            </p>
          </div>
        )}

        {generatingPlan && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
              <span className="w-8 h-8 border-2 border-purple-500/40 border-t-purple-400 rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-slate-950 mb-2">{t('contentHub.buildingTitle')}</h3>
            <p className="text-sm text-slate-500">{t('contentHub.buildingDesc')}</p>
          </div>
        )}

        {/* ── Post grid ────────────────────────────────────────────── */}
        {filteredPosts.length > 0 && (() => {
          // Group posts: A/B pairs are rendered together, standalone posts are standalone
          const sorted = [...filteredPosts].sort((a, b) => (a.contentPlanIndex ?? 0) - (b.contentPlanIndex ?? 0))

          // Build render items: A/B pairs as { type: 'ab', a, b } or standalone as { type: 'single', post }
          type RenderItem =
            | { type: 'single'; post: ContentPost }
            | { type: 'ab'; a: ContentPost; b: ContentPost }

          const seen = new Set<string>()
          const items: RenderItem[] = []

          for (const post of sorted) {
            if (seen.has(post.id)) continue
            if (post.variantGroup) {
              const sibling = sorted.find(p => p.variantGroup === post.variantGroup && p.id !== post.id)
              if (sibling && !seen.has(sibling.id)) {
                const [a, b] = post.variantLabel === 'A' ? [post, sibling] : [sibling, post]
                items.push({ type: 'ab', a, b })
                seen.add(post.id)
                seen.add(sibling.id)
                continue
              }
            }
            items.push({ type: 'single', post })
            seen.add(post.id)
          }

          const renderCard = (post: ContentPost) => (
            <PostCard
              key={post.id}
              post={post}
              pendingEdit={getPendingEdit(post.id)}
              mediaLibrary={mediaLibrary}
              brandName={brandProfile.brandName ?? campaign?.name ?? 'your_brand'}
              brandLogo={brandProfile.logoUrl ?? null}
              isExpanded={expandedPost === post.id}
              isEditingCaption={editingCaption === post.id}
              isEditingPrompt={editingPrompt === post.id}
              mediaPickerOpen={mediaPickerOpen === post.id}
              isRewriting={rewritingPost === post.id}
              isPickingWinner={pickingWinner === post.id}
              isGeneratingImage={generatingImageId === post.id}
              imageGenerationLocked={imageGenerationLocked}
              addCreditsForImagesLabel={addCreditsForImagesLabel}
              onGenerateImage={() => generatePostImage(post.id, post.platform)}
              onAddCredits={() => router.push('/billing')}
              onToggleExpand={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              onEditCaption={() => setEditingCaption(editingCaption === post.id ? null : post.id)}
              onEditPrompt={() => setEditingPrompt(editingPrompt === post.id ? null : post.id)}
              onOpenMediaPicker={() => setMediaPickerOpen(mediaPickerOpen === post.id ? null : post.id)}
              onCloseMediaPicker={() => setMediaPickerOpen(null)}
              onSaveEdit={(updates) => savePostEdit(post.id, updates)}
              onAssignMedia={(mediaId, url) => assignMedia(post.id, mediaId, url)}
              onPendingEdit={(updates) => setPendingEdits(prev => ({
                ...prev,
                [post.id]: { ...(prev[post.id] ?? {}), ...updates }
              }))}
              onRewrite={(instruction) => rewritePost(post.id, instruction)}
              onPickWinner={post.variantGroup ? () => pickWinner(post.id) : undefined}
              onManualPublish={() => { setManualPublishPost(post); setManualUrl('') }}
            />
          )

          // Pre-group: consecutive singles share a grid row; A/B pairs break out full-width
          type RenderGroup =
            | { type: 'singles'; posts: ContentPost[] }
            | { type: 'ab'; a: ContentPost; b: ContentPost; groupKey: string }
          const groups: RenderGroup[] = []
          let singlesBuffer: ContentPost[] = []
          for (const item of items) {
            if (item.type === 'single') {
              singlesBuffer.push(item.post)
            } else {
              if (singlesBuffer.length) { groups.push({ type: 'singles', posts: singlesBuffer }); singlesBuffer = [] }
              groups.push({ type: 'ab', a: item.a, b: item.b, groupKey: `ab-${item.a.variantGroup ?? item.a.id}` })
            }
          }
          if (singlesBuffer.length) groups.push({ type: 'singles', posts: singlesBuffer })

          return (
            <div className="space-y-4">
              {groups.map((group) => {
                if (group.type === 'singles') {
                  return (
                    <div key={`singles-${group.posts[0].id}`} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.posts.map(p => renderCard(p))}
                    </div>
                  )
                }
                // A/B pair — full-width container
                return (
                  <div key={group.groupKey} className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(234,179,8,0.25)', background: 'rgba(234,179,8,0.02)' }}>
                    <div className="flex items-center gap-2 px-4 py-2.5"
                      style={{ background: 'rgba(234,179,8,0.06)', borderBottom: '1px solid rgba(234,179,8,0.15)' }}>
                      <span className="text-sm font-semibold" style={{ color: '#fbbf24' }}>⚡ A/B Test</span>
                      <span className="text-xs text-slate-500">· Compare both variants and pick the winner</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                      {renderCard(group.a)}
                      {renderCard(group.b)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* ── Approve All confirm dialog ───────────────────────────────── */}
        {showApproveConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowApproveConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: '#ECFDF5', border: '1px solid rgba(5,150,105,0.18)' }}>
                📅
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">{t('contentHub.approveConfirmTitle')}</h3>
              <p className="text-sm text-slate-600 mb-1">
                {t('contentHub.approveConfirmBody1')} <span className="text-slate-950 font-semibold">({posts.filter(p => p.status === 'DRAFT').length} {t('contentHub.draftPosts')})</span>
              </p>
              <p className="text-sm text-slate-500 mb-6">
                {t('contentHub.approveConfirmBody2')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:text-slate-950 border transition-all"
                  style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#FFFFFF' }}
                >
                  {t('contentHub.cancel')}
                </button>
                <button
                  onClick={approveAll}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                >
                  ✓ {t('contentHub.approveConfirmYes')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Approval Summary Modal ────────────────────────────────── */}
        {approveResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }}
            onClick={() => setApproveResult(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #059669, #34d399, #7c3aed)' }} />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ background: '#ECFDF5', border: '1px solid rgba(5,150,105,0.18)' }}>
                      {approveResult.kind === 'scheduled' ? '📅' : '✓'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        {approveResult.approved} {approveResult.kind === 'scheduled'
                          ? t('contentHub.postsScheduled')
                          : t('contentHub.postsApproved')}
                      </h3>
                      <p className="text-sm text-emerald-600">
                        {approveResult.kind === 'scheduled'
                          ? (isAr ? 'تمت الجدولة فقط — لم يتم النشر' : 'Scheduled only — not published')
                          : (isAr ? 'تم حفظ الاعتماد — ما زالت الجدولة خطوة منفصلة' : 'Approval saved — scheduling is still separate')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setApproveResult(null)}
                    className="text-slate-400 hover:text-slate-700 text-xl leading-none"
                  >×</button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-slate-950">{approveResult.approved}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Posts</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-emerald-600">{approveResult.linked}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Linked</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-[#5E5CE6]">{approveResult.platforms.length}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Platforms</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-cyan-600">{approveResult.pendingImages}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Images left</div>
                  </div>
                </div>

                {/* Platform breakdown */}
                {approveResult.platforms.length > 0 && (
                  <div className="rounded-xl p-3 mb-4"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
                      {approveResult.kind === 'scheduled'
                        ? (isAr ? 'مجدول على' : 'Scheduled for')
                        : (isAr ? 'مخطط لـ' : 'Planned for')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {approveResult.platforms.map(p => {
                        const cfg = getPlatformConfig(p)
                        const count = posts.filter(post => post.platform.toUpperCase() === p && post.status === 'SCHEDULED').length
                        return (
                          <div key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}35`, color: cfg.color }}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                            {count > 0 && <span className="opacity-70">×{count}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Schedule window */}
                {(approveResult.firstDate || approveResult.lastDate) && (
                  <div className="rounded-xl p-3 mb-4 flex items-center gap-3"
                    style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                    <span className="text-lg">📅</span>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">
                        {approveResult.kind === 'scheduled'
                          ? (isAr ? 'نافذة المحتوى المجدول' : 'Scheduled content window')
                          : (isAr ? 'نافذة المحتوى المخطط' : 'Planned content window')}
                      </p>
                      <p className="text-sm text-[#5E5CE6] font-medium">
                        {approveResult.firstDate
                          ? new Date(approveResult.firstDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                        {' → '}
                        {approveResult.lastDate
                          ? new Date(approveResult.lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Brand Brain learning */}
                {(approveResult.learned.hooks > 0 || approveResult.learned.angles > 0) && (
                  <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                    style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                    <span className="text-xl mt-0.5">🧠</span>
                    <div>
                      <p className="text-sm font-semibold text-[#5E5CE6] mb-0.5">
                        {isAr ? 'تم حفظ إشارات الاعتماد' : 'Approval signals saved'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {isAr ? 'قد يقترح NEXUS تحديثات لعقل العلامة من المحتوى الذي راجعته: ' : 'NEXUS may suggest Brand Brain updates from reviewed content: '}
                        {approveResult.learned.hooks > 0 && (
                          <span className="text-[#5E5CE6] font-medium">
                            {approveResult.learned.hooks} {isAr ? 'إشارات خطاف' : 'hook signals'}
                          </span>
                        )}
                        {approveResult.learned.hooks > 0 && approveResult.learned.angles > 0 && ' + '}
                        {approveResult.learned.angles > 0 && (
                          <span className="text-[#5E5CE6] font-medium">
                            {approveResult.learned.angles} {isAr ? 'إشارات زاوية محتوى' : 'content-angle signals'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Next best action */}
                <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                  style={{
                    background: approveResult.kind === 'approved'
                      ? '#F8FAFC'
                      : approveResult.pendingImages > 0
                      ? '#F5F3FF'
                      : approveResult.unlinked > 0
                      ? '#FFFBEB'
                      : '#ECFDF5',
                    border: approveResult.kind === 'approved'
                      ? '1px solid rgba(15,23,42,0.10)'
                      : approveResult.pendingImages > 0
                      ? '1px solid rgba(94,92,230,0.18)'
                      : approveResult.unlinked > 0
                      ? '1px solid rgba(245,158,11,0.2)'
                      : '1px solid rgba(5,150,105,0.22)',
                  }}>
                  <span className="text-lg mt-0.5">
                    {approveResult.kind === 'approved' ? '📝' : approveResult.pendingImages > 0 ? '✨' : approveResult.unlinked > 0 ? '🔌' : '📅'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold mb-0.5"
                      style={{ color: approveResult.kind === 'approved' ? '#334155' : approveResult.pendingImages > 0 ? '#5E5CE6' : approveResult.unlinked > 0 ? '#B45309' : '#047857' }}>
                      {approveResult.kind === 'approved'
                        ? (isAr ? 'التالي: راجع الخطة قبل الجدولة' : 'Next: review the plan before scheduling')
                        : approveResult.pendingImages > 0
                        ? (isAr ? 'اختياري: جهز صور المسودات' : 'Optional: prepare draft visuals')
                        : approveResult.unlinked > 0
                        ? (isAr ? 'قبل النشر: اربط منصات النشر' : 'Before publishing: connect platforms')
                        : (isAr ? 'التالي: راجع المحتوى المجدول' : 'Next: review scheduled content')}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {approveResult.kind === 'approved'
                        ? (isAr
                          ? 'تم اعتماد المسودات فقط. ما زالت المنشورات تحتاج جدولة قبل النشر، والنشر التلقائي يحتاج تفعيلًا صريحًا منفصلًا.'
                          : 'Drafts are approved only. Approved posts still need scheduling before publishing, and automatic publishing requires a separate explicit opt-in.')
                        : approveResult.pendingImages > 0
                        ? (isAr
                          ? `${approveResult.pendingImages} من ${approveResult.totalImages} خانات صور ما زالت تحتاج وسائط. الصور تبقى للمراجعة ولا تنشر تلقائيًا.`
                          : `${approveResult.pendingImages} of ${approveResult.totalImages} image slots still need visuals. Visuals remain for review and are not published automatically.`)
                        : approveResult.unlinked > 0
                        ? (isAr
                          ? `${approveResult.unlinked} منشورات مجدولة غير مرتبطة بحساب نشر بعد. اربط المنصات قبل أي نشر.`
                          : `${approveResult.unlinked} scheduled posts are not linked to a publishing account yet. Connect platforms before any publishing.`)
                        : (isAr
                          ? 'تمت الجدولة فقط. لا يتم نشر أي محتوى إلا بخطوة نشر منفصلة ومؤكدة.'
                          : 'Content is scheduled only. Nothing is published without a separate confirmed publishing step.')}
                    </p>
                  </div>
                </div>

                {/* Unlinked warning */}
                {approveResult.unlinked > 0 && (
                  <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                    style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.22)' }}>
                    <span className="text-base mt-0.5">⚠️</span>
                    <div>
                      <p className="text-xs text-amber-700">
                        {approveResult.unlinked} post{approveResult.unlinked !== 1 ? 's have' : ' has'} no connected platform yet.
                        Connect your social accounts in{' '}
                        <button
                          onClick={() => { setApproveResult(null); router.push('/connections') }}
                          className="underline hover:no-underline"
                        >Connections</button>{' '}
                        before scheduling or publishing.
                      </p>
                    </div>
                  </div>
                )}

                {/* CTA buttons */}
                <div className="flex gap-3">
                  {approveResult.pendingImages > 0 ? (
                    <button
                      onClick={() => {
                        setApproveResult(null)
                        generateAllImages()
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: '#111827' }}
                    >
                      ✨ Generate {approveResult.pendingImages} Images
                    </button>
                  ) : approveResult.unlinked > 0 ? (
                    <button
                      onClick={() => { setApproveResult(null); router.push('/connections') }}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: '#B45309' }}
                    >
                      🔌 Connect Platforms
                    </button>
                  ) : null}
                  <button
                    onClick={() => { setApproveResult(null); router.push(approveResult.kind === 'approved' ? `/campaigns/${campaignId}/content-hub` : '/schedule') }}
                    className={`${approveResult.pendingImages > 0 || approveResult.unlinked > 0 ? 'flex-1' : 'w-full'} px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border`}
                    style={{ borderColor: 'rgba(5,150,105,0.24)', color: '#047857', background: '#FFFFFF' }}
                  >
                    📅 {approveResult.kind === 'approved'
                      ? (isAr ? 'مراجعة خطة المحتوى' : 'Review content plan')
                      : (isAr ? 'عرض الجدول' : 'View schedule')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Media picker overlay ───────────────────────────────────── */}
        {mediaPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(10px)' }}
            onClick={() => setMediaPickerOpen(null)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-950">Choose from Media Library</h3>
                <button onClick={() => setMediaPickerOpen(null)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
              </div>
              {mediaLibrary.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="mb-3">No images uploaded yet</p>
                  <button
                    onClick={() => router.push('/media')}
                    className="text-sm text-[#5E5CE6] hover:text-[#4845C7]"
                  >
                    Go to Media Library →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                  {mediaLibrary
                    .filter(m => ['image', 'IMAGE', 'logo', 'LOGO'].includes(m.type))
                    .map(m => (
                      <button
                        key={m.id}
                        onClick={() => mediaPickerOpen && assignMedia(mediaPickerOpen, m.id, m.url)}
                        className="relative group aspect-square rounded-xl overflow-hidden transition-all hover:ring-2 hover:ring-purple-500"
                      >
                        <img src={m.url} alt={m.fileName} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white text-xs font-medium">Use this</span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Manual publishing checklist (PR4) ─────────────────────────── */}
        {manualPublishPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={() => { if (!manualPublishing) { setManualPublishPost(null); setManualUrl('') } }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#4F46E5,#6366f1,#7c3aed)' }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-950">📤 {t('contentHub.manualTitle')}</h3>
                  <button onClick={() => { setManualPublishPost(null); setManualUrl('') }} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <p className="text-xs text-slate-500 mb-4">{t('contentHub.manualIntro')}</p>

                <button onClick={() => copyCaption(manualPublishPost.caption)} className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-xl mb-2" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <span>1️⃣ {t('contentHub.manualCopyCaption')}</span>
                  <span className="text-xs font-semibold" style={{ color: captionCopied ? '#047857' : '#4F46E5' }}>{captionCopied ? `✓ ${t('contentHub.copied')}` : t('contentHub.copy')}</span>
                </button>

                {manualPublishPost.imageUrl && (
                  <a href={manualPublishPost.imageUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-xl mb-2" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <span>2️⃣ {t('contentHub.manualOpenCreative')}</span>
                    <span className="text-xs font-semibold text-[#4F46E5]">{t('contentHub.open')} ↗</span>
                  </a>
                )}

                {platformHomeUrl(manualPublishPost.platform) && (
                  <a href={platformHomeUrl(manualPublishPost.platform)!} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between text-sm px-3 py-2.5 rounded-xl mb-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <span>3️⃣ {t('contentHub.manualOpenPlatform')} · {manualPublishPost.platform}</span>
                    <span className="text-xs font-semibold text-[#4F46E5]">{t('contentHub.open')} ↗</span>
                  </a>
                )}

                <label className="block text-xs font-medium text-slate-600 mb-1">4️⃣ {t('contentHub.manualPasteUrl')} <span className="text-slate-400">({t('contentHub.optional')})</span></label>
                <input type="url" value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="https://…" className="w-full rounded-xl text-sm px-3 py-2 mb-4 focus:outline-none" style={{ background: '#FFFFFF', border: '1px solid rgba(79,70,229,0.24)', color: '#0f172a' }} />

                <p className="text-[11px] text-slate-500 mb-3 px-1">⚠️ {t('contentHub.manualDisclaimer')}</p>

                <div className="flex justify-end gap-2">
                  <button onClick={() => { setManualPublishPost(null); setManualUrl('') }} disabled={manualPublishing} className="text-sm px-4 py-2 rounded-xl text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button onClick={confirmManualPublish} disabled={manualPublishing} className="text-sm px-4 py-2 rounded-xl font-semibold text-white flex items-center gap-2" style={{ background: '#4F46E5', opacity: manualPublishing ? 0.6 : 1 }}>
                    {manualPublishing ? (<><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t('contentHub.marking')}</>) : (<>✓ {t('contentHub.manualConfirm')}</>)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}

// ── Caption Quality Scorer ────────────────────────────────────────────────────
// Pure client-side — no API call. Returns grade + score + breakdown for tooltip.

const PLATFORM_IDEAL_LEN: Record<string, [number, number]> = {
  TIKTOK:    [60,  150],
  INSTAGRAM: [125, 300],
  META:      [100, 250],
  FACEBOOK:  [100, 250],
  LINKEDIN:  [200, 500],
  X:         [80,  230],
  TWITTER:   [80,  230],
  GENERAL:   [100, 300],
}

function scoreCaption(caption: string, platform: string): { grade: 'A+' | 'A' | 'B' | 'C'; score: number; color: string; tip: string } {
  if (!caption || caption.length < 10) return { grade: 'C', score: 0, color: '#ef4444', tip: 'Caption is too short' }

  let score = 0
  const tips: string[] = []
  const p = platform?.toUpperCase() || 'GENERAL'
  const first = caption.split('\n')[0] || caption.slice(0, 100)

  // ── Hook quality (25 pts) — compelling opening ─────────────────────────���───
  const hookPatterns = [/^[🔥💡⚡🚀🎯✨💪🙌👇]/u, /\?/, /^[0-9]/, /\b(how|why|what|top|best|secret|truth|want|need|stop|start|never|always|warning|attention|breaking|introducing|announcing)\b/i]
  const hookScore = hookPatterns.filter(p => p.test(first)).length
  if (hookScore >= 2) score += 25
  else if (hookScore === 1) { score += 12; tips.push('Strengthen your opening hook') }
  else tips.push('Add a compelling hook to the first line')

  // ── CTA presence (25 pts) ───────────────────────��─────────────────────────
  const ctaPatterns = /\b(click|tap|swipe|comment|follow|save|share|like|tag|visit|check|learn|get|sign up|subscribe|dm|message|link in bio|try|buy|order|book|register)\b/i
  if (ctaPatterns.test(caption)) score += 25
  else tips.push('Add a clear call-to-action')

  // ── Length appropriateness (20 pts) ──────────────────────────────────────
  const [minLen, maxLen] = PLATFORM_IDEAL_LEN[p] ?? [100, 300]
  const len = caption.length
  if (len >= minLen && len <= maxLen) score += 20
  else if (len < minLen) { score += 8; tips.push(`Caption is short for ${p}`) }
  else { score += 12; tips.push('Consider trimming for better reach') }

  // ── Emoji presence (15 pts) ───────────────────────────────────────────────
  const emojiCount = (caption.match(/\p{Emoji}/gu) || []).length
  if (emojiCount >= 1 && emojiCount <= 5) score += 15
  else if (emojiCount > 5) { score += 8; tips.push('Too many emojis — aim for 1-5') }
  else tips.push('Add 1-2 emojis to increase engagement')

  // ── Hashtags (15 pts) ─────────────────────────────────────────────────────
  const hashCount = (caption.match(/#\w+/g) || []).length
  if (hashCount >= 2 && hashCount <= 10) score += 15
  else if (hashCount === 1) { score += 8; tips.push('Add 3-5 relevant hashtags') }
  else if (hashCount > 10) { score += 10; tips.push('Too many hashtags — aim for 3-7') }
  else tips.push('Add relevant hashtags')

  const clampedScore = Math.min(100, score)
  const grade = clampedScore >= 85 ? 'A+' : clampedScore >= 70 ? 'A' : clampedScore >= 50 ? 'B' : 'C'
  const color = clampedScore >= 85 ? '#10b981' : clampedScore >= 70 ? '#06b6d4' : clampedScore >= 50 ? '#f59e0b' : '#ef4444'
  const tip = tips.length > 0 ? tips[0] : grade === 'A+' ? 'Excellent post quality!' : 'Good post'
  return { grade, score: clampedScore, color, tip }
}

// ── PostCard Component ─────────────────────────────────────────────────────────

interface PostCardProps {
  post: ContentPost
  pendingEdit: Partial<ContentPost>
  mediaLibrary: MediaItem[]
  brandName: string
  brandLogo: string | null
  isExpanded: boolean
  isEditingCaption: boolean
  isEditingPrompt: boolean
  mediaPickerOpen: boolean
  isRewriting: boolean
  isPickingWinner: boolean
  isGeneratingImage: boolean
  imageGenerationLocked: boolean
  addCreditsForImagesLabel: string
  onGenerateImage: () => Promise<void>
  onAddCredits: () => void
  onToggleExpand: () => void
  onEditCaption: () => void
  onEditPrompt: () => void
  onOpenMediaPicker: () => void
  onCloseMediaPicker: () => void
  onSaveEdit: (updates: Partial<ContentPost>) => Promise<void>
  onAssignMedia: (mediaId: string, url: string) => Promise<void>
  onPendingEdit: (updates: Partial<ContentPost>) => void
  onRewrite: (instruction: string) => Promise<void>
  onPickWinner?: () => void
  onManualPublish?: () => void
}

function PostCard({
  post,
  pendingEdit,
  brandName,
  brandLogo,
  isExpanded,
  isEditingCaption,
  isRewriting,
  isPickingWinner,
  isGeneratingImage,
  imageGenerationLocked,
  addCreditsForImagesLabel,
  onGenerateImage,
  onAddCredits,
  onToggleExpand,
  onEditCaption,
  onOpenMediaPicker,
  onSaveEdit,
  onPendingEdit,
  onRewrite,
  onPickWinner,
  onManualPublish,
}: PostCardProps) {
  const { t, locale } = useI18n()
  const isAr = locale === 'ar'
  const [showRewriteInput, setShowRewriteInput] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')

  const platform = post.platform.toUpperCase()
  const caption = pendingEdit.caption ?? post.caption
  const hasImage = !!post.imageUrl
  const isVideo = post.isVideoPost
  const status = post.generationStatus
  const quality = caption.length > 20 ? scoreCaption(caption, platform) : null

  const statusColor = {
    PENDING: '#f59e0b', GENERATING: '#6366f1', DONE: '#10b981',
    FAILED: '#ef4444', AWAITING_UPLOAD: '#8b5cf6', SKIPPED: '#6b7280',
  }[status] ?? '#6b7280'

  const statusLabel = {
    PENDING: isAr ? 'الوسائط بانتظار التوليد' : 'Media pending', GENERATING: t('contentHub.statusGenerating'), DONE: isAr ? 'الوسائط جاهزة' : 'Media ready',
    FAILED: t('contentHub.statusFailed'), AWAITING_UPLOAD: t('contentHub.statusUploadVideo'), SKIPPED: t('contentHub.statusSkipped'),
  }[status] ?? status

  const lifecycleBadge = {
    DRAFT: {
      label: isAr ? 'مسودة للمراجعة' : 'Draft for review',
      color: '#7c3aed',
    },
    APPROVED: {
      label: isAr ? 'معتمد، غير مجدول' : 'Approved, not scheduled',
      color: '#059669',
    },
    SCHEDULED: {
      label: isAr ? 'مجدول' : 'Scheduled',
      color: '#6366f1',
    },
    PUBLISHED: {
      label: isAr ? 'منشور' : 'Published',
      color: '#10b981',
    },
    FAILED: {
      label: isAr ? 'يحتاج مراجعة' : 'Needs review',
      color: '#ef4444',
    },
  }[post.status]

  const scheduledDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  // Wrapper with status bar on top + action row on bottom
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>

      {/* ── Top meta bar ─────────────────── */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F8FAFC', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">#{post.contentPlanIndex}</span>
          {scheduledDate && <span className="text-[10px] text-slate-400">· {scheduledDate}</span>}
          {/* A/B variant badge */}
          {post.variantLabel && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{
                background: post.variantLabel === 'A' ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.15)',
                color: post.variantLabel === 'A' ? '#fbbf24' : '#a5b4fc',
                border: post.variantLabel === 'A' ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(99,102,241,0.35)',
              }}>
              {t('contentHub.variant')} {post.variantLabel}
            </span>
          )}
          {post.variantWinner && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
              🏆 {t('contentHub.winner')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Quality Score Badge */}
          {quality && (
            <span
              title={quality.tip}
              className="text-[10px] font-black px-1.5 py-0.5 rounded-md cursor-help"
              style={{ background: `${quality.color}15`, color: quality.color, border: `1px solid ${quality.color}35`, letterSpacing: '0.02em' }}>
              {quality.grade}
            </span>
          )}
          {lifecycleBadge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${lifecycleBadge.color}14`, color: lifecycleBadge.color, border: `1px solid ${lifecycleBadge.color}2E` }}>
              {lifecycleBadge.label}
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
            style={{ background: `${statusColor}18`, color: statusColor }}>
            {status === 'GENERATING' && <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: statusColor }} />}
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── Platform Mockup ──────────────── */}
      {(platform === 'META' || platform === 'FACEBOOK' || platform === 'INSTAGRAM') && (
        <InstagramMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} isExpanded={isExpanded} onExpandToggle={onToggleExpand} brandName={brandName} brandLogo={brandLogo} />
      )}
      {platform === 'LINKEDIN' && (
        <LinkedInMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} isExpanded={isExpanded} onExpandToggle={onToggleExpand} brandName={brandName} brandLogo={brandLogo} />
      )}
      {platform === 'TIKTOK' && (
        <TikTokMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} brandName={brandName} brandLogo={brandLogo} />
      )}
      {!['META','FACEBOOK','INSTAGRAM','LINKEDIN','TIKTOK'].includes(platform) && (
        <GenericMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} platform={platform} isExpanded={isExpanded} onExpandToggle={onToggleExpand} brandName={brandName} brandLogo={brandLogo} />
      )}

      {/* ── Manual publishing (PR4): only for MANUAL + SCHEDULED posts ───── */}
      {post.status === 'SCHEDULED' && post.publishMode !== 'AUTO' && onManualPublish && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <button
            onClick={onManualPublish}
            className="w-full text-xs px-3 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5"
            style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid rgba(79,70,229,0.22)' }}
          >
            📤 {t('contentHub.publishManually')}
          </button>
          <p className="text-[10px] text-slate-400 mt-1 text-center">{t('contentHub.manualNotAuto')}</p>
        </div>
      )}
      {post.status === 'PUBLISHED' && post.manuallyPublishedAt && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: '#ECFDF5', color: '#047857' }}>
            ✓ {t('contentHub.publishedManually')}
          </span>
          {post.platformUrl && (
            <a href={post.platformUrl} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-[#5E5CE6] hover:underline mt-1 truncate">{post.platformUrl}</a>
          )}
        </div>
      )}

      {/* ── Edit caption overlay ─────────── */}
      {isEditingCaption && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <textarea
            className="w-full rounded-xl text-sm p-3 resize-none focus:outline-none"
            style={{ background: '#FFFFFF', border: '1px solid rgba(94,92,230,0.28)', color: '#0f172a', minHeight: '90px' }}
            value={caption}
            onChange={e => onPendingEdit({ caption: e.target.value })}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onEditCaption} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-950 transition-colors">{t('contentHub.cancel')}</button>
            <button
              onClick={() => { onSaveEdit({ caption }); onEditCaption() }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all"
              style={{ background: '#111827' }}
            >{t('contentHub.save')}</button>
          </div>
        </div>
      )}

      {/* ── AI Rewrite input overlay ──────── */}
      {showRewriteInput && !isEditingCaption && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(94,92,230,0.14)', background: '#F5F3FF' }}>
          <p className="text-[10px] text-[#5E5CE6] font-medium mb-1.5 flex items-center gap-1">
            <span>✨</span> {t('contentHub.rewriteInstruction')} <span className="text-slate-400">({t('contentHub.optional')})</span>
          </p>
          <input
            type="text"
            className="w-full rounded-xl text-xs px-3 py-2 focus:outline-none"
            style={{ background: '#FFFFFF', border: '1px solid rgba(94,92,230,0.24)', color: '#0f172a' }}
            placeholder={t('contentHub.rewritePlaceholder')}
            value={rewriteInstruction}
            onChange={e => setRewriteInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onRewrite(rewriteInstruction).then(() => {
                  setShowRewriteInput(false)
                  setRewriteInstruction('')
                })
              }
              if (e.key === 'Escape') {
                setShowRewriteInput(false)
                setRewriteInstruction('')
              }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowRewriteInput(false); setRewriteInstruction('') }}
              className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-950 transition-colors"
            >{t('contentHub.cancel')}</button>
            <button
              onClick={() => {
                onRewrite(rewriteInstruction).then(() => {
                  setShowRewriteInput(false)
                  setRewriteInstruction('')
                })
              }}
              disabled={isRewriting}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all flex items-center gap-1.5"
              style={{ background: '#111827', opacity: isRewriting ? 0.7 : 1 }}
            >
              {isRewriting
                ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />{t('contentHub.rewriting')}</>
                : <>✨ {t('contentHub.rewrite')}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Action row ───────────────────── */}
      <div className="flex border-t" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
        <button onClick={onEditCaption}
          className="flex-1 py-2.5 text-xs font-medium text-slate-500 hover:text-[#5E5CE6] hover:bg-violet-50 transition-all flex items-center justify-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11.5 2.5a2.121 2.121 0 013 3L5 15l-4 1 1-4L11.5 2.5z"/></svg>
          {t('contentHub.edit')}
        </button>
        <button
          onClick={() => { setShowRewriteInput(v => !v); setRewriteInstruction('') }}
          disabled={isRewriting}
          className="flex-1 py-2.5 text-xs font-medium hover:bg-purple-500/5 transition-all border-l flex items-center justify-center gap-1"
          style={{ borderColor: 'rgba(15,23,42,0.08)', color: isRewriting ? '#5E5CE6' : '#5E5CE6' }}
        >
          {isRewriting
            ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{t('contentHub.rewriting')}</>
            : <>✨ {t('contentHub.rewrite')}</>
          }
        </button>
        {/* Generate AI image (disabled for TikTok — needs real video) */}
        {platform === 'TIKTOK' ? (
          <button onClick={onOpenMediaPicker}
            className="flex-1 py-2.5 text-xs font-medium transition-all border-l flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(15,23,42,0.08)', color: '#DB2777' }}
            title="TikTok requires real video — upload yours">
            📹 {t('contentHub.vid')}
          </button>
        ) : (
          <button
            onClick={imageGenerationLocked ? onAddCredits : onGenerateImage}
            disabled={isGeneratingImage}
            title={imageGenerationLocked ? addCreditsForImagesLabel : 'Generate image · 3 credits · failed generations are refunded'}
            className="flex-1 py-2.5 text-xs font-medium transition-all border-l flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(15,23,42,0.08)', color: imageGenerationLocked ? '#B91C1C' : isGeneratingImage ? '#8B5CF6' : '#5E5CE6', background: imageGenerationLocked ? '#FEF2F2' : undefined }}
          >
            {isGeneratingImage
              ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{t('contentHub.gen')}</>
              : <>🎨 {imageGenerationLocked ? addCreditsForImagesLabel : t('contentHub.imgCredits')}</>
            }
          </button>
        )}
        {onPickWinner ? (
          /* A/B test: replace "Image" button with "Pick Winner" */
          <button
            onClick={onPickWinner}
            disabled={isPickingWinner}
            className="flex-1 py-2.5 text-xs font-semibold transition-all border-l flex items-center justify-center gap-1"
            style={{
              borderColor: 'rgba(234,179,8,0.25)',
              color: isPickingWinner ? '#fbbf24' : '#fcd34d',
              background: 'rgba(234,179,8,0.04)',
            }}
          >
            {isPickingWinner
              ? <><span className="w-2.5 h-2.5 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />{t('contentHub.picking')}</>
              : <>🏆 {t('contentHub.win')}</>
            }
          </button>
        ) : (
          <button onClick={onOpenMediaPicker}
            className="flex-1 py-2.5 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all border-l flex items-center justify-center gap-1.5"
            style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1"/><path d="M14 10l-4-4-3 3-1.5-1.5L2 11"/></svg>
            {isVideo ? t('contentHub.vid') : t('contentHub.img')}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Brand Avatar helper ────────────────────────────────────────────────────────

function BrandAvatar({ brandName, brandLogo, size = 32, gradientBg, rounded = 'full' }: {
  brandName: string; brandLogo: string | null; size?: number; gradientBg?: string; rounded?: 'full' | 'lg'
}) {
  const initial = (brandName || 'B').charAt(0).toUpperCase()
  const bg = gradientBg ?? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
  const radius = rounded === 'full' ? '9999px' : '8px'
  if (brandLogo) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
        <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {initial}
    </div>
  )
}

// ── Instagram Mockup ───────────────────────────────────────────────────────────

function InstagramMockup({ caption, imageUrl, isVideo, status, isExpanded, onExpandToggle, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; isExpanded: boolean; onExpandToggle: () => void; brandName: string; brandLogo: string | null
}) {
  const { t } = useI18n()
  const handle = brandName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const shortCaption = !isExpanded && caption.length > 100 ? caption.slice(0, 100) + '…' : caption
  return (
    <div style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Profile row */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div style={{ padding: '2px', borderRadius: '9999px', background: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)' }}>
            <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={30} />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-gray-900 leading-tight">{handle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[20px] text-gray-900 leading-none font-light">···</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>

      {/* Image — 1:1 square */}
      <div className="relative w-full" style={{ aspectRatio: '1/1', background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>

      {/* Action icons */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div className="text-[12px] text-gray-900 leading-relaxed">
          <span className="font-semibold">{handle}</span>{' '}
          <span className="text-gray-800">{shortCaption || <span className="text-gray-400 italic">{t('contentHub.captionPlaceholder')}</span>}</span>
          {caption.length > 100 && (
            <button onClick={onExpandToggle} className="text-gray-500 ml-1 text-[11px]">
              {isExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-400 mt-1.5">{t('contentHub.previewOnly')}</div>
      </div>
    </div>
  )
}

// ── LinkedIn Mockup ────────────────────────────────────────────────────────────

function LinkedInMockup({ caption, imageUrl, isVideo, status, isExpanded, onExpandToggle, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; isExpanded: boolean; onExpandToggle: () => void; brandName: string; brandLogo: string | null
}) {
  const { t } = useI18n()
  const shortCaption = !isExpanded && caption.length > 140 ? caption.slice(0, 140) + '…' : caption
  return (
    <div style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Profile */}
      <div className="flex items-start justify-between px-3 py-3">
        <div className="flex items-start gap-2.5">
          <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={40} gradientBg="#0A66C2" />
          <div>
            <div className="text-[13px] font-semibold text-gray-900 leading-tight">{brandName}</div>
          </div>
        </div>
        <button className="text-[11px] font-semibold px-3 py-1 rounded-full border" style={{ borderColor: '#0A66C2', color: '#0A66C2' }}>+ Follow</button>
      </div>

      {/* Caption */}
      <div className="px-3 pb-2.5 text-[13px] text-gray-800 leading-relaxed">
        {shortCaption || <span className="text-gray-400 italic">{t('contentHub.captionPlaceholder')}</span>}
        {caption.length > 140 && (
          <button onClick={onExpandToggle} className="ml-1 font-semibold text-gray-500 text-[12px]">
            {isExpanded ? 'Show less' : '…see more'}
          </button>
        )}
      </div>

      {/* Image — 4:3 */}
      <div className="relative w-full" style={{ aspectRatio: '4/3', background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>

      {/* Reactions */}
      <div className="px-3 pt-2 pb-1">
        <div className="text-[10px] text-gray-400 mb-2 pb-1.5" style={{ borderBottom: '1px solid #e5e7eb' }}>
          {t('contentHub.previewOnly')}
        </div>
        <div className="flex items-center justify-around pb-1">
          {[['👍','Like'],['💬','Comment'],['🔁','Repost'],['✉️','Send']].map(([icon, label]) => (
            <button key={label} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 font-medium">
              <span className="text-[14px]">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── TikTok Mockup ──────────────────────────────────────────────────────────────

function TikTokMockup({ caption, imageUrl, isVideo, status, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; brandName: string; brandLogo: string | null
}) {
  const { t } = useI18n()
  const handle = '@' + brandName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return (
    <div className="relative flex" style={{ background: '#000', aspectRatio: '9/14', overflow: 'hidden' }}>
      {/* Background image/video */}
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }}>
          <ImagePlaceholder isVideo={isVideo} status={status} dark={true} />
        </div>
      )}
      {/* Overlay gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)' }} />

      {/* Right sidebar icons */}
      <div className="absolute right-2.5 bottom-16 flex flex-col items-center gap-4">
        <div style={{ width: 36, height: 36, borderRadius: '9999px', border: '2px solid white', overflow: 'hidden', flexShrink: 0 }}>
          <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={36} gradientBg="#fe2c55" />
        </div>
        {[
          { icon: '♥', count: '' }, { icon: '💬', count: '' },
          { icon: '⤴', count: '' }, { icon: '⊙', count: '' },
        ].map(({ icon, count }) => (
          <div key={icon} className="flex flex-col items-center gap-0.5">
            <span className="text-white text-2xl drop-shadow">{icon}</span>
            {count && <span className="text-white text-[10px] font-semibold">{count}</span>}
          </div>
        ))}
      </div>

      {/* Bottom caption */}
      <div className="absolute bottom-0 left-0 right-10 p-3">
        <div className="text-white text-[12px] font-bold mb-1">{handle}</div>
        <p className="text-white text-[11px] leading-relaxed line-clamp-2 drop-shadow">
          {caption || <span className="text-white/60 italic">{t('contentHub.captionPlaceholder')}</span>}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-white text-[13px] animate-spin" style={{ display: 'inline-block', animationDuration: '3s' }}>♪</span>
          <span className="text-white text-[10px]">Original Sound · {handle}</span>
        </div>
        <div className="text-white/50 text-[9px] mt-1.5">{t('contentHub.previewOnly')}</div>
      </div>
    </div>
  )
}

// ── Generic Mockup ─────────────────────────────────────────────────────────────

function GenericMockup({ caption, imageUrl, isVideo, status, platform, isExpanded, onExpandToggle, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; platform: string; isExpanded: boolean; onExpandToggle: () => void; brandName: string; brandLogo: string | null
}) {
  const { t } = useI18n()
  const cfg = getPlatformConfig(platform)
  const shortCaption = !isExpanded && caption.length > 120 ? caption.slice(0, 120) + '…' : caption
  return (
    <div style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={32} gradientBg={cfg.color} />
        <div>
          <div className="text-[12px] font-semibold text-gray-900">{brandName}</div>
          <div className="text-[10px] text-gray-400">{t('contentHub.previewOnly')}</div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[12px] text-gray-800 leading-relaxed">
        {shortCaption || <span className="text-gray-400 italic">{t('contentHub.captionPlaceholder')}</span>}
        {caption.length > 120 && (
          <button onClick={onExpandToggle} className="text-gray-500 ml-1 text-[11px]">{isExpanded ? 'less' : 'more'}</button>
        )}
      </div>
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>
      <div className="flex items-center gap-4 px-3 py-2 text-[11px] text-gray-500">
        <button className="flex items-center gap-1 hover:text-gray-800">👍 Like</button>
        <button className="flex items-center gap-1 hover:text-gray-800">💬 Comment</button>
        <button className="flex items-center gap-1 hover:text-gray-800">↗ Share</button>
      </div>
    </div>
  )
}

// ── Image Placeholder ──────────────────────────────────────────────────────────

function ImagePlaceholder({ isVideo, status, dark }: { isVideo: boolean; status: string; dark: boolean }) {
  const { t } = useI18n()
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2"
      style={{ background: dark ? 'transparent' : '#f9f9f9' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
        <span className="text-2xl">{isVideo ? '🎬' : '🖼'}</span>
      </div>
      <span className="text-xs font-medium" style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
        {status === 'GENERATING' ? (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            {t('contentHub.imgGenerating')}
          </span>
        ) : isVideo ? t('contentHub.imgUploadVideo') : status === 'PENDING' ? t('contentHub.imgWillGenerate') : t('contentHub.imgNone')}
      </span>
    </div>
  )
}
