/**
 * Brand Brain — execution-workflow event capture (Brand Brain Sprint PR1).
 *
 * Pure, dependency-free helpers that turn an honest lifecycle transition into a
 * structured `MarketingLearningEvent` row. This is the FOUNDATION for a future
 * signal/analytics engine — it only CAPTURES what happened. It never generates
 * recommendations, never scores, never infers results, and never stores a
 * performance metric.
 *
 * The event type for each transition complements PR1's legacy `learningEventForTransition`
 * (which feeds the brand-memory naming); here we use execution-specific, explicit
 * names (e.g. POST_UNSCHEDULED vs POST_REVERTED_TO_DRAFT) for the workflow log.
 */

import type { PostStatus, PublishMode } from './postStatus'

export type ExecutionEventType =
  | 'POST_APPROVED'              // DRAFT → APPROVED
  | 'POST_SCHEDULED'            // APPROVED → SCHEDULED
  | 'POST_MANUALLY_PUBLISHED'  // SCHEDULED → PUBLISHED (by hand)
  | 'POST_AUTO_PUBLISHED'      // SCHEDULED → PUBLISHED (real-API cron) — defined; not written by this PR
  | 'POST_UNSCHEDULED'         // SCHEDULED → APPROVED
  | 'POST_REVERTED_TO_DRAFT'   // APPROVED|SCHEDULED → DRAFT
  | 'POST_FAILED'              // → FAILED

/**
 * Map an honest status transition to its execution event type, or null when the
 * transition is a no-op / not a capture-worthy action (so invalid transitions never
 * create events). Mirrors the guarded lifecycle: a DRAFT can never jump to PUBLISHED.
 */
export function executionEventType(
  from: PostStatus | null,
  to: PostStatus,
  mode: PublishMode = 'MANUAL',
): ExecutionEventType | null {
  if (to === 'APPROVED') {
    if (from === 'DRAFT') return 'POST_APPROVED'
    if (from === 'SCHEDULED') return 'POST_UNSCHEDULED'
    return null
  }
  if (to === 'SCHEDULED') return from === 'APPROVED' ? 'POST_SCHEDULED' : null
  if (to === 'PUBLISHED') {
    if (from !== 'SCHEDULED' && from !== 'PROCESSING') return null
    return mode === 'AUTO' ? 'POST_AUTO_PUBLISHED' : 'POST_MANUALLY_PUBLISHED'
  }
  if (to === 'DRAFT') return from === 'APPROVED' || from === 'SCHEDULED' ? 'POST_REVERTED_TO_DRAFT' : null
  if (to === 'FAILED') return 'POST_FAILED'
  return null
}

export interface LearningEventInput {
  workspaceId: string
  campaignId?: string | null
  socialPostId?: string | null
  from: PostStatus | null
  to: PostStatus
  actor?: 'USER' | 'SYSTEM' | 'CRON'
  publishMode?: PublishMode | null
  platform?: string | null
  scheduledAt?: Date | string | null
  approvedAt?: Date | string | null
  publishedAt?: Date | string | null
  manuallyPublishedAt?: Date | string | null
  platformUrl?: string | null
}

export interface LearningEventRow {
  workspaceId: string
  campaignId: string | null
  socialPostId: string | null
  eventType: ExecutionEventType
  source: 'EXECUTION_WORKFLOW'
  actor: 'USER' | 'SYSTEM' | 'CRON'
  metadata: Record<string, unknown>
}

function toIso(v: Date | string | null | undefined): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Valid http(s) URL string, or null — never returns a malformed/sensitive value. */
function validUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const t = url.trim()
  return /^https?:\/\/\S+$/i.test(t) ? t : null
}

/** Safe hostname only (e.g. "facebook.com") — never the full URL with its query/path. */
function safeDomain(url: string | null | undefined): string | null {
  const valid = validUrl(url)
  if (!valid) return null
  try {
    return new URL(valid).hostname || null
  } catch {
    return null
  }
}

/**
 * Build one workflow event row for a transition, or null if the transition is not a
 * capture-worthy action. Metadata is intentionally small and safe: honest from/to
 * status, publish mode, platform, the relevant timestamps, and a boolean for whether a
 * live URL exists (plus its bare domain). No metrics, no inferred outcome, no full URL.
 */
export function buildLearningEvent(input: LearningEventInput): LearningEventRow | null {
  const mode: PublishMode = input.publishMode ?? 'MANUAL'
  const eventType = executionEventType(input.from, input.to, mode)
  if (!eventType) return null

  const metadata: Record<string, unknown> = {
    fromStatus: input.from ?? null,
    toStatus: input.to,
    publishMode: mode,
  }
  if (input.platform) metadata.platform = input.platform

  const scheduledAt = toIso(input.scheduledAt)
  const approvedAt = toIso(input.approvedAt)
  const publishedAt = toIso(input.publishedAt)
  const manuallyPublishedAt = toIso(input.manuallyPublishedAt)
  if (scheduledAt) metadata.scheduledAt = scheduledAt
  if (approvedAt) metadata.approvedAt = approvedAt
  if (publishedAt) metadata.publishedAt = publishedAt
  if (manuallyPublishedAt) metadata.manuallyPublishedAt = manuallyPublishedAt

  metadata.hasPlatformUrl = !!validUrl(input.platformUrl)
  const domain = safeDomain(input.platformUrl)
  if (domain) metadata.platformUrlDomain = domain

  return {
    workspaceId: input.workspaceId,
    campaignId: input.campaignId ?? null,
    socialPostId: input.socialPostId ?? null,
    eventType,
    source: 'EXECUTION_WORKFLOW',
    actor: input.actor ?? 'USER',
    metadata,
  }
}

/** Build the capture-worthy events for a batch of transitions (drops no-op transitions). */
export function buildLearningEvents(inputs: LearningEventInput[]): LearningEventRow[] {
  const out: LearningEventRow[] = []
  for (const input of inputs) {
    const row = buildLearningEvent(input)
    if (row) out.push(row)
  }
  return out
}
