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

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { deriveCampaignOperatingState } from '@/lib/campaignOperatingState'
import { summarizeByDisplayState } from '@/lib/postVisibility'
import { getCreditActionTruth } from '@/lib/creditActionTruth'
import { useBillingStatus } from '@/lib/useBillingStatus'
import {
  CONTENT_HUB_IMAGE_COST,
  CONTENT_HUB_REGENERATION_COST,
  CONTENT_HUB_REWRITE_COST,
  getBulkImageGenerationCost,
} from '@/lib/contentHubActionSafety'
import { derivePostMediaSource } from '@/lib/contentHubMediaAttachment'
import {
  deriveContentHubMediaState,
  isContentPostMediaReadyForScheduling,
  summarizeContentHubMediaReadiness,
} from '@/lib/contentHubMediaState'
import { deriveContentPlanOrderReview } from '@/lib/contentPlanOrderContract'
import { deriveContentHubFirstScreenTruth } from '@/lib/contentHubFirstScreenTruth'
import { deriveStrategyFulfillmentSummary, type StrategyFulfillmentTone } from '@/lib/strategyFulfillment'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import { derivePostCreativeRequirement } from '@/lib/creativeRequirements'
import { getDefaultTemplateForPlatform } from '@/lib/creativeTemplates'
import AppShell from '@/components/AppShell'
import { PostPlatformPublisher } from '@/components/publishing/PostPlatformPublisher'

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'ALL' | 'META' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'TIKTOK' | 'TWITTER' | 'YOUTUBE' | 'YOUTUBE_SHORTS'
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
  status: 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED'
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

interface ScheduleAccount {
  id: string
  platform: string
  accountName?: string | null
  pages?: Array<{ id: string; name: string; igAccountId?: string | null }>
  organizations?: Array<{ id: string; name: string }>
  selectedOrganizationId?: string | null
}

interface YouTubeScheduleOptions {
  title: string
  privacyStatus: 'private' | 'unlisted' | 'public'
  madeForKids: '' | 'yes' | 'no'
  syntheticMedia: '' | 'yes' | 'no'
  notifySubscribers: boolean
}

interface PendingMediaAttachment {
  postId: string
  media: MediaItem
  action: 'attach' | 'replace'
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
  industry: string | null
  description: string | null
  primaryOffer: string | null
  uniqueAdvantages: string[]
  complianceNotes: string | null
  verifiedProof: string[]
}

interface StrategyHandoff {
  campaignId: string
  language?: string
  selectedMediaIds?: string[]
  ts?: number
}

const STRATEGY_HANDOFF_KEY = 'nexus_strategy_handoff'

