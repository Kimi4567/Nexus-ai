type StrategyRecord = Record<string, unknown>

export interface CampaignStrategyContractReport {
  valid: boolean
  score: number
  legacySchemaDetected: boolean
  missingFields: string[]
  weakFields: string[]
}

const LEGACY_ENGINE_KEYS = new Set([
  'overview',
  'audience',
  'valueProps',
  'angles',
  'platformRecommendations',
  'ctaStrategies',
])

const REQUIRED_STRING_FIELDS = [
  'campaignName',
  'goal',
  'positioning',
  'keyMessage',
  'differentiation',
  'targetAudienceRefined',
  'diagnosis',
  'nextBestAction',
  'estimatedResults',
  'readyForPaidAdsReason',
]

const REQUIRED_OBJECT_FIELDS = [
  'businessObjective',
  'diagnosisDetails',
  'confidenceReport',
]

const REQUIRED_ARRAY_FIELDS: Array<{ key: string; min: number }> = [
  { key: 'contentPillars', min: 3 },
  { key: 'topHooks', min: 3 },
  { key: 'ctaVariations', min: 3 },
  { key: 'audienceSegmentsDetailed', min: 2 },
  { key: 'contentAnglesDetailed', min: 4 },
  { key: 'weeklyExecutionPlan', min: 4 },
  { key: 'funnelStages', min: 3 },
  { key: 'kpis', min: 2 },
  { key: 'readinessChecklist', min: 3 },
  { key: 'riskNotes', min: 1 },
  { key: 'assumptions', min: 1 },
  { key: 'missingData', min: 0 },
]

function isRecord(value: unknown): value is StrategyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length >= 3
}

function hasObject(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0
}

function hasArray(value: unknown, min: number): boolean {
  return Array.isArray(value) && value.length >= min
}

export function detectLegacyCampaignEngineStrategy(strategy: unknown): boolean {
  if (!isRecord(strategy)) return false
  const keys = Object.keys(strategy)
  if (keys.length === 0) return false
  const richSignals = [
    'positioning',
    'diagnosis',
    'businessObjective',
    'audienceSegmentsDetailed',
    'weeklyExecutionPlan',
    'funnelStages',
    'readinessChecklist',
  ]
  return keys.every(key => LEGACY_ENGINE_KEYS.has(key)) && !richSignals.some(key => key in strategy)
}

export function validateCampaignStrategyContract(strategy: unknown): CampaignStrategyContractReport {
  const missingFields: string[] = []
  const weakFields: string[] = []

  if (!isRecord(strategy)) {
    return {
      valid: false,
      score: 0,
      legacySchemaDetected: false,
      missingFields: ['strategy'],
      weakFields: [],
    }
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!(field in strategy)) missingFields.push(field)
    else if (!hasText(strategy[field])) weakFields.push(field)
  }

  for (const field of REQUIRED_OBJECT_FIELDS) {
    if (!(field in strategy)) missingFields.push(field)
    else if (!hasObject(strategy[field])) weakFields.push(field)
  }

  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!(field.key in strategy)) missingFields.push(field.key)
    else if (!hasArray(strategy[field.key], field.min)) weakFields.push(field.key)
  }

  const legacySchemaDetected = detectLegacyCampaignEngineStrategy(strategy)
  const totalChecks = REQUIRED_STRING_FIELDS.length + REQUIRED_OBJECT_FIELDS.length + REQUIRED_ARRAY_FIELDS.length
  const failedChecks = missingFields.length + weakFields.length + (legacySchemaDetected ? 4 : 0)
  const score = Math.max(0, Math.round(((totalChecks - failedChecks) / totalChecks) * 100))

  return {
    valid: !legacySchemaDetected && missingFields.length === 0 && weakFields.length === 0,
    score,
    legacySchemaDetected,
    missingFields,
    weakFields,
  }
}

export function assertCampaignStrategyContract(strategy: unknown): CampaignStrategyContractReport {
  const report = validateCampaignStrategyContract(strategy)
  if (!report.valid) {
    const details = [
      report.legacySchemaDetected ? 'legacy engine schema detected' : '',
      report.missingFields.length ? `missing: ${report.missingFields.join(', ')}` : '',
      report.weakFields.length ? `weak: ${report.weakFields.join(', ')}` : '',
    ].filter(Boolean).join('; ')
    throw new Error(`Campaign engine strategy failed Strategy OS contract (${details || 'unknown reason'})`)
  }
  return report
}
