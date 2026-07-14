/**
 * Deterministic marketing truth gate.
 *
 * Models can propose strategy and copy, but they do not decide whether an output
 * is safe to save or approve. This module is the server-authoritative backstop
 * for three expensive failure modes:
 *   1. contradictory Brand Brain inputs;
 *   2. customer-facing strategy that drifts into internal/agency operations;
 *   3. audiences, channels, or promises that were never supplied by the user.
 *
 * Keep this module pure. The same report is persisted with the strategy and is
 * recomputed before paid AI work, approval, and downstream content generation.
 */

export const MARKETING_QUALITY_GATE_VERSION = 1 as const

export type MarketingQualitySeverity = 'blocker' | 'warning'

export interface MarketingQualityFinding {
  code: string
  severity: MarketingQualitySeverity
  path: string
  message: string
}

export interface MarketingQualityGateReport {
  schemaVersion: typeof MARKETING_QUALITY_GATE_VERSION
  status: 'passed' | 'blocked'
  score: number
  blockers: MarketingQualityFinding[]
  warnings: MarketingQualityFinding[]
  checkedAt: string
}

export interface MarketingBrandProfile {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  primaryOffer?: string | null
  targetAudience?: string | null
  audienceAge?: string | null
  audienceLocation?: string | null
  audiencePainPoints?: string[] | null
  audienceDesires?: string[] | null
  uniqueAdvantages?: string[] | null
  verifiedProof?: string[] | null
  competitors?: string[] | null
  competitorNotes?: string | null
  conversionDestination?: string | null
  toneKeywords?: string[] | null
  writingStyle?: string | null
  avoidKeywords?: string[] | null
  topPlatforms?: string[] | null
  businessGoal?: string | null
  complianceNotes?: string | null
}

export interface StrategyQualityInput {
  strategy: unknown
  brand: MarketingBrandProfile | null | undefined
  allowedPlatforms?: string[] | null
  goal?: string | null
  checkedAt?: string
}

const STOP_WORDS = new Set([
  'about', 'after', 'also', 'and', 'are', 'brand', 'business', 'campaign', 'content', 'customer',
  'customers', 'for', 'from', 'have', 'into', 'more', 'offer', 'our', 'that', 'the', 'their',
  'this', 'through', 'with', 'your', 'الجمهور', 'الذي', 'التي', 'العلامة', 'المحتوى', 'العملاء',
  'إلى', 'على', 'عن', 'عند', 'في', 'كل', 'كما', 'لدى', 'لها', 'ما', 'من', 'هذا', 'هذه', 'هو',
  'هي', 'مع',
])

const INTERNAL_WORKFLOW_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'internal handoff', re: /front[-\s]?desk|hand[-\s]?off|handoff/i },
  { label: 'internal ownership', re: /\bowner(?:ship)?\b|request,?\s*owner|status,?\s*owner/i },
  { label: 'internal meeting', re: /team meeting|leadership sees|workflow review|operating checklist/i },
  { label: 'administrative workflow', re: /administrative (?:communication|workflow|follow[-\s]?up)|admin(?:istrative)? (?:step|review|workflow)/i },
  { label: 'review instruction', re: /compare (?:the )?(?:current )?workflow|save this idea for review|review (?:the )?next step/i },
  { label: 'إجراء تشغيلي داخلي', re: /التسليم بين الزملاء|فريق الاستقبال|اجتماع الفريق|قائمة مراجعة تشغيلية|العمل الإداري|التواصل الإداري|راجع الخطوة التالية/i },
]

const OPERATIONS_PRODUCT_RE = /saas|software|platform|dashboard|workflow (?:software|tool|platform)|management system|operations? (?:app|system|tool|platform)|برنامج|منصة|تطبيق|نظام إدارة|أداة تشغيل/i

