export interface DraftVariantComparison {
  hypothesis: string
  variable: string
  successSignal: string
  minimumEvidence: string
  decisionRule: string
  measurementState: 'draft_preference_only'
}
type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Links a draft-copy comparison to the reviewed strategy experiment backlog.
 * This deliberately does not call the draft a performance test: until both
 * variants receive measured distribution, the only signal is user preference.
 */
export function getDraftVariantComparison(
  strategy: unknown,
  contentPlanIndex: unknown,
): DraftVariantComparison | null {
  const strategyRecord = record(strategy)
  const experiments = Array.isArray(strategyRecord?.experimentBacklog)
    ? strategyRecord.experimentBacklog.map(record).filter((item): item is JsonRecord => Boolean(item))
    : []
  if (experiments.length === 0) return null

  const numericIndex = typeof contentPlanIndex === 'number' && Number.isInteger(contentPlanIndex)
    ? Math.max(1, contentPlanIndex)
    : 1
  const experiment = experiments[(numericIndex - 1) % experiments.length]
  const hypothesis = text(experiment.hypothesis)
  const variable = text(experiment.variable)
  const successSignal = text(experiment.successSignal)
  const minimumEvidence = text(experiment.minimumEvidence)
  const decisionRule = text(experiment.decisionRule)
  if (!hypothesis || !variable || !successSignal || !minimumEvidence || !decisionRule) return null

  return {
    hypothesis,
    variable,
    successSignal,
    minimumEvidence,
    decisionRule,
    measurementState: 'draft_preference_only',
  }
}
