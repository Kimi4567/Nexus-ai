/**
 * PR-I — Strategy KPI Truth Guard (deterministic post-process).
 *
 * The strategist marks KPIs `isHypothesis: true` when there is no connected
 * analytics baseline, but it still emits invented numeric targets ("Increase by
 * 20%"). NEXUS must never present unsupported performance numbers — even when
 * hypothesis-labeled. This guard runs AFTER the strategist and BEFORE persist,
 * stripping invented performance figures from KPI targets / success metrics /
 * estimated results and replacing them with honest directional wording.
 *
 * What counts as a performance number (scrubbed unless user/analytics-supported):
 *   percentages, currency, multipliers (2x), ROI/ROAS/CPL/CPA/CPM/CPC/CTR,
 *   "increase/improve/grow… by N", and engagement/reach counts ("20 leads",
 *   "50 sign-ups", "500 views", "1,000 impressions", "300 clicks", "200 visits",
 *   "100 followers", "50 downloads", shares/saves/comments/likes).
 * What is preserved: calendar timeframes (30 days, 90 days, 3 months, Q1) and
 *   any number the user actually provided (passed via `allowed`).
 *
 * Pure + framework-free for deterministic unit testing. No network, no I/O.
 */

const NUM_TOKEN = String.raw`[\d٠-٩۰-۹][\d٠-٩۰-۹.,٬٫]*`
const NUM_CAPTURE = /[\d٠-٩۰-۹][\d٠-٩۰-۹.,٬٫]*/
const NUM_GLOBAL = /[\d٠-٩۰-۹][\d٠-٩۰-۹.,٬٫]*/g

// Calendar/time durations are legitimate — never treat these as perf numbers.
const TIME_NUM = new RegExp(
  String.raw`${NUM_TOKEN}\s*(?:days?|weeks?|months?|years?|hours?|mins?|minutes?|quarters?|q[1-4]|يوم(?:ًا|ا)?|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|شهور|أشهر|اشهر|سنة|سنوات|ساعة|ساعات|دقيقة|دقائق|ربع|أرباع|ارباع)`,
  'gi',
)

const EN_DIRECTIONAL =
  String.raw`\b(?:increase|improve|grow|reduce|boost|raise|lower|drive|generate|reach|add|gain|cut|save|expand|build)\b`
const AR_DIRECTIONAL =
  String.raw`(?:زيادة|تحسين|نمو|خفض|رفع|تعزيز|توليد|تحفيز|وصول|توسيع|بناء|توفير|تقليل|جذب|تحقيق)`
const EN_PERFORMANCE_NOUNS =
  String.raw`\b(?:leads?|sales?|sign[\s-]?ups?|customers?|conversions?|subscribers?|followers?|clients?|orders?|deals?|bookings?|views?|impressions?|clicks?|visits?|visitors?|downloads?|installs?|shares?|saves?|comments?|likes?|reactions?|opens?|sessions?)\b`
const AR_PERFORMANCE_NOUNS =
  String.raw`(?:عملاء|عميل|مبيعات|طلبات|طلب|استفسارات|استفسار|حجوزات|حجز|تحويلات|تحويل|متابعين|مشاهدات|مشاهدة|انطباعات|نقرات|نقرة|زيارات|زيارة|تحميلات|تنزيلات|مشاركات|حفظ|تعليقات|إعجابات|اعجابات|تفاعلات|تفاعل|جلسات|إيرادات|ايرادات|حركة المرور|زيارات الموقع)`

