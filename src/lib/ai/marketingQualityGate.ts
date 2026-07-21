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

import { hasUsableConversionDestination } from '@/lib/strategyBriefReadiness'

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
  pricePoint?: string | null
  visualStyle?: string | null
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
  requireAllReviewedPlatforms?: boolean
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

const OPERATIONS_PRODUCT_RE = /saas|software|platform|dashboard|workflow (?:software|tool|platform)|management system|operating (?:app|system|tool|platform)|operations? (?:app|system|tool|platform)|برنامج|منصة|تطبيق|نظام إدارة|أداة تشغيل/i

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
    // "property" alone is ordinary language in home services (for example
    // "confirm property details before cleaning"). Treat it as a real-estate
    // signature only when the surrounding phrase describes the property market.
    business: /real estate|brokerage|property (?:brokerage|sales?|purchase|listings?|agents?|investment|management)|properties (?:for sale|to buy|to purchase|listed)|عقارات|وساطة عقارية/i,
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
const UNSUPPORTED_QUALITY_SUPERLATIVE_RE = /\b(?:freshest|finest|premium|high[-\s]?quality|optimal|perfect|ultimate|unmatched|unrival(?:l)?ed)\b|(?:الأطزج|الأفضل|الأمثل|مثالي|مثالية|فاخر|فاخرة|عالي(?:ة)?\s+الجودة)/gi
const UNVERIFIED_DIRECT_RESPONSE_RE = /\b(?:shop(?:\s+now|\s+the\s+look)?|browse\s+(?:our|the)\s+collection|explore\s+(?:our|the)\s+collection|view\s+products?|add\s+to\s+cart|buy\s+now|order\s+now|sign\s+up|register|book|request\s+(?:a\s+)?demo|whatsapp)\b|(?:تسوّق|تسوق|اشتر\s+الآن|اطلب\s+الآن|تصفّح\s+(?:ال)?مجموعة|تصفح\s+(?:ال)?مجموعة|اكتشف\s+(?:ال)?مجموعة|أضف\s+إلى\s+السلة|سجّل|سجل|احجز|واتساب)/i
const UNSOURCED_CHANNEL_FACT_RE = /\b(?:high(?:est)?[-\s]?engagement|fastest[-\s]?growing|rapidly growing|popular among|best platform|leading platform|dominant platform|most effective platform|ideal\s+for|can\s+drive\s+(?:traffic|sales|conversions?))\b|(?:تفاعل\s+مرتفع|الأسرع\s+نمواً|ينمو\s+بسرعة|شائع\s+بين|أفضل\s+منصة|المنصة\s+الرائدة|الأكثر\s+فعالية|مثالي(?:ة)?\s+لـ?|يمكن(?:ها)?\s+زيادة\s+(?:الزيارات|المبيعات|التحويلات))/i
const HYPOTHESIS_MARKER_RE = /\b(?:hypothesis|assumption|to validate|test whether|planning assumption)\b|(?:فرضية|افتراض|للتحقق|نختبر\s+ما\s+إذا)/i

