/**
 * Brand Brain — execution-event read model (Brand Brain Sprint PR2).
 *
 * Pure, dependency-free helpers that summarise a batch of `MarketingLearningEvent`
 * rows (captured by PR1) into simple, HONEST behavioural signals the future Brand
 * Brain can consume. This layer ONLY counts and surfaces what already happened in the
 * execution workflow. It does NOT:
 *   - generate recommendations or AI insights,
 *   - infer or fetch marketing performance (clicks / leads / impressions),
 *   - expose full/sensitive post URLs (only the bare domain already stored),
 *   - invent any metric.
 *
 * Any "rate" here is a WORKFLOW rate (how the user moves posts through the pipeline),
 * never a marketing success/performance metric.
 */

/** Minimal shape of a stored MarketingLearningEvent row (read-only). */
export interface LearningEventRecord {
  eventType: string
  campaignId?: string | null
  socialPostId?: string | null
  actor?: string | null
  source?: string | null
  createdAt?: Date | string | null
  metadata?: Record<string, unknown> | null
}

/** A recent event, reduced to a small, safe field set (never the full URL). */
export interface RecentLearningEvent {
  eventType: string
  campaignId: string | null
  socialPostId: string | null
  createdAt: string | null
  fromStatus: string | null
  toStatus: string | null
  publishMode: string | null
  platform: string | null
  hasPlatformUrl: boolean
  platformUrlDomain: string | null
}

export interface LearningEventSummary {
  totalEvents: number
  approvedPostsCount: number
  scheduledPostsCount: number
  manuallyPublishedPostsCount: number
  autoPublishedPostsCount: number
  unscheduledCount: number
  revertedToDraftCount: number
  failedCount: number
  lastEventAt: string | null
  lastManualPublishAt: string | null
  /** Distinct platforms / domains the user has acted on (from safe metadata only). */
  platformsUsed: string[]
  /**
   * WORKFLOW rate only = manuallyPublished / scheduled (0–1), or null when there are
   * no scheduled events. This describes how often scheduled posts get hand-published —
   * it is NOT a success rate and NOT a marketing performance metric.
   */
  manualPublishWorkflowRate: number | null
  /** Count of every eventType seen, including unknown/legacy types. */
  eventTypesCount: Record<string, number>
  recentEvents: RecentLearningEvent[]
}

const EMPTY_SUMMARY: LearningEventSummary = {
  totalEvents: 0,
  approvedPostsCount: 0,
  scheduledPostsCount: 0,
  manuallyPublishedPostsCount: 0,
  autoPublishedPostsCount: 0,
  unscheduledCount: 0,
  revertedToDraftCount: 0,
  failedCount: 0,
  lastEventAt: null,
  lastManualPublishAt: null,
  platformsUsed: [],
  manualPublishWorkflowRate: null,
  eventTypesCount: {},
  recentEvents: [],
}

function toIso(v: unknown): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** Later of two ISO timestamps (either may be null). */
function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

export interface SummaryOptions {
  /** Only summarise events for this campaign (when provided). */
  campaignId?: string
  /** Max recent events to surface (default 10). */
  recentLimit?: number
}

/**
 * Summarise learning events into honest workflow signals. Pure: pass in the rows you
 * fetched (see `learningEventsQuery`). Unknown event types are still counted in
 * `totalEvents` and `eventTypesCount` but never crash the summary.
 */
export function summarizeLearningEvents(
  events: LearningEventRecord[],
  options: SummaryOptions = {},
): LearningEventSummary {
  const recentLimit = Math.max(0, options.recentLimit ?? 10)
  const scoped = options.campaignId
    ? events.filter(e => (e.campaignId ?? null) === options.campaignId)
    : events

  if (scoped.length === 0) return { ...EMPTY_SUMMARY, eventTypesCount: {}, platformsUsed: [], recentEvents: [] }

  const summary: LearningEventSummary = {
    ...EMPTY_SUMMARY,
    eventTypesCount: {},
    platformsUsed: [],
    recentEvents: [],
  }
  const platforms = new Set<string>()

  for (const e of scoped) {
    summary.totalEvents++
    summary.eventTypesCount[e.eventType] = (summary.eventTypesCount[e.eventType] ?? 0) + 1

    const createdAt = toIso(e.createdAt)
    summary.lastEventAt = maxIso(summary.lastEventAt, createdAt)

    switch (e.eventType) {
      case 'POST_APPROVED':           summary.approvedPostsCount++; break
      case 'POST_SCHEDULED':          summary.scheduledPostsCount++; break
      case 'POST_MANUALLY_PUBLISHED':
        summary.manuallyPublishedPostsCount++
        summary.lastManualPublishAt = maxIso(summary.lastManualPublishAt, createdAt)
        break
      case 'POST_AUTO_PUBLISHED':      summary.autoPublishedPostsCount++; break
      case 'POST_UNSCHEDULED':         summary.unscheduledCount++; break
      case 'POST_REVERTED_TO_DRAFT':   summary.revertedToDraftCount++; break
      case 'POST_FAILED':              summary.failedCount++; break
      // unknown / legacy types: counted in totals only, never inferred
    }

    // Safe platform aggregation — name + bare domain only, never a full URL.
    const md = e.metadata ?? {}
    const platform = asString((md as any).platform)
    const domain = asString((md as any).platformUrlDomain)
    if (platform) platforms.add(platform)
    if (domain) platforms.add(domain)
  }

  summary.platformsUsed = Array.from(platforms).sort()

  // WORKFLOW rate only — never a success/performance metric.
  summary.manualPublishWorkflowRate = summary.scheduledPostsCount > 0
    ? round2(summary.manuallyPublishedPostsCount / summary.scheduledPostsCount)
    : null

  summary.recentEvents = [...scoped]
    .sort((a, b) => (toIso(b.createdAt) ?? '').localeCompare(toIso(a.createdAt) ?? ''))
    .slice(0, recentLimit)
    .map(toRecentEvent)

  return summary
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Reduce a stored event to the small, safe field set — NEVER includes a full URL. */
function toRecentEvent(e: LearningEventRecord): RecentLearningEvent {
  const md = e.metadata ?? {}
  return {
    eventType: e.eventType,
    campaignId: e.campaignId ?? null,
    socialPostId: e.socialPostId ?? null,
    createdAt: toIso(e.createdAt),
    fromStatus: asString((md as any).fromStatus),
    toStatus: asString((md as any).toStatus),
    publishMode: asString((md as any).publishMode),
    platform: asString((md as any).platform),
    hasPlatformUrl: (md as any).hasPlatformUrl === true,
    platformUrlDomain: asString((md as any).platformUrlDomain),
  }
}

/**
 * Build a plain Prisma `where`/`orderBy` for fetching a workspace's learning events
 * (optionally scoped to a campaign). Dependency-free so a future consumer can do
 * `prisma.marketingLearningEvent.findMany(learningEventsQuery(wsId, campId))` then pass
 * the rows to `summarizeLearningEvents`. No DB access happens here.
 */
export function learningEventsQuery(workspaceId: string, campaignId?: string, take = 500) {
  return {
    where: { workspaceId, ...(campaignId ? { campaignId } : {}) },
    orderBy: { createdAt: 'desc' as const },
    take,
  }
}
