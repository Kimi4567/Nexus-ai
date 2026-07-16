import { readPerformanceLearningEvidence } from '@/lib/learningEvidence'
import { readPerformanceEvidence } from '@/lib/performanceEvidence'

export interface PilotProofOverview {
  status: 'not_started' | 'provider_published' | 'analytics_ready' | 'learning_applied'
  providerPublishedPosts: number
  eligibleAnalyticsPosts: number
  appliedLearningProposals: number
  completedCampaigns: number
  completedCampaignIds: string[]
}

interface PilotPost {
  id: string
  campaignId?: string | null
  status?: string | null
  platformPostId?: string | null
  publishedAt?: Date | string | null
  manuallyPublishedAt?: Date | string | null
  analyticsData?: unknown
}

interface PilotLearning {
  status?: string | null
  trigger?: string | null
  evidence?: unknown
}

/**
 * A pilot is proven only when all three events belong to the same campaign:
 * provider-confirmed publish, eligible provider analytics, and an accepted
 * evidence-backed learning proposal. Workspace-wide unrelated counts can never
 * combine into a false "complete" state.
 */
export function buildPilotProofOverview(posts: PilotPost[], learnings: PilotLearning[]): PilotProofOverview {
  const providerPosts = posts.filter(post => (
    String(post.status).toUpperCase() === 'PUBLISHED'
    && typeof post.campaignId === 'string'
    && Boolean(post.platformPostId)
    && Boolean(post.publishedAt)
    && !post.manuallyPublishedAt
  ))
  const eligiblePosts = providerPosts.filter(post => {
    const evidence = readPerformanceEvidence(post.analyticsData)
    return Boolean(
      evidence
      && evidence.quality === 'eligible'
      && evidence.platformPostId === post.platformPostId,
    )
  })
  const eligiblePostIds = new Set(eligiblePosts.map(post => post.id))
  const providerCampaignIds = new Set(providerPosts.flatMap(post => post.campaignId ? [post.campaignId] : []))
  const eligibleCampaignIds = new Set(eligiblePosts.flatMap(post => post.campaignId ? [post.campaignId] : []))
  const appliedCampaignIds = new Set<string>()
  let appliedLearningProposals = 0

  for (const learning of learnings) {
    if (learning.status !== 'accepted' || learning.trigger !== 'post_performance') continue
    const evidence = readPerformanceLearningEvidence(learning.evidence)
    if (!evidence || !evidence.sample.evidencePostIds.some(id => eligiblePostIds.has(id))) continue
    appliedLearningProposals++
    for (const campaignId of evidence.sample.campaignIds) {
      if (eligibleCampaignIds.has(campaignId)) appliedCampaignIds.add(campaignId)
    }
  }

  const completedCampaignIds = [...appliedCampaignIds].filter(campaignId => (
    providerCampaignIds.has(campaignId) && eligibleCampaignIds.has(campaignId)
  ))

  return {
    status: completedCampaignIds.length > 0
      ? 'learning_applied'
      : eligiblePosts.length > 0
        ? 'analytics_ready'
        : providerPosts.length > 0
          ? 'provider_published'
          : 'not_started',
    providerPublishedPosts: providerPosts.length,
    eligibleAnalyticsPosts: eligiblePosts.length,
    appliedLearningProposals,
    completedCampaigns: completedCampaignIds.length,
    completedCampaignIds,
  }
}