const UNSUPPORTED_OFFER_ASSURANCE_RULES: Array<{
  code: string
  output: RegExp
  evidence: RegExp
}> = [
  {
    code: 'quality_guarantee',
    output: /\b(?:guaranteed|assured)\s+quality\b|\bquality\s+(?:guarantee|assurance)\b|ضمان\s+(?:جودة|الخامات?|المنتج|الخدمة)|جودة\s+(?:مضمونة|مؤكدة)/i,
    evidence: /\b(?:guaranteed|assured)\s+quality\b|\bquality\s+(?:guarantee|assurance)\b|ضمان\s+(?:جودة|الخامات?|المنتج|الخدمة)|جودة\s+(?:مضمونة|مؤكدة)/i,
  },
  {
    code: 'product_quality_showcase',
    output: /\b(?:discover|learn\s+about|see|explore)\s+(?:the\s+)?quality\s+of\b|(?:تعر[ّ]?في|تعرفي|اكتشفي)\s+(?:على\s+)?جودة\s+/i,
    // Brand pains and desires are intentionally excluded from
    // approvedClaimText. A customer's concern about quality is not evidence
    // that the business has documented product-quality details to showcase.
    evidence: /\bquality\b|جودة/i,
  },
  {
    code: 'product_quality_trust',
    output: /\b(?:trust|confidence)\s+in\s+(?:the\s+)?(?:product|service)\s+quality\b|\b(?:product\s+)?quality\s+(?:customers?|you)\s+can\s+trust\b|(?:ال)?ثقة\s+في\s+جودة\s+(?:المنتج|الخدمة|الخامات?)|جودة\s+(?:يمكنك|يمكن|تستطيع)\s+الوثوق\s+بها/i,
    evidence: /\b(?:trusted|verified|proven)\s+(?:product\s+)?quality\b|\bquality\s+(?:customers?|you)\s+can\s+trust\b|جودة\s+(?:المنتج|الخدمة)\s+موثقة|جودة\s+(?:يمكنك|يمكن)\s+الوثوق\s+بها|ثقة\s+موثقة\s+في\s+جودة/i,
  },
  {
    code: 'shopping_experience_promise',
    output: /\b(?:easy|safe|secure|smooth|comfortable|organized|seamless|unforgettable|exceptional)(?:\s+and\s+(?:easy|safe|secure|smooth|comfortable|organized|seamless))*\s+(?:shopping|purchase|buying|checkout|ordering)\s+(?:experience|process|journey|flow)\b|تجربة\s+(?:شراء|تسو[ّ]?ق)\s+(?:آمنة(?:\s+ومريحة)?|سلسة|سهلة(?:\s+ومريحة)?|مريحة|منظمة|مميزة|استثنائية|لا\s+ت[ُ]?نسى)/i,
    evidence: /\b(?:easy|safe|secure|smooth|comfortable|organized|seamless|unforgettable|exceptional)(?:\s+and\s+(?:easy|safe|secure|smooth|comfortable|organized|seamless))*\s+(?:shopping|purchase|buying|checkout|ordering)\s+(?:experience|process|journey|flow)\b|تجربة\s+(?:شراء|تسو[ّ]?ق)\s+(?:آمنة(?:\s+ومريحة)?|سلسة|سهلة(?:\s+ومريحة)?|مريحة|منظمة|مميزة|استثنائية|لا\s+ت[ُ]?نسى)/i,
  },
  {
    code: 'precise_sizing_details',
    output: /\b(?:accurate|precise|verified|reliable)\s+(?:size|sizing)\s+(?:details|guide|information)\b|\b(?:detailed|verified)\s+size\s+guide\b|تفاصيل\s+(?:دقيقة|موثوقة)\s+للمقاسات|دليل\s+مقاسات\s+(?:دقيق|موثوق)/i,
    evidence: /\b(?:accurate|precise|verified|reliable)\s+(?:size|sizing)\s+(?:details|guide|information)\b|\b(?:detailed|verified)\s+size\s+guide\b|تفاصيل\s+(?:دقيقة|موثوقة)\s+للمقاسات|دليل\s+مقاسات\s+(?:دقيق|موثوق)/i,
  },
  {
    code: 'easy_sizing_choice',
    output: /\bchoose\s+(?:the\s+)?(?:right|correct)\s+size\s+(?:easily|with\s+ease|confidently)\b|اختار(?:ي)?\s+المقاس\s+(?:المناسب|الصحيح)\s+(?:بسهولة|بثقة)/i,
    evidence: /\bchoose\s+(?:the\s+)?(?:right|correct)\s+size\s+(?:easily|with\s+ease|confidently)\b|اختار(?:ي)?\s+المقاس\s+(?:المناسب|الصحيح)\s+(?:بسهولة|بثقة)/i,
  },
  {
    code: 'product_comfort_promise',
    output: /\b(?:(?:combine|combines|blends?)\s+)?(?:style|elegance)\s+(?:and|with)\s+comfort\b|(?:الأناقة\s+والراحة|(?:تجمع|يجمع)\s+بين\s+(?:الأناقة|التصميم)\s+والراحة)/i,
    evidence: /\b(?:(?:combine|combines|blends?)\s+)?(?:style|elegance)\s+(?:and|with)\s+comfort\b|(?:الأناقة\s+والراحة|(?:تجمع|يجمع)\s+بين\s+(?:الأناقة|التصميم)\s+والراحة)/i,
  },
  {
    code: 'unique_design_promise',
    output: /\b(?:unique|distinctive|exclusive)\s+designs?\b|تصاميم(?:\s+[\u0600-\u06ff]{2,30})?\s+(?:ال)?(?:فريدة|مميزة|حصرية)(?:\s+و(?:فريدة|مميزة|حصرية))*/i,
    evidence: /\b(?:unique|distinctive|exclusive)\s+designs?\b|تصاميم(?:\s+[\u0600-\u06ff]{2,30})?\s+(?:ال)?(?:فريدة|مميزة|حصرية)(?:\s+و(?:فريدة|مميزة|حصرية))*/i,
  },
  {
    code: 'without_compromise_promise',
    output: /\bwithout\s+compromising\s+on\s+(?:style|quality|comfort)\b|دون\s+(?:التنازل|مساومة)\s+عن\s+(?:الأناقة|الجودة|الراحة)/i,
    evidence: /\bwithout\s+compromising\s+on\s+(?:style|quality|comfort)\b|دون\s+(?:التنازل|مساومة)\s+عن\s+(?:الأناقة|الجودة|الراحة)/i,
  },
]

