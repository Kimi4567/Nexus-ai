import { buildStrategyApprovalContract, type StrategyDecisionEvent } from '@/lib/strategyApproval'
import { resolveStrategyScope, type StrategyScopeType } from '@/lib/strategy/strategyScope'
import type { PaidExecutionObjective } from '@/lib/paidExecutionObjective'

type JsonRecord = Record<string, unknown>

export type PaidStrategySourceReason =
  | 'READY'
  | 'STRATEGY_MISSING'
  | 'PAID_SCOPE_REQUIRED'
  | 'QUALITY_REVIEW_REQUIRED'
  | 'APPROVAL_REQUIRED'

export interface PaidStrategySourceCampaign {
  id: string
  workspaceId: string
  name: string
  status: string
  goal: string
  audience: string | null
  platforms: unknown
  aiOutput: unknown
  updatedAt: Date | string | null
}

export interface PaidStrategySourceTruth {
  id: string
  workspaceId: string
  name: string
  goal: string
  executionObjective: PaidExecutionObjective
  status: string
  scope: StrategyScopeType
  approvalState: 'draft' | 'blocked' | 'ready_for_review' | 'approved' | 'revoked'
  eligible: boolean
  reason: PaidStrategySourceReason
  updatedAt: string | null
}

export function paidObjectiveFromStrategyGoal(goal: string): PaidStrategySourceTruth['executionObjective'] {
  const normalized = goal.trim().toUpperCase()
  if (normalized === 'SALES') return 'CONVERSIONS'
  if (normalized === 'LEADS') return 'LEAD_GENERATION'
  if (normalized === 'AWARENESS' || normalized === 'BRAND_BUILDING') return 'BRAND_AWARENESS'
  if (normalized === 'ENGAGEMENT') return 'ENGAGEMENT'
  return 'TRAFFIC'
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function dateString(value: Date | string | null): string | null {
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' && value.trim() ? value : null
}

export function inspectPaidStrategySource(
  campaign: PaidStrategySourceCampaign,
  latestDecision: StrategyDecisionEvent | null = null,
): PaidStrategySourceTruth {
  const scope = resolveStrategyScope(campaign.aiOutput)
  const approval = buildStrategyApprovalContract({
    campaign,
    latestDecision,
    publishedPostCount: 0,
    activeAdCampaignCount: 0,
  })
  const output = record(campaign.aiOutput)
  const nestedStrategy = record(output?.strategy)
  const hasStrategy = Boolean((nestedStrategy ?? output) && Object.keys(nestedStrategy ?? output ?? {}).length > 0)

  const reason: PaidStrategySourceReason = !hasStrategy
    ? 'STRATEGY_MISSING'
    : !scope.includesPaid
      ? 'PAID_SCOPE_REQUIRED'
      : approval.operatingBrief.sentinelStatus !== 'passed'
        ? 'QUALITY_REVIEW_REQUIRED'
      : approval.state !== 'approved'
        ? 'APPROVAL_REQUIRED'
        : 'READY'

  return {
    id: campaign.id,
    workspaceId: campaign.workspaceId,
    name: campaign.name,
    goal: campaign.goal,
    executionObjective: paidObjectiveFromStrategyGoal(campaign.goal),
    status: campaign.status,
    scope: scope.type,
    approvalState: approval.state,
    eligible: reason === 'READY',
    reason,
    updatedAt: dateString(campaign.updatedAt),
  }
}

const STRATEGY_CONTEXT_KEYS = [
  'strategyType',
  'goal',
  'objective',
  'campaignObjective',
  'positioning',
  'positioningStatement',
  'keyMessage',
  'coreMessage',
  'valueProposition',
  'targetAudience',
  'targetAudienceRefined',
  'audienceSegments',
  'customerPersonas',
  'funnel',
  'funnelStrategy',
  'paidPlan',
  'paidStrategy',
  'paidCampaignPlan',
  'paidPlanning',
  'platformStrategy',
  'platformRecommendations',
  'contentPillars',
  'contentAngles',
  'hooks',
  'ctaVariations',
  'creativeDirection',
  'measurementFramework',
  'kpis',
  'decisionRules',
  'risks',
  'constraints',
  'missingDataKeys',
] as const

export function buildPaidStrategyExecutionContext(aiOutput: unknown): string {
  const output = record(aiOutput) ?? {}
  const strategy = record(output.strategy) ?? output
  const selected = Object.fromEntries(
    STRATEGY_CONTEXT_KEYS
      .filter(key => strategy[key] !== undefined && strategy[key] !== null)
      .map(key => [key, strategy[key]]),
  )

  return JSON.stringify(selected).slice(0, 18_000)
}
