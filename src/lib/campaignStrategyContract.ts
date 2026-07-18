import type { StrategyDeliverables, StrategyType } from '@/lib/strategy/strategyOrder'

type StrategyRecord = Record<string, unknown>

export interface CampaignStrategyContractReport {
  valid: boolean
  score: number
  legacySchemaDetected: boolean
  missingFields: string[]
  weakFields: string[]
  languageViolations: string[]
  countViolations: string[]
}

export interface CampaignStrategyContractOptions {
  language?: string | null
  /**
   * Binding count from the reviewed StrategyOrder/deliverables contract.
   * When present, strategy output must contain exactly this many organic post
   * directions and weekly deliverables must add up to the same count.
   */
  expectedOrganicPostCount?: number | null
  strategyType?: StrategyType | null
  /** Exact server-authored Paid/Full deliverable counts. */
  expectedPaidPlanning?: StrategyDeliverables | null
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
  'assetRequirements',
  'measurementPlan',
  'operatingCadence',
  'competitorFrame',
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
  { key: 'experimentBacklog', min: 3 },
  { key: 'decisionRules', min: 3 },
  { key: 'roadmap30_60_90', min: 3 },
]

function requiredArrayMinimum(
  key: string,
  defaultMinimum: number,
  expectedOrganicPostCount: number | null | undefined,
): number {
  if (
    typeof expectedOrganicPostCount !== 'number' ||
    !Number.isFinite(expectedOrganicPostCount) ||
    expectedOrganicPostCount <= 0
  ) return defaultMinimum

  const expected = Math.floor(expectedOrganicPostCount)
  if (key === 'contentAnglesDetailed') return expected
  if (key === 'weeklyExecutionPlan') return Math.min(4, expected)
  return defaultMinimum
}

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

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizedFingerprint(value: unknown): string {
  return text(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSimilarity(left: unknown, right: unknown): number {
  const a = new Set(normalizedFingerprint(left).split(' ').filter(token => token.length > 2))
  const b = new Set(normalizedFingerprint(right).split(' ').filter(token => token.length > 2))
  if (a.size === 0 || b.size === 0) return 0
  const intersection = [...a].filter(token => b.has(token)).length
  return intersection / new Set([...a, ...b]).size
}

function hasNearDuplicateRecords(value: unknown, fields: string[], threshold = 0.88): boolean {
  if (!Array.isArray(value)) return false
  const fingerprints = value.map(item => isRecord(item)
    ? fields.map(field => text(item[field])).join(' ')
    : '')
  for (let left = 0; left < fingerprints.length; left += 1) {
    for (let right = left + 1; right < fingerprints.length; right += 1) {
      if (normalizedFingerprint(fingerprints[left]) === normalizedFingerprint(fingerprints[right])) return true
      if (tokenSimilarity(fingerprints[left], fingerprints[right]) >= threshold) return true
    }
  }
  return false
}

function isArabicLanguage(language: string | null | undefined): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

function latinLetterCount(value: string): number {
  return (value.match(/[A-Za-z]/g) || []).length
}

function arabicLetterCount(value: string): number {
  return (value.match(/[\u0600-\u06FF]/g) || []).length
}

function isEnglishHeavyForArabicOutput(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const latin = latinLetterCount(trimmed)
  if (latin < 22) return false

  const arabic = arabicLetterCount(trimmed)
  if (arabic === 0) return true
  return latin >= 32 && latin > arabic * 2
}

function hasBrokenArabicStrategyPhrase(value: string): boolean {
  return /ابدأ\s+باستخدام\s+(?:النظام|المنصة|الخدمة)\s+معدودة/i.test(value)
    || /دون\s+تعقيد\s+التقنيات\s+اليدوية/i.test(value)
    || /لا\s+تفقد\s+أي\s+فرصة\s+بيع\s+بعد\s+اليوم/i.test(value)
}

const NON_LANGUAGE_USER_KEYS = new Set([
  'goal',
  'businessStage',
  'stage',
  'category',
  'platform',
  'platforms',
  'format',
  'contentType',
  'productArea',
  'timeframe',
  'overall',
  'contentStrategy',
  'fullStrategy',
  'paidPlanning',
  'organicContent',
])

function collectArabicLanguageViolations(value: unknown, path = 'strategy'): string[] {
  if (typeof value === 'string') {
    return isEnglishHeavyForArabicOutput(value) || hasBrokenArabicStrategyPhrase(value) ? [path] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectArabicLanguageViolations(item, `${path}[${index}]`))
  }

  if (!isRecord(value)) return []

  const violations: string[] = []
  for (const [key, child] of Object.entries(value)) {
    if (NON_LANGUAGE_USER_KEYS.has(key)) continue
    violations.push(...collectArabicLanguageViolations(child, `${path}.${key}`))
  }
  return violations
}

function hasUsefulText(value: unknown): boolean {
  const valueText = text(value)
  return valueText.length >= 3 && !isGenericPlanningText(valueText)
}

const GENERIC_PLANNING_PATTERNS = [
  /^create content$/i,
  /^post consistently$/i,
  /^build awareness$/i,
  /^increase engagement$/i,
  /^improve engagement$/i,
  /^grow audience$/i,
  /^promote (the )?offer$/i,
  /^share tips$/i,
  /^engage followers$/i,
  /\bcutting-edge\b/i,
  /\bgame-?changer\b/i,
  /\bleverage\b/i,
  /\bmaximize roi\b/i,
  /\bunlock (your )?potential\b/i,
  /\btransform your business\b/i,
]

const COUNTABLE_DELIVERABLE_PATTERN =
  /(\b\d+\b|[٠-٩]|[۰-۹]|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(واحد|واحدة|اثنين|إثنين|اثنان|اثنتين|ثلاثة|ثلاث|أربعة|اربع|أربع|خمسة|خمس|ستة|ست|سبعة|سبع|ثمانية|ثمان|تسعة|تسع|عشرة|عشر)\b)/i

function isGenericPlanningText(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return GENERIC_PLANNING_PATTERNS.some(pattern => pattern.test(normalized))
}

function hasCountableDeliverable(value: unknown): boolean {
  const valueText = text(value)
  if (!hasUsefulText(valueText)) return false
  return COUNTABLE_DELIVERABLE_PATTERN.test(valueText)
}

const WORD_COUNTS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  واحد: 1,
  واحدة: 1,
  اثنين: 2,
  إثنين: 2,
  اثنان: 2,
  اثنتين: 2,
  ثلاثة: 3,
  ثلاث: 3,
  أربعة: 4,
  اربع: 4,
  أربع: 4,
  خمسة: 5,
  خمس: 5,
  ستة: 6,
  ست: 6,
  سبعة: 7,
  سبع: 7,
  ثمانية: 8,
  ثمان: 8,
  تسعة: 9,
  تسع: 9,
  عشرة: 10,
  عشر: 10,
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

function deliverableUnitCount(value: unknown): number {
  const valueText = normalizeDigits(text(value))
  if (!hasUsefulText(valueText)) return 0

  const numberMatch = valueText.match(/\b(\d{1,2})\b/)
  if (numberMatch) {
    const n = Number(numberMatch[1])
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  for (const [word, count] of Object.entries(WORD_COUNTS)) {
    const re = new RegExp(`(^|\\s)${word}(\\s|$)`, 'i')
    if (re.test(valueText)) return count
  }

  return 0
}

function weeklyDeliverableUnitCount(value: unknown): number {
  if (!Array.isArray(value)) return 0

  return value.reduce((total, item) => {
    if (!isRecord(item) || !Array.isArray(item.deliverables)) return total
    return total + item.deliverables.reduce((weekTotal, deliverable) => (
      weekTotal + deliverableUnitCount(deliverable)
    ), 0)
  }, 0)
}

function validateBindingOrganicPostCount(
  strategy: StrategyRecord,
  expectedOrganicPostCount: number | null | undefined,
): string[] {
  if (
    typeof expectedOrganicPostCount !== 'number' ||
    !Number.isFinite(expectedOrganicPostCount) ||
    expectedOrganicPostCount <= 0
  ) {
    return []
  }

  const expected = Math.floor(expectedOrganicPostCount)
  const contentAnglesCount = Array.isArray(strategy.contentAnglesDetailed)
    ? strategy.contentAnglesDetailed.length
    : 0
  const weeklyCount = weeklyDeliverableUnitCount(strategy.weeklyExecutionPlan)
  const violations: string[] = []

  if (contentAnglesCount !== expected) {
    violations.push(`contentAnglesDetailed.count:${contentAnglesCount}/${expected}`)
  }
  if (weeklyCount !== expected) {
    violations.push(`weeklyExecutionPlan.deliverableCount:${weeklyCount}/${expected}`)
  }

  return violations
}

function validateBindingPaidPlanning(
  strategy: StrategyRecord,
  expected: StrategyDeliverables | null | undefined,
): { missing: string[]; weak: string[]; count: string[] } {
  const result = { missing: [] as string[], weak: [] as string[], count: [] as string[] }
  if (!expected || expected.paidAdVariationCount <= 0) return result

  const paid = strategy.paidPlanning
  if (!isRecord(paid)) {
    result.missing.push('paidPlanning')
    return result
  }
  if (paid.planningOnly !== true) result.weak.push('paidPlanning.planningOnly')
  if (!hasUsefulText(paid.objective)) result.weak.push('paidPlanning.objective')
  if (!hasUsefulText(paid.budgetFramework)) result.weak.push('paidPlanning.budgetFramework')

  const exactArrays: Array<{
    key: string
    expectedCount: number
    fields: string[]
  }> = [
    {
      key: 'audienceHypotheses',
      expectedCount: expected.audienceHypothesisCount,
      fields: ['name', 'buyingSituation', 'targetingHypothesis', 'exclusions', 'validationNeeded'],
    },
    {
      key: 'adAngles',
      expectedCount: expected.paidAdAngleCount,
      fields: ['name', 'audienceHypothesis', 'message', 'funnelStage', 'proofNeeded', 'testVariable', 'successSignal', 'rejectionRule'],
    },
    {
      key: 'adCopyVariations',
      expectedCount: expected.paidAdVariationCount,
      // IDs are identifiers, not marketing copy. "1" or "A" is valid as long
      // as it is present and unique; the user-facing fields still need useful
      // operational text.
      fields: ['angle', 'headline', 'primaryText', 'cta', 'destination', 'assumption'],
    },
    {
      key: 'creativeBriefs',
      expectedCount: expected.creativeBriefCount,
      fields: ['name', 'angle', 'format', 'visualDirection', 'assetStatus', 'proofBoundary', 'reviewGate'],
    },
  ]

  for (const entry of exactArrays) {
    const value = paid[entry.key]
    const actual = Array.isArray(value) ? value.length : 0
    if (!Array.isArray(value)) result.missing.push(`paidPlanning.${entry.key}`)
    if (actual !== entry.expectedCount) {
      result.count.push(`paidPlanning.${entry.key}.count:${actual}/${entry.expectedCount}`)
    }
    if (Array.isArray(value) && !value.every(item => objectHasUsefulFields(item, entry.fields))) {
      result.weak.push(`paidPlanning.${entry.key}.operationalDepth`)
    }
    if (entry.key === 'creativeBriefs' && Array.isArray(value) && !value.every(item => (
      isRecord(item) && Array.isArray(item.requiredAssets) && item.requiredAssets.length > 0
    ))) {
      result.weak.push('paidPlanning.creativeBriefs.requiredAssets')
    }
    if (entry.key === 'adCopyVariations' && Array.isArray(value)) {
      const ids = value.map(item => isRecord(item) ? text(item.id) : '')
      if (ids.some(id => id.length === 0) || new Set(ids).size !== ids.length) {
        result.weak.push('paidPlanning.adCopyVariations.ids')
      }
    }
  }

  if (hasNearDuplicateRecords(paid.audienceHypotheses, ['targetingHypothesis', 'validationNeeded'])) {
    result.weak.push('paidPlanning.audienceHypotheses.distinctTests')
  }
  if (hasNearDuplicateRecords(paid.adAngles, ['message', 'testVariable', 'rejectionRule'])) {
    result.weak.push('paidPlanning.adAngles.distinctTests')
  }
  if (hasNearDuplicateRecords(paid.adCopyVariations, ['headline', 'primaryText'], 0.82)) {
    result.weak.push('paidPlanning.adCopyVariations.distinctCopy')
  }
  if (hasNearDuplicateRecords(paid.creativeBriefs, ['angle', 'format', 'visualDirection'])) {
    result.weak.push('paidPlanning.creativeBriefs.distinctTreatments')
  }
  if (Array.isArray(paid.creativeBriefs) && paid.creativeBriefs.some(item => (
    !isRecord(item)
    || !['existing_approved', 'user_upload_required', 'generation_required'].includes(text(item.assetStatus))
  ))) {
    result.weak.push('paidPlanning.creativeBriefs.assetStatus')
  }

  for (const key of ['trackingChecklist', 'launchBlockers']) {
    if (!Array.isArray(paid[key]) || paid[key].length === 0 || !paid[key].every(hasUsefulText)) {
      result.weak.push(`paidPlanning.${key}`)
    }
  }
  return result
}

const PAID_ONLY_ORGANIC_DELIVERABLE = /\b(posts?|posting|reels?|carousels?|captions?|content calendar|publish(?:ing|ed)?)\b|(?:منشورات?|ريلز|كاروسيل|كابشن|تقويم\s+محتوى|نشر)/i

function paidOnlyWeeklyPlanContainsOrganicExecution(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.some(item => (
    isRecord(item)
    && Array.isArray(item.deliverables)
    && item.deliverables.some(deliverable => PAID_ONLY_ORGANIC_DELIVERABLE.test(text(deliverable)))
  ))
}

function objectHasUsefulFields(value: unknown, fields: string[]): boolean {
  if (!isRecord(value)) return false
  return fields.every(field => hasUsefulText(value[field]))
}

function hasOperationalAudienceSegments(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every(item => objectHasUsefulFields(item, [
    'segment',
    'pain',
    'desiredOutcome',
    'objection',
    'message',
    'platform',
    'cta',
  ]))
}

function hasOperationalContentAngles(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every(item => objectHasUsefulFields(item, [
    'title',
    'hook',
    'pain',
    'desiredOutcome',
    'objection',
    'format',
    'platform',
    'cta',
    'asset',
    'funnelStage',
    'proofNeeded',
    'responseHandoff',
    'reviewPoint',
  ]))
}

function hasOperationalFunnelStages(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every(item => objectHasUsefulFields(item, [
    'stage',
    'userMindset',
    'message',
    'contentType',
    'platform',
    'cta',
    'successMetric',
    'nextStep',
    'productArea',
  ]))
}

function hasOperationalWeeklyPlan(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every((item) => {
    if (!isRecord(item)) return false
    if (!objectHasUsefulFields(item, ['objective', 'keyMessage', 'cta', 'successMetric', 'executionNote'])) return false
    if (!Array.isArray(item.platforms) || item.platforms.length === 0) return false
    if (!Array.isArray(item.deliverables) || item.deliverables.length === 0) return false
    if (!Array.isArray(item.assetsNeeded) || item.assetsNeeded.length === 0) return false
    if (!Array.isArray(item.reviewPoints) || item.reviewPoints.length === 0) return false
    return item.deliverables.every(hasCountableDeliverable)
  })
}

function hasOperationalAgencySystem(strategy: StrategyRecord): boolean {
  const measurement = strategy.measurementPlan
  const cadence = strategy.operatingCadence
  const competitor = strategy.competitorFrame
  if (!objectHasUsefulFields(measurement, ['primaryOutcome', 'baselineStatus', 'attributionRule', 'reportingCadence', 'owner', 'noDataDecision'])) return false
  if (!isRecord(measurement) || !Array.isArray(measurement.eventsToTrack) || measurement.eventsToTrack.length === 0) return false
  if (!objectHasUsefulFields(cadence, ['approvalSla', 'responseSla'])) return false
  if (!isRecord(cadence) || !['daily', 'weekly', 'monthly', 'owners'].every(key => Array.isArray(cadence[key]) && (cadence[key] as unknown[]).length > 0)) return false
  if (!isRecord(competitor) || !hasUsefulText(competitor.analysisStatus)) return false
  if (!Array.isArray(competitor.providedCompetitors) || !Array.isArray(competitor.differentiationHypotheses) || !Array.isArray(competitor.researchNeeded)) return false

  const experiments = strategy.experimentBacklog
  if (!Array.isArray(experiments) || !experiments.every(item => objectHasUsefulFields(item, ['hypothesis', 'audience', 'variable', 'successSignal', 'minimumEvidence', 'decisionRule', 'priority', 'dependency']))) return false
  const rules = strategy.decisionRules
  if (!Array.isArray(rules) || !rules.every(item => objectHasUsefulFields(item, ['signal', 'continueWhen', 'iterateWhen', 'stopWhen', 'nextAction']))) return false
  const roadmap = strategy.roadmap30_60_90
  if (!Array.isArray(roadmap) || !roadmap.every(item => (
    objectHasUsefulFields(item, ['phase', 'objective', 'exitGate'])
    && isRecord(item)
    && Array.isArray(item.deliverables)
    && item.deliverables.length > 0
  ))) return false
  return true
}

const MEASURABLE_SUCCESS_SIGNAL = /\b(?:baseline|qualified|purchase|order|lead|inquir|booking|signup|click|conversion|revenue|event|attribution|continue|iterate|stop)\b|(?:خط\s+أساس|طلب|شراء|عميل\s+محتمل|استفسار|حجز|نقرة|تحويل|إيراد|حدث|إسناد|استمرار|تعديل|إيقاف)/i
const GENERIC_SUCCESS_DEFINITION = /validate (?:market )?(?:interest|engagement)|clearer .+ validated|تحقق من (?:اهتمام|تفاعل)/i

function hasOperationalBusinessObjective(value: unknown): boolean {
  if (!objectHasUsefulFields(value, ['primary', 'marketing', 'conversionAction', 'expectedUserAction', 'whyNow', 'successIn30Days'])) return false
  if (!isRecord(value)) return false
  const definition = text(value.successIn30Days)
  return MEASURABLE_SUCCESS_SIGNAL.test(definition) && !GENERIC_SUCCESS_DEFINITION.test(definition)
}

function hasTruthLabeledDiagnosis(value: unknown): boolean {
  if (!objectHasUsefulFields(value, ['stage', 'basis', 'evidenceBasis', 'bottleneck', 'trustGap', 'offerClarity', 'contentGap', 'assetReadiness', 'conversionReadiness', 'readyForPaidAdsReason', 'mainRisk'])) return false
  if (!isRecord(value)) return false
  return ['documented', 'hypothesis'].includes(text(value.basis))
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

export function validateCampaignStrategyContract(
  strategy: unknown,
  options: CampaignStrategyContractOptions = {},
): CampaignStrategyContractReport {
  const missingFields: string[] = []
  const weakFields: string[] = []
  const languageViolations: string[] = []
  const countViolations: string[] = []

  if (!isRecord(strategy)) {
    return {
      valid: false,
      score: 0,
      legacySchemaDetected: false,
      missingFields: ['strategy'],
      weakFields: [],
      languageViolations: [],
      countViolations: [],
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
    const minimum = requiredArrayMinimum(field.key, field.min, options.expectedOrganicPostCount)
    if (!(field.key in strategy)) missingFields.push(field.key)
    else if (!hasArray(strategy[field.key], minimum)) weakFields.push(field.key)
  }

  if ('audienceSegmentsDetailed' in strategy && !hasOperationalAudienceSegments(strategy.audienceSegmentsDetailed)) {
    weakFields.push('audienceSegmentsDetailed.operationalDepth')
  }

  if ('contentAnglesDetailed' in strategy && !hasOperationalContentAngles(strategy.contentAnglesDetailed)) {
    weakFields.push('contentAnglesDetailed.operationalDepth')
  }

  if ('funnelStages' in strategy && !hasOperationalFunnelStages(strategy.funnelStages)) {
    weakFields.push('funnelStages.operationalDepth')
  }

  if ('weeklyExecutionPlan' in strategy && !hasOperationalWeeklyPlan(strategy.weeklyExecutionPlan)) {
    weakFields.push('weeklyExecutionPlan.countableDeliverables')
  }

  if (!hasOperationalAgencySystem(strategy)) {
    weakFields.push('agencyOperatingSystem.operationalDepth')
  }
  if (!hasOperationalBusinessObjective(strategy.businessObjective)) {
    weakFields.push('businessObjective.measurableSuccessDefinition')
  }
  if (!hasTruthLabeledDiagnosis(strategy.diagnosisDetails)) {
    weakFields.push('diagnosisDetails.truthBasis')
  }

  if (isArabicLanguage(options.language)) {
    languageViolations.push(...collectArabicLanguageViolations(strategy))
  }
  countViolations.push(...validateBindingOrganicPostCount(strategy, options.expectedOrganicPostCount))
  const paidReview = validateBindingPaidPlanning(strategy, options.expectedPaidPlanning)
  missingFields.push(...paidReview.missing)
  weakFields.push(...paidReview.weak)
  countViolations.push(...paidReview.count)
  if (options.strategyType === 'paid' && paidOnlyWeeklyPlanContainsOrganicExecution(strategy.weeklyExecutionPlan)) {
    weakFields.push('weeklyExecutionPlan.paidOnlyBoundary')
  }

  const legacySchemaDetected = detectLegacyCampaignEngineStrategy(strategy)
  const totalChecks = REQUIRED_STRING_FIELDS.length + REQUIRED_OBJECT_FIELDS.length + REQUIRED_ARRAY_FIELDS.length
  const failedChecks = missingFields.length + weakFields.length + languageViolations.length + countViolations.length + (legacySchemaDetected ? 4 : 0)
  const score = Math.max(0, Math.round(((totalChecks - failedChecks) / totalChecks) * 100))

  return {
    valid: !legacySchemaDetected && missingFields.length === 0 && weakFields.length === 0 && languageViolations.length === 0 && countViolations.length === 0,
    score,
    legacySchemaDetected,
    missingFields,
    weakFields,
    languageViolations,
    countViolations,
  }
}

export function assertCampaignStrategyContract(
  strategy: unknown,
  options: CampaignStrategyContractOptions = {},
): CampaignStrategyContractReport {
  const report = validateCampaignStrategyContract(strategy, options)
  if (!report.valid) {
    const details = [
      report.legacySchemaDetected ? 'legacy engine schema detected' : '',
      report.missingFields.length ? `missing: ${report.missingFields.join(', ')}` : '',
      report.weakFields.length ? `weak: ${report.weakFields.join(', ')}` : '',
      report.languageViolations.length ? `language: ${report.languageViolations.slice(0, 8).join(', ')}` : '',
      report.countViolations.length ? `count: ${report.countViolations.join(', ')}` : '',
    ].filter(Boolean).join('; ')
    throw new Error(`Campaign engine strategy failed Strategy OS contract (${details || 'unknown reason'})`)
  }
  return report
}