/**
 * Shared classifiers keep the deterministic output guard and the persistence
 * quality gate on the exact same policy. The gate still blocks an unlabelled
 * market claim; the output guard may only make its uncertainty explicit.
 */
export function hasUnsourcedChannelMarketClaim(value: string): boolean {
  return UNSOURCED_CHANNEL_FACT_RE.test(value)
}

export function hasChannelHypothesisMarker(value: string): boolean {
  return HYPOTHESIS_MARKER_RE.test(value)
}
const UNGROUNDED_CONTEXT_CLAIMS: Array<{ code: string; output: RegExp; evidence: RegExp }> = [
  {
    code: 'work_or_professional_use',
    output: /\b(?:style[-\s]?conscious professionals?|working women|workwear|office wear|for (?:the )?(?:office|work|meetings?)|meeting[-\s]?ready)\b|(?:محترفات|نساء\s+عاملات|ملابس\s+العمل|إطلالة\s+العمل|للعمل|للمكتب|للاجتماعات)/i,
    evidence: /\b(?:professional|work|workplace|office|meeting|workwear)\b|(?:العمل|المكتب|الاجتماعات|المهني|المحترفات)/i,
  },
  {
    code: 'cultural_or_heritage_attribute',
    output: /\b(?:culturally respectful|cultural values?|cultural fashion|heritage|traditional identity)\b|(?:يحترم\s+الثقافة|القيم\s+الثقافية|أزياء\s+ثقافية|التراث|الهوية\s+التقليدية)/i,
    evidence: /\b(?:culture|cultural|culturally|heritage|tradition|traditional)\b|(?:الثقافة|ثقافي|التراث|التقاليد|تقليدي)/i,
  },
  {
    code: 'collection_variety_or_every_occasion',
    output: /\b(?:(?:every|any|all) occasions?|varied collection|diverse collection|wide (?:range|collection|selection))\b|(?:لكل\s+المناسبات|كل\s+مناسبة|تشكيلة\s+متنوعة|مجموعة\s+متنوعة|تشكيلة\s+واسعة|مجموعة\s+واسعة)/i,
    // "Simple occasions" does not support the universal promise "every
    // occasion". Require the same unbounded fit/variety fact from Brand Brain.
    evidence: /\b(?:(?:every|any|all) occasions?|varied collection|diverse collection|wide (?:range|collection|selection))\b|(?:لكل\s+المناسبات|كل\s+مناسبة|تشكيلة\s+متنوعة|مجموعة\s+متنوعة|تشكيلة\s+واسعة|مجموعة\s+واسعة)/i,
  },
  {
    code: 'fabric_comfort_or_durability',
    // This is a material-claim gate, not a ban on the ordinary emotional idea
    // of comfort. The previous broad "comfort/الراحة" alternatives falsely
    // blocked home-fragrance and hospitality strategies that never claimed
    // anything about fabric or product durability.
    output: /\b(?:breathable|soft fabrics?|premium fabrics?|durable|long[-\s]?lasting)\b|(?:أقمشة\s+فاخرة|خامات\s+فاخرة|قماش\s+ناعم|متين|يدوم\s+طويلاً)/i,
    evidence: /\b(?:comfort|comfortable|fabric|material|breathable|durable|durability)\b|(?:الراحة|مريح|القماش|الخامة|متين|المتانة)/i,
  },
]

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