const AUDIENCE_CLAIMS: Array<{ code: string; re: RegExp }> = [
  { code: 'children', re: /\b(?:children|kids|child-friendly|pediatric)\b|أطفال|للأطفال|صديق للأطفال/i },
  { code: 'families', re: /\b(?:family|families|parents)\b|عائلات|أسر|الوالدين|الآباء/i },
  { code: 'relocated', re: /recently (?:moved|relocated)|new to (?:the )?(?:city|area)|انتقل(?:وا)? حديثًا|جدد في المنطقة/i },
  { code: 'all_ages', re: /\b(?:all ages|every age)\b|جميع الأعمار|كل الأعمار/i },
]

const DOMAIN_SIGNATURES: Array<{
  id: string
  business: RegExp
  industry: RegExp
}> = [
  {
    id: 'dental',
    business: /dental|dentist|orthodont|teeth|tooth|oral health|أسنان|تقويم الأسنان|صحة الفم/i,
    industry: /dental|dentist|orthodont|oral health|طب الأسنان|عيادة أسنان/i,
  },
  {
    id: 'real_estate',
    business: /real estate|property|properties|brokerage|عقار|عقارات|وساطة عقارية/i,
    industry: /real estate|property|brokerage|عقار|عقارات|وساطة عقارية/i,
  },
  {
    id: 'coffee',
    business: /coffee|roaster|espresso|قهوة|محمصة|إسبريسو/i,
    industry: /coffee|beverage|food|hospitality|قهوة|مشروبات|أغذية|ضيافة/i,
  },
  {
    id: 'software',
    business: /saas|software|platform|application|app for|برمجيات|منصة|تطبيق/i,
    industry: /saas|software|technology|tech|برمجيات|تقنية|تكنولوجيا/i,
  },
]

const GENERIC_COMPETITOR_RE = /^(?:premium|leading|local|top|best)?\s*(?:dental|medical|beauty|marketing|real estate|coffee|software|saas)?\s*(?:clinics?|companies|agencies|providers|businesses|brands|stores|shops|firms)(?:\s+in\s+.+)?$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stringify).join(' ')
  if (isRecord(value)) return Object.values(value).map(stringify).join(' ')
  return ''
}

function normalizedText(value: unknown): string {
  return stringify(value).trim().replace(/\s+/g, ' ')
}

function tokens(value: unknown): Set<string> {
  return new Set(
    normalizedText(value)
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 3 && !STOP_WORDS.has(token)),
  )
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const token of left) if (right.has(token)) count += 1
  return count
}

function normalizePlatform(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (normalized === 'META') return 'META'
  if (normalized === 'TWITTER') return 'X'
  if (normalized === 'YOUTUBE_SHORT') return 'YOUTUBE_SHORTS'
  return normalized
}

function collectPlatformValues(value: unknown, values: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach(item => collectPlatformValues(item, values))
    return values
  }
  if (!isRecord(value)) return values
  for (const [key, child] of Object.entries(value)) {
    if (key === 'platform' && typeof child === 'string') values.push(child)
    if (key === 'platforms' && Array.isArray(child)) {
      child.forEach(item => { if (typeof item === 'string') values.push(item) })
    }
    collectPlatformValues(child, values)
  }
  return values
}

function publicStrategyFields(strategy: unknown): Array<{ path: string; value: unknown }> {
  if (!isRecord(strategy)) return []
  const fields: Array<{ path: string; value: unknown }> = []
  const add = (path: string, value: unknown) => {
    if (normalizedText(value)) fields.push({ path, value })
  }

  ;['positioning', 'keyMessage', 'differentiation', 'targetAudienceRefined'].forEach(key => add(`strategy.${key}`, strategy[key]))
  ;['topHooks', 'ctaVariations', 'contentPillars'].forEach(key => add(`strategy.${key}`, strategy[key]))
  // Paid execution plans use nested audience, targeting, and creative-brief
  // objects. They remain customer-facing marketing decisions and must pass the
  // same audience/brand/avoid-word grounding as the organic strategy shape.
  ;['audience', 'targeting', 'creative_brief'].forEach(key => add(`strategy.${key}`, strategy[key]))

  const addObjectFields = (key: string, names: string[]) => {
    const collection = strategy[key]
    if (!Array.isArray(collection)) return
    collection.forEach((item, index) => {
      if (!isRecord(item)) return
      names.forEach(name => add(`strategy.${key}[${index}].${name}`, item[name]))
    })
  }

  addObjectFields('audienceSegmentsDetailed', ['segment', 'pain', 'desiredOutcome', 'objection', 'message', 'cta'])
  addObjectFields('contentAnglesDetailed', ['title', 'hook', 'pain', 'desiredOutcome', 'objection', 'cta'])
  addObjectFields('funnelStages', ['userMindset', 'message', 'cta'])
  addObjectFields('weeklyExecutionPlan', ['objective', 'keyMessage', 'cta'])
  add('strategy.offerCTAStrategy', strategy.offerCTAStrategy)
  return fields
}

