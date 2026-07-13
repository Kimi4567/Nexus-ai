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

  if (isArabicLanguage(options.language)) {
    languageViolations.push(...collectArabicLanguageViolations(strategy))
  }
  countViolations.push(...validateBindingOrganicPostCount(strategy, options.expectedOrganicPostCount))

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
