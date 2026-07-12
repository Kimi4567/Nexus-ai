export const PERFORMANCE_EVIDENCE_VERSION = 1
export const MIN_EVIDENCE_DENOMINATOR = 100
export const MIN_PLATFORM_COMPARISON_POSTS = 5
export const MIN_WINNING_POSTS = 3

export type EvidencePlatform = 'META' | 'LINKEDIN'
export type EvidenceQuality = 'eligible' | 'insufficient_sample'

export interface RawPlatformMetrics {
  likes: number
  comments: number
  shares: number
  impressions: number
  reach: number
  clicks?: number
  engagedUsers?: number
}

export interface PerformanceEvidence extends RawPlatformMetrics {
  schemaVersion: 1
  source: 'platform_api'
  platform: EvidencePlatform
  platformPostId: string
  collectedAt: string
  denominator: number
  engagementCount: number
  engagementRate: number
  metricDefinition: 'engaged_users_over_reach_or_impressions' | 'clicks_reactions_comments_shares_over_impressions'
  quality: EvidenceQuality
}

export interface EvidencePost {
  id: string
  caption: string
  platform: string
  analyticsData: unknown
}

export interface PerformanceLearningPlan {
  platform: EvidencePlatform
  candidateHooks: string[]
  reason: string
  evidencePostIds: string[]
  eligiblePostCount: number
  baselineEngagementRate: number
  thresholdEngagementRate: number
}

export interface PerformanceEvidenceAggregate {
  eligiblePosts: number
  insufficientSamplePosts: number
  unverifiedPosts: number
  impressions: number
  reach: number
  engagementCount: number
  clicks: number
  denominator: number
  engagementRate: number
  byPlatform: Partial<Record<EvidencePlatform, {
    posts: number
    impressions: number
    reach: number
    engagementCount: number
    clicks: number
    denominator: number
    engagementRate: number
  }>>
}