function ageRange(value: unknown): { min: number; max: number } | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[–—]/g, '-').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  const match = normalized.match(/\b(\d{1,2})\s*(?:-|to|إلى)\s*(\d{1,2})\b/i)
  if (!match) return null
  const min = Number(match[1])
  const max = Number(match[2])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null
  return { min, max }
}

function finding(code: string, severity: MarketingQualitySeverity, path: string, message: string): MarketingQualityFinding {
  return { code, severity, path, message }
}

function buildReport(
  blockers: MarketingQualityFinding[],
  warnings: MarketingQualityFinding[],
  checkedAt?: string,
): MarketingQualityGateReport {
  const score = Math.max(0, 100 - blockers.length * 30 - warnings.length * 7)
  return {
    schemaVersion: MARKETING_QUALITY_GATE_VERSION,
    status: blockers.length > 0 ? 'blocked' : 'passed',
    score,
    blockers,
    warnings,
    checkedAt: checkedAt ?? new Date().toISOString(),
  }
}

export function reviewBrandTruthConsistency(
  brand: MarketingBrandProfile | null | undefined,
  checkedAt?: string,
): MarketingQualityGateReport {
  const blockers: MarketingQualityFinding[] = []
  const warnings: MarketingQualityFinding[] = []
  const profile = brand ?? {}
  const businessText = normalizedText([
    profile.brandName,
    profile.description,
    profile.primaryOffer,
    profile.targetAudience,
    profile.uniqueAdvantages,
  ])
  const industry = normalizedText(profile.industry)

  const narrativeAge = ageRange(profile.targetAudience)
  const structuredAge = ageRange(profile.audienceAge)
  if (narrativeAge && structuredAge && (
    narrativeAge.min !== structuredAge.min || narrativeAge.max !== structuredAge.max
  )) {
    blockers.push(finding(
      'brand_age_range_conflict',
      'blocker',
      'brand.audienceAge',
      `Structured audience age ${structuredAge.min}-${structuredAge.max} conflicts with ${narrativeAge.min}-${narrativeAge.max} in the audience description.`,
    ))
  }

  for (const signature of DOMAIN_SIGNATURES) {
    if (!signature.business.test(businessText)) continue
    if (!industry) break
    if (!signature.industry.test(industry)) {
      warnings.push(finding(
        'brand_industry_too_broad_or_misaligned',
        'warning',
        'brand.industry',
        `The saved industry does not explicitly match the ${signature.id} business described in Brand Brain. Confirm a more precise category.`,
      ))
    }
    break
  }

  const competitors = Array.isArray(profile.competitors) ? profile.competitors : []
  competitors.forEach((competitor, index) => {
    if (typeof competitor === 'string' && GENERIC_COMPETITOR_RE.test(competitor.trim())) {
      warnings.push(finding(
        'generic_competitor_category',
        'warning',
        `brand.competitors[${index}]`,
        'This looks like a competitor category, not a named competitor. Add a real business name or remove it.',
      ))
    }
  })

  if (!Array.isArray(profile.verifiedProof) || profile.verifiedProof.length === 0) {
    warnings.push(finding(
      'verified_proof_missing',
      'warning',
      'brand.verifiedProof',
      'No verified proof is saved. Strategy may use factual education and proof-collection tasks, but not testimonials or performance claims.',
    ))
  }

  return buildReport(blockers, warnings, checkedAt)
}

