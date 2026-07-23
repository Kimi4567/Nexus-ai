import type { PublicPaidPlan } from '@/lib/commercialPlans'
import { CREDIT_ACTION_COSTS } from '@/lib/creditActionTruth'
import {
  getStrategyToDraftsJourneyCost,
  STRATEGY_PRICING_DISPLAY_TRUTH,
} from '@/lib/strategy/strategyPricingDisplayTruth'

export const FULL_STANDARD_90_DRAFTS = 16

export const FULL_STANDARD_90_TO_DRAFTS_COST = getStrategyToDraftsJourneyCost(
  STRATEGY_PRICING_DISPLAY_TRUTH.fullStandard90.cost,
  CREDIT_ACTION_COSTS.SENTINEL_REVIEW,
  CREDIT_ACTION_COSTS.CONTENT_PLAN_GENERATION,
)

export type CommercialCapacityConstraint = 'credits' | 'campaigns' | 'planned_posts'

export interface CommercialWorkflowCapacity {
  workflows: number
  creditsPerWorkflow: number
  plannedPostsPerWorkflow: number
  capacityByCredits: number
  capacityByCampaigns: number
  capacityByPlannedPosts: number
  limitingConstraints: CommercialCapacityConstraint[]
}

/**
 * Quotes a monthly workflow only when every enforced allowance can support it.
 * Public examples must use this result instead of dividing credits alone.
 */
export function quoteCommercialWorkflowCapacity(
  plan: Pick<PublicPaidPlan, 'monthlyCredits' | 'campaignLimit' | 'postsPerMonth'>,
  workflow: { credits: number; plannedPosts: number; campaigns?: number },
): CommercialWorkflowCapacity {
  const creditsPerWorkflow = Math.max(1, Math.trunc(workflow.credits))
  const plannedPostsPerWorkflow = Math.max(0, Math.trunc(workflow.plannedPosts))
  const campaignsPerWorkflow = Math.max(1, Math.trunc(workflow.campaigns ?? 1))
  const capacityByCredits = Math.floor(plan.monthlyCredits / creditsPerWorkflow)
  const capacityByCampaigns = Math.floor(plan.campaignLimit / campaignsPerWorkflow)
  const capacityByPlannedPosts = plannedPostsPerWorkflow === 0
    ? Number.POSITIVE_INFINITY
    : Math.floor(plan.postsPerMonth / plannedPostsPerWorkflow)
  const workflows = Math.max(0, Math.min(
    capacityByCredits,
    capacityByCampaigns,
    capacityByPlannedPosts,
  ))
  const limitingConstraints: CommercialCapacityConstraint[] = []
  if (capacityByCredits === workflows) limitingConstraints.push('credits')
  if (capacityByCampaigns === workflows) limitingConstraints.push('campaigns')
  if (capacityByPlannedPosts === workflows) limitingConstraints.push('planned_posts')

  return {
    workflows,
    creditsPerWorkflow,
    plannedPostsPerWorkflow,
    capacityByCredits,
    capacityByCampaigns,
    capacityByPlannedPosts,
    limitingConstraints,
  }
}

export function quoteFullStandard90DraftCapacity(
  plan: Pick<PublicPaidPlan, 'monthlyCredits' | 'campaignLimit' | 'postsPerMonth'>,
): CommercialWorkflowCapacity {
  return quoteCommercialWorkflowCapacity(plan, {
    credits: FULL_STANDARD_90_TO_DRAFTS_COST,
    plannedPosts: FULL_STANDARD_90_DRAFTS,
  })
}
