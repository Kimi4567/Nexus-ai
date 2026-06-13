/**
 * Post status foundation (Publishing & Campaign Calendar Sprint — PR 1).
 *
 * Pure, dependency-free helpers for the honest publishing lifecycle:
 *
 *   DRAFT → APPROVED → SCHEDULED → PUBLISHED | FAILED
 *
 * with safe corrective transitions (un-approve, unschedule, retry/reset). The
 * `publishMode` (MANUAL vs AUTO) keeps the UX honest: a scheduled post is never
 * shown as "published", and a post is only ever labelled API/auto-published when it
 * was published in AUTO mode AND the platform returned a real reference.
 *
 * Brand Brain readiness (intentionally NOT implemented here):
 *   Every transition maps to a named learning event (`learningEventForTransition`)
 *   and every transition is recordable as a `PostStatusHistory` row (actor + note +
 *   timestamps). PR 1 only DEFINES these shapes so a later PR can feed the
 *   Behavioral Brand Brain (what users approve / reject / schedule / publish) without
 *   re-architecting. No learning is triggered in this PR.
 *
 * This module imports nothing and touches no database, so it is fully unit-testable
 * and safe even before the additive migration is applied.
 */

// ── Core types (kept as string unions, decoupled from the Prisma client) ──────

export type PostStatus = 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
export type PublishMode = 'MANUAL' | 'AUTO'
export type StatusActor = 'USER' | 'SYSTEM' | 'CRON'

/** What a card/badge should display — derived, never stored. */
export type DisplayState =
  | 'draft'
  | 'approved'
  | 'scheduled_manual'
  | 'scheduled_auto'
  | 'published_manual'
  | 'published_auto'
  | 'failed'

// ── Allowed transitions ───────────────────────────────────────────────────────
// Forward lifecycle + safe corrective moves. Anything not listed is rejected.

const TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  DRAFT:     ['APPROVED'],                       // approve only — never jump to published
  APPROVED:  ['SCHEDULED', 'PUBLISHED', 'DRAFT'], // schedule, publish-now (manual), or un-approve/reject
  SCHEDULED: ['PUBLISHED', 'FAILED', 'APPROVED'], // publish, fail, or unschedule
  PUBLISHED: ['FAILED'],                          // a confirmed publish can only be corrected to FAILED
  FAILED:    ['SCHEDULED', 'APPROVED', 'DRAFT'],  // retry / reset
}

/** Is `from → to` an allowed lifecycle transition? */
export function canTransition(from: PostStatus, to: PostStatus): boolean {
  if (from === to) return false
  const allowed = TRANSITIONS[from]
  return !!allowed && allowed.includes(to)
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: string }

/** Validate a transition, returning a clear reason on failure. */
export function validateTransition(from: PostStatus, to: PostStatus): TransitionResult {
  if (from === to) return { ok: false, error: `No-op transition: already ${from}` }
  if (!TRANSITIONS[from]) return { ok: false, error: `Unknown status: ${from}` }
  if (!canTransition(from, to)) {
    return { ok: false, error: `Illegal transition ${from} → ${to}` }
  }
  return { ok: true }
}

// ── Derived display state (honesty lives here) ────────────────────────────────

export interface PostStateInput {
  status: PostStatus | string          // tolerate legacy/unknown values
  publishMode?: PublishMode | null      // defaults to MANUAL
  platformPostId?: string | null        // real platform reference (proves an API publish)
  platformUrl?: string | null
}

/**
 * Derive the user-facing display state. Honesty rules:
 *  - SCHEDULED is never "published" (manual or auto).
 *  - PUBLISHED is only "published_auto" when mode is AUTO AND a real platform
 *    reference exists; otherwise it is "published_manual" (user confirmed by hand).
 *  - Unknown/legacy statuses fall back to 'draft' — never a false "published".
 */
