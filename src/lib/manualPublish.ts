/**
 * Manual publishing planner (Publishing & Campaign Calendar Sprint — PR 4).
 *
 * For SMEs that don't connect a publishing API, "publishing" is a human action: the
 * user posts the content by hand and then tells NEXUS it's live. NEXUS must NEVER
 * claim it published anything automatically — this records the user's own honest
 * confirmation that THEY published a SCHEDULED post manually.
 *
 * Rules (pure, fully unit-testable — no DB, no network):
 *   - Only a SCHEDULED post may be marked manually published (SCHEDULED → PUBLISHED).
 *     DRAFT and APPROVED cannot (they must be scheduled first).
 *   - Only MANUAL posts — AUTO posts are published by the cron, not by hand.
 *   - Sets manuallyPublishedAt = publishedAt = now; keeps publishMode = MANUAL.
 *   - Saves the live post URL to the existing `platformUrl` field when provided.
 *   - Records a PostStatusHistory SCHEDULED → PUBLISHED row, actor USER, with a note
 *     that makes the manual (user-confirmed) nature explicit.
 */

import {
  validateTransition,
  buildStatusHistory,
  type StatusHistoryRow,
} from './postStatus'

export interface ManualPublishPost {
  id: string
  workspaceId: string
  status: string                 // must be SCHEDULED
  publishMode?: string | null    // must not be AUTO
}

export interface ManualPublishUpdate {
  id: string
  data: {
    status: 'PUBLISHED'
    manuallyPublishedAt: Date
    publishedAt: Date
    /** live post URL, saved to the existing SocialPost.platformUrl field */
    platformUrl?: string
  }
}

export type ManualPublishPlan =
  | { ok: false; error: string }
  | { ok: true; update: ManualPublishUpdate; history: StatusHistoryRow }

export interface ManualPublishOptions {
  now?: Date
  /** optional live post URL the user pastes; saved to platformUrl */
  liveUrl?: string | null
}

/** Light URL sanity — accept http(s) links; otherwise treat as no URL (still allowed). */
function cleanUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  return /^https?:\/\/\S+$/i.test(t) ? t : null
}

/**
 * Decide how to mark a SCHEDULED + MANUAL post as published-by-hand. Returns an
 * error (never throws) when the post is in a state that must not be manually
 * published, so the API can reject with a clear message.
 */
export function planManualPublish(post: ManualPublishPost, opts: ManualPublishOptions = {}): ManualPublishPlan {
  const now = opts.now ?? new Date()

  // AUTO posts are auto-published by the cron — never hand-marked here.
  if (post.publishMode === 'AUTO') {
    return { ok: false, error: 'AUTO posts are published automatically; they cannot be marked as manually published.' }
  }

  // Must be a legal lifecycle transition (postStatus is the source of truth)...
  const transition = validateTransition(post.status as any, 'PUBLISHED')
  if (!transition.ok) {
    return { ok: false, error: transition.error }
  }
  // ...AND specifically SCHEDULED. DRAFT/APPROVED cannot be manually published —
  // they must go through approval → scheduling first.
  if (post.status !== 'SCHEDULED') {
    return { ok: false, error: `Manual publishing requires a scheduled post (status was ${post.status}).` }
  }

  const url = cleanUrl(opts.liveUrl)
  const note = url
    ? `User confirmed they published this manually · ${url}`
    : 'User confirmed they published this manually (no live URL provided)'

  return {
    ok: true,
    update: {
      id: post.id,
      data: {
        status: 'PUBLISHED',
        manuallyPublishedAt: now,
        publishedAt: now,
        ...(url ? { platformUrl: url } : {}),
      },
    },
    history: buildStatusHistory({
      socialPostId: post.id,
      workspaceId: post.workspaceId,
      fromStatus: 'SCHEDULED',
      toStatus: 'PUBLISHED',
      actor: 'USER',
      note,
    }),
  }
}
