import type { BusinessBrief, StrategyOutput } from '@/lib/agents/strategist'
import type { StrategyQualityFailureDiagnostics } from '@/lib/strategy/strategyQualityPipeline'
import { getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'

export type StrategyDeliveryStatus = 'complete' | 'partial'

export interface StrategyDeliveryOutcome {
  status: StrategyDeliveryStatus
  requestedStrategyType: 'organic' | 'paid' | 'full'
  deliveredStrategyType: 'organic' | 'paid' | 'full'
  failedSection?: 'paid_planning'
  failure?: StrategyQualityFailureDiagnostics
}

function isPaidPlanningPath(path: string): boolean {
  return /(?:^|\.)paidPlanning(?:\.|$)/i.test(path)
}

/**
 * A Full request may preserve its organic work only when every deterministic
 * failure is isolated to paidPlanning. Mixed or unknown failures remain a
 * complete non-delivery, so a broken organic document is never persisted.
 */
export function canPreserveOrganicFromFull(
  brief: BusinessBrief,
  diagnostics: StrategyQualityFailureDiagnostics,
): boolean {
  return brief.strategyType === 'full'
    && diagnostics.affectedPaths.length > 0
    && diagnostics.affectedPaths.every(isPaidPlanningPath)
    && diagnostics.outputCounts.contentDirections > 0
    && diagnostics.outputCounts.weeklyDeliverables > 0
}

/** Build the authoritative, organic-only contract persisted after a paid-only failure. */
export function buildOrganicPartialBrief(brief: BusinessBrief): BusinessBrief {
  const order = brief.strategyOrder
    ? { ...brief.strategyOrder, strategyType: 'organic' as const }
    : undefined
  const previousDeliverables = brief.strategyDeliverables
  const deliverables = order
    ? getStrategyDeliverables(order, {
        postsPerMonth: previousDeliverables?.planCappedOrganicPostCount ?? undefined,
        platformCount: previousDeliverables?.platformVariantCount,
      })
    : undefined

  return {
    ...brief,
    strategyType: 'organic',
    strategyOrder: order,
    strategyDeliverables: deliverables,
    generationInstructions: deliverables?.generationInstructions ?? brief.generationInstructions,
    organicPostCount: deliverables?.organicPostCount ?? brief.organicPostCount,
    detailedCalendarDays: deliverables?.detailedCalendarDays ?? brief.detailedCalendarDays,
    roadmapMonths: deliverables?.roadmapMonths ?? brief.roadmapMonths,
    planCapApplied: deliverables?.planCapApplied ?? brief.planCapApplied,
  }
}

export function organicPartialStrategy(strategy: StrategyOutput): StrategyOutput {
  return { ...strategy, paidPlanning: null }
}
