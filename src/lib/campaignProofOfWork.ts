/**
 * Campaign Proof of Work — Operator Foundation PR-1C1 ("What NEXUS did here")
 *
 * PURE, READ-ONLY derivation. No network, no I/O, no side effects.
 * Turns the campaign + its content-plan posts (already fetched via the existing
 * GET routes) into an honest, compact "completed work" view for ONE campaign.
 *
 * Non-negotiable honesty rules (enforced here, asserted in tests):
 *   - Every item is backed by a REAL campaign/SocialPost field. Nothing fabricated.
 *   - scheduled ≠ published · approved ≠ scheduled · generated/DRAFT ≠ completed proof.
 *   - manual ≠ auto: AUTO only when publishMode === 'AUTO'; otherwise MANUAL.
 *   - published only when status === 'PUBLISHED'.
 *   - failed only when status === 'FAILED' AND a stored errorMessage exists (never invent a reason).
 *   - no "analytics fetched" item is ever produced.
 *   - returns i18n KEYS (+ small interpolation data) — never raw IDs/JSON/enums.
 */

import { deriveContentLifecycleTruth } from './contentLifecycleTruth'

export type ProofStatus = 'done' | 'needs_review' | 'scheduled' | 'published' | 'failed'
export type ProofMode = 'manual' | 'auto' | null
export type ProofGroup = 'strategy' | 'content' | 'publishing'

/** Minimal campaign shape (already-loaded campaign page data). */
export interface ProofCampaignInput {
  strategy?: unknown
  aiOutput?: { strategy?: unknown } | null
}

/** Minimal post shape from GET /api/campaigns/[id]/content-plan. */
export interface ProofPostInput {
  id?: string | null
  status?: string | null
  publishMode?: string | null
  platform?: string | null
  scheduledAt?: string | null
  approvedAt?: string | null
  approvedSnapshotId?: string | null
  mediaApprovalSnapshotId?: string | null
  scheduledSnapshotId?: string | null
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
  publishedAt?: string | null
  manuallyPublishedAt?: string | null
  platformUrl?: string | null
  errorMessage?: string | null
}

export interface ProofItem {
  key: string
  group: ProofGroup
  status: ProofStatus
  mode: ProofMode
  /** i18n key for the status chip */
  statusKey: string
  /** i18n key for the mode qualifier chip, or null */
  modeKey: string | null
  /** i18n key for the title (may contain {count} / {platform} placeholders) */
  titleKey: string
  count?: number
  platform?: string | null
  /** validated https URL on a published post, else null (gates the View post link) */
  platformUrl: string | null
  /** stored failure reason — ONLY present on failed items; never fabricated */
  errorMessage: string | null
  /** ISO timestamp for display, or null */
  at: string | null
  /** true only when a real platform URL exists on a published post */
  canViewPost: boolean
}

export interface ProofResult {
  items: ProofItem[]
  isEmpty: boolean
  groups: { strategy: ProofItem[]; content: ProofItem[]; publishing: ProofItem[] }
}

const P = 'campaign.proof'

const STATUS_KEY: Record<ProofStatus, string> = {
  done: `${P}.status.done`,
  needs_review: `${P}.status.needsReview`,
  scheduled: `${P}.status.scheduled`,
  published: `${P}.status.published`,
  failed: `${P}.status.failed`,
}

function validUrl(url?: string | null): string | null {
  if (!url) return null
  const t = String(url).trim()
  return /^https?:\/\/\S+$/i.test(t) ? t : null
}

function isNonEmptyStrategy(c?: ProofCampaignInput | null): boolean {
  if (!c) return false
  const s = c.strategy ?? c.aiOutput?.strategy
  if (s == null) return false
  if (typeof s === 'string') return s.trim().length > 0
  if (Array.isArray(s)) return s.length > 0
  if (typeof s === 'object') return Object.keys(s as object).length > 0
  return false
}

/** AUTO only when publishMode is exactly 'AUTO' (case-insensitive); everything else is MANUAL. */
function publishedMode(publishMode?: string | null): 'auto' | 'manual' {
  return String(publishMode || '').toUpperCase() === 'AUTO' ? 'auto' : 'manual'
}

/**
 * Derive the honest "What NEXUS did here" proof items for ONE campaign.
 * Aggregates in-progress states (approved/scheduled) into compact count rows;
 * itemises completed-with-proof states (each PUBLISHED post with its URL, each
 * FAILED post with its stored reason).
 */