function normalizeAutoPublishTarget(platform: string): string {
  const target = platform.toUpperCase()
  if (target === 'YOUTUBE_SHORTS') return 'YOUTUBE'
  if (target === 'TWITTER') return 'X'
  return target
}

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
  YOUTUBE: {
    label: 'YouTube Shorts',
    color: '#FF0033',
    bg: '#fff1f2',
    border: '#FF0033',
    icon: '▶',
    cardStyle: 'youtube',
  },
  YOUTUBE_SHORTS: {
    label: 'YouTube Shorts',
    color: '#FF0033',
    bg: '#fff1f2',
    border: '#FF0033',
    icon: '▶',
    cardStyle: 'youtube',
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

function isUserConfirmedManualPublished(post: Pick<ContentPost, 'status' | 'manuallyPublishedAt' | 'publishMode'>): boolean {
  return post.status === 'PUBLISHED' && Boolean(post.manuallyPublishedAt || post.publishMode !== 'AUTO')
}

function defaultYouTubeScheduleOptions(post: Pick<ContentPost, 'caption'>): YouTubeScheduleOptions {
  return {
    title: post.caption.split(/\r?\n/)[0].trim().slice(0, 100),
    privacyStatus: 'private',
    madeForKids: '',
    syntheticMedia: '',
    notifySubscribers: false,
  }
}

export default function ContentHubPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
  const {
    creditsRemaining,
    isUnlimited,
    loading: billingLoading,
    invalidate: refreshBillingStatus,
  } = useBillingStatus()
  const isAr = locale === 'ar'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({
    brandName: null,
    logoUrl: null,
    colorPalette: [],
    industry: null,
    description: null,
    primaryOffer: null,
    uniqueAdvantages: [],
    complianceNotes: null,
    verifiedProof: [],
  })
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
  const [activePlatform, setActivePlatform] = useState<Platform>('ALL')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState<string | null>(null) // postId
  const [pendingMediaAttachment, setPendingMediaAttachment] = useState<PendingMediaAttachment | null>(null)
  const [mediaAttachmentAcknowledged, setMediaAttachmentAcknowledged] = useState(false)
  const [mediaRemovalPostId, setMediaRemovalPostId] = useState<string | null>(null)
  const [mediaRemovalAcknowledged, setMediaRemovalAcknowledged] = useState(false)
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
  const [manualPublishConfirmed, setManualPublishConfirmed] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)
  const [scheduleAcknowledged, setScheduleAcknowledged] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [scheduleAccounts, setScheduleAccounts] = useState<ScheduleAccount[]>([])
  const [scheduleAccountsLoading, setScheduleAccountsLoading] = useState(false)
  const [destinationByTarget, setDestinationByTarget] = useState<Record<string, { integrationId: string; pageId?: string; pageName?: string }>>({})
  const [tiktokCreator, setTikTokCreator] = useState<{ privacyLevelOptions: string[]; commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean } | null>(null)
  const [tiktokOptions, setTikTokOptions] = useState({
    privacyLevel: '', disableComment: false, disableDuet: false, disableStitch: false,
    brandContentToggle: false, brandOrganicToggle: true, isAigc: false,
  })
  const [youtubeOptionsByPostId, setYouTubeOptionsByPostId] = useState<Record<string, YouTubeScheduleOptions>>({})
  const [approveResult, setApproveResult] = useState<{
    kind: 'approved' | 'scheduled'
    approved: number
    linked: number
    unlinked: number
    signals: { hooks: number; angles: number }
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
  const [imageGenerationConfirmPostId, setImageGenerationConfirmPostId] = useState<string | null>(null)
  const [imageGenerationAcknowledged, setImageGenerationAcknowledged] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE' | 'SCHEDULED' | 'PUBLISHED'>('ALL')
  const [showBulkImageConfirm, setShowBulkImageConfirm] = useState(false)
  const [bulkImageAcknowledged, setBulkImageAcknowledged] = useState(false)
  const [showGeneratePlanConfirm, setShowGeneratePlanConfirm] = useState(false)
  const [generatePlanAcknowledged, setGeneratePlanAcknowledged] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [regenerateAcknowledged, setRegenerateAcknowledged] = useState(false)
  const [rewriteConfirm, setRewriteConfirm] = useState<{ postId: string; instruction: string } | null>(null)
  const [rewriteAcknowledged, setRewriteAcknowledged] = useState(false)
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
            industry: bData.brandProfile.industry ?? null,
            description: bData.brandProfile.description ?? null,
            primaryOffer: bData.brandProfile.primaryOffer ?? null,
            uniqueAdvantages: bData.brandProfile.uniqueAdvantages ?? [],
            complianceNotes: bData.brandProfile.complianceNotes ?? null,
            verifiedProof: bData.brandProfile.verifiedProof ?? [],
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

  useEffect(() => {
    if (!showScheduleConfirm || scheduleMode !== 'AUTO' || scheduleAccountsLoading || scheduleAccounts.length > 0) return
    let cancelled = false
    setScheduleAccountsLoading(true)
    fetch('/api/social/accounts', { headers: { Authorization: authHeader() } })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('connections')))
      .then(async data => {
        if (cancelled) return
        const accounts = Array.isArray(data.accounts) ? data.accounts as ScheduleAccount[] : []
        setScheduleAccounts(accounts)
        const next: Record<string, { integrationId: string; pageId?: string; pageName?: string }> = {}
        const targets = new Set(approvedPostsWithDates.map(post => normalizeAutoPublishTarget(post.platform)))
        const meta = accounts.find(account => account.platform === 'META')
        for (const target of targets) {
          if (target === 'FACEBOOK' && meta) {
            const page = (meta.pages || []).find(item => item.id)
            if (page) next[target] = { integrationId: meta.id, pageId: page.id, pageName: page.name }
          } else if (target === 'INSTAGRAM' && meta) {
            const page = (meta.pages || []).find(item => item.igAccountId)
            if (page?.igAccountId) next[target] = { integrationId: meta.id, pageId: page.igAccountId, pageName: page.name }
          } else if (target === 'LINKEDIN') {
            const linkedIn = accounts.find(account => account.platform === 'LINKEDIN')
            if (linkedIn) {
              const organization = (linkedIn.organizations || []).find(item => item.id === linkedIn.selectedOrganizationId)
                || (linkedIn.organizations || [])[0]
              next[target] = { integrationId: linkedIn.id, pageId: organization?.id, pageName: organization?.name || linkedIn.accountName || undefined }
            }
          } else if (target === 'TIKTOK') {
            const tiktok = accounts.find(account => account.platform === 'TIKTOK')
            if (tiktok) next[target] = { integrationId: tiktok.id, pageName: tiktok.accountName || undefined }
          } else if (target === 'X') {
            const x = accounts.find(account => account.platform === 'X')
            if (x) next.X = { integrationId: x.id, pageName: x.accountName || undefined }
          } else if (target === 'YOUTUBE') {
            const youtube = accounts.find(account => account.platform === 'YOUTUBE')
            if (youtube) next.YOUTUBE = { integrationId: youtube.id, pageName: youtube.accountName || undefined }
          }
        }
        setDestinationByTarget(next)
        const tiktok = accounts.find(account => account.platform === 'TIKTOK')
        if (targets.has('TIKTOK') && tiktok) {
          const response = await fetch(`/api/social/tiktok/creator-info?integrationId=${encodeURIComponent(tiktok.id)}`, {
            headers: { Authorization: authHeader() },
          })
          const creatorData = await response.json().catch(() => ({}))
          if (!cancelled && response.ok && creatorData.creator) {
            setTikTokCreator(creatorData.creator)
            const privacyLevel = creatorData.creator.privacyLevelOptions?.includes('SELF_ONLY')
              ? 'SELF_ONLY'
              : creatorData.creator.privacyLevelOptions?.[0] || ''
            setTikTokOptions(current => ({
              ...current,
              privacyLevel,
              disableComment: Boolean(creatorData.creator.commentDisabled),
              disableDuet: Boolean(creatorData.creator.duetDisabled),
              disableStitch: Boolean(creatorData.creator.stitchDisabled),
            }))
          }
        }
      })
      .catch(() => { if (!cancelled) setScheduleAccounts([]) })
      .finally(() => { if (!cancelled) setScheduleAccountsLoading(false) })
    return () => { cancelled = true }
  // approved posts are intentionally captured when the decision modal opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScheduleConfirm, scheduleMode])

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
      const mediaState = deriveContentHubMediaState(p)
      if (statusFilter === 'ALL') return true
      if (statusFilter === 'PENDING') return mediaState.needsAttention
      if (statusFilter === 'DONE') return mediaState.countsAsReady
      if (statusFilter === 'SCHEDULED') return p.status === 'SCHEDULED'
      if (statusFilter === 'PUBLISHED') return p.status === 'PUBLISHED'
      return true
    })

  const platforms = ['ALL', ...Array.from(new Set(posts.map(p => p.platform.toUpperCase())))]

  const totalImagePosts = posts.filter(p => !p.isVideoPost).length
  const mediaReadiness = summarizeContentHubMediaReadiness(posts.filter(p => !p.isVideoPost))
  const doneCount = mediaReadiness.confirmedReady
  const ambiguousPreviewCount = mediaReadiness.ambiguousPreviewCount
  const pendingImagePosts = posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost)
  const pendingImageCount = pendingImagePosts.length
  const bulkImageCreditCost = getBulkImageGenerationCost(pendingImageCount)
  const progress = totalImagePosts > 0 ? Math.round((doneCount / totalImagePosts) * 100) : 0
  const draftCount = posts.filter(p => p.status === 'DRAFT').length
  const approvedCount = posts.filter(p => p.status === 'APPROVED').length
  const approvedPostsWithDates = posts.filter(p => p.status === 'APPROVED' && hasValidDate(p.scheduledAt))
  const approvedAutoTargets = Array.from(new Set(approvedPostsWithDates.map(post => normalizeAutoPublishTarget(post.platform))))
  const unsupportedAutoTargets = approvedAutoTargets.filter(target => !['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'X', 'YOUTUBE'].includes(target))
  const approvedYouTubePosts = approvedPostsWithDates.filter(post => ['YOUTUBE', 'YOUTUBE_SHORTS'].includes(post.platform.toUpperCase()))
  const youtubeAutoReviewIncomplete = scheduleMode === 'AUTO' && approvedYouTubePosts.some(post => {
    const options = youtubeOptionsByPostId[post.id]
    return !options?.title.trim() || !options.madeForKids || !options.syntheticMedia
  })
  const approvedXPosts = approvedPostsWithDates.filter(post => ['X', 'TWITTER'].includes(post.platform.toUpperCase()))
  const xAutoReviewIncomplete = scheduleMode === 'AUTO' && approvedXPosts.some(post =>
    post.isVideoPost || Array.from(post.caption.trim()).length === 0 || Array.from(post.caption.trim()).length > 280,
  )
  const approvedPostsNeedingMedia = posts.filter(
    p => p.status === 'APPROVED' && !isContentPostMediaReadyForScheduling(p),
  )
  const approvedPostsNeedingMediaCount = approvedPostsNeedingMedia.length
  const schedulingBlockedByMedia = approvedPostsNeedingMediaCount > 0
  const approvedPostsMissingDates = approvedCount - approvedPostsWithDates.length
  const approvedScheduleDates = approvedPostsWithDates.map(p => new Date(p.scheduledAt!).getTime()).sort((a, b) => a - b)
  const approvedScheduleRange = approvedScheduleDates.length > 0
    ? {
        first: new Date(approvedScheduleDates[0]).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        last: new Date(approvedScheduleDates[approvedScheduleDates.length - 1]).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }
    : null
  const scheduledCount = posts.filter(p => p.status === 'SCHEDULED' && hasValidDate(p.scheduledAt)).length
  const publishedCount = posts.filter(p => p.status === 'PUBLISHED').length
  const manuallyPublishedCount = posts.filter(isUserConfirmedManualPublished).length
  const videoPostCount = posts.filter(p => p.isVideoPost).length
  const approvedOnlyCount = draftCount === 0 && approvedCount > 0 && scheduledCount === 0 && publishedCount === 0
  const scheduledOnlyCount = draftCount === 0 && approvedCount === 0 && scheduledCount > 0 && publishedCount === 0
  const mixedScheduledManualPublishedCount = draftCount === 0 && approvedCount === 0 && scheduledCount > 0 && manuallyPublishedCount > 0
  const contentPlanOrderReview = deriveContentPlanOrderReview(campaign?.aiOutput, posts)
  const contentPlanOrderMismatch =
    posts.length > 0 && contentPlanOrderReview.bound && !contentPlanOrderReview.ok
      ? contentPlanOrderReview
      : null
  const approvalBlockedByOrderMismatch = Boolean(contentPlanOrderMismatch)
  const contentReviewPosts = useMemo(
    () => posts.filter(post => ['DRAFT', 'APPROVED', 'SCHEDULED'].includes(post.status)),
    [posts],
  )
  const contentApprovalPreflight = useMemo(() => {
    const aiOutput = campaign?.aiOutput && typeof campaign.aiOutput === 'object'
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object'
      ? aiOutput.strategy
      : aiOutput
    return reviewContentPlanForApproval(
      contentReviewPosts,
      strategy,
      [
        brandProfile.brandName,
        brandProfile.industry,
        brandProfile.description,
        brandProfile.primaryOffer,
        brandProfile.uniqueAdvantages,
        brandProfile.complianceNotes,
        brandProfile.verifiedProof,
      ],
    )
  }, [brandProfile, campaign?.aiOutput, contentReviewPosts])
  const contentIssueCountByPostId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const issue of contentApprovalPreflight.issues) {
      const post = contentReviewPosts[issue.index - 1]
      if (!post) continue
      counts.set(post.id, (counts.get(post.id) ?? 0) + 1)
    }
    return counts
  }, [contentApprovalPreflight.issues, contentReviewPosts])
  const contentReviewRequired = contentReviewPosts.length > 0 && !contentApprovalPreflight.ok
  const approvalBlockedByTruthReview = draftCount > 0 && contentReviewRequired
  const schedulingBlockedByTruthReview = approvedCount > 0 && contentReviewRequired
  const schedulingBlocked = schedulingBlockedByMedia || schedulingBlockedByTruthReview
  const schedulingDecisionBlocked = schedulingBlocked
    || (scheduleMode === 'AUTO' && (unsupportedAutoTargets.length > 0 || youtubeAutoReviewIncomplete || xAutoReviewIncomplete))
  const approvalBlocked = approvalBlockedByOrderMismatch || approvalBlockedByTruthReview
  const contentHubFulfillmentSummary = deriveStrategyFulfillmentSummary({
    aiOutput: campaign?.aiOutput,
    posts: posts.map(post => ({
      contentPlanIndex: post.contentPlanIndex,
      variantGroup: post.variantGroup,
    })),
    operatingSnapshotsLoaded: !loading && Boolean(campaign),
    locale: isAr ? 'ar' : 'en',
  })
  const contentHubTruthCards = deriveContentHubFirstScreenTruth({
    locale: isAr ? 'ar' : 'en',
    fulfillmentSummary: contentHubFulfillmentSummary,
    totalPosts: posts.length,
    draftCount,
    approvedCount,
    scheduledCount,
    publishedCount,
    manuallyPublishedCount,
    totalImagePosts,
    readyMediaCount: doneCount,
    ambiguousPreviewCount,
    videoPostCount,
    hasOrderMismatch: Boolean(contentPlanOrderMismatch),
  })
  const contentHubTruthToneClass: Record<StrategyFulfillmentTone, string> = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    danger: 'border-rose-200 bg-rose-50 text-rose-950',
    muted: 'border-slate-200 bg-slate-50 text-slate-700',
    checking: 'border-blue-200 bg-blue-50 text-blue-950',
  }
  const contentHubTruthTitle = isAr ? 'حقيقة مركز المحتوى الآن' : 'Content Hub truth right now'
  const contentHubTruthSubtitle = isAr
    ? 'اقرأ هذا أولاً: هل يطابق مركز المحتوى وعد الاستراتيجية، ما حالة المنشورات والوسائط، وما القرار التالي؟'
    : 'Read this first: does Content Hub match the strategy promise, what is the post/media state, and what is the next decision?'
  const operatingState = deriveCampaignOperatingState({ campaign, posts })
  const operatingLabel = isAr ? operatingState.stageLabelAr : operatingState.stageLabel
  const operatingHelper = isAr ? operatingState.stageHelperAr : operatingState.stageHelper
  const visualReadyLabel = isAr ? 'الوسائط جاهزة' : 'Media ready'
  const mediaPendingLabel = isAr ? 'الوسائط بانتظار التوليد' : 'Media pending'
  const mediaReadinessInlineLabel = isAr
    ? `${doneCount} من ${totalImagePosts} وسائط جاهزة${ambiguousPreviewCount > 0 ? ` · ${ambiguousPreviewCount} معاينات تحتاج تأكيد الجاهزية` : ''}`
    : `${doneCount} / ${totalImagePosts} media ready${ambiguousPreviewCount > 0 ? ` · ${ambiguousPreviewCount} media preview${ambiguousPreviewCount === 1 ? '' : 's'} need confirmation` : ''}`
  const ambiguousPreviewExplainer = isAr
    ? 'قد تظهر بعض معاينات الوسائط، لكنها لا تُحتسب جاهزة حتى يتم تأكيد حالة التوليد أو الربط.'
    : 'Some media previews may be visible, but they are not counted ready until generation or attachment status is confirmed.'
  const contentStatusSummary = (() => {
    if (approvedOnlyCount) {
      return isAr
        ? `${approvedCount} منشورات معتمدة بانتظار الجدولة · ${totalImagePosts} خانات صور · ${videoPostCount} خانات فيديو · ${doneCount} عناصر مرئية جاهزة`
        : `${approvedCount} approved posts awaiting scheduling · ${totalImagePosts} image slots · ${videoPostCount} video slots · ${doneCount} visuals generated`
    }
    if (scheduledOnlyCount) {
      return isAr
        ? `${scheduledCount} منشورات مجدولة — غير منشورة · ${totalImagePosts} خانات صور · ${videoPostCount} خانات فيديو · ${doneCount} عناصر مرئية جاهزة`
        : `${scheduledCount} scheduled posts — not published · ${totalImagePosts} image slots · ${videoPostCount} video slots · ${doneCount} visuals generated`
    }
    if (mixedScheduledManualPublishedCount) {
      return isAr
        ? `${manuallyPublishedCount} منشور تم تأكيد نشره يدويًا · ${scheduledCount} منشورات مجدولة — غير منشورة · ${totalImagePosts} خانات صور · ${videoPostCount} خانات فيديو · ${doneCount} عناصر مرئية جاهزة`
        : `${manuallyPublishedCount} manually published post${manuallyPublishedCount === 1 ? '' : 's'} · ${scheduledCount} scheduled posts — not published · ${totalImagePosts} image slots · ${videoPostCount} video slots · ${doneCount} visuals generated`
    }

    return `${posts.length} ${t('contentHub.draftsToReview')} · ${totalImagePosts} ${t('contentHub.imageSlots')} · ${videoPostCount} ${t('contentHub.videoSlots')} · ${doneCount} ${t('contentHub.visualsGenerated')}`
  })()
  const contentStatusExplainer = mixedScheduledManualPublishedCount
    ? (isAr
      ? `تم تسجيل ${manuallyPublishedCount} منشور كمنشور يدويًا بواسطة المستخدم. بقية المنشورات مجدولة داخل NEXUS فقط وغير منشورة.`
      : `${manuallyPublishedCount} post${manuallyPublishedCount === 1 ? ' was' : 's were'} marked as manually published by the user. The remaining posts are scheduled in NEXUS only and are not published.`)
    : scheduledOnlyCount
    ? (isAr
      ? 'المحتوى مجدول فقط. النشر والوسائط والأوتوبايلوت ما زالت خطوات منفصلة.'
      : 'Content is scheduled only. Publishing, media generation, and Autopilot remain separate steps.')
    : approvedOnlyCount
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
  const strategyApprovalRequired = Boolean(campaign && !canMutateCampaignExecution(String(campaign.status ?? '')))
  const strategyApprovalRequiredLabel = isAr ? 'راجع واعتمد الاستراتيجية أولاً' : 'Review and approve strategy first'
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
  const contentPlanDisclosure = mixedScheduledManualPublishedCount
    ? (isAr
      ? 'المنشورات المجدولة والمنشورات المؤكدة يدويًا محفوظة. إعادة التوليد تنشئ خطة مسودة جديدة للمراجعة فقط ولا تغيّر المنشورات الحالية.'
      : 'Scheduled and manually published posts are saved. Regenerating creates a new draft plan for review only and does not change current scheduled or manually published posts.')
    : scheduledOnlyCount
    ? (isAr
      ? 'المحتوى المجدول محفوظ. إعادة التوليد تنشئ خطة مسودة جديدة للمراجعة فقط ولا تنشر المحتوى المجدول.'
      : 'Scheduled posts are saved. Regenerating creates a new draft plan for review only and does not publish scheduled content.')
    : approvedOnlyCount
      ? (isAr
        ? 'المنشورات المعتمدة محفوظة. إعادة التوليد تنشئ خطة مسودة جديدة للمراجعة فقط ولا تجدول أو تنشر المحتوى الحالي.'
        : 'Approved posts are saved; approved posts are not linked to publishing accounts by approval alone. Regenerating creates a new draft plan for review only and does not schedule or publish current content.')
      : (isAr
        ? 'ينشئ مسودات للمراجعة فقط. لا يتم الاعتماد أو الجدولة أو النشر.'
        : 'Creates draft posts for review only. Nothing is approved, scheduled, or published.')
  const contentPlanAutopilotDisclosure = isAr
    ? 'لا يتم تفعيل الأوتوبايلوت.'
    : 'Autopilot is not activated.'
  const firstPlanHeaderSubtitle = isAr
    ? 'حوّل الاستراتيجية الحالية إلى مسودات منشورات قابلة للمراجعة. لا يتم الاعتماد أو الجدولة أو النشر من هذه الخطوة.'
    : 'Turn the current strategy into reviewable draft posts. Nothing is approved, scheduled, or published from this step.'
  const preContentTitle = isAr ? 'خطة المحتوى لم تبدأ بعد' : 'Content planning has not started yet'
  const preContentBody = isAr
    ? 'هذه الحملة لديها استراتيجية، لكن مركز المحتوى لا يحتوي منشورات بعد. راجع جودة الاستراتيجية أولاً إذا كانت الرسائل أو العروض أو المنصات غير نهائية، ثم أنشئ مسودات المحتوى للمراجعة.'
    : 'This campaign has a strategy, but Content Hub does not have posts yet. Review strategy quality first if positioning, offers, or platforms are not final, then create draft content for review.'
  const preContentChecks = isAr
    ? [
      'الاستراتيجية هي مصدر الاتجاه، وليست منشورات جاهزة للنشر.',
      'خطة المحتوى تنشئ مسودات فقط للمراجعة والتحرير.',
      'الاعتماد والجدولة والنشر وتوليد الصور خطوات منفصلة لاحقاً.',
    ]
    : [
      'The strategy is the direction source, not publish-ready posts.',
      'The content plan creates draft posts only for review and editing.',
      'Approval, scheduling, publishing, and image generation remain separate later steps.',
    ]
  const preContentStrategyCta = isAr ? 'مراجعة الاستراتيجية أولاً' : 'Review strategy first'
  const preContentGenerateCta = contentPlanLocked ? addCreditsForDraftPlanLabel : draftPlanLabel
  const generatePlanConfirmTitle = isAr ? 'تأكيد إنشاء خطة محتوى مسودة' : 'Confirm draft content plan generation'
  const generatePlanConfirmBody = isAr
    ? `سيستخدم NEXUS الاستراتيجية الحالية لإنشاء مسودات منشورات للمراجعة فقط. التكلفة ${contentPlanCostLabel}.`
    : `NEXUS will use the current strategy to create draft posts for review only. Cost: ${contentPlanCostLabel}.`
  const generatePlanConfirmSafety = isAr
    ? 'لن يتم اعتماد أو جدولة أو نشر أي منشور. لن يتم توليد صور، ولن يتم تفعيل الأوتوبايلوت أو تحديث Brand Brain كنتيجة أداء.'
    : 'No post will be approved, scheduled, or published. No images are generated, Autopilot is not activated, and Brand Brain is not updated as performance learning.'
  const generatePlanAcknowledgeLabel = isAr
    ? 'أفهم أن هذا ينشئ مسودات محتوى فقط للمراجعة ويصرف الرصيد الموضح.'
    : 'I understand this creates draft content only for review and spends the shown credits.'
  const generatePlanFinalCta = isAr ? 'تأكيد إنشاء المسودات' : 'Confirm draft generation'
  const creditBalanceLabel = billingLoading
    ? (isAr ? 'جارٍ تحديث الرصيد' : 'Checking credit balance')
    : isUnlimited
      ? (isAr ? 'رصيد غير محدود' : 'Unlimited credits')
      : isAr
        ? `رصيدك الحالي: ${Math.max(0, Math.trunc(creditsRemaining))} كريديت`
        : `Current balance: ${Math.max(0, Math.trunc(creditsRemaining))} credits`
  const finalPreviewTitle = isAr
    ? 'المعاينة النهائية للمنشورات + قرارات الوسائط'
    : 'Final post preview + media decisions'
  const finalPreviewBody = isAr
    ? 'مركز المحتوى هو مصدر الحقيقة لنصوص المنشورات وحالة كل منشور والوسائط المرتبطة به. المنشورات المجدولة غير منشورة، والمنشورات التي تنتظر وسائط ليست نهائية بصريًا.'
    : 'Content Hub is the source of truth for post copy, lifecycle status, and post-linked media. Scheduled posts are not published, and media-pending posts are not visually final.'
  const finalPreviewHelper = isAr
    ? 'هذه معاينة مراجعة داخل NEXUS؛ قد يختلف عرض المنصة قليلًا. قرارات الوسائط لا تنشر المحتوى بدون مسار نشر صريح.'
    : 'This is a NEXUS review preview; platform rendering may differ slightly. Media decisions do not publish content without an explicit publish flow.'
  const productionReadiness = posts.length
    ? Math.round(((Math.max(0, posts.length - draftCount) * 0.28) + (doneCount * 0.34) + (scheduledCount * 0.22) + (publishedCount * 0.16)) / Math.max(posts.length, 1) * 100)
    : 0
  const productionDecision = (() => {
    if (posts.length === 0) {
      return {
        eyebrow: isAr ? 'لم يبدأ الإنتاج' : 'Production not started',
        title: isAr ? 'أنشئ مسودات المحتوى بعد مراجعة الاستراتيجية' : 'Create draft posts after reviewing strategy',
        body: isAr
          ? 'لا يوجد محتوى نهائي هنا بعد. ابدأ فقط عندما تكون الرسائل والمنصات والعدد واضحين.'
          : 'No final production exists here yet. Start only when messaging, platforms, and post count are clear.',
        label: isAr ? 'مراجعة الاستراتيجية أولاً' : 'Review strategy first',
        onClick: () => router.push(`/campaigns/${campaignId}?tab=strategy`),
      }
    }
    if (contentPlanOrderMismatch) {
      return {
        eyebrow: isAr ? 'توقف تشغيل' : 'Operating stop',
        title: isAr ? 'خطة المحتوى لا تطابق أمر الاستراتيجية' : 'Content plan does not match the strategy order',
        body: isAr
          ? 'وعد الاستراتيجية لا يطابق خطة المحتوى الحالية. أصلح التطابق قبل أي اعتماد أو جدولة.'
          : 'The strategy promise does not match the current content plan. Fix the match before approval or scheduling.',
        label: isAr ? 'راجع وعد الاستراتيجية' : 'Review strategy promise',
        onClick: () => router.push(`/campaigns/${campaignId}?tab=strategy`),
      }
    }
    if (draftCount > 0) {
      return {
        eyebrow: isAr ? 'مرحلة مراجعة' : 'Review stage',
        title: isAr ? 'راجع المسودات قبل أي اعتماد' : 'Review drafts before approval',
        body: isAr
          ? 'المطلوب الآن قراءة النصوص والمنصات والوسائط. الاعتماد يظل قراراً منفصلاً.'
          : 'Read copy, platforms, and media state now. Approval remains a separate decision.',
        label: isAr ? 'انتقل إلى قائمة المنشورات' : 'Go to post board',
        onClick: () => document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      }
    }
    if (pendingImageCount > 0 || ambiguousPreviewCount > 0) {
      return {
        eyebrow: isAr ? 'قرار وسائط' : 'Media decision',
        title: isAr ? 'أكمل قرارات الوسائط قبل النشر' : 'Complete media decisions before publishing',
        body: isAr
          ? 'الاستوديو يصنع الأصول، لكن الربط النهائي بالمنشور يحدث هنا بتأكيد واضح.'
          : 'Studio creates assets, but final post attachment is confirmed here.',
        label: isAr ? 'راجع خانات الوسائط' : 'Review media slots',
        onClick: () => document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      }
    }
    if (approvedCount > 0) {
      return {
        eyebrow: isAr ? 'جاهز للجدولة' : 'Ready for scheduling',
        title: isAr
          ? `جدولة ${approvedCount} منشورات معتمدة`
          : `Schedule ${approvedCount} approved post${approvedCount === 1 ? '' : 's'}`,
        body: isAr
          ? 'الجدولة قرار تشغيل مستقل. لا يعني ذلك نشر المنصة أو تفعيل الأوتوبايلوت.'
          : 'Scheduling is a separate operating decision. It does not mean platform publish or Autopilot activation.',
        label: isAr ? 'راجع خيار الجدولة' : 'Review scheduling option',
        onClick: () => document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      }
    }
    return {
      eyebrow: isAr ? 'جاهزية النشر' : 'Publish readiness',
      title: isAr ? 'انتقل إلى جاهزية النشر' : 'Move to publishing readiness',
      body: isAr
        ? 'هذه الصفحة سلّمت مسودات/منشورات الحملة. النشر والحسابات والصلاحيات في تبويب النشر.'
        : 'This page has delivered campaign posts. Publishing, accounts, and permissions live in the Publish tab.',
      label: isAr ? 'افتح تبويب النشر' : 'Open Publish tab',
      onClick: () => router.push(`/campaigns/${campaignId}?tab=publish`),
    }
  })()
  const productionTiles = [
    {
      label: isAr ? 'مطابقة عدد الطلب' : 'Order count match',
      value: contentPlanOrderMismatch ? (isAr ? 'تحتاج إصلاح' : 'Needs fix') : posts.length > 0 ? (isAr ? 'العدد مطابق' : 'Count matched') : (isAr ? 'بانتظار الخطة' : 'Waiting for plan'),
      helper: isAr ? 'هذا يتحقق من العدد والنوع فقط؛ جودة واتساق النصوص لهما مراجعة منفصلة.' : 'This checks count and type only; copy quality and alignment are reviewed separately.',
      tone: contentPlanOrderMismatch ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      label: isAr ? 'مراجعة النصوص' : 'Copy review',
      value: posts.length ? `${Math.max(0, posts.length - draftCount)} / ${posts.length}` : '0 / 0',
      helper: isAr ? 'المسودات تراجع هنا؛ الكتابة والتحسين لا ينشران تلقائياً.' : 'Drafts are reviewed here; copy edits never publish automatically.',
      tone: 'text-[#5E63FF] bg-[#F2F4FF] border-[#DDE2FF]',
    },
    {
      label: isAr ? 'جاهزية الوسائط' : 'Media readiness',
      value: `${doneCount} / ${totalImagePosts}`,
      helper: isAr ? 'الأصول النهائية تأتي من الاستوديو أو المكتبة ثم تربط هنا.' : 'Final assets come from Studio or Media Library, then attach here.',
      tone: doneCount >= totalImagePosts && totalImagePosts > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      label: isAr ? 'حالة النشر' : 'Publishing state',
      value: scheduledCount > 0 ? (isAr ? `${scheduledCount} مجدول` : `${scheduledCount} scheduled`) : publishedCount > 0 ? (isAr ? `${publishedCount} منشور` : `${publishedCount} published`) : (isAr ? 'غير منشور' : 'Not published'),
      helper: isAr ? 'لا يوجد نشر منصة من هذه القراءة؛ النشر له تبويب وتأكيدات.' : 'No platform publish happens from this read; publishing has its own tab and confirmations.',
      tone: 'text-slate-700 bg-slate-50 border-slate-200',
    },
  ]
  const orderMismatchExpectedLabel = contentPlanOrderMismatch?.expectedDirections ?? (isAr ? 'غير محدد' : 'not set')
  const orderMismatchTitle = isAr
    ? 'خطة المحتوى لا تطابق أمر الاستراتيجية'
    : 'Content plan does not match the strategy order'
  const orderMismatchBody = contentPlanOrderMismatch
    ? contentPlanOrderMismatch.reason === 'paid-plan-has-posts'
      ? (isAr
        ? `تم طلب هذه الحملة كتخطيط مدفوع فقط، لكن مركز المحتوى يحتوي ${contentPlanOrderMismatch.actualDirections} اتجاهات منشورات. يجب إعادة توليد أو إصلاح المسودة قبل الاعتماد.`
        : `This campaign was ordered as paid planning only, but Content Hub currently has ${contentPlanOrderMismatch.actualDirections} post directions. Regenerate or repair the draft plan before approval.`)
      : contentPlanOrderMismatch.reason === 'missing-organic-count'
      ? (isAr
        ? 'هذه الحملة لديها أمر استراتيجية محفوظ، لكن لا يوجد عدد عضوي موثوق لمركز المحتوى. يجب إعادة توليد أو إصلاح المسودة قبل الاعتماد.'
        : 'This campaign has a saved strategy order, but no reliable organic post-count scope. Regenerate or repair the draft plan before approval.')
      : (isAr
        ? `أمر الاستراتيجية يطلب ${orderMismatchExpectedLabel} اتجاهات منشورات، لكن مركز المحتوى يعرض ${contentPlanOrderMismatch.actualDirections}. الاعتماد متوقف حتى تتطابق المسودة مع الوعد.`
        : `The strategy order expects ${orderMismatchExpectedLabel} post directions, but Content Hub shows ${contentPlanOrderMismatch.actualDirections}. Approval is locked until the draft matches the promise.`)
    : ''
  const orderMismatchAction = isAr
    ? 'استخدم إعادة توليد خطة محتوى مسودة أو اطلب إصلاح بيانات صريح؛ لن يتم اعتماد أو جدولة أو نشر أي شيء من هذا التنبيه.'
    : 'Use draft content-plan regeneration or an explicit data repair; this warning does not approve, schedule, or publish anything.'
  const pendingAttachmentPost = pendingMediaAttachment
    ? posts.find(p => p.id === pendingMediaAttachment.postId)
    : null
  const pendingAttachmentReopensReview = Boolean(
    pendingAttachmentPost && ['APPROVED', 'SCHEDULED', 'FAILED'].includes(pendingAttachmentPost.status),
  )
  const mediaRemovalPost = mediaRemovalPostId
    ? posts.find(p => p.id === mediaRemovalPostId)
    : null
  const mediaRemovalReopensReview = Boolean(
    mediaRemovalPost && ['APPROVED', 'SCHEDULED', 'FAILED'].includes(mediaRemovalPost.status),
  )
  const imageGenerationConfirmPost = imageGenerationConfirmPostId
    ? posts.find(p => p.id === imageGenerationConfirmPostId)
    : null
  const imageGenerationReopensReview = Boolean(
    imageGenerationConfirmPost && ['APPROVED', 'SCHEDULED', 'FAILED'].includes(imageGenerationConfirmPost.status),
  )
  const bulkImageButtonLabel = isAr
    ? `توليد ${pendingImageCount} صور منشورات — ${bulkImageCreditCost} كريديت`
    : `Generate ${pendingImageCount} post images — ${bulkImageCreditCost} credits total`
  const approveDraftsLabel = isAr
    ? `اعتماد نصوص ${draftCount} مسودات`
    : `Approve copy for ${draftCount} draft${draftCount === 1 ? '' : 's'}`
  const scheduleApprovedLabel = isAr
    ? schedulingBlockedByTruthReview
      ? 'راجع جودة النصوص قبل الجدولة'
      : schedulingBlockedByMedia
        ? `أكمل وسائط ${approvedPostsNeedingMediaCount} منشورات قبل الجدولة`
        : `جدولة ${approvedCount} منشورات معتمدة`
    : schedulingBlockedByTruthReview
      ? 'Review copy quality before scheduling'
      : schedulingBlockedByMedia
        ? `Complete media for ${approvedPostsNeedingMediaCount} post${approvedPostsNeedingMediaCount === 1 ? '' : 's'} before scheduling`
        : `Schedule ${approvedCount} approved post${approvedCount === 1 ? '' : 's'}`
  const formatStatusSummaryChip = (count: number, label: string) => {
    if (isAr || count === 1) return `${count} ${label}`
    const pluralLabels: Record<string, string> = {
      [t('contentHub.sumDraft')]: 'drafts',
      [t('contentHub.sumApproved')]: 'approved',
      [t('contentHub.sumScheduled')]: 'scheduled',
      [t('contentHub.sumPublished')]: 'published',
      [t('contentHub.sumFailed')]: 'failed',
    }
    return `${count} ${pluralLabels[label] ?? label}`
  }
  const rewriteCostLabel = isAr ? `${CONTENT_HUB_REWRITE_COST} كريديت` : `${CONTENT_HUB_REWRITE_COST} credit`

  const getPendingEdit = (postId: string) => pendingEdits[postId] ?? {}

  // ── Generate content plan ────────────────────────────────────────────────────

  async function generatePlan(mediaSource: 'GENERATE' | 'MIXED' = 'GENERATE') {
    if (!isAuthenticated) return
    if (strategyApprovalRequired) {
      router.push(`/campaigns/${campaignId}?tab=strategy`)
      return
    }
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
      await refreshBillingStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingPlan(false)
    }
  }

  function openGeneratePlanConfirm() {
    if (strategyApprovalRequired) {
      router.push(`/campaigns/${campaignId}?tab=strategy`)
      return
    }
    setGeneratePlanAcknowledged(false)
    setShowGeneratePlanConfirm(true)
  }

  function closeGeneratePlanConfirm() {
    if (generatingPlan) return
    setGeneratePlanAcknowledged(false)
    setShowGeneratePlanConfirm(false)
  }

  async function confirmGeneratePlan() {
    if (!generatePlanAcknowledged) return
    setShowGeneratePlanConfirm(false)
    setGeneratePlanAcknowledged(false)
    await generatePlan()
  }

  function openRegenerateConfirm() {
    if (strategyApprovalRequired) {
      router.push(`/campaigns/${campaignId}?tab=strategy`)
      return
    }
    setRegenerateAcknowledged(false)
    setShowRegenerateConfirm(true)
  }

  function closeRegenerateConfirm() {
    if (generatingPlan) return
    setRegenerateAcknowledged(false)
    setShowRegenerateConfirm(false)
  }

  async function confirmRegeneratePlan() {
    if (!regenerateAcknowledged) return
    setShowRegenerateConfirm(false)
    setRegenerateAcknowledged(false)
    await generatePlan()
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

  async function savePostEdit(postId: string, updates: Partial<ContentPost> & Record<string, unknown>) {
    if (!isAuthenticated) return
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content-plan/${postId}`, {
        method: 'PATCH',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to save post edit')
      const safeUpdates = data.post ?? updates
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...safeUpdates } : p))
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    } catch (err: any) {
      console.error('Failed to save edit', err)
      setError(err.message ?? 'Failed to save post edit')
    }
  }

  // ── Assign uploaded media to a post ─────────────────────────────────────────

  function requestMediaAttachment(postId: string, media: MediaItem) {
    const post = posts.find(p => p.id === postId)
    setPendingMediaAttachment({
      postId,
      media,
      action: post?.imageUrl ? 'replace' : 'attach',
    })
    setMediaAttachmentAcknowledged(false)
    setMediaPickerOpen(null)
  }

  async function confirmMediaAttachment() {
    if (!pendingMediaAttachment || !mediaAttachmentAcknowledged) return
    const { postId, media, action } = pendingMediaAttachment
    await savePostEdit(postId, {
      uploadedMediaId: media.id,
      ...(action === 'replace'
        ? { explicitMediaReplaceConfirmed: true }
        : { explicitMediaAttachConfirmed: true }),
    })
    setPendingMediaAttachment(null)
    setMediaAttachmentAcknowledged(false)
  }

  function requestMediaRemoval(postId: string) {
    setMediaRemovalPostId(postId)
    setMediaRemovalAcknowledged(false)
  }

  async function confirmMediaRemoval() {
    if (!mediaRemovalPostId || !mediaRemovalAcknowledged) return
    await savePostEdit(mediaRemovalPostId, {
      uploadedMediaId: null,
      explicitMediaRemoveConfirmed: true,
    })
    setMediaRemovalPostId(null)
    setMediaRemovalAcknowledged(false)
  }

  function closeMediaAttachmentConfirm() {
    setPendingMediaAttachment(null)
    setMediaAttachmentAcknowledged(false)
  }

  function closeMediaRemovalConfirm() {
    setMediaRemovalPostId(null)
    setMediaRemovalAcknowledged(false)
  }

  // ── Bulk generate images ─────────────────────────────────────────────────────

  async function generateAllImages() {
    if (!isAuthenticated) return
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    const imagePostIds = pendingImagePosts.map(p => p.id)
    setGenerating(true)
    setError(null)
    try {
      // The user confirms the whole action once, while the server processes one
      // paid image per request so a slow provider can never strand a batch.
      for (let index = 0; index < imagePostIds.length; index += 1) {
        const batchIds = imagePostIds.slice(index, index + 1)
        const res = await fetch(`/api/campaigns/${campaignId}/generate-content-plan/generate`, {
          method: 'POST',
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postIds: batchIds,
            explicitBulkImageGenerationConfirmed: true,
            acknowledgedImageCount: batchIds.length,
            acknowledgedCreditCost: getBulkImageGenerationCost(batchIds.length),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      }
      setSuccessMsg('Image generation started — this may take a few minutes')
      await loadData()
      await refreshBillingStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function openBulkImageConfirm() {
    setBulkImageAcknowledged(false)
    setShowBulkImageConfirm(true)
  }

  function closeBulkImageConfirm() {
    if (generating) return
    setBulkImageAcknowledged(false)
    setShowBulkImageConfirm(false)
  }

  async function confirmBulkImageGeneration() {
    if (!bulkImageAcknowledged) return
    setShowBulkImageConfirm(false)
    setBulkImageAcknowledged(false)
    await generateAllImages()
  }

  // ── Approve all posts → scheduled ────────────────────────────────────────────

  async function approveAll() {
    if (!isAuthenticated) return
    if (contentPlanOrderMismatch) {
      setError(orderMismatchBody)
      setShowApproveConfirm(false)
      return
    }
    if (approvalBlockedByTruthReview) {
      setError(isAr
        ? 'تم إيقاف الاعتماد لأن مسودة أو أكثر لا تطابق Brand Brain والاستراتيجية بأمان. عدّل المسودات أو أعد توليدها ثم راجعها مجددًا.'
        : 'Approval is blocked because one or more drafts are not safely aligned with Brand Brain and the strategy. Edit or regenerate the drafts, then review again.')
      setShowApproveConfirm(false)
      return
    }
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
      const pendingFreshImages = freshPosts.filter(
        p => !p.isVideoPost && !isContentPostMediaReadyForScheduling(p),
      ).length

      setApproveResult({
        kind: 'approved',
        approved:  data.approved  ?? 0,
        linked:    data.linked    ?? 0,
        unlinked:  data.unlinked  ?? 0,
        signals: {
          hooks:  data.signals?.hooks  ?? 0,
          angles: data.signals?.angles ?? 0,
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
    if (!isAuthenticated || !scheduleAcknowledged) return
    if (schedulingBlockedByTruthReview) {
      setShowScheduleConfirm(false)
      setScheduleAcknowledged(false)
      setError(isAr
        ? 'راجع أو أعد توليد النصوص التي تحمل ملاحظات جودة قبل الجدولة.'
        : 'Review or regenerate copy with quality findings before scheduling.')
      document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (schedulingBlockedByMedia) {
      setShowScheduleConfirm(false)
      setScheduleAcknowledged(false)
      setError(isAr
        ? `أكمل مراجعة وسائط ${approvedPostsNeedingMediaCount} منشورات قبل الجدولة.`
        : `Complete media review for ${approvedPostsNeedingMediaCount} post${approvedPostsNeedingMediaCount === 1 ? '' : 's'} before scheduling.`)
      document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (scheduleMode === 'AUTO' && (unsupportedAutoTargets.length > 0 || youtubeAutoReviewIncomplete || xAutoReviewIncomplete)) {
      setError(isAr
        ? 'أكمل إعدادات YouTube، وتأكد أن منشورات X نص أو صورة فقط ولا تتجاوز 280 حرفًا، أو استخدم التنفيذ اليدوي.'
        : 'Complete YouTube settings and ensure X posts are text or image only and no longer than 280 characters, or use manual execution.')
      return
    }
    setScheduling(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/schedule-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode: scheduleMode,
          explicitAutoPublishConfirmed: scheduleMode === 'AUTO' && scheduleAcknowledged,
          destinationByTarget,
          tiktokOptions,
          youtubeOptionsByPostId: Object.fromEntries(
            Object.entries(youtubeOptionsByPostId).map(([postId, options]) => [postId, {
              title: options.title.trim(),
              privacyStatus: options.privacyStatus,
              selfDeclaredMadeForKids: options.madeForKids === 'yes',
              containsSyntheticMedia: options.syntheticMedia === 'yes',
              notifySubscribers: options.notifySubscribers,
              categoryId: '22',
            }]),
          ),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const blockerMessage = Array.isArray(data.blockers)
          ? data.blockers.map((blocker: { message?: unknown }) => typeof blocker?.message === 'string' ? blocker.message : '').filter(Boolean).join(' ')
          : ''
        throw new Error(blockerMessage || data.error || 'Scheduling failed')
      }

      const freshPosts = await loadData()
      const scheduledPosts = freshPosts.filter(p => p.status === 'SCHEDULED' && hasValidDate(p.scheduledAt))
      const scheduledDates = scheduledPosts.map(p => p.scheduledAt!).sort()
      const platformsUsed = [...new Set(scheduledPosts.map(p => p.platform.toUpperCase()))]

      setApproveResult({
        kind: 'scheduled',
        approved:  data.scheduled ?? 0,
        linked:    data.linked    ?? 0,
        unlinked:  0,
        signals: { hooks: 0, angles: 0 },
        platforms: platformsUsed,
        firstDate: scheduledDates[0] ?? null,
        lastDate:  scheduledDates[scheduledDates.length - 1] ?? null,
        pendingImages: 0,
        totalImages: 0,
        videoSlots: 0,
      })
      setShowScheduleConfirm(false)
      setScheduleAcknowledged(false)
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

  function openManualPublishModal(post: ContentPost) {
    setManualPublishPost(post)
    setManualUrl('')
    setManualPublishConfirmed(false)
  }

  function closeManualPublishModal() {
    if (manualPublishing) return
    setManualPublishPost(null)
    setManualUrl('')
    setManualPublishConfirmed(false)
  }

  async function confirmManualPublish() {
    const post = manualPublishPost
    if (!post || !isAuthenticated || !manualPublishConfirmed) return
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
      setManualPublishConfirmed(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setManualPublishing(false)
    }
  }

  // ── AI Rewrite a post caption ─────────────────────────────────────────────────

  function requestRewrite(postId: string, instruction: string) {
    setRewriteConfirm({ postId, instruction })
    setRewriteAcknowledged(false)
    return Promise.resolve()
  }

  function closeRewriteConfirm() {
    if (rewritingPost) return
    setRewriteConfirm(null)
    setRewriteAcknowledged(false)
  }

  async function confirmRewrite() {
    if (!rewriteConfirm || !rewriteAcknowledged) return
    await rewritePost(rewriteConfirm.postId, rewriteConfirm.instruction)
    setRewriteConfirm(null)
    setRewriteAcknowledged(false)
  }

  async function rewritePost(postId: string, instruction: string) {
    if (!isAuthenticated) return
    setRewritingPost(postId)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content-plan/${postId}/rewrite`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          explicitRewriteConfirmed: true,
          acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST,
        }),
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
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...data.post } : p))
      // Clear any pending edit for this post so it shows the fresh caption
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      await refreshBillingStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRewritingPost(null)
    }
  }

  // ── Generate real AI image for a single post ─────────────────────────────────
  // Calls /api/visuals/generate → gpt-image-1 or Flux → Cloudinary + brand overlay

  function openImageGenerationConfirm(postId: string) {
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    setImageGenerationAcknowledged(false)
    setImageGenerationConfirmPostId(postId)
  }

  function closeImageGenerationConfirm() {
    if (generatingImageId) return
    setImageGenerationConfirmPostId(null)
    setImageGenerationAcknowledged(false)
  }

  async function confirmPostImageGeneration() {
    if (!imageGenerationConfirmPostId || !imageGenerationAcknowledged) return
    const post = posts.find(p => p.id === imageGenerationConfirmPostId)
    if (!post) return
    await generatePostImage(post.id, post.platform)
  }

  async function generatePostImage(postId: string, platform: string) {
    if (!isAuthenticated) return
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    const post = posts.find(p => p.id === postId)
    if (!post) return

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

      const creativeRequirement = derivePostCreativeRequirement({
        postId: post.id,
        platform: post.platform,
        caption: post.caption || post.imagePrompt || '',
        status: post.status,
        imageUrl: post.imageUrl,
        uploadedMediaId: post.uploadedMediaId,
        mediaSource: post.mediaSource,
        generationStatus: post.generationStatus,
        isVideoPost: post.isVideoPost,
        brandName: campaign?.name,
      })
      const creativeTemplate = getDefaultTemplateForPlatform(creativeRequirement.platform)

      // Generate a post background/draft visual for review. Text/logo/CTA layers
      // remain separate future template layers, not AI-raster text.
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
          assetRole: 'post_background',
          creativeRequirement,
          creativeTemplate,
          explicitImageGenerationConfirmed: true,
          acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST,
          acknowledgedNoPublishOrSchedule: true,
          acknowledgedPostMediaForReview: true,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Image generation failed')
      }

      const data = await res.json()
      const imageUrl = data?.visual?.imageUrl
      const generatedVisualId = data?.visual?.id
      if (!imageUrl || !generatedVisualId) throw new Error('No durable generated media returned')

      await savePostEdit(postId, {
        generatedVisualId,
        explicitGeneratedMediaAttachConfirmed: true,
      })
      await refreshBillingStatus()
      setImageGenerationConfirmPostId(null)
      setImageGenerationAcknowledged(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingImageId(null)
    }
  }

  // ── Select A/B draft variant ─────────────────────────────────────────────────

  async function pickVariant(postId: string) {
    if (!isAuthenticated) return
    setPickingWinner(postId)
    setError(null)
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/content-plan/${postId}/pick-winner`,
        { method: 'PATCH', headers: { Authorization: authHeader() } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to select variant')

      // Remove the sibling from local state; legacy field name still marks the selected variant.
      setPosts(prev => {
        const selected = prev.find(p => p.id === postId)
        if (!selected) return prev
        const varGroup = selected.variantGroup
        // Keep posts where: not in this variantGroup OR same id as selected
        return prev
          .filter(p => !varGroup || p.variantGroup !== varGroup || p.id === postId)
          .map(p => p.id === postId
            ? { ...p, variantWinner: true, variantGroup: null, variantLabel: null }
            : p,
          )
      })

      setSuccessMsg(
        data.preferenceSignalSaved
          ? '✓ Variant selected. Hook preference signal saved.'
          : '✓ Variant selected.',
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
      <div className="min-h-screen bg-[#F4F7FB] px-4 py-5 text-[#0B1028] sm:px-6">
      <div className="mx-auto max-w-[1580px]">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 items-start justify-between mb-6 gap-4 flex-wrap">
          <div className="min-w-0">
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
                <p className="hidden">{contentStatusExplainer}</p>
                <div className="hidden">
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-violet-500" />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">{operatingLabel}</span>
                    <span className="block text-xs text-slate-500">{operatingHelper}</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">{firstPlanHeaderSubtitle}</p>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-stretch justify-start gap-3 sm:w-auto sm:items-center sm:justify-end">
            {posts.length > 0 && (
              <>
                {/* Primary CTA — honest two-step lifecycle:
                    DRAFT → Approve → APPROVED → Schedule → SCHEDULED */}
                {draftCount > 0 ? (
                  <button
                    onClick={() => {
                      if (!approvalBlocked) setShowApproveConfirm(true)
                    }}
                    disabled={approving || approvalBlocked}
                    className="flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold leading-tight transition-all whitespace-normal break-words"
                    style={{
                      background: '#059669',
                      color: 'white',
                      opacity: approving || approvalBlocked ? 0.6 : 1,
                    }}
                  >
                    {approving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {t('contentHub.approving')}
                      </>
                    ) : (
                      <>
                        ✓ {approveDraftsLabel}
                      </>
                    )}
                  </button>
                ) : approvedCount > 0 ? (
                  <button
                    onClick={() => {
                      if (schedulingBlocked) {
                        document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        return
                      }
                      setScheduleAcknowledged(false)
                      setYouTubeOptionsByPostId(current => {
                        const next = { ...current }
                        for (const post of approvedPostsWithDates) {
                          if (!['YOUTUBE', 'YOUTUBE_SHORTS'].includes(post.platform.toUpperCase()) || next[post.id]) continue
                          next[post.id] = defaultYouTubeScheduleOptions(post)
                        }
                        return next
                      })
                      setShowScheduleConfirm(true)
                    }}
                    disabled={scheduling}
                    className="flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold leading-tight transition-all whitespace-normal break-words"
                    style={{
                      background: schedulingBlocked ? '#FFFBEB' : '#4F46E5',
                      color: schedulingBlocked ? '#92400E' : 'white',
                      border: schedulingBlocked ? '1px solid #FDE68A' : '1px solid transparent',
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
                        {schedulingBlocked ? '⚠️' : '🗓'} {scheduleApprovedLabel}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex max-w-full min-w-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium leading-tight"
                    style={{ background: '#ECFDF5', color: '#047857', border: '1px solid rgba(5,150,105,0.18)' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13.5 4.5l-7 7-3-3"/></svg>
                    {mixedScheduledManualPublishedCount
                      ? (isAr ? 'منشور يدويًا + مجدول' : 'Manual publish + scheduled')
                      : scheduledCount > 0
                      ? (isAr ? 'المحتوى مجدول فقط' : 'Content scheduled only')
                      : (isAr ? 'اكتملت مراجعة المحتوى' : 'Content review complete')}
                  </div>
                )}

                <button
                  onClick={imageGenerationLocked ? () => router.push('/billing') : openBulkImageConfirm}
                  disabled={generating || pendingImageCount === 0}
                  className="flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold leading-tight transition-all whitespace-normal break-words"
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
                      ✨ {imageGenerationLocked ? addCreditsForImagesLabel : bulkImageButtonLabel}
                    </>
                  )}
                </button>
                <div className="flex max-w-sm flex-col items-start gap-1 sm:items-end">
                  <button
                    onClick={strategyApprovalRequired ? () => router.push(`/campaigns/${campaignId}?tab=strategy`) : contentPlanLocked ? () => router.push('/billing') : openRegenerateConfirm}
                    disabled={generatingPlan}
                    className="max-w-full min-w-0 rounded-xl border px-4 py-2 text-center text-sm leading-tight transition-all whitespace-normal break-words"
                    style={{ borderColor: contentPlanLocked ? 'rgba(239,68,68,0.18)' : 'rgba(15,23,42,0.14)', color: contentPlanLocked ? '#B91C1C' : '#374151', background: contentPlanLocked ? '#FEF2F2' : '#FFFFFF' }}
                  >
                    {generatingPlan ? t('contentHub.regenerating') : strategyApprovalRequired ? strategyApprovalRequiredLabel : contentPlanLocked ? addCreditsForRegenerateDraftPlanLabel : `↻ ${regenerateDraftPlanLabel}`}
                  </button>
                  <p className="text-xs leading-relaxed text-slate-500 sm:text-right">
                    {contentPlanLocked ? `${contentPlanRequirementDisclosure} ` : ''}{contentPlanDisclosure} {contentPlanAutopilotDisclosure}
                  </p>
                  <p className="text-[11px] text-slate-400">{creditBalanceLabel}</p>
                </div>
              </>
            )}

            {posts.length === 0 && (
              <div className="flex w-full min-w-0 flex-wrap items-stretch justify-start gap-3 sm:w-auto sm:items-center sm:justify-end">
                {/* A/B Testing toggle */}
                <button
                  onClick={() => setEnableABTesting(prev => !prev)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all"
                  style={{
                    background: enableABTesting ? '#FFFBEB' : '#FFFFFF',
                    border: enableABTesting ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(15,23,42,0.10)',
                    color: enableABTesting ? '#B45309' : '#6b7280',
                  }}
                  title="Generate A/B variants for each post — compare two hook styles and select a preferred draft"
                >
                  <span>A/B</span>
                  <span className={`w-6 h-3 rounded-full relative transition-all ${enableABTesting ? 'bg-yellow-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-2 h-2 bg-white rounded-full shadow transition-all ${enableABTesting ? 'left-3.5' : 'left-0.5'}`} />
                  </span>
                </button>
                <div className="flex max-w-sm flex-col items-start gap-1 sm:items-end">
                  <button
                    onClick={strategyApprovalRequired ? () => router.push(`/campaigns/${campaignId}?tab=strategy`) : contentPlanLocked ? () => router.push('/billing') : openGeneratePlanConfirm}
                    disabled={generatingPlan}
                    className="flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-center text-sm font-semibold leading-tight transition-all whitespace-normal break-words"
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
                    ) : strategyApprovalRequired ? strategyApprovalRequiredLabel : contentPlanLocked ? addCreditsForDraftPlanLabel : `✨ ${draftPlanLabel}`}
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

        {posts.length > 0 && (
          <section className="hidden">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-[radial-gradient(circle_at_50%_45%,rgba(94,99,255,0.42),rgba(238,242,255,0.72)_48%,#ffffff_72%)] shadow-[0_18px_46px_rgba(94,99,255,0.20)]">
                      <span className="absolute inset-3 rounded-full border border-white/80" />
                      <span className="relative text-3xl">✦</span>
                    </div>
                    <div className="min-w-0" dir={isAr ? 'rtl' : 'ltr'}>
                      <p className="inline-flex rounded-full border border-[#DDE2FF] bg-[#F2F4FF] px-3 py-1 text-[11px] font-black text-[#5E63FF]">
                        {isAr ? 'لوحة تسليم المحتوى' : 'Content delivery board'}
                      </p>
                      <h2 className="mt-3 text-2xl font-black tracking-normal text-[#0B1028] sm:text-3xl">
                        {isAr ? 'من الاستراتيجية إلى منشورات جاهزة للمراجعة' : 'From strategy to reviewable posts'}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
                        {isAr
                          ? 'هذه ليست صفحة تصميم. الاستوديو يصنع الأصول والنسخ الإبداعية؛ Content Hub يثبت الحزمة النهائية لكل منشور: النص، المنصة، الوسيط، الحالة، وما ينقص قبل الجدولة أو النشر.'
                          : 'This is not the design studio. Studio creates assets and creative variants; Content Hub locks the final package for each post: copy, platform, media, lifecycle state, and what is missing before scheduling or publishing.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div
                      className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `conic-gradient(#5E63FF ${Math.max(0, Math.min(100, productionReadiness)) * 3.6}deg, #E9EDF7 0deg)` }}
                    >
                      <span className="absolute inset-2 rounded-full bg-white" />
                      <span className="relative text-xl font-black text-[#0B1028]" dir="ltr">{productionReadiness}%</span>
                    </div>
                    <div dir={isAr ? 'rtl' : 'ltr'}>
                      <p className="text-[12px] font-black text-slate-500">{isAr ? 'جاهزية التسليم' : 'Delivery readiness'}</p>
                      <p className="mt-1 text-sm font-bold text-[#0B1028]">{contentStatusSummary}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {productionTiles.map(tile => (
                    <article key={tile.label} className={`rounded-2xl border p-4 ${tile.tone}`}>
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-70">{tile.label}</p>
                      <p className="mt-2 text-lg font-black" dir="auto">{tile.value}</p>
                      <p className="mt-2 text-xs font-semibold leading-5 opacity-75">{tile.helper}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    {
                      step: '01',
                      title: isAr ? 'Strategy' : 'Strategy',
                      body: isAr ? 'يحدد الوعد والعدد والمنصات.' : 'Defines promise, count, and platforms.',
                    },
                    {
                      step: '02',
                      title: isAr ? 'Studio' : 'Studio',
                      body: isAr ? 'ينتج الأصول والنسخ الإبداعية.' : 'Produces assets and creative variants.',
                    },
                    {
                      step: '03',
                      title: isAr ? 'Content Hub' : 'Content Hub',
                      body: isAr ? 'يثبت البوست النهائي قبل الجدولة والنشر.' : 'Locks final post truth before scheduling and publishing.',
                    },
                  ].map(item => (
                    <div key={item.step} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-black text-[#5E63FF]" dir="ltr">{item.step}</p>
                      <p className="mt-1 text-sm font-black text-[#0B1028]">{item.title}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="border-t border-slate-200 bg-[linear-gradient(180deg,#FFFFFF,#F8FAFF)] p-5 xl:border-l xl:border-t-0" dir={isAr ? 'rtl' : 'ltr'}>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#5E63FF]">{productionDecision.eyebrow}</p>
                <h3 className="mt-2 text-xl font-black leading-8 text-[#0B1028]">{productionDecision.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{productionDecision.body}</p>
                <button
                  type="button"
                  onClick={productionDecision.onClick}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#070D2D] px-5 text-sm font-black text-white shadow-[0_18px_36px_rgba(7,13,45,0.18)]"
                >
                  {productionDecision.label}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/studio')}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#5E63FF]"
                >
                  {isAr ? 'افتح الاستوديو للأصول فقط' : 'Open Studio for assets only'}
                </button>
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-6 text-amber-900">
                  {isAr
                    ? 'مهم: ظهور صورة أو أصل هنا لا يعني أنه منشور أو مستخدم في إعلان. الربط والنشر والتعلم لهم تأكيدات منفصلة.'
                    : 'Important: an image or asset shown here does not mean it is published or used in ads. Attachment, publishing, and learning each require separate confirmation.'}
                </p>
              </aside>
            </div>
          </section>
        )}

        <section className="hidden">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {isAr ? 'قراءة تشغيلية' : 'Operating read'}
              </p>
              <h2 className="text-lg font-bold text-slate-950">{contentHubTruthTitle}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-right">
              {contentHubTruthSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {contentHubTruthCards.map((card, index) => (
              <article
                key={`${card.label}-${index}`}
                className={`min-h-[142px] rounded-2xl border p-4 shadow-sm ${contentHubTruthToneClass[card.tone]}`}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{card.label}</p>
                <p className="mt-2 text-lg font-bold leading-7">{card.value}</p>
                <p className="mt-2 text-xs leading-5 opacity-75">{card.helper}</p>
              </article>
            ))}
          </div>
        </section>

        {posts.length > 0 && (
          <div className="hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-violet-900">{finalPreviewTitle}</p>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-violet-900/80">{finalPreviewBody}</p>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-violet-800/70">{finalPreviewHelper}</p>
              </div>
              <div className="shrink-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-900">
                {mediaReadinessInlineLabel}
              </div>
            </div>
          </div>
        )}

        {contentPlanOrderMismatch && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold">{orderMismatchTitle}</p>
                <p className="mt-1 text-sm leading-relaxed">{orderMismatchBody}</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">{orderMismatchAction}</p>
              </div>
              <div className="shrink-0 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900">
                {isAr
                  ? `المطلوب: ${orderMismatchExpectedLabel} · الحالي: ${contentPlanOrderMismatch.actualDirections}`
                  : `Expected: ${orderMismatchExpectedLabel} · Current: ${contentPlanOrderMismatch.actualDirections}`}
              </div>
            </div>
          </div>
        )}

        {contentReviewRequired && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <p className="text-sm font-semibold">
              {isAr ? 'مراجعة تطابق المحتوى مطلوبة' : 'Content alignment review required'}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {isAr
                ? `وجد NEXUS ${contentApprovalPreflight.issues.length} ملاحظة في المحتوى الحالي، تشمل صياغات عامة ضعيفة أو ادعاءات غير مثبتة أو انجرافاً عن Brand Brain والاستراتيجية. الاعتماد والجدولة الآلية مقفلان حتى التعديل أو إعادة التوليد.`
                : `NEXUS found ${contentApprovalPreflight.issues.length} issue${contentApprovalPreflight.issues.length === 1 ? '' : 's'} in the current content, including generic hook formulas, unsupported claims, or drift from Brand Brain and the strategy. Approval and automatic scheduling stay locked until the content is edited or regenerated.`}
            </p>
          </div>
        )}

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
              <span className="text-slate-500">{mediaReadinessInlineLabel}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #111827, #5E5CE6)' }}
              />
            </div>
            {ambiguousPreviewCount > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {ambiguousPreviewExplainer}
              </p>
            )}
          </div>
        )}

        {/* ── Filter bar (sticky) ──────────────────────────────────── */}
        {posts.length > 0 && (
          <div className="sticky top-0 z-10 mb-5 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6"
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
                    <span>{p === 'ALL' ? `${t('contentHub.allPlatforms')} (${count})` : `${cfg?.label ?? p} (${count})`}</span>
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
                      {formatStatusSummaryChip(c.n, c.label)}
                    </span>
                  ))}
                </div>
              ) : null
            })()}
            {/* Status filter */}
            <div className="flex flex-wrap gap-1.5 items-center">
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
          <div className="py-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    {isAr ? 'مرحلة ما قبل المحتوى' : 'Pre-content planning stage'}
                  </div>
                  <h2 className="text-xl font-bold text-slate-950">{preContentTitle}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{preContentBody}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    type="button"
                    onClick={() => router.push(`/campaigns/${campaignId}?tab=strategy`)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:text-violet-700"
                  >
                    {preContentStrategyCta}
                  </button>
                  <button
                    type="button"
                    onClick={strategyApprovalRequired ? () => router.push(`/campaigns/${campaignId}?tab=strategy`) : contentPlanLocked ? () => router.push('/billing') : openGeneratePlanConfirm}
                    disabled={generatingPlan}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                    style={{
                      background: contentPlanLocked ? '#B91C1C' : '#111827',
                    }}
                  >
                    {strategyApprovalRequired ? strategyApprovalRequiredLabel : contentPlanLocked ? addCreditsForDraftPlanLabel : preContentGenerateCta}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {preContentChecks.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {isAr ? 'حارس الرصيد والتشغيل' : 'Credit and execution guard'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                  {contentPlanRequirementDisclosure} {contentPlanDisclosure} {contentPlanAutopilotDisclosure} {creditBalanceLabel}.
                </p>
              </div>
            </div>
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
              campaignId={campaignId}
              pendingEdit={getPendingEdit(post.id)}
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
              onGenerateImage={() => openImageGenerationConfirm(post.id)}
              onAddCredits={() => router.push('/billing')}
              onToggleExpand={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
              onEditCaption={() => setEditingCaption(editingCaption === post.id ? null : post.id)}
              onEditPrompt={() => setEditingPrompt(editingPrompt === post.id ? null : post.id)}
              onOpenMediaPicker={() => setMediaPickerOpen(mediaPickerOpen === post.id ? null : post.id)}
              onCloseMediaPicker={() => setMediaPickerOpen(null)}
              onSaveEdit={(updates) => savePostEdit(post.id, updates)}
              onRemoveMedia={() => requestMediaRemoval(post.id)}
              onPendingEdit={(updates) => setPendingEdits(prev => ({
                ...prev,
                [post.id]: { ...(prev[post.id] ?? {}), ...updates }
              }))}
              onRewrite={(instruction) => requestRewrite(post.id, instruction)}
              onPickWinner={post.variantGroup ? () => pickVariant(post.id) : undefined}
              onManualPublish={contentIssueCountByPostId.has(post.id) ? undefined : () => openManualPublishModal(post)}
              qualityIssueCount={contentIssueCountByPostId.get(post.id) ?? 0}
              onPlatformPublished={() => loadData().then(() => undefined)}
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
            <div id="content-posts-board" className="scroll-mt-24 space-y-4">
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
                      <span className="text-xs text-slate-500">· Compare both variants and select a preferred draft</span>
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
              {pendingImageCount > 0 && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  {isAr
                    ? `هذا اعتماد للنصوص فقط. ما زالت ${pendingImageCount} مسودات تحتاج قرار وسائط، ولن تصبح جاهزة للجدولة أو النشر حتى تكتمل مراجعة الوسائط.`
                    : `This approves copy only. ${pendingImageCount} draft${pendingImageCount === 1 ? '' : 's'} still need a media decision and will not be ready for scheduling or publishing until media review is complete.`}
                </div>
              )}
              {contentPlanOrderMismatch && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  {orderMismatchBody}
                </div>
              )}
              {approvalBlockedByTruthReview && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-900">
                  {isAr
                    ? 'لا يمكن اعتماد هذه المسودات قبل معالجة ملاحظات تطابق المحتوى الظاهرة في الصفحة.'
                    : 'These drafts cannot be approved until the content-alignment findings shown on the page are resolved.'}
                </div>
              )}
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
                  disabled={approvalBlocked}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    background: approvalBlocked
                      ? '#94A3B8'
                      : 'linear-gradient(135deg, #059669, #047857)',
                    opacity: approvalBlocked ? 0.7 : 1,
                  }}
                >
                  ✓ {t('contentHub.approveConfirmYes')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Schedule approved posts confirm dialog ─────────────────── */}
        {showScheduleConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }}
            onClick={() => {
              if (!scheduling) {
                setShowScheduleConfirm(false)
                setScheduleAcknowledged(false)
              }
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              style={{ border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#5E63FF]">
                    {isAr ? 'قرار جدولة منفصل' : 'Separate scheduling decision'}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">
                    {isAr ? `جدولة ${approvedPostsWithDates.length} منشور معتمد` : `Schedule ${approvedPostsWithDates.length} approved posts`}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {scheduleMode === 'AUTO'
                      ? (isAr
                          ? 'سيحفظ NEXUS التواريخ والوجهات، ثم يرسل كل منشور معتمد إلى المنصة في موعده. لا يعتبر المنشور منشورًا إلا بعد تأكيد المنصة.'
                          : 'NEXUS will save dates and exact destinations, then send each approved post at its scheduled time. A post is not marked published until the platform confirms it.')
                      : (isAr
                          ? 'سيحفظ NEXUS الجدول للتنفيذ اليدوي فقط. لن يرسل أي محتوى إلى المنصات.'
                          : 'NEXUS will save an execution schedule only. No content will be sent to a platform.')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={scheduling}
                  onClick={() => {
                    setShowScheduleConfirm(false)
                    setScheduleAcknowledged(false)
                  }}
                  className="text-xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-40"
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                >
                  ×
                </button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                <button
                  type="button"
                  onClick={() => { setScheduleMode('MANUAL'); setScheduleAcknowledged(false) }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${scheduleMode === 'MANUAL' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                >{isAr ? 'جدولة للتنفيذ اليدوي' : 'Manual execution'}</button>
                <button
                  type="button"
                  onClick={() => { setScheduleMode('AUTO'); setScheduleAcknowledged(false) }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${scheduleMode === 'AUTO' ? 'bg-[#4F46E5] text-white shadow-sm' : 'text-slate-500'}`}
                >{isAr ? 'نشر تلقائي في الموعد' : 'Auto-publish on time'}</button>
              </div>

              {scheduleMode === 'AUTO' && (
                <div className="mb-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div>
                    <p className="text-xs font-black text-slate-900">{isAr ? 'وجهات النشر الدقيقة' : 'Exact publishing destinations'}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{isAr ? 'كل منصة تحتاج حسابًا وصلاحية ووجهة مؤكدة. لن يخمّن NEXUS الصفحة.' : 'Every channel needs an authorized account and exact destination. NEXUS will not guess a Page.'}</p>
                  </div>

                  {scheduleAccountsLoading && <p className="text-xs font-semibold text-indigo-700">{isAr ? 'جارٍ التحقق من الصلاحيات…' : 'Checking permissions…'}</p>}

                  {unsupportedAutoTargets.length > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                      {isAr ? `النشر التلقائي غير متاح حاليًا لهذه الوجهات: ${unsupportedAutoTargets.join('، ')}. غيّرها أو استخدم التنفيذ اليدوي.` : `Auto-publishing is not enabled for: ${unsupportedAutoTargets.join(', ')}. Change them or use manual execution.`}
                    </p>
                  )}

                  {approvedAutoTargets.filter(target => ['FACEBOOK', 'INSTAGRAM'].includes(target)).map(target => {
                    const account = scheduleAccounts.find(item => item.platform === 'META')
                    const pages = (account?.pages || []).filter(page => target === 'INSTAGRAM' ? Boolean(page.igAccountId) : Boolean(page.id))
                    const selected = destinationByTarget[target]?.pageId || ''
                    return (
                      <label key={target} className="block text-[11px] font-bold text-slate-700">
                        {target}
                        <select
                          value={selected}
                          onChange={event => {
                            const page = pages.find(item => item.id === event.target.value || item.igAccountId === event.target.value)
                            if (!account || !page) return
                            setDestinationByTarget(current => ({ ...current, [target]: { integrationId: account.id, pageId: target === 'INSTAGRAM' ? page.igAccountId || '' : page.id, pageName: page.name } }))
                          }}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">{isAr ? 'اختر الوجهة' : 'Select destination'}</option>
                          {pages.map(page => <option key={`${target}-${page.id}`} value={target === 'INSTAGRAM' ? page.igAccountId || '' : page.id}>{page.name}</option>)}
                        </select>
                      </label>
                    )
                  })}

                  {approvedAutoTargets.includes('LINKEDIN') && (() => {
                    const account = scheduleAccounts.find(item => item.platform === 'LINKEDIN')
                    const organizations = account?.organizations || []
                    const selected = destinationByTarget.LINKEDIN?.pageId || 'MEMBER'
                    return (
                      <label className="block text-[11px] font-bold text-slate-700">
                        LinkedIn
                        <select
                          value={selected}
                          onChange={event => {
                            if (!account) return
                            const organization = organizations.find(item => item.id === event.target.value)
                            setDestinationByTarget(current => ({ ...current, LINKEDIN: { integrationId: account.id, pageId: organization?.id, pageName: organization?.name || account.accountName || undefined } }))
                          }}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="MEMBER">{isAr ? `الحساب الشخصي — ${account?.accountName || 'غير متصل'}` : `Member profile — ${account?.accountName || 'not connected'}`}</option>
                          {organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </label>
                    )
                  })()}

                  {approvedAutoTargets.includes('TIKTOK') && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                      <label className="block text-[11px] font-bold text-slate-700">
                        {isAr ? 'خصوصية TikTok' : 'TikTok privacy'}
                        <select value={tiktokOptions.privacyLevel} onChange={event => setTikTokOptions(current => ({ ...current, privacyLevel: event.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
                          <option value="">{isAr ? 'اختر الخصوصية' : 'Select privacy'}</option>
                          {(tiktokCreator?.privacyLevelOptions || []).map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                        {([
                          ['disableComment', isAr ? 'تعطيل التعليقات' : 'Disable comments'],
                          ['disableDuet', isAr ? 'تعطيل Duet' : 'Disable Duet'],
                          ['disableStitch', isAr ? 'تعطيل Stitch' : 'Disable Stitch'],
                          ['isAigc', isAr ? 'محتوى مولّد بالذكاء' : 'AI-generated label'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={tiktokOptions[key]} disabled={Boolean(tiktokCreator?.[key === 'disableComment' ? 'commentDisabled' : key === 'disableDuet' ? 'duetDisabled' : key === 'disableStitch' ? 'stitchDisabled' : 'commentDisabled'] && key !== 'isAigc')} onChange={event => setTikTokOptions(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>
                        ))}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
                        <p className="font-black text-slate-700">{isAr ? 'إفصاح المحتوى التجاري' : 'Commercial content disclosure'}</p>
                        <label className="mt-2 flex items-start gap-2">
                          <input type="checkbox" checked={tiktokOptions.brandOrganicToggle} onChange={event => setTikTokOptions(current => ({ ...current, brandOrganicToggle: event.target.checked }))} />
                          {isAr ? 'المحتوى يروّج لعلامتي أو نشاطي التجاري' : 'The content promotes my own brand or business'}
                        </label>
                        <label className="mt-2 flex items-start gap-2">
                          <input type="checkbox" checked={tiktokOptions.brandContentToggle} onChange={event => setTikTokOptions(current => ({ ...current, brandContentToggle: event.target.checked }))} />
                          {isAr ? 'تعاون مدفوع أو ترويج لطرف ثالث' : 'Paid partnership or third-party promotion'}
                        </label>
                      </div>
                    </div>
                  )}

                  {approvedAutoTargets.includes('X') && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] font-black text-slate-800">X</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">
                        {scheduleAccounts.find(account => account.platform === 'X')
                          ? (isAr
                              ? `الحساب: ${scheduleAccounts.find(account => account.platform === 'X')?.accountName || 'X'}`
                              : `Account: ${scheduleAccounts.find(account => account.platform === 'X')?.accountName || 'X'}`)
                          : (isAr ? 'لا يوجد حساب X متصل بصلاحيات النشر والقراءة.' : 'No X account is connected with publish and read permissions.')}
                      </p>
                      <p className="mt-2 rounded-md bg-slate-50 p-2 text-[10px] font-semibold leading-4 text-slate-700">
                        {isAr
                          ? 'النشر التلقائي الحالي يدعم النصوص والصور المعتمدة فقط بحد أقصى 280 حرفًا. فيديو X غير مدعوم ولن يتم إرساله.'
                          : 'Current auto-publishing supports approved text and image posts up to 280 characters. X video is not supported and will not be sent.'}
                      </p>
                    </div>
                  )}

                  {approvedAutoTargets.includes('YOUTUBE') && (
                    <div className="space-y-3 rounded-lg border border-red-100 bg-white p-3">
                      <div>
                        <p className="text-[11px] font-black text-slate-800">YouTube</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-500">
                          {scheduleAccounts.find(account => account.platform === 'YOUTUBE')
                            ? (isAr
                                ? `القناة: ${scheduleAccounts.find(account => account.platform === 'YOUTUBE')?.accountName || 'YouTube'}`
                                : `Channel: ${scheduleAccounts.find(account => account.platform === 'YOUTUBE')?.accountName || 'YouTube'}`)
                            : (isAr ? 'لا توجد قناة YouTube متصلة.' : 'No YouTube channel is connected.')}
                        </p>
                        <p className="mt-1 rounded-md bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">
                          {isAr
                            ? 'قد تفرض Google الرؤية على Private حتى اعتماد مشروع YouTube API، حتى لو اخترت Public.'
                            : 'Google may force Private visibility until the YouTube API project passes audit, even when Public is selected.'}
                        </p>
                      </div>
                      {approvedYouTubePosts.map((post, index) => {
                        const options = youtubeOptionsByPostId[post.id] || defaultYouTubeScheduleOptions(post)
                        const update = (patch: Partial<YouTubeScheduleOptions>) => {
                          setYouTubeOptionsByPostId(current => ({
                            ...current,
                            [post.id]: { ...(current[post.id] || defaultYouTubeScheduleOptions(post)), ...patch },
                          }))
                        }
                        return (
                          <fieldset key={post.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <legend className="px-1 text-[10px] font-black text-slate-700">
                              {isAr ? `فيديو ${index + 1}` : `Video ${index + 1}`}
                            </legend>
                            <label className="block text-[10px] font-bold text-slate-600">
                              {isAr ? 'عنوان الفيديو' : 'Video title'}
                              <input value={options.title} maxLength={100} onChange={event => update({ title: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs" />
                            </label>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <label className="block text-[10px] font-bold text-slate-600">
                                {isAr ? 'الخصوصية' : 'Privacy'}
                                <select value={options.privacyStatus} onChange={event => update({ privacyStatus: event.target.value as YouTubeScheduleOptions['privacyStatus'] })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
                                  <option value="private">{isAr ? 'خاص' : 'Private'}</option>
                                  <option value="unlisted">{isAr ? 'غير مدرج' : 'Unlisted'}</option>
                                  <option value="public">{isAr ? 'عام' : 'Public'}</option>
                                </select>
                              </label>
                              <label className="block text-[10px] font-bold text-slate-600">
                                {isAr ? 'موجّه للأطفال؟' : 'Made for kids?'}
                                <select value={options.madeForKids} onChange={event => update({ madeForKids: event.target.value as YouTubeScheduleOptions['madeForKids'] })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
                                  <option value="">{isAr ? 'اختر' : 'Choose'}</option>
                                  <option value="no">{isAr ? 'لا' : 'No'}</option>
                                  <option value="yes">{isAr ? 'نعم' : 'Yes'}</option>
                                </select>
                              </label>
                              <label className="block text-[10px] font-bold text-slate-600">
                                {isAr ? 'واقعي معدل/اصطناعي؟' : 'Altered/synthetic?'}
                                <select value={options.syntheticMedia} onChange={event => update({ syntheticMedia: event.target.value as YouTubeScheduleOptions['syntheticMedia'] })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
                                  <option value="">{isAr ? 'اختر' : 'Choose'}</option>
                                  <option value="no">{isAr ? 'لا' : 'No'}</option>
                                  <option value="yes">{isAr ? 'نعم' : 'Yes'}</option>
                                </select>
                              </label>
                            </div>
                            <label className="flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                              <input type="checkbox" checked={options.notifySubscribers} onChange={event => update({ notifySubscribers: event.target.checked })} className="mt-0.5" />
                              {isAr ? 'إشعار المشتركين إذا سمحت قواعد القناة والرؤية' : 'Notify subscribers when channel and visibility rules allow it'}
                            </label>
                          </fieldset>
                        )
                      })}
                    </div>
                  )}

                  {youtubeAutoReviewIncomplete && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                      {isAr ? 'راجع عنوان كل فيديو وتصنيف الأطفال وإفصاح المحتوى المعدل أو الاصطناعي.' : 'Review each video title, made-for-kids setting, and altered or synthetic media disclosure.'}
                    </p>
                  )}

                  {xAutoReviewIncomplete && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                      {isAr
                        ? 'واحد أو أكثر من منشورات X يحتوي فيديو أو نصًا فارغًا أو يتجاوز 280 حرفًا. عدّل المنشور أو استخدم التنفيذ اليدوي.'
                        : 'One or more X posts contains video, empty copy, or copy over 280 characters. Edit the post or use manual execution.'}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{isAr ? 'النطاق' : 'Range'}</p>
                  <p className="mt-1 font-bold text-slate-900" dir="ltr">
                    {approvedScheduleRange ? `${approvedScheduleRange.first} - ${approvedScheduleRange.last}` : (isAr ? 'لا توجد تواريخ صالحة' : 'No valid dates')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400">{isAr ? 'التكلفة' : 'Cost'}</p>
                  <p className="mt-1 font-bold text-slate-900">{isAr ? '0 كريديت' : '0 credits'}</p>
                </div>
              </div>

              {approvedPostsMissingDates > 0 && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  {isAr
                    ? `${approvedPostsMissingDates} منشور معتمد بلا تاريخ صالح سيبقى معتمدًا ولن تتم جدولته.`
                    : `${approvedPostsMissingDates} approved posts have no valid date and will remain approved.`}
                </p>
              )}

              {schedulingBlockedByMedia && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  {isAr
                    ? `${approvedPostsNeedingMediaCount} منشورات ما زالت بلا وسائط مؤكدة. أغلق هذه النافذة وأكمل قرار الوسائط لكل منشور قبل الجدولة.`
                    : `${approvedPostsNeedingMediaCount} post${approvedPostsNeedingMediaCount === 1 ? '' : 's'} still lack confirmed media. Close this dialog and complete each media decision before scheduling.`}
                </p>
              )}

              {schedulingBlockedByTruthReview && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
                  {isAr
                    ? 'يحتوي المحتوى المعتمد على صياغات عامة أو ملاحظات جودة. أعده للمراجعة أو أعد توليده قبل الجدولة.'
                    : 'Approved content contains generic wording or other quality findings. Reopen or regenerate it before scheduling.'}
                </p>
              )}

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={scheduleAcknowledged}
                  disabled={scheduling || approvedPostsWithDates.length === 0 || schedulingDecisionBlocked}
                  onChange={event => setScheduleAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#5E63FF]"
                />
                <span>
                  {isAr
                    ? (scheduleMode === 'AUTO'
                        ? 'راجعت المحتوى والتواريخ والوجهات، وأوافق صراحةً أن يرسل NEXUS المنشورات المعتمدة إلى المنصات في مواعيدها.'
                        : 'راجعت عدد المنشورات والتواريخ، وأفهم أن هذه جدولة للتنفيذ اليدوي ولا تعني النشر.')
                    : (scheduleMode === 'AUTO'
                        ? 'I reviewed the content, dates, and destinations, and explicitly authorize NEXUS to send these approved posts at their scheduled times.'
                        : 'I reviewed the post count and dates, and understand this is a manual execution schedule, not publishing.')}
                </span>
              </label>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={scheduling}
                  onClick={() => {
                    setShowScheduleConfirm(false)
                    setScheduleAcknowledged(false)
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {t('contentHub.cancel')}
                </button>
                <button
                  type="button"
                  onClick={scheduleAll}
                  disabled={scheduling || !scheduleAcknowledged || approvedPostsWithDates.length === 0 || schedulingDecisionBlocked}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {scheduling
                    ? t('contentHub.scheduling')
                    : (isAr ? `تأكيد جدولة ${approvedPostsWithDates.length} منشور` : `Confirm scheduling ${approvedPostsWithDates.length} posts`)}
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
                    <div className="text-xs text-slate-500 mt-0.5">{isAr ? 'منشورات' : 'Posts'}</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-emerald-600">{approveResult.linked}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{isAr ? 'مرتبطة' : 'Linked'}</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-[#5E5CE6]">{approveResult.platforms.length}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{isAr ? 'منصات' : 'Platforms'}</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-cyan-600">{approveResult.pendingImages}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{isAr ? 'وسائط ناقصة' : 'Media left'}</div>
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
                        const resultStatus = approveResult.kind === 'scheduled' ? 'SCHEDULED' : 'APPROVED'
                        const count = posts.filter(post => post.platform.toUpperCase() === p && post.status === resultStatus).length
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
                        {isAr
                          ? (approveResult.kind === 'scheduled' ? 'نافذة المحتوى المجدول' : 'نافذة المحتوى المخطط')
                          : approveResult.kind === 'scheduled' ? 'Publishing window' : 'Planned content window'}
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

                {/* Approval signal summary */}
                {(approveResult.signals.hooks > 0 || approveResult.signals.angles > 0) && (
                  <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                    style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                    <span className="text-xl mt-0.5">🧠</span>
                    <div>
                      <p className="text-sm font-semibold text-[#5E5CE6] mb-0.5">
                        {isAr ? 'تم حفظ إشارات الاعتماد' : 'Approval signals saved'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {isAr ? 'قد يقترح NEXUS تحديثات لعقل العلامة من المحتوى الذي راجعته: ' : 'NEXUS may suggest Brand Brain updates from reviewed content: '}
                        {approveResult.signals.hooks > 0 && (
                          <span className="text-[#5E5CE6] font-medium">
                            {approveResult.signals.hooks} {isAr ? 'إشارات خطاف' : 'hook signals'}
                          </span>
                        )}
                        {approveResult.signals.hooks > 0 && approveResult.signals.angles > 0 && ' + '}
                        {approveResult.signals.angles > 0 && (
                          <span className="text-[#5E5CE6] font-medium">
                            {approveResult.signals.angles} {isAr ? 'إشارات زاوية محتوى' : 'content-angle signals'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Next best action */}
                <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                  style={{
                    background: approveResult.pendingImages > 0
                      ? '#F5F3FF'
                      : approveResult.kind === 'approved'
                      ? '#F8FAFC'
                      : approveResult.unlinked > 0
                      ? '#FFFBEB'
                      : '#ECFDF5',
                    border: approveResult.pendingImages > 0
                      ? '1px solid rgba(94,92,230,0.18)'
                      : approveResult.kind === 'approved'
                      ? '1px solid rgba(15,23,42,0.10)'
                      : approveResult.unlinked > 0
                      ? '1px solid rgba(245,158,11,0.2)'
                      : '1px solid rgba(5,150,105,0.22)',
                  }}>
                  <span className="text-lg mt-0.5">
                    {approveResult.pendingImages > 0 ? '⚠️' : approveResult.kind === 'approved' ? '📝' : approveResult.unlinked > 0 ? '🔌' : '📅'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold mb-0.5"
                      style={{ color: approveResult.pendingImages > 0 ? '#5E5CE6' : approveResult.kind === 'approved' ? '#334155' : approveResult.unlinked > 0 ? '#B45309' : '#047857' }}>
                      {approveResult.pendingImages > 0
                        ? (isAr ? 'مطلوب: أكمل وسائط المنشورات قبل الجدولة' : 'Required: complete post media before scheduling')
                        : approveResult.kind === 'approved'
                        ? (isAr ? 'التالي: راجع الخطة قبل الجدولة' : 'Next: review the plan before scheduling')
                        : approveResult.unlinked > 0
                        ? (isAr ? 'قبل النشر: اربط منصات النشر' : 'Before publishing: connect platforms')
                        : (isAr ? 'التالي: راجع المحتوى المجدول' : 'Next: review scheduled content')}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {approveResult.pendingImages > 0
                        ? (isAr
                          ? `${approveResult.pendingImages} من ${approveResult.totalImages} خانات صور ما زالت تحتاج وسائط مؤكدة. لن يسمح NEXUS بجدولتها أو نشرها قبل اكتمال مراجعة الوسائط.`
                          : `${approveResult.pendingImages} of ${approveResult.totalImages} image slots still need confirmed media. NEXUS will not allow scheduling or publishing until media review is complete.`)
                        : approveResult.kind === 'approved'
                        ? (isAr
                          ? 'تم اعتماد المسودات فقط. ما زالت المنشورات تحتاج جدولة قبل النشر، والنشر التلقائي يحتاج تفعيلًا صريحًا منفصلًا.'
                          : 'Drafts are approved only. Approved posts still need scheduling before publishing, and automatic publishing requires a separate explicit opt-in.')
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
                        {isAr
                          ? `${approveResult.unlinked} منشورات بلا حساب نشر متصل حتى الآن. اربط الحسابات من `
                          : `${approveResult.unlinked} post${approveResult.unlinked !== 1 ? 's have' : ' has'} no connected platform yet. Connect your social accounts in `}
                        <button
                          onClick={() => { setApproveResult(null); router.push('/connections') }}
                          className="underline hover:no-underline"
                        >{isAr ? 'الاتصالات' : 'Connections'}</button>{' '}
                        {isAr ? 'قبل أي نشر.' : 'before publishing.'}
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
                        if (imageGenerationLocked) {
                          router.push('/billing')
                          return
                        }
                        openBulkImageConfirm()
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: imageGenerationLocked ? '#B45309' : '#111827' }}
                    >
                      ✨ {imageGenerationLocked
                        ? (isAr ? 'أضف رصيداً لتوليد الوسائط' : 'Add credits to generate media')
                        : (isAr ? `توليد ${approveResult.pendingImages} صور` : `Generate ${approveResult.pendingImages} images`)}
                    </button>
                  ) : approveResult.unlinked > 0 ? (
                    <button
                      onClick={() => { setApproveResult(null); router.push('/connections') }}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                      style={{ background: '#B45309' }}
                    >
                      🔌 {isAr ? 'ربط المنصات' : 'Connect platforms'}
                    </button>
                  ) : null}
                  <button
                    onClick={() => { setApproveResult(null); router.push(approveResult.kind === 'approved' ? `/campaigns/${campaignId}/content-hub` : '/schedule') }}
                    className={`${approveResult.pendingImages > 0 || approveResult.unlinked > 0 ? 'flex-1' : 'w-full'} px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border`}
                    style={{ borderColor: 'rgba(5,150,105,0.24)', color: '#047857', background: '#FFFFFF' }}
                  >
                    {approveResult.pendingImages > 0 ? '🖼️' : '📅'} {approveResult.pendingImages > 0
                      ? (isAr ? 'العودة لمراجعة الوسائط' : 'Return to media review')
                      : approveResult.kind === 'approved'
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
                        onClick={() => mediaPickerOpen && requestMediaAttachment(mediaPickerOpen, m)}
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

        {pendingMediaAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeMediaAttachmentConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      {pendingMediaAttachment.action === 'replace'
                        ? (isAr ? 'استبدال وسائط المنشور؟' : 'Replace post media?')
                        : (isAr ? 'إرفاق وسائط موجودة بهذا المنشور؟' : 'Attach existing media to this post?')}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {pendingAttachmentPost
                        ? (isAr ? `المنشور #${pendingAttachmentPost.contentPlanIndex}` : `Post #${pendingAttachmentPost.contentPlanIndex}`)
                        : pendingMediaAttachment.media.fileName}
                    </p>
                  </div>
                  <button onClick={closeMediaAttachmentConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <img src={pendingMediaAttachment.media.url} alt={pendingMediaAttachment.media.fileName} className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{pendingMediaAttachment.media.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {pendingMediaAttachment.action === 'replace'
                        ? (isAr ? 'سيتم استبدال الوسائط الحالية في المعاينة فقط.' : 'The current preview media will be replaced only in Content Hub.')
                        : (isAr ? 'سيتم إرفاق هذا الأصل بمعاينة المنشور.' : 'This asset will be attached to this post preview.')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>
                    {pendingAttachmentReopensReview
                      ? (isAr
                          ? 'سيؤدي تغيير الوسائط إلى إعادة المنشور لمسودة وإلغاء اعتماده وقرار تنفيذه حتى يراجع مرة أخرى.'
                          : 'Changing media reopens this post as a draft and clears approval and execution assignment until it is reviewed again.')
                      : (isAr
                          ? 'سيؤدي ذلك إلى تحديث وسائط معاينة المنشور داخل مركز المحتوى دون نشره أو جدولته.'
                          : 'This updates the post preview media in Content Hub without publishing or scheduling it.')}
                  </p>
                  {pendingMediaAttachment.action === 'replace' && (
                    <p>
                      {isAr
                        ? 'الأصل السابق لا يُحذف من مكتبة الوسائط.'
                        : 'The previous asset is not deleted from Media Library.'}
                    </p>
                  )}
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={mediaAttachmentAcknowledged}
                    onChange={e => setMediaAttachmentAcknowledged(e.target.checked)}
                  />
                  <span className="text-xs leading-5 text-slate-600">
                    {pendingAttachmentReopensReview
                      ? (isAr
                          ? 'أفهم أن تغيير الوسائط يعيد المنشور للمراجعة ويلغي قرار التنفيذ السابق.'
                          : 'I understand that changing media reopens the post for review and clears its previous execution decision.')
                      : (isAr
                          ? 'أفهم أن هذا يغيّر وسائط معاينة المنشور فقط داخل Content Hub.'
                          : 'I understand this changes only the post preview media inside Content Hub.')}
                  </span>
                </label>

                <div className="mt-5 flex gap-3">
                  <button onClick={closeMediaAttachmentConfirm} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmMediaAttachment}
                    disabled={!mediaAttachmentAcknowledged}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: '#111827' }}
                  >
                    {pendingMediaAttachment.action === 'replace'
                      ? (isAr ? 'استبدال الوسائط' : 'Replace media')
                      : (isAr ? 'إرفاق الوسائط بالمنشور' : 'Attach media to post')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mediaRemovalPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeMediaRemovalConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      {isAr ? 'إزالة الوسائط من معاينة هذا المنشور؟' : 'Remove media from this post preview?'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {isAr ? `المنشور #${mediaRemovalPost.contentPlanIndex}` : `Post #${mediaRemovalPost.contentPlanIndex}`}
                    </p>
                  </div>
                  <button onClick={closeMediaRemovalConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
                </div>

                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>
                    {mediaRemovalReopensReview
                      ? (isAr
                          ? 'ستعيد إزالة الوسائط المنشور لمسودة وتلغي اعتماده وقرار تنفيذه. الأصل نفسه لن يُحذف من مكتبة الوسائط.'
                          : 'Removing media reopens the post as a draft and clears approval and execution assignment. The asset itself stays in Media Library.')
                      : (isAr
                          ? 'سيؤدي ذلك إلى إزالة الوسائط المرتبطة بالمنشور في مركز المحتوى دون حذف الأصل من مكتبة الوسائط.'
                          : 'This clears the post-linked media in Content Hub without deleting the asset from Media Library.')}
                  </p>
                  <p>
                    {isAr
                      ? 'يمكنك إرفاق أصل آخر أو توليد صورة لاحقًا من نفس المنشور.'
                      : 'You can attach another asset or generate an image later from the same post.'}
                  </p>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={mediaRemovalAcknowledged}
                    onChange={e => setMediaRemovalAcknowledged(e.target.checked)}
                  />
                  <span className="text-xs leading-5 text-slate-600">
                    {mediaRemovalReopensReview
                      ? (isAr
                          ? 'أفهم أن إزالة الوسائط تعيد المنشور للمراجعة وتلغي قرار التنفيذ السابق.'
                          : 'I understand that removing media reopens the post for review and clears its previous execution decision.')
                      : (isAr
                          ? 'أفهم أن هذا يزيل الوسائط من معاينة المنشور فقط.'
                          : 'I understand this removes media only from this post preview.')}
                  </span>
                </label>

                <div className="mt-5 flex gap-3">
                  <button onClick={closeMediaRemovalConfirm} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmMediaRemoval}
                    disabled={!mediaRemovalAcknowledged}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: '#C2410C' }}
                  >
                    {isAr ? 'إزالة الوسائط من المنشور' : 'Remove media from post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Credit action confirmations ───────────────────────────── */}
        {imageGenerationConfirmPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeImageGenerationConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      {isAr ? 'تأكيد توليد صورة المنشور' : 'Confirm post image generation'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {isAr
                        ? `سيولّد NEXUS صورة واحدة للمنشور #${imageGenerationConfirmPost.contentPlanIndex} للمراجعة. التكلفة: ${CONTENT_HUB_IMAGE_COST} كريديت.`
                        : `NEXUS will generate one image for post #${imageGenerationConfirmPost.contentPlanIndex} for review. Cost: ${CONTENT_HUB_IMAGE_COST} credits.`}
                    </p>
                  </div>
                  <button onClick={closeImageGenerationConfirm} disabled={Boolean(generatingImageId)} className="text-xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-40">×</button>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>{isAr ? 'الصورة المولّدة ستحدّث وسائط معاينة هذا المنشور إذا نجح التوليد.' : 'The generated image will update this post preview media if generation succeeds.'}</p>
                  <p>{imageGenerationReopensReview
                    ? (isAr
                        ? 'عند ربط الصورة الجديدة سيعود المنشور لمسودة ويلغى اعتماده وقرار تنفيذه حتى تراجعه من جديد.'
                        : 'Attaching the new image reopens this post as a draft and clears approval and execution assignment until it is reviewed again.')
                    : (isAr
                        ? 'لا يتم النشر أو إنشاء جدولة من توليد الصورة.'
                        : 'Image generation does not publish or create a schedule.')}</p>
                  <p>{isAr ? 'لا يتم تحديث إشارات Brand Brain من توليد الصورة.' : 'This does not update Brand Brain signals.'}</p>
                  <p>{isAr ? 'يتم رد تكلفة عمليات التوليد الفاشلة عندما تدعمها آلية المنتج الحالية.' : 'Failed generations are refunded when the existing product refund logic supports it.'}</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={imageGenerationAcknowledged}
                    onChange={e => setImageGenerationAcknowledged(e.target.checked)}
                    disabled={Boolean(generatingImageId)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isAr
                      ? `أفهم أن هذا يكلف ${CONTENT_HUB_IMAGE_COST} كريديت وسيولّد وسائط المنشور للمراجعة.`
                      : `I understand this costs ${CONTENT_HUB_IMAGE_COST} credits and will generate post media for review.`}
                  </span>
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeImageGenerationConfirm} disabled={Boolean(generatingImageId)} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button
                    onClick={confirmPostImageGeneration}
                    disabled={Boolean(generatingImageId) || !imageGenerationAcknowledged}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
                    style={{ background: '#111827', opacity: Boolean(generatingImageId) || !imageGenerationAcknowledged ? 0.45 : 1 }}
                  >
                    {generatingImageId
                      ? (isAr ? 'جارٍ التوليد...' : 'Generating...')
                      : (isAr ? `تأكيد توليد الصورة — ${CONTENT_HUB_IMAGE_COST} كريديت` : `Confirm image generation — ${CONTENT_HUB_IMAGE_COST} credits`)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGeneratePlanConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeGeneratePlanConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">{generatePlanConfirmTitle}</h3>
                    <p className="mt-1 text-sm text-slate-500">{generatePlanConfirmBody}</p>
                  </div>
                  <button onClick={closeGeneratePlanConfirm} disabled={generatingPlan} className="text-xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-40">×</button>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>{generatePlanConfirmSafety}</p>
                  <p>{isAr ? 'يمكنك مراجعة المسودات وتحريرها قبل أي خطوة اعتماد أو جدولة.' : 'You can review and edit the drafts before any approval or scheduling step.'}</p>
                  <p>{creditBalanceLabel}</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={generatePlanAcknowledged}
                    onChange={e => setGeneratePlanAcknowledged(e.target.checked)}
                    disabled={generatingPlan}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span className="text-xs font-semibold text-slate-800">{generatePlanAcknowledgeLabel}</span>
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeGeneratePlanConfirm} disabled={generatingPlan} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button
                    onClick={confirmGeneratePlan}
                    disabled={generatingPlan || !generatePlanAcknowledged}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
                    style={{ background: '#111827', opacity: generatingPlan || !generatePlanAcknowledged ? 0.45 : 1 }}
                  >
                    {generatingPlan ? t('contentHub.buildingPlanShort') : generatePlanFinalCta}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBulkImageConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeBulkImageConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      {isAr ? `تأكيد توليد ${pendingImageCount} صور منشورات` : `Confirm ${pendingImageCount} post images`}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {isAr
                        ? `التكلفة الإجمالية: ${bulkImageCreditCost} كريديت.`
                        : `Total cost: ${bulkImageCreditCost} credits.`}
                    </p>
                  </div>
                  <button onClick={closeBulkImageConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>{isAr ? 'سيولّد NEXUS وسائط مرتبطة بالمنشورات الحالية للمراجعة داخل Content Hub.' : 'NEXUS will generate post-linked media for the current posts for review inside Content Hub.'}</p>
                  <p>{isAr ? 'لا يتم النشر أو الجدولة أو تغيير حالة النشر اليدوي أو النشر عبر API.' : 'This does not publish, schedule, or change manual/API publish state.'}</p>
                  <p>{isAr ? 'المنشورات المجدولة والمنشورات المؤكدة يدويًا تبقى محفوظة.' : 'Scheduled and manually published posts remain saved.'}</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={bulkImageAcknowledged}
                    onChange={e => setBulkImageAcknowledged(e.target.checked)}
                    disabled={generating}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isAr
                      ? `أفهم أن هذا سيكلف ${bulkImageCreditCost} كريديت وسيولّد وسائط المنشورات للمراجعة.`
                      : `I understand this costs ${bulkImageCreditCost} credits and will generate post media for review.`}
                  </span>
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeBulkImageConfirm} disabled={generating} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button
                    onClick={confirmBulkImageGeneration}
                    disabled={generating || !bulkImageAcknowledged}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
                    style={{ background: '#111827', opacity: generating || !bulkImageAcknowledged ? 0.45 : 1 }}
                  >
                    {isAr ? `تأكيد توليد الصور — ${bulkImageCreditCost} كريديت` : `Confirm image generation — ${bulkImageCreditCost} credits`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showRegenerateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeRegenerateConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">{isAr ? 'تأكيد إعادة توليد خطة محتوى مسودة' : 'Confirm draft content plan regeneration'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{isAr ? `التكلفة: ${CONTENT_HUB_REGENERATION_COST} كريديت.` : `Cost: ${CONTENT_HUB_REGENERATION_COST} credits.`}</p>
                  </div>
                  <button onClick={closeRegenerateConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>{contentPlanDisclosure} {contentPlanAutopilotDisclosure}</p>
                  <p>{isAr ? 'لا يغيّر هذا المنشورات المجدولة أو المنشور المؤكد يدويًا، ولا ينشر أو يفعّل الأوتوبايلوت.' : 'This does not change scheduled posts or the manually published post, and it does not publish or activate Autopilot.'}</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={regenerateAcknowledged}
                    onChange={e => setRegenerateAcknowledged(e.target.checked)}
                    disabled={generatingPlan}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isAr
                      ? `أفهم أن هذا سيكلف ${CONTENT_HUB_REGENERATION_COST} كريديت وينشئ خطة مسودة جديدة للمراجعة فقط.`
                      : `I understand this costs ${CONTENT_HUB_REGENERATION_COST} credits and creates a new draft plan for review only.`}
                  </span>
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeRegenerateConfirm} disabled={generatingPlan} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button
                    onClick={confirmRegeneratePlan}
                    disabled={generatingPlan || !regenerateAcknowledged}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
                    style={{ background: '#111827', opacity: generatingPlan || !regenerateAcknowledged ? 0.45 : 1 }}
                  >
                    {isAr ? `تأكيد إعادة التوليد — ${CONTENT_HUB_REGENERATION_COST} كريديت` : `Confirm regeneration — ${CONTENT_HUB_REGENERATION_COST} credits`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rewriteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeRewriteConfirm}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">{isAr ? 'تأكيد إعادة صياغة المنشور' : 'Confirm post rewrite'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{isAr ? `التكلفة: ${rewriteCostLabel}.` : `Cost: ${rewriteCostLabel}.`}</p>
                  </div>
                  <button onClick={closeRewriteConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p>{isAr ? 'يعيد NEXUS صياغة نص هذا المنشور فقط للمراجعة.' : 'NEXUS rewrites this post copy only, for review.'}</p>
                  <p>{isAr ? 'لا يتم النشر أو الجدولة أو تغيير الوسائط أو تحديث Brand Brain كتعلّم.' : 'This does not publish, schedule, change media, or update Brand Brain as learning.'}</p>
                  {rewriteConfirm.instruction && (
                    <p className="rounded-lg bg-white p-2 text-slate-500">{rewriteConfirm.instruction}</p>
                  )}
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={rewriteAcknowledged}
                    onChange={e => setRewriteAcknowledged(e.target.checked)}
                    disabled={Boolean(rewritingPost)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {isAr
                      ? `أفهم أن هذا سيكلف ${rewriteCostLabel} ويعيد صياغة نص المنشور للمراجعة.`
                      : `I understand this costs ${rewriteCostLabel} and rewrites this post copy for review.`}
                  </span>
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={closeRewriteConfirm} disabled={Boolean(rewritingPost)} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button
                    onClick={confirmRewrite}
                    disabled={Boolean(rewritingPost) || !rewriteAcknowledged}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
                    style={{ background: '#111827', opacity: Boolean(rewritingPost) || !rewriteAcknowledged ? 0.45 : 1 }}
                  >
                    {rewritingPost
                      ? t('contentHub.rewriting')
                      : (isAr ? `تأكيد إعادة الصياغة — ${rewriteCostLabel}` : `Confirm rewrite — ${rewriteCostLabel}`)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Manual publishing checklist (PR4) ─────────────────────────── */}
        {manualPublishPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeManualPublishModal}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#4F46E5,#6366f1,#7c3aed)' }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-950">📤 {t('contentHub.manualTitle')}</h3>
                  <button onClick={closeManualPublishModal} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
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

                <label
                  className="flex items-start gap-3 rounded-xl p-3 mb-3 cursor-pointer"
                  style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.10)' }}
                >
                  <input
                    type="checkbox"
                    checked={manualPublishConfirmed}
                    onChange={e => setManualPublishConfirmed(e.target.checked)}
                    disabled={manualPublishing}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">
                      {t('contentHub.manualAcknowledge')}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-1">
                      {t('contentHub.manualAcknowledgeHelper')}
                    </span>
                  </span>
                </label>

                <div className="flex justify-end gap-2">
                  <button onClick={closeManualPublishModal} disabled={manualPublishing} className="text-sm px-4 py-2 rounded-xl text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button onClick={confirmManualPublish} disabled={manualPublishing || !manualPublishConfirmed} className="text-sm px-4 py-2 rounded-xl font-semibold text-white flex items-center gap-2 disabled:cursor-not-allowed" style={{ background: '#4F46E5', opacity: manualPublishing || !manualPublishConfirmed ? 0.45 : 1 }}>
                    {manualPublishing ? (<><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t('contentHub.marking')}</>) : (<>✓ {t('contentHub.manualConfirm')}</>)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      </div>
    </AppShell>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

// ── PostCard Component ─────────────────────────────────────────────────────────

interface PostCardProps {
  post: ContentPost
  campaignId: string
  pendingEdit: Partial<ContentPost>
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
  onGenerateImage: () => void | Promise<void>
  onAddCredits: () => void
  onToggleExpand: () => void
  onEditCaption: () => void
  onEditPrompt: () => void
  onOpenMediaPicker: () => void
  onCloseMediaPicker: () => void
  onSaveEdit: (updates: Partial<ContentPost>) => Promise<void>
  onRemoveMedia: () => void
  onPendingEdit: (updates: Partial<ContentPost>) => void
  onRewrite: (instruction: string) => Promise<void>
  onPickWinner?: () => void
  onManualPublish?: () => void
  qualityIssueCount: number
  onPlatformPublished: () => void | Promise<void>
}

function PostCard({
  post,
  campaignId,
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
  onRemoveMedia,
  onSaveEdit,
  onPendingEdit,
  onRewrite,
  onPickWinner,
  onManualPublish,
  qualityIssueCount,
  onPlatformPublished,
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
  const mediaState = deriveContentHubMediaState(post)
  const postImmutable = post.status === 'PUBLISHED' || post.status === 'PROCESSING'
  const editReopensReview = ['APPROVED', 'SCHEDULED', 'FAILED'].includes(post.status)
  const executionBlockedByQuality = qualityIssueCount > 0

  const statusColor = {
    PENDING: '#f59e0b', GENERATING: '#6366f1', DONE: '#10b981',
    FAILED: '#ef4444', AWAITING_UPLOAD: '#8b5cf6', SKIPPED: '#6b7280',
  }[status] ?? '#6b7280'

  const statusLabel = {
    PENDING: isAr ? 'الوسائط بانتظار التوليد' : 'Media pending', GENERATING: t('contentHub.statusGenerating'), DONE: isAr ? 'الوسائط جاهزة' : 'Media ready',
    FAILED: t('contentHub.statusFailed'), AWAITING_UPLOAD: t('contentHub.statusUploadVideo'), SKIPPED: t('contentHub.statusSkipped'),
  }[status] ?? status
  const mediaSourceLabel = derivePostMediaSource(post)
  const creativeRequirement = derivePostCreativeRequirement({
    postId: post.id,
    platform: post.platform,
    caption,
    status: post.status,
    imageUrl: post.imageUrl,
    uploadedMediaId: post.uploadedMediaId,
    mediaSource: post.mediaSource,
    generationStatus: post.generationStatus,
    isVideoPost: post.isVideoPost,
    brandName,
  })
  const creativeRequirementStatusLabel = isAr ? creativeRequirement.statusLabelAr : creativeRequirement.statusLabel
  const creativeRequirementExplanation = isAr ? creativeRequirement.explanationAr : creativeRequirement.explanation
  const sourcePreferenceLabel = {
    generated: isAr ? 'وسائط مولّدة' : 'generated media',
    uploaded: isAr ? 'وسائط مرفوعة' : 'uploaded media',
    either: isAr ? 'وسائط مولّدة أو مرفوعة' : 'generated or uploaded media',
  }[creativeRequirement.sourcePreference]

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
    PROCESSING: {
      label: isAr ? 'قيد تأكيد المنصة' : 'Awaiting platform confirmation',
      color: '#7c3aed',
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
              ✓ {t('contentHub.winner')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            title={isAr ? mediaState.explanatoryCopy.ar : mediaState.explanatoryCopy.en}
            style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid rgba(37,99,235,0.18)' }}>
            {isAr ? mediaSourceLabel.ar : mediaSourceLabel.en}
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

      <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(15,23,42,0.08)', background: '#F8FAFC' }}>
        <div className="rounded-xl border border-indigo-100 bg-white p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                {isAr ? 'متطلبات الإبداع' : 'Creative requirement'}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-800">{creativeRequirementStatusLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{creativeRequirementExplanation}</p>
            </div>
            <span className="w-fit rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
              {isAr
                ? `المقاس المقترح: ${creativeRequirement.aspectRatio}`
                : `Recommended format: ${creativeRequirement.aspectRatio}`}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
              {creativeRequirement.format}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
              {isAr ? `المصدر: ${sourcePreferenceLabel}` : `Use ${sourcePreferenceLabel}`}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
              {isAr ? 'طبقات النص والشعار لاحقاً' : 'Text/logo layers come later'}
            </span>
          </div>
        </div>
      </div>

      {executionBlockedByQuality && (
        <div className="border-t border-rose-200 bg-rose-50 px-3 py-3 text-[11px] leading-5 text-rose-800">
          <p className="font-black">{isAr ? 'يحتاج مراجعة النص قبل التنفيذ' : 'Copy review required before execution'}</p>
          <p>{isAr
            ? `رصد NEXUS ${qualityIssueCount} ملاحظة جودة. عدّل النص أو أعد صياغته؛ لن يظهر مسار النشر حتى ينجح الفحص.`
            : `NEXUS found ${qualityIssueCount} quality finding${qualityIssueCount === 1 ? '' : 's'}. Edit or rewrite the copy; publishing stays hidden until the review passes.`}</p>
        </div>
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
          {isUserConfirmedManualPublished(post) && !post.platformUrl && (
            <p className="text-[10px] text-slate-400 mt-1">{t('contentHub.manualNoPlatformProof')}</p>
          )}
        </div>
      )}

      {!executionBlockedByQuality && (
        <PostPlatformPublisher
          postId={post.id}
          campaignId={campaignId}
          platform={post.platform}
          status={post.status}
          hasMedia={Boolean(post.imageUrl)}
          isVideoPost={post.isVideoPost}
          captionLength={Array.from(post.caption.trim()).length}
          onPublished={onPlatformPublished}
        />
      )}

      {hasImage && !postImmutable && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <button
            onClick={onRemoveMedia}
            className="w-full text-xs px-3 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5"
            style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid rgba(234,88,12,0.22)' }}
          >
            {isAr ? 'إزالة الوسائط من المنشور' : 'Remove media from post'}
          </button>
          <p className="text-[10px] text-slate-400 mt-1 text-center">
            {editReopensReview
              ? (isAr ? 'إزالة الوسائط تعيد المنشور لمسودة وتلغي اعتماده وجدولة تنفيذه؛ الأصل يبقى في المكتبة.' : 'Removing media reopens the post as a draft and clears approval/execution scheduling; the asset stays in the library.')
              : (isAr ? 'يزيل الوسائط من المعاينة فقط، ولا يحذف الأصل من مكتبة الوسائط.' : 'Clears preview media only; the asset stays in Media Library.')}
          </p>
        </div>
      )}

      {/* ── Edit copy overlay ─────────── */}
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

      {/* ── Review-safe post actions ─────── */}
      {!postImmutable && <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t('contentHub.postActions')}
          </p>
          <p className="text-[10px] leading-snug text-slate-500">
            {editReopensReview
              ? (isAr ? 'أي تعديل يعيد المنشور لمسودة ويلغي الاعتماد وقرار التنفيذ حتى تراجعه من جديد.' : 'Any edit reopens this post as a draft and clears approval and execution assignment until it is reviewed again.')
              : t('contentHub.postActionsSafety')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
        <button onClick={onEditCaption}
          className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug text-slate-600 transition-all flex items-center justify-center gap-1.5 hover:text-[#5E5CE6] hover:bg-violet-50"
          style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11.5 2.5a2.121 2.121 0 013 3L5 15l-4 1 1-4L11.5 2.5z"/></svg>
          {t('contentHub.editCaption')}
        </button>
        <button
          onClick={() => { setShowRewriteInput(v => !v); setRewriteInstruction('') }}
          disabled={isRewriting}
          className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug hover:bg-purple-500/5 transition-all flex items-center justify-center gap-1"
          style={{ borderColor: 'rgba(94,92,230,0.18)', color: '#5E5CE6' }}
        >
          {isRewriting
            ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{t('contentHub.rewriting')}</>
            : <>✨ {t('contentHub.rewriteCopyShort')}</>
          }
        </button>
        {/* Generate AI image (disabled for TikTok — needs real video) */}
        {platform === 'TIKTOK' ? (
          <button onClick={onOpenMediaPicker}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug transition-all flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(15,23,42,0.08)', color: '#DB2777' }}
            title="TikTok requires real video — upload yours">
            📹 {t('contentHub.attachVideoShort')}
          </button>
        ) : (
          <button
            onClick={imageGenerationLocked ? onAddCredits : onGenerateImage}
            disabled={isGeneratingImage}
            title={imageGenerationLocked ? addCreditsForImagesLabel : 'Generate image · 3 credits · failed generations are refunded'}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug transition-all flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(15,23,42,0.08)', color: imageGenerationLocked ? '#B91C1C' : isGeneratingImage ? '#8B5CF6' : '#5E5CE6', background: imageGenerationLocked ? '#FEF2F2' : undefined }}
          >
            {isGeneratingImage
              ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{t('contentHub.gen')}</>
              : <>🎨 {imageGenerationLocked ? addCreditsForImagesLabel : t('contentHub.generateImageShort')}</>
            }
          </button>
        )}
        {onPickWinner ? (
          /* A/B test: replace "Image" button with a variant-selection action */
          <button
            onClick={onPickWinner}
            disabled={isPickingWinner}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug transition-all flex items-center justify-center gap-1"
            style={{
              borderColor: 'rgba(234,179,8,0.25)',
              color: isPickingWinner ? '#fbbf24' : '#fcd34d',
              background: 'rgba(234,179,8,0.04)',
            }}
          >
            {isPickingWinner
              ? <><span className="w-2.5 h-2.5 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />{t('contentHub.picking')}</>
              : <>✓ {t('contentHub.selectVariantShort')}</>
            }
          </button>
        ) : (
          <button onClick={onOpenMediaPicker}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5"
            style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1"/><path d="M14 10l-4-4-3 3-1.5-1.5L2 11"/></svg>
            {isVideo ? t('contentHub.attachVideoShort') : t('contentHub.chooseMediaShort')}
          </button>
        )}
        </div>
      </div>}
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
        <span
          aria-hidden="true"
          className="text-[11px] font-semibold px-3 py-1 rounded-full border"
          style={{ borderColor: '#0A66C2', color: '#0A66C2' }}
          title={t('contentHub.previewOnly')}
        >
          + Follow
        </span>
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
            <span
              key={label}
              aria-hidden="true"
              className="flex items-center gap-1 text-[11px] text-gray-500 font-medium"
              title={t('contentHub.previewOnly')}
            >
              <span className="text-[14px]">{icon}</span>{label}
            </span>
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
        <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>👍 Like</span>
        <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>💬 Comment</span>
        <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>↗ Share</span>
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
