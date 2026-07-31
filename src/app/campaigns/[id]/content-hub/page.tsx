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

import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { deriveCampaignOperatingState } from '@/lib/campaignOperatingState'
import { summarizeByDisplayState } from '@/lib/postVisibility'
import { getCreditActionTruth } from '@/lib/creditActionTruth'
import { useBillingStatus } from '@/lib/useBillingStatus'
import { fetchWithTimeout, PRODUCT_READ_TIMEOUT_MS } from '@/lib/fetchWithTimeout'
import {
  CONTENT_HUB_IMAGE_COST,
  CONTENT_HUB_VIDEO_COST,
  CONTENT_HUB_MOTION_DESIGN_COST,
  CONTENT_HUB_PROPERTY_PHOTO_FILM_COST,
  CONTENT_HUB_REGENERATION_COST,
  CONTENT_HUB_REWRITE_COST,
  CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
  CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS,
  getBulkImageGenerationCost,
  summarizeBulkImageGenerationOutcome,
  type BulkImageGenerationSummary,
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
import { resolveStrategyScope } from '@/lib/strategy/strategyScope'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import {
  buildContentPlanTruthContext,
  reviewContentPlanForApproval,
  type ContentPlanApprovalIssue,
} from '@/lib/contentPlanApprovalGuard'
import { derivePostCreativeRequirement } from '@/lib/creativeRequirements'
import { getDefaultTemplateForPlatform } from '@/lib/creativeTemplates'
import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PostPlatformPublisher } from '@/components/publishing/PostPlatformPublisher'
import { creditOperationScope, fetchCreditOperation } from '@/lib/creditOperationClient'
import {
  GeneratedVisualTerminalError,
  pollGeneratedVisual,
} from '@/lib/generatedVisualPolling'
import {
  type CreativeIntelligencePayload,
  type CreativeMediaCandidate,
  type CreativeMediaMatch,
} from '@/lib/creativeIntelligence'
import { CreativeIntelligencePanel } from '@/components/content/CreativeIntelligencePanel'
import { PostCreativeMatch } from '@/components/content/PostCreativeMatch'
import { CreativeAdaptationModal } from '@/components/content/CreativeAdaptationModal'
import {
  assessCinematicProductAdAssets,
  CINEMATIC_PRODUCT_AD_DURATION_SECONDS,
  CINEMATIC_PRODUCT_AD_MAX_REFERENCES,
  CINEMATIC_PRODUCT_AD_MIN_REFERENCES,
} from '@/lib/videoAdPreflight'
import {
  assessMotionDesignVideoAsset,
  MOTION_DESIGN_DURATION_SECONDS,
} from '@/lib/motionDesignAd'
import {
  assessPropertyPhotoFilmAssets,
  PROPERTY_PHOTO_FILM_DURATION_SECONDS,
  PROPERTY_PHOTO_FILM_MAX_REFERENCES,
  PROPERTY_PHOTO_FILM_MIN_REFERENCES,
} from '@/lib/propertyPhotoFilm'
import { PROFESSIONAL_VIDEO_TIMELINE_VERSION } from '@/lib/professionalVideoTimeline'

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'ALL' | 'META' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'TIKTOK' | 'TWITTER' | 'YOUTUBE' | 'YOUTUBE_SHORTS' | 'PINTEREST' | 'THREADS'
type MediaSource = 'GENERATE' | 'UPLOAD' | 'UPLOAD_RAW'
type GenStatus = 'PENDING' | 'GENERATING' | 'DONE' | 'FAILED' | 'REFUND_PENDING' | 'AWAITING_UPLOAD' | 'SKIPPED'

interface ContentPost {
  id: string
  platform: string
  publishTarget?: string | null
  caption: string
  imageUrl: string | null
  imagePrompt: string | null
  videoPrompt: string | null
  errorMessage: string | null
  isVideoPost: boolean
  generationStatus: GenStatus
  mediaSource: MediaSource
  uploadedMediaId: string | null
  contentPlanIndex: number
  scheduledAt: string | null
  status: 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED'
  // Publishing lifecycle (manual publishing checklist — PR4)
  publishMode?: 'MANUAL' | 'AUTO' | null
  approvedAt?: string | null
  approvedSnapshotId?: string | null
  mediaApprovalSnapshotId?: string | null
  manuallyPublishedAt?: string | null
  platformUrl?: string | null
  // A/B Testing fields
  variantGroup: string | null
  variantLabel: string | null   // 'A' | 'B' | null
  variantWinner: boolean
  draftComparison?: {
    hypothesis: string
    variable: string
    successSignal: string
    minimumEvidence: string
    decisionRule: string
    measurementState: 'draft_preference_only'
  } | null
  rejectedVideoReview?: {
    generationId: string
    previewUrl: string
    summary: string
    issues: string[]
    reviewedAt: string | null
    semanticAlignmentScore: number | null
    professionalQualityScore: number | null
    referencePreservationScore: number | null
    attachable: false
    publishable: false
    repairEligible: boolean
  } | null
  retainedVideoRepair?: {
    generationId: string
    reason: 'COMPOSITOR_UPGRADE'
    creditsUsed: 0
    providerGenerationStarted: false
  } | null
}

interface MediaItem {
  id: string
  url: string
  fileName: string
  type: string
  assetKind?: 'UPLOADED_MEDIA' | 'GENERATED_VISUAL'
  generatedVisualId?: string
  mimeType?: string | null
  cloudinaryId?: string | null
  width?: number | null
  height?: number | null
  duration?: number | null
  category?: string | null
  tags?: string[]
  intelligenceStatus?: string | null
  intelligence?: unknown
}

interface CreativeAdaptationSelection {
  postId: string
  match: CreativeMediaMatch
  media: CreativeMediaCandidate
}

interface ScheduleAccount {
  id: string
  platform: string
  accountName?: string | null
  pages?: Array<{ id: string; name: string; igAccountId?: string | null }>
  organizations?: Array<{ id: string; name: string }>
  selectedOrganizationId?: string | null
  boards?: Array<{ id: string; name: string }>
  accessTier?: 'TRIAL' | 'STANDARD' | string
}

interface YouTubeScheduleOptions {
  title: string
  privacyStatus: 'private' | 'unlisted' | 'public'
  madeForKids: '' | 'yes' | 'no'
  syntheticMedia: '' | 'yes' | 'no'
  notifySubscribers: boolean
}

interface PinterestScheduleOptions {
  boardId: string
  title: string
  altText: string
  destinationLink: string
  aiDisclosureReviewed: boolean
  aiModified: boolean
  syntheticPerformer: boolean
}

interface ThreadsScheduleOptions {
  replyControl: 'everyone' | 'accounts_you_follow' | 'mentioned_only'
  altText: string
}

interface PendingMediaAttachment {
  postId: string
  media: MediaItem
  action: 'attach' | 'replace'
}

const EMPTY_QUALITY_ISSUES: string[] = []

function contentQualityIssueLabel(reason: string, isArabic: boolean): string {
  const labels: Record<string, { ar: string; en: string }> = {
    generic_hook_formula: {
      ar: 'افتتاحية عامة يمكن أن تناسب أي براند؛ اذكر موقف الجمهور أو مشكلته بوضوح.',
      en: 'The opening is generic enough for any brand; name the audience situation or problem clearly.',
    },
    unverified_feature_or_outcome: {
      ar: 'النص أو توجيه الوسائط يتضمن ميزة أو نتيجة غير موثقة في Brand Brain؛ راجع كليهما أو أضف إثباتًا محفوظًا.',
      en: 'The copy or media direction includes a feature or outcome not verified in Brand Brain; review both or add saved evidence.',
    },
    unexpected_operational_saas_drift: {
      ar: 'النص انجرف إلى وصف منتج SaaS أو سير عمل تشغيلي غير موجود في حقائق البراند.',
      en: 'The copy drifts into a SaaS or operational workflow not present in the saved brand facts.',
    },
    missing_strategy_alignment: {
      ar: 'النص لا يعكس رسالة أو جمهور أو اتجاهًا واضحًا من الاستراتيجية المعتمدة.',
      en: 'The copy does not clearly reflect the approved strategy message, audience, or direction.',
    },
    malformed_caption: {
      ar: 'صياغة النص غير مكتملة أو غير صالحة للنشر وتحتاج تحريرًا يدويًا.',
      en: 'The caption is incomplete or malformed and needs a manual edit.',
    },
    unsupported_clinic_outcome_claim: {
      ar: 'يوجد ادعاء بنتيجة صحية أو علاجية غير موثقة.',
      en: 'The copy contains an unsupported health or treatment outcome claim.',
    },
    unsupported_security_claim: {
      ar: 'يوجد ادعاء أمني غير موثق.',
      en: 'The copy contains an unsupported security claim.',
    },
    unsupported_absolute_claim: {
      ar: 'يوجد وعد مطلق أو ضمان لا يدعمه إثبات محفوظ.',
      en: 'The copy contains an absolute promise or guarantee without saved evidence.',
    },
    unsupported_fake_product_visual: {
      ar: 'التوجيه البصري يطلب واجهة أو منتجًا غير موثق وكأنه حقيقي.',
      en: 'The visual direction presents an unverified interface or product as real.',
    },
  }
  const known = labels[reason]
  if (known) return isArabic ? known.ar : known.en
  if (reason.startsWith('unsupported_')) {
    return isArabic
      ? 'يوجد ادعاء في النص أو توجيه الوسائط بلا إثبات محفوظ في Brand Brain.'
      : 'The copy or media direction contains a claim without supporting evidence saved in Brand Brain.'
  }
  return reason.split('_').join(' ')
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
  targetAudience: string | null
  audienceAge: string | null
  audienceLocation: string | null
  audiencePainPoints: string[]
  audienceDesires: string[]
  uniqueAdvantages: string[]
  pricePoint: string | null
  complianceNotes: string | null
  conversionDestination: string | null
  leadHandling: string | null
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
  PINTEREST: {
    label: 'Pinterest',
    color: '#E60023',
    bg: '#fff1f3',
    border: '#E60023',
    icon: '📌',
    cardStyle: 'pinterest',
  },
  THREADS: {
    label: 'Threads',
    color: '#111827',
    bg: '#f8fafc',
    border: '#111827',
    icon: '@',
    cardStyle: 'threads',
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
  PINTEREST: 'https://pinterest.com',
  THREADS: 'https://threads.net',
}
function platformHomeUrl(platform: string): string | null {
  return PLATFORM_HOME_URLS[platform?.toUpperCase()] ?? null
}

function hasValidDate(value: string | Date | null | undefined): boolean {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

function toLocalScheduleInputValue(value: string | Date | null | undefined): string {
  if (!hasValidDate(value)) return ''
  const date = value instanceof Date ? value : new Date(value as string)
  const localTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000))
  return localTime.toISOString().slice(0, 16)
}