// Performance-number patterns (the things that must be user/analytics-backed).
const PERF_PATTERNS: RegExp[] = [
  new RegExp(String.raw`${NUM_TOKEN}\s*(?:%|٪)`, 'gi'), // 20% / ٢٥٪
  new RegExp(String.raw`(?:\$|usd|aed|sar|eur|£|€|د\.إ|درهم|ريال)\s?${NUM_TOKEN}`, 'gi'), // $5,000 / AED 3000
  new RegExp(String.raw`${NUM_TOKEN}\s?(?:x|×)\b`, 'gi'), // 2x / 10×
  new RegExp(String.raw`\b(?:roi|roas|cpl|cpa|cpm|cpc|ctr)\b[^.\n]{0,12}?${NUM_TOKEN}`, 'gi'), // ROAS 3.2
  new RegExp(String.raw`${NUM_TOKEN}[^.\n]{0,12}?\b(?:roi|roas|cpl|cpa|cpm|cpc|ctr)\b`, 'gi'), // 3.2 ROAS
  new RegExp(String.raw`(?:${EN_DIRECTIONAL}|${AR_DIRECTIONAL})[^.\n]{0,24}?${NUM_TOKEN}`, 'gi'), // increase by 20 / زيادة بنسبة 20
  new RegExp(String.raw`${NUM_TOKEN}(?:[^.\n]{0,20}?)(?:${EN_PERFORMANCE_NOUNS}|${AR_PERFORMANCE_NOUNS})`, 'gi'), // 200 leads / ٢٠ حجز
  /\b(?:roi|roas|cpl|cpa|cpm|cpc|ctr)\b/gi, // bare perf acronyms — scrubbed only when the line already has an unsupported number (gate requires a digit)
]

const DIRECTIONAL_VERB = new RegExp(String.raw`(?:${EN_DIRECTIONAL}|${AR_DIRECTIONAL})`, 'i')
const PERFORMANCE_CONTEXT = new RegExp(
  String.raw`(?:\b(?:increase|improve|grow|growth|reduce|boost|raise|lower|drive|generate|reach|expand|cut|save|engagement|lead|leads|request|requests|inquir(?:y|ies)|conversion|conversions|sales|revenue|traffic|followers|views|impressions|clicks|visits|bookings|orders|roi|roas|return)\b|زيادة|تحسين|نمو|خفض|رفع|تعزيز|توليد|تحفيز|وصول|توسيع|تقليل|تفاعل|تفاعلات|عميل|عملاء|طلب|طلبات|استفسار|استفسارات|حجز|حجوزات|مبيعات|إيرادات|ايرادات|زيارات|مشاهدات|انطباعات|نقرات|متابعين|تحويلات|نسبة|معدل)`,
  'i',
)
const BASELINE_OR_VALIDATION_CONTEXT = new RegExp(
  String.raw`(?:\b(?:baseline|validate|validated|validation|review|measure|measurement|learn from data|define the target|first[-\s]?month data)\b|خط أساس|تحديد الهدف|تحديد خط|مراجعة|تحقق|اختبار|قياس|بيانات حقيقية|أول ٣٠|أول 30|أول شهر)`,
  'i',
)
const UNSUPPORTED_QUALITATIVE_SUCCESS = new RegExp(
  String.raw`(?:\b(?:increase|improve|grow|drive|generate|boost|raise|expand|build)\b[^.\n]{0,70}\b(?:leads?|requests?|demo(?:s)?|inquir(?:y|ies)|conversions?|sales|bookings?|engagement|awareness|traffic|views?|clicks?|visits?)\b|(?:زيادة|تحسين|نمو|رفع|تعزيز|توليد|تحفيز|جذب|تحقيق)[^.\n]{0,70}(?:طلبات|طلب|استفسارات|استفسار|حجوزات|حجز|تحويلات|تحويل|مبيعات|تفاعل|تفاعلات|وعي|زيارات|مشاهدات|نقرات))`,
  'i',
)
const UNSUPPORTED_MULTIPLIER_WORD = new RegExp(
  String.raw`(?:\b(?:double|triple|quadruple)\b|مضاعفة|ضعف|ضعفي|ثلاثة أضعاف)[^.\n]{0,60}?(?:requests?|leads?|sales|revenue|conversions?|engagement|traffic|followers?|views?|impressions?|clicks?|visits?|bookings?|orders?|inquir(?:y|ies)|طلبات|استفسارات|حجوزات|مبيعات|إيرادات|ايرادات|تحويلات|تفاعل|زيارات|مشاهدات|انطباعات|نقرات|متابعين)`,
  'i',
)

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
}

