'use client'

/**
 * /paid-campaigns/[id] — Campaign Detail Page
 *
 * Full campaign manager view:
 * - Performance KPI bar (Spend / Impressions / CTR / ROAS)
 * - AI Strategy Panel (positioning, audience, budget plan)
 * - Ad Sets with nested Ads
 * - Ad Copy cards with variant labels
 * - Performance chart (last 30 days)
 * - Export panel (JSON brief, UTM tracking, checklist)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'
import { evaluatePaidExecutionReadiness } from '@/lib/paidExecutionReadiness'
import { paidExecutionErrorMessage } from '@/lib/paidExecutionErrorMessage'
import NextImage from 'next/image'
import { AlertTriangle, CheckCircle2, ExternalLink, Image as ImageIcon, X } from 'lucide-react'
import CreditConfirmModal from '@/components/CreditConfirmModal'
import { CREDIT_ACTION_COSTS } from '@/lib/creditActionTruth'

// ── Types ──────────────────────────────────────────────────────────────────
interface Ad {
  id: string
  platformAdId?: string
  platformCreativeId?: string
  name: string
  status: string
  format: string
  primaryText: string
  headline: string
  description?: string
  aiHook?: string
  callToAction: string
  destinationUrl?: string
  imageUrl?: string
  videoUrl?: string
  impressions: number
  clicks: number
  spend: number
  ctr: number
  cpc: number
  roas: number
  aiGenerated: boolean
  aiAngle: string
  variantLabel: string
  isWinner: boolean
  reviewStatus?: string
  specsValidated?: boolean
  specsErrors?: string[]
  creativeSpecs?: Record<string, unknown>
}

interface AdSet {
  id: string
  name: string
  status: string
  dailyBudget?: number
  lifetimeBudget?: number
  bidStrategy: string
  targeting?: Record<string, unknown>
  ads: Ad[]
}

interface MediaAsset {
  id: string
  fileName: string
  type: string
  mimeType: string
  url: string
  assetKind?: 'UPLOADED_MEDIA' | 'GENERATED_VISUAL'
  generatedVisualId?: string
  readOnly?: boolean
  paidCreativeEligible?: boolean
  width?: number | null
  height?: number | null
  size?: number
}

interface Campaign {
  id: string
  name: string
  platform: string
  objective: string
  status: string
  budgetType: string
  dailyBudget?: number
  lifetimeBudget?: number
  currency: string
  startDate?: string
  endDate?: string
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  avgCTR: number | null
  avgCPC: number | null
  avgROAS: number | null
  aiStrategy?: Record<string, unknown>
  aiAudienceBrief?: Record<string, unknown>
  aiBudgetPlan?: Record<string, unknown>
  brandBrainSnapshot?: Record<string, unknown>
  utmCampaign?: string
  trackingUrls?: Record<string, string>
  platformCampaignId?: string
  platformStatus?: string
  organicCampaignId?: string | null
  sourceStrategy?: { id: string; name: string; status: string; updatedAt: string } | null
  strategySnapshot?: { id: string; version: number; scope: string; payloadHash: string; createdAt: string } | null
  budgetApprovalSnapshot?: { id: string; version: number; scope: string; payloadHash: string; createdAt: string } | null
  launchApprovalSnapshot?: { id: string; version: number; scope: string; payloadHash: string; createdAt: string } | null
  sourceRevision?: { state: 'current' | 'stale' | 'missing'; latestSnapshotId: string | null; latestVersion: number | null }
  adSets: AdSet[]
  performanceSnapshots: Array<{ date: string; spend: number; impressions: number; clicks: number; roas: number | null }>
  adAccount?: {
    platformAccountName: string
    businessName?: string
    currency: string
    status: string
    hasApiAccess: boolean
    pageId?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  META: '#1877F2', GOOGLE: '#4285F4', TIKTOK: '#FF0050', LINKEDIN: '#0A66C2',
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:    { bg: 'rgba(107,114,128,0.15)', color: '#9CA3AF', label: 'Execution draft' },
  ACTIVE:   { bg: 'rgba(16,185,129,0.15)',  color: '#10B981', label: 'Platform active record' },
  PAUSED:   { bg: 'rgba(249,115,22,0.15)',  color: '#F97316', label: 'Paused platform draft' },
  ARCHIVED: { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', label: 'Archived' },
  COMPLETED:{ bg: 'rgba(139,92,246,0.15)',  color: '#8B5CF6', label: 'Completed' },
}

const fmt = (n: number, dec = 0) => n?.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) ?? '0'

function googleSearchAssets(ad: Ad, siblings: Ad[]) {
  const specs = ad.creativeSpecs && typeof ad.creativeSpecs === 'object' ? ad.creativeSpecs : {}
  const rawGoogle = specs.googleAds && typeof specs.googleAds === 'object' && !Array.isArray(specs.googleAds)
    ? specs.googleAds as Record<string, unknown>
    : {}
  const unique = (values: unknown[], max: number) => [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim().replace(/\s+/g, ' '))
    .filter(value => value && value.length <= max)
  )]
  return {
    headlines: unique([
      ...(Array.isArray(rawGoogle.headlines) ? rawGoogle.headlines : []),
      ad.headline,
      ad.aiHook,
      ...siblings.flatMap(sibling => [sibling.headline, sibling.aiHook]),
    ], 30).slice(0, 15),
    descriptions: unique([
      ...(Array.isArray(rawGoogle.descriptions) ? rawGoogle.descriptions : []),
      ad.description,
      ad.primaryText,
      ...siblings.flatMap(sibling => [sibling.description, sibling.primaryText]),
    ], 90).slice(0, 4),
  }
}

function googleTargetingSummary(value: Record<string, unknown> | undefined) {
  const targeting = value || {}
  const keywords = Array.isArray(targeting.google_keywords)
    ? targeting.google_keywords.filter(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false
        const keyword = item as Record<string, unknown>
        return typeof keyword.text === 'string' && ['BROAD', 'PHRASE', 'EXACT'].includes(String(keyword.matchType).toUpperCase())
      })
    : []
  const negativeKeywords = Array.isArray(targeting.google_negative_keywords)
    ? targeting.google_negative_keywords.filter(item => item && typeof item === 'object' && !Array.isArray(item))
    : []
  const locations = Array.isArray(targeting.google_locations)
    ? targeting.google_locations.filter(item => item && typeof item === 'object' && !Array.isArray(item))
    : []
  const languages = Array.isArray(targeting.languages) ? targeting.languages.filter(Boolean) : []
  return {
    campaignType: targeting.google_campaign_type,
    keywordCount: keywords.length,
    ready: targeting.google_campaign_type === 'SEARCH'
      && keywords.length > 0
      && negativeKeywords.length > 0
      && locations.length > 0
      && languages.length > 0
      && ['PRESENCE', 'PRESENCE_OR_INTEREST'].includes(String(targeting.google_location_presence)),
  }
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl p-4 shadow-sm"
      style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)' }}>
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="text-[22px] font-black leading-tight" style={{ color: accent || '#071236' }}>{value}</span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function CampaignDetailPage() {
  const { user, authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const ar = locale === 'ar'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'adsets' | 'strategy' | 'performance' | 'export'>('overview')
  const [pushLoading, setPushLoading] = useState(false)
  const [expandedAdSet, setExpandedAdSet] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [manualEntry, setManualEntry] = useState({ date: '', spend: '', impressions: '', clicks: '', conversions: '', roas: '' })
  const [showPlatformDraftConfirm, setShowPlatformDraftConfirm] = useState(false)
  const [platformDraftAcknowledged, setPlatformDraftAcknowledged] = useState(false)
  const [budgetReadinessAcknowledged, setBudgetReadinessAcknowledged] = useState(false)
  const [googlePoliticalDeclarationAcknowledged, setGooglePoliticalDeclarationAcknowledged] = useState(false)
  const [showPlatformActivationConfirm, setShowPlatformActivationConfirm] = useState(false)
  const [platformActivationAcknowledged, setPlatformActivationAcknowledged] = useState(false)
  const [spendActivationAcknowledged, setSpendActivationAcknowledged] = useState(false)
  const [activationBudgetAcknowledged, setActivationBudgetAcknowledged] = useState(false)
  const [activateLoading, setActivateLoading] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showCreativeAttach, setShowCreativeAttach] = useState(false)
  const [creativeTargetAd, setCreativeTargetAd] = useState<Ad | null>(null)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState('')
  const [creativeDraftAcknowledged, setCreativeDraftAcknowledged] = useState(false)
  const [creativeRightsAcknowledged, setCreativeRightsAcknowledged] = useState(false)
  const [creativeAttachLoading, setCreativeAttachLoading] = useState(false)
  const [generationLoading, setGenerationLoading] = useState<'plan' | 'copy' | null>(null)
  const [generationConfirmation, setGenerationConfirmation] = useState<'plan' | 'copy' | null>(null)

  const getToken = async () => {
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token || ''
  }

  const load = useCallback(async () => {
    if (!user) return
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setCampaign(data.campaign)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load error')
    } finally {
      setLoading(false)
    }
  }, [user, id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const closeCreativeAttach = (force = false) => {
    if (creativeAttachLoading && !force) return
    setShowCreativeAttach(false)
    setCreativeTargetAd(null)
    setSelectedMediaId('')
    setCreativeDraftAcknowledged(false)
    setCreativeRightsAcknowledged(false)
  }

  const openCreativeAttach = async (ad: Ad) => {
    if (ad.platformAdId || ad.platformCreativeId) {
      setActionError(ar
        ? 'هذا الإعلان مرتبط بالفعل بمسودة على المنصة. يتطلب تغيير الأصل مسار إصدار جديد، وليس استبدالًا محليًا.'
        : 'This ad already has a platform draft. Creative changes require a platform revision workflow, not a local overwrite.')
      return
    }

    setActionError('')
    setCreativeTargetAd(ad)
    setSelectedMediaId('')
    setCreativeDraftAcknowledged(false)
    setCreativeRightsAcknowledged(false)
    setShowCreativeAttach(true)
    setMediaLoading(true)
    try {
      const token = await getToken()
      // Uploaded assets and NEXUS-generated visuals share one picker. The API
      // revalidates ownership, quality evidence, dimensions, MIME type, and
      // delivery URL before an asset can become execution-ready.
      const campaignFilter = campaign?.organicCampaignId
        ? `&campaignId=${encodeURIComponent(campaign.organicCampaignId)}`
        : ''
      const response = await fetch(`/api/media?type=IMAGE&limit=50${campaignFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load Media Library images.')
      const assets = Array.isArray(data.media)
        ? data.media.filter((asset: MediaAsset) => (
            asset.assetKind !== 'GENERATED_VISUAL' || asset.paidCreativeEligible === true
          ))
        : []
      setMediaAssets(assets)
      const current = assets.find((asset: MediaAsset) => asset.url === ad.imageUrl)
      if (current) setSelectedMediaId(current.id)
    } catch (error) {
      setMediaAssets([])
      setActionError(error instanceof Error ? error.message : 'Could not load Media Library images.')
    } finally {
      setMediaLoading(false)
    }
  }

  const handleAttachCreative = async () => {
    if (!creativeTargetAd || !selectedMediaId || !creativeDraftAcknowledged || !creativeRightsAcknowledged) return
    setCreativeAttachLoading(true)
    setActionError('')
    try {
      const token = await getToken()
      const response = await fetch(`/api/ad-campaigns/${id}/ads/${creativeTargetAd.id}/creative`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: selectedMediaId,
          explicitCreativeAttachConfirmed: true,
          reviewedAssetRightsConfirmed: true,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = Array.isArray(data.errors) && data.errors.length > 0 ? ` ${data.errors.join(' ')}` : ''
        throw new Error(`${data.error || 'Could not attach creative.'}${detail}`)
      }
      await load()
      closeCreativeAttach(true)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not attach creative.')
    } finally {
      setCreativeAttachLoading(false)
    }
  }

  const handlePushToPlatform = async () => {
    if (!campaign) return
    if (!platformDraftAcknowledged || !budgetReadinessAcknowledged) {
      setActionError('Confirm paused draft creation and execution-readiness review before creating platform drafts.')
      return
    }
    setActionError('')
    setPushLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${id}/push-to-platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          explicitPlatformDraftConfirmed: platformDraftAcknowledged === true,
          explicitBudgetConfirmed: budgetReadinessAcknowledged === true,
          explicitExecutionReadinessConfirmed: budgetReadinessAcknowledged === true,
          ...(campaign.platform === 'GOOGLE' && googlePoliticalDeclarationAcknowledged
            ? { googleContainsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' }
            : {}),
        }),
      })
      const result = await res.json()
      const blockerText = Array.isArray(result.blockers)
        ? result.blockers.map((blocker: { message?: string }) => blocker.message).filter(Boolean).join(' ')
        : ''
      if (!res.ok || result.success === false) throw new Error(blockerText || paidExecutionErrorMessage(
        result.code || result.error,
        ar ? 'ar' : 'en',
        ar ? 'تعذر إنشاء مسودة المنصة.' : 'Platform draft creation failed.',
      ))
      setShowPlatformDraftConfirm(false)
      setPlatformDraftAcknowledged(false)
      setBudgetReadinessAcknowledged(false)
      setGooglePoliticalDeclarationAcknowledged(false)
      await load()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Push failed')
    } finally {
      setPushLoading(false)
      setPlatformDraftAcknowledged(false)
      setBudgetReadinessAcknowledged(false)
      setGooglePoliticalDeclarationAcknowledged(false)
    }
  }

  const handleGenerateExecutionArtifact = async (kind: 'plan' | 'copy') => {
    if (!campaign?.sourceStrategy) {
      setActionError(ar
        ? 'هذه مسودة قديمة غير مرتبطة باستراتيجية معتمدة. ابدأ تنفيذاً جديداً من صفحة Strategy.'
        : 'This legacy draft has no approved strategy source. Start new execution from Strategy.')
      return
    }
    setGenerationLoading(kind)
    setActionError('')
    try {
      const token = await getToken()
      const endpoint = kind === 'plan' ? 'generate-strategy' : 'generate-copy'
      const response = await fetch(`/api/ad-campaigns/${id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: ar ? 'ar' : 'en' }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(paidExecutionErrorMessage(
        result.code || result.error,
        ar ? 'ar' : 'en',
        ar ? 'تعذر إنشاء مخرجات التنفيذ.' : 'Could not generate execution output.',
      ))
      await load()
      setActiveTab(kind === 'plan' ? 'strategy' : 'adsets')
    } catch (generationError) {
      setActionError(generationError instanceof Error ? generationError.message : 'Generation failed')
    } finally {
      setGenerationLoading(null)
    }
  }

  const handleActivatePlatform = async () => {
    if (!campaign) return
    if (!platformActivationAcknowledged || !spendActivationAcknowledged || !activationBudgetAcknowledged) {
      setActionError('Confirm platform activation, execution readiness, and spend approval before activating paid ads.')
      return
    }
    setActionError('')
    setActivateLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${id}/activate-platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          explicitPlatformActivationConfirmed: platformActivationAcknowledged === true,
          explicitSpendActivationConfirmed: spendActivationAcknowledged === true,
          explicitBudgetConfirmed: activationBudgetAcknowledged === true,
          explicitExecutionReadinessConfirmed: activationBudgetAcknowledged === true,
        }),
      })
      const result = await res.json()
      const blockerText = Array.isArray(result.blockers)
        ? result.blockers.map((blocker: { message?: string }) => blocker.message).filter(Boolean).join(' ')
        : ''
      if (!res.ok) throw new Error(blockerText || paidExecutionErrorMessage(
        result.code || result.error,
        ar ? 'ar' : 'en',
        ar ? 'تعذر تفعيل الحملة.' : 'Activation failed.',
      ))
      setShowPlatformActivationConfirm(false)
      setPlatformActivationAcknowledged(false)
      setSpendActivationAcknowledged(false)
      setActivationBudgetAcknowledged(false)
      await load()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Activation failed')
    } finally {
      setActivateLoading(false)
      setPlatformActivationAcknowledged(false)
      setSpendActivationAcknowledged(false)
      setActivationBudgetAcknowledged(false)
    }
  }

  const handlePausePlatform = async () => {
    if (!campaign) return
    const confirmed = window.confirm(ar
      ? 'هل تريد إيقاف الحملة فعلياً على المنصة؟ سيطلب NEXUS إيقاف الحملة ومجموعاتها وإعلاناتها.'
      : 'Pause this campaign on the connected platform? NEXUS will pause the campaign, ad groups, and ads.')
    if (!confirmed) return
    setPauseLoading(true)
    setActionError('')
    try {
      const token = await getToken()
      const response = await fetch(`/api/ad-campaigns/${id}/pause-platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ explicitPlatformPauseConfirmed: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Platform pause failed')
      await load()
      if (result.partial) setActionError(result.note || 'Campaign delivery is paused, but some child objects need reconciliation.')
    } catch (pauseError) {
      setActionError(pauseError instanceof Error ? pauseError.message : 'Platform pause failed')
    } finally {
      setPauseLoading(false)
    }
  }

  const handleSyncMetrics = async () => {
    if (!campaign) return
    setSyncLoading(true)
    setSyncMsg('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${id}/sync-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setSyncMsg(result.message || `Synced ${result.synced ?? 0} days`)
      await load()
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncLoading(false)
    }
  }

  const handleManualEntry = async () => {
    if (!campaign || !manualEntry.date || !manualEntry.spend) return
    setSyncLoading(true)
    setSyncMsg('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${id}/sync-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(manualEntry),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      setSyncMsg('Entry saved ✓')
      setManualEntry({ date: '', spend: '', impressions: '', clicks: '', conversions: '', roas: '' })
      await load()
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSyncLoading(false)
    }
  }

  if (!authLoading && !isAuthenticated) return null

  if (authLoading || loading) return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مسودة التنفيذ المدفوع" labelEn="Preparing paid execution draft" />

  if (error || !campaign) return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || (ar ? 'لم يتم العثور على الحملة.' : 'Campaign not found.')}</p>
          <button onClick={() => router.push('/paid-campaigns')}
            className="px-4 py-2 rounded-lg text-[13px] font-bold text-white"
            style={{ background: '#071236' }}>
            {ar ? 'العودة إلى مركز الإعلانات المدفوعة' : 'Back to Paid Ads Control Center'}
          </button>
        </div>
      </div>
    </AppShell>
  )

  const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.DRAFT
  const platformColor = PLATFORM_COLORS[campaign.platform] || '#8B5CF6'
  const totalAds = campaign.adSets.reduce((acc, s) => acc + s.ads.length, 0)
  const googleTargeting = googleTargetingSummary(campaign.aiAudienceBrief)
  const executionAds = campaign.adSets.flatMap(adSet => adSet.ads.map(ad => {
    const assets = googleSearchAssets(ad, adSet.ads)
    return {
      ...ad,
      googleHeadlines: assets.headlines,
      googleDescriptions: assets.descriptions,
    }
  }))
  const executionReadiness = evaluatePaidExecutionReadiness({
    platform: campaign.platform,
    budgetType: campaign.budgetType,
    dailyBudget: campaign.dailyBudget,
    lifetimeBudget: campaign.lifetimeBudget,
    ads: executionAds,
    pageId: campaign.adAccount?.pageId,
    requireMetaPage: campaign.platform === 'META',
    googleCampaignType: campaign.platform === 'GOOGLE' ? googleTargeting.campaignType : undefined,
    googleKeywordCount: campaign.platform === 'GOOGLE' ? googleTargeting.keywordCount : undefined,
    googleTargetingReady: campaign.platform === 'GOOGLE' ? googleTargeting.ready : undefined,
  })
  const strategy = campaign.aiStrategy
  const hasStrategySource = Boolean(
    campaign.organicCampaignId
    && campaign.sourceStrategy
    && campaign.strategySnapshot?.scope === 'STRATEGY_APPROVAL'
    && campaign.sourceRevision?.state === 'current',
  )
  const hasPausedPlatformDraft = Boolean(campaign.platformCampaignId && campaign.platformStatus === 'PAUSED')
  const canCreatePausedPlatformDraft = Boolean(
    hasStrategySource &&
    campaign.status === 'DRAFT' &&
    campaign.adAccount?.hasApiAccess &&
    executionReadiness.ready
  )
  const canRequestPlatformActivation = Boolean(
    hasStrategySource &&
    campaign.status === 'PAUSED' &&
    hasPausedPlatformDraft &&
    campaign.adAccount?.hasApiAccess &&
    campaign.budgetApprovalSnapshot?.scope === 'PAID_BUDGET_APPROVAL' &&
    executionReadiness.ready
  )
  const hasPerformanceEvidence = campaign.performanceSnapshots.length > 0
  const platformDraftBlockedByCoreConfirmations = !platformDraftAcknowledged || !budgetReadinessAcknowledged || pushLoading
  const selectedMedia = mediaAssets.find(asset => asset.id === selectedMediaId) || null
  const executionLabel = campaign.status === 'ACTIVE'
    ? 'Paid execution · platform active'
    : hasPausedPlatformDraft
      ? 'Paid execution · paused platform draft'
      : 'Strategy-linked paid execution draft'
  const strategySourceBlocker = campaign.sourceRevision?.state === 'stale'
    ? (ar
        ? `اعتمدت الاستراتيجية إصدارًا أحدث v${campaign.sourceRevision.latestVersion ?? '—'}. أعد بناء المسودة قبل التنفيذ على المنصة.`
        : `The strategy now has a newer approved revision v${campaign.sourceRevision.latestVersion ?? '—'}. Rebuild this draft before platform execution.`)
    : (ar
        ? 'لا يوجد إصدار استراتيجية Paid/Full معتمد ومثبت لهذه المسودة. التنفيذ على المنصة مقفل.'
        : 'No pinned approved Paid/Full strategy revision exists for this draft. Platform execution is locked.')

  return (
    <AppShell>
      <div className="paid-detail-luxury nx-os-page text-[#071236]">
        <style jsx global>{`
          .paid-detail-luxury {
            --nx-surface: #ffffff;
            --nx-surface-2: #f8fafc;
            --text-muted: #64748b;
          }
          .paid-detail-luxury .text-white {
            color: #071236 !important;
          }
          .paid-detail-luxury .text-text-muted {
            color: #64748b !important;
          }
          .paid-detail-luxury .hover\\:text-white:hover {
            color: #071236 !important;
          }
          .paid-detail-luxury .paid-detail-modal .text-white,
          .paid-detail-luxury .paid-detail-modal .hover\\:text-white:hover {
            color: #ffffff !important;
          }
          .paid-detail-luxury .paid-detail-modal .text-text-muted {
            color: #94a3b8 !important;
          }
          .paid-detail-luxury .hover\\:bg-white\\/\\[0\\.02\\]:hover,
          .paid-detail-luxury .hover\\:bg-white\\/\\[0\\.04\\]:hover {
            background: rgba(94, 92, 230, 0.05) !important;
          }
        `}</style>
        <div className="nx-os-container">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'تفاصيل التنفيذ المدفوع' : 'Paid execution details'}
          pageSubtitle={ar ? 'راجع مصدر الاستراتيجية، خطة التنفيذ، النصوص، الميزانية، وحالة المنصة قبل أي إنشاء أو تفعيل.' : 'Review strategy source, execution plan, copy, budget, and platform state before creation or activation.'}
          primaryHref="/paid-campaigns"
          primaryLabel={ar ? 'مركز الإعلانات المدفوعة' : 'Paid campaigns'}
          secondaryHref="/connections"
          secondaryLabel={ar ? 'التكاملات' : 'Integrations'}
        />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/paid-campaigns')}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-950 transition-all"
              style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.10)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: platformColor + '22', color: platformColor }}>
                  {campaign.platform}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: statusStyle.bg, color: statusStyle.color }}>
                  {statusStyle.label}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">{campaign.name}</h1>
              <p className="mt-1 text-[13px] text-slate-500">
                {executionLabel} ·{' '}
                {campaign.objective.replace(/_/g, ' ')}
                {campaign.adAccount && ` · ${campaign.adAccount.platformAccountName}`}
                {campaign.startDate && ` · ${new Date(campaign.startDate).toLocaleDateString()} – ${campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : 'ongoing'}`}
              </p>
              {hasStrategySource ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-indigo-700">
                  <button
                    type="button"
                    onClick={() => router.push(`/campaigns/${campaign.sourceStrategy?.id}?tab=strategy`)}
                    className="underline decoration-indigo-200 underline-offset-4"
                  >
                    {ar ? 'مصدر الاستراتيجية' : 'Strategy source'}: {campaign.sourceStrategy?.name}
                  </button>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 font-mono text-[9px] text-indigo-600 ring-1 ring-indigo-100">
                    v{campaign.strategySnapshot?.version} · {campaign.strategySnapshot?.payloadHash.slice(0, 8)}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-[11px] font-bold text-amber-700">
                  {strategySourceBlocker}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {campaign.status === 'DRAFT' && (
              <button
                onClick={() => {
                  setPlatformDraftAcknowledged(false)
                  setBudgetReadinessAcknowledged(false)
                  setGooglePoliticalDeclarationAcknowledged(false)
                  setShowPlatformDraftConfirm(true)
                }}
                disabled={pushLoading || !canCreatePausedPlatformDraft}
                className="px-3 py-2 rounded-xl text-[12px] font-bold text-white flex items-center gap-1.5"
                style={{
                  background: !pushLoading && canCreatePausedPlatformDraft ? `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` : '#e2e8f0',
                  color: !pushLoading && canCreatePausedPlatformDraft ? 'white' : '#64748b',
                  cursor: !pushLoading && canCreatePausedPlatformDraft ? 'pointer' : 'not-allowed',
                }}
              >
                {pushLoading ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : '→'}
                {pushLoading ? 'Creating paused draft...' : canCreatePausedPlatformDraft ? `Create paused ${campaign.platform} draft` : 'Platform draft blocked'}
              </button>
            )}
            {campaign.status === 'ACTIVE' && (
              <button onClick={handlePausePlatform} disabled={pauseLoading}
                className="px-3 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                {pauseLoading ? 'Pausing on platform...' : '⏸ Pause on platform'}
              </button>
            )}
            {campaign.status === 'PAUSED' && (
              canRequestPlatformActivation ? (
                <button
                  onClick={() => {
                    setPlatformActivationAcknowledged(false)
                    setSpendActivationAcknowledged(false)
                    setActivationBudgetAcknowledged(false)
                    setShowPlatformActivationConfirm(true)
                  }}
                  disabled={activateLoading}
                  className="px-3 py-2 rounded-xl text-[12px] font-bold text-white flex items-center gap-1.5"
                  style={{ background: activateLoading ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` }}
                >
                  {activateLoading ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : '▶'}
                  {activateLoading ? 'Activating...' : 'Activate after final approval'}
                </button>
              ) : (
                <button disabled
                  className="px-3 py-2 rounded-xl text-[12px] font-bold"
                  style={{ background: 'rgba(16,185,129,0.08)', color: '#86efac', border: '1px solid rgba(16,185,129,0.22)', cursor: 'not-allowed', opacity: 0.72 }}>
                  Paused draft awaiting account/API readiness
                </button>
              )
            )}
            <button onClick={() => setActiveTab('performance')}
              className="px-3 py-2 rounded-xl text-[12px] font-bold text-slate-600 hover:text-slate-950 transition-all"
              style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
              + Reported metrics
            </button>
          </div>
        </div>

        {(actionError || !hasStrategySource || !executionReadiness.ready || !campaign.adAccount?.hasApiAccess) && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">Paid execution gate</p>
                <p className="mt-1 text-amber-800">
                  {actionError || (
                    !hasStrategySource
                      ? strategySourceBlocker
                      : !campaign.adAccount?.hasApiAccess
                      ? 'Platform API access is not approved. Review and export remain available; no platform object can be created.'
                      : 'Complete the following inputs before NEXUS can create or activate a paid platform draft.'
                  )}
                </p>
                {executionReadiness.blockers.length > 0 && (
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {executionReadiness.blockers.map((blocker, index) => (
                      <li key={`${blocker.code}-${blocker.adId || index}`} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{blocker.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {actionError && (
                <button type="button" onClick={() => setActionError('')} className="font-bold text-amber-900" aria-label="Dismiss error">×</button>
              )}
            </div>
          </div>
        )}

        {/* ── KPI Bar ────────────────────────────────────────────────── */}
        {hasPerformanceEvidence ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <div className="col-span-2">
            <KpiCard
              label="Reported Spend"
              value={`${campaign.currency} ${fmt(campaign.totalSpend, 2)}`}
              sub={campaign.budgetType === 'DAILY' ? `${campaign.currency} ${campaign.dailyBudget}/day` : `${campaign.currency} ${campaign.lifetimeBudget} total`}
              accent="#F97316"
            />
          </div>
          <KpiCard label="Impressions" value={fmt(campaign.totalImpressions)} sub="Total served" />
          <KpiCard label="Clicks" value={fmt(campaign.totalClicks)} sub={campaign.avgCTR == null ? 'CTR not reported' : `CTR ${campaign.avgCTR.toFixed(2)}%`} />
          <KpiCard label="Conversions" value={fmt(campaign.totalConversions)} sub="Reported" />
          <KpiCard label="Avg CPC" value={campaign.avgCPC == null ? '—' : `${campaign.currency} ${campaign.avgCPC.toFixed(2)}`} sub={campaign.avgCPC == null ? 'Not reported' : 'Per click'} />
          <KpiCard
            label="ROAS"
            value={campaign.avgROAS == null ? '—' : `${campaign.avgROAS.toFixed(2)}x`}
            sub="Reported return on ad spend"
            accent={campaign.avgROAS == null ? '#64748B' : campaign.avgROAS >= 2 ? '#10B981' : campaign.avgROAS >= 1 ? '#F97316' : '#EF4444'}
          />
        </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[13px] font-bold text-slate-950">No reported paid performance yet</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Spend, impressions, clicks, conversions, CPC, and ROAS stay hidden until a real platform sync or clearly labeled manual report exists.
            </p>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'adsets', label: `Ad Sets (${campaign.adSets.length})` },
            { key: 'strategy', label: '✨ Execution Plan', hidden: !strategy },
            { key: 'performance', label: '📊 Performance' },
            { key: 'export', label: 'Export' },
          ].filter(t => !t.hidden).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className="px-4 py-1.5 rounded-[10px] text-[12px] font-medium transition-all"
              style={{
                background: activeTab === tab.key ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: activeTab === tab.key ? '#F97316' : '#64748B',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campaign info */}
            <div className="p-4 rounded-[14px]" style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-[13px] font-bold text-white mb-3">Execution Draft Settings</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Platform', value: campaign.platform },
                  { label: 'Approved strategy source', value: campaign.sourceStrategy?.name || 'Missing — execution blocked' },
                  { label: 'Approved strategy revision', value: campaign.strategySnapshot ? `v${campaign.strategySnapshot.version} · ${campaign.strategySnapshot.payloadHash.slice(0, 8)}` : 'Missing — execution blocked' },
                  { label: 'Budget approval', value: campaign.budgetApprovalSnapshot ? `v${campaign.budgetApprovalSnapshot.version} · paused draft only` : 'Pending explicit review' },
                  { label: 'Launch & spend approval', value: campaign.launchApprovalSnapshot ? `v${campaign.launchApprovalSnapshot.version} · recorded` : 'Not authorized' },
                  { label: 'Objective', value: campaign.objective.replace(/_/g, ' ') },
                  { label: 'Budget', value: campaign.budgetType === 'DAILY' ? `${campaign.currency} ${campaign.dailyBudget}/day` : `${campaign.currency} ${campaign.lifetimeBudget} lifetime` },
                  { label: 'Ad Sets', value: campaign.adSets.length },
                  { label: 'Total Ads', value: totalAds },
                  { label: 'AI Generated', value: totalAds > 0 ? 'Yes' : 'No' },
                  { label: 'Platform draft ID', value: campaign.platformCampaignId || 'Not created' },
                  { label: 'Platform status', value: campaign.platformStatus || 'Not created' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-text-muted">{item.label}</span>
                    <span className="text-[12px] font-medium text-white">{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI status */}
            <div className="p-4 rounded-[14px]" style={{ background: 'var(--nx-surface)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <h3 className="text-[13px] font-bold text-white mb-3">Execution Readiness</h3>
              <div className="space-y-2.5">
                {[
                  { label: '🧭 Pinned approved strategy revision', done: hasStrategySource },
                  { label: '💳 Durable budget approval', done: !!campaign.budgetApprovalSnapshot },
                  { label: '🔐 Durable launch & spend approval', done: !!campaign.launchApprovalSnapshot },
                  { label: '✨ Platform execution plan', done: !!campaign.aiStrategy },
                  { label: '🎯 Audience Brief', done: !!campaign.aiAudienceBrief },
                  { label: '💰 Budget Plan', done: !!campaign.aiBudgetPlan },
                  { label: '📝 Ad Copy Variants', done: totalAds > 0 },
                  { label: '🧠 Brand Brain Snapshot', done: !!campaign.brandBrainSnapshot },
                  { label: '🔗 Paused platform draft linked', done: !!campaign.platformCampaignId },
                  { label: '🚦 Ready for final platform activation', done: canRequestPlatformActivation },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-text-muted">{item.label}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: item.done ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                        color: item.done ? '#10B981' : '#9CA3AF',
                      }}>
                      {item.done ? '✓ Ready' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>

              {!campaign.aiStrategy && (
                <button onClick={() => setGenerationConfirmation('plan')}
                  disabled={generationLoading !== null || !hasStrategySource}
                  className="mt-4 w-full py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: hasStrategySource ? 'linear-gradient(135deg, #8B5CF6, #6366F1)' : '#cbd5e1' }}>
                  {generationLoading === 'plan' ? 'Generating execution plan…' : '✨ Review execution plan cost — 4 credits'}
                </button>
              )}
              {campaign.aiStrategy && totalAds === 0 && (
                <button onClick={() => setGenerationConfirmation('copy')}
                  disabled={generationLoading !== null || !hasStrategySource}
                  className="mt-4 w-full py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: hasStrategySource ? 'linear-gradient(135deg, #F97316, #EF4444)' : '#cbd5e1' }}>
                  {generationLoading === 'copy' ? 'Generating ad copy drafts…' : `✨ Generate strategy-aligned ad copy — ${CREDIT_ACTION_COSTS.AD_COPY} credits`}
                </button>
              )}
            </div>

            {/* Performance snapshots (sparkline-ish) */}
            {campaign.performanceSnapshots.length > 0 && (
              <div className="md:col-span-2 p-4 rounded-[14px]"
                style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="text-[13px] font-bold text-white mb-3">Performance (Last 30 Days)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Date', 'Spend', 'Impressions', 'Clicks', 'ROAS'].map(h => (
                          <th key={h} className="pb-2 text-left font-medium text-text-muted pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.performanceSnapshots.slice(0, 7).map(snap => (
                        <tr key={snap.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="py-2 pr-4 text-text-muted">{new Date(snap.date).toLocaleDateString()}</td>
                          <td className="py-2 pr-4 text-white">{campaign.currency} {(snap.spend || 0).toFixed(2)}</td>
                          <td className="py-2 pr-4 text-white">{fmt(snap.impressions)}</td>
                          <td className="py-2 pr-4 text-white">{fmt(snap.clicks)}</td>
                          <td className="py-2 pr-4 font-bold"
                            style={{ color: snap.roas == null ? '#94A3B8' : snap.roas >= 2 ? '#10B981' : snap.roas >= 1 ? '#F97316' : '#EF4444' }}>
                            {snap.roas == null ? '—' : `${snap.roas.toFixed(2)}x`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AD SETS TAB ────────────────────────────────────────────── */}
        {activeTab === 'adsets' && (
          <div className="space-y-3">
            {campaign.adSets.length === 0 ? (
              <div className="text-center py-12 text-text-muted text-[13px]">
                No ad sets yet. Generate ad copy to create the first ad set.
              </div>
            ) : (
              campaign.adSets.map(adSet => (
                <div key={adSet.id} className="rounded-[14px] overflow-hidden"
                  style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Ad Set header */}
                  <button
                    onClick={() => setExpandedAdSet(expandedAdSet === adSet.id ? null : adSet.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: STATUS_STYLES[adSet.status]?.bg, color: STATUS_STYLES[adSet.status]?.color }}>
                        {adSet.status}
                      </span>
                      <span className="text-[14px] font-semibold text-white">{adSet.name}</span>
                      <span className="text-[11px] text-text-muted">{adSet.ads.length} ad{adSet.ads.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {adSet.dailyBudget && (
                        <span className="text-[12px] text-text-muted">{campaign.currency} {adSet.dailyBudget}/day</span>
                      )}
                      <span className="text-text-muted transition-transform" style={{ transform: expandedAdSet === adSet.id ? 'rotate(180deg)' : 'none' }}>
                        ▾
                      </span>
                    </div>
                  </button>

                  {/* Ads grid */}
                  {expandedAdSet === adSet.id && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {adSet.ads.map(ad => (
                          <div key={ad.id} className="p-3 rounded-[12px]"
                            style={{
                              background: 'var(--nx-surface-2)',
                              border: ad.isWinner ? '1px solid #F97316' : '1px solid rgba(255,255,255,0.06)',
                            }}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5">
                                {ad.isWinner && <span className="text-[10px]">🏆</span>}
                                {ad.aiGenerated && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                                    style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }}>
                                    AI
                                  </span>
                                )}
                                <span className="text-[10px] text-text-muted">{ad.variantLabel}</span>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                style={{ background: STATUS_STYLES[ad.status]?.bg, color: STATUS_STYLES[ad.status]?.color }}>
                                {ad.status}
                              </span>
                            </div>

                            {campaign.platform === 'GOOGLE' ? (
                              <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                                {(() => {
                                  const assets = googleSearchAssets(ad, adSet.ads)
                                  const ready = assets.headlines.length >= 3 && assets.descriptions.length >= 2
                                  return (
                                    <>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-black text-sky-900">Responsive Search Ad</span>
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                                          {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                          {ready ? (ar ? 'الأصول النصية جاهزة' : 'Text assets ready') : (ar ? 'الأصول النصية ناقصة' : 'Text assets incomplete')}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-[11px] font-semibold text-sky-800">
                                        {assets.headlines.length}/15 {ar ? 'عناوين' : 'headlines'} · {assets.descriptions.length}/4 {ar ? 'أوصاف' : 'descriptions'}
                                      </p>
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {assets.headlines.slice(0, 5).map(headline => (
                                          <span key={headline} className="rounded-md bg-white px-2 py-1 text-[9px] font-bold text-sky-800 ring-1 ring-sky-100">{headline}</span>
                                        ))}
                                      </div>
                                    </>
                                  )
                                })()}
                              </div>
                            ) : (
                            <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              {ad.imageUrl ? (
                                <div className="relative aspect-[4/3] bg-slate-100">
                                  <NextImage
                                    src={ad.imageUrl}
                                    alt={ad.headline || ad.name}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, 50vw"
                                  />
                                </div>
                              ) : (
                                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-4 text-center text-slate-500">
                                  <ImageIcon className="h-6 w-6" />
                                  <span className="text-[11px] font-semibold">
                                    {ar ? 'لا يوجد أصل إعلاني تمت مراجعته' : 'No reviewed ad creative attached'}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${ad.specsValidated ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {ad.specsValidated ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                  {ad.specsValidated
                                    ? (ar ? 'فحص الأصل مكتمل' : 'Asset preflight passed')
                                    : (ar ? 'يحتاج أصلًا صالحًا' : 'Creative required')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openCreativeAttach(ad)}
                                  disabled={Boolean(ad.platformAdId || ad.platformCreativeId)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                >
                                  <ImageIcon className="h-3 w-3" />
                                  {ad.platformAdId || ad.platformCreativeId
                                    ? (ar ? 'مرتبط بالمنصة' : 'Platform creative linked')
                                    : ad.imageUrl
                                      ? (ar ? 'استبدال قبل الإرسال' : 'Replace before push')
                                      : (ar ? 'إرفاق أصل تمت مراجعته' : 'Attach reviewed asset')}
                                </button>
                              </div>
                            </div>
                            )}

                            <p className="text-[13px] font-semibold text-white mb-1">{ad.headline}</p>
                            <p className="text-[11px] text-text-muted line-clamp-2 mb-2 leading-relaxed">{ad.primaryText}</p>

                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>
                                {ad.callToAction}
                              </span>
                              <span className="text-[10px] text-text-muted">{ad.format.replace(/_/g, ' ')}</span>
                            </div>

                            {(ad.impressions > 0 || ad.spend > 0) && (
                              <div className="grid grid-cols-4 gap-1 pt-2"
                                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                {[
                                  { label: 'Spend', value: `${campaign.currency} ${(ad.spend || 0).toFixed(2)}` },
                                  { label: 'Impr.', value: fmt(ad.impressions) },
                                  { label: 'CTR', value: `${(ad.ctr || 0).toFixed(2)}%` },
                                  { label: 'ROAS', value: `${(ad.roas || 0).toFixed(2)}x` },
                                ].map(kpi => (
                                  <div key={kpi.label} className="text-center">
                                    <p className="text-[9px] text-text-muted">{kpi.label}</p>
                                    <p className="text-[11px] font-bold text-white">{kpi.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── STRATEGY TAB ───────────────────────────────────────────── */}
        {activeTab === 'strategy' && strategy && (
          <div className="space-y-4">
            {/* Positioning */}
            <div className="p-5 rounded-[14px]"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <h3 className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: '#8B5CF6' }}>Campaign Positioning</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries((strategy.positioning as Record<string, unknown>) || {}).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{k.replace(/_/g, ' ')}</p>
                    <p className="text-[13px] text-white leading-relaxed">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Audience */}
            {(strategy.audience as Record<string, unknown>) && (
              <div className="p-5 rounded-[14px]"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: '#10B981' }}>Target Audience</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Primary Segment</p>
                    <p className="text-[13px] text-white mb-2">
                      {String(((strategy.audience as Record<string, unknown>)?.primary_segment as Record<string, unknown>)?.description || '')}
                    </p>
                    <p className="text-[12px] text-text-muted">
                      Age: {String(((strategy.audience as Record<string, unknown>)?.primary_segment as Record<string, unknown>)?.ageRange || '—')}
                      {' · '}
                      {String(((strategy.audience as Record<string, unknown>)?.primary_segment as Record<string, unknown>)?.gender || '—')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Exclusions</p>
                    <ul className="space-y-1">
                      {((strategy.audience as Record<string, unknown>)?.exclusions as string[] || []).map((exc: string, i: number) => (
                        <li key={i} className="text-[12px] text-text-muted">• {exc}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Targeting */}
            {strategy.targeting ? (
              <div className="p-5 rounded-[14px]"
                style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: '#F97316' }}>
                  {campaign.platform} Targeting
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries((strategy.targeting as Record<string, unknown>) || {})
                    .filter(([key, v]) => key !== 'platformValidationRequired' && v && (Array.isArray(v) ? (v as unknown[]).length > 0 : true))
                    .map(([k, v]) => {
                      const isArr = Array.isArray(v)
                      return (
                        <div key={k}>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{k.replace(/_/g, ' ').replace(/^(meta|google|tiktok|linkedin) /, '')}</p>
                          {isArr
                            ? <div className="flex flex-wrap gap-1">
                                {(v as unknown[]).map((item: unknown, i: number) => (
                                  <span key={i} className="text-[11px] px-2 py-0.5 rounded"
                                    style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
                                    {item && typeof item === 'object' && !Array.isArray(item)
                                      ? Object.entries(item as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
                                      : String(item)}
                                  </span>
                                ))}
                              </div>
                            : <p className="text-[12px] text-white">{String(v ?? '')}</p>
                          }
                        </div>
                      )
                    })}
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-amber-300">
                  Targeting values are review hypotheses. Validate availability and policy eligibility inside the connected ad account before creating any platform draft.
                </p>
              </div>
            ) : null}

            {/* Budget Plan */}
            {strategy.budget_plan ? (
              <div className="p-5 rounded-[14px]"
                style={{ background: 'rgba(24,119,242,0.06)', border: '1px solid rgba(24,119,242,0.15)' }}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: '#60A5FA' }}>Budget Planning</h3>
                <p className="text-[13px] leading-relaxed text-white mb-3">
                  Reach, impressions, CPM, and outcome forecasts are unavailable until the connected platform returns an account-level forecast or verified performance history exists.
                </p>
                {/* Phasing */}
                {(strategy.budget_plan as Record<string, unknown>)?.phasing ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Phasing Plan</p>
                    {['learning_phase', 'scaling_phase', 'recommendation'].map(k => {
                      const phasing = ((strategy.budget_plan as Record<string, unknown>)?.phasing as Record<string, unknown>) || {}
                      const val = phasing[k]
                      if (!val) return null
                      return (
                        <p key={k} className="text-[12px] text-text-muted">
                          <span className="text-white font-medium">{k.replace(/_/g, ' ')}: </span>{String(val)}
                        </p>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Setup Readiness Checklist */}
            {strategy.launch_checklist ? (
              <div className="p-5 rounded-[14px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3 text-text-muted">Setup Readiness Checklist</h3>
                <ul className="space-y-2">
                  {(strategy.launch_checklist as string[]).map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-white">
                      <span className="text-green-400 mt-0.5">☐</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {/* ── EXPORT TAB ─────────────────────────────────────────────── */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="p-4 rounded-[14px]" style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-[13px] font-bold text-white mb-3">Execution Draft Export</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const brief = {
                      campaign: { name: campaign.name, platform: campaign.platform, objective: campaign.objective },
                      strategy: campaign.aiStrategy,
                      budget: campaign.aiBudgetPlan,
                      adSets: campaign.adSets.map(s => ({ name: s.name, ads: s.ads.map(a => ({ headline: a.headline, primaryText: a.primaryText })) }))
                    }
                    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `${campaign.name}-brief.json`; a.click()
                  }}
                  className="p-4 rounded-[12px] text-left hover:bg-white/[0.04] transition-all"
                  style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[13px] font-semibold text-white mb-1">📋 Export strategy-linked paid execution package</p>
                  <p className="text-[11px] text-text-muted">Full strategy + copy variants as JSON</p>
                </button>

                {campaign.utmCampaign && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[13px] font-semibold text-white mb-2">🔗 UTM Tracking</p>
                    {strategy?.utm_tracking ? (
                      <code className="text-[10px] text-green-400 break-all">
                        {`utm_source=${String((strategy.utm_tracking as Record<string, unknown>).source ?? '')}&utm_medium=${String((strategy.utm_tracking as Record<string, unknown>).medium ?? '')}&utm_campaign=${String((strategy.utm_tracking as Record<string, unknown>).campaign ?? '')}`}
                      </code>
                    ) : null}
                  </div>
                )}

                <div className="p-4 rounded-[12px] md:col-span-2"
                  style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <p className="text-[13px] font-semibold text-white mb-2">📤 Create paused {campaign.platform} platform draft</p>
                  <p className="text-[12px] text-text-muted mb-3">
                    {campaign.adAccount?.hasApiAccess
                      ? executionReadiness.ready
                        ? `Connected to "${campaign.adAccount.platformAccountName}". The execution brief is complete enough to request paused platform objects for review.`
                        : 'Platform access exists, but the execution brief is incomplete. Resolve the paid execution gate above before creating any platform object.'
                      : `API access not yet approved. Export as JSON for manual review, or connect your ${campaign.platform} ad account after ads permissions are ready.`}
                  </p>
                  <button
                    onClick={() => {
                      setPlatformDraftAcknowledged(false)
                      setBudgetReadinessAcknowledged(false)
                      setGooglePoliticalDeclarationAcknowledged(false)
                      setShowPlatformDraftConfirm(true)
                    }}
                    disabled={pushLoading || !canCreatePausedPlatformDraft}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                    style={{
                      background: canCreatePausedPlatformDraft ? `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` : 'rgba(255,255,255,0.06)',
                      cursor: canCreatePausedPlatformDraft ? 'pointer' : 'not-allowed',
                      opacity: pushLoading ? 0.6 : 1,
                    }}>
                    {pushLoading ? 'Creating paused draft...' : canCreatePausedPlatformDraft ? `Create paused ${campaign.platform} draft →` : 'Platform draft blocked'}
                  </button>
                </div>

                <div className="p-4 rounded-[12px] md:col-span-2"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <p className="text-[13px] font-semibold text-white mb-2">🚦 Activate after final approval</p>
                  <p className="text-[12px] text-text-muted mb-3">
                    {canRequestPlatformActivation
                      ? `A paused ${campaign.platform} platform draft and a complete execution brief exist. Activation still requires the client’s explicit launch and spend approval.`
                      : 'Activation unlocks only after a paused platform draft exists, API access is approved, and the campaign is still paused in NEXUS and on the platform.'}
                  </p>
                  <button
                    onClick={() => {
                      setPlatformActivationAcknowledged(false)
                      setSpendActivationAcknowledged(false)
                      setActivationBudgetAcknowledged(false)
                      setShowPlatformActivationConfirm(true)
                    }}
                    disabled={!canRequestPlatformActivation || activateLoading}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                    style={{
                      background: canRequestPlatformActivation && !activateLoading ? `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` : 'rgba(255,255,255,0.06)',
                      cursor: canRequestPlatformActivation && !activateLoading ? 'pointer' : 'not-allowed',
                      opacity: canRequestPlatformActivation && !activateLoading ? 1 : 0.62,
                    }}>
                    {activateLoading ? 'Activating platform campaign...' : canRequestPlatformActivation ? `Review activation decision →` : 'Activation blocked'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PERFORMANCE TAB ───────────────────────────────────────── */}
        {activeTab === 'performance' && (
          <div className="space-y-5">
            {/* Sync controls */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-white">Reported Metrics</h3>
                <p className="text-[12px] text-text-muted mt-0.5">
                  {campaign.adAccount?.hasApiAccess
                    ? 'Connected to Meta — sync pulls live data from Meta Insights API'
                    : 'No API access yet — enter metrics manually until Meta App Review is approved'}
                </p>
              </div>
              {campaign.adAccount?.hasApiAccess && campaign.platformCampaignId && (
                <button
                  onClick={handleSyncMetrics}
                  disabled={syncLoading}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white flex items-center gap-2"
                  style={{ background: syncLoading ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` }}>
                  {syncLoading
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Syncing...</>
                    : '↻ Sync from Meta'}
                </button>
              )}
            </div>
            {syncMsg && (
              <p className="text-[12px] px-3 py-2 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                {syncMsg}
              </p>
            )}

            {/* Aggregate KPI bar is shown only when reported evidence exists. */}
            {hasPerformanceEvidence && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Reported Spend', value: `${campaign.currency} ${(campaign.totalSpend || 0).toFixed(2)}`, accent: '#F97316' },
                { label: 'Impressions', value: fmt(campaign.totalImpressions) },
                { label: 'Clicks', value: fmt(campaign.totalClicks) },
                { label: 'ROAS', value: campaign.avgROAS == null ? '—' : `${campaign.avgROAS.toFixed(2)}x`, accent: campaign.avgROAS == null ? '#64748B' : campaign.avgROAS >= 2 ? '#10B981' : campaign.avgROAS >= 1 ? '#F97316' : '#EF4444' },
              ].map(k => (
                <div key={k.label} className="p-4 rounded-[12px]"
                  style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[11px] text-text-muted mb-1">{k.label}</p>
                  <p className="text-[20px] font-bold" style={{ color: k.accent || 'white' }}>{k.value}</p>
                </div>
              ))}
            </div>
            )}

            {/* SVG sparkline chart */}
            {campaign.performanceSnapshots.length > 0 && (
              <PerformanceChart
                snapshots={campaign.performanceSnapshots}
                currency={campaign.currency}
              />
            )}

            {/* Full metrics table */}
            {campaign.performanceSnapshots.length > 0 ? (
              <div className="rounded-[14px] overflow-hidden"
                style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <h4 className="text-[12px] font-bold text-white">Daily Breakdown</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Date', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'ROAS'].map(h => (
                          <th key={h} className="px-5 py-3 text-left font-medium text-text-muted whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.performanceSnapshots.map(snap => (
                        <tr key={snap.date}
                          className="hover:bg-white/[0.02] transition-all"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-5 py-3 text-text-muted whitespace-nowrap">{new Date(snap.date).toLocaleDateString()}</td>
                          <td className="px-5 py-3 font-medium text-white">{campaign.currency} {(snap.spend || 0).toFixed(2)}</td>
                          <td className="px-5 py-3 text-white">{fmt(snap.impressions)}</td>
                          <td className="px-5 py-3 text-white">{fmt(snap.clicks)}</td>
                          <td className="px-5 py-3 text-text-muted">—</td>
                          <td className="px-5 py-3 text-text-muted">—</td>
                          <td className="px-5 py-3 font-bold"
                            style={{ color: snap.roas == null ? '#94A3B8' : snap.roas >= 2 ? '#10B981' : snap.roas >= 1 ? '#F97316' : '#EF4444' }}>
                            {snap.roas == null ? '—' : `${snap.roas.toFixed(2)}x`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Empty state — show manual entry form */
              <div className="p-5 rounded-[14px]"
                style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[13px] text-white font-semibold mb-1">No reported paid metrics yet</p>
                <p className="text-[12px] text-text-muted mb-4">Enter metrics only after real platform data exists.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                  {[
                    { key: 'date', label: 'Date', type: 'date' },
                    { key: 'spend', label: 'Spend', type: 'number' },
                    { key: 'impressions', label: 'Impressions', type: 'number' },
                    { key: 'clicks', label: 'Clicks', type: 'number' },
                    { key: 'conversions', label: 'Conversions', type: 'number' },
                    { key: 'roas', label: 'ROAS', type: 'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] text-text-muted block mb-1">{f.label}</label>
                      <input
                        type={f.type}
                        value={manualEntry[f.key as keyof typeof manualEntry]}
                        onChange={e => setManualEntry(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl text-[12px] text-white outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        placeholder={f.type === 'date' ? '' : '0'}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleManualEntry}
                  disabled={syncLoading || !manualEntry.date || !manualEntry.spend}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #F97316, #EF4444)', opacity: (!manualEntry.date || !manualEntry.spend) ? 0.5 : 1 }}>
                  {syncLoading ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            )}

            {/* Manual entry form when data exists (add more days) */}
            {campaign.performanceSnapshots.length > 0 && (
              <details className="rounded-[14px] overflow-hidden" style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <summary className="px-5 py-3 text-[12px] font-medium text-text-muted cursor-pointer select-none hover:text-white transition-all">
                  + Add manual entry
                </summary>
                <div className="px-5 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    {[
                      { key: 'date', label: 'Date', type: 'date' },
                      { key: 'spend', label: 'Spend', type: 'number' },
                      { key: 'impressions', label: 'Impressions', type: 'number' },
                      { key: 'clicks', label: 'Clicks', type: 'number' },
                      { key: 'conversions', label: 'Conversions', type: 'number' },
                      { key: 'roas', label: 'ROAS', type: 'number' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[11px] text-text-muted block mb-1">{f.label}</label>
                        <input
                          type={f.type}
                          value={manualEntry[f.key as keyof typeof manualEntry]}
                          onChange={e => setManualEntry(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl text-[12px] text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                          placeholder={f.type === 'date' ? '' : '0'}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleManualEntry}
                    disabled={syncLoading || !manualEntry.date || !manualEntry.spend}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #F97316, #EF4444)', opacity: (!manualEntry.date || !manualEntry.spend) ? 0.5 : 1 }}>
                    {syncLoading ? 'Saving...' : 'Save Entry'}
                  </button>
                </div>
              </details>
            )}
          </div>
        )}

        {showCreativeAttach && creativeTargetAd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" style={{ background: 'rgba(2,6,23,0.68)', backdropFilter: 'blur(6px)' }}>
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" dir={ar ? 'rtl' : 'ltr'}>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-indigo-600">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{ar ? 'أصل إعلاني لمسودة مدفوعة' : 'Paid draft creative asset'}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-950">
                    {ar ? 'إرفاق أصل إعلاني اجتاز المراجعة' : 'Attach a quality-gated ad creative'}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {ar
                      ? 'اختر ملفًا مرفوعًا أو صورة ولّدها NEXUS واجتازت فحص الجودة. الإرفاق يحدّث المسودة المحلية فقط؛ لا ينشئ كائن منصة، ولا يطلق إعلانًا، ولا ينفق ميزانية.'
                      : 'Choose an uploaded asset or a NEXUS-generated visual that passed quality review. Attachment updates the local draft only; it creates no platform object, launches no ad, and spends no budget.'}
                  </p>
                </div>
                <button type="button" onClick={() => closeCreativeAttach()} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={ar ? 'إغلاق' : 'Close'}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                {mediaLoading ? (
                  <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                    {ar ? 'جارٍ تحميل الأصول...' : 'Loading assets...'}
                  </div>
                ) : mediaAssets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-bold text-slate-900">{ar ? 'لا توجد أصول إعلانية صالحة لهذه الحملة' : 'No eligible ad creative exists for this campaign'}</p>
                    <p className="mt-1 text-xs text-slate-500">{ar ? 'ارفع أصلًا حقيقيًا أو ولّد اتجاهًا بصريًا من نفس الاستراتيجية، ثم عد لاختياره هنا.' : 'Upload a real asset or generate a visual from this same strategy, then return to select it here.'}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={() => router.push(campaign.organicCampaignId ? `/media?campaignId=${encodeURIComponent(campaign.organicCampaignId)}&returnTo=${encodeURIComponent(`/paid-campaigns/${campaign.id}`)}` : '/media')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#071236] px-4 py-2 text-xs font-bold text-white">
                        {ar ? 'افتح مكتبة الوسائط' : 'Open Media Library'} <ExternalLink className="h-3 w-3" />
                      </button>
                      {campaign.organicCampaignId && (
                        <button type="button" onClick={() => router.push(`/campaigns/${campaign.organicCampaignId}?tab=creative#campaign-visual-generator`)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          {ar ? 'ولّد اتجاهًا بصريًا من الاستراتيجية' : 'Generate from strategy'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {mediaAssets.map(asset => {
                        const selected = selectedMediaId === asset.id
                        return (
                          <button
                            type="button"
                            key={asset.id}
                            onClick={() => setSelectedMediaId(asset.id)}
                            className={`overflow-hidden rounded-2xl border bg-white text-start transition-all ${selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}
                          >
                            <div className="relative aspect-square bg-slate-100">
                              <NextImage src={asset.url} alt={asset.fileName} fill unoptimized className="object-cover" sizes="(max-width: 640px) 50vw, 180px" />
                              <span className="absolute bottom-2 start-2 rounded-full bg-slate-950/80 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
                                {asset.assetKind === 'GENERATED_VISUAL'
                                  ? (ar ? 'مولّد + QA' : 'Generated + QA')
                                  : (ar ? 'مرفوع' : 'Uploaded')}
                              </span>
                              {selected && (
                                <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white shadow">
                                  <CheckCircle2 className="h-4 w-4" />
                                </span>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="truncate text-[11px] font-bold text-slate-900">{asset.fileName}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {asset.assetKind === 'GENERATED_VISUAL'
                                  ? (ar ? 'اجتاز بوابة الجودة المدفوعة' : 'Paid quality gate passed')
                                  : `${asset.width || '?'} × ${asset.height || '?'} · ${Math.max(0.1, (asset.size ?? 0) / 1024 / 1024).toFixed(1)} MB`}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {selectedMedia && (
                      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-950">
                        <p className="font-bold">{ar ? 'الأصل المحدد' : 'Selected asset'}: {selectedMedia.fileName}</p>
                        <p className="mt-1 text-indigo-700">{ar ? 'سيتحقق الخادم من الملكية والنوع والحجم والأبعاد ونسبة العرض قبل الإرفاق.' : 'The server will verify ownership, type, size, dimensions, and aspect ratio before attachment.'}</p>
                      </div>
                    )}

                    <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="flex items-start gap-3 text-xs leading-5 text-slate-700">
                        <input type="checkbox" checked={creativeDraftAcknowledged} onChange={event => setCreativeDraftAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4" />
                        <span>{ar ? 'أؤكد أن هذا الإرفاق لمسودة الإعلان داخل NEXUS فقط، ولا يعني إنشاء منصة أو إطلاقًا أو إنفاقًا.' : 'I confirm this attachment is for the local NEXUS ad draft only and does not create a platform object, launch, or spend.'}</span>
                      </label>
                      <label className="flex items-start gap-3 text-xs leading-5 text-slate-700">
                        <input type="checkbox" checked={creativeRightsAcknowledged} onChange={event => setCreativeRightsAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4" />
                        <span>{ar ? 'أؤكد أن الأصل تمت مراجعته للاستخدام الإعلاني وأن مساحة العمل تملك حق استخدامه.' : 'I confirm the asset was reviewed for paid use and this workspace has the right to use it.'}</span>
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                <p className="text-[11px] text-slate-500">{ar ? 'التكلفة: 0 رصيد · لا يوجد اتصال بمنصة' : 'Cost: 0 credits · no platform call'}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => closeCreativeAttach()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                    {ar ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAttachCreative}
                    disabled={!selectedMediaId || !creativeDraftAcknowledged || !creativeRightsAcknowledged || creativeAttachLoading}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {creativeAttachLoading ? (ar ? 'جارٍ التحقق والإرفاق...' : 'Validating and attaching...') : (ar ? 'إرفاق الأصل بالمسودة' : 'Attach asset to draft')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPlatformDraftConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(2,6,23,0.72)' }}
          >
            <div
              className="paid-detail-modal w-full max-w-[500px] rounded-[16px] p-5"
              style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.22)' }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-[16px] font-bold text-white">Create paused platform drafts</h3>
                  <p className="text-[12px] text-text-muted mt-1">
                    NEXUS will create paused {campaign.platform} draft objects only. This will not launch ads, make the campaign active, or spend budget.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPlatformDraftConfirm(false)
                    setPlatformDraftAcknowledged(false)
                    setBudgetReadinessAcknowledged(false)
                    setGooglePoliticalDeclarationAcknowledged(false)
                  }}
                  className="text-text-muted hover:text-white"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div
                className="rounded-[12px] p-4 mb-4"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.22)' }}
              >
                <p className="text-[12px] text-slate-200 leading-relaxed">
                  Confirm budget, tracking, creative, and platform readiness have been reviewed. Platform-side review is still required before any launch or spend.
                </p>
              </div>

              <label className="flex items-start gap-3 text-[12px] text-slate-200 leading-relaxed mb-5">
                <input
                  type="checkbox"
                  checked={platformDraftAcknowledged}
                  onChange={(event) => setPlatformDraftAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  I confirm this should create paused platform draft objects only. I understand this does not launch ads or spend budget.
                </span>
              </label>

              {campaign.platform === 'GOOGLE' ? (
                <label className="flex items-start gap-3 text-[12px] text-slate-200 leading-relaxed mb-5">
                  <input
                    type="checkbox"
                    checked={googlePoliticalDeclarationAcknowledged}
                    onChange={(event) => setGooglePoliticalDeclarationAcknowledged(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    I confirm this campaign does not contain political advertising targeted to the European Union. NEXUS will send this declaration to Google Ads.
                  </span>
                </label>
              ) : null}

              <label className="flex items-start gap-3 text-[12px] text-slate-200 leading-relaxed mb-5">
                <input
                  type="checkbox"
                  checked={budgetReadinessAcknowledged}
                  onChange={(event) => setBudgetReadinessAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  I confirm the budget, tracking, creative, and platform readiness have been reviewed for this draft creation.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowPlatformDraftConfirm(false)
                    setPlatformDraftAcknowledged(false)
                    setBudgetReadinessAcknowledged(false)
                    setGooglePoliticalDeclarationAcknowledged(false)
                  }}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-text-muted"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePushToPlatform}
                  disabled={platformDraftBlockedByCoreConfirmations || (campaign.platform === 'GOOGLE' && !googlePoliticalDeclarationAcknowledged)}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{
                    background: platformDraftAcknowledged && budgetReadinessAcknowledged && (campaign.platform !== 'GOOGLE' || googlePoliticalDeclarationAcknowledged) && !pushLoading ? `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` : 'rgba(255,255,255,0.08)',
                    cursor: platformDraftAcknowledged && budgetReadinessAcknowledged && (campaign.platform !== 'GOOGLE' || googlePoliticalDeclarationAcknowledged) && !pushLoading ? 'pointer' : 'not-allowed',
                    opacity: platformDraftAcknowledged && budgetReadinessAcknowledged && (campaign.platform !== 'GOOGLE' || googlePoliticalDeclarationAcknowledged) && !pushLoading ? 1 : 0.62,
                  }}
                >
                  {pushLoading ? 'Creating paused platform drafts...' : 'Create paused platform drafts'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPlatformActivationConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(2,6,23,0.72)' }}
          >
            <div
              className="paid-detail-modal w-full max-w-[520px] rounded-[16px] p-5"
              style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.22)' }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-[16px] font-bold text-white">Activate paid campaign after final approval</h3>
                  <p className="text-[12px] text-text-muted mt-1">
                    NEXUS will activate existing paused {campaign.platform} platform objects. This may start delivery and spend on the connected ad account.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPlatformActivationConfirm(false)
                    setPlatformActivationAcknowledged(false)
                    setSpendActivationAcknowledged(false)
                    setActivationBudgetAcknowledged(false)
                  }}
                  className="text-text-muted hover:text-white"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div
                className="rounded-[12px] p-4 mb-4"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)' }}
              >
                <p className="text-[12px] text-slate-200 leading-relaxed">
                  This is the final paid launch step. Use it only after the client approves the campaign, budget, destination, creative, tracking, and platform account.
                </p>
              </div>

              <label className="flex items-start gap-3 text-[12px] text-slate-200 leading-relaxed mb-5">
                <input
                  type="checkbox"
                  checked={platformActivationAcknowledged}
                  onChange={(event) => setPlatformActivationAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  I confirm the client approved activating this paid campaign on the connected platform.
                </span>
              </label>

              <label className="flex items-start gap-3 text-[12px] text-slate-200 leading-relaxed mb-5">
                <input
                  type="checkbox"
                  checked={spendActivationAcknowledged}
                  onChange={(event) => setSpendActivationAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  I understand this may start ad delivery and spend on the connected ad account.
                </span>
              </label>

              <label className="flex items-start gap-3 text-[12px] text-slate-200 leading-relaxed mb-5">
                <input
                  type="checkbox"
                  checked={activationBudgetAcknowledged}
                  onChange={(event) => setActivationBudgetAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  I confirm the budget, tracking, creative, destination, and platform readiness are approved for launch.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowPlatformActivationConfirm(false)
                    setPlatformActivationAcknowledged(false)
                    setSpendActivationAcknowledged(false)
                    setActivationBudgetAcknowledged(false)
                  }}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-text-muted"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivatePlatform}
                  disabled={!platformActivationAcknowledged || !spendActivationAcknowledged || !activationBudgetAcknowledged || activateLoading}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{
                    background: platformActivationAcknowledged && spendActivationAcknowledged && activationBudgetAcknowledged && !activateLoading ? `linear-gradient(135deg, ${platformColor}, ${platformColor}bb)` : 'rgba(255,255,255,0.08)',
                    cursor: platformActivationAcknowledged && spendActivationAcknowledged && activationBudgetAcknowledged && !activateLoading ? 'pointer' : 'not-allowed',
                    opacity: platformActivationAcknowledged && spendActivationAcknowledged && activationBudgetAcknowledged && !activateLoading ? 1 : 0.62,
                  }}
                >
                  {activateLoading ? 'Activating paid campaign...' : 'Activate paid campaign'}
                </button>
              </div>
            </div>
          </div>
        )}
        <CreditConfirmModal
          isOpen={generationConfirmation !== null}
          onClose={() => setGenerationConfirmation(null)}
          onConfirm={() => {
            if (generationConfirmation) void handleGenerateExecutionArtifact(generationConfirmation)
          }}
          cost={generationConfirmation === 'plan' ? 4 : 2}
          actionTitle={generationConfirmation === 'plan'
            ? (ar ? 'إنشاء خطة تنفيذ مدفوعة' : 'Generate paid execution plan')
            : (ar ? 'إنشاء مسودات النصوص الإعلانية' : 'Generate ad copy drafts')}
          reason={generationConfirmation === 'plan'
            ? (ar
                ? 'يحوّل الاستراتيجية المعتمدة إلى خطة تنفيذ منصة قابلة للمراجعة من دون إطلاق أو إنفاق.'
                : 'Converts the approved strategy into a reviewable platform execution plan without launch or spend.')
            : (ar
                ? 'ينشئ مسودات نصوص إعلانية مرتبطة بالاستراتيجية للمراجعة قبل أي تفعيل.'
                : 'Creates strategy-aligned ad-copy drafts for review before any activation.')}
          authHeader={authHeader}
          locale={locale}
          includedItems={generationConfirmation === 'plan'
            ? (ar
                ? ['استهداف المنصة', 'توزيع ميزانية للمراجعة', 'موجز إبداعي', 'لا إطلاق ولا إنفاق']
                : ['Platform targeting', 'Reviewable budget allocation', 'Creative brief', 'No launch or spend'])
            : (ar
                ? ['نصوص مرتبطة بالاستراتيجية', 'مسودات للمراجعة', 'لا نشر ولا إنفاق']
                : ['Strategy-aligned copy', 'Drafts for review', 'No publish or spend'])}
        />
        </div>
      </div>
    </AppShell>
  )
}

// ── PerformanceChart — pure SVG, no external deps ─────────────────────────
function PerformanceChart({
  snapshots,
  currency,
}: {
  snapshots: Array<{ date: string; spend: number; impressions: number; clicks: number; roas: number | null }>
  currency: string
}) {
  const W = 800; const H = 200; const PAD = 40

  const spends = snapshots.map(s => s.spend || 0)
  const maxSpend = Math.max(...spends, 1)

  const hasCompleteRoas = snapshots.every(s => s.roas !== null && Number.isFinite(s.roas))
  const roas = snapshots.map(s => s.roas ?? 0)
  const maxRoas = Math.max(...roas, 1)

  const xStep = (W - PAD * 2) / Math.max(snapshots.length - 1, 1)

  const spendPts = snapshots.map((_, i) => {
    const x = PAD + i * xStep
    const y = H - PAD - ((spends[i] / maxSpend) * (H - PAD * 2))
    return `${x},${y}`
  }).join(' ')

  const roasPts = snapshots.map((_, i) => {
    const x = PAD + i * xStep
    const y = H - PAD - ((roas[i] / maxRoas) * (H - PAD * 2))
    return `${x},${y}`
  }).join(' ')

  // Gradient fill area for spend
  const spendArea = `M${PAD},${H - PAD} ` +
    snapshots.map((_, i) => `L${PAD + i * xStep},${H - PAD - ((spends[i] / maxSpend) * (H - PAD * 2))}`).join(' ') +
    ` L${PAD + (snapshots.length - 1) * xStep},${H - PAD} Z`

  return (
    <div className="rounded-[14px] overflow-hidden"
      style={{ background: 'var(--nx-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <h4 className="text-[12px] font-bold text-white">Spend & ROAS Trend</h4>
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block rounded" style={{ background: '#F97316' }} /> Spend ({currency})</span>
          {hasCompleteRoas && <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block rounded" style={{ background: '#10B981' }} /> ROAS</span>}
        </div>
      </div>
      <div className="px-2 py-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 180 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(frac => {
            const y = H - PAD - frac * (H - PAD * 2)
            return <line key={frac} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          })}
          {/* Spend fill area */}
          <path d={spendArea} fill="url(#spendGrad)" />
          {/* Spend line */}
          <polyline points={spendPts} fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* ROAS line */}
          {hasCompleteRoas && <polyline points={roasPts} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3" />}
          {/* X-axis date labels (every nth) */}
          {snapshots.map((s, i) => {
            if (snapshots.length > 10 && i % Math.ceil(snapshots.length / 7) !== 0) return null
            const x = PAD + i * xStep
            const label = new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            return (
              <text key={i} x={x} y={H - 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">{label}</text>
            )
          })}
          {/* Y-axis max spend label */}
          <text x={PAD - 4} y={PAD + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">{currency} {maxSpend.toFixed(0)}</text>
          <text x={PAD - 4} y={H - PAD + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">0</text>
        </svg>
      </div>
    </div>
  )
}
