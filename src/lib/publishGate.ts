/**
 * Publish safety gate (Publishing & Campaign Calendar Sprint — PR 3).
 *
 * The cron publisher may auto-publish a post to a real platform ONLY when the user
 * explicitly opted that post into automatic publishing (publishMode === 'AUTO').
 * Everything else — the MANUAL default, legacy rows, unknown/missing values — must
 * NEVER be auto-published, even if it is SCHEDULED and past due.
 *
 * Pure and dependency-free so the gate is fully unit-testable without a database or
 * any network. The cron route uses `autoPublishWhere` for the DB query AND
 * `isAutoPublishEligible` as a belt-and-suspenders in-code filter, so a MANUAL post
 * or a post without confirmed media can never reach the publishing code path.
 */

import {
  isContentPostMediaReadyForScheduling,
  type ContentHubMediaStateInput,
} from './contentHubMediaState'

export type PublishModeValue = 'MANUAL' | 'AUTO'

export interface CronPostLike extends ContentHubMediaStateInput {
  status: string
  /** May be missing/null on legacy rows — anything that is not exactly 'AUTO' is MANUAL. */
  publishMode?: string | null
  scheduledAt?: Date | string | null
  autoPublishConsentAt?: Date | string | null
  approvedSnapshotId?: string | null
  mediaApprovalSnapshotId?: string | null
  scheduledSnapshotId?: string | null
}

/**
 * The single source of truth for "may the cron auto-publish this post right now?".
 * Returns true ONLY when: status SCHEDULED + publishMode AUTO + confirmed media +
 * a valid, due scheduledAt.
 * Default/unknown/legacy publishMode is treated as MANUAL → never eligible.
 */
export function isAutoPublishEligible(post: CronPostLike, now: Date): boolean {
  if (post.status !== 'SCHEDULED') return false
  if (post.publishMode !== 'AUTO') return false           // MANUAL / null / legacy → blocked
  if (!post.autoPublishConsentAt) return false            // explicit per-post consent is mandatory
  if (!post.approvedSnapshotId || !post.mediaApprovalSnapshotId || !post.scheduledSnapshotId) return false
  if (!isContentPostMediaReadyForScheduling(post)) return false
  if (!post.scheduledAt) return false
  const due = new Date(post.scheduledAt as any)
  if (isNaN(due.getTime())) return false
  return due.getTime() <= now.getTime()
}

/**
 * Prisma `where` filter for the cron selection. Mirrors `isAutoPublishEligible` at the
 * database level so MANUAL posts are never even fetched.
 */
export function autoPublishWhere(now: Date) {
  return {
    status: 'SCHEDULED' as const,
    publishMode: 'AUTO' as const,
    autoPublishConsentAt: { not: null },
    approvedSnapshotId: { not: null },
    mediaApprovalSnapshotId: { not: null },
    scheduledSnapshotId: { not: null },
    generationStatus: 'DONE' as const,
    imageUrl: { not: null },
    scheduledAt: { lte: now },
  }
}

/**
 * Prisma `where` filter for posts the cron deliberately SKIPS: SCHEDULED + due but NOT
 * AUTO (i.e. MANUAL / legacy). Used only to log a safe skipped-count for observability —
 * these posts are never modified.
 */
export function skippedManualWhere(now: Date) {
  return {
    status: 'SCHEDULED' as const,
    scheduledAt: { lte: now },
    NOT: { publishMode: 'AUTO' as const },
  }
}