const normalizeDigits = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] ?? d)
const normNum = (s: string) => normalizeDigits(s)
  .replace(/[,\s٬]/g, '')
  .replace(/٫/g, '.')
  .toLowerCase()

export interface StrategyKpiGuardOptions {
  language?: string | null
}

function isArabicLanguage(language: string | null | undefined): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

const ARABIC_DIRECTIONAL_VERBS: Record<string, string> = {
  increase: 'زيادة',
  improve: 'تحسين',
  grow: 'نمو',
  reduce: 'خفض',
  boost: 'تعزيز',
  raise: 'رفع',
  lower: 'خفض',
  drive: 'تحفيز',
  generate: 'توليد',
  reach: 'وصول',
  expand: 'توسيع',
  build: 'بناء',
  cut: 'خفض',
  save: 'توفير',
  'زيادة': 'زيادة',
  'تحسين': 'تحسين',
  'نمو': 'نمو',
  'خفض': 'خفض',
  'رفع': 'رفع',
  'تعزيز': 'تعزيز',
  'توليد': 'توليد',
  'تحفيز': 'تحفيز',
  'وصول': 'وصول',
  'توسيع': 'توسيع',
  'بناء': 'بناء',
  'توفير': 'توفير',
  'تقليل': 'تقليل',
  'جذب': 'جذب',
  'تحقيق': 'تحقيق',
}

function fallbackKpiTarget(verb: string | undefined, options: StrategyKpiGuardOptions = {}): string {
  if (isArabicLanguage(options.language)) {
    const normalizedVerb = verb?.toLowerCase()
    const arabicVerb = normalizedVerb ? ARABIC_DIRECTIONAL_VERBS[normalizedVerb] : undefined
    const suffix = 'نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا'
    return arabicVerb ? `${arabicVerb} — ${suffix}` : suffix
  }

  if (verb) {
    const v = verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase()
    return v + ' — baseline needed (target to define after first 30 days)'
  }
  return 'Baseline needed — target to define after first 30 days'
}

/** Numbers (with $/AED prefixes too) the user explicitly provided — never scrub these. */
function buildAllowedNums(allowed: string[]): string[] {
  const out: string[] = []
  for (const a of allowed) {
    if (typeof a !== 'string') continue
    for (const m of a.match(NUM_GLOBAL) || []) {
      const n = normNum(m)
      if (n) out.push(n)
    }
  }
  return out
}

/** True if `text` contains a performance number that is NOT in `allowedNums`. */
function hasUnsupportedPerfNumber(text: string, allowedNums: string[]): boolean {
  if (typeof text !== 'string' || !text) return false
  // Remove calendar timeframes first so "within 30 days" never trips the guard.
  const stripped = text.replace(TIME_NUM, ' ')
  const performanceContext = PERFORMANCE_CONTEXT.test(stripped)
  for (const re of PERF_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(stripped)) !== null) {
      const numTok = (m[0].match(NUM_CAPTURE) || [''])[0]
      const n = normNum(numTok)
      if (!n) continue
      const supported = allowedNums.some((a) => a.includes(n) || n.includes(a))
      if (!supported || performanceContext) return true
    }
  }
  return false
}

function hasUnsupportedMultiplierWord(text: string): boolean {
  return typeof text === 'string' && UNSUPPORTED_MULTIPLIER_WORD.test(text)
}

function fallbackSuccessDefinition(options: StrategyKpiGuardOptions = {}): string {
  return isArabicLanguage(options.language)
    ? 'تحديد خط أساس للطلبات والتفاعل بعد أول ٣٠ يومًا من البيانات الحقيقية'
    : 'Define a baseline for qualified demand and engagement after the first 30 days of real data'
}

function fallbackDirectionalResult(options: StrategyKpiGuardOptions = {}): string {
  return isArabicLanguage(options.language)
    ? 'نتيجة اتجاهية قيد الاختبار — يلزم خط أساس وبيانات فعلية قبل تحديد أثر الأداء'
    : 'Directional outcome to validate — establish a baseline before stating performance impact'
}

