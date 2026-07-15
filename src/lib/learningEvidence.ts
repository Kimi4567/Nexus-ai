export interface PerformanceLearningEvidenceContract {
  schemaVersion: 1
  source: 'platform_api'
  observationType: 'platform_local_association'
  causalClaim: false
  platform: string
  period: { start: string; end: string }
  sample: {
    eligiblePosts: number
    aboveThresholdPosts: number
    evidencePostIds: string[]
    campaignIds: string[]
  }
  comparison: {
    metricDefinition: string
    baselineMethod: 'platform_local_median'
    baselineEngagementRate: number
    candidateThresholdEngagementRate: number
    thresholdRule: 'at_least_20_percent_above_platform_median'
  }
  confidence: { level: 'directional'; rationale: string }
  proposedChange: {
    field: string
    values: string[]
    affectsExistingApprovedRevisions: false
    affectsFutureStrategyAndContent: true
  }
  rollback: {
    strategy: 'remove_only_values_added_by_this_proposal'
    field: string
    previousValue: unknown
  }
}

export interface PerformanceLearningRollbackPlan {
  field: string
  nextValue: string[]
  removedValues: string[]
  addedValues: string[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) return null
  return value as string[]
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime())
}

const EVIDENCE_PLATFORMS = new Set(['META', 'LINKEDIN', 'TIKTOK', 'X', 'YOUTUBE', 'PINTEREST', 'THREADS'])
const METRIC_DEFINITIONS = new Set([
  'engaged_users_over_reach_or_impressions',
  'clicks_reactions_comments_shares_saves_over_impressions',
])

export function readPerformanceLearningEvidence(value: unknown): PerformanceLearningEvidenceContract | null {
  const root = record(value)
  const period = record(root?.period)
  const sample = record(root?.sample)
  const comparison = record(root?.comparison)
  const confidence = record(root?.confidence)
  const proposedChange = record(root?.proposedChange)
  const rollback = record(root?.rollback)
  const evidencePostIds = stringArray(sample?.evidencePostIds)
  const campaignIds = stringArray(sample?.campaignIds)
  const proposedValues = stringArray(proposedChange?.values)
  const rollbackPreviousValue = stringArray(rollback?.previousValue)

  if (
    root?.schemaVersion !== 1
    || root.source !== 'platform_api'
    || root.observationType !== 'platform_local_association'
    || root.causalClaim !== false
    || typeof root.platform !== 'string'
    || !EVIDENCE_PLATFORMS.has(root.platform)
    || !validDate(period?.start)
    || !validDate(period?.end)
    || new Date(period.start).getTime() > new Date(period.end).getTime()
    || typeof sample?.eligiblePosts !== 'number'
    || sample.eligiblePosts < 5
    || typeof sample.aboveThresholdPosts !== 'number'
    || sample.aboveThresholdPosts < 3
    || sample.aboveThresholdPosts > sample.eligiblePosts
    || !evidencePostIds
    || evidencePostIds.length !== sample.aboveThresholdPosts
    || new Set(evidencePostIds).size !== evidencePostIds.length
    || !campaignIds
    || typeof comparison?.metricDefinition !== 'string'
    || !METRIC_DEFINITIONS.has(comparison.metricDefinition)
    || comparison.baselineMethod !== 'platform_local_median'
    || typeof comparison.baselineEngagementRate !== 'number'
    || typeof comparison.candidateThresholdEngagementRate !== 'number'
    || comparison.candidateThresholdEngagementRate + 0.0001 < Math.max(0.1, comparison.baselineEngagementRate * 1.2)
    || comparison.thresholdRule !== 'at_least_20_percent_above_platform_median'
    || confidence?.level !== 'directional'
    || typeof confidence.rationale !== 'string'
    || confidence.rationale.length < 20
    || proposedChange?.field !== 'winningHooks'
    || !proposedValues
    || proposedValues.length === 0
    || proposedChange.affectsExistingApprovedRevisions !== false
    || proposedChange.affectsFutureStrategyAndContent !== true
    || rollback?.strategy !== 'remove_only_values_added_by_this_proposal'
    || rollback.field !== proposedChange.field
    || !rollbackPreviousValue
  ) return null

  return value as PerformanceLearningEvidenceContract
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/**
 * Computes a non-destructive rollback for an accepted performance lesson.
 * It removes only values that were absent before acceptance, present directly
 * after acceptance, and explicitly proposed by the evidence contract. Any
 * later user edits or pre-existing Brand Brain values remain untouched.
 */
export function planPerformanceLearningRollback({
  proposalId,
  field,
  evidence,
  currentValue,
  acceptanceMetadata,
}: {
  proposalId: string
  field: string
  evidence: unknown
  currentValue: unknown
  acceptanceMetadata: unknown
}): PerformanceLearningRollbackPlan | null {
  const contract = readPerformanceLearningEvidence(evidence)
  const metadata = record(acceptanceMetadata)
  const previousValue = stringArray(metadata?.previousValue)
  const appliedValue = stringArray(metadata?.appliedValue)
  const current = stringArray(currentValue)
  const metadataProposalId = typeof metadata?.proposalId === 'string' ? metadata.proposalId : null

  if (
    !contract
    || contract.proposedChange.field !== field
    || contract.rollback.field !== field
    || metadataProposalId !== proposalId
    || !previousValue
    || !appliedValue
    || !current
  ) return null

  const previousKeys = new Set(previousValue.map(normalized))
  const proposedKeys = new Set(contract.proposedChange.values.map(normalized))
  const addedValues = appliedValue.filter((value) => (
    !previousKeys.has(normalized(value)) && proposedKeys.has(normalized(value))
  ))
  const addedKeys = new Set(addedValues.map(normalized))
  const removedValues = current.filter((value) => addedKeys.has(normalized(value)))

  return {
    field,
    nextValue: current.filter((value) => !addedKeys.has(normalized(value))),
    removedValues,
    addedValues,
  }
}