export function reviewStrategyGrounding(input: StrategyQualityInput): MarketingQualityGateReport {
  const brandReport = reviewBrandTruthConsistency(input.brand, input.checkedAt)
  const blockers = [...brandReport.blockers]
  const warnings = [...brandReport.warnings]
  const strategy = input.strategy

  if (!isRecord(strategy) || Object.keys(strategy).length === 0) {
    blockers.push(finding('strategy_missing', 'blocker', 'strategy', 'No strategy object was available for review.'))
    return buildReport(blockers, warnings, input.checkedAt)
  }

  const brandText = normalizedText([
    input.brand?.brandName,
    input.brand?.industry,
    input.brand?.description,
    input.brand?.primaryOffer,
    input.brand?.targetAudience,
    input.brand?.audiencePainPoints,
    input.brand?.audienceDesires,
    input.brand?.uniqueAdvantages,
    input.brand?.businessGoal,
    input.brand?.conversionDestination,
  ])
  const operationsProduct = OPERATIONS_PRODUCT_RE.test(brandText)
  const publicFields = publicStrategyFields(strategy)

  if (!operationsProduct) {
    publicFields.forEach(({ path, value }) => {
      const text = normalizedText(value)
      const matches = INTERNAL_WORKFLOW_PATTERNS.filter(pattern => pattern.re.test(text))
      if (matches.length > 0) {
        blockers.push(finding(
          'customer_copy_drifted_to_internal_operations',
          'blocker',
          path,
          `Customer-facing strategy contains internal workflow language (${matches.map(match => match.label).join(', ')}).`,
        ))
      }
    })
  }

  const strategyPublicText = publicFields.map(field => normalizedText(field.value)).join(' ')
  for (const audienceClaim of AUDIENCE_CLAIMS) {
    if (audienceClaim.re.test(strategyPublicText) && !audienceClaim.re.test(brandText)) {
      blockers.push(finding(
        'ungrounded_audience_expansion',
        'blocker',
        'strategy.audience',
        `The strategy adds the audience segment "${audienceClaim.code}" without support in Brand Brain.`,
      ))
    }
  }

  const allowedPlatforms = new Set((input.allowedPlatforms ?? input.brand?.topPlatforms ?? []).map(normalizePlatform))
  const strategyPlatforms = Array.from(new Set(collectPlatformValues(strategy).map(normalizePlatform)))
  if (allowedPlatforms.size > 0) {
    const unsupportedPlatforms = strategyPlatforms.filter(platform => (
      !allowedPlatforms.has(platform) &&
      !(allowedPlatforms.has('META') && ['FACEBOOK', 'INSTAGRAM'].includes(platform))
    ))
    unsupportedPlatforms.forEach(platform => blockers.push(finding(
      'platform_outside_reviewed_scope',
      'blocker',
      'strategy.platforms',
      `${platform} was not included in the reviewed channel scope.`,
    )))
  }

  const brandTokens = tokens([
    input.brand?.industry,
    input.brand?.description,
    input.brand?.primaryOffer,
    input.brand?.targetAudience,
    input.brand?.audiencePainPoints,
    input.brand?.audienceDesires,
  ])
  const strategyTokens = tokens(strategyPublicText)
  if (brandTokens.size >= 3 && overlapCount(brandTokens, strategyTokens) < 2) {
    blockers.push(finding(
      'strategy_missing_brand_relevance',
      'blocker',
      'strategy',
      'The customer-facing strategy does not contain enough of the saved business, offer, or audience context.',
    ))
  }

  const avoidKeywords = (input.brand?.avoidKeywords ?? [])
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  for (const keyword of avoidKeywords) {
    if (strategyPublicText.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())) {
      blockers.push(finding(
        'forbidden_brand_language',
        'blocker',
        'strategy',
        `The strategy uses a Brand Brain avoid-word: "${keyword}".`,
      ))
    }
  }

  return buildReport(blockers, warnings, input.checkedAt)
}

export function isPersistedMarketingQualityGatePassed(value: unknown): boolean {
  return isRecord(value)
    && value.schemaVersion === MARKETING_QUALITY_GATE_VERSION
    && value.status === 'passed'
    && Array.isArray(value.blockers)
    && value.blockers.length === 0
}