function guardSuccessDefinition(
  text: unknown,
  allowed: string[] = [],
  options: StrategyKpiGuardOptions = {},
): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''
  const allowedNums = buildAllowedNums(allowed)
  const hasUnsupportedNumber = hasUnsupportedPerfNumber(text, allowedNums)
  const hasMultiplier = hasUnsupportedMultiplierWord(text)
  if (BASELINE_OR_VALIDATION_CONTEXT.test(text) && !hasUnsupportedNumber && !hasMultiplier) return text
  const unsupportedPerformance =
    hasUnsupportedNumber ||
    hasMultiplier ||
    UNSUPPORTED_QUALITATIVE_SUCCESS.test(text)

  return unsupportedPerformance ? fallbackSuccessDefinition(options) : text
}

/**
 * Rewrite an unsupported KPI target into honest directional wording.
 * Keeps the directional intent (Increase/Improve/…) when present.
 */
export function guardKpiTarget(
  target: unknown,
  allowed: string[] = [],
  options: StrategyKpiGuardOptions = {},
): string {
  if (typeof target !== 'string' || !target.trim()) return typeof target === 'string' ? target : ''
  const allowedNums = buildAllowedNums(allowed)
  if (!hasUnsupportedPerfNumber(target, allowedNums) && !hasUnsupportedMultiplierWord(target)) return target
  const verb = (target.match(DIRECTIONAL_VERB) || [])[0]
  return fallbackKpiTarget(verb, options)
}

/** Scrub unsupported performance numbers from a free-text line (keeps timeframes). */
export function guardResultText(
  text: unknown,
  allowed: string[] = [],
  options: StrategyKpiGuardOptions = {},
): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''
  const allowedNums = buildAllowedNums(allowed)
  const hasMultiplier = hasUnsupportedMultiplierWord(text)
  const hasQualitativePerformanceClaim = UNSUPPORTED_QUALITATIVE_SUCCESS.test(text)
  const hasUnsupportedNumber = hasUnsupportedPerfNumber(text, allowedNums)
  if (BASELINE_OR_VALIDATION_CONTEXT.test(text) && !hasUnsupportedNumber && !hasMultiplier) return text
  if (!hasUnsupportedNumber && !hasMultiplier && !hasQualitativePerformanceClaim) return text
  if (!hasUnsupportedNumber && !hasMultiplier && hasQualitativePerformanceClaim) {
    return fallbackDirectionalResult(options)
  }
  // Protect calendar timeframes with a non-digit sentinel so the perf scrub can't
  // eat "30 days"/"Q1" — the sentinel has no digit, so no perf pattern matches it.
  const SENTINEL = '␟'
  const times: string[] = []
  let t = text.replace(TIME_NUM, (m) => {
    times.push(m)
    return SENTINEL
  })
  for (const re of PERF_PATTERNS) {
    t = t.replace(re, (m) => {
      const n = normNum((m.match(NUM_CAPTURE) || [''])[0])
      return n && allowedNums.some((a) => a.includes(n) || n.includes(a)) ? m : '—'
    })
  }
  if (hasMultiplier) {
    t = t.replace(
      UNSUPPORTED_MULTIPLIER_WORD,
      isArabicLanguage(options.language)
        ? 'هدف أداء يحتاج إلى خط أساس'
        : 'baseline-needed performance target',
    )
  }
  // Restore protected timeframes in order.
  let ti = 0
  t = t.replace(new RegExp(SENTINEL, 'g'), () => times[ti++] ?? '')
  return t
    .replace(/\b(?:of|by|to|around|about|up to)\s+—/gi, '')
    .replace(/(?:بنسبة|بمعدل|نسبة)\s+—/g, '—')
    .replace(/—(?:\s+—)+/g, '—')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

