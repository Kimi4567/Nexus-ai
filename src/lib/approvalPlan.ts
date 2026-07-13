/**
 * Approval / scheduling planner (Publishing & Campaign Calendar Sprint — PR 2).
 *
 * Pure, dependency-free helpers that decide HOW a batch of content-plan posts
 * should move through the honest lifecycle:
 *
 *   DRAFT  ──approve──▶  APPROVED  ──schedule──▶  SCHEDULED
 *     ▲                     │                         │
 *     └──────── revert ─────┴──────── revert ─────────┘
 *
 * Approval and scheduling are SEPARATE decisions (the agency "client approval
 * before scheduling" step). Approval never schedules and never sets scheduledAt;
 * scheduling never re-approves. There is deliberately no compound transition.
 *
 * This module touches NO database and imports only from postStatus, so the whole
 * decision surface (which transitions happen, which timestamps are written, what
 * the audit trail looks like) is fully unit-testable. The API routes call these
 * planners and then apply `updates` + persist `history` via Prisma.
 *
 * Brand Brain readiness: each produced StatusHistoryRow (actor + from/to + note)
 * is exactly what a later PR will read to learn what the user approved / rejected
 * / scheduled. PR 2 only RECORDS these events; it triggers no learning.
 */

import {
  validateTransition,
  buildStatusHistory,
  type PostStatus,
  type StatusActor,
  type StatusHistoryRow,
} from './postStatus'

export type ApprovalMode = 'approve'

/** Minimal shape the planners need from a SocialPost row. */
export interface PlanPostInput {
  id: string
  workspaceId: string
  status: PostStatus | string // tolerate legacy/unknown values
  scheduledAt?: Date | string | null
}

/**
 * A status mutation to apply to one post. Note there is intentionally NO
 * `scheduledAt` field here — approval and scheduling must never write the planned
 * date (content-plan posts already carry their planned date from generation).
 */
export interface PostStatusUpdate {
  id: string
  data: {
    status: PostStatus
    /** Set on approval; cleared (null) on revert; omitted otherwise. */
    approvedAt?: Date | null
  }
}

export interface LifecyclePlan {
  updates: PostStatusUpdate[]
  history: StatusHistoryRow[]
  /** posts that were legitimately transitioned */
  changed: number
  /** posts skipped because the transition was not legal from their current state */
  skipped: number
}

export interface ApprovalPlan extends LifecyclePlan {
  mode: ApprovalMode
}

interface PlanOpts {
  now?: Date
  actor?: StatusActor
}

export function hasValidPlannedDate(value: Date | string | null | undefined): boolean {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

/**
 * Plan approval of DRAFT posts.
 *
 *  - DRAFT → APPROVED only. Sets approvedAt. Never sets
 *    scheduledAt. Records DRAFT → APPROVED.
 *
 * Posts that are not DRAFT are skipped (prevents double-approval).
 */
export function planApproval(posts: PlanPostInput[], opts: PlanOpts = {}): ApprovalPlan {
  const mode: ApprovalMode = 'approve'
  const now = opts.now ?? new Date()
  const actor: StatusActor = opts.actor ?? 'USER'

  const updates: PostStatusUpdate[] = []
  const history: StatusHistoryRow[] = []
  let changed = 0
  let skipped = 0

  for (const p of posts) {
    // Only DRAFT posts can be approved — anything else (already APPROVED,
    // SCHEDULED, PUBLISHED…) is skipped so re-running approve is a no-op.
    if (p.status !== 'DRAFT' || !validateTransition('DRAFT', 'APPROVED').ok) {
      skipped++
      continue
    }

    updates.push({ id: p.id, data: { status: 'APPROVED', approvedAt: now } })
    history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: p.workspaceId, fromStatus: 'DRAFT', toStatus: 'APPROVED', actor }))
    changed++
  }

  return { mode, updates, history, changed, skipped }
}

/**
 * Plan scheduling of APPROVED posts with existing valid planned dates:
 * APPROVED → SCHEDULED only.
 *
 * Does NOT set approvedAt (already set) and does NOT write scheduledAt (the planned
 * date is kept from generation). Posts that are not APPROVED, or APPROVED posts
 * without a valid scheduledAt, are skipped — a DRAFT post can never be scheduled
 * directly through this path, and scheduling never invents a planned date.
 */
export function planScheduling(posts: PlanPostInput[], opts: PlanOpts = {}): LifecyclePlan {
  const actor: StatusActor = opts.actor ?? 'USER'

  const updates: PostStatusUpdate[] = []
  const history: StatusHistoryRow[] = []
  let changed = 0
  let skipped = 0

  for (const p of posts) {
    if (p.status !== 'APPROVED' || !hasValidPlannedDate(p.scheduledAt) || !validateTransition('APPROVED', 'SCHEDULED').ok) {
      skipped++
      continue
    }
    updates.push({ id: p.id, data: { status: 'SCHEDULED' } })
    history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: p.workspaceId, fromStatus: 'APPROVED', toStatus: 'SCHEDULED', actor }))
    changed++
  }

  return { updates, history, changed, skipped }
}

/**
 * Plan reverting posts back to DRAFT (un-approve / un-schedule), clearing
 * approvedAt. APPROVED → DRAFT is a single legal step; SCHEDULED → DRAFT is
 * modelled honestly as the compound SCHEDULED → APPROVED → DRAFT (both legal),
 * so the audit trail reflects the real unschedule-then-unapprove path. PUBLISHED
 * posts are never reverted here.
 */
export function planRevert(posts: PlanPostInput[], opts: PlanOpts = {}): LifecyclePlan {
  const actor: StatusActor = opts.actor ?? 'USER'

  const updates: PostStatusUpdate[] = []
  const history: StatusHistoryRow[] = []
  let changed = 0
  let skipped = 0

  for (const p of posts) {
    const from = p.status
    if (from === 'APPROVED' && validateTransition('APPROVED', 'DRAFT').ok) {
      updates.push({ id: p.id, data: { status: 'DRAFT', approvedAt: null } })
      history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: p.workspaceId, fromStatus: 'APPROVED', toStatus: 'DRAFT', actor }))
      changed++
    } else if (
      from === 'SCHEDULED' &&
      validateTransition('SCHEDULED', 'APPROVED').ok &&
      validateTransition('APPROVED', 'DRAFT').ok
    ) {
      updates.push({ id: p.id, data: { status: 'DRAFT', approvedAt: null } })
      history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: p.workspaceId, fromStatus: 'SCHEDULED', toStatus: 'APPROVED', actor, note: 'unschedule' }))
      history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: p.workspaceId, fromStatus: 'APPROVED', toStatus: 'DRAFT', actor, note: 'unapprove' }))
      changed++
    } else {
      skipped++
    }
  }

  return { updates, history, changed, skipped }
}
