/**
 * Shared read model for the Strategy Operating Desk.
 *
 * This is intentionally a UI/coordination contract, not a second source of
 * truth. Values are snapshots of Brand Brain, strategy output, operating
 * state, Content Hub, and publish readiness at the time the desk is rendered.
 */
export const STRATEGY_SNAPSHOT_SCHEMA_VERSION = 1

export type StrategySnapshotStatus = 'draft' | 'review' | 'approved' | 'superseded' | 'blocked'

export interface StrategySnapshot {
  version: number
  scope: 'organic' | 'paid' | 'full' | string
  goal: string | null
  planningHorizonDays: number | null
  plannedOrganicPostCount: number | null
  audiences: unknown[]
  positioning: unknown
  funnel: unknown[]
  channels: unknown[]
  contentSystem: unknown
  measurementPlan: unknown
  evidenceRefs: unknown[]
  assumptions: string[]
  missingInputs: string[]
  riskFlags: string[]
  executionLinks: {
    brand: string
    content: string
    creative: string
    approvals: string
    connections: string
    publish: string
    paid: string
    performance: string
    analytics: string
  }
  approvalState: StrategySnapshotStatus
  supersedesVersion: number | null
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}

export function buildStrategySnapshot(input: {
  campaignId: string
  scope?: string | null
  goal?: unknown
  planningHorizonDays?: unknown
  plannedOrganicPostCount?: unknown
  strategy?: Record<string, unknown> | null
  evidenceRefs?: unknown[]
  assumptions?: string[]
  missingInputs?: string[]
  riskFlags?: string[]
  approvalState?: StrategySnapshotStatus
  version?: number | null
  supersedesVersion?: number | null
}): StrategySnapshot {
  const strategy = input.strategy || {}
  const positiveInteger = (value: unknown): number | null => {
    const number = Math.floor(Number(value))
    return Number.isFinite(number) && number >= 0 ? number : null
  }
  return {
    version: input.version && input.version > 0 ? input.version : STRATEGY_SNAPSHOT_SCHEMA_VERSION,
    scope: textValue(input.scope) || 'organic',
    goal: textValue(input.goal),
    planningHorizonDays: positiveInteger(input.planningHorizonDays),
    plannedOrganicPostCount: positiveInteger(input.plannedOrganicPostCount),
    audiences: listValue(strategy.audienceSegmentsDetailed || strategy.audienceSegments || strategy.targetAudience),
    positioning: strategy.positioning || strategy.differentiation || null,
    funnel: listValue(strategy.funnelStages || strategy.funnel || strategy.funnelStrategy),
    channels: listValue(strategy.channelStrategy || strategy.channels || strategy.channelMix),
    contentSystem: strategy.contentSystem || {
      pillars: listValue(strategy.contentPillars),
      angles: listValue(strategy.contentAngles),
      calendar: listValue(strategy.weeklyExecutionPlan || strategy.weeklyPlan || strategy.contentCalendar),
    },
    measurementPlan: strategy.measurementPlan || {
      kpis: listValue(strategy.successMetricsDetailed || strategy.kpis || strategy.successMetrics),
      baseline: strategy.baseline || null,
    },
    evidenceRefs: input.evidenceRefs || [],
    assumptions: input.assumptions || [],
    missingInputs: input.missingInputs || [],
    riskFlags: input.riskFlags || [],
    executionLinks: {
      brand: '/brand',
      content: `/campaigns/${input.campaignId}/content-hub`,
      creative: `/campaigns/${input.campaignId}/creative-brief`,
      approvals: '/approvals',
      connections: '/connections',
      publish: `/campaigns/${input.campaignId}?tab=publish`,
      paid: `/campaigns/${input.campaignId}/execution`,
      performance: `/campaigns/${input.campaignId}?tab=performance`,
      analytics: '/analytics',
    },
    approvalState: input.approvalState || 'review',
    supersedesVersion: input.supersedesVersion ?? null,
  }
}
