import {
  deriveContentLifecycleTruth,
  type ContentLifecycleTruthInput,
} from '@/lib/contentLifecycleTruth'

export type DashboardContentRunwayState =
  | 'NEEDS_ATTENTION'
  | 'FAILED'
  | 'OVERDUE_MANUAL'
  | 'PROCESSING'
  | 'INTERNAL_SCHEDULE_MANUAL'
  | 'AUTO_DELIVERY_CONFIGURED'
  | 'APPROVED_READY'
  | 'DRAFT_REVIEW'
  | 'PUBLISHED_EXTERNAL'
  | 'PUBLISHED_MANUAL'

export interface DashboardContentPostInput extends ContentLifecycleTruthInput {
  id: string
  campaignId?: string | null
  campaignName?: string | null
  platform?: string | null
  publishTarget?: string | null
  caption?: string | null
  imageUrl?: string | null
  isVideoPost?: boolean | null
  contentPlanIndex?: number | null
  publishMode?: string | null
  integrationId?: string | null
  integrationStatus?: string | null
  autoPublishConsentAt?: string | Date | null
  publishedAt?: string | Date | null
  manuallyPublishedAt?: string | Date | null
  platformPostId?: string | null
  platformUrl?: string | null
  errorMessage?: string | null
  updatedAt?: string | Date | null
}

export interface DashboardContentRunwayItem {
  id: string
  campaignId: string | null
  campaignName: string
  contentHubHref: string
  platform: string
  caption: string
  mediaUrl: string | null
  mediaKind: 'video' | 'image' | 'none'
  contentPlanIndex: number | null
  state: DashboardContentRunwayState
  scheduledAt: string | null
  updatedAt: string | null
  copyApproved: boolean
  mediaApproved: boolean
  scheduleEvidenced: boolean
  publishMode: 'MANUAL' | 'AUTO'
  integrationLinked: boolean
  externalPublishConfirmed: boolean
}

function validIso(value?: string | Date | null): string | null {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function hasError(value?: string | null): boolean {
  return Boolean(value?.trim())
}

function mediaKind(input: DashboardContentPostInput): DashboardContentRunwayItem['mediaKind'] {
  if (!input.imageUrl) return 'none'
  if (input.isVideoPost || /\.(mp4|mov|webm|m4v)(?:\?|$)/i.test(input.imageUrl)) return 'video'
  return 'image'
}

/**
 * Dashboard-specific presentation truth. It deliberately distinguishes an
 * internal/manual schedule from provider delivery and fails closed whenever
 * immutable approval, media, schedule, consent, or provider evidence is absent.
 */
export function deriveDashboardContentRunwayItem(
  input: DashboardContentPostInput,
  now = new Date(),
): DashboardContentRunwayItem {
  const lifecycle = deriveContentLifecycleTruth(input)
  const status = lifecycle.status
  const scheduledAt = validIso(input.scheduledAt)
  const updatedAt = validIso(input.updatedAt)
  const publishMode = input.publishMode === 'AUTO' ? 'AUTO' : 'MANUAL'
  const integrationLinked = Boolean(input.integrationId)
  const integrationConnected = input.integrationStatus === 'CONNECTED'
  const hasAutoConsent = Boolean(validIso(input.autoPublishConsentAt))
  const externalPublishConfirmed = status === 'PUBLISHED'
    && Boolean(validIso(input.publishedAt))
    && Boolean(input.platformPostId || input.platformUrl)

  let state: DashboardContentRunwayState

  if (hasError(input.errorMessage)) {
    state = 'NEEDS_ATTENTION'
  } else if (status === 'FAILED') {
    state = 'FAILED'
  } else if (status === 'PROCESSING') {
    state = 'PROCESSING'
  } else if (status === 'PUBLISHED') {
    if (externalPublishConfirmed) {
      state = 'PUBLISHED_EXTERNAL'
    } else if (validIso(input.manuallyPublishedAt)) {
      state = 'PUBLISHED_MANUAL'
    } else {
      state = 'NEEDS_ATTENTION'
    }
  } else if (lifecycle.isInvalidScheduled) {
    state = 'NEEDS_ATTENTION'
  } else if (lifecycle.isValidScheduled) {
    if (publishMode === 'AUTO') {
      state = integrationLinked && integrationConnected && hasAutoConsent
        ? 'AUTO_DELIVERY_CONFIGURED'
        : 'NEEDS_ATTENTION'
    } else {
      state = scheduledAt && new Date(scheduledAt).getTime() < now.getTime()
        ? 'OVERDUE_MANUAL'
        : 'INTERNAL_SCHEDULE_MANUAL'
    }
  } else if (status === 'APPROVED') {
    state = lifecycle.hasImmutableCopyApproval && lifecycle.hasFinalMediaApproval
      ? 'APPROVED_READY'
      : 'NEEDS_ATTENTION'
  } else {
    state = 'DRAFT_REVIEW'
  }

  const campaignId = input.campaignId || null
  const resolvedPlatform = String(input.publishTarget || input.platform || 'CONTENT').toUpperCase()

  return {
    id: input.id,
    campaignId,
    campaignName: input.campaignName?.trim() || 'Campaign',
    contentHubHref: campaignId ? `/campaigns/${campaignId}/content-hub` : '/content-hub',
    platform: resolvedPlatform,
    caption: input.caption?.trim() || '',
    mediaUrl: input.imageUrl || null,
    mediaKind: mediaKind(input),
    contentPlanIndex: input.contentPlanIndex ?? null,
    state,
    scheduledAt,
    updatedAt,
    copyApproved: lifecycle.hasImmutableCopyApproval,
    mediaApproved: lifecycle.hasFinalMediaApproval,
    scheduleEvidenced: lifecycle.isValidScheduled,
    publishMode,
    integrationLinked,
    externalPublishConfirmed,
  }
}

const STATE_PRIORITY: Record<DashboardContentRunwayState, number> = {
  FAILED: 0,
  NEEDS_ATTENTION: 1,
  OVERDUE_MANUAL: 2,
  PROCESSING: 3,
  INTERNAL_SCHEDULE_MANUAL: 4,
  AUTO_DELIVERY_CONFIGURED: 5,
  APPROVED_READY: 6,
  DRAFT_REVIEW: 7,
  PUBLISHED_EXTERNAL: 8,
  PUBLISHED_MANUAL: 9,
}

function timeOrMax(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

export function sortDashboardContentRunway(
  items: DashboardContentRunwayItem[],
): DashboardContentRunwayItem[] {
  return [...items].sort((left, right) => {
    const stateDifference = STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state]
    if (stateDifference !== 0) return stateDifference

    const scheduleDifference = timeOrMax(left.scheduledAt) - timeOrMax(right.scheduledAt)
    if (scheduleDifference !== 0) return scheduleDifference

    return timeOrMax(right.updatedAt) - timeOrMax(left.updatedAt)
  })
}