export function deriveCampaignProofOfWork(
  campaign: ProofCampaignInput | null | undefined,
  posts: ProofPostInput[] | null | undefined,
): ProofResult {
  const list = Array.isArray(posts) ? posts : []
  const norm = (s?: string | null) => String(s || '').toUpperCase()

  const strategy: ProofItem[] = []
  const content: ProofItem[] = []
  const publishing: ProofItem[] = []

  // 1) Strategy created — only if a real strategy exists
  if (isNonEmptyStrategy(campaign)) {
    strategy.push({
      key: 'strategy-created', group: 'strategy', status: 'done', mode: null,
      statusKey: STATUS_KEY.done, modeKey: null, titleKey: `${P}.item.strategyCreated`,
      platformUrl: null, errorMessage: null, at: null, canViewPost: false,
    })
  }

  // 2) Content plan created — only if real post rows exist
  if (list.length > 0) {
    content.push({
      key: 'content-plan-created', group: 'content', status: 'done', mode: null,
      statusKey: STATUS_KEY.done, modeKey: null, titleKey: `${P}.item.contentPlanCreated`,
      count: list.length, platformUrl: null, errorMessage: null, at: null, canViewPost: false,
    })
  }

  // 3) Aggregate in-progress states + itemise completed-with-proof states
  const approvedCount = list.filter((p) => norm(p.status) === 'APPROVED').length
  const scheduledTruth = list
    .filter((p) => norm(p.status) === 'SCHEDULED')
    .map(deriveContentLifecycleTruth)
  const scheduledCount = scheduledTruth.filter((truth) => truth.isValidScheduled).length
  const invalidScheduledCount = scheduledTruth.filter((truth) => truth.isInvalidScheduled).length

  if (approvedCount > 0) {
    content.push({
      key: 'approved', group: 'content', status: 'needs_review', mode: null,
      statusKey: STATUS_KEY.needs_review, modeKey: null, titleKey: `${P}.item.approved`,
      count: approvedCount, platformUrl: null, errorMessage: null, at: null, canViewPost: false,
    })
  }
  if (scheduledCount > 0) {
    publishing.push({
      key: 'scheduled', group: 'publishing', status: 'scheduled', mode: null,
      statusKey: STATUS_KEY.scheduled, modeKey: null, titleKey: `${P}.item.scheduled`,
      count: scheduledCount, platformUrl: null, errorMessage: null, at: null, canViewPost: false,
    })
  }
  if (invalidScheduledCount > 0) {
    content.push({
      key: 'invalid-schedule', group: 'content', status: 'needs_review', mode: null,
      statusKey: STATUS_KEY.needs_review, modeKey: null, titleKey: `${P}.item.invalidSchedule`,
      count: invalidScheduledCount, platformUrl: null, errorMessage: null, at: null, canViewPost: false,
    })
  }

  // Published — one item per post (high-value, carries a real proof URL)
  list.forEach((p, i) => {
    if (norm(p.status) !== 'PUBLISHED') return
    const mode = publishedMode(p.publishMode)
    const url = validUrl(p.platformUrl)
    publishing.push({
      key: `published-${p.id || i}`,
      group: 'publishing', status: 'published', mode,
      statusKey: STATUS_KEY.published,
      modeKey: mode === 'auto' ? `${P}.mode.auto` : `${P}.mode.manual`,
      titleKey: mode === 'auto' ? `${P}.item.publishedAuto` : `${P}.item.publishedManual`,
      platform: p.platform ?? null,
      platformUrl: url,
      errorMessage: null,
      at: p.manuallyPublishedAt || p.publishedAt || null,
      canViewPost: url !== null,
    })
  })

  // Failed — ONLY when a stored reason exists (never fabricate)
  list.forEach((p, i) => {
    if (norm(p.status) !== 'FAILED') return
    const reason = p.errorMessage && String(p.errorMessage).trim().length > 0 ? String(p.errorMessage).trim() : null
    if (!reason) return // honesty: no failed item without a real reason
    publishing.push({
      key: `failed-${p.id || i}`,
      group: 'publishing', status: 'failed', mode: null,
      statusKey: STATUS_KEY.failed, modeKey: null, titleKey: `${P}.item.failed`,
      platform: p.platform ?? null, platformUrl: null,
      errorMessage: reason, at: null, canViewPost: false,
    })
  })

  const items = [...strategy, ...content, ...publishing]
  return {
    items,
    isEmpty: items.length === 0,
    groups: { strategy, content, publishing },
  }
}