/** PR-I — normalize generation-time strategy intent with safe defaults (Organic / 90 days). */
export function normalizeStrategyIntent(
  rawType: unknown,
  rawDuration: unknown,
): { strategyType: 'organic' | 'paid' | 'full'; strategyDuration: '30' | '90' | '180' | 'custom' } {
  const strategyType = rawType === 'paid' || rawType === 'full' ? rawType : 'organic'
  const strategyDuration =
    rawDuration === '30' || rawDuration === '90' || rawDuration === '180' || rawDuration === 'custom'
      ? rawDuration
      : '90'
  return { strategyType, strategyDuration }
}

type KpiLike = { metric?: string; target?: string; timeframe?: string; isHypothesis?: boolean; [k: string]: unknown }

type DecisionRuleLike = {
  signal?: string
  continueWhen?: string
  iterateWhen?: string
  stopWhen?: string
  nextAction?: string
  [k: string]: unknown
}

function guardKpiArray(list: unknown, allowed: string[], options: StrategyKpiGuardOptions): unknown {
  if (!Array.isArray(list)) return list
  return list.map((k) => {
    if (!k || typeof k !== 'object') return k
    const kpi = k as KpiLike
    if (typeof kpi.target !== 'string') return kpi
    const guarded = guardKpiTarget(kpi.target, allowed, options)
    if (guarded === kpi.target) return kpi
    // The number was unsupported → it is, by definition, a hypothesis.
    return { ...kpi, target: guarded, isHypothesis: true }
  })
}

function guardDecisionRuleArray(
  list: unknown,
  allowed: string[],
  options: StrategyKpiGuardOptions,
): unknown {
  if (!Array.isArray(list)) return list
  const arabic = isArabicLanguage(options.language)
  const fallbacks: Record<keyof Pick<DecisionRuleLike, 'signal' | 'continueWhen' | 'iterateWhen' | 'stopWhen' | 'nextAction'>, string> = {
    signal: arabic ? 'إشارة تشغيلية قابلة للقياس' : 'A measurable operating signal',
    continueWhen: arabic
      ? 'استمر عندما يتحسن المؤشر مقارنة بخط الأساس الموثق.'
      : 'Continue when the signal improves against the documented baseline.',
    iterateWhen: arabic
      ? 'عدّل متغيرًا واحدًا عندما تكون الإشارة غير حاسمة مقارنة بخط الأساس.'
      : 'Change one variable when the signal is inconclusive against the baseline.',
    stopWhen: arabic
      ? 'أوقف عندما تتراجع الإشارة أو لا يمكن التحقق منها.'
      : 'Stop when the signal declines or cannot be verified.',
    nextAction: arabic
      ? 'راجع الدليل وغيّر متغيرًا واحدًا ثم أعد القياس.'
      : 'Review the evidence, change one variable, and measure again.',
  }
  const fields = Object.keys(fallbacks) as Array<keyof typeof fallbacks>

  return list.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const rule = item as DecisionRuleLike
    const guarded: DecisionRuleLike = { ...rule }
    fields.forEach((field) => {
      const value = rule[field]
      if (typeof value !== 'string') return
      const cleaned = guardResultText(value, allowed, options)
      guarded[field] = cleaned === value ? value : fallbacks[field]
    })
    return guarded
  })
}

function guardRoadmapArray(
  list: unknown,
  allowed: string[],
  options: StrategyKpiGuardOptions,
): unknown {
  if (!Array.isArray(list)) return list
  const fallback = isArabicLanguage(options.language)
    ? 'انتقل بعد جمع خط أساس ودليل فعلي قابل للمقارنة يثبت اتجاه الإشارة.'
    : 'Advance after a baseline and comparable real evidence establish the signal direction.'

  return list.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const row = item as Record<string, unknown>
    if (typeof row.exitGate !== 'string') return row
    const guarded = guardResultText(row.exitGate, allowed, options)
    return guarded === row.exitGate ? row : { ...row, exitGate: fallback }
  })
}

