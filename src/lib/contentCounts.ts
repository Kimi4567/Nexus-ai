/**
 * PR-1J — one honest content/publishing count model.
 *
 * Pure, display-only helper. Derives lifecycle counts from a list of posts
 * without ever inferring a more advanced state than the data proves. Mirrors the
 * SocialPost lifecycle defined in postStatus.ts:
 *
 *   DRAFT → APPROVED → SCHEDULED → PUBLISHED | FAILED
 *
 * Honesty rules (so Calendar, Publishing Queue, Campaign and Content Hub can
 * never contradict each other):
 *  - APPROVED and DRAFT are NEVER counted as "scheduled" or "published".
 *  - `scheduled`  = status SCHEDULED only (a real publish time was set).
 *  - `published`  = status PUBLISHED only (never a scheduled post).
 *  - unknown/legacy status falls back to `draft` — never a false published/scheduled.
 *  - `platforms`  = distinct, case-normalized platform list across the posts.
 *
 * This module imports nothing and touches no database, so it is fully unit-testable.
 */

export type CountablePost = {
  status?: string | null
  scheduledAt?: string | Date | null
  publishedAt?: string | Date | null
  platform?: string | null
}

export interface PublishingStateSummary {
  /** generated, not yet approved */
  draft: number
  /** approved but NOT scheduled or published */
  approved: number
  /** status SCHEDULED — a publish time exists, but not yet live */
  scheduled: number
  /** status PUBLISHED — confirmed live */
  published: number
  /** publish attempt failed */
  failed: number
  /** generated/approved content that is not scheduled or published yet (draft + approved) */
  notScheduled: number
  /** distinct, normalized platform names across the posts */
  platforms: string[]
  total: number
}

const norm = (s: unknown): string => String(s ?? '').trim().toUpperCase()

/**
 * Summarize a list of posts into honest lifecycle counts. Never claims a post is
 * scheduled or published unless its status proves it.
 */
export function getPublishingStateSummary(
  posts: CountablePost[] | null | undefined,
): PublishingStateSummary {
  const list = Array.isArray(posts) ? posts : []

  let draft = 0
  let approved = 0
  let scheduled = 0
  let published = 0
  let failed = 0
  const platforms = new Set<string>()

  for (const p of list) {
    switch (norm(p.status)) {
      case 'PUBLISHED':
        published++
        break
      case 'SCHEDULED':
        scheduled++
        break
      case 'FAILED':
        failed++
        break
      case 'APPROVED':
        approved++
        break
      default:
        // DRAFT or any unknown/legacy value — never counted as scheduled/published.
        draft++
    }
    if (p.platform) platforms.add(norm(p.platform))
  }

  return {
    draft,
    approved,
    scheduled,
    published,
    failed,
    notScheduled: draft + approved,
    platforms: Array.from(platforms),
    total: list.length,
  }
}