export function deriveDisplayState(input: PostStateInput): DisplayState {
  const mode: PublishMode = input.publishMode === 'AUTO' ? 'AUTO' : 'MANUAL'
  const hasPlatformRef = !!(input.platformPostId || input.platformUrl)

  switch (input.status) {
    case 'DRAFT':
      return 'draft'
    case 'APPROVED':
      return 'approved'
    case 'SCHEDULED':
      return mode === 'AUTO' ? 'scheduled_auto' : 'scheduled_manual'
    case 'PUBLISHED':
      return mode === 'AUTO' && hasPlatformRef ? 'published_auto' : 'published_manual'
    case 'FAILED':
      return 'failed'
    default:
      // Never claim publishing for an unrecognised status.
      return 'draft'
  }
}

/** True only when a real platform/API actually published the post. */
export function isApiPublished(state: DisplayState): boolean {
  return state === 'published_auto'
}

/** True when the post is live by any honest means (hand-posted or API-confirmed). */
export function isPublished(state: DisplayState): boolean {
  return state === 'published_manual' || state === 'published_auto'
}

/** True when the post is scheduled but NOT yet published (must never read as live). */
export function isScheduledNotPublished(state: DisplayState): boolean {
  return state === 'scheduled_manual' || state === 'scheduled_auto'
}

// ── i18n label keys (resolved by the i18n context, ar + en) ──────────────────

const DISPLAY_LABEL_KEY: Record<DisplayState, string> = {
  draft:            'status.draft',
  approved:         'status.approved',
  scheduled_manual: 'status.scheduledManual',
  scheduled_auto:   'status.scheduledAuto',
  published_manual: 'status.publishedManually',
  published_auto:   'status.publishedAuto',
  failed:           'status.failed',
}

/** i18n key for a display state (e.g. 'status.publishedManually'). */
export function displayStateLabelKey(state: DisplayState): string {
  return DISPLAY_LABEL_KEY[state]
}

/** Convenience: i18n key straight from raw fields. */
export function statusLabelKey(input: PostStateInput): string {
  return displayStateLabelKey(deriveDisplayState(input))
}

// ── Status-history record shape (for PostStatusHistory) ──────────────────────

export interface StatusHistoryInput {
  socialPostId: string
  workspaceId: string
  fromStatus: PostStatus | null
  toStatus: PostStatus
  actor?: StatusActor       // defaults to USER
  note?: string | null      // free-text reason (e.g. failure message, rewrite intent)
}

export interface StatusHistoryRow {
  socialPostId: string
  workspaceId: string
  fromStatus: PostStatus | null
  toStatus: PostStatus
  actor: StatusActor
  note: string | null
}

/**
 * Build the row to persist for a lifecycle transition. `createdAt` is intentionally
 * omitted (the DB default fills it). Used by a later PR's status-transition helper.
 */
export function buildStatusHistory(input: StatusHistoryInput): StatusHistoryRow {
  return {
    socialPostId: input.socialPostId,
    workspaceId: input.workspaceId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actor: input.actor ?? 'USER',
    note: input.note ?? null,
  }
}

// ── Brand Brain learning hooks (defined now, NOT executed in PR 1) ───────────
// Maps a lifecycle transition to a Behavioral-Brand-Brain learning event so a
// later sprint can learn from real user execution behaviour (what they approve,
// reject, schedule, hand-publish, etc.) without changing this foundation.

export type BrandBrainEvent =
  | 'post_approved'
  | 'post_rejected'
  | 'post_scheduled'
  | 'post_published_manual'
  | 'post_published_auto'
  | 'post_failed'
  | 'post_reset'

export function learningEventForTransition(
  from: PostStatus | null,
  to: PostStatus,
  mode: PublishMode = 'MANUAL',
): BrandBrainEvent | null {
  if (to === 'APPROVED') return from === 'DRAFT' ? 'post_approved' : 'post_reset'
  if (to === 'SCHEDULED') return 'post_scheduled'
  if (to === 'PUBLISHED') return mode === 'AUTO' ? 'post_published_auto' : 'post_published_manual'
  if (to === 'FAILED') return 'post_failed'
  if (to === 'DRAFT') return from === 'APPROVED' ? 'post_rejected' : 'post_reset'
  return null
}