function guardExperimentBacklog(
  list: unknown,
  allowed: string[],
  options: StrategyKpiGuardOptions,
): unknown {
  if (!Array.isArray(list)) return list
  const fallback = isArabicLanguage(options.language)
    ? 'اجمع عينة فعلية قابلة للمقارنة مع خط الأساس قبل اتخاذ قرار.'
    : 'Collect a real sample comparable with the baseline before making a decision.'

  return list.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const row = item as Record<string, unknown>
    if (typeof row.minimumEvidence !== 'string') return row
    const guarded = guardResultText(row.minimumEvidence, allowed, options)
    return guarded === row.minimumEvidence ? row : { ...row, minimumEvidence: fallback }
  })
}

function guardLearningGovernance(value: unknown, options: StrategyKpiGuardOptions): unknown {
  if (typeof value === 'string') {
    // A bilingual strategy can contain Arabic and English in the same value.
    // Apply both guards regardless of UI locale or model language metadata.
    return value
      .replace(/(?:التعلّم|التعلم|تعلّم|تعلم)\s+من\s+Brand\s*Brain/gi, 'اقتراح تحديثات على Brand Brain من بيانات موثقة ثم مراجعتها قبل الاعتماد')
      .replace(/تحديث\s+Brand\s*Brain\s+تلقائي(?:اً|ا)?/gi, 'اقتراح تحديث على Brand Brain يحتاج إلى مراجعة وموافقة')
      .replace(/(?:learn|learning)\s+from\s+Brand\s*Brain/gi, 'propose Brand Brain updates from verified data for review and approval')
      .replace(/auto(?:matically)?[-\s]?update\s+Brand\s*Brain/gi, 'propose a Brand Brain update for review and approval')
  }
  if (Array.isArray(value)) return value.map(item => guardLearningGovernance(item, options))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, guardLearningGovernance(item, options)]),
  )
}

/**
 * Guard a full strategy output object. Returns a new object with KPI targets,
 * success metrics, and estimated results cleaned of unsupported performance
 * numbers. Unknown shapes pass through untouched.
 *
 * @param allowed numbers the user/analytics actually provided (e.g. brief
 *   marketingBudget, pastAdResults). Empty by default → all invented numbers scrubbed.
 */
export function guardStrategyKpis<T extends Record<string, unknown>>(
  strategy: T,
  allowed: string[] = [],
  options: StrategyKpiGuardOptions = {},
): T {
  if (!strategy || typeof strategy !== 'object') return strategy
  const out: Record<string, unknown> = { ...strategy }
  if (out.strategy && typeof out.strategy === 'object' && !Array.isArray(out.strategy)) {
    out.strategy = guardStrategyKpis(out.strategy as Record<string, unknown>, allowed, options)
  }
  if (out.businessObjective && typeof out.businessObjective === 'object' && !Array.isArray(out.businessObjective)) {
    const businessObjective = out.businessObjective as Record<string, unknown>
    out.businessObjective = {
      ...businessObjective,
      successIn30Days: guardSuccessDefinition(businessObjective.successIn30Days, allowed, options),
    }
  }
  if ('kpis' in out) out.kpis = guardKpiArray(out.kpis, allowed, options)
  if ('successMetricsDetailed' in out) out.successMetricsDetailed = guardKpiArray(out.successMetricsDetailed, allowed, options)
  if ('decisionRules' in out) out.decisionRules = guardDecisionRuleArray(out.decisionRules, allowed, options)
  if ('roadmap30_60_90' in out) out.roadmap30_60_90 = guardRoadmapArray(out.roadmap30_60_90, allowed, options)
  if ('experimentBacklog' in out) out.experimentBacklog = guardExperimentBacklog(out.experimentBacklog, allowed, options)
  if (Array.isArray(out.successMetrics)) {
    out.successMetrics = (out.successMetrics as unknown[]).map((s) =>
      typeof s === 'string' ? guardResultText(s, allowed, options) : s,
    )
  }
  if (typeof out.estimatedResults === 'string') {
    out.estimatedResults = guardResultText(out.estimatedResults, allowed, options)
  }
  return guardLearningGovernance(out, options) as T
}