function scheduleInputToIso(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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

function defaultPinterestScheduleOptions(post: Pick<ContentPost, 'caption'>, boardId = ''): PinterestScheduleOptions {
  return {
    boardId,
    title: post.caption.split(/\r?\n/)[0].trim().slice(0, 100),
    altText: post.caption.trim().slice(0, 500),
    destinationLink: '',
    aiDisclosureReviewed: false,
    aiModified: false,
    syntheticPerformer: false,
  }
}

function defaultThreadsScheduleOptions(post: Pick<ContentPost, 'caption'>): ThreadsScheduleOptions {
  return {
    replyControl: 'everyone',
    altText: post.caption.trim().slice(0, 1_000),
  }
}

export default function ContentHubPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
  const {
    status: billingStatus,
    creditsRemaining,
    isUnlimited,
    loading: billingLoading,
    invalidate: refreshBillingStatus,
  } = useBillingStatus()
  const isAr = locale === 'ar'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const campaignStrategyScope = useMemo(
    () => resolveStrategyScope(campaign?.aiOutput),
    [campaign?.aiOutput],
  )
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({
    brandName: null,
    logoUrl: null,
    colorPalette: [],
    industry: null,
    description: null,
    primaryOffer: null,
    targetAudience: null,
    audienceAge: null,
    audienceLocation: null,
    audiencePainPoints: [],
    audienceDesires: [],
    uniqueAdvantages: [],
    pricePoint: null,
    complianceNotes: null,
    conversionDestination: null,
    leadHandling: null,
    verifiedProof: [],
  })
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [authoritativeContentQualityIssues, setAuthoritativeContentQualityIssues] = useState<ContentPlanApprovalIssue[] | null>(null)
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
  const [creativeIntelligence, setCreativeIntelligence] = useState<CreativeIntelligencePayload | null>(null)
  const [creativeScanning, setCreativeScanning] = useState(false)
  const [showCreativeScanConfirm, setShowCreativeScanConfirm] = useState(false)
  const [creativeScanAcknowledged, setCreativeScanAcknowledged] = useState(false)
  const [creativeAdaptation, setCreativeAdaptation] = useState<CreativeAdaptationSelection | null>(null)
  const [creativeAdaptationAcknowledged, setCreativeAdaptationAcknowledged] = useState(false)
  const [adaptingCreativePostId, setAdaptingCreativePostId] = useState<string | null>(null)
  const [activePlatform, setActivePlatform] = useState<Platform>('ALL')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState<string | null>(null) // postId
  const [pendingMediaAttachment, setPendingMediaAttachment] = useState<PendingMediaAttachment | null>(null)
  const [mediaAttachmentAcknowledged, setMediaAttachmentAcknowledged] = useState(false)
  const [mediaAttachmentSaving, setMediaAttachmentSaving] = useState(false)
  const [mediaRemovalPostId, setMediaRemovalPostId] = useState<string | null>(null)
  const [mediaRemovalAcknowledged, setMediaRemovalAcknowledged] = useState(false)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<ContentPost>>>({})
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [mediaApproving, setMediaApproving] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  // Manual publishing checklist (PR4) — for MANUAL + SCHEDULED posts
  const [manualPublishPost, setManualPublishPost] = useState<ContentPost | null>(null)
  const [manualUrl, setManualUrl] = useState('')
  const [manualPublishing, setManualPublishing] = useState(false)
  const [manualPublishConfirmed, setManualPublishConfirmed] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showMediaApproveConfirm, setShowMediaApproveConfirm] = useState(false)
  const [weakMediaApprovalAcknowledged, setWeakMediaApprovalAcknowledged] = useState(false)
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)
  const [scheduleAcknowledged, setScheduleAcknowledged] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [scheduleDateByPostId, setScheduleDateByPostId] = useState<Record<string, string>>({})
  const [scheduleAccounts, setScheduleAccounts] = useState<ScheduleAccount[]>([])
  const [scheduleAccountsLoading, setScheduleAccountsLoading] = useState(false)
  const [destinationByTarget, setDestinationByTarget] = useState<Record<string, { integrationId: string; pageId?: string; pageName?: string }>>({})
  const [tiktokCreator, setTikTokCreator] = useState<{ privacyLevelOptions: string[]; commentDisabled: boolean; duetDisabled: boolean; stitchDisabled: boolean } | null>(null)
  const [tiktokOptions, setTikTokOptions] = useState({
    privacyLevel: '', disableComment: false, disableDuet: false, disableStitch: false,
    brandContentToggle: false, brandOrganicToggle: true, isAigc: false,
  })
  const [youtubeOptionsByPostId, setYouTubeOptionsByPostId] = useState<Record<string, YouTubeScheduleOptions>>({})
  const [pinterestOptionsByPostId, setPinterestOptionsByPostId] = useState<Record<string, PinterestScheduleOptions>>({})
  const [threadsOptionsByPostId, setThreadsOptionsByPostId] = useState<Record<string, ThreadsScheduleOptions>>({})
  const [approveResult, setApproveResult] = useState<{
    kind: 'approved' | 'scheduled'
    approved: number
    linked: number
    unlinked: number
    signals: { hooks: number; angles: number }
    platforms: string[]
    firstDate: string | null
    lastDate: string | null
    pendingMedia: number
    totalMedia: number
    pendingImages: number
    totalImages: number
    videoSlots: number
  } | null>(null)
  const [rewritingPost, setRewritingPost] = useState<string | null>(null)
  const [enableABTesting, setEnableABTesting] = useState(false)
  const [pickingWinner, setPickingWinner] = useState<string | null>(null)
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null)
  const [pendingGeneratedAttachment, setPendingGeneratedAttachment] = useState<{
    postId: string
    generatedVisualId: string
  } | null>(null)
  const [retryingGeneratedAttachment, setRetryingGeneratedAttachment] = useState(false)
  const [imageGenerationConfirmPostId, setImageGenerationConfirmPostId] = useState<string | null>(null)
  const [imageGenerationAcknowledged, setImageGenerationAcknowledged] = useState(false)
  const [imageReferenceMediaId, setImageReferenceMediaId] = useState<string | null>(null)
  const [videoGenerationConfirmPostId, setVideoGenerationConfirmPostId] = useState<string | null>(null)
  const [videoGenerationAcknowledged, setVideoGenerationAcknowledged] = useState(false)
  const [videoAssetRightsAcknowledged, setVideoAssetRightsAcknowledged] = useState(false)
  const [videoSamePropertyAcknowledged, setVideoSamePropertyAcknowledged] = useState(false)
  const [videoReferenceMediaIds, setVideoReferenceMediaIds] = useState<string[]>([])
  const [videoProductionMode, setVideoProductionMode] = useState<'PHOTO_FILM' | 'MOTION_DESIGN' | 'CAMPAIGN_FILM' | 'CINEMATIC'>('PHOTO_FILM')
  const [motionDesignSourceMediaId, setMotionDesignSourceMediaId] = useState<string | null>(null)
  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null)
  const [repairingVideoId, setRepairingVideoId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE' | 'SCHEDULED' | 'PUBLISHED'>('ALL')
  const [showBulkImageConfirm, setShowBulkImageConfirm] = useState(false)
  const [bulkImageAcknowledged, setBulkImageAcknowledged] = useState(false)
  const [bulkImageResult, setBulkImageResult] = useState<BulkImageGenerationSummary | null>(null)
  const [showGeneratePlanConfirm, setShowGeneratePlanConfirm] = useState(false)
  const [generatePlanAcknowledged, setGeneratePlanAcknowledged] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [regenerateAcknowledged, setRegenerateAcknowledged] = useState(false)
  const [rewriteConfirm, setRewriteConfirm] = useState<{ postId: string; instruction: string } | null>(null)
  const [rewriteAcknowledged, setRewriteAcknowledged] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const autoBuildStartedRef = useRef(false)
  const loadRequestIdRef = useRef(0)

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (): Promise<ContentPost[]> => {
    if (!isAuthenticated) return []
    const requestId = ++loadRequestIdRef.current
    let loadedPosts: ContentPost[] = []
    const authorization = authHeader()
    if (!authorization) {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false)
        setLoadError(isAr ? 'تعذّر التحقق من جلسة الدخول. أعد المحاولة.' : 'Could not verify your session. Retry.')
      }
      return []
    }

    setLoadError(null)
    try {
      // These resources are independent. Load them concurrently so a slow media
      // library cannot block the campaign and its content plan from appearing.
      setAuthoritativeContentQualityIssues(null)
      const [campaignResult, planResult, mediaResult, brandResult, creativeIntelligenceResult] = await Promise.allSettled([
        fetchWithTimeout(`/api/campaigns/${campaignId}`, { headers: { Authorization: authorization } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout(`/api/campaigns/${campaignId}/content-plan`, { headers: { Authorization: authorization } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout(`/api/media?campaignId=${encodeURIComponent(campaignId)}`, { headers: { Authorization: authorization } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout('/api/brand', { headers: { Authorization: authorization } }, PRODUCT_READ_TIMEOUT_MS),
        fetchWithTimeout(`/api/campaigns/${campaignId}/creative-intelligence`, { headers: { Authorization: authorization } }, PRODUCT_READ_TIMEOUT_MS),
      ])

      // Several actions deliberately refresh this screen. Ignore a slower,
      // older request so it cannot replace fresh content with a stale error.
      if (requestId !== loadRequestIdRef.current) return []

      if (campaignResult.status !== 'fulfilled') {
        throw new Error(isAr ? 'تعذّر تحميل الحملة. حاول مرة أخرى.' : 'Could not load the campaign. Try again.')
      }
      const cRes = campaignResult.value
      if (cRes.status === 404) {
        setCampaign(null)
        return []
      }
      if (!cRes.ok) {
        throw new Error(isAr ? 'تعذّر تحميل الحملة. حاول مرة أخرى.' : 'Could not load the campaign. Try again.')
      }
      const { campaign: c } = await cRes.json()
      if (!c) {
        setCampaign(null)
        return []
      }
      setCampaign({
        id: c.id,
        name: c.name,
        platforms: c.platforms ?? [],
        status: c.status ?? null,
        aiOutput: c.aiOutput ?? null,
        autopilotEnabled: c.autopilotEnabled ?? null,
        autopilotActivatedAt: c.autopilotActivatedAt ?? null,
      })

      if (planResult.status !== 'fulfilled' || !planResult.value.ok) {
        throw new Error(isAr
          ? 'تعذّر تحديث أحدث نسخة من خطة المحتوى؛ المعروض آخر نسخة حمّلها NEXUS. أعد المحاولة.'
          : 'Could not refresh the latest content plan; the last loaded version remains visible. Retry.')
      }
      const planData = await planResult.value.json()
      const rawPosts = planData.posts
      loadedPosts = rawPosts ?? []
      setPosts(loadedPosts)
      if (Array.isArray(planData?.qualityReview?.issues)) {
        setAuthoritativeContentQualityIssues(planData.qualityReview.issues
          .filter((issue: any) => Number.isInteger(issue?.index) && typeof issue?.reason === 'string')
          .map((issue: any) => ({ index: issue.index, reason: issue.reason })))
      }

      if (mediaResult.status === 'fulfilled' && mediaResult.value.ok) {
        const mData = await mediaResult.value.json()
        setMediaLibrary(mData.media ?? mData.items ?? [])
      }

      if (brandResult.status === 'fulfilled' && brandResult.value.ok) {
        const bData = await brandResult.value.json()
        if (bData.brandProfile) {
          setBrandProfile({
            brandName: bData.brandProfile.brandName ?? null,
            logoUrl: bData.brandProfile.logoUrl ?? null,
            colorPalette: bData.brandProfile.colorPalette ?? [],
            industry: bData.brandProfile.industry ?? null,
            description: bData.brandProfile.description ?? null,
            primaryOffer: bData.brandProfile.primaryOffer ?? null,
            targetAudience: bData.brandProfile.targetAudience ?? null,
            audienceAge: bData.brandProfile.audienceAge ?? null,
            audienceLocation: bData.brandProfile.audienceLocation ?? null,
            audiencePainPoints: bData.brandProfile.audiencePainPoints ?? [],
            audienceDesires: bData.brandProfile.audienceDesires ?? [],
            uniqueAdvantages: bData.brandProfile.uniqueAdvantages ?? [],
            pricePoint: bData.brandProfile.pricePoint ?? null,
            complianceNotes: bData.brandProfile.complianceNotes ?? null,
            conversionDestination: bData.brandProfile.conversionDestination ?? null,
            leadHandling: bData.brandProfile.leadHandling ?? null,
            verifiedProof: bData.brandProfile.verifiedProof ?? [],
          })
        }
      }

      if (creativeIntelligenceResult.status === 'fulfilled' && creativeIntelligenceResult.value.ok) {
        setCreativeIntelligence(await creativeIntelligenceResult.value.json())
      }

      setLoadError(null)

    } catch (err) {
      if (requestId === loadRequestIdRef.current) {
        setLoadError(err instanceof Error
          ? err.message
          : (isAr ? 'تعذّر تحميل مركز إنتاج الحملة.' : 'Could not load campaign production.'))
      }
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false)
    }
    return loadedPosts
  }, [authHeader, campaignId, isAr, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData()
  }, [authLoading, isAuthenticated, loadData])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

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
          } else if (target === 'PINTEREST') {
            const pinterest = accounts.find(account => account.platform === 'PINTEREST')
            if (pinterest) next.PINTEREST = { integrationId: pinterest.id, pageName: pinterest.accountName || undefined }
          } else if (target === 'THREADS') {
            const threads = accounts.find(account => account.platform === 'THREADS')
            if (threads) next.THREADS = { integrationId: threads.id, pageName: threads.accountName || undefined }
          }
        }
        if (targets.has('THREADS')) {
          setThreadsOptionsByPostId(Object.fromEntries(
            approvedPostsWithDates
              .filter(post => normalizeAutoPublishTarget(post.platform) === 'THREADS')
              .map(post => [post.id, defaultThreadsScheduleOptions(post)]),
          ))
        }
        setDestinationByTarget(next)
        const pinterest = accounts.find(account => account.platform === 'PINTEREST')
        if (targets.has('PINTEREST') && pinterest) {
          const onlyBoardId = pinterest.boards?.length === 1 ? pinterest.boards[0].id : ''
          setPinterestOptionsByPostId(Object.fromEntries(
            approvedPostsWithDates
              .filter(post => normalizeAutoPublishTarget(post.platform) === 'PINTEREST')
              .map(post => [post.id, defaultPinterestScheduleOptions(post, onlyBoardId)]),
          ))
        }
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
      const poll = async () => {
        const authorization = authHeader()
        const videoPosts = posts.filter(post => post.isVideoPost && post.generationStatus === 'GENERATING')
        if (authorization && videoPosts.length > 0) {
          await Promise.all(videoPosts.map(async (post) => {
            try {
              return Promise.allSettled([
                fetch(
                  `/api/campaigns/${campaignId}/content-plan/${post.id}/generate-property-photo-film`,
                  { headers: { Authorization: authorization } },
                ),
                fetch(`/api/campaigns/${campaignId}/content-plan/${post.id}/generate-video`, {
                  headers: { Authorization: authorization },
                }),
              ])
            } catch {
              return null
            }
          }))
        }
        await loadData()
      }
      pollRef.current = setInterval(() => { void poll() }, 4000)
    } else if (!generating && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [posts, loadData, authHeader, campaignId])

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
  const allMediaReadiness = summarizeContentHubMediaReadiness(posts)
  const doneCount = mediaReadiness.confirmedReady
  const ambiguousPreviewCount = mediaReadiness.ambiguousPreviewCount
  const pendingImagePosts = posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost)
  const pendingImageCount = pendingImagePosts.length
  const bulkImageCreditCost = getBulkImageGenerationCost(pendingImageCount)
  const progress = totalImagePosts > 0 ? Math.round((doneCount / totalImagePosts) * 100) : 0
  const draftPosts = posts.filter(p => p.status === 'DRAFT')
  const draftCount = draftPosts.length
  const draftMediaDecisionCount = draftPosts.filter(
    post => deriveContentHubMediaState(post).needsAttention,
  ).length
  const approvedPosts = posts.filter(p => p.status === 'APPROVED')
  const approvedCount = approvedPosts.length
  const approvedPostsWithDates = approvedPosts.filter(p => hasValidDate(p.scheduledAt))
  const approvedAutoTargets = Array.from(new Set(approvedPostsWithDates.map(post => normalizeAutoPublishTarget(post.platform))))
  const unsupportedAutoTargets = approvedAutoTargets.filter(target => !['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'X', 'YOUTUBE', 'PINTEREST', 'THREADS'].includes(target))
  const approvedYouTubePosts = approvedPostsWithDates.filter(post => ['YOUTUBE', 'YOUTUBE_SHORTS'].includes(post.platform.toUpperCase()))
  const youtubeAutoReviewIncomplete = scheduleMode === 'AUTO' && approvedYouTubePosts.some(post => {
    const options = youtubeOptionsByPostId[post.id]
    return !options?.title.trim() || !options.madeForKids || !options.syntheticMedia
  })
  const approvedXPosts = approvedPostsWithDates.filter(post => ['X', 'TWITTER'].includes(post.platform.toUpperCase()))
  const xAutoReviewIncomplete = scheduleMode === 'AUTO' && approvedXPosts.some(post =>
    post.isVideoPost || Array.from(post.caption.trim()).length === 0 || Array.from(post.caption.trim()).length > 280,
  )
  const approvedPinterestPosts = approvedPostsWithDates.filter(post => post.platform.toUpperCase() === 'PINTEREST')
  const pinterestAccount = scheduleAccounts.find(account => account.platform === 'PINTEREST')
  const pinterestAutoReviewIncomplete = scheduleMode === 'AUTO' && (
    approvedPinterestPosts.length > 0
    && (
      pinterestAccount?.accessTier !== 'STANDARD'
      || approvedPinterestPosts.some(post => {
        const options = pinterestOptionsByPostId[post.id]
        const copyLength = Array.from(post.caption.trim()).length
        return post.isVideoPost
          || copyLength === 0
          || copyLength > 800
          || !options?.boardId
          || !options.title.trim()
          || !options.altText.trim()
          || !options.aiDisclosureReviewed
      })
    )
  )
  const approvedThreadsPosts = approvedPostsWithDates.filter(post => post.platform.toUpperCase() === 'THREADS')
  const threadsAccount = scheduleAccounts.find(account => account.platform === 'THREADS')
  const threadsAutoReviewIncomplete = scheduleMode === 'AUTO' && (
    approvedThreadsPosts.length > 0
    && (
      threadsAccount?.accessTier !== 'LIVE'
      || approvedThreadsPosts.some(post => {
        const options = threadsOptionsByPostId[post.id]
        const copyLength = Array.from(post.caption.trim()).length
        return post.isVideoPost
          || copyLength === 0
          || copyLength > 500
          || !options?.altText.trim()
      })
    )
  )
  const autoTargetsMissingDestinations = scheduleMode === 'AUTO'
    ? approvedAutoTargets.filter(target => {
        const destination = destinationByTarget[target]
        if (!destination?.integrationId) return true
        return ['FACEBOOK', 'INSTAGRAM'].includes(target) && !destination.pageId
      })
    : []
  const autoDestinationReviewIncomplete = scheduleMode === 'AUTO'
    && (scheduleAccountsLoading || autoTargetsMissingDestinations.length > 0)
  const approvedPostsNeedingMedia = posts.filter(
    p => p.status === 'APPROVED' && !isContentPostMediaReadyForScheduling(p),
  )
  const approvedPostsNeedingMediaCount = approvedPostsNeedingMedia.length
  const approvedPostsNeedingMediaApproval = posts.filter(
    p => p.status === 'APPROVED'
      && isContentPostMediaReadyForScheduling(p)
      && !p.mediaApprovalSnapshotId,
  )
  const approvedPostsNeedingMediaApprovalCount = approvedPostsNeedingMediaApproval.length
  const weakMediaApprovalRisks = approvedPostsNeedingMediaApproval.flatMap(post => {
    if (!post.uploadedMediaId) return []
    const match = creativeIntelligence?.matchesByPostId[post.id]
      ?.find(candidate => candidate.mediaId === post.uploadedMediaId)
    return match && ['WEAK', 'REJECTED'].includes(match.verdict)
      ? [{ post, match }]
      : []
  })
  const packageWeakMediaApprovalRisks = draftPosts.flatMap(post => {
    if (!post.uploadedMediaId) return []
    const match = creativeIntelligence?.matchesByPostId[post.id]
      ?.find(candidate => candidate.mediaId === post.uploadedMediaId)
    return match && ['WEAK', 'REJECTED'].includes(match.verdict)
      ? [{ post, match }]
      : []
  })
  const reviewedPackageScheduleDates = draftPosts.map(post => {
    const inputValue = scheduleDateByPostId[post.id] ?? ''
    const iso = scheduleInputToIso(inputValue)
    return {
      post,
      inputValue,
      iso,
      time: iso ? new Date(iso).getTime() : Number.NaN,
    }
  })
  const packageScheduleDateIssues = reviewedPackageScheduleDates.filter(
    item => Number.isNaN(item.time) || item.time <= Date.now(),
  )
  const packageScheduleTimes = reviewedPackageScheduleDates
    .filter(item => !Number.isNaN(item.time))
    .map(item => item.time)
    .sort((a, b) => a - b)
  const packageScheduleRange = packageScheduleTimes.length > 0
    ? {
        first: new Date(packageScheduleTimes[0]).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        last: new Date(packageScheduleTimes[packageScheduleTimes.length - 1]).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }
    : null
  const mediaApprovalRequired = approvedCount > 0
    && approvedPostsNeedingMediaCount === 0
    && approvedPostsNeedingMediaApprovalCount > 0
  const schedulingBlockedByMedia = approvedPostsNeedingMediaCount > 0
    || approvedPostsNeedingMediaApprovalCount > 0
  const reviewedScheduleDates = approvedPosts.map(post => {
    const inputValue = scheduleDateByPostId[post.id] ?? toLocalScheduleInputValue(post.scheduledAt)
    const iso = scheduleInputToIso(inputValue)
    return {
      post,
      inputValue,
      iso,
      time: iso ? new Date(iso).getTime() : Number.NaN,
    }
  })
  const scheduleDateReviewIssues = reviewedScheduleDates.filter(
    item => Number.isNaN(item.time) || item.time <= Date.now(),
  )
  const approvedPostsMissingDates = reviewedScheduleDates.filter(item => Number.isNaN(item.time)).length
  const approvedScheduleDates = reviewedScheduleDates
    .filter(item => !Number.isNaN(item.time))
    .map(item => item.time)
    .sort((a, b) => a - b)
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
  const locallyComputedContentApprovalPreflight = useMemo(() => {
    const aiOutput = campaign?.aiOutput && typeof campaign.aiOutput === 'object'
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object'
      ? aiOutput.strategy
      : aiOutput
    return reviewContentPlanForApproval(
      contentReviewPosts,
      strategy,
      buildContentPlanTruthContext(brandProfile),
    )
  }, [brandProfile, campaign?.aiOutput, contentReviewPosts])
  const contentApprovalPreflight = useMemo(() => authoritativeContentQualityIssues === null
    ? locallyComputedContentApprovalPreflight
    : {
        ok: authoritativeContentQualityIssues.length === 0,
        issues: authoritativeContentQualityIssues,
      }, [authoritativeContentQualityIssues, locallyComputedContentApprovalPreflight])
  const approvalReviewSummary = useMemo(() => {
    const claimRisks = contentApprovalPreflight.issues.filter(issue => /unsupported|unverified|claim/i.test(issue.reason)).length
    const destinationRisks = contentApprovalPreflight.issues.filter(issue => /destination|conversion|cta/i.test(issue.reason)).length
    const alignmentRisks = Math.max(0, contentApprovalPreflight.issues.length - claimRisks - destinationRisks)
    return {
      reviewedDrafts: contentReviewPosts.filter(post => post.status === 'DRAFT').length,
      claimRisks,
      destinationRisks,
      alignmentRisks,
    }
  }, [contentApprovalPreflight.issues, contentReviewPosts])
  const contentIssuesByPostId = useMemo(() => {
    const issuesByPost = new Map<string, string[]>()
    for (const issue of contentApprovalPreflight.issues) {
      const post = contentReviewPosts[issue.index - 1]
      if (!post) continue
      issuesByPost.set(post.id, [...(issuesByPost.get(post.id) ?? []), issue.reason])
    }
    return issuesByPost
  }, [contentApprovalPreflight.issues, contentReviewPosts])
  const contentReviewRequired = contentReviewPosts.length > 0 && !contentApprovalPreflight.ok
  const approvalBlockedByTruthReview = draftCount > 0 && contentReviewRequired
  const schedulingBlockedByTruthReview = approvedCount > 0 && contentReviewRequired
  const schedulingBlocked = schedulingBlockedByMedia || schedulingBlockedByTruthReview
  const schedulingDecisionBlocked = schedulingBlocked
    || scheduleDateReviewIssues.length > 0
    || (scheduleMode === 'AUTO' && (
      autoDestinationReviewIncomplete
      || unsupportedAutoTargets.length > 0
      || youtubeAutoReviewIncomplete
      || xAutoReviewIncomplete
      || pinterestAutoReviewIncomplete
      || threadsAutoReviewIncomplete
    ))
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
    readyMediaCount: allMediaReadiness.confirmedReady,
    ambiguousPreviewCount: allMediaReadiness.ambiguousPreviewCount,
    videoPostCount,
    hasOrderMismatch: Boolean(contentPlanOrderMismatch),
    hasQualityMismatch: contentReviewRequired,
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
  const operatingState = deriveCampaignOperatingState({
    campaign,
    posts,
    contentQualityIssueCount: contentApprovalPreflight.issues.length,
    contentQualityPostCount: contentIssuesByPostId.size,
  })
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
    const readyMediaTotal = totalImagePosts + videoPostCount
    const readyMediaSummary = isAr
      ? `${allMediaReadiness.confirmedReady} من ${readyMediaTotal} وسائط جاهزة`
      : `${allMediaReadiness.confirmedReady} / ${readyMediaTotal} media ready`
    const mediaDemandSummary = isAr
      ? `الصور المطلوبة: ${totalImagePosts} · الفيديوهات المطلوبة: ${videoPostCount}`
      : `${totalImagePosts} image slots · ${videoPostCount} video slots`
    if (approvedOnlyCount) {
      if (contentReviewRequired) {
        const affectedPosts = contentIssuesByPostId.size
        return isAr
          ? `${approvedCount} سجلات اعتماد · ${affectedPosts} منشورات تحتاج إعادة فحص الجودة · ${mediaDemandSummary} · ${readyMediaSummary}`
          : `${approvedCount} approval records · ${affectedPosts} posts need a quality recheck · ${mediaDemandSummary} · ${readyMediaSummary}`
      }
      return isAr
        ? `${approvedCount} منشورات معتمدة بانتظار الجدولة · ${mediaDemandSummary} · ${readyMediaSummary}`
        : `${approvedCount} approved posts awaiting scheduling · ${mediaDemandSummary} · ${readyMediaSummary}`
    }
    if (scheduledOnlyCount) {
      return isAr
        ? `${scheduledCount} منشورات مجدولة — غير منشورة · ${mediaDemandSummary} · ${readyMediaSummary}`
        : `${scheduledCount} scheduled posts — not published · ${mediaDemandSummary} · ${readyMediaSummary}`
    }
    if (mixedScheduledManualPublishedCount) {
      return isAr
        ? `${manuallyPublishedCount} منشور تم تأكيد نشره يدويًا · ${scheduledCount} منشورات مجدولة — غير منشورة · ${mediaDemandSummary} · ${readyMediaSummary}`
        : `${manuallyPublishedCount} manually published post${manuallyPublishedCount === 1 ? '' : 's'} · ${scheduledCount} scheduled posts — not published · ${mediaDemandSummary} · ${readyMediaSummary}`
    }

    const stateSummary = isAr
      ? [
          draftCount > 0 ? `${draftCount} ${draftCount === 1 ? 'مسودة للمراجعة' : 'مسودات للمراجعة'}` : null,
          approvedCount > 0 ? `${approvedCount} ${approvedCount === 1 ? 'منشور معتمد' : 'منشورات معتمدة'}` : null,
          scheduledCount > 0 ? `${scheduledCount} ${scheduledCount === 1 ? 'منشور مجدول' : 'منشورات مجدولة'}` : null,
          publishedCount > 0 ? `${publishedCount} ${publishedCount === 1 ? 'منشور منشور' : 'منشورات منشورة'}` : null,
        ].filter(Boolean).join(' · ')
      : [
          draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? '' : 's'} for review` : null,
          approvedCount > 0 ? `${approvedCount} approved post${approvedCount === 1 ? '' : 's'}` : null,
          scheduledCount > 0 ? `${scheduledCount} scheduled post${scheduledCount === 1 ? '' : 's'}` : null,
          publishedCount > 0 ? `${publishedCount} published post${publishedCount === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ')

    return `${stateSummary} · ${mediaDemandSummary} · ${readyMediaSummary}`
  })()
  const contentStatusExplainer = mixedScheduledManualPublishedCount
    ? (isAr
      ? `تم تسجيل ${manuallyPublishedCount} منشور كمنشور يدويًا بواسطة المستخدم. بقية المنشورات مجدولة داخل NEXUS فقط وغير منشورة.`
      : `${manuallyPublishedCount} post${manuallyPublishedCount === 1 ? ' was' : 's were'} marked as manually published by the user. The remaining posts are scheduled in NEXUS only and are not published.`)
    : scheduledOnlyCount
    ? (isAr
      ? 'المحتوى مجدول فقط. النشر والوسائط والأوتوبايلوت ما زالت خطوات منفصلة.'
      : 'Content is scheduled only. Publishing, media generation, and Autopilot remain separate steps.')
    : approvedOnlyCount && contentReviewRequired
      ? (isAr
        ? 'الاعتماد السابق محفوظ في السجل، لكن ملاحظات الجودة أعادت فتح النصوص المتأثرة للمراجعة. لا جدولة ولا نشر حتى تعديلها وإعادة اعتمادها.'
        : 'The prior approval remains in the audit record, but quality findings reopened affected copy for review. Scheduling and publishing stay locked until it is edited and re-approved.')
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
  const videoGenerationTruth = getCreditActionTruth({
    action: 'VIDEO_GENERATION',
    creditsRemaining,
    isUnlimited,
  })
  const motionDesignTruth = getCreditActionTruth({
    action: 'MOTION_DESIGN_VIDEO',
    creditsRemaining,
    isUnlimited,
  })
  const contentPlanTruth = getCreditActionTruth({
    action: 'CONTENT_PLAN_GENERATION',
    creditsRemaining,
    isUnlimited,
  })
  const abVariantTruth = getCreditActionTruth({
    action: 'CONTENT_AB_VARIANTS',
    creditsRemaining,
    isUnlimited,
  })
  const mediaIntelligenceTruth = getCreditActionTruth({
    action: 'MEDIA_INTELLIGENCE_ANALYSIS',
    creditsRemaining,
    isUnlimited,
  })
  const imageGenerationLocked = !billingLoading && !imageGenerationTruth.canAfford
  const cinematicVideoLocked = !billingLoading && !videoGenerationTruth.canAfford
  const motionDesignLocked = !billingLoading && !motionDesignTruth.canAfford
  const videoGenerationLocked = cinematicVideoLocked && motionDesignLocked
  const mediaIntelligenceLocked = !billingLoading && !mediaIntelligenceTruth.canAfford
  const selectedContentPlanCost = contentPlanTruth.cost + (enableABTesting ? abVariantTruth.cost : 0)
  const contentPlanCanAfford = isUnlimited || creditsRemaining >= selectedContentPlanCost
  const contentPlanLocked = !billingLoading && !contentPlanCanAfford
  const strategyApprovalRequired = Boolean(campaign && !canMutateCampaignExecution(
    String(campaign.status ?? ''),
    campaign.aiOutput,
  ))
  const strategyApprovalRequiredLabel = campaign?.status === 'ACTIVE'
    ? (isAr ? 'أكمل مراجعة حقيقة الاستراتيجية أولاً' : 'Complete the strategy truth review first')
    : (isAr ? 'راجع واعتمد الاستراتيجية أولاً' : 'Review and approve strategy first')
  const imageGenerationBlockedByTruthReview = strategyApprovalRequired || contentReviewRequired
  const imageGenerationTruthReviewLabel = strategyApprovalRequired
    ? strategyApprovalRequiredLabel
    : (isAr ? 'صحّح النصوص قبل توليد الصور' : 'Fix copy before generating images')
  const addCreditsForImagesLabel = isAr ? 'أضف رصيداً لتوليد الصور' : 'Add credits to generate images'
  const addCreditsForVideoLabel = isAr ? 'أضف رصيداً لتوليد الفيديو' : 'Add credits to generate video'
  const contentPlanCostLabel = isAr
    ? `${selectedContentPlanCost} كريديت`
    : `${selectedContentPlanCost} credit${selectedContentPlanCost === 1 ? '' : 's'}`
  const contentPlanCostBreakdown = enableABTesting
    ? (isAr
      ? `خطة المحتوى ${contentPlanTruth.cost} + نسخ A/B الاختيارية ${abVariantTruth.cost}`
      : `Content plan ${contentPlanTruth.cost} + optional A/B variants ${abVariantTruth.cost}`)
    : (isAr
      ? `خطة المحتوى ${contentPlanTruth.cost}`
      : `Content plan ${contentPlanTruth.cost}`)
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
  const generatePlanFinalCta = isAr
    ? `تأكيد إنشاء المسودات — ${contentPlanCostLabel}`
    : `Confirm draft generation — ${contentPlanCostLabel}`
  const creditBalanceLabel = billingLoading
    ? (isAr ? 'جارٍ تحديث الرصيد' : 'Checking credit balance')
    : isUnlimited
      ? (isAr ? 'رصيد غير محدود' : 'Unlimited credits')
      : isAr
        ? `رصيدك الحالي: ${Math.max(0, Math.trunc(creditsRemaining))} كريديت`
        : `Current balance: ${Math.max(0, Math.trunc(creditsRemaining))} credits`
  const imageGenerationCapacity = billingStatus?.imageGenerationCapacity ?? null
  const imageDailyCapReached = Boolean(
    imageGenerationCapacity
    && imageGenerationCapacity.cap !== -1
    && imageGenerationCapacity.remaining <= 0,
  )
  const imageDailyCapacityLabel = imageGenerationCapacity
    ? imageGenerationCapacity.cap === -1
      ? (isAr ? 'سعة الصور اليومية غير محدودة في خطتك.' : 'Your plan has no daily image cap.')
      : isAr
        ? `سعة الصور اليوم: ${imageGenerationCapacity.remaining} متبقية من ${imageGenerationCapacity.cap}. المحاولات المرفوضة والمستردة لا تُحتسب.`
        : `Image capacity today: ${imageGenerationCapacity.remaining} of ${imageGenerationCapacity.cap} remaining. Rejected and refunded attempts do not count.`
    : (isAr ? 'يُتحقق من حد الصور اليومي قبل أي خصم.' : 'The daily image allowance is checked before any charge.')
  const imageDailyCapReachedLabel = isAr
    ? `اكتمل حد الصور اليومي في خطتك (${imageGenerationCapacity?.cap ?? 0}/يوم). يعود غدًا، ولم يُخصم رصيد للمحاولة الموقوفة.`
    : `Your plan's daily image limit is complete (${imageGenerationCapacity?.cap ?? 0}/day). It resets tomorrow, and the blocked attempt was not charged.`
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
    if (approvedPostsNeedingMediaCount > 0 || allMediaReadiness.needsAttentionCount > 0) {
      return {
        eyebrow: isAr ? 'قرار وسائط' : 'Media decision',
        title: isAr
          ? `أكمل وسائط ${approvedPostsNeedingMediaCount || allMediaReadiness.needsAttentionCount} منشورات قبل الجدولة`
          : `Complete media for ${approvedPostsNeedingMediaCount || allMediaReadiness.needsAttentionCount} post${(approvedPostsNeedingMediaCount || allMediaReadiness.needsAttentionCount) === 1 ? '' : 's'} before scheduling`,
        body: isAr
          ? 'لم تصبح هذه المنشورات جاهزة للجدولة. ولّد أو اربط الوسائط النهائية، ثم راجع قرار الوسائط صراحةً.'
          : 'These posts are not ready to schedule. Generate or attach final media, then explicitly review the media decision.',
        label: isAr ? 'راجع خانات الوسائط' : 'Review media slots',
        onClick: () => document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      }
    }
    if (approvedPostsNeedingMediaApprovalCount > 0) {
      return {
        eyebrow: isAr ? 'مراجعة الوسائط' : 'Media review',
        title: isAr ? 'راجع واعتمد الوسائط النهائية قبل الجدولة' : 'Review and approve final media before scheduling',
        body: isAr
          ? 'الوسائط مرتبطة وجاهزة، لكن قرار اعتمادها لم يُحفظ بعد.'
          : 'Media is attached and ready, but its explicit approval decision has not been saved yet.',
        label: isAr ? 'راجع اعتماد الوسائط' : 'Review media approval',
        onClick: openMediaApprovalConfirm,
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
      value: isAr
        ? `${Math.max(0, posts.length - draftCount)} من ${posts.length}`
        : posts.length ? `${Math.max(0, posts.length - draftCount)} / ${posts.length}` : '0 / 0',
      helper: isAr ? 'المسودات تراجع هنا؛ الكتابة والتحسين لا ينشران تلقائياً.' : 'Drafts are reviewed here; copy edits never publish automatically.',
      tone: 'text-[#5E63FF] bg-[#F2F4FF] border-[#DDE2FF]',
    },
    {
      label: isAr ? 'جاهزية الوسائط' : 'Media readiness',
      value: isAr ? `${allMediaReadiness.confirmedReady} من ${allMediaReadiness.total}` : `${allMediaReadiness.confirmedReady} / ${allMediaReadiness.total}`,
      helper: isAr ? 'الأصول النهائية تأتي من الاستوديو أو مكتبة الوسائط ثم تُربط هنا.' : 'Final assets come from Studio or Media Library, then attach here.',
      tone: allMediaReadiness.confirmedReady >= allMediaReadiness.total && allMediaReadiness.total > 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200',
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
  const videoGenerationConfirmPost = videoGenerationConfirmPostId
    ? posts.find(p => p.id === videoGenerationConfirmPostId)
    : null
  const mediaPickerPost = mediaPickerOpen
    ? posts.find(p => p.id === mediaPickerOpen)
    : null
  const mediaPickerItems = mediaLibrary.filter(media => mediaPickerPost?.isVideoPost
    ? ['video', 'VIDEO'].includes(media.type)
    : ['image', 'IMAGE', 'logo', 'LOGO'].includes(media.type))
  const videoReferenceImages = Array.from(new Map([
    ...mediaLibrary,
    ...Object.values(creativeIntelligence?.assetsById ?? {}),
  ].filter(media => ['image', 'IMAGE'].includes(media.type)).map(media => [media.id, media])).values()).slice(0, 8)
  const selectedVideoReferenceMedia = videoReferenceMediaIds
    .map(id => videoReferenceImages.find(media => media.id === id))
    .filter((media): media is CreativeMediaCandidate => Boolean(media))
  const cinematicVideoPreflight = assessCinematicProductAdAssets(selectedVideoReferenceMedia)
  const propertyPhotoFilmPreflight = assessPropertyPhotoFilmAssets(selectedVideoReferenceMedia)
  const canStartCinematicVideo = cinematicVideoPreflight.eligible
    && videoGenerationAcknowledged
    && videoAssetRightsAcknowledged
    && !cinematicVideoLocked
  const canStartPropertyPhotoFilm = propertyPhotoFilmPreflight.eligible
    && videoGenerationAcknowledged
    && videoAssetRightsAcknowledged
    && videoSamePropertyAcknowledged
    && !motionDesignLocked
  const canStartCampaignFilm = videoGenerationAcknowledged
    && videoAssetRightsAcknowledged
    && !cinematicVideoLocked
  const motionDesignVideos = mediaLibrary.filter(media => (
    String(media.type).toUpperCase() === 'VIDEO'
    && !/motion[-_ ]design|source[-_ ]locked/i.test([media.category || '', ...(media.tags || [])].join(' '))
  )).slice(0, 8)
  const motionDesignSource = motionDesignSourceMediaId
    ? motionDesignVideos.find(media => media.id === motionDesignSourceMediaId) ?? null
    : null
  const motionDesignPreflight = assessMotionDesignVideoAsset(
    motionDesignSource,
    videoGenerationConfirmPost?.caption,
  )
  const canStartMotionDesign = motionDesignPreflight.eligible
    && videoGenerationAcknowledged
    && videoAssetRightsAcknowledged
    && !motionDesignLocked
  const canStartSelectedVideoRoute = videoProductionMode === 'PHOTO_FILM'
    ? canStartPropertyPhotoFilm
    : videoProductionMode === 'MOTION_DESIGN'
      ? canStartMotionDesign
      : videoProductionMode === 'CAMPAIGN_FILM'
        ? canStartCampaignFilm
        : canStartCinematicVideo
  const videoPreflightIssueCopy = (issue: { code: string; message: string }) => {
    if (!isAr) return issue.message
    const messages: Record<string, string> = {
      REFERENCE_COUNT: `اختر ${CINEMATIC_PRODUCT_AD_MIN_REFERENCES}–${CINEMATIC_PRODUCT_AD_MAX_REFERENCES} صور محللة لنفس المنتج من زوايا مختلفة.`,
      DUPLICATE_REFERENCE: 'كل زاوية يجب أن تكون أصلًا مختلفًا.',
      IMAGE_REQUIRED: 'المسار السينمائي يقبل صور منتج ثابتة فقط.',
      ANALYSIS_REQUIRED: 'حلّل الأصل أولًا عبر ذكاء الوسائط قبل دفع تكلفة الفيديو.',
      PRODUCT_REFERENCE_REQUIRED: 'هذا الأصل ليس صورة منتج مؤهلة؛ صور الواجهات والشعارات تحتاج Motion Design يحافظ على المصدر.',
      RESOLUTION_REQUIRED: 'الدقة غير كافية: الحد الأدنى 720px للضلع القصير و1024px للضلع الطويل.',
      QUALITY_TOO_LOW: 'جودة الأصل غير مؤهلة: يلزم 70/100 على الأقل قبل إنتاج الفيديو المدفوع. لن يبدأ أي إنفاق.',
      LANGUAGE_MISMATCH: 'لغة الفيديو لا تطابق لغة نص المنشور؛ لائم النص أو اختر أصلًا بنفس اللغة قبل الإنتاج المدفوع.',
      SUPPORTED_SOURCE_REQUIRED: 'اختر فيديو أصليًا محللًا يُظهر المنتج أو العبوة أو الديمو أو تسجيل الشاشة بوضوح.',
      UNSAFE_SOURCE_GRAPHICS: 'الأصل يحتوي رسومات أو نصوصًا مركبة تجعل التوليد السينمائي غير موثوق.',
      CREATOR_REFERENCE_UNSUPPORTED: 'تظهر شخصية أو عارضة في الصورة. للحفاظ على المنتج استخدم صورًا معزولة للمنتج من زوايا واضحة، أو ارفع فيديو حقيقيًا تملك حق استخدامه لمسار Motion Design.',
      PRODUCT_IDENTITY_MISMATCH: 'لا يستطيع NEXUS تأكيد أن الصور لنفس المنتج؛ اختر زوايا أوضح ومتسقة.',
    }
    return messages[issue.code] || 'هذا الأصل لم يجتز فحص الفيديو المدفوع.'
  }
  const imageReferenceMedia = imageReferenceMediaId
    ? mediaLibrary.find(media => media.id === imageReferenceMediaId)
      ?? creativeIntelligence?.assetsById[imageReferenceMediaId]
      ?? null
    : null
  const imageGenerationReopensReview = Boolean(
    imageGenerationConfirmPost && ['APPROVED', 'SCHEDULED', 'FAILED'].includes(imageGenerationConfirmPost.status),
  )
  const bulkImageButtonLabel = isAr
    ? `توليد ${pendingImageCount} صور منشورات — ${bulkImageCreditCost} كريديت`
    : `Generate ${pendingImageCount} post images — ${bulkImageCreditCost} credits total`
  const approveDraftsLabel = draftMediaDecisionCount > 0
    ? (isAr
        ? `أكمل وسائط ${draftMediaDecisionCount} منشورات أولاً`
        : `Complete media for ${draftMediaDecisionCount} post${draftMediaDecisionCount === 1 ? '' : 's'} first`)
    : (isAr
        ? `اعتمد الحزمة وسجّل جدول ${draftCount} منشورات`
        : `Approve package and schedule ${draftCount} post${draftCount === 1 ? '' : 's'}`)
  const scheduleApprovedLabel = isAr
    ? schedulingBlockedByTruthReview
      ? 'راجع جودة النصوص قبل الجدولة'
      : approvedPostsNeedingMediaCount > 0
        ? `أكمل وسائط ${approvedPostsNeedingMediaCount} منشورات قبل الجدولة`
        : approvedPostsNeedingMediaApprovalCount > 0
          ? `اعتماد الوسائط النهائية لـ ${approvedPostsNeedingMediaApprovalCount} منشورات`
        : `جدولة ${approvedCount} منشورات معتمدة`
    : schedulingBlockedByTruthReview
      ? 'Review copy quality before scheduling'
      : approvedPostsNeedingMediaCount > 0
        ? `Complete media for ${approvedPostsNeedingMediaCount} post${approvedPostsNeedingMediaCount === 1 ? '' : 's'} before scheduling`
        : approvedPostsNeedingMediaApprovalCount > 0
          ? `Approve final media for ${approvedPostsNeedingMediaApprovalCount} post${approvedPostsNeedingMediaApprovalCount === 1 ? '' : 's'}`
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
  const rewriteCostLabel = isAr
    ? `${CONTENT_HUB_REWRITE_COST} كريديت`
    : `${CONTENT_HUB_REWRITE_COST} credit${CONTENT_HUB_REWRITE_COST === 1 ? '' : 's'}`

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
      const generationPayload = {
        mediaSource,
        enableABTesting,
        ...(handoff?.language ? { language: handoff.language } : {}),
        ...(handoff && Array.isArray(handoff.selectedMediaIds)
          ? { selectedMediaIds: handoff.selectedMediaIds }
          : {}),
      }
      const res = await fetchCreditOperation(creditOperationScope('campaign:content-plan', JSON.stringify({ campaignId, ...generationPayload })), `/api/campaigns/${campaignId}/generate-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(generationPayload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      // PR-1J.2: summary.total = base posts; A/B variants are added on top. Show the
      // honest math (base + variants = drafts) so "18" and "36" never look contradictory.
      // "drafts to review" — not "ready for review" — since they still need approval.
      const bVariants = data.summary?.abTesting?.enabled ? (data.summary.abTesting.bVariants ?? 0) : 0
      const abRefunded = data.summary?.abTesting?.refunded === true
      const totalDrafts = (data.summary?.total ?? 0) + bVariants
      setSuccessMsg(
        bVariants > 0
          ? `Content plan created: ${data.summary.total} base posts + ${bVariants} A/B variants = ${totalDrafts} drafts to review`
          : abRefunded
            ? `Content plan created: ${data.summary.total} drafts to review. A/B variants were not saved, so their separate credit charge was refunded.`
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

  async function savePostEdit(postId: string, updates: Partial<ContentPost> & Record<string, unknown>): Promise<boolean> {
    if (!isAuthenticated) return false
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
      // The API recomputes the authoritative content-quality review and may
      // reopen approval snapshots. Re-read that source of truth immediately;
      // otherwise old issue badges remain visible after a valid correction or
      // disappear optimistically before the server has actually accepted it.
      await loadData()
      return true
    } catch (err: any) {
      console.error('Failed to save edit', err)
      setError(err.message ?? 'Failed to save post edit')
      return false
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
    if (!pendingMediaAttachment || !mediaAttachmentAcknowledged || mediaAttachmentSaving) return
    const { postId, media, action } = pendingMediaAttachment
    setMediaAttachmentSaving(true)
    setError(null)
    try {
      const saved = await savePostEdit(postId, media.assetKind === 'GENERATED_VISUAL' && media.generatedVisualId
        ? {
            generatedVisualId: media.generatedVisualId,
            explicitGeneratedMediaAttachConfirmed: true,
          }
        : {
            uploadedMediaId: media.id,
            ...(action === 'replace'
              ? { explicitMediaReplaceConfirmed: true }
              : { explicitMediaAttachConfirmed: true }),
          })
      if (!saved) return
      setPendingMediaAttachment(null)
      setMediaAttachmentAcknowledged(false)
      setSuccessMsg(isAr
        ? 'تم ربط الأصل بالمنشور وحفظه. ما زال اعتماد الوسائط النهائي خطوة منفصلة قبل الجدولة.'
        : 'The asset was attached and saved. Final media approval remains a separate step before scheduling.')
    } finally {
      setMediaAttachmentSaving(false)
    }
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
    if (mediaAttachmentSaving) return
    setPendingMediaAttachment(null)
    setMediaAttachmentAcknowledged(false)
  }

  function closeMediaRemovalConfirm() {
    setMediaRemovalPostId(null)
    setMediaRemovalAcknowledged(false)
  }

  // ── NEXUS Creative Intelligence ────────────────────────────────────────────

  function openCreativeScanConfirm() {
    const batchSize = creativeIntelligence?.summary.batchSize ?? 0
    if (batchSize < 1) {
      if ((creativeIntelligence?.summary.totalAssets ?? 0) < 1) router.push('/media')
      else setError(isAr ? 'لا توجد أصول جديدة قابلة للتحليل الآن.' : 'No new previewable assets need analysis right now.')
      return
    }
    if (mediaIntelligenceLocked) {
      router.push('/billing')
      return
    }
    setCreativeScanAcknowledged(false)
    setShowCreativeScanConfirm(true)
  }

  function closeCreativeScanConfirm() {
    if (creativeScanning) return
    setShowCreativeScanConfirm(false)
    setCreativeScanAcknowledged(false)
  }

  async function confirmCreativeScan() {
    const batchSize = creativeIntelligence?.summary.batchSize ?? 0
    if (!creativeScanAcknowledged || batchSize < 1 || creativeScanning) return
    setCreativeScanning(true)
    setError(null)
    try {
      const response = await fetchCreditOperation(
        creditOperationScope('campaign:creative-intelligence', JSON.stringify({ campaignId, batchSize })),
        `/api/campaigns/${campaignId}/creative-intelligence`,
        {
          method: 'POST',
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale,
            explicitAnalysisConfirmed: true,
            acknowledgedCreditCost: CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
            acknowledgedAssetCount: batchSize,
            acknowledgedNoAutomaticChanges: true,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Creative Intelligence could not analyze the media')
      if (data.payload) setCreativeIntelligence(data.payload)
      setSuccessMsg(isAr
        ? `تم تحليل ${data.analyzedAssets ?? batchSize} أصول وترتيب أفضل تطابق لكل بوست. لم يتم إرفاق أو تعديل أو نشر أي شيء.`
        : `${data.analyzedAssets ?? batchSize} assets analyzed and ranked against the posts. Nothing was attached, changed, or published.`)
      setShowCreativeScanConfirm(false)
      setCreativeScanAcknowledged(false)
      await loadData()
      await refreshBillingStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creative Intelligence failed')
      await refreshBillingStatus()
    } finally {
      setCreativeScanning(false)
    }
  }

  function requestCreativeAdaptation(postId: string, match: CreativeMediaMatch, media: CreativeMediaCandidate) {
    if (!getCreditActionTruth({ action: 'AI_POST_REWRITE', creditsRemaining, isUnlimited }).canAfford) {
      router.push('/billing')
      return
    }
    setCreativeAdaptation({ postId, match, media })
    setCreativeAdaptationAcknowledged(false)
  }

  function closeCreativeAdaptation() {
    if (adaptingCreativePostId) return
    setCreativeAdaptation(null)
    setCreativeAdaptationAcknowledged(false)
  }

  async function confirmCreativeAdaptation() {
    if (!creativeAdaptation || !creativeAdaptationAcknowledged || adaptingCreativePostId) return
    const { postId, media } = creativeAdaptation
    setAdaptingCreativePostId(postId)
    setError(null)
    try {
      const response = await fetchCreditOperation(
        creditOperationScope('campaign:creative-copy-adaptation', JSON.stringify({ campaignId, postId, mediaId: media.id })),
        `/api/campaigns/${campaignId}/creative-intelligence/adapt`,
        {
          method: 'POST',
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
            mediaId: media.id,
            locale,
            explicitAdaptationConfirmed: true,
            acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST,
            acknowledgedReopensReview: true,
            acknowledgedNoPublishOrSchedule: true,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'NEXUS could not adapt the copy')
      setCreativeAdaptation(null)
      setCreativeAdaptationAcknowledged(false)
      setSuccessMsg(isAr
        ? 'تمت ملاءمة النص مع الأصل الحقيقي وحفظهما كمسودة جديدة للمراجعة. لم تتم الجدولة أو النشر.'
        : 'The copy was adapted to the real asset and saved as a new review draft. Nothing was scheduled or published.')
      await Promise.all([loadData(), refreshBillingStatus()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NEXUS could not adapt the copy')
      await refreshBillingStatus()
    } finally {
      setAdaptingCreativePostId(null)
    }
  }

  function generateFromCreativeReference(post: ContentPost, media: CreativeMediaCandidate) {
    const mediaType = String(media.type).toUpperCase()
    if (post.isVideoPost) {
      if (mediaType !== 'IMAGE') {
        setError(isAr ? 'اختر صور منتج حقيقية؛ الشعارات والواجهات تحتاج مسار Motion Design ولا تُرسل للتوليد السينمائي.' : 'Choose real product photos; logos and interfaces require source-locked Motion Design and are not sent to cinematic generation.')
        return
      }
      openVideoGenerationConfirm(post.id, media.id)
      return
    }
    if (!['IMAGE', 'LOGO'].includes(mediaType)) return
    openImageGenerationConfirm(post.id, media.id)
  }

  // ── Bulk generate images ─────────────────────────────────────────────────────

  async function generateAllImages() {
    if (!isAuthenticated) return
    if (imageGenerationBlockedByTruthReview) {
      setError(imageGenerationTruthReviewLabel)
      return
    }
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    if (imageDailyCapReached) {
      setError(imageDailyCapReachedLabel)
      return
    }
    const imagePostIds = pendingImagePosts.map(p => p.id)
    setGenerating(true)
    setError(null)
    setSuccessMsg(null)
    setBulkImageResult(null)
    let attempted = 0
    let generated = 0
    let failed = 0
    let refundPending = 0
    let creditsUsed = 0
    let creditReceiptsComplete = true
    let stoppedReason: string | null = null
    try {
      // The user confirms the whole action once, while the server processes one
      // paid image per request so a slow provider can never strand a batch.
      for (let index = 0; index < imagePostIds.length; index += 1) {
        const batchIds = imagePostIds.slice(index, index + 1)
        attempted += batchIds.length
        try {
          const res = await fetchCreditOperation(`campaign:image:${campaignId}:${batchIds[0]}`, `/api/campaigns/${campaignId}/generate-content-plan/generate`, {
            method: 'POST',
            headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postIds: batchIds,
              explicitBulkImageGenerationConfirmed: true,
              acknowledgedImageCount: batchIds.length,
              acknowledgedCreditCost: getBulkImageGenerationCost(batchIds.length),
              language: isAr ? 'ar' : 'en',
            }),
          })
          const data = await res.json().catch(() => ({}))
          const requestGenerated = Number.isFinite(data.generated) ? Math.max(0, Math.trunc(data.generated)) : 0
          const requestFailed = Number.isFinite(data.failed) ? Math.max(0, Math.trunc(data.failed)) : 0
          const requestRefundPending = Number.isFinite(data.refundPending)
            ? Math.max(0, Math.trunc(data.refundPending))
            : 0
          const charges = Array.isArray(data.creditCharges) ? data.creditCharges : []
          const receiptCredits = charges.reduce(
            (sum: number, charge: { creditsUsed?: unknown }) =>
              sum + (typeof charge?.creditsUsed === 'number' && Number.isFinite(charge.creditsUsed)
                ? Math.max(0, Math.trunc(charge.creditsUsed))
                : 0),
            0,
          )

          generated += requestGenerated
          failed += requestFailed
          refundPending += requestRefundPending
          creditsUsed += receiptCredits
          if (charges.length < requestGenerated) creditReceiptsComplete = false

          if (!res.ok || requestRefundPending > 0) {
            stoppedReason = data.message ?? data.error ?? (isAr ? 'تعذر إكمال توليد الصور بأمان.' : 'Image generation could not finish safely.')
            break
          }
        } catch (requestError: any) {
          stoppedReason = requestError?.message ?? (isAr ? 'تعذر الاتصال بخدمة توليد الصور.' : 'Could not reach image generation.')
          break
        }
      }
      setBulkImageResult(summarizeBulkImageGenerationOutcome({
        requested: imagePostIds.length,
        attempted,
        generated,
        failed,
        refundPending,
        creditsUsed: creditReceiptsComplete ? creditsUsed : null,
        stoppedReason,
      }, isAr ? 'ar' : 'en'))
      await loadData()
      await refreshBillingStatus()
    } finally {
      setGenerating(false)
    }
  }

  function openBulkImageConfirm() {
    if (imageGenerationBlockedByTruthReview) {
      setError(imageGenerationTruthReviewLabel)
      return
    }
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

  // ── Approve the complete review package → internal manual schedule ───────────

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
    if (draftMediaDecisionCount > 0) {
      setError(isAr
        ? `أكمل وسائط ${draftMediaDecisionCount} منشورات قبل اعتماد الحزمة. لم يُحفظ أي قرار.`
        : `Complete media for ${draftMediaDecisionCount} post${draftMediaDecisionCount === 1 ? '' : 's'} before package approval. No decision was saved.`)
      setShowApproveConfirm(false)
      document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (packageScheduleDateIssues.length > 0) {
      setError(isAr
        ? 'راجع تاريخ ووقت كل منشور داخل الحزمة. يجب أن تكون كل المواعيد صالحة وفي المستقبل.'
        : 'Review every post date and time in the package. Every date must be valid and in the future.')
      return
    }
    if (packageWeakMediaApprovalRisks.length > 0 && !weakMediaApprovalAcknowledged) return

    const reviewedScheduleByPostId = Object.fromEntries(
      reviewedPackageScheduleDates.map(item => [item.post.id, item.iso!]),
    )
    setApproving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const commandIdentity = JSON.stringify({
        campaignId,
        posts: draftPosts.map(post => ({
          id: post.id,
          caption: post.caption,
          imageUrl: post.imageUrl,
          scheduledAt: reviewedScheduleByPostId[post.id],
        })),
      })
      const res = await fetchCreditOperation(
        creditOperationScope('campaign:content-package-approval', commandIdentity),
        `/api/campaigns/${campaignId}/approve-content-package`,
        {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: {
            authorized: true,
            publishMode: 'MANUAL',
            scheduledAtByPostId: reviewedScheduleByPostId,
            explicitWeakMediaApprovalConfirmed:
              packageWeakMediaApprovalRisks.length > 0 && weakMediaApprovalAcknowledged,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const freshPosts = (data.contentApprovalRecorded || data.mediaApprovalRecorded)
          ? await loadData()
          : posts
        const scheduledAfterRecovery = freshPosts.filter(
          post => post.status === 'SCHEDULED' && hasValidDate(post.scheduledAt),
        )
        const scheduledAfterRecoveryIds = new Set(scheduledAfterRecovery.map(post => post.id))
        if (
          draftPosts.length > 0
          && draftPosts.every(post => scheduledAfterRecoveryIds.has(post.id))
        ) {
          setShowApproveConfirm(false)
          setWeakMediaApprovalAcknowledged(false)
          setSuccessMsg(isAr
            ? 'تم حفظ اعتماد الحزمة والجدول الداخلي. انقطع رد المتصفح ثم تحقق NEXUS من الحالة المحفوظة. لم يتم النشر أو الإنفاق.'
            : 'Package approval and the internal schedule were saved. The browser response was interrupted, then NEXUS verified the saved state. Nothing was published or spent.')
          return
        }
        const partialMessage = data.failedStage === 'MEDIA_APPROVAL'
          ? (isAr
              ? 'تم حفظ اعتماد النصوص، لكن قرار الوسائط يحتاج مراجعة. لم تُسجّل الجدولة ولم يتم النشر أو الإنفاق.'
              : 'Copy approval was saved, but media needs review. No schedule, publishing, or spend was recorded.')
          : data.failedStage === 'SCHEDULE'
            ? (isAr
                ? 'تم حفظ اعتماد النصوص والوسائط، لكن الجدول يحتاج مراجعة. لم يتم النشر أو الإنفاق.'
                : 'Copy and media approvals were saved, but the schedule needs review. Nothing was published or spent.')
            : ''
        if (partialMessage) {
          setShowApproveConfirm(false)
          setWeakMediaApprovalAcknowledged(false)
        }
        throw new Error(partialMessage || data.message || data.error || (isAr
          ? 'تعذّر اعتماد الحزمة. لم يتم النشر أو الإنفاق.'
          : 'Package approval failed. Nothing was published or spent.'))
      }

      const freshPosts = await loadData()
      const scheduledPosts = freshPosts.filter(
        post => post.status === 'SCHEDULED' && hasValidDate(post.scheduledAt),
      )
      const scheduledDates = scheduledPosts.map(post => post.scheduledAt!).sort()
      const platformsUsed = [...new Set(scheduledPosts.map(post => post.platform.toUpperCase()))]

      setApproveResult({
        kind: 'scheduled',
        approved: data.scheduled ?? scheduledPosts.length,
        linked: 0,
        unlinked: 0,
        signals: { hooks: 0, angles: 0 },
        platforms: platformsUsed,
        firstDate: scheduledDates[0] ?? null,
        lastDate:  scheduledDates[scheduledDates.length - 1] ?? null,
        pendingMedia: 0,
        totalMedia: scheduledPosts.length,
        pendingImages: 0,
        totalImages: scheduledPosts.filter(post => !post.isVideoPost).length,
        videoSlots: scheduledPosts.filter(post => post.isVideoPost).length,
      })
      setShowApproveConfirm(false)
      setWeakMediaApprovalAcknowledged(false)
      setSuccessMsg(isAr
        ? 'تم اعتماد النصوص والوسائط وتسجيل الجدول الداخلي. لم يُنشر شيء ولم يُمنح إذن إنفاق.'
        : 'Copy and media were approved and the internal schedule was recorded. Nothing was published and no spend was authorized.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(false)
    }
  }

  // ── Approve final media (separate from copy and scheduling) ─────────────────

  function openMediaApprovalConfirm() {
    setError(null)
    setWeakMediaApprovalAcknowledged(false)
    setShowMediaApproveConfirm(true)
  }

  function closeMediaApprovalConfirm() {
    if (mediaApproving) return
    setShowMediaApproveConfirm(false)
    setWeakMediaApprovalAcknowledged(false)
  }

  async function approveMedia() {
    if (!isAuthenticated || mediaApproving) return
    if (weakMediaApprovalRisks.length > 0 && !weakMediaApprovalAcknowledged) return
    setMediaApproving(true)
    setError(null)
    const successMessage = (approved: number, responseRecovered = false) => isAr
      ? responseRecovered
        ? `تم حفظ اعتماد الوسائط النهائية لـ ${approved} منشورات. انقطع رد المتصفح، ثم تحقّق NEXUS من القرار المحفوظ. لم تتم الجدولة أو النشر.`
        : `تم اعتماد الوسائط النهائية لـ ${approved} منشورات. لم تتم الجدولة أو النشر.`
      : responseRecovered
        ? `Final media approval was saved for ${approved} posts. The browser response was interrupted, then NEXUS verified the saved decision. Nothing was scheduled or published.`
        : `Final media approved for ${approved} posts. Nothing was scheduled or published.`
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/approve-media-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          explicitWeakMediaApprovalConfirmed: weakMediaApprovalRisks.length > 0
            && weakMediaApprovalAcknowledged,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? (isAr ? 'تعذّر اعتماد الوسائط النهائية.' : 'Media approval failed.'))
      }

      // The mutation is already committed at this point. A refresh failure must
      // not turn a saved approval into a false red failure message.
      const approved = data.unchanged
        ? approvedCount
        : (data.approved ?? approvedPostsNeedingMediaApprovalCount)
      setSuccessMsg(data.unchanged
        ? (isAr ? 'الوسائط الحالية معتمدة بالفعل. لم تتم الجدولة أو النشر.' : 'The current media is already approved. Nothing was scheduled or published.')
        : successMessage(approved))
      setShowMediaApproveConfirm(false)
      setWeakMediaApprovalAcknowledged(false)
      await loadData()
    } catch (err: any) {
      // A network response can be lost after the server commits the immutable
      // snapshot. Re-read the source of truth before telling the user it failed.
      const freshPosts = await loadData()
      const copyApprovedPosts = freshPosts.filter(post => post.status === 'APPROVED')
      const reconciled = copyApprovedPosts.length > 0
        && copyApprovedPosts.every(post => Boolean(post.mediaApprovalSnapshotId))
      if (reconciled) {
        setError(null)
        setShowMediaApproveConfirm(false)
        setWeakMediaApprovalAcknowledged(false)
        setSuccessMsg(successMessage(copyApprovedPosts.length, true))
      } else {
        setError(err?.message === 'Failed to fetch'
          ? (isAr
              ? 'تعذّر تأكيد اعتماد الوسائط بسبب انقطاع الاتصال. لم يعتبر NEXUS القرار ناجحًا؛ أعد المحاولة.'
              : 'Media approval could not be confirmed because the connection was interrupted. NEXUS did not mark the decision as successful; retry.')
          : (err?.message ?? (isAr ? 'تعذّر اعتماد الوسائط النهائية.' : 'Media approval failed.')))
      }
    } finally {
      setMediaApproving(false)
    }
  }

  // ── Schedule approved posts → SCHEDULED (separate decision from approval) ──────

  async function scheduleAll() {
    if (!isAuthenticated || !scheduleAcknowledged) return
    const reviewedScheduleByPostId: Record<string, string> = {}
    for (const post of approvedPosts) {
      const inputValue = scheduleDateByPostId[post.id] ?? toLocalScheduleInputValue(post.scheduledAt)
      const iso = scheduleInputToIso(inputValue)
      if (!iso || new Date(iso).getTime() <= Date.now()) {
        setError(isAr
          ? 'راجع تاريخ ووقت كل منشور. لا يمكن إدخال موعد ماضٍ أو غير صالح إلى جدول التنفيذ.'
          : 'Review every post date and time. A past or invalid date cannot enter the execution schedule.')
        return
      }
      reviewedScheduleByPostId[post.id] = iso
    }
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
        ? approvedPostsNeedingMediaCount > 0
          ? `أكمل وسائط ${approvedPostsNeedingMediaCount} منشورات قبل الجدولة.`
          : `اعتمد الوسائط النهائية لـ ${approvedPostsNeedingMediaApprovalCount} منشورات قبل الجدولة.`
        : approvedPostsNeedingMediaCount > 0
          ? `Complete media for ${approvedPostsNeedingMediaCount} post${approvedPostsNeedingMediaCount === 1 ? '' : 's'} before scheduling.`
          : `Approve final media for ${approvedPostsNeedingMediaApprovalCount} post${approvedPostsNeedingMediaApprovalCount === 1 ? '' : 's'} before scheduling.`)
      document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (scheduleMode === 'AUTO' && (autoDestinationReviewIncomplete || unsupportedAutoTargets.length > 0 || youtubeAutoReviewIncomplete || xAutoReviewIncomplete || pinterestAutoReviewIncomplete || threadsAutoReviewIncomplete)) {
      setError(isAr
        ? 'اربط كل منصة واختر وجهة النشر الدقيقة، ثم أكمل إعدادات المنصة وراجع حدود النص والوسائط، أو استخدم التنفيذ اليدوي.'
        : 'Connect every platform and choose its exact publishing destination, then complete platform settings and review copy/media limits, or use manual execution.')
      return
    }
    setScheduling(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/schedule-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode: scheduleMode,
          explicitAutoPublishConfirmed: scheduleMode === 'AUTO' && scheduleAcknowledged,
          scheduledAtByPostId: reviewedScheduleByPostId,
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
          pinterestOptionsByPostId: Object.fromEntries(
            Object.entries(pinterestOptionsByPostId).map(([postId, options]) => [postId, {
              boardId: options.boardId,
              title: options.title.trim(),
              altText: options.altText.trim(),
              destinationLink: options.destinationLink.trim() || null,
              aiDisclosureReviewed: options.aiDisclosureReviewed,
              aiDisclosureValues: [
                ...(options.aiModified ? ['AI_MODIFIED'] : []),
                ...(options.syntheticPerformer ? ['SYNTHETIC_PERFORMER'] : []),
              ],
            }]),
          ),
          threadsOptionsByPostId: Object.fromEntries(
            Object.entries(threadsOptionsByPostId).map(([postId, options]) => [postId, {
              replyControl: options.replyControl,
              altText: options.altText.trim(),
            }]),
          ),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const blockerTargets = Array.isArray(data.blockers)
          ? Array.from(new Set(data.blockers
              .map((blocker: { target?: unknown }) => typeof blocker?.target === 'string' ? blocker.target : '')
              .filter(Boolean)))
          : []
        const blockerMessage = Array.isArray(data.blockers)
          ? isAr
            ? `تعذّر إنشاء جدول النشر التلقائي. أكمل الربط والصلاحيات والوجهة الدقيقة لـ ${blockerTargets.join('، ') || 'كل المنصات المطلوبة'}. لم تتم جدولة أي منشور.`
            : data.blockers.map((blocker: { message?: unknown }) => typeof blocker?.message === 'string' ? blocker.message : '').filter(Boolean).join(' ')
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
        pendingMedia: 0,
        totalMedia: scheduledPosts.length,
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
    const rewritten = await rewritePost(rewriteConfirm.postId, rewriteConfirm.instruction)
    if (!rewritten) return
    setRewriteConfirm(null)
    setRewriteAcknowledged(false)
  }

  async function rewritePost(postId: string, instruction: string): Promise<boolean> {
    if (!isAuthenticated) return false
    setRewritingPost(postId)
    setError(null)
    try {
      const res = await fetchCreditOperation(creditOperationScope('campaign:rewrite', JSON.stringify({ campaignId, postId, instruction })), `/api/campaigns/${campaignId}/content-plan/${postId}/rewrite`, {
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
          setError(isAr
            ? 'الرصيد غير كافٍ لإعادة الصياغة. أضف رصيدًا أو راجع خطتك.'
            : 'Not enough credits to rewrite. Add credits or review your plan.')
        } else if (data.code === 'CONTENT_REVIEW_REQUIRED') {
          const firstIssue = Array.isArray(data.issues) && typeof data.issues[0]?.reason === 'string'
            ? ` ${contentQualityIssueLabel(data.issues[0].reason, isAr)}`
            : ''
          setError(isAr
            ? `الصياغة الجديدة لم تجتز مراجعة الجودة، لذلك لم تُحفظ وأُعيدت الكريديت المخصومة. جرّب توجيهًا أكثر تحديدًا أو عدّل النص يدويًا.${firstIssue}`
            : `The new copy did not pass quality review, so it was not saved and the charged credits were returned. Try a more specific instruction or edit the copy manually.${firstIssue}`)
        } else {
          throw new Error(isAr
            ? 'تعذّرت إعادة الصياغة. لم يُحفظ أي تعديل؛ أعد المحاولة.'
            : (data.error ?? 'Rewrite failed. No change was saved; try again.'))
        }
        return false
      }
      // Update caption in state immediately (no re-fetch needed)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...data.post } : p))
      // Clear any pending edit for this post so it shows the fresh caption
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
      await Promise.all([loadData(), refreshBillingStatus()])
      const remainingQualityIssueCount = Array.isArray(data.remainingQualityIssues)
        ? data.remainingQualityIssues.length
        : 0
      setSuccessMsg(remainingQualityIssueCount > 0
        ? (isAr
            ? `تم حفظ الصياغة الجديدة، لكن بقيت ${remainingQualityIssueCount} ملاحظة في المنشور — غالبًا في توجيه الصورة أو الفيديو الذي لا تغيّره إعادة صياغة النص.`
            : `The rewritten copy was saved, but ${remainingQualityIssueCount} post quality finding${remainingQualityIssueCount === 1 ? '' : 's'} remain—usually in image or video direction, which a copy rewrite does not change.`)
        : (isAr
            ? 'تم حفظ الصياغة الجديدة واجتاز المنشور فحص جودة النص وتوجيه الوسائط.'
            : 'The rewritten copy was saved and the post passed copy and media-direction quality review.'))
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    } finally {
      setRewritingPost(null)
    }
  }

  // ── Generate real AI image for a single post ─────────────────────────────────
  // Calls /api/visuals/generate → gpt-image-1 or Flux → Cloudinary + brand overlay

  function openImageGenerationConfirm(postId: string, referenceMediaId: string | null = null) {
    if (strategyApprovalRequired || contentIssuesByPostId.has(postId)) {
      setError(strategyApprovalRequired
        ? strategyApprovalRequiredLabel
        : (isAr ? 'صحّح نص هذا المنشور قبل دفع تكلفة الصورة.' : 'Fix this post copy before paying for its image.'))
      return
    }
    if (imageGenerationLocked) {
      setError(addCreditsForImagesLabel)
      return
    }
    if (imageDailyCapReached) {
      setError(imageDailyCapReachedLabel)
      return
    }
    const post = posts.find(item => item.id === postId)
    if (pendingGeneratedAttachment?.postId === postId) {
      setError(isAr
        ? 'الصورة مولّدة ومدفوعة بالفعل لكنها لم ترتبط بالمنشور. استخدم «إعادة محاولة الربط» بدل دفع توليد جديد.'
        : 'This image was already generated and charged but was not attached. Use “Retry attachment” instead of paying for another generation.')
      return
    }
    if (post?.generationStatus === 'REFUND_PENDING') {
      setError(isAr
        ? 'استرداد كريديت المحاولة السابقة قيد المصالحة التلقائية. لن يبدأ خصم جديد قبل اكتماله.'
        : 'The previous attempt\'s credit restoration is pending automatic reconciliation. A new charge is blocked until it completes.')
      return
    }
    setImageReferenceMediaId(referenceMediaId)
    setImageGenerationAcknowledged(false)
    setImageGenerationConfirmPostId(postId)
  }

  function closeImageGenerationConfirm() {
    if (generatingImageId) return
    setImageGenerationConfirmPostId(null)
    setImageGenerationAcknowledged(false)
    setImageReferenceMediaId(null)
  }

  function chooseProductReferenceForImage() {
    if (!imageGenerationConfirmPostId || generatingImageId) return
    const postId = imageGenerationConfirmPostId
    closeImageGenerationConfirm()
    setMediaPickerOpen(postId)
  }

  async function confirmPostImageGeneration() {
    if (!imageGenerationConfirmPostId || !imageGenerationAcknowledged) return
    const post = posts.find(p => p.id === imageGenerationConfirmPostId)
    if (!post) return
    await generatePostImage(post.id, post.platform)
  }

  async function generatePostImage(postId: string, platform: string) {
    if (!isAuthenticated) return
    if (strategyApprovalRequired || contentIssuesByPostId.has(postId)) {
      setError(strategyApprovalRequired
        ? strategyApprovalRequiredLabel
        : (isAr ? 'صحّح نص هذا المنشور قبل دفع تكلفة الصورة.' : 'Fix this post copy before paying for its image.'))
      return
    }
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
      const visualIdentity = JSON.stringify({
        campaignId: campaign?.id,
        postId: post.id,
        caption: post.caption || post.imagePrompt || '',
        creativeRequirement,
      })
      const authorization = authHeader()
      if (!authorization) throw new Error(isAr ? 'تعذّر التحقق من جلسة الدخول.' : 'Could not verify your session.')
      const res = await fetchCreditOperation(creditOperationScope('campaign:post-visual', visualIdentity), '/api/visuals/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({
          campaignId:  campaign?.id,
          platform:    mappedPlatform,
          visualType:  'SOCIAL_PREVIEW',
          visualStyle: 'Premium',
          postCaption: post.caption || post.imagePrompt || '',
          parentId: `social-post:${post.id}`,
          assetRole: 'post_background',
          // If the user attached a product/reference image first, preserve it
          // through GPT Image 2 high-fidelity editing instead of replacing it.
          referenceMediaId: imageReferenceMediaId || post.uploadedMediaId || undefined,
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
        throw new Error(err.message || err.error || 'Image generation failed')
      }

      const data = await res.json()
      const acceptedVisual = data?.visual
      const generatedVisualId = acceptedVisual?.id
      if (!generatedVisualId) throw new Error('No durable image production job returned')
      const completedVisual = acceptedVisual?.status === 'COMPLETED' && acceptedVisual?.imageUrl
        ? acceptedVisual
        : await pollGeneratedVisual({ visualId: generatedVisualId, authorization })
      const imageUrl = completedVisual?.imageUrl
      if (!imageUrl || !generatedVisualId) throw new Error('No durable generated media returned')

      const attached = await savePostEdit(postId, {
        generatedVisualId,
        explicitGeneratedMediaAttachConfirmed: true,
      })
      await refreshBillingStatus()
      setImageGenerationConfirmPostId(null)
      setImageGenerationAcknowledged(false)
      setImageReferenceMediaId(null)
      if (!attached) {
        setPendingGeneratedAttachment({ postId, generatedVisualId })
        setError(isAr
          ? `تم توليد الصورة وخصم ${CONTENT_HUB_IMAGE_COST} كريديت، لكن تعذّر ربطها بالمنشور. الصورة محفوظة؛ أعد محاولة الربط دون خصم جديد.`
          : `The image was generated and ${CONTENT_HUB_IMAGE_COST} credits were charged, but attachment failed. The image is saved; retry attachment with no new charge.`)
      }
    } catch (err: any) {
      if (err instanceof GeneratedVisualTerminalError) {
        // A terminal provider/QA failure is final for this paid attempt. Close
        // the consent modal so the visible page can show the failure instead
        // of inviting an accidental duplicate charge while the refund settles.
        setImageGenerationConfirmPostId(null)
        setImageGenerationAcknowledged(false)
        setImageReferenceMediaId(null)
        await Promise.all([loadData(), refreshBillingStatus()])
      }
      setError(err instanceof GeneratedVisualTerminalError && isAr
        ? 'رفض فحص NEXUS هذه الصورة لأنها لم تطابق الاتجاه الإبداعي ومتطلبات المنصة. لم تُربط بالمنشور، ويستعيد النظام الكريديت تلقائيًا.'
        : err.message)
    } finally {
      setGeneratingImageId(null)
    }
  }

  async function retryGeneratedImageAttachment() {
    if (!pendingGeneratedAttachment || retryingGeneratedAttachment) return
    setRetryingGeneratedAttachment(true)
    setError(null)
    const attached = await savePostEdit(pendingGeneratedAttachment.postId, {
      generatedVisualId: pendingGeneratedAttachment.generatedVisualId,
      explicitGeneratedMediaAttachConfirmed: true,
    })
    if (attached) {
      setPendingGeneratedAttachment(null)
      setSuccessMsg(isAr
        ? 'تم ربط الصورة المحفوظة بالمنشور دون خصم كريديت جديد.'
        : 'The saved image was attached to the post with no new credit charge.')
    }
    setRetryingGeneratedAttachment(false)
  }

  // ── Generate one quality-gated, multi-reference cinematic product ad ──────

  function openVideoGenerationConfirm(postId: string, referenceMediaId: string | null = null) {
    const post = posts.find(item => item.id === postId)
    if (!post?.isVideoPost) return
    setError(null)
    if (strategyApprovalRequired || contentIssuesByPostId.has(postId)) {
      setError(strategyApprovalRequired
        ? strategyApprovalRequiredLabel
        : (isAr ? 'صحّح نص هذا الفيديو قبل دفع تكلفة التوليد.' : 'Fix this video post copy before paying for generation.'))
      return
    }
    if (videoGenerationLocked) {
      setError(addCreditsForVideoLabel)
      return
    }
    if (post.generationStatus === 'GENERATING') {
      setError(isAr ? 'يتم بالفعل توليد فيديو لهذا المنشور.' : 'A video is already being generated for this post.')
      return
    }
    if (post.generationStatus === 'REFUND_PENDING') {
      setError(isAr
        ? 'استرداد كريديت المحاولة السابقة قيد المصالحة؛ لن يبدأ خصم جديد.'
        : 'The previous video credit restoration is pending; no new charge can start.')
      return
    }
    const currentMotionSource = motionDesignVideos.find(media => media.id === post.uploadedMediaId) ?? null
    const defaultMotionSource = currentMotionSource ?? motionDesignVideos[0] ?? null
    setVideoProductionMode(
      referenceMediaId
        ? 'CINEMATIC'
        : videoReferenceImages.length >= PROPERTY_PHOTO_FILM_MIN_REFERENCES
          ? 'PHOTO_FILM'
          : 'MOTION_DESIGN',
    )
    setMotionDesignSourceMediaId(defaultMotionSource?.id ?? null)
    setVideoReferenceMediaIds(referenceMediaId ? [referenceMediaId] : [])
    setVideoGenerationAcknowledged(false)
    setVideoAssetRightsAcknowledged(false)
    setVideoSamePropertyAcknowledged(false)
    setVideoGenerationConfirmPostId(postId)
  }

  function closeVideoGenerationConfirm() {
    if (generatingVideoId) return
    setVideoGenerationConfirmPostId(null)
    setVideoGenerationAcknowledged(false)
    setVideoAssetRightsAcknowledged(false)
    setVideoSamePropertyAcknowledged(false)
    setVideoReferenceMediaIds([])
    setMotionDesignSourceMediaId(null)
    setVideoProductionMode('PHOTO_FILM')
  }

  async function confirmPostVideoGeneration() {
    if (!videoGenerationConfirmPostId || !canStartSelectedVideoRoute || !isAuthenticated) return
    const post = posts.find(item => item.id === videoGenerationConfirmPostId)
    if (!post) return
    setGeneratingVideoId(post.id)
    setError(null)
    try {
      if (videoProductionMode === 'PHOTO_FILM') {
        const identity = JSON.stringify({
          campaignId,
          postId: post.id,
          caption: post.caption,
          referenceMediaIds: videoReferenceMediaIds,
          durationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
        })
        const response = await fetchCreditOperation(
          creditOperationScope('campaign:post-property-photo-film', identity),
          `/api/campaigns/${campaignId}/content-plan/${post.id}/generate-property-photo-film`,
          {
            method: 'POST',
            headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referenceMediaIds: videoReferenceMediaIds,
              language: isAr ? 'ar' : 'en',
              explicitPropertyPhotoFilmConfirmed: true,
              acknowledgedCreditCost: CONTENT_HUB_PROPERTY_PHOTO_FILM_COST,
              acknowledgedDurationSeconds: PROPERTY_PHOTO_FILM_DURATION_SECONDS,
              acknowledgedNoPublishOrSchedule: true,
              acknowledgedReviewRequired: true,
              acknowledgedAssetRights: true,
              acknowledgedSameProperty: true,
            }),
          },
        )
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (data.code === 'PROPERTY_PHOTO_FILM_QUALITY_REJECTED') {
            const creditSettlement = data.refunded
              ? (isAr ? 'تمت استعادة الكريديت.' : 'Credits were restored.')
              : (isAr
                ? 'استعادة الكريديت قيد المصالحة؛ راجع سجل الكريديت قبل إعادة المحاولة.'
                : 'Credit restoration is being reconciled; check Credit History before retrying.')
            throw new Error(`${data.qualityReview?.summary || data.error || 'Property film did not pass quality review.'} ${creditSettlement}`)
          }
          throw new Error(data.error || data.message || 'Property photo film could not finish')
        }

        if (data.status === 'PROCESSING' || response.status === 202) {
          setPosts(current => current.map(item => item.id === post.id
            ? { ...item, generationStatus: 'GENERATING' }
            : item))
          setSuccessMsg(isAr
            ? `بدأ مونتاج Property Photo Film من الصور الأصلية. تم حفظ رقم الرندر؛ سيُستأنف نفس العمل بلا توليد أو خصم جديد. لا نشر ولا جدولة.`
            : 'The source-locked property photo film is rendering. Its render ID is saved and the same job will resume without a new generation or charge. Nothing was published or scheduled.')
        } else if (data.attached) {
          setPosts(current => current.map(item => item.id === post.id
            ? {
                ...item,
                imageUrl: data.output,
                uploadedMediaId: data.mediaId,
                mediaSource: 'UPLOAD',
                generationStatus: 'DONE',
                status: ['APPROVED', 'SCHEDULED', 'FAILED'].includes(item.status) ? 'DRAFT' : item.status,
              }
            : item))
          setSuccessMsg(isAr
            ? `تم إنتاج Property Photo Film مدته ${PROPERTY_PHOTO_FILM_DURATION_SECONDS} ثوانٍ من الصور الأصلية وربطه للمراجعة. تم خصم ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} كريديت؛ لم يُستخدم أي مزود فيديو توليدي. لا نشر ولا جدولة.`
            : `A ${PROPERTY_PHOTO_FILM_DURATION_SECONDS}-second source-locked property photo film was produced and attached for review. ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} credits were charged; no generative-video provider was used. Nothing was published or scheduled.`)
        } else {
          setSuccessMsg(isAr
            ? 'تم حفظ Property Photo Film في مكتبة الوسائط، لكن المنشور تغيّر أثناء التنفيذ فلم يستبدل NEXUS المراجعة الأحدث.'
            : 'The property photo film was saved in Media Library, but the post changed during production, so NEXUS did not overwrite the newer revision.')
        }
        setVideoGenerationConfirmPostId(null)
        setVideoGenerationAcknowledged(false)
        setVideoAssetRightsAcknowledged(false)
        setVideoSamePropertyAcknowledged(false)
        setVideoReferenceMediaIds([])
        await refreshBillingStatus()
        return
      }

      if (videoProductionMode === 'MOTION_DESIGN') {
        if (!motionDesignSourceMediaId) return
        const identity = JSON.stringify({
          campaignId,
          postId: post.id,
          caption: post.caption,
          sourceMediaId: motionDesignSourceMediaId,
          durationSeconds: MOTION_DESIGN_DURATION_SECONDS,
          timelineVersion: PROFESSIONAL_VIDEO_TIMELINE_VERSION,
        })
        const response = await fetchCreditOperation(
          creditOperationScope('campaign:post-motion-design', identity),
          `/api/campaigns/${campaignId}/content-plan/${post.id}/generate-motion-design`,
          {
            method: 'POST',
            headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceMediaId: motionDesignSourceMediaId,
              language: isAr ? 'ar' : 'en',
              explicitMotionDesignConfirmed: true,
              acknowledgedCreditCost: CONTENT_HUB_MOTION_DESIGN_COST,
              acknowledgedDurationSeconds: MOTION_DESIGN_DURATION_SECONDS,
              acknowledgedNoPublishOrSchedule: true,
              acknowledgedReviewRequired: true,
              acknowledgedAssetRights: true,
            }),
          },
        )
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (data.code === 'MOTION_DESIGN_QUALITY_REJECTED') {
            const reviewSummary = typeof data.qualityReview?.summary === 'string'
              ? data.qualityReview.summary
              : data.error
            const creditSettlement = data.refunded
              ? (isAr ? 'تمت استعادة الكريديت.' : 'Credits were restored.')
              : (isAr
                ? 'استعادة الكريديت قيد المصالحة؛ راجع سجل الكريديت قبل إعادة المحاولة.'
                : 'Credit restoration is being reconciled; check Credit History before retrying.')
            throw new Error(`${reviewSummary || 'Motion Design did not pass quality review.'} ${creditSettlement}`)
          }
          throw new Error(data.error || data.message || 'Motion Design could not finish')
        }

        if (data.attached) {
          setPosts(current => current.map(item => item.id === post.id
            ? {
                ...item,
                imageUrl: data.output,
                uploadedMediaId: data.mediaId,
                mediaSource: 'UPLOAD',
                generationStatus: 'DONE',
                status: ['APPROVED', 'SCHEDULED', 'FAILED'].includes(item.status) ? 'DRAFT' : item.status,
              }
            : item))
        }
        setVideoGenerationConfirmPostId(null)
        setVideoGenerationAcknowledged(false)
        setVideoAssetRightsAcknowledged(false)
        setVideoSamePropertyAcknowledged(false)
        setVideoReferenceMediaIds([])
        setMotionDesignSourceMediaId(null)
        setSuccessMsg(isAr
          ? `تم إنتاج إعلان Motion Design مدته ${MOTION_DESIGN_DURATION_SECONDS} ثوانٍ من الفيديو الأصلي وربطه للمراجعة. تم خصم ${CONTENT_HUB_MOTION_DESIGN_COST} كريديت، ولم يُستخدم أي مزود فيديو توليدي. لا نشر ولا جدولة.`
          : `An ${MOTION_DESIGN_DURATION_SECONDS}-second source-locked Motion Design ad was produced and attached for review. ${CONTENT_HUB_MOTION_DESIGN_COST} credits were charged; no generative-video provider was used. Nothing was published or scheduled.`)
        await refreshBillingStatus()
        return
      }

      const professionalCampaignFilm = videoProductionMode === 'CAMPAIGN_FILM'
      const selectedDurationSeconds = professionalCampaignFilm
        ? CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS
        : CINEMATIC_PRODUCT_AD_DURATION_SECONDS
      const productionRoute = professionalCampaignFilm
        ? 'MULTI_SHOT_CAMPAIGN_FILM'
        : 'CINEMATIC_PRODUCT_AD'
      const identity = JSON.stringify({
        campaignId,
        postId: post.id,
        videoPrompt: post.videoPrompt,
        referenceMediaIds: videoReferenceMediaIds,
        durationSeconds: selectedDurationSeconds,
        productionRoute,
      })
      const response = await fetchCreditOperation(
        creditOperationScope('campaign:post-video', identity),
        `/api/campaigns/${campaignId}/content-plan/${post.id}/generate-video`,
        {
          method: 'POST',
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceMediaIds: videoReferenceMediaIds,
            productionRoute,
            language: isAr ? 'ar' : 'en',
            explicitVideoGenerationConfirmed: true,
            acknowledgedCreditCost: CONTENT_HUB_VIDEO_COST,
            acknowledgedDurationSeconds: selectedDurationSeconds,
            acknowledgedNoPublishOrSchedule: true,
            acknowledgedReviewRequired: true,
            acknowledgedAssetRights: true,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data.code === 'CAMPAIGN_FILM_QUALITY_LOCKED') {
          const fallbackMode = motionDesignVideos.length > 0 ? 'MOTION_DESIGN' : 'CINEMATIC'
          setVideoProductionMode(fallbackMode)
          setMotionDesignSourceMediaId(motionDesignVideos[0]?.id ?? null)
          setVideoGenerationAcknowledged(false)
          setVideoAssetRightsAcknowledged(false)
          setVideoSamePropertyAcknowledged(false)
          throw new Error(isAr
            ? `أوقف NEXUS هذا المسار بعد ${data.rejectedAttempts ?? 2} نتائج رفضها فحص الجودة، ولم يبدأ مزودًا ولم يخصم كريديت. انتقلنا إلى ${fallbackMode === 'MOTION_DESIGN' ? 'Motion Design من فيديو أصلي' : 'إعلان دقة المنتج من أصول حقيقية'}؛ اختر أصلًا مؤهلًا للمتابعة.`
            : `NEXUS stopped this route after ${data.rejectedAttempts ?? 2} outputs failed quality review. No provider started and no credits were charged. We switched to ${fallbackMode === 'MOTION_DESIGN' ? 'source-locked Motion Design' : 'product fidelity from real assets'}; choose a qualified source to continue.`)
        }
        throw new Error(data.error || data.message || 'Video generation could not start')
      }

      setPosts(current => current.map(item => item.id === post.id
        ? { ...item, generationStatus: 'GENERATING' }
        : item))
      setVideoGenerationConfirmPostId(null)
      setVideoGenerationAcknowledged(false)
      setVideoAssetRightsAcknowledged(false)
      setVideoSamePropertyAcknowledged(false)
      setVideoReferenceMediaIds([])
      setMotionDesignSourceMediaId(null)
      setSuccessMsg(professionalCampaignFilm
        ? (isAr
          ? `بدأ إنتاج Concept Film مولّد من 3 لقطات مدته ${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS} ثوانٍ، مع حركة مشاهد وعناصر وكاميرا وانتقالات وصوت وTypography خاص بالبراند. لا يدّعي الحفاظ على منتج حقيقي. تم حجز ${CONTENT_HUB_VIDEO_COST} كريديت، ولن يتحول الحجز إلى خصم نهائي إلا بعد حفظ فيديو صالح واجتيازه فحص الجودة. لا نشر ولا جدولة.`
          : `A ${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS}-second generated three-shot concept film is rendering with visible scene, subject, and camera motion, cuts, sound, and brand typography. It does not claim real-product fidelity. ${CONTENT_HUB_VIDEO_COST} credits are reserved and will be charged only after a usable video is stored and passes quality review. Nothing was published or scheduled.`)
        : (isAr
          ? `بدأ إنتاج إعلان منتج سينمائي مدته ${CINEMATIC_PRODUCT_AD_DURATION_SECONDS} ثوانٍ من أصول المنتج المؤهلة. تم حجز ${CONTENT_HUB_VIDEO_COST} كريديت، ولا توجد إعادة محاولة تلقائية؛ يتم الخصم النهائي فقط بعد حفظ أصل صالح واجتيازه الجودة. لا نشر ولا جدولة.`
          : `An ${CINEMATIC_PRODUCT_AD_DURATION_SECONDS}-second cinematic product ad is rendering from qualified product assets. ${CONTENT_HUB_VIDEO_COST} credits are reserved with no automatic provider retry; the charge settles only after a usable output is stored and passes review. Nothing was published or scheduled.`))
      await refreshBillingStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video generation could not start')
      await refreshBillingStatus()
    } finally {
      setGeneratingVideoId(null)
    }
  }

  async function repairRejectedCampaignFilm(post: ContentPost) {
    const generationId = post.retainedVideoRepair?.generationId
      ?? (post.rejectedVideoReview?.repairEligible ? post.rejectedVideoReview.generationId : null)
    if (!generationId || repairingVideoId || !isAuthenticated) return
    setRepairingVideoId(post.id)
    setError(null)
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/content-plan/${post.id}/generate-video`,
        {
          method: 'PATCH',
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationId,
            explicitRetainedRepairConfirmed: true,
            acknowledgedNoProviderGeneration: true,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      await loadData()
      if (!response.ok) throw new Error(data.error || 'The retained campaign-film repair did not pass review')
      if (response.status === 202 || data.status === 'PROCESSING') {
        setSuccessMsg(isAr
          ? 'ما زال Shotstack ينفّذ نفس الرندر. حفظ NEXUS رقم العملية، وزر الاستئناف سيكمل نفس الفيديو والصوت من دون توليد جديد أو خصم كريديت.'
          : 'Shotstack is still rendering the same job. NEXUS saved its ID, so Resume will continue the same video and voiceover without a new generation or credit charge.')
        return
      }
      setSuccessMsg(isAr
        ? 'تم تحديث التركيب والصوت على نفس اللقطات المحفوظة، واجتاز الفيديو فحص الجودة وربط للمراجعة. لم يبدأ توليد جديد ولم يُخصم كريديت.'
        : 'NEXUS upgraded the composition and audio on the retained footage, passed premium review, and attached the video for review. No new generation started and no credits were charged.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The retained campaign-film repair could not finish')
    } finally {
      setRepairingVideoId(null)
      await refreshBillingStatus()
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
        isAr
          ? 'تم حفظ المسودة المفضلة. هذا اختيار تحريري وليس فوزًا مبنيًا على الأداء.'
          : 'Preferred draft saved. This is an editorial choice, not a performance winner.',
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPickingWinner(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!authLoading && !isAuthenticated) return null

  if (authLoading || loading) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مساحة إنتاج الحملة" labelEn="Preparing campaign production" />
  }

  if (loadError && !campaign) {
    return (
      <AppShell>
        <div className="min-h-screen bg-[#F4F7FB] px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-[1580px]">
            <h1 className="mb-6 text-2xl font-bold text-slate-950">
              {isAr ? 'إنتاج محتوى الحملة' : 'Campaign content production'}
            </h1>
            <ErrorState
              title={isAr ? 'تعذّر فتح مساحة الإنتاج' : 'Could not open production workspace'}
              description={loadError}
              retryAction={(
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true)
                    void loadData()
                  }}
                  className="rounded-xl bg-[#101A4D] px-4 py-2 text-sm font-bold text-white"
                >
                  {isAr ? 'إعادة المحاولة' : 'Retry'}
                </button>
              )}
            />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <main dir={isAr ? 'rtl' : 'ltr'} className="nx-os-page flex min-h-[65vh] items-center justify-center px-5 py-10">
          <section className="nx-os-card w-full max-w-xl p-8 text-center sm:p-10">
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-2xl font-black text-amber-700">!</span>
            <h1 className="mt-5 text-2xl font-black text-[#0B1028]">
              {isAr ? 'مساحة إنتاج الحملة غير متاحة' : 'Campaign production workspace unavailable'}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
              {isAr ? 'قد تكون الحملة حُذفت أو لا تنتمي إلى مساحة العمل الحالية. لم يتم إنشاء محتوى أو خصم أي كريديت.' : 'The campaign may have been removed or may not belong to the current workspace. No content was created and no credits were charged.'}
            </p>
            <button
              type="button"
              onClick={() => router.push('/campaigns')}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#101A4D] px-5 text-sm font-black text-white"
            >
              {isAr ? 'العودة إلى الحملات' : 'Back to campaigns'}
            </button>
          </section>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main className="nx-os-page text-[#0B1028]">
      <div className="nx-os-container">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 items-start justify-between mb-6 gap-4 flex-wrap">
          <div className="min-w-0">
            <button
              onClick={() => router.push(`/campaigns/${campaignId}`)}
              className="text-sm text-slate-500 hover:text-[#5E5CE6] flex items-center gap-1 mb-2 transition-colors"
            >
              ← {campaign.name}
            </button>
            <h1 className="text-2xl font-bold text-slate-950">
              {isAr ? 'إنتاج محتوى الحملة' : 'Campaign content production'}
            </h1>
            {/* Every count is labelled distinctly: drafts include A/B variants, image
                and video slots describe format demand, and "media ready" includes only
                confirmed generated or uploaded media. Provenance stays on each card. */}
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
                {/* Owner path: one reviewed package decision. Legacy/partial
                    APPROVED states keep their separate recovery controls. */}
                {draftCount > 0 ? (
                  <button
                    onClick={() => {
                      if (approvalBlocked) return
                      if (draftMediaDecisionCount > 0) {
                        setError(isAr
                          ? `أكمل وسائط ${draftMediaDecisionCount} منشورات ليصبح قرار الحزمة جاهزًا.`
                          : `Complete media for ${draftMediaDecisionCount} post${draftMediaDecisionCount === 1 ? '' : 's'} to make the package decision ready.`)
                        document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        return
                      }
                      setError(null)
                      const now = Date.now()
                      setScheduleDateByPostId(Object.fromEntries(
                        draftPosts.map((post, index) => {
                          const saved = post.scheduledAt ? new Date(post.scheduledAt) : null
                          if (saved && !Number.isNaN(saved.getTime()) && saved.getTime() > now) {
                            return [post.id, toLocalScheduleInputValue(saved.toISOString())]
                          }
                          const proposed = new Date(now)
                          proposed.setDate(proposed.getDate() + 1 + Math.floor(index / 3))
                          proposed.setHours([10, 14, 18][index % 3], 0, 0, 0)
                          return [post.id, toLocalScheduleInputValue(proposed.toISOString())]
                        }),
                      ))
                      setWeakMediaApprovalAcknowledged(false)
                      setShowApproveConfirm(true)
                    }}
                    disabled={approving || approvalBlocked}
                    className="flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold leading-tight transition-all whitespace-normal break-words"
                    style={{
                      background: draftMediaDecisionCount > 0 ? '#FFFBEB' : '#059669',
                      color: draftMediaDecisionCount > 0 ? '#92400E' : 'white',
                      border: draftMediaDecisionCount > 0 ? '1px solid #FDE68A' : '1px solid transparent',
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
                      if (mediaApprovalRequired) {
                        openMediaApprovalConfirm()
                        return
                      }
                      if (schedulingBlocked) {
                        document.getElementById('content-posts-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        return
                      }
                      setScheduleAcknowledged(false)
                      setScheduleDateByPostId(Object.fromEntries(
                        approvedPosts.map(post => [post.id, toLocalScheduleInputValue(post.scheduledAt)]),
                      ))
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
                    disabled={scheduling || mediaApproving}
                    className="flex max-w-full min-w-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold leading-tight transition-all whitespace-normal break-words"
                    style={{
                      background: mediaApprovalRequired ? '#059669' : schedulingBlocked ? '#FFFBEB' : '#4F46E5',
                      color: schedulingBlocked && !mediaApprovalRequired ? '#92400E' : 'white',
                      border: schedulingBlocked && !mediaApprovalRequired ? '1px solid #FDE68A' : '1px solid transparent',
                      opacity: scheduling || mediaApproving ? 0.6 : 1,
                    }}
                  >
                    {scheduling || mediaApproving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {mediaApproving
                          ? (isAr ? 'جارٍ حفظ اعتماد الوسائط...' : 'Saving media approval...')
                          : t('contentHub.scheduling')}
                      </>
                    ) : (
                      <>
                        {mediaApprovalRequired ? '✓' : schedulingBlocked ? '⚠️' : '🗓'} {scheduleApprovedLabel}
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

                <details className="group relative z-20 max-w-full sm:max-w-xs">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950">
                    <span aria-hidden="true">⚙</span>
                    {isAr ? 'أدوات الإنتاج' : 'Production tools'}
                    <span className="text-[10px] text-slate-400 transition group-open:rotate-180">▼</span>
                  </summary>
                  <div className={`absolute top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ${isAr ? 'left-0' : 'right-0'}`} dir={isAr ? 'rtl' : 'ltr'}>
                    <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {isAr ? 'اختياري — لا يغيّر حالة النشر' : 'Optional — does not change publish state'}
                    </p>
                    <button
                      type="button"
                      onClick={imageGenerationLocked ? () => router.push('/billing') : openBulkImageConfirm}
                      disabled={generating || pendingImageCount === 0 || imageGenerationBlockedByTruthReview || imageDailyCapReached}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-start transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="mt-0.5" aria-hidden="true">✨</span>
                      <span>
                        <span className="block text-sm font-bold text-slate-900">
                          {generating ? t('contentHub.generatingImages') : imageGenerationBlockedByTruthReview ? imageGenerationTruthReviewLabel : imageGenerationLocked ? addCreditsForImagesLabel : imageDailyCapReached ? imageDailyCapReachedLabel : bulkImageButtonLabel}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {imageDailyCapacityLabel}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={strategyApprovalRequired ? () => router.push(`/campaigns/${campaignId}?tab=strategy`) : contentPlanLocked ? () => router.push('/billing') : openRegenerateConfirm}
                      disabled={generatingPlan}
                      className="mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-start transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="mt-0.5" aria-hidden="true">↻</span>
                      <span>
                        <span className="block text-sm font-bold text-slate-900">
                          {generatingPlan ? t('contentHub.regenerating') : strategyApprovalRequired ? strategyApprovalRequiredLabel : contentPlanLocked ? addCreditsForRegenerateDraftPlanLabel : regenerateDraftPlanLabel}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {contentPlanLocked ? contentPlanRequirementDisclosure : contentPlanDisclosure}
                        </span>
                      </span>
                    </button>
                    <div className="mt-2 border-t border-slate-100 px-3 pt-3 text-[11px] leading-5 text-slate-500">
                      <p>{creditBalanceLabel}</p>
                      <p>{contentPlanAutopilotDisclosure}</p>
                    </div>
                  </div>
                </details>
              </>
            )}

            {posts.length === 0 && !strategyApprovalRequired && (
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
                  title={isAr
                    ? `إنشاء نسخ A/B اختيارية باستدعاء منفصل — ${abVariantTruth.cost} كريديت إضافية، تُرد إذا لم تُحفظ نسخ صالحة`
                    : `Optional A/B variants use one separate AI call — ${abVariantTruth.cost} additional credits, refunded if no valid variants are saved`}
                >
                  <span>A/B</span>
                  <span className="font-bold">+{abVariantTruth.cost}</span>
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
          <section
            className="mb-5 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm"
            aria-label={isAr ? 'القرار التالي' : 'Next decision'}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5E63FF]" aria-hidden="true">✦</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5E63FF]">{productionDecision.eyebrow}</p>
                <h2 className="mt-1 text-base font-black text-slate-950">{productionDecision.title}</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-600">{productionDecision.body}</p>
              </div>
            </div>
          </section>
        )}

        {campaignStrategyScope.includesPaid && (
          <section className="mb-5 overflow-hidden rounded-[22px] border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-orange-50 shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700">
                  {isAr ? 'أنت داخل المسار العضوي' : 'You are in the organic lane'}
                </p>
                <h2 className="mt-1 text-sm font-bold text-slate-950">
                  {isAr ? 'هذه الاستراتيجية تشمل مسار إعلانات منفصلًا' : 'This strategy also includes a separate paid-ad lane'}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {isAr
                    ? 'الإعلانات لا تتحول تلقائيًا إلى منشورات. افتح مركز التنفيذ لمراجعة المنصات والتتبع والنسخ والإبداع والميزانية.'
                    : 'Ads do not become organic posts automatically. Open execution to review platforms, tracking, copy, creative, and budget.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/campaigns/${campaignId}/execution`)}
                className="inline-flex flex-none items-center justify-center rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-800"
              >
                {isAr ? 'فتح Organic + Paid' : 'Open Organic + Paid'}
              </button>
            </div>
          </section>
        )}

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
                      title: isAr ? 'الاستراتيجية' : 'Strategy',
                      body: isAr ? 'يحدد الوعد والعدد والمنصات.' : 'Defines promise, count, and platforms.',
                    },
                    {
                      step: '02',
                      title: isAr ? 'الاستوديو' : 'Studio',
                      body: isAr ? 'ينتج الأصول والنسخ الإبداعية.' : 'Produces assets and creative variants.',
                    },
                    {
                      step: '03',
                      title: isAr ? 'مركز المحتوى' : 'Content Hub',
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
        {loadError && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void loadData()}
              className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl text-sm text-green-700 bg-green-50 border border-green-200 flex items-center justify-between">
            {successMsg}
            <button type="button" aria-label={isAr ? 'إغلاق رسالة النجاح' : 'Dismiss success message'} onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-400">×</button>
          </div>
        )}
        {bulkImageResult && (
          <div
            className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${bulkImageResult.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : bulkImageResult.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-rose-200 bg-rose-50 text-rose-800'}`}
            role="status"
          >
            <span>{bulkImageResult.message}</span>
            <button
              type="button"
              onClick={() => setBulkImageResult(null)}
              className="shrink-0 opacity-70 hover:opacity-100"
              aria-label={isAr ? 'إغلاق نتيجة توليد الصور' : 'Dismiss image generation result'}
            >
              ×
            </button>
          </div>
        )}
        {pendingGeneratedAttachment && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>
              {isAr
                ? 'الصورة محفوظة وتم احتسابها، لكن ربطها بالمنشور لم يكتمل. أعد الربط دون توليد أو خصم جديد.'
                : 'The image is saved and charged, but attachment did not finish. Retry attachment without generating or charging again.'}
            </span>
            <button
              type="button"
              onClick={() => void retryGeneratedImageAttachment()}
              disabled={retryingGeneratedAttachment}
              className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {retryingGeneratedAttachment
                ? (isAr ? 'جارٍ إعادة الربط…' : 'Retrying…')
                : (isAr ? 'إعادة محاولة الربط' : 'Retry attachment')}
            </button>
          </div>
        )}

        {posts.length > 0 && creativeIntelligence && (
          <div className="mb-5">
            <CreativeIntelligencePanel
              isAr={isAr}
              totalAssets={creativeIntelligence.summary.totalAssets}
              analyzedAssets={creativeIntelligence.summary.analyzedAssets}
              pendingAssets={creativeIntelligence.summary.pendingAssets}
              batchSize={creativeIntelligence.summary.batchSize}
              matchedPosts={creativeIntelligence.summary.matchedPosts}
              totalPosts={creativeIntelligence.summary.totalPosts}
              creditCost={CONTENT_HUB_MEDIA_INTELLIGENCE_COST}
              scanning={creativeScanning}
              locked={mediaIntelligenceLocked}
              onAnalyze={openCreativeScanConfirm}
              onOpenMedia={() => router.push('/media')}
            />
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
                    aria-pressed={videoProductionMode === 'MOTION_DESIGN'}
                    onClick={() => router.push(`/campaigns/${campaignId}?tab=strategy`)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:text-violet-700"
                  >
                    {preContentStrategyCta}
                  </button>
                  <button
                    type="button"
                    aria-pressed={videoProductionMode === 'CINEMATIC'}
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

        {posts.length > 0 && filteredPosts.length === 0 && !generatingPlan && (
          <section
            role="status"
            className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm"
          >
            <h2 className="text-base font-bold text-slate-950">
              {isAr ? 'لا توجد منشورات تطابق هذه الفلاتر' : 'No posts match these filters'}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {isAr
                ? 'المحتوى محفوظ ولم يُحذف. غيّر المنصة أو الحالة، أو امسح الفلاتر لإظهار كل المنشورات.'
                : 'Your content is still saved. Change the platform or status, or clear filters to show every post.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setActivePlatform('ALL')
                setStatusFilter('ALL')
              }}
              className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {isAr ? 'مسح الفلاتر' : 'Clear filters'}
            </button>
          </section>
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

          const renderCard = (post: ContentPost) => {
            const creativeMatch = creativeIntelligence?.matchesByPostId[post.id]?.[0] ?? null
            const creativeMedia = creativeMatch
              ? creativeIntelligence?.assetsById[creativeMatch.mediaId] ?? null
              : null
            const creativeMatchPanel = creativeMatch && creativeMedia?.intelligenceStatus === 'READY'
              ? (
                  <PostCreativeMatch
                    isAr={isAr}
                    match={creativeMatch}
                    media={creativeMedia}
                    postIsVideo={post.isVideoPost}
                    immutable={post.status === 'PUBLISHED' || post.status === 'PROCESSING'}
                    adapting={adaptingCreativePostId === post.id}
                    onUseExisting={() => requestMediaAttachment(post.id, creativeMedia as MediaItem)}
                    onAdaptCopy={() => requestCreativeAdaptation(post.id, creativeMatch, creativeMedia)}
                    onGenerateFromReference={() => generateFromCreativeReference(post, creativeMedia)}
                    onChooseManually={() => setMediaPickerOpen(post.id)}
                  />
                )
              : undefined
            return (
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
              isGeneratingVideo={generatingVideoId === post.id || (post.isVideoPost && post.generationStatus === 'GENERATING')}
              isRepairingVideo={repairingVideoId === post.id}
              imageGenerationLocked={imageGenerationLocked}
              videoGenerationLocked={videoGenerationLocked}
              imageGenerationBlockedByTruthReview={strategyApprovalRequired || contentIssuesByPostId.has(post.id)}
              imageGenerationTruthReviewLabel={strategyApprovalRequired
                ? strategyApprovalRequiredLabel
                : post.isVideoPost
                  ? (isAr ? 'صحّح النص قبل الفيديو' : 'Fix copy before video')
                  : (isAr ? 'صحّح النص قبل الصورة' : 'Fix copy before image')}
              addCreditsForImagesLabel={addCreditsForImagesLabel}
              addCreditsForVideoLabel={addCreditsForVideoLabel}
              onGenerateImage={() => openImageGenerationConfirm(post.id)}
              onGenerateVideo={() => openVideoGenerationConfirm(post.id)}
              onRepairRejectedVideo={() => repairRejectedCampaignFilm(post)}
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
              onManualPublish={contentIssuesByPostId.has(post.id) ? undefined : () => openManualPublishModal(post)}
              qualityIssues={(contentIssuesByPostId.get(post.id) ?? EMPTY_QUALITY_ISSUES)
                .map(reason => contentQualityIssueLabel(reason, isAr))}
              onPlatformPublished={() => loadData().then(() => undefined)}
              creativeMatchPanel={creativeMatchPanel}
            />
            )
          }

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
                      <span className="text-sm font-semibold" style={{ color: '#a16207' }}>
                        {isAr ? 'مقارنة مسودتي A/B' : 'A/B draft comparison'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {isAr
                          ? 'اختيار تحريري قبل التوزيع — ليس اختبار أداء'
                          : 'Editorial selection before distribution — not a performance test'}
                      </span>
                    </div>
                    {group.a.draftComparison && (
                      <div className="grid gap-2 border-b border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-slate-700 md:grid-cols-2">
                        <p>
                          <span className="font-bold">{isAr ? 'الفرضية: ' : 'Hypothesis: '}</span>
                          {group.a.draftComparison.hypothesis}
                        </p>
                        <p>
                          <span className="font-bold">{isAr ? 'إشارة النجاح لاحقًا: ' : 'Future success signal: '}</span>
                          {group.a.draftComparison.successSignal}
                        </p>
                        <p>
                          <span className="font-bold">{isAr ? 'الحد الأدنى للأدلة: ' : 'Minimum evidence: '}</span>
                          {group.a.draftComparison.minimumEvidence}
                        </p>
                        <p>
                          <span className="font-bold">{isAr ? 'قاعدة القرار: ' : 'Decision rule: '}</span>
                          {group.a.draftComparison.decisionRule}
                        </p>
                      </div>
                    )}
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

        {/* ── Unified copy + media + internal schedule approval ────────── */}
        {showApproveConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(10px)' }}
            onClick={() => {
              if (!approving) setShowApproveConfirm(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="content-package-approval-title"
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: '#ECFDF5', border: '1px solid rgba(5,150,105,0.18)' }}>
                📅
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                {isAr ? 'قرار حزمة واحد' : 'One package decision'}
              </p>
              <h3 id="content-package-approval-title" className="mb-2 mt-1 text-lg font-bold text-slate-950">
                {isAr
                  ? `اعتماد ${draftCount} منشورات وتسجيل جدولها الداخلي`
                  : `Approve and internally schedule ${draftCount} post${draftCount === 1 ? '' : 's'}`}
              </h3>
              <p className="mb-5 text-sm leading-6 text-slate-600">
                {isAr
                  ? 'سيحفظ NEXUS النسخ والوسائط التي راجعتها، ثم يسجل المواعيد أدناه كخطة تنفيذ داخلية. لا يُرسل أي محتوى إلى منصة.'
                  : 'NEXUS will save the copy and media you reviewed, then record the dates below as an internal execution plan. Nothing is sent to a platform.'}
              </p>
              <div className={`mb-4 rounded-xl border p-3 text-xs leading-relaxed ${contentApprovalPreflight.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                <p className="font-black">{isAr ? 'فحص الجودة قبل القرار' : 'Quality review before the decision'}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span>{isAr ? 'المسودات المفحوصة' : 'Drafts reviewed'}: <b>{approvalReviewSummary.reviewedDrafts}</b></span>
                  <span>{isAr ? 'مخاطر الادعاءات' : 'Claim risks'}: <b>{approvalReviewSummary.claimRisks}</b></span>
                  <span>{isAr ? 'مخاطر الوجهة/CTA' : 'Destination/CTA risks'}: <b>{approvalReviewSummary.destinationRisks}</b></span>
                  <span>{isAr ? 'مشاكل التطابق والجودة' : 'Alignment/quality issues'}: <b>{approvalReviewSummary.alignmentRisks}</b></span>
                </div>
                <p className="mt-2 font-semibold">
                  {contentApprovalPreflight.ok
                    ? (isAr ? 'اجتازت النصوص الفحص، وكل الوسائط الحالية جاهزة لقرار الحزمة.' : 'Copy passed review and all current media is ready for the package decision.')
                    : (isAr ? 'الاعتماد مقفل حتى تصبح جميع الأعداد أعلاه صفراً.' : 'Approval stays locked until every risk count above is zero.')}
                </p>
              </div>

              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
                <div className="mb-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-black text-indigo-950">{isAr ? 'جدول التنفيذ المقترح' : 'Proposed execution schedule'}</p>
                    <p className="mt-1 text-indigo-800">
                      {packageScheduleRange
                        ? (isAr
                            ? `${packageScheduleRange.first} — ${packageScheduleRange.last}`
                            : `${packageScheduleRange.first} — ${packageScheduleRange.last}`)
                        : (isAr ? 'راجع كل موعد أدناه.' : 'Review every date below.')}
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 font-bold text-indigo-700">
                    {isAr ? 'داخلي فقط' : 'Internal only'}
                  </span>
                </div>
                <div className="space-y-2">
                  {reviewedPackageScheduleDates.map(({ post, inputValue }) => (
                    <label key={post.id} className="grid gap-1 rounded-lg border border-indigo-100 bg-white p-2 text-xs sm:grid-cols-[1fr_190px] sm:items-center">
                      <span className="font-semibold text-slate-700">
                        {isAr ? `منشور ${post.contentPlanIndex}` : `Post ${post.contentPlanIndex}`}
                        {' · '}{post.platform}
                      </span>
                      <input
                        type="datetime-local"
                        value={inputValue}
                        min={toLocalScheduleInputValue(new Date(Date.now() + 60_000).toISOString())}
                        onChange={event => setScheduleDateByPostId(current => ({
                          ...current,
                          [post.id]: event.target.value,
                        }))}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
                      />
                    </label>
                  ))}
                </div>
                {packageScheduleDateIssues.length > 0 && (
                  <p role="alert" className="mt-2 text-xs font-bold text-rose-700">
                    {isAr
                      ? 'يوجد موعد ماضٍ أو غير صالح. صححه قبل الاعتماد.'
                      : 'A date is invalid or in the past. Correct it before approval.'}
                  </p>
                )}
              </div>

              {packageWeakMediaApprovalRisks.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <p className="font-black">
                    {isAr
                      ? `${packageWeakMediaApprovalRisks.length} وسائط لها تطابق إبداعي ضعيف`
                      : `${packageWeakMediaApprovalRisks.length} media item${packageWeakMediaApprovalRisks.length === 1 ? '' : 's'} have a weak creative match`}
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white/80 p-2.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={weakMediaApprovalAcknowledged}
                      onChange={event => setWeakMediaApprovalAcknowledged(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span>
                      {isAr
                        ? 'راجعت تحذير التطابق وأوافق على تسجيل هذه الوسائط كاستثناء موثق.'
                        : 'I reviewed the match warning and approve this media as a recorded exception.'}
                    </span>
                  </label>
                </div>
              )}

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                <p className="font-black text-slate-950">{isAr ? 'حدود هذا القرار' : 'Decision boundary'}</p>
                <p className="mt-1">
                  {isAr
                    ? 'التكلفة 0 كريديت. لا نشر خارجي، لا تفعيل Autopilot، ولا صرف ميزانية. النشر يحتاج موافقة مستقلة واتصال منصة جاهزًا.'
                    : 'Cost: 0 credits. No external publishing, Autopilot activation, or budget spend. Publishing requires a separate approval and a ready platform connection.'}
                </p>
              </div>
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
              {error && (
                <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  disabled={approving}
                  onClick={() => {
                    setShowApproveConfirm(false)
                    setWeakMediaApprovalAcknowledged(false)
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:text-slate-950 border transition-all"
                  style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#FFFFFF' }}
                >
                  {t('contentHub.cancel')}
                </button>
                <button
                  onClick={() => void approveAll()}
                  disabled={approving
                    || approvalBlocked
                    || draftMediaDecisionCount > 0
                    || packageScheduleDateIssues.length > 0
                    || (packageWeakMediaApprovalRisks.length > 0 && !weakMediaApprovalAcknowledged)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    background: approving
                      || approvalBlocked
                      || draftMediaDecisionCount > 0
                      || packageScheduleDateIssues.length > 0
                      || (packageWeakMediaApprovalRisks.length > 0 && !weakMediaApprovalAcknowledged)
                      ? '#94A3B8'
                      : 'linear-gradient(135deg, #059669, #047857)',
                    opacity: approving ? 0.7 : 1,
                  }}
                >
                  {approving
                    ? (isAr ? 'جارٍ حفظ القرار...' : 'Saving decision...')
                    : (isAr ? 'اعتماد الحزمة وتسجيل الجدول' : 'Approve package and record schedule')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Final media approval (separate from copy and scheduling) ── */}
        {showMediaApproveConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }}
            onClick={closeMediaApprovalConfirm}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="media-approval-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              style={{ border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-2xl">
                🖼️
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                {isAr ? 'قرار وسائط منفصل' : 'Separate media decision'}
              </p>
              <h3 id="media-approval-title" className="mt-1 text-lg font-bold text-slate-950">
                {isAr
                  ? `اعتماد الوسائط النهائية لـ ${approvedPostsNeedingMediaApprovalCount} منشورات`
                  : `Approve final media for ${approvedPostsNeedingMediaApprovalCount} posts`}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {isAr
                  ? 'سيحفظ NEXUS نسخة ثابتة من الصور أو الفيديوهات الحالية باعتبارها النسخ التي راجعتها. أي استبدال لاحق للوسائط سيحتاج اعتمادًا جديدًا.'
                  : 'NEXUS will save an immutable record of the images or videos you reviewed. Replacing media later will require a new approval.'}
              </p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <p className="font-bold text-slate-900">{isAr ? 'ما الذي لا يحدث الآن؟' : 'What does not happen now?'}</p>
                <p className="mt-1">
                  {isAr
                    ? 'لا توجد تكلفة كريديت، ولا تتم الجدولة، ولا يُرسل أي محتوى إلى أي منصة.'
                    : 'This costs 0 credits, does not schedule anything, and sends nothing to a platform.'}
                </p>
              </div>
              {weakMediaApprovalRisks.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <p className="font-black">
                    {isAr
                      ? `${weakMediaApprovalRisks.length} وسائط مرتبطة لها تطابق إبداعي ضعيف`
                      : `${weakMediaApprovalRisks.length} attached media item${weakMediaApprovalRisks.length === 1 ? '' : 's'} have a weak creative match`}
                  </p>
                  <p className="mt-1">
                    {isAr
                      ? 'هذه ليست توقعات أداء؛ إنها فجوة معروفة بين ما يظهر في الوسيط ورسالة المنشور. راجع الاستثناء قبل حفظ الاعتماد.'
                      : 'This is not a performance forecast. It is a known gap between the visible asset and the post message. Review the exception before approval.'}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {weakMediaApprovalRisks.map(({ post, match }) => (
                      <li key={post.id}>
                        {isAr ? `المنشور ${post.contentPlanIndex}` : `Post ${post.contentPlanIndex}`}
                        {' · '}{match.score}%
                        {match.gaps[0]
                          ? (isAr ? ' · توجد فجوة موثقة بين الوسيط ورسالة المنشور.' : ` · ${match.gaps[0]}`)
                          : ''}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white/80 p-2.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={weakMediaApprovalAcknowledged}
                      onChange={event => setWeakMediaApprovalAcknowledged(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span>
                      {isAr
                        ? 'راجعت التطابق الضعيف وأختار اعتماد هذه الوسائط كاستثناء يدوي؛ سيُسجّل NEXUS هذا التجاوز في قرار الاعتماد.'
                        : 'I reviewed the weak match and choose to approve this media as a manual exception; NEXUS will record the override.'}
                    </span>
                  </label>
                </div>
              )}
              {error && (
                <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                  {error}
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={mediaApproving}
                  onClick={closeMediaApprovalConfirm}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {t('contentHub.cancel')}
                </button>
                <button
                  type="button"
                  disabled={mediaApproving
                    || approvedPostsNeedingMediaApprovalCount === 0
                    || (weakMediaApprovalRisks.length > 0 && !weakMediaApprovalAcknowledged)}
                  onClick={() => void approveMedia()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {mediaApproving
                    ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                    : (isAr ? 'اعتماد الوسائط فقط' : 'Approve media only')}
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
              className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
              style={{ border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#5E63FF]">
                    {isAr ? 'قرار جدولة منفصل' : 'Separate scheduling decision'}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">
                    {isAr
                      ? approvedCount === 1
                        ? 'جدولة منشور واحد معتمد'
                        : `جدولة ${approvedCount} منشورات معتمدة`
                      : `Schedule ${approvedCount} approved post${approvedCount === 1 ? '' : 's'}`}
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

                  {!scheduleAccountsLoading && autoTargetsMissingDestinations.length > 0 && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] leading-5 text-rose-900">
                      {isAr
                        ? `التنفيذ التلقائي مقفل: اربط واختر وجهة مؤكدة لكل من ${autoTargetsMissingDestinations.join('، ')}. لن ينشئ NEXUS جدول نشر تلقائي بلا وجهة.`
                        : `Automatic execution is locked: connect and select a verified destination for ${autoTargetsMissingDestinations.join(', ')}. NEXUS will not create an auto-publish schedule without exact destinations.`}
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

                  {approvedAutoTargets.includes('THREADS') && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div>
                        <p className="text-[11px] font-black text-slate-800">Threads</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-500">
                          {threadsAccount
                            ? (isAr ? `الحساب: ${threadsAccount.accountName || 'Threads'} · الوضع: ${threadsAccount.accessTier || 'DEVELOPMENT'}` : `Account: ${threadsAccount.accountName || 'Threads'} · mode: ${threadsAccount.accessTier || 'DEVELOPMENT'}`)
                            : (isAr ? 'لا يوجد حساب Threads متصل.' : 'No Threads account is connected.')}
                        </p>
                        {threadsAccount?.accessTier !== 'LIVE' && (
                          <p className="mt-1 rounded-md bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">
                            {isAr ? 'يلزم تفعيل تطبيق Meta في وضع Live قبل جدولة منشورات Threads للمستخدمين عامة.' : 'The Meta app must be Live before scheduling Threads posts for public users.'}
                          </p>
                        )}
                      </div>
                      {approvedThreadsPosts.map((post, index) => {
                        const options = threadsOptionsByPostId[post.id] || defaultThreadsScheduleOptions(post)
                        const update = (next: Partial<ThreadsScheduleOptions>) => setThreadsOptionsByPostId(current => ({
                          ...current,
                          [post.id]: { ...(current[post.id] || defaultThreadsScheduleOptions(post)), ...next },
                        }))
                        return (
                          <fieldset key={post.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <legend className="px-1 text-[10px] font-black text-slate-700">{isAr ? `منشور ${index + 1}` : `Post ${index + 1}`}</legend>
                            {post.isVideoPost && <p className="rounded-md bg-amber-50 p-2 text-[10px] font-semibold text-amber-800">{isAr ? 'ناشر Threads الحالي يدعم النصوص والصور المعتمدة فقط.' : 'The current Threads publisher supports approved text and images only.'}</p>}
                            <p className="text-[10px] font-semibold text-slate-600">{isAr ? `طول النص: ${Array.from(post.caption.trim()).length} من 500 حرف.` : `Copy length: ${Array.from(post.caption.trim()).length} of 500 characters.`}</p>
                            <label className="block text-[10px] font-bold text-slate-600">
                              {isAr ? 'من يستطيع الرد؟' : 'Who can reply?'}
                              <select value={options.replyControl} onChange={event => update({ replyControl: event.target.value as ThreadsScheduleOptions['replyControl'] })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
                                <option value="everyone">{isAr ? 'الجميع' : 'Everyone'}</option>
                                <option value="accounts_you_follow">{isAr ? 'الحسابات التي أتابعها' : 'Accounts you follow'}</option>
                                <option value="mentioned_only">{isAr ? 'الحسابات المذكورة فقط' : 'Mentioned accounts only'}</option>
                              </select>
                            </label>
                            <label className="block text-[10px] font-bold text-slate-600">
                              {isAr ? 'النص البديل للصورة' : 'Image alt text'}
                              <textarea value={options.altText} maxLength={1000} rows={2} onChange={event => update({ altText: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" />
                            </label>
                          </fieldset>
                        )
                      })}
                    </div>
                  )}

                  {approvedAutoTargets.includes('PINTEREST') && (
                    <div className="space-y-3 rounded-lg border border-rose-100 bg-white p-3">
                      <div>
                        <p className="text-[11px] font-black text-slate-800">Pinterest</p>
                        <p className="mt-1 text-[10px] leading-4 text-slate-500">
                          {pinterestAccount
                            ? (isAr ? `الحساب: ${pinterestAccount.accountName || 'Pinterest'} · المستوى: ${pinterestAccount.accessTier || 'TRIAL'}` : `Account: ${pinterestAccount.accountName || 'Pinterest'} · tier: ${pinterestAccount.accessTier || 'TRIAL'}`)
                            : (isAr ? 'لا يوجد حساب Pinterest متصل.' : 'No Pinterest account is connected.')}
                        </p>
                        {pinterestAccount?.accessTier !== 'STANDARD' && <p className="mt-1 rounded-md bg-amber-50 p-2 text-[10px] font-semibold leading-4 text-amber-800">{isAr ? 'يلزم Pinterest Standard access قبل جدولة Pins عامة.' : 'Pinterest Standard access is required before scheduling public Pins.'}</p>}
                      </div>
                      {approvedPinterestPosts.map((post, index) => {
                        const onlyBoardId = pinterestAccount?.boards?.length === 1 ? pinterestAccount.boards[0].id : ''
                        const options = pinterestOptionsByPostId[post.id] || defaultPinterestScheduleOptions(post, onlyBoardId)
                        const update = (patch: Partial<PinterestScheduleOptions>) => setPinterestOptionsByPostId(current => ({ ...current, [post.id]: { ...(current[post.id] || defaultPinterestScheduleOptions(post, onlyBoardId)), ...patch } }))
                        return (
                          <fieldset key={post.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <legend className="px-1 text-[10px] font-black text-slate-700">{isAr ? `Pin ${index + 1}` : `Pin ${index + 1}`}</legend>
                            {post.isVideoPost && <p className="rounded-md bg-amber-50 p-2 text-[10px] font-semibold text-amber-800">{isAr ? 'هذا فيديو؛ ناشر Pinterest الحالي يقبل صورًا معتمدة فقط.' : 'This is a video; the current Pinterest publisher accepts approved images only.'}</p>}
                            <label className="block text-[10px] font-bold text-slate-600">{isAr ? 'لوحة النشر' : 'Publishing Board'}<select value={options.boardId} onChange={event => update({ boardId: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">{isAr ? 'اختر اللوحة' : 'Select Board'}</option>{(pinterestAccount?.boards || []).map(board => <option key={board.id} value={board.id}>{board.name}</option>)}</select></label>
                            <label className="block text-[10px] font-bold text-slate-600">{isAr ? 'عنوان Pin' : 'Pin title'}<input value={options.title} maxLength={100} onChange={event => update({ title: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs" /></label>
                            <label className="block text-[10px] font-bold text-slate-600">{isAr ? 'النص البديل' : 'Alt text'}<textarea value={options.altText} maxLength={500} rows={2} onChange={event => update({ altText: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" /></label>
                            <label className="block text-[10px] font-bold text-slate-600">{isAr ? 'رابط الوجهة — اختياري' : 'Destination URL — optional'}<input type="url" value={options.destinationLink} placeholder="https://" onChange={event => update({ destinationLink: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs" /></label>
                            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2 text-[10px] text-slate-600">
                              <p className="font-black text-slate-700">{isAr ? 'إفصاح الذكاء الاصطناعي' : 'AI disclosure'}</p>
                              <label className="flex items-start gap-2"><input type="checkbox" checked={options.aiModified} onChange={event => update({ aiModified: event.target.checked })} />{isAr ? 'الصورة الواقعية عُدلت بدرجة كبيرة بالذكاء الاصطناعي' : 'Realistic image was substantially AI-modified'}</label>
                              <label className="flex items-start gap-2"><input type="checkbox" checked={options.syntheticPerformer} onChange={event => update({ syntheticPerformer: event.target.checked })} />{isAr ? 'تحتوي على مؤدٍ أو شخص اصطناعي' : 'Contains a synthetic performer or person'}</label>
                              <label className="flex items-start gap-2 font-semibold text-slate-700"><input type="checkbox" checked={options.aiDisclosureReviewed} onChange={event => update({ aiDisclosureReviewed: event.target.checked })} />{isAr ? 'راجعت الإفصاح واخترت القيم الصحيحة.' : 'I reviewed the disclosure and selected the correct values.'}</label>
                            </div>
                          </fieldset>
                        )
                      })}
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

                  {pinterestAutoReviewIncomplete && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                      {isAr ? 'أكمل كل إعدادات Pinterest واختر لوحة، وراجع الإفصاح، وتأكد من Standard access وصورة ووصف لا يتجاوز 800 حرف.' : 'Complete every Pinterest setting, select a Board, review the disclosure, and confirm Standard access, an image, and copy no longer than 800 characters.'}
                    </p>
                  )}

                  {threadsAutoReviewIncomplete && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-900">
                      {isAr ? 'أكمل إعدادات Threads، وتأكد من وضع Live، ونص لا يتجاوز 500 حرف، وصورة مع نص بديل، وعدم وجود فيديو.' : 'Complete Threads settings and confirm Live mode, copy no longer than 500 characters, an image with alt text, and no video.'}
                    </p>
                  )}
                </div>
              )}

              <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-900">
                  {isAr ? 'راجع تاريخ ووقت كل منشور' : 'Review every post date and time'}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {isAr
                    ? 'المواعيد المقترحة لا تصبح جدولًا حقيقيًا إلا بعد مراجعتها هنا وتأكيد القرار.'
                    : 'Proposed dates become a real internal schedule only after you review them here and confirm this decision.'}
                </p>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {reviewedScheduleDates.map(({ post, inputValue, time }, index) => {
                    const dateNeedsReview = Number.isNaN(time) || time <= Date.now()
                    return (
                      <label
                        key={post.id}
                        className={`grid gap-2 rounded-lg border p-2 text-xs sm:grid-cols-[1fr_12rem] sm:items-center ${
                          dateNeedsReview ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <span>
                          <span className="block font-bold text-slate-900">
                            {isAr ? `المنشور ${index + 1}` : `Post ${index + 1}`} · {post.platform.toUpperCase()}
                          </span>
                          <span className={dateNeedsReview ? 'text-rose-700' : 'text-slate-500'}>
                            {dateNeedsReview
                              ? (isAr ? 'اختر موعدًا مستقبليًا' : 'Choose a future time')
                              : (isAr ? 'موعد صالح للمراجعة' : 'Future time reviewed')}
                          </span>
                        </span>
                        <input
                          type="datetime-local"
                          value={inputValue}
                          min={toLocalScheduleInputValue(new Date(Date.now() + 60_000))}
                          disabled={scheduling}
                          onChange={event => {
                            setScheduleDateByPostId(current => ({ ...current, [post.id]: event.target.value }))
                            setScheduleAcknowledged(false)
                          }}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>

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

              {scheduleDateReviewIssues.length > 0 && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
                  {isAr
                    ? `${scheduleDateReviewIssues.length} منشور يحتاج موعدًا مستقبليًا قبل إنشاء الجدول الداخلي.`
                    : `${scheduleDateReviewIssues.length} post${scheduleDateReviewIssues.length === 1 ? '' : 's'} need a future time before the internal schedule can be saved.`}
                </p>
              )}

              {schedulingBlockedByMedia && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  {approvedPostsNeedingMediaCount > 0
                    ? (isAr
                        ? `${approvedPostsNeedingMediaCount} منشورات ما زالت بلا وسائط مكتملة. أغلق هذه النافذة وأكمل الوسائط قبل الجدولة.`
                        : `${approvedPostsNeedingMediaCount} post${approvedPostsNeedingMediaCount === 1 ? '' : 's'} still lack complete media. Close this dialog and finish the media first.`)
                    : (isAr
                        ? `${approvedPostsNeedingMediaApprovalCount} منشورات تحتاج اعتماد الوسائط النهائية قبل الجدولة.`
                        : `${approvedPostsNeedingMediaApprovalCount} post${approvedPostsNeedingMediaApprovalCount === 1 ? '' : 's'} need final media approval before scheduling.`)}
                </p>
              )}

              {schedulingBlockedByTruthReview && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
                  {isAr
                    ? 'يحتوي المحتوى المعتمد على صياغات عامة أو ملاحظات جودة. أعده للمراجعة أو أعد توليده قبل الجدولة.'
                    : 'Approved content contains generic wording or other quality findings. Reopen or regenerate it before scheduling.'}
                </p>
              )}

              {error && (
                <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                  {error}
                </div>
              )}

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={scheduleAcknowledged}
                  disabled={scheduling || approvedCount === 0 || schedulingDecisionBlocked}
                  onChange={event => setScheduleAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#5E63FF]"
                />
                <span>
                  {isAr
                    ? (scheduleMode === 'AUTO'
                        ? 'راجعت النصوص والوسائط النهائية والتواريخ والوجهات، وأوافق صراحةً أن يرسل NEXUS المنشورات المعتمدة إلى المنصات في مواعيدها.'
                        : 'راجعت النصوص والوسائط النهائية وعدد المنشورات والتواريخ، وأفهم أن هذه جدولة للتنفيذ اليدوي ولا تعني النشر.')
                    : (scheduleMode === 'AUTO'
                        ? 'I reviewed the copy, final media, dates, and destinations, and explicitly authorize NEXUS to send these approved posts at their scheduled times.'
                        : 'I reviewed the copy, final media, post count, and dates, and understand this is a manual execution schedule, not publishing.')}
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
                  disabled={scheduling || !scheduleAcknowledged || approvedCount === 0 || schedulingDecisionBlocked}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {scheduling
                    ? t('contentHub.scheduling')
                    : (isAr
                        ? approvedCount === 1
                          ? 'تأكيد جدولة منشور واحد'
                          : `تأكيد جدولة ${approvedCount} منشورات`
                        : `Confirm scheduling ${approvedCount} post${approvedCount === 1 ? '' : 's'}`)}
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
                        {isAr && approveResult.approved === 1
                          ? (approveResult.kind === 'scheduled' ? 'تمت جدولة منشور واحد' : 'تم اعتماد منشور واحد')
                          : `${approveResult.approved} ${approveResult.kind === 'scheduled'
                            ? t('contentHub.postsScheduled')
                            : t('contentHub.postsApproved')}`}
                      </h3>
                      <p className="text-sm text-emerald-600">
                        {approveResult.kind === 'scheduled'
                          ? (isAr ? 'تمت الجدولة فقط — لم يتم النشر' : 'Scheduled only — not published')
                          : (isAr ? 'تم حفظ الاعتماد — ما زالت الجدولة خطوة منفصلة' : 'Approval saved — scheduling is still separate')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={isAr ? 'إغلاق ملخص العملية' : 'Close operation summary'}
                    onClick={() => setApproveResult(null)}
                    className="text-slate-400 hover:text-slate-700 text-xl leading-none"
                  >×</button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="text-2xl font-bold text-slate-950">{approveResult.approved}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{isAr ? (approveResult.approved === 1 ? 'منشور' : 'منشورات') : (approveResult.approved === 1 ? 'Post' : 'Posts')}</div>
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
                    <div className="text-2xl font-bold text-cyan-600">{approveResult.pendingMedia}</div>
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
                    background: approveResult.pendingMedia > 0
                      ? '#F5F3FF'
                      : approveResult.kind === 'approved'
                      ? '#F8FAFC'
                      : approveResult.unlinked > 0
                      ? '#FFFBEB'
                      : '#ECFDF5',
                    border: approveResult.pendingMedia > 0
                      ? '1px solid rgba(94,92,230,0.18)'
                      : approveResult.kind === 'approved'
                      ? '1px solid rgba(15,23,42,0.10)'
                      : approveResult.unlinked > 0
                      ? '1px solid rgba(245,158,11,0.2)'
                      : '1px solid rgba(5,150,105,0.22)',
                  }}>
                  <span className="text-lg mt-0.5">
                    {approveResult.pendingMedia > 0 ? '⚠️' : approveResult.kind === 'approved' ? '📝' : approveResult.unlinked > 0 ? '🔌' : '📅'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold mb-0.5"
                      style={{ color: approveResult.pendingMedia > 0 ? '#5E5CE6' : approveResult.kind === 'approved' ? '#334155' : approveResult.unlinked > 0 ? '#B45309' : '#047857' }}>
                      {approveResult.pendingMedia > 0
                        ? (isAr ? 'مطلوب: أكمل وسائط المنشورات قبل الجدولة' : 'Required: complete post media before scheduling')
                        : approveResult.kind === 'approved'
                        ? (isAr ? 'التالي: راجع الخطة قبل الجدولة' : 'Next: review the plan before scheduling')
                        : approveResult.unlinked > 0
                        ? (isAr ? 'قبل النشر: اربط منصات النشر' : 'Before publishing: connect platforms')
                        : (isAr ? 'التالي: راجع المحتوى المجدول' : 'Next: review scheduled content')}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {approveResult.pendingMedia > 0
                        ? (isAr
                          ? `${approveResult.pendingMedia} من ${approveResult.totalMedia} خانات وسائط ما زالت غير مكتملة (${approveResult.pendingImages} صور و${Math.max(0, approveResult.pendingMedia - approveResult.pendingImages)} فيديو). لن يسمح NEXUS بجدولتها أو نشرها قبل اكتمال مراجعة الوسائط.`
                          : `${approveResult.pendingMedia} of ${approveResult.totalMedia} media slots remain incomplete (${approveResult.pendingImages} images and ${Math.max(0, approveResult.pendingMedia - approveResult.pendingImages)} videos). NEXUS will not allow scheduling or publishing until media review is complete.`)
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
                          ? `${approveResult.unlinked === 1 ? 'منشور واحد' : `${approveResult.unlinked} منشورات`} بلا حساب نشر متصل حتى الآن. اربط الحسابات من `
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
                  {approveResult.pendingMedia > 0 ? (
                    approveResult.pendingImages > 0 ? (
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
                    ) : null
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
                    className={`${approveResult.pendingMedia > 0 || approveResult.unlinked > 0 ? 'flex-1' : 'w-full'} px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border`}
                    style={{ borderColor: 'rgba(5,150,105,0.24)', color: '#047857', background: '#FFFFFF' }}
                  >
                    {approveResult.pendingMedia > 0 ? '🖼️' : '📅'} {approveResult.pendingMedia > 0
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

        {showCreativeScanConfirm && creativeIntelligence && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.36)', backdropFilter: 'blur(12px)' }} onClick={closeCreativeScanConfirm}>
            <div role="dialog" aria-modal="true" aria-labelledby="creative-scan-title" className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
              <div className="bg-slate-950 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">NEXUS CREATIVE INTELLIGENCE</p>
                    <h3 id="creative-scan-title" className="mt-1 text-xl font-black">{isAr ? 'تحليل ومطابقة وسائط الحملة' : 'Analyze and match campaign media'}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {isAr
                        ? `سيحلل NEXUS الأدلة المرئية في ${creativeIntelligence.summary.batchSize} أصول ثم يرتب أفضل تطابق لكل بوست.`
                        : `NEXUS will analyze visible evidence in ${creativeIntelligence.summary.batchSize} assets and rank the best match for each post.`}
                    </p>
                  </div>
                  <button type="button" aria-label={isAr ? 'إغلاق نافذة تحليل الوسائط' : 'Close media analysis'} onClick={closeCreativeScanConfirm} disabled={creativeScanning} className="text-2xl text-slate-400 hover:text-white disabled:opacity-40">×</button>
                </div>
              </div>
              <div className="p-6">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs leading-6 text-violet-950/80">
                  <p>✓ {isAr ? 'وصف ما يظهر فعليًا في الصور ولقطات الفيديو' : 'Describe only what is visibly present in images and video frames'}</p>
                  <p>✓ {isAr ? 'درجة مطابقة وأسباب وفجوات لكل بوست' : 'Match score, reasons, and gaps for each post'}</p>
                  <p>✓ {isAr ? `التكلفة الإجمالية: ${CONTENT_HUB_MEDIA_INTELLIGENCE_COST} كريديت` : `Total cost: ${CONTENT_HUB_MEDIA_INTELLIGENCE_COST} credits`}</p>
                  <p>— {isAr ? 'لا تأكيد لحقوق الاستخدام ولا تحليل للصوت في هذه المرحلة' : 'Usage rights are not confirmed and audio is not analyzed in this pass'}</p>
                  <p>— {isAr ? 'لا إرفاق أو تعديل أو موافقة أو نشر تلقائي' : 'No automatic attachment, editing, approval, or publishing'}</p>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                  <input type="checkbox" checked={creativeScanAcknowledged} onChange={event => setCreativeScanAcknowledged(event.target.checked)} disabled={creativeScanning} className="mt-1" />
                  <span className="text-xs font-semibold leading-6 text-slate-700">
                    {isAr
                      ? `أوافق على خصم ${CONTENT_HUB_MEDIA_INTELLIGENCE_COST} كريديت لتحليل ${creativeIntelligence.summary.batchSize} أصول، وأفهم أن النتائج اقتراحات للمراجعة فقط.`
                      : `I approve a ${CONTENT_HUB_MEDIA_INTELLIGENCE_COST}-credit charge to analyze ${creativeIntelligence.summary.batchSize} assets and understand the results are review-only recommendations.`}
                  </span>
                </label>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={closeCreativeScanConfirm} disabled={creativeScanning} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button type="button" onClick={confirmCreativeScan} disabled={!creativeScanAcknowledged || creativeScanning} className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                    {creativeScanning ? (isAr ? 'جارٍ التحليل…' : 'Analyzing…') : (isAr ? `ابدأ — ${CONTENT_HUB_MEDIA_INTELLIGENCE_COST} كريديت` : `Start — ${CONTENT_HUB_MEDIA_INTELLIGENCE_COST} credits`)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {creativeAdaptation && (
          <CreativeAdaptationModal
            isAr={isAr}
            postIndex={posts.find(post => post.id === creativeAdaptation.postId)?.contentPlanIndex ?? 0}
            media={creativeAdaptation.media}
            acknowledged={creativeAdaptationAcknowledged}
            adapting={adaptingCreativePostId === creativeAdaptation.postId}
            onAcknowledgedChange={setCreativeAdaptationAcknowledged}
            onClose={closeCreativeAdaptation}
            onConfirm={confirmCreativeAdaptation}
          />
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
                <h3 className="font-semibold text-slate-950">
                  {isAr ? 'اختر من مكتبة الوسائط' : 'Choose from Media Library'}
                </h3>
                <button
                  type="button"
                  aria-label={isAr ? 'إغلاق مكتبة الوسائط' : 'Close media library'}
                  onClick={() => setMediaPickerOpen(null)}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >×</button>
              </div>
              {mediaPickerItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="mb-3">{mediaPickerPost?.isVideoPost
                    ? (isAr ? 'لا توجد فيديوهات مرفوعة جاهزة لهذه الحملة بعد' : 'No uploaded videos are ready for this campaign yet')
                    : (isAr ? 'لا توجد أصول صور جاهزة لهذه الحملة بعد' : 'No image assets are ready for this campaign yet')}</p>
                  <button
                    type="button"
                    onClick={() => router.push('/media')}
                    className="text-sm text-[#5E5CE6] hover:text-[#4845C7]"
                  >
                    {isAr ? 'اذهب إلى مكتبة الوسائط ←' : 'Go to Media Library →'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                  {mediaPickerItems.map(m => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => mediaPickerOpen && requestMediaAttachment(mediaPickerOpen, m)}
                        className="relative group aspect-square rounded-xl overflow-hidden transition-all hover:ring-2 hover:ring-purple-500"
                      >
                        {mediaPickerPost?.isVideoPost
                          ? <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          : <img src={m.url} alt={m.fileName} className="w-full h-full object-cover" />}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white text-xs font-medium">{isAr ? 'استخدم هذا الأصل' : 'Use this'}</span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {pendingMediaAttachment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.30)', backdropFilter: 'blur(10px)' }} onClick={closeMediaAttachmentConfirm}>
            <div role="dialog" aria-modal="true" aria-labelledby="media-attachment-title" className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ border: '1px solid rgba(15,23,42,0.10)' }} onClick={e => e.stopPropagation()}>
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 id="media-attachment-title" className="text-base font-bold text-slate-950">
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
                  <button type="button" aria-label={isAr ? 'إغلاق تأكيد ربط الوسائط' : 'Close media attachment confirmation'} onClick={closeMediaAttachmentConfirm} disabled={mediaAttachmentSaving} className="text-xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-40">×</button>
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {['video', 'VIDEO'].includes(pendingMediaAttachment.media.type)
                    ? <video src={pendingMediaAttachment.media.url} muted playsInline preload="metadata" className="h-16 w-16 rounded-lg object-cover" />
                    : <img src={pendingMediaAttachment.media.url} alt={pendingMediaAttachment.media.fileName} className="h-16 w-16 rounded-lg object-cover" />}
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
                    disabled={mediaAttachmentSaving}
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
                {error && (
                  <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                    {error}
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={closeMediaAttachmentConfirm} disabled={mediaAttachmentSaving} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmMediaAttachment}
                    disabled={!mediaAttachmentAcknowledged || mediaAttachmentSaving}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: '#111827' }}
                  >
                    {mediaAttachmentSaving
                      ? (isAr ? 'جارٍ حفظ الارتباط...' : 'Saving attachment...')
                      : pendingMediaAttachment.action === 'replace'
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
                  <button type="button" aria-label={isAr ? 'إغلاق تأكيد إزالة الوسائط' : 'Close media removal confirmation'} onClick={closeMediaRemovalConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.34)', backdropFilter: 'blur(12px)' }} onClick={closeImageGenerationConfirm}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="nexus-image-studio-title"
              className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
              style={{ border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-slate-950 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">NEXUS IMAGE STUDIO · QUALITY-GATED VISUAL</p>
                    <h3 id="nexus-image-studio-title" className="mt-1 text-xl font-bold">
                      {isAr ? 'إنتاج صورة إعلانية احترافية' : 'Produce a professional ad image'}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                      {isAr
                        ? `سينتج NEXUS أصلاً بصريًا احترافيًا للمنشور #${imageGenerationConfirmPost.contentPlanIndex} ويفحصه قبل الربط. يظل النص العربي أو الإنجليزي قابلاً للتحرير في المنشور بدل حرقه داخل البيكسلات.`
                        : `NEXUS will produce and inspect one professional visual for post #${imageGenerationConfirmPost.contentPlanIndex} before attachment. Arabic or English copy remains editable in the post instead of being burned into pixels.`}
                    </p>
                  </div>
                  <button aria-label={isAr ? 'إغلاق نافذة توليد الصورة' : 'Close image generation'} onClick={closeImageGenerationConfirm} disabled={Boolean(generatingImageId)} className="text-2xl leading-none text-slate-400 hover:text-white disabled:opacity-40">×</button>
                </div>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-6">
                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-950">{isAr ? 'صورة المنتج المرجعية' : 'Product reference image'}</p>
                    {imageReferenceMedia || imageGenerationConfirmPost.uploadedMediaId ? (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        {(imageReferenceMedia?.url || imageGenerationConfirmPost.imageUrl) && (
                          <img src={imageReferenceMedia?.url || imageGenerationConfirmPost.imageUrl || ''} alt={imageReferenceMedia?.fileName || ''} className="h-14 w-14 rounded-lg object-cover" />
                        )}
                        <p className="text-xs font-semibold leading-relaxed text-emerald-800">
                          {isAr
                            ? 'جاهزة كمصدر حقيقة: سيُرفض الناتج ويُسترد الكريديت إذا لم يحافظ على شكل المنتج أو الشاشة أو العبوة أو الألوان والشعار.'
                            : 'Ready as source truth: the result will be rejected and refunded if it does not preserve the product, screen, packaging, colours, and logo.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {isAr
                            ? 'اختيارية للإعلانات العامة، وموصى بها لأي إعلان منتج حتى يقارن فحص الجودة الناتج بالمصدر الحقيقي ويرفض أي استبدال.'
                            : 'Optional for general brand ads and recommended for product work so quality review can compare the output with the real source and reject any replacement.'}
                        </p>
                        <button type="button" onClick={chooseProductReferenceForImage} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-violet-700 hover:border-violet-300 hover:bg-violet-50">
                          {isAr ? 'اختر صورة المنتج من مكتبة الوسائط' : 'Choose a product image from Media Library'}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-sm font-bold text-violet-950">{isAr ? 'عقد التنفيذ' : 'Execution contract'}</p>
                    <div className="mt-3 space-y-2 text-xs leading-relaxed text-violet-950/75">
                      <p>✓ {isAr ? 'فحص بصري قبل الاعتماد والربط' : 'Visual QA before approval and attachment'}</p>
                      <p>✓ {isAr ? 'النص يظل قابلاً للتحرير خارج الصورة' : 'Copy stays editable outside the image'}</p>
                      <p>✓ {isAr ? 'حماية صورة المرجع عند استخدامها' : 'Reference fidelity protection when supplied'}</p>
                      <p>✓ {isAr ? `التكلفة: ${CONTENT_HUB_IMAGE_COST} كريديت` : `Cost: ${CONTENT_HUB_IMAGE_COST} credits`}</p>
                      <p>✓ {imageDailyCapacityLabel}</p>
                      <p>✓ {isAr ? 'حفظ دائم وربط بالمنشور' : 'Durable storage and post attachment'}</p>
                      <p>✓ {isAr ? 'استرداد تلقائي إذا لم ينتج أصل صالح' : 'Automatic restoration if no usable asset is produced'}</p>
                      <p>— {isAr ? 'لا نشر، لا جدولة، ولا تحديث تلقائي لـBrand Brain' : 'No publish, schedule, or automatic Brand Brain update'}</p>
                    </div>
                  </div>
                </div>

                {imageGenerationReopensReview && (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-800">
                    {isAr
                      ? 'ربط الصورة الجديدة سيعيد المنشور لمسودة ويلغي الاعتماد وقرار التنفيذ حتى تراجعه من جديد.'
                      : 'Attaching the new image reopens this post as a draft and clears approval and execution assignment until you review it again.'}
                  </p>
                )}

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <input
                    type="checkbox"
                    checked={imageGenerationAcknowledged}
                    onChange={e => setImageGenerationAcknowledged(e.target.checked)}
                    disabled={Boolean(generatingImageId)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600"
                  />
                  <span className="text-sm font-semibold leading-relaxed text-slate-800">
                    {isAr
                      ? `أوافق على خصم ${CONTENT_HUB_IMAGE_COST} كريديت لإنتاج صورة إعلانية للمراجعة فقط، وأفهم أنها لن تُنشر أو تُجدول تلقائيًا.`
                      : `I approve a ${CONTENT_HUB_IMAGE_COST}-credit charge for one review-only ad image and understand it will not be published or scheduled automatically.`}
                  </span>
                </label>

                <div className="mt-5 flex justify-end gap-3">
                  <button onClick={closeImageGenerationConfirm} disabled={Boolean(generatingImageId)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-950">{t('contentHub.cancel')}</button>
                  <button
                    onClick={confirmPostImageGeneration}
                    disabled={Boolean(generatingImageId) || !imageGenerationAcknowledged}
                    className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatingImageId
                      ? (isAr ? 'جارٍ التوليد...' : 'Generating...')
                      : (isAr ? `ابدأ الإنتاج — ${CONTENT_HUB_IMAGE_COST} كريديت` : `Start production — ${CONTENT_HUB_IMAGE_COST} credits`)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {videoGenerationConfirmPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.34)', backdropFilter: 'blur(12px)' }} onClick={closeVideoGenerationConfirm}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="nexus-video-studio-title"
              className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
              style={{ border: '1px solid rgba(15,23,42,0.10)' }}
              onClick={event => event.stopPropagation()}
            >
              <div className="bg-slate-950 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">NEXUS VIDEO STUDIO</p>
                    <h3 id="nexus-video-studio-title" className="mt-1 text-xl font-bold">
                      {videoProductionMode === 'PHOTO_FILM'
                        ? (isAr ? 'حوّل صور العقار إلى إعلان احترافي' : 'Turn property photos into a professional ad')
                        : videoProductionMode === 'MOTION_DESIGN'
                          ? (isAr ? 'حوّل فيديو المنتج إلى Motion Design' : 'Turn your product video into Motion Design')
                          : videoProductionMode === 'CAMPAIGN_FILM'
                            ? (isAr ? 'إنتاج Concept Film مولّد متعدد اللقطات' : 'Produce a generated multi-shot concept film')
                            : (isAr ? 'إنتاج إعلان يستند إلى صور المنتج' : 'Produce a product-referenced ad')}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                      {videoProductionMode === 'PHOTO_FILM'
                        ? (isAr
                          ? `يرتب NEXUS من ${PROPERTY_PHOTO_FILM_MIN_REFERENCES} إلى ${PROPERTY_PHOTO_FILM_MAX_REFERENCES} صور محللة لنفس العقار في فيلم مدته ${PROPERTY_PHOTO_FILM_DURATION_SECONDS} ثوانٍ بحركة كاميرا وانتقالات وTypography وصوت اختياري مرخّص تجاريًا. لا يولّد غرفة أو واجهة أو سعرًا أو موقعًا جديدًا.`
                          : `NEXUS edits ${PROPERTY_PHOTO_FILM_MIN_REFERENCES}–${PROPERTY_PHOTO_FILM_MAX_REFERENCES} analysed photos of the same property into a ${PROPERTY_PHOTO_FILM_DURATION_SECONDS}-second film with camera motion, transitions, typography, and an optional commercially licensed voice. It generates no room, facade, price, or location.`)
                        : videoProductionMode === 'MOTION_DESIGN'
                          ? (isAr
                            ? `يبني NEXUS إعلانًا بطبقات ومشاهد وانتقالات وTypography وصوت أصلي فوق الفيديو الحقيقي، مع إبقاء كل ادعاء مطابقًا للنص المعتمد. لا يولّد أشخاصًا أو منتجًا أو مشاهد توصيل جديدة.`
                            : `NEXUS builds a layered ad with scenes, transitions, typography, and original sound design over the real source while keeping every claim grounded in approved copy. It generates no people, product, or delivery scenes.`)
                          : videoProductionMode === 'CAMPAIGN_FILM'
                            ? (isAr
                              ? `ينتج NEXUS فيلمًا مدته ${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS} ثوانٍ من 3 لقطات: Hook متحرك، لقطة منفعة، ثم End Frame بالهوية؛ مع حركة مشاهد وعناصر وكاميرا وصوت وانتقالات وTypography عربي/إنجليزي منفصل عن الصورة.`
                              : `NEXUS produces a ${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS}-second three-shot film: moving hook, benefit shot, and branded end frame—with scene, subject, and camera motion, sound, cuts, and separately typeset Arabic/English typography.`)
                            : (isAr
                              ? `يبني NEXUS إعلانًا مدته ${CINEMATIC_PRODUCT_AD_DURATION_SECONDS} ثوانٍ من صور منتج معزولة ومؤهلة، ثم يرفض الناتج إذا لم يحافظ على المنتج بدرجة كافية. لا يبدأ الإنفاق قبل اجتياز فحص الأصول.`
                              : `NEXUS builds an ${CINEMATIC_PRODUCT_AD_DURATION_SECONDS}-second ad from qualified isolated product photos, then rejects the output if product consistency is insufficient. Provider spend cannot start before asset preflight passes.`)}
                    </p>
                  </div>
                  <button aria-label={isAr ? 'إغلاق نافذة توليد الفيديو' : 'Close video generation'} onClick={closeVideoGenerationConfirm} disabled={Boolean(generatingVideoId)} className="text-2xl leading-none text-slate-400 hover:text-white disabled:opacity-40">×</button>
                </div>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-6">
                <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-bold text-emerald-950">
                    {isAr ? 'المسار الموصى به: استخدم أصلًا حقيقيًا تملكه' : 'Recommended route: use a real source asset you own'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                    {isAr
                      ? 'Property Photo Film وMotion Design يحافظان على الأصول الأصلية. مسارا المنتج والـConcept يستخدمان توليدًا خارجيًا ويظلان خيارات متخصصة.'
                      : 'Property Photo Film and Motion Design preserve original assets. Product and Concept routes use external generation and remain specialist options.'}
                  </p>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoProductionMode('PHOTO_FILM')
                      setMotionDesignSourceMediaId(null)
                      setVideoGenerationAcknowledged(false)
                      setVideoSamePropertyAcknowledged(false)
                    }}
                    disabled={Boolean(generatingVideoId)}
                    className={`rounded-2xl border p-4 text-left transition-all ${videoProductionMode === 'PHOTO_FILM' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                  >
                    <p className="text-sm font-bold text-slate-950">{isAr ? `فيلم صور عقاري · ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} كريديت` : `Property photo film · ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} credits`}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{isAr ? 'الموصى به للعقار: يحافظ على الصور ويمنع اختراع تفاصيل القائمة.' : 'Recommended for real estate: preserves photos and blocks invented listing facts.'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoProductionMode('MOTION_DESIGN')
                      setVideoReferenceMediaIds([])
                      setVideoGenerationAcknowledged(false)
                      setVideoSamePropertyAcknowledged(false)
                    }}
                    disabled={Boolean(generatingVideoId)}
                    className={`rounded-2xl border p-4 text-left transition-all ${videoProductionMode === 'MOTION_DESIGN' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'}`}
                  >
                    <p className="text-sm font-bold text-slate-950">{isAr ? `تحريك فيديو أصلي · ${CONTENT_HUB_MOTION_DESIGN_COST} كريديت` : `Animate source video · ${CONTENT_HUB_MOTION_DESIGN_COST} credits`}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{isAr ? 'المسار الأساسي: مونتاج يحافظ على المصدر الحقيقي.' : 'Primary route: a source-preserving edit from real footage.'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoProductionMode('CINEMATIC')
                      setVideoGenerationAcknowledged(false)
                      setVideoSamePropertyAcknowledged(false)
                    }}
                    disabled={Boolean(generatingVideoId)}
                    className={`rounded-2xl border p-4 text-left transition-all ${videoProductionMode === 'CINEMATIC' ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white'}`}
                  >
                    <p className="text-sm font-bold text-slate-950">{isAr ? `دقة المنتج · ${CONTENT_HUB_VIDEO_COST} كريديت` : `Product fidelity · ${CONTENT_HUB_VIDEO_COST} credits`}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{isAr ? 'لصور منتج حقيقية من عدة زوايا؛ يبدأ فقط بعد تأهيل الأصول.' : 'For real multi-angle product photos; starts only after asset qualification.'}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoProductionMode('CAMPAIGN_FILM')
                      setVideoReferenceMediaIds([])
                      setVideoGenerationAcknowledged(false)
                      setVideoSamePropertyAcknowledged(false)
                    }}
                    disabled={Boolean(generatingVideoId)}
                    className={`rounded-2xl border p-4 text-left transition-all ${videoProductionMode === 'CAMPAIGN_FILM' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                  >
                    <p className="text-sm font-bold text-slate-950">{isAr ? `Concept Film تجريبي · ${CONTENT_HUB_VIDEO_COST} كريديت` : `Experimental concept film · ${CONTENT_HUB_VIDEO_COST} credits`}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{isAr ? 'للتصور الإبداعي فقط؛ لا يثبت منتجًا أو عملية حقيقية، ويُوقف بعد تكرار رفض الجودة.' : 'Creative exploration only; it proves no real product or process and locks after repeated QA rejection.'}</p>
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  {videoProductionMode === 'PHOTO_FILM' ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-950">{isAr ? 'صور نفس العقار — بالترتيب' : 'Same-property photos — in sequence'}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {isAr
                              ? `اختر ${PROPERTY_PHOTO_FILM_MIN_REFERENCES}–${PROPERTY_PHOTO_FILM_MAX_REFERENCES} صور محللة. ترتيب الاختيار هو ترتيب ظهورها. الصور فقط هي الدليل؛ لا يولّد NEXUS أي مشهد عقاري.`
                              : `Choose ${PROPERTY_PHOTO_FILM_MIN_REFERENCES}–${PROPERTY_PHOTO_FILM_MAX_REFERENCES} analysed photos. Selection order is playback order. The photos are the only visual evidence; NEXUS generates no property scene.`}
                          </p>
                        </div>
                        {videoReferenceMediaIds.length > 0 && (
                          <button type="button" onClick={() => setVideoReferenceMediaIds([])} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                            {isAr ? 'إزالة الكل' : 'Clear all'}
                          </button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {videoReferenceImages.map(media => (
                          <button
                            key={media.id}
                            type="button"
                            aria-pressed={videoReferenceMediaIds.includes(media.id)}
                            onClick={() => setVideoReferenceMediaIds(current => (
                              current.includes(media.id)
                                ? current.filter(id => id !== media.id)
                                : current.length < PROPERTY_PHOTO_FILM_MAX_REFERENCES
                                  ? [...current, media.id]
                                  : current
                            ))}
                            className="relative aspect-square overflow-hidden rounded-xl border-2 bg-white transition-all"
                            style={{ borderColor: videoReferenceMediaIds.includes(media.id) ? '#059669' : 'transparent' }}
                            title={media.fileName}
                          >
                            <img src={media.url} alt={media.fileName} className="h-full w-full object-cover" />
                            {videoReferenceMediaIds.includes(media.id) && (
                              <span className="absolute right-1 top-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                {videoReferenceMediaIds.indexOf(media.id) + 1}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      {videoReferenceImages.length === 0 && (
                        <button type="button" onClick={() => router.push('/media')} className="mt-3 w-full rounded-xl border border-dashed border-emerald-300 bg-white px-3 py-3 text-xs font-semibold text-emerald-800">
                          {isAr ? 'ارفع صور العقار في مكتبة الوسائط ثم حلّلها' : 'Upload and analyse property photos in Media Library'}
                        </button>
                      )}
                      <div className={`mt-3 rounded-xl border px-3 py-3 text-xs leading-relaxed ${propertyPhotoFilmPreflight.eligible ? 'border-emerald-200 bg-white text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                        <p className="font-bold">
                          {propertyPhotoFilmPreflight.eligible
                            ? (isAr ? '✓ الصور مؤهلة لمسار يحافظ على المصدر' : '✓ Photos qualify for source-locked production')
                            : (isAr ? 'اختر مجموعة صور عقارية مؤهلة' : 'Choose a qualified property photo set')}
                        </p>
                        {!propertyPhotoFilmPreflight.eligible && propertyPhotoFilmPreflight.issues.slice(0, 3).map(issue => (
                          <p key={`${issue.code}-${issue.mediaId || 'set'}`} className="mt-1">• {issue.message}</p>
                        ))}
                      </div>
                    </div>
                  ) : videoProductionMode === 'MOTION_DESIGN' ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-950">{isAr ? 'الفيديو الأصلي' : 'Original source video'}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {isAr ? 'اختر فيديو أصليًا محللًا للمنتج أو العبوة أو الديمو أو تسجيل الشاشة. يستخدم NEXUS الجزء الافتتاحي الآمن فقط ويمنع إعادة معالجة ناتج سابق.' : 'Choose one analysed original product, packaging, demo, or screen-recording video. NEXUS uses only the safe opening segment and blocks recursive rendering.'}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {motionDesignVideos.map(media => (
                          <button
                            key={media.id}
                            type="button"
                            aria-pressed={motionDesignSourceMediaId === media.id}
                            onClick={() => setMotionDesignSourceMediaId(media.id)}
                            className="overflow-hidden rounded-xl border-2 bg-slate-950 text-left transition-all"
                            style={{ borderColor: motionDesignSourceMediaId === media.id ? '#5E5CE6' : 'transparent' }}
                          >
                            <video src={media.url} muted playsInline preload="metadata" className="aspect-video w-full object-cover" />
                            <span className="block truncate bg-white px-2 py-2 text-[10px] font-semibold text-slate-700">{media.fileName}</span>
                          </button>
                        ))}
                      </div>
                      {motionDesignVideos.length === 0 && (
                        <button type="button" onClick={() => router.push('/media')} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-violet-700">
                          {isAr ? 'ارفع فيديو المنتج من مكتبة الوسائط ثم حلّله' : 'Upload and analyse a product video in Media Library'}
                        </button>
                      )}
                      <div className={`mt-3 rounded-xl border px-3 py-3 text-xs leading-relaxed ${motionDesignPreflight.eligible ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                        <p className="font-bold">{motionDesignPreflight.eligible ? (isAr ? '✓ المصدر مؤهل ومحمي' : '✓ Source qualified and locked') : (isAr ? 'اختر مصدرًا مؤهلاً' : 'Choose a qualified source')}</p>
                        {!motionDesignPreflight.eligible && motionDesignPreflight.issues.slice(0, 3).map(issue => <p key={issue.code} className="mt-1">• {videoPreflightIssueCopy(issue)}</p>)}
                      </div>
                    </div>
                  ) : videoProductionMode === 'CAMPAIGN_FILM' ? (
                    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-slate-950 to-slate-900 p-4 text-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">{isAr ? 'فيلم إعلاني كامل — وليس صورة متحركة' : 'A complete ad film — not an animated still'}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300">
                            {isAr
                              ? 'يبني NEXUS ثلاث لقطات مولّدة خصيصًا من هدف المنشور وBrand Brain. هذا المسار لا يحتاج صورة مرجعية، ولا يدّعي الحفاظ على شكل منتج بعينه.'
                              : 'NEXUS builds three purpose-made shots from the post objective and Brand Brain. This route needs no reference image and does not claim exact product fidelity.'}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-100">
                          {isAr ? 'تجريبي · فحص إلزامي' : 'Experimental · QA required'}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {[
                          {
                            time: '0–3s',
                            title: isAr ? 'Hook بصري' : 'Visual hook',
                            body: isAr ? 'حركة مشهد أو عنصر مع حركة كاميرا تلفت الانتباه.' : 'Scene or subject motion plus camera action that earns attention.',
                          },
                          {
                            time: '3–6s',
                            title: isAr ? 'إظهار المنفعة' : 'Visible benefit',
                            body: isAr ? 'لقطة مختلفة توضّح القيمة بالفعل لا بالادعاء.' : 'A distinct shot that demonstrates value through action.',
                          },
                          {
                            time: '6–10s',
                            title: isAr ? 'Hero + CTA' : 'Hero + CTA',
                            body: isAr ? 'Payoff بصري ثم End Frame بالبراند ودعوة واضحة.' : 'Visual payoff followed by a branded, actionable end frame.',
                          },
                        ].map(item => (
                          <div key={item.time} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">{item.time}</p>
                            <p className="mt-1 text-xs font-bold text-white">{item.title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{item.body}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
                        {isAr
                          ? 'تنبيه صريح: هذا Concept Film بمشاهد مولّدة. إذا كان المطلوب نفس المنتج الحقيقي بدقة، استخدم مسار «دقة المنتج» بصور معزولة مؤهلة.'
                          : 'Truth note: this is a generated concept film. For exact real-product fidelity, use Product fidelity with qualified isolated references.'}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-950">{isAr ? 'زوايا المنتج الحقيقية' : 'Real product angles'}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{isAr ? `مطلوب ${CINEMATIC_PRODUCT_AD_MIN_REFERENCES}–${CINEMATIC_PRODUCT_AD_MAX_REFERENCES} صور محللة لنفس المنتج المادي. الواجهات والشعارات لا تدخل هذا المسار.` : `${CINEMATIC_PRODUCT_AD_MIN_REFERENCES}–${CINEMATIC_PRODUCT_AD_MAX_REFERENCES} analysed photos of the same physical product are required. Screens and logos do not enter this route.`}</p>
                        </div>
                        {videoReferenceMediaIds.length > 0 && <button type="button" onClick={() => setVideoReferenceMediaIds([])} className="text-xs font-semibold text-slate-500 hover:text-slate-900">{isAr ? 'إزالة الكل' : 'Clear all'}</button>}
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {videoReferenceImages.map(media => (
                          <button key={media.id} type="button" aria-pressed={videoReferenceMediaIds.includes(media.id)} onClick={() => setVideoReferenceMediaIds(current => current.includes(media.id) ? current.filter(id => id !== media.id) : current.length < CINEMATIC_PRODUCT_AD_MAX_REFERENCES ? [...current, media.id] : current)} className="relative aspect-square overflow-hidden rounded-xl border-2 transition-all" style={{ borderColor: videoReferenceMediaIds.includes(media.id) ? '#5E5CE6' : 'transparent' }} title={media.fileName}>
                            <img src={media.url} alt={media.fileName} className="h-full w-full object-cover" />
                            {videoReferenceMediaIds.includes(media.id) && <span className="absolute right-1 top-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{videoReferenceMediaIds.indexOf(media.id) + 1}</span>}
                          </button>
                        ))}
                      </div>
                      {videoReferenceImages.length === 0 && <button type="button" onClick={() => router.push('/media')} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-violet-700">{isAr ? 'ارفع صور المنتج من مكتبة الوسائط' : 'Upload product images in Media Library'}</button>}
                      <div className={`mt-3 rounded-xl border px-3 py-3 text-xs leading-relaxed ${cinematicVideoPreflight.eligible ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : cinematicVideoPreflight.route === 'MOTION_DESIGN_REQUIRED' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                        <p className="font-bold">{cinematicVideoPreflight.eligible ? (isAr ? '✓ الأصول مؤهلة لبدء الإنتاج والفحص' : '✓ Assets qualified for production and review') : cinematicVideoPreflight.route === 'MOTION_DESIGN_REQUIRED' ? (isAr ? 'هذه الأصول تحتاج مسار Motion Design' : 'These assets require Motion Design') : (isAr ? 'اختر زوايا منتج مؤهلة' : 'Choose qualified product angles')}</p>
                        {!cinematicVideoPreflight.eligible && cinematicVideoPreflight.issues.slice(0, 3).map(issue => <p key={`${issue.code}-${issue.mediaId || 'set'}`} className="mt-1">• {videoPreflightIssueCopy(issue)}</p>)}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-sm font-bold text-violet-950">{isAr ? 'عقد التنفيذ' : 'Execution contract'}</p>
                    <div className="mt-3 space-y-2 text-xs leading-relaxed text-violet-950/75">
                      {videoProductionMode === 'PHOTO_FILM' ? (
                        <>
                          <p>✓ {isAr ? 'الصور المختارة فقط: لا توليد غرف أو واجهات أو أشخاص أو تفاصيل عقار جديدة' : 'Selected photos only: no generated rooms, facades, people, or property details'}</p>
                          <p>✓ {isAr ? 'حركة كاميرا متبادلة وانتقالات مدروسة مع بقاء الصورة الأصلية خلف الفريم الختامي' : 'Alternating camera motion and considered transitions, with the original image held behind the final frame'}</p>
                          <p>✓ {isAr ? 'أي سعر أو موقع أو مساحة أو غرف أو توفر يُرفض ما لم يطابق دليلاً موثقًا' : 'Price, location, area, room count, or availability is rejected without source-linked proof'}</p>
                          <p>✓ {isAr ? 'Typography عقاري هادئ وصوت منفصلان عن الصور الأصلية' : 'Restrained property typography and voice remain separate from original images'}</p>
                          <p>✓ {isAr ? 'فحص الناتج مقابل كل الصور المرجعية قبل الربط' : 'Final output is checked against every reference photo before attachment'}</p>
                          <p>✓ {isAr ? 'صفر استهلاك لمزود فيديو توليدي' : 'Zero generative-video provider spend'}</p>
                          <p>✓ {isAr ? `التكلفة: ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} كريديت` : `Cost: ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} credits`}</p>
                        </>
                      ) : videoProductionMode === 'MOTION_DESIGN' ? (
                        <>
                          <p>✓ {isAr ? '3 مشاهد مونتاج حقيقية من المصدر: Hook ثم Proof ثم CTA، مع انتقالين وتدرّج حركة مختلف' : 'Three real source-derived edit scenes: Hook, Proof, and CTA, with two transitions and distinct motion treatments'}</p>
                          <p>✓ {isAr ? 'خلفية ممتدة أو Blurred Canvas بدل المساحات السوداء، مع إبقاء المنتج أو الواجهة الأصلية واضحة' : 'Full-bleed or blurred-canvas treatment instead of black letterboxing while preserving the original product or interface'}</p>
                          <p>✓ {isAr ? 'طبقات Typography منفصلة تستخرج السعر والكمية أو النطاق والمدة حرفيًا من النص المعتمد' : 'Separate typography layers extract price and quantity or scope and duration verbatim from approved copy'}</p>
                          <p>✓ {isAr ? 'Sound Design أصلي إجرائي مع ضبط مستوى الصوت؛ لا موسيقى Stock بلا ترخيص' : 'Original procedural sound design with loudness control; no unlicensed stock music'}</p>
                          <p>✓ {isAr ? 'فحص 5 لقطات قبل الربط' : 'Five-frame QA before attachment'}</p>
                          <p>✓ {isAr ? 'صفر استهلاك لمزود فيديو توليدي' : 'Zero generative-video provider spend'}</p>
                          <p>✓ {isAr ? `التكلفة: ${CONTENT_HUB_MOTION_DESIGN_COST} كريديت` : `Cost: ${CONTENT_HUB_MOTION_DESIGN_COST} credits`}</p>
                        </>
                      ) : videoProductionMode === 'CAMPAIGN_FILM' ? (
                        <>
                          <p>✓ {isAr ? '3 مشاهد مختلفة بحركة عناصر أو Subject وكاميرا واضحة داخل المشهد' : 'Three distinct scenes with visible subject and camera motion'}</p>
                          <p>✓ {isAr ? `${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS} ثوانٍ: Hook ثم منفعة ثم Hero/CTA` : `${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS} seconds: hook, benefit, then hero/CTA`}</p>
                          <p>✓ {isAr ? 'صوت إعلاني وانتقالات مشاهد وTypography متحرك منفصل عن التوليد' : 'Ad sound, scene transitions, and separately composed kinetic typography'}</p>
                          <p>✓ {isAr ? 'فحص جودة متعدد اللقطات قبل الربط' : 'Multi-frame premium QA before attachment'}</p>
                          <p>✓ {isAr ? 'محاولة مزود واحدة بلا إعادة مدفوعة عشوائية' : 'One provider attempt with no blind paid retry'}</p>
                          <p>✓ {isAr ? `التكلفة: ${CONTENT_HUB_VIDEO_COST} كريديت` : `Cost: ${CONTENT_HUB_VIDEO_COST} credits`}</p>
                        </>
                      ) : (
                        <>
                          <p>✓ {isAr ? 'Hook ومنتج ومنفعة وفريم ختامي' : 'Hook, product, benefit, and end frame'}</p>
                          <p>✓ {isAr ? 'فحص 5 لقطات قبل الربط' : 'Five-frame QA before attachment'}</p>
                          <p>✓ {isAr ? 'محاولة مزود واحدة بلا إعادة عشوائية' : 'One provider attempt with no blind retry'}</p>
                          <p>✓ {isAr ? `التكلفة: ${CONTENT_HUB_VIDEO_COST} كريديت` : `Cost: ${CONTENT_HUB_VIDEO_COST} credits`}</p>
                        </>
                      )}
                      <p>✓ {isAr ? 'حفظ دائم واسترداد إذا لم ينتج أصل صالح' : 'Durable storage and restoration if no usable asset is produced'}</p>
                      <p>— {isAr ? 'لا نشر ولا جدولة ولا تعديل تلقائي للبراند' : 'No publish, schedule, or automatic Brand Brain update'}</p>
                    </div>
                  </div>
                </div>

                {(['PHOTO_FILM', 'MOTION_DESIGN'].includes(videoProductionMode) ? motionDesignLocked : cinematicVideoLocked) && (
                  <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{addCreditsForVideoLabel}</p>
                )}

                {error && (
                  <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800">
                    {error}
                  </div>
                )}

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <input type="checkbox" checked={videoAssetRightsAcknowledged} onChange={event => setVideoAssetRightsAcknowledged(event.target.checked)} disabled={Boolean(generatingVideoId)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600" />
                  <span className="text-sm font-semibold leading-relaxed text-slate-800">
                    {videoProductionMode === 'PHOTO_FILM'
                      ? (isAr ? 'أؤكد أنني أملك أو لدي تصريح تجاري لاستخدام صور العقار المختارة وهوية البراند.' : 'I confirm that I own or have commercial permission to use the selected property photos and brand identity.')
                      : videoProductionMode === 'MOTION_DESIGN'
                        ? (isAr ? 'أؤكد أنني أملك أو لدي تصريح استخدام الفيديو الأصلي وهوية البراند في إعلان تجاري.' : 'I confirm that I own or am authorised to use the source video and brand identity in commercial advertising.')
                        : videoProductionMode === 'CAMPAIGN_FILM'
                          ? (isAr ? 'أؤكد أنني مخوّل باستخدام هوية البراند والنص المعتمد، وأفهم أن المشاهد Concept مولّدة وليست تصويرًا حقيقيًا للمنتج.' : 'I confirm I am authorised to use the brand identity and approved copy, and understand that the concept scenes are generated rather than documentary product footage.')
                          : (isAr ? 'أؤكد أنني أملك أو لدي تصريح استخدام صور المنتج المختارة في إعلان تجاري.' : 'I confirm that I own or am authorised to use the selected product images in commercial advertising.')}
                  </span>
                </label>

                {videoProductionMode === 'PHOTO_FILM' && (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <input type="checkbox" checked={videoSamePropertyAcknowledged} onChange={event => setVideoSamePropertyAcknowledged(event.target.checked)} disabled={Boolean(generatingVideoId)} className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-600" />
                    <span className="text-sm font-semibold leading-relaxed text-emerald-950">
                      {isAr
                        ? 'أؤكد أن الصور المختارة لنفس العقار، وأن نص المنشور لا يحتوي سعرًا أو موقعًا أو مساحة أو غرفًا أو إتاحة غير موثقة.'
                        : 'I confirm the selected photos show the same property and the post contains no unverified price, location, area, room count, or availability claim.'}
                    </span>
                  </label>
                )}

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <input type="checkbox" checked={videoGenerationAcknowledged} onChange={event => setVideoGenerationAcknowledged(event.target.checked)} disabled={Boolean(generatingVideoId)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600" />
                  <span className="text-sm font-semibold leading-relaxed text-slate-800">
                    {videoProductionMode === 'PHOTO_FILM'
                      ? (isAr ? `أوافق على خصم ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST} كريديت لإنتاج Property Photo Film مدته ${PROPERTY_PHOTO_FILM_DURATION_SECONDS} ثوانٍ للمراجعة فقط؛ لا نشر ولا جدولة.` : `I approve a ${CONTENT_HUB_PROPERTY_PHOTO_FILM_COST}-credit charge for one ${PROPERTY_PHOTO_FILM_DURATION_SECONDS}-second review-only property photo film; nothing will be published or scheduled.`)
                      : videoProductionMode === 'MOTION_DESIGN'
                        ? (isAr ? `أوافق على خصم ${CONTENT_HUB_MOTION_DESIGN_COST} كريديت لإنتاج Motion Design مدته ${MOTION_DESIGN_DURATION_SECONDS} ثوانٍ للمراجعة فقط؛ لا نشر ولا جدولة.` : `I approve a ${CONTENT_HUB_MOTION_DESIGN_COST}-credit charge for one ${MOTION_DESIGN_DURATION_SECONDS}-second review-only Motion Design ad; nothing will be published or scheduled.`)
                        : videoProductionMode === 'CAMPAIGN_FILM'
                          ? (isAr ? `أوافق على خصم ${CONTENT_HUB_VIDEO_COST} كريديت لإنتاج Concept Film مولّد من 3 لقطات مدته ${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS} ثوانٍ للمراجعة فقط؛ لا يضمن تطابق منتج حقيقي، محاولة واحدة، لا نشر ولا جدولة.` : `I approve a ${CONTENT_HUB_VIDEO_COST}-credit charge for one ${CONTENT_HUB_CAMPAIGN_FILM_DURATION_SECONDS}-second, three-shot generated concept film; it does not guarantee real-product fidelity, one attempt, nothing published or scheduled.`)
                          : (isAr ? `أوافق على خصم ${CONTENT_HUB_VIDEO_COST} كريديت لإنتاج إعلان منتج مدته ${CINEMATIC_PRODUCT_AD_DURATION_SECONDS} ثوانٍ للمراجعة فقط؛ لا نشر ولا جدولة.` : `I approve a ${CONTENT_HUB_VIDEO_COST}-credit charge for one ${CINEMATIC_PRODUCT_AD_DURATION_SECONDS}-second review-only product ad; nothing will be published or scheduled.`)}
                  </span>
                </label>

                <div className="mt-5 flex justify-end gap-3">
                  <button onClick={closeVideoGenerationConfirm} disabled={Boolean(generatingVideoId)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-950">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button onClick={confirmPostVideoGeneration} disabled={Boolean(generatingVideoId) || !canStartSelectedVideoRoute} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                    {generatingVideoId ? (isAr ? 'جارٍ الإنتاج والفحص...' : 'Rendering and reviewing...') : (isAr ? `ابدأ الإنتاج — ${['PHOTO_FILM', 'MOTION_DESIGN'].includes(videoProductionMode) ? CONTENT_HUB_MOTION_DESIGN_COST : CONTENT_HUB_VIDEO_COST} كريديت` : `Start production — ${['PHOTO_FILM', 'MOTION_DESIGN'].includes(videoProductionMode) ? CONTENT_HUB_MOTION_DESIGN_COST : CONTENT_HUB_VIDEO_COST} credits`)}
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
                  <button type="button" aria-label={isAr ? 'إغلاق تأكيد إنشاء الخطة' : 'Close plan generation confirmation'} onClick={closeGeneratePlanConfirm} disabled={generatingPlan} className="text-xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-40">×</button>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p className="font-bold text-slate-800">{contentPlanCostBreakdown}</p>
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
                    <p className={`mt-2 text-xs font-semibold ${imageDailyCapReached ? 'text-amber-700' : 'text-slate-500'}`}>
                      {imageDailyCapacityLabel}
                    </p>
                  </div>
                  <button type="button" aria-label={isAr ? 'إغلاق تأكيد توليد الصور' : 'Close bulk image confirmation'} onClick={closeBulkImageConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
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
                  <button type="button" aria-label={isAr ? 'إغلاق تأكيد إعادة التوليد' : 'Close regeneration confirmation'} onClick={closeRegenerateConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
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
                  <button type="button" aria-label={isAr ? 'إغلاق تأكيد إعادة الصياغة' : 'Close rewrite confirmation'} onClick={closeRewriteConfirm} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
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
                {error && (
                  <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                    {error}
                  </div>
                )}
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
                  <button type="button" aria-label={isAr ? 'إغلاق قائمة النشر اليدوي' : 'Close manual publishing checklist'} onClick={closeManualPublishModal} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
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
      </main>
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
  isGeneratingVideo: boolean
  isRepairingVideo: boolean
  imageGenerationLocked: boolean
  videoGenerationLocked: boolean
  imageGenerationBlockedByTruthReview: boolean
  imageGenerationTruthReviewLabel: string
  addCreditsForImagesLabel: string
  addCreditsForVideoLabel: string
  onGenerateImage: () => void | Promise<void>
  onGenerateVideo: () => void | Promise<void>
  onRepairRejectedVideo: () => void | Promise<void>
  onAddCredits: () => void
  onToggleExpand: () => void
  onEditCaption: () => void
  onEditPrompt: () => void
  onOpenMediaPicker: () => void
  onCloseMediaPicker: () => void
  onSaveEdit: (updates: Partial<ContentPost>) => Promise<boolean>
  onRemoveMedia: () => void
  onPendingEdit: (updates: Partial<ContentPost>) => void
  onRewrite: (instruction: string) => Promise<void>
  onPickWinner?: () => void
  onManualPublish?: () => void
  qualityIssues: string[]
  onPlatformPublished: () => void | Promise<void>
  creativeMatchPanel?: ReactNode
}

function PostCard({
  post,
  campaignId,
  pendingEdit,
  brandName,
  brandLogo,
  isExpanded,
  isEditingCaption,
  isEditingPrompt,
  isRewriting,
  isPickingWinner,
  isGeneratingImage,
  isGeneratingVideo,
  isRepairingVideo,
  imageGenerationLocked,
  videoGenerationLocked,
  imageGenerationBlockedByTruthReview,
  imageGenerationTruthReviewLabel,
  addCreditsForImagesLabel,
  addCreditsForVideoLabel,
  onGenerateImage,
  onGenerateVideo,
  onRepairRejectedVideo,
  onAddCredits,
  onToggleExpand,
  onEditCaption,
  onEditPrompt,
  onOpenMediaPicker,
  onRemoveMedia,
  onSaveEdit,
  onPendingEdit,
  onRewrite,
  onPickWinner,
  onManualPublish,
  qualityIssues,
  onPlatformPublished,
  creativeMatchPanel,
}: PostCardProps) {
  const { t, locale } = useI18n()
  const isAr = locale === 'ar'
  const [showRewriteInput, setShowRewriteInput] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const qualityIssueCount = qualityIssues.length

  const platform = post.platform.toUpperCase()
  const caption = pendingEdit.caption ?? post.caption
  const promptField = post.isVideoPost ? 'videoPrompt' : 'imagePrompt'
  const creativePrompt = (post.isVideoPost
    ? pendingEdit.videoPrompt ?? post.videoPrompt
    : pendingEdit.imagePrompt ?? post.imagePrompt) ?? ''
  const hasImage = !!post.imageUrl
  const isVideo = post.isVideoPost
  const status = post.generationStatus
  const displayedErrorMessage = isAr && post.errorMessage === 'NEXUS Video Studio could not start production. Reserved credits will be restored.'
    ? 'تعذّر على NEXUS بدء إنتاج الفيديو لدى المزوّد، ولم يُنشأ أي فيديو. تم طلب رد الرصيد المحجوز.'
    : post.errorMessage
  const mediaState = deriveContentHubMediaState(post)
  const postImmutable = post.status === 'PUBLISHED' || post.status === 'PROCESSING'
  const editReopensReview = ['APPROVED', 'SCHEDULED', 'FAILED'].includes(post.status)
  const executionBlockedByQuality = qualityIssueCount > 0

  const statusColor = {
    PENDING: '#f59e0b', GENERATING: '#6366f1', DONE: '#10b981',
    FAILED: '#ef4444', REFUND_PENDING: '#b45309', AWAITING_UPLOAD: '#8b5cf6', SKIPPED: '#6b7280',
  }[status] ?? '#6b7280'

  const statusLabel = {
    PENDING: isAr ? 'الوسائط بانتظار التوليد' : 'Media pending', GENERATING: t('contentHub.statusGenerating'), DONE: isAr ? 'الوسائط جاهزة' : 'Media ready',
    FAILED: t('contentHub.statusFailed'), REFUND_PENDING: isAr ? 'استرداد الكريديت قيد المصالحة' : 'Credit restoration pending', AWAITING_UPLOAD: t('contentHub.statusUploadVideo'), SKIPPED: t('contentHub.statusSkipped'),
  }[status] ?? status
  const creditRestorationPending = status === 'REFUND_PENDING'
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

  const lifecycleBadge = executionBlockedByQuality && ['APPROVED', 'SCHEDULED'].includes(post.status)
    ? {
        label: isAr ? 'الاعتماد مسجل · أعد فحص الجودة' : 'Approval recorded · quality recheck required',
        color: '#be123c',
      }
    : ({
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
    }[post.status])

  const scheduledDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  const scheduledDateLabel = post.status === 'SCHEDULED' || post.status === 'PROCESSING' || post.status === 'PUBLISHED'
    ? (isAr ? 'موعد التنفيذ' : 'Scheduled')
    : (isAr ? 'تاريخ مقترح — غير مجدول' : 'Proposed date — not scheduled')

  // Wrapper with status bar on top + action row on bottom
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>

      {/* ── Top meta bar ─────────────────── */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F8FAFC', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">#{post.contentPlanIndex}</span>
          {scheduledDate && <span className="text-[10px] text-slate-400">· {scheduledDateLabel}: {scheduledDate}</span>}
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

      {creativeMatchPanel}

      {post.retainedVideoRepair && status === 'DONE' && (
        <div className="border-t border-violet-200 bg-violet-50 px-3 py-3 text-[11px] leading-5 text-violet-900">
          <p className="font-black">
            {isAr ? 'تحديث جودة متاح من نفس اللقطات' : 'Quality upgrade available from retained footage'}
          </p>
          <p>
            {isAr
              ? 'يعيد NEXUS تركيب الصوت والطبقات بالنسخة المصححة، ثم يعيد Quality Gate. لا استدعاء Runway ولا خصم كريديت.'
              : 'NEXUS will recompose audio and layers with the corrected compositor, then rerun the quality gate. No Runway request and no credit charge.'}
          </p>
          <button
            type="button"
            onClick={onRepairRejectedVideo}
            disabled={isRepairingVideo}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-[11px] font-black text-violet-800 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
          >
            {isRepairingVideo
              ? (isAr ? 'جارٍ تحديث التركيب وإعادة الفحص...' : 'Upgrading composition and reviewing...')
              : (isAr ? 'حدّث الفيديو من الـmaster المحفوظ — بلا توليد أو خصم' : 'Upgrade from retained master — no generation or charge')}
          </button>
        </div>
      )}

      {(status === 'FAILED' || status === 'REFUND_PENDING') && post.errorMessage && (
        <div
          className={`border-t px-3 py-3 text-[11px] leading-5 ${
            status === 'REFUND_PENDING'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
          role="status"
        >
          <p className="font-black">
            {status === 'REFUND_PENDING'
              ? (isAr ? 'استرداد الكريديت قيد المصالحة' : 'Credit restoration is being reconciled')
              : (isAr ? 'لم يكتمل إنتاج الوسائط' : 'Media production did not complete')}
          </p>
          <p>{displayedErrorMessage}</p>
          <p className="mt-1 font-semibold">
            {isAr
              ? 'لم يتم إرفاق مخرج جديد. راجع سجل الكريديت للتسوية النهائية قبل إعادة المحاولة.'
              : 'No new output was attached. Check Credit History for the final settlement before retrying.'}
          </p>
          {post.rejectedVideoReview && (
            <div className="mt-3 overflow-hidden rounded-xl border border-rose-200 bg-white text-slate-800 shadow-sm">
              <div className="border-b border-rose-100 px-3 py-2.5">
                <p className="font-black text-rose-800">
                  {isAr ? 'معاينة مرفوضة — للمراجعة فقط' : 'Rejected preview — review only'}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                  {isAr
                    ? 'هذا الملف محفوظ في سجل التدقيق، ولا يمكن اعتماده أو جدولته أو نشره.'
                    : 'This file is retained in the audit trail and cannot be approved, scheduled, or published.'}
                </p>
              </div>
              <video
                className="aspect-video w-full bg-slate-950 object-contain"
                src={post.rejectedVideoReview.previewUrl}
                controls
                playsInline
                preload="metadata"
                aria-label={isAr ? 'معاينة الفيديو المرفوض' : 'Rejected video preview'}
              />
              <div className="space-y-2 px-3 py-3">
                <p className="text-[11px] font-semibold text-slate-700">{post.rejectedVideoReview.summary}</p>
                {post.rejectedVideoReview.issues.length > 0 && (
                  <ul className="list-disc space-y-1 ps-4 text-[10px] leading-4 text-slate-500">
                    {post.rejectedVideoReview.issues.map(issue => <li key={issue}>{issue}</li>)}
                  </ul>
                )}
                <a
                  href={post.rejectedVideoReview.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {isAr ? 'فتح المعاينة في نافذة مستقلة' : 'Open preview in a separate window'}
                </a>
                {post.rejectedVideoReview.repairEligible && (
                  <button
                    type="button"
                    onClick={onRepairRejectedVideo}
                    disabled={isRepairingVideo}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-[11px] font-black text-violet-800 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isRepairingVideo
                      ? (isAr ? 'جارٍ إصلاح العربية وفحص نفس اللقطات...' : 'Repairing typography and reviewing the same footage...')
                      : (isAr ? 'أصلح العربية والـCTA من نفس اللقطات — بلا توليد أو خصم جديد' : 'Repair typography and CTA from the same footage — no new generation or charge')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {executionBlockedByQuality && (
        <div className="border-t border-rose-200 bg-rose-50 px-3 py-3 text-[11px] leading-5 text-rose-800">
          <p className="font-black">{isAr ? 'يحتاج مراجعة النص قبل التنفيذ' : 'Copy review required before execution'}</p>
          <p>{isAr
            ? `رصد NEXUS ${qualityIssueCount} ملاحظة جودة. عدّل النص أو أعد صياغته؛ لن يظهر مسار النشر حتى ينجح الفحص.`
            : `NEXUS found ${qualityIssueCount} quality finding${qualityIssueCount === 1 ? '' : 's'}. Edit or rewrite the copy; publishing stays hidden until the review passes.`}</p>
          <ul className="mt-2 list-disc space-y-1 ps-4">
            {qualityIssues.slice(0, 3).map(issue => <li key={issue}>{issue}</li>)}
          </ul>
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
          approvalReady={Boolean(post.approvedSnapshotId && post.mediaApprovalSnapshotId)}
          hasMedia={Boolean(post.imageUrl)}
          isVideoPost={post.isVideoPost}
          captionLength={Array.from(post.caption.trim()).length}
          caption={post.caption}
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
              onClick={async () => {
                const saved = await onSaveEdit({ caption })
                if (saved) onEditCaption()
              }}
              disabled={!caption.trim()}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: '#111827' }}
            >{t('contentHub.save')}</button>
          </div>
        </div>
      )}

      {/* Creative direction is part of the authoritative quality review. Keep it
          editable beside the caption so a flagged post can actually be repaired. */}
      {isEditingPrompt && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {isAr
              ? (isVideo ? 'توجيه مشاهد الفيديو' : 'توجيه الصورة')
              : (isVideo ? 'Video scene direction' : 'Image direction')}
          </p>
          <textarea
            aria-label={isAr ? 'توجيه الوسائط' : 'Media direction'}
            className="w-full rounded-xl text-sm p-3 resize-none focus:outline-none"
            style={{ background: '#FFFFFF', border: '1px solid rgba(94,92,230,0.28)', color: '#0f172a', minHeight: '110px' }}
            value={creativePrompt}
            onChange={e => onPendingEdit({ [promptField]: e.target.value } as Partial<ContentPost>)}
            autoFocus
          />
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {isAr
              ? 'صف المشاهد أو التكوين البصري فقط. أضف النصوص والعنوان والدعوة لاتخاذ الإجراء كطبقات قابلة للتحرير خارج الوسائط.'
              : 'Describe scenes or visual composition only. Keep headlines and calls to action as editable layers outside the media.'}
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onEditPrompt} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-950 transition-colors">{t('contentHub.cancel')}</button>
            <button
              onClick={async () => {
                const saved = await onSaveEdit({ [promptField]: creativePrompt } as Partial<ContentPost>)
                if (saved) onEditPrompt()
              }}
              disabled={!creativePrompt.trim()}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
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
        <button
          onClick={onEditPrompt}
          className="col-span-2 min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug text-slate-600 transition-all flex items-center justify-center gap-1.5 hover:text-[#5E5CE6] hover:bg-violet-50"
          style={{ borderColor: 'rgba(15,23,42,0.08)' }}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12.5h10M4 10l4-7 4 7M5.5 7.5h5" /></svg>
          {isAr
            ? (isVideo ? 'تعديل توجيه مشاهد الفيديو' : 'تعديل توجيه الصورة')
            : (isVideo ? 'Edit video scene direction' : 'Edit image direction')}
        </button>
        {/* Video generation is a separate, explicitly priced review action. */}
        {isVideo ? (
          <button
            onClick={videoGenerationLocked ? onAddCredits : onGenerateVideo}
            disabled={isGeneratingVideo || creditRestorationPending || imageGenerationBlockedByTruthReview}
            title={isAr
              ? `NEXUS Video Studio · Motion Design من ${CONTENT_HUB_MOTION_DESIGN_COST} كريديت أو فيلم حملة/إعلان منتج احترافي ${CONTENT_HUB_VIDEO_COST} كريديت · للمراجعة فقط`
              : `NEXUS Video Studio · Motion Design from ${CONTENT_HUB_MOTION_DESIGN_COST} credits or a professional campaign/product film for ${CONTENT_HUB_VIDEO_COST} credits · review only`}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug transition-all flex items-center justify-center gap-1"
            style={{
              borderColor: 'rgba(15,23,42,0.08)',
              background: videoGenerationLocked ? '#FEF2F2' : '#F5F3FF',
              color: videoGenerationLocked ? '#B91C1C' : '#5E5CE6',
            }}
          >
            {isGeneratingVideo
              ? <><span className="h-2.5 w-2.5 animate-spin rounded-full border border-violet-300 border-t-violet-600" />{isAr ? 'جارٍ إنتاج الفيديو' : 'Rendering video'}</>
              : <>🎬 {imageGenerationBlockedByTruthReview
                ? imageGenerationTruthReviewLabel
                : videoGenerationLocked
                  ? addCreditsForVideoLabel
                  : (isAr ? `استوديو الفيديو · من ${CONTENT_HUB_MOTION_DESIGN_COST} كريديت` : `Video Studio · from ${CONTENT_HUB_MOTION_DESIGN_COST} credits`)}</>}
          </button>
        ) : platform === 'TIKTOK' ? (
          <button onClick={onOpenMediaPicker}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug transition-all flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(15,23,42,0.08)', color: '#DB2777' }}
            title="TikTok requires real video — upload yours">
            📹 {t('contentHub.attachVideoShort')}
          </button>
        ) : (
          <button
            onClick={imageGenerationLocked ? onAddCredits : onGenerateImage}
            disabled={isGeneratingImage || creditRestorationPending || imageGenerationBlockedByTruthReview}
            title={creditRestorationPending
              ? (isAr ? 'لن يبدأ خصم جديد حتى اكتمال استرداد المحاولة السابقة.' : 'A new charge is blocked until the previous credit restoration completes.')
              : imageGenerationBlockedByTruthReview ? imageGenerationTruthReviewLabel
              : imageGenerationLocked ? addCreditsForImagesLabel : `Generate image · ${CONTENT_HUB_IMAGE_COST} credits · failed generations are refunded`}
            className="min-h-[44px] rounded-xl border px-3 py-2 text-center text-xs font-semibold leading-snug transition-all flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(15,23,42,0.08)', color: imageGenerationBlockedByTruthReview ? '#64748B' : imageGenerationLocked ? '#B91C1C' : isGeneratingImage ? '#8B5CF6' : '#5E5CE6', background: imageGenerationBlockedByTruthReview ? '#F8FAFC' : imageGenerationLocked ? '#FEF2F2' : undefined }}
          >
            {creditRestorationPending
              ? <>↻ {isAr ? 'مصالحة الكريديت' : 'Reconciling credit'}</>
              : isGeneratingImage
              ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />{t('contentHub.gen')}</>
              : <>🎨 {imageGenerationBlockedByTruthReview ? imageGenerationTruthReviewLabel : imageGenerationLocked ? addCreditsForImagesLabel : t('contentHub.generateImageShort')}</>
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
          isVideo
            ? <video src={imageUrl} muted playsInline controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
          isVideo
            ? <video src={imageUrl} muted playsInline controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

function PlayableTikTokVideo({ src, locale }: { src: string; locale: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    setPlaybackError(false)
    try {
      if (video.paused) {
        await video.play()
      } else {
        video.pause()
      }
    } catch {
      setPlaybackError(true)
    }
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        controls
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        aria-label={locale === 'ar' ? 'معاينة الفيديو الإعلاني' : 'Advertising video preview'}
      />
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlayback}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/10 transition hover:bg-black/20"
          aria-label={locale === 'ar' ? 'تشغيل الفيديو' : 'Play video'}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-black/65 text-2xl text-white shadow-2xl backdrop-blur">▶</span>
        </button>
      )}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-2 top-2 z-40 rounded-full border border-white/30 bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg backdrop-blur hover:bg-black/80"
      >
        {locale === 'ar' ? 'فتح الفيديو' : 'Open video'}
      </a>
      {playbackError && (
        <div className="absolute inset-x-3 top-14 z-40 rounded-xl bg-rose-600/95 px-3 py-2 text-center text-[10px] font-semibold text-white shadow-xl">
          {locale === 'ar'
            ? 'تعذر التشغيل داخل المعاينة. افتح الفيديو مباشرةً.'
            : 'Preview playback was blocked. Open the video directly.'}
        </div>
      )}
    </>
  )
}

function TikTokMockup({ caption, imageUrl, isVideo, status, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; brandName: string; brandLogo: string | null
}) {
  const { t, locale } = useI18n()
  const handle = '@' + brandName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return (
    <div className="relative flex" style={{ background: '#000', aspectRatio: '9/14', overflow: 'hidden' }}>
      {/* Background image/video */}
      {imageUrl ? (
        isVideo
          ? <PlayableTikTokVideo src={imageUrl} locale={locale} />
          : <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }}>
          <ImagePlaceholder isVideo={isVideo} status={status} dark={true} />
        </div>
      )}
      {/* Overlay gradient */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)' }} />

      {/* Right sidebar icons */}
      <div className="pointer-events-none absolute right-2.5 bottom-16 flex flex-col items-center gap-4">
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
      <div className="pointer-events-none absolute bottom-0 left-0 right-10 p-3">
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
  const isPinterest = platform.toUpperCase() === 'PINTEREST'
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
      <div className="relative w-full" style={{ aspectRatio: isPinterest ? '2/3' : '16/9', maxHeight: isPinterest ? 520 : undefined, background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          isVideo
            ? <video src={imageUrl} muted playsInline controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <img src={imageUrl} alt={isPinterest ? caption.slice(0, 500) : ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>
      <div className="flex items-center gap-4 px-3 py-2 text-[11px] text-gray-500">
        {isPinterest ? (
          <>
            <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>📌 Save</span>
            <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>💬 Comment</span>
            <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>↗ Visit</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>👍 Like</span>
            <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>💬 Comment</span>
            <span aria-hidden="true" className="flex items-center gap-1" title={t('contentHub.previewOnly')}>↗ Share</span>
          </>
        )}
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