function normalizedDirectionIdentity(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\p{P}\p{S}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsAffirmedClaim(text: string, claim: string): boolean {
  let cursor = 0
  while (cursor < text.length) {
    const index = text.indexOf(claim, cursor)
    if (index < 0) return false
    const before = text.slice(Math.max(0, index - 48), index)
    if (!/(?:\b(?:avoid|never|not|no|without|do\s+not\s+use|must\s+not\s+use)\s+|(?:تجنب|تجنّب|لا\s+تستخدم|بدون|غير)\s*)$/i.test(before)) return true
    cursor = index + claim.length
  }
  return false
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
  // Brand Brain stores the parent YouTube channel, while the strategy output
  // contract intentionally renders its short-form format as "YouTube Shorts".
  // They are the same reviewed destination for grounding purposes; keeping two
  // canonical values made every YouTube strategy fail after a successful model
  // run even though no channel had drifted.
  if (normalized === 'YOUTUBE_SHORT' || normalized === 'YOUTUBE_SHORTS') return 'YOUTUBE'
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
  addObjectFields('channelMix', ['rationale'])
  addObjectFields('channelStrategy', ['rationale', 'role', 'reason'])
  addObjectFields('funnelStages', ['userMindset', 'message', 'cta'])
  addObjectFields('weeklyExecutionPlan', ['objective', 'keyMessage', 'cta'])
  add('strategy.offerCTAStrategy', strategy.offerCTAStrategy)
  return fields
}

interface AgeRange {
  min: number
  max: number
}

function ageRanges(value: unknown): AgeRange[] {
  if (typeof value !== 'string') return []
  const normalized = value.replace(/[–—]/g, '-').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  const matches = normalized.matchAll(/\b(\d{1,2})\s*(?:-|to|إلى)\s*(\d{1,2})\b/gi)
  const ranges = Array.from(matches, match => ({ min: Number(match[1]), max: Number(match[2]) }))
    .filter(range => Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max)
    .sort((left, right) => left.min - right.min || left.max - right.max)

  return ranges.reduce<AgeRange[]>((merged, range) => {
    const previous = merged.at(-1)
    if (!previous || range.min > previous.max + 1) {
      merged.push({ ...range })
    } else {
      previous.max = Math.max(previous.max, range.max)
    }
    return merged
  }, [])
}

function ageRangesCover(available: AgeRange[], requested: AgeRange[]): boolean {
  return requested.every(requestedRange => available.some(availableRange => (
    availableRange.min <= requestedRange.min && availableRange.max >= requestedRange.max
  )))
}

function formatAgeRanges(ranges: AgeRange[]): string {
  return ranges.map(range => `${range.min}-${range.max}`).join(', ')
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

  const narrativeAges = ageRanges(profile.targetAudience)
  const structuredAges = ageRanges(profile.audienceAge)
  // The narrative may intentionally focus on a subset of reviewed structured
  // bands. It is contradictory only when it expands beyond those saved bands.
  // Example: narrative 25-44 is covered by structured 25-34, 35-44, 45-54;
  // narrative 25-54 is not covered by structured 45-54.
  if (narrativeAges.length > 0 && structuredAges.length > 0 && !ageRangesCover(structuredAges, narrativeAges)) {
    blockers.push(finding(
      'brand_age_range_conflict',
      'blocker',
      'brand.audienceAge',
      `Structured audience age ${formatAgeRanges(structuredAges)} does not cover ${formatAgeRanges(narrativeAges)} in the audience description.`,
    ))
  }

  const matchingDomains = DOMAIN_SIGNATURES.filter(signature => signature.business.test(businessText))
  if (industry && matchingDomains.length > 0) {
    // A vertical SaaS product naturally contains both the customer's domain
    // (for example dental/clinic) and the product domain (software/platform).
    // The previous first-match loop treated whichever keyword appeared in the
    // DOMAIN_SIGNATURES order as authoritative and falsely blocked valid
    // profiles such as "clinic operations software" + "Software & Tech".
    // Accept the profile when the saved industry matches any strongly detected
    // domain; block only when it matches none of them.
    const industryMatchesDetectedDomain = matchingDomains.some(signature => signature.industry.test(industry))
    if (!industryMatchesDetectedDomain) {
      blockers.push(finding(
        'brand_industry_too_broad_or_misaligned',
        'blocker',
        'brand.industry',
        `The saved industry does not explicitly match the ${matchingDomains.map(signature => signature.id).join(' or ')} business described in Brand Brain. Confirm a more precise category.`,
      ))
    }
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
    input.brand?.pricePoint,
    input.brand?.visualStyle,
    input.brand?.toneKeywords,
    input.brand?.writingStyle,
    input.brand?.businessGoal,
    input.brand?.conversionDestination,
    input.brand?.verifiedProof,
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
  publicFields
    .filter(field => field.path.includes('channelMix') || field.path.includes('channelStrategy'))
    .forEach(({ path, value }) => {
      const channelClaim = normalizedText(value)
      if (hasUnsourcedChannelMarketClaim(channelClaim) && !hasChannelHypothesisMarker(channelClaim)) {
        blockers.push(finding(
          'unsourced_channel_market_claim',
          'blocker',
          path,
          'Channel rationale states a market or engagement claim as fact. Cite reviewed evidence or label it as a hypothesis to validate.',
        ))
      }
    })
  const approvedClaimText = normalizedText([
    input.brand?.brandName,
    input.brand?.description,
    input.brand?.primaryOffer,
    input.brand?.uniqueAdvantages,
    input.brand?.pricePoint,
    input.brand?.visualStyle,
    input.brand?.toneKeywords,
    input.brand?.writingStyle,
    input.brand?.verifiedProof,
  ]).toLocaleLowerCase()
  publicFields.forEach(({ path, value }) => {
    const text = normalizedText(value)
    UNSUPPORTED_QUALITY_SUPERLATIVE_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = UNSUPPORTED_QUALITY_SUPERLATIVE_RE.exec(text)) !== null) {
      const claim = match[0].toLocaleLowerCase()
      if (containsAffirmedClaim(approvedClaimText, claim)) continue
      blockers.push(finding(
        'unsupported_quality_superlative',
        'blocker',
        path,
        `The strategy uses the unverified quality claim "${match[0]}". Use factual Brand Brain wording or add verified proof.`,
      ))
    }
  })
  for (const assurance of UNSUPPORTED_OFFER_ASSURANCE_RULES) {
    if (assurance.output.test(strategyPublicText) && !assurance.evidence.test(approvedClaimText)) {
      blockers.push(finding(
        'unsupported_offer_assurance',
        'blocker',
        'strategy.customerFacingClaims',
        `The strategy adds the unverified commercial assurance "${assurance.code}". Use documented Brand Brain wording or turn it into a proof/review task.`,
      ))
    }
  }
  const contentDirections = Array.isArray(strategy.contentAnglesDetailed)
    ? strategy.contentAnglesDetailed.filter(isRecord)
    : []
  const placeholderDirectionRe = /\bcontent\s+direction\s+hypothesis\b|\bwhich\s+message\s+should\s+direction\b|فرضية\s+اتجاه\s+المحتوى|ما\s+الرسالة\s+التي\s+يجب\s+التحقق\s+منها\s+في\s+اتجاه\s+المحتوى/i
  const seenDirectionTitles = new Set<string>()
  const seenDirectionHooks = new Set<string>()
  contentDirections.forEach((direction, index) => {
    const directionText = normalizedText([direction.title, direction.hook])
    if (placeholderDirectionRe.test(directionText)) {
      blockers.push(finding(
        'placeholder_content_direction',
        'blocker',
        `strategy.contentAnglesDetailed[${index}]`,
        'A quoted content direction is only a fallback placeholder. Return a distinct, useful marketing direction or refund the run instead of counting filler as delivered work.',
      ))
    }
    const title = normalizedDirectionIdentity(direction.title)
    const hook = normalizedDirectionIdentity(direction.hook)
    const duplicateTitle = Boolean(title && seenDirectionTitles.has(title))
    const duplicateHook = Boolean(hook && seenDirectionHooks.has(hook))
    if (duplicateTitle || duplicateHook) {
      blockers.push(finding(
        'duplicate_content_direction',
        'blocker',
        `strategy.contentAnglesDetailed[${index}]`,
        'A quoted content direction repeats an earlier title or hook. Replace it with a distinct, reviewable direction before persistence.',
      ))
    }
    if (title) seenDirectionTitles.add(title)
    if (hook) seenDirectionHooks.add(hook)
  })
  if (!hasUsableConversionDestination(input.brand?.conversionDestination, input.goal) && UNVERIFIED_DIRECT_RESPONSE_RE.test(strategyPublicText)) {
    blockers.push(finding(
      'conversion_cta_without_destination',
      'blocker',
      'strategy.cta',
      'The strategy uses a direct-response CTA without a verified store, booking, contact, or conversion destination.',
    ))
  }
  for (const contextClaim of UNGROUNDED_CONTEXT_CLAIMS) {
    if (contextClaim.output.test(strategyPublicText) && !contextClaim.evidence.test(brandText)) {
      blockers.push(finding(
        'ungrounded_brand_context',
        'blocker',
        'strategy.customerFacingClaims',
        `The strategy adds the unsupported brand context "${contextClaim.code}" without Brand Brain evidence.`,
      ))
    }
  }
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
    const missingReviewedPlatforms = input.requireAllReviewedPlatforms
      ? Array.from(allowedPlatforms).filter(platform => {
          if (platform === 'META') {
            return !strategyPlatforms.some(strategyPlatform => ['META', 'FACEBOOK', 'INSTAGRAM'].includes(strategyPlatform))
          }
          return !strategyPlatforms.includes(platform)
        })
      : []
    missingReviewedPlatforms.forEach(platform => blockers.push(finding(
      'reviewed_platform_missing_from_strategy',
      'blocker',
      'strategy.platforms',
      `${platform} is in the reviewed campaign scope but has no role, direction, or execution plan in the strategy.`,
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