function count(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

export function extractOpeningHook(caption: string): string {
  return (caption.split(/[.!?؟\n]/)[0] ?? '').trim().slice(0, 120)
}

export function buildPerformanceEvidence(input: {
  platform: EvidencePlatform
  platformPostId: string
  collectedAt: Date
  metrics: RawPlatformMetrics
}): PerformanceEvidence {
  const likes = count(input.metrics.likes)
  const comments = count(input.metrics.comments)
  const shares = count(input.metrics.shares)
  const impressions = count(input.metrics.impressions)
  const reach = count(input.metrics.reach)
  const clicks = count(input.metrics.clicks)
  const engagedUsers = count(input.metrics.engagedUsers)
  const denominator = input.platform === 'LINKEDIN'
    ? impressions
    : (reach > 0 ? reach : impressions)
  const engagementCount = input.platform === 'META' && engagedUsers > 0
    ? engagedUsers
    : likes + comments + shares + clicks
  const engagementRate = denominator > 0 ? round((engagementCount / denominator) * 100) : 0

  return {
    schemaVersion: PERFORMANCE_EVIDENCE_VERSION,
    source: 'platform_api',
    platform: input.platform,
    platformPostId: input.platformPostId,
    collectedAt: input.collectedAt.toISOString(),
    likes,
    comments,
    shares,
    impressions,
    reach,
    clicks,
    denominator,
    engagementCount,
    engagementRate,
    metricDefinition: input.platform === 'META'
      ? 'engaged_users_over_reach_or_impressions'
      : 'clicks_reactions_comments_shares_over_impressions',
    quality: denominator >= MIN_EVIDENCE_DENOMINATOR ? 'eligible' : 'insufficient_sample',
  }
}

export function readPerformanceEvidence(value: unknown): PerformanceEvidence | null {
  const data = record(value)
  if (
    data?.schemaVersion !== PERFORMANCE_EVIDENCE_VERSION
    || data.source !== 'platform_api'
    || !['META', 'LINKEDIN'].includes(String(data.platform))
    || typeof data.platformPostId !== 'string'
    || typeof data.collectedAt !== 'string'
  ) return null

  const platform = data.platform as EvidencePlatform
  const collectedAt = new Date(data.collectedAt)
  if (!Number.isFinite(collectedAt.getTime())) return null
  const evidence = buildPerformanceEvidence({
    platform,
    platformPostId: data.platformPostId,
    collectedAt,
    metrics: {
      likes: count(data.likes),
      comments: count(data.comments),
      shares: count(data.shares),
      impressions: count(data.impressions),
      reach: count(data.reach),
      clicks: count(data.clicks),
      engagedUsers: count(data.engagementCount),
    },
  })
  return evidence
}

/**
 * Aggregates only evidence that satisfies the minimum denominator. Legacy JSON
 * and small samples remain visible as status counts, but can never enter KPI
 * totals or an AI prompt.
 */
export function summarizePerformanceEvidence(
  posts: Array<{ platform: string; analyticsData: unknown }>,
): PerformanceEvidenceAggregate {
  const aggregate: PerformanceEvidenceAggregate = {
    eligiblePosts: 0,
    insufficientSamplePosts: 0,
    unverifiedPosts: 0,
    impressions: 0,
    reach: 0,
    engagementCount: 0,
    clicks: 0,
    denominator: 0,
    engagementRate: 0,
    byPlatform: {},
  }

  for (const post of posts) {
    const evidence = readPerformanceEvidence(post.analyticsData)
    if (!evidence || evidence.platform !== post.platform) {
      if (post.analyticsData != null) aggregate.unverifiedPosts++
      continue
    }
    if (evidence.quality !== 'eligible') {
      aggregate.insufficientSamplePosts++
      continue
    }

    aggregate.eligiblePosts++
    aggregate.impressions += evidence.impressions
    aggregate.reach += evidence.reach
    aggregate.engagementCount += evidence.engagementCount
    aggregate.clicks += evidence.clicks ?? 0
    aggregate.denominator += evidence.denominator

    const platform = aggregate.byPlatform[evidence.platform] ?? {
      posts: 0,
      impressions: 0,
      reach: 0,
      engagementCount: 0,
      clicks: 0,
      denominator: 0,
      engagementRate: 0,
    }
    platform.posts++
    platform.impressions += evidence.impressions
    platform.reach += evidence.reach
    platform.engagementCount += evidence.engagementCount
    platform.clicks += evidence.clicks ?? 0
    platform.denominator += evidence.denominator
    aggregate.byPlatform[evidence.platform] = platform
  }

  aggregate.engagementRate = aggregate.denominator > 0
    ? round((aggregate.engagementCount / aggregate.denominator) * 100)
    : 0
  for (const platform of Object.values(aggregate.byPlatform)) {
    if (!platform) continue
    platform.engagementRate = platform.denominator > 0
      ? round((platform.engagementCount / platform.denominator) * 100)
      : 0
  }
  return aggregate
}

/**
 * Builds conservative, platform-local hook proposals. Cross-platform rates are
 * never compared because APIs use different definitions and attribution.
 */
export function planPerformanceLearning(posts: EvidencePost[]): PerformanceLearningPlan[] {
  const grouped = new Map<EvidencePlatform, Array<{ post: EvidencePost; evidence: PerformanceEvidence }>>()
  for (const post of posts) {
    const evidence = readPerformanceEvidence(post.analyticsData)
    if (!evidence || evidence.quality !== 'eligible' || evidence.platform !== post.platform) continue
    const list = grouped.get(evidence.platform) ?? []
    list.push({ post, evidence })
    grouped.set(evidence.platform, list)
  }

  const plans: PerformanceLearningPlan[] = []
  for (const [platform, items] of grouped) {
    if (items.length < MIN_PLATFORM_COMPARISON_POSTS) continue
    const baseline = median(items.map((item) => item.evidence.engagementRate))
    const threshold = Math.max(0.1, baseline * 1.2)
    const winners = items.filter((item) => item.evidence.engagementRate >= threshold)
    if (winners.length < MIN_WINNING_POSTS) continue

    const seen = new Set<string>()
    const candidateHooks = winners
      .map((item) => extractOpeningHook(item.post.caption))
      .filter((hook) => hook.length >= 15)
      .filter((hook) => {
        const key = hook.toLocaleLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 5)
    if (candidateHooks.length === 0) continue

    plans.push({
      platform,
      candidateHooks,
      evidencePostIds: winners.map((item) => item.post.id),
      eligiblePostCount: items.length,
      baselineEngagementRate: round(baseline),
      thresholdEngagementRate: round(threshold),
      reason: `${winners.length} ${platform} posts exceeded the platform-local median engagement baseline by at least 20% across ${items.length} eligible posts. These are hook candidates for review, not causal proof of conversions or revenue.`,
    })
  }
  return plans
}
