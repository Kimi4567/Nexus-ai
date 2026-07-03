/**
 * Strategy PR-2B1 — output normalization, validation, and server-authoritative
 * readiness derivation.
 *
 * Goals:
 *  - Never let a partial / malformed model response crash the strategy renderer.
 *  - Keep OLD saved campaigns (without the new fields) rendering exactly as before.
 *  - Make confidenceReport / missingData / competitorAnalysisComplete
 *    SERVER-AUTHORITATIVE: the model may propose them, but we overwrite them from
 *    getStrategyCapabilities() so the AI can never inflate confidence.
 *  - Strip fabricated performance numbers (CPL/CPA/ROAS/CTR/%/currency) and
 *    invented competitor names.
 *
 * Pure functions only — no network, no generation, no side effects.
 */

import type {
  StrategyOutput,
  ConfidenceReport,
  CapabilityConfidenceLevel,
  StrategyConfidenceLevel,
} from '@/lib/agents/strategist'
import type { StrategyCapabilities } from '@/lib/brandReadiness'

// ── small helpers ─────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const asArray = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Fields the renderer treats as arrays — coerced to [] when malformed. */
const ARRAY_FIELDS = [
  'channelMix', 'kpis', 'budgetBreakdown', 'contentPillars', 'launchPlan',
  'valueProps', 'executionChecklist', 'topHooks', 'ctaVariations',
  'channelStrategy', 'audienceSegments', 'contentAngles', 'weeklyPlan',
  'successMetrics', 'riskNotes', 'audienceSegmentsDetailed', 'funnelStages',
  'contentAnglesDetailed', 'weeklyExecutionPlan', 'readinessChecklist',
  'doNotDoYet', 'successMetricsDetailed', 'executionAssumptions',
  'assumptions', 'missingData',
] as const

/** Fields the renderer treats as objects — left as-is or dropped to undefined. */
const OBJECT_FIELDS = [
  'offerCTAStrategy', 'funnelStrategy', 'businessObjective', 'diagnosisDetails',
  'assetRequirements', 'adSetupPlan', 'confidenceReport', 'marketContext',
] as const

/**
 * Coerce an arbitrary (possibly partial / malformed / legacy) value into a safe
 * StrategyOutput. Preserves every legacy field untouched; only repairs the known
 * array/object fields so the renderer's `|| []` / `|| null` guards never hit a
 * wrong type. Never throws.
 */
export function normalizeStrategyOutput(raw: unknown): StrategyOutput {
  if (!isObj(raw)) {
    // Minimal safe shell — old/empty campaigns still render with hidden sections.
    return { campaignName: '', goal: '', positioning: '', targetAudienceRefined: '',
      channelMix: [], kpis: [], budgetBreakdown: [], contentPillars: [],
      launchPlan: [], estimatedResults: '', confidence: 0 } as StrategyOutput
  }

  const out: Record<string, unknown> = { ...raw }

  for (const f of ARRAY_FIELDS) {
    if (f in out && !Array.isArray(out[f])) out[f] = asArray(out[f])
  }
  for (const f of OBJECT_FIELDS) {
    if (f in out && out[f] !== undefined && !isObj(out[f])) out[f] = undefined
  }

  // marketContext, if present, is ALWAYS an assumption.
  if (isObj(out.marketContext)) {
    out.marketContext = { ...(out.marketContext as object), isAssumption: true }
  }

  return out as unknown as StrategyOutput
}

// ── unsupported performance numbers ─────────────────────────────────────────────

const NUM_TOKEN = String.raw`[\d٠-٩۰-۹][\d٠-٩۰-۹.,٬٫]*`

// Performance metrics that must never be fabricated (with an adjacent number).
const PERF_TOKEN = /\b(ROAS|CPL|CPA|CPM|CPC|CTR|conversion rate|click[- ]?through rate)\b/i
// e.g. "3.2 ROAS", "CPL $12", "CTR 4%", "conversion rate of 5%"
const PERF_WITH_NUMBER = new RegExp(
  String.raw`(${NUM_TOKEN}\s*(?:%|٪)?\s*(?:ROAS|CPL|CPA|CPM|CPC|CTR))|((?:ROAS|CPL|CPA|CPM|CPC|CTR|conversion rate|click[- ]?through rate)[^.\n]{0,20}?${NUM_TOKEN}\s*(?:%|٪)?)`,
  'gi',
)
// bare percentages like "30% conversion", "a 12% lift"
const PERCENT = new RegExp(String.raw`${NUM_TOKEN}\s*(?:%|٪)`, 'g')
// currency like "$5,000", "5000 USD", "AED 3,000"
const CURRENCY = new RegExp(
  String.raw`((?:\$|USD|AED|SAR|EUR|£|€|د\.إ|درهم|ريال)\s?${NUM_TOKEN})|(${NUM_TOKEN}\s?(?:USD|AED|SAR|EUR|درهم|ريال))`,
  'gi',
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
const norm = (s: string) => normalizeDigits(s)
  .replace(/[,\s٬]/g, '')
  .replace(/٫/g, '.')
  .toLowerCase()

/**
 * Return the list of unsupported performance/currency numbers found in `text`
 * that are NOT echoed from a user-provided value in `allowed`. Pure + testable.
 */
export function findUnsupportedPerfNumbers(text: string, allowed: string[] = []): string[] {
  if (!text || typeof text !== 'string') return []
  const allow = allowed.filter(Boolean).map(norm)
  const isAllowed = (m: string) => allow.some(a => a.includes(norm(m)) || norm(m).includes(a))
  const hits: string[] = []
  const push = (m: string) => { if (m && !isAllowed(m) && !hits.includes(m.trim())) hits.push(m.trim()) }

  for (const m of text.match(PERF_WITH_NUMBER) || []) push(m)
  // percentages and currency only count as violations when not echoed from input
  for (const m of text.match(PERCENT) || []) push(m)
  for (const m of text.match(CURRENCY) || []) push(m)
  return hits
}

/** Replace unsupported perf/currency numbers in `text` with a neutral marker. */
export function scrubUnsupportedNumbers(text: string, allowed: string[] = []): string {
  if (!text || typeof text !== 'string') return text
  const allow = allowed.filter(Boolean).map(norm)
  const keep = (m: string) => allow.some(a => a.includes(norm(m)) || norm(m).includes(a))
  const replace = (re: RegExp) => (txt: string) =>
    txt.replace(re, (m) => (keep(m) ? m : '—'))
  let t = text
  t = replace(PERF_WITH_NUMBER)(t)
  t = replace(PERCENT)(t)
  t = replace(CURRENCY)(t)
  return t
}

/** True if `text` mentions a performance metric token at all (number or not). */
export function mentionsPerfMetric(text: string): boolean {
  return typeof text === 'string' && PERF_TOKEN.test(text)
}

// ── invented competitors ────────────────────────────────────────────────────────

/**
 * Keep only competitor entries that reference an allowed (user-provided) name.
 * When `allowed` is empty, returns [] (competitor analysis is incomplete).
 */
export function filterCompetitors(list: unknown, allowed: string[] = []): string[] {
  const items = asArray<unknown>(list).filter((x): x is string => typeof x === 'string')
  if (!allowed.length) return []
  const allow = allowed.filter(Boolean).map(s => s.toLowerCase())
  return items.filter(item => allow.some(a => item.toLowerCase().includes(a)))
}

// ── server-authoritative readiness derivation ────────────────────────────────────

/** Map getStrategyCapabilities() → an authoritative ConfidenceReport. */
export function deriveConfidenceReport(caps: StrategyCapabilities): ConfidenceReport {
  const byCapability: Record<string, CapabilityConfidenceLevel> = {}
  for (const cap of Object.values(caps)) {
    byCapability[cap.id] = cap.confidence as CapabilityConfidenceLevel
  }
  let overall: StrategyConfidenceLevel
  if (!caps.contentStrategy.ready) overall = 'low'
  else if (caps.fullStrategy.ready) overall = 'high'
  else overall = 'medium'
  return { overall, byCapability }
}

/** Deduped union of every capability's missing readiness keys (stable keys). */
export function collectMissingKeys(caps: StrategyCapabilities): string[] {
  const set = new Set<string>()
  for (const cap of Object.values(caps)) {
    for (const k of cap.missingKeys) set.add(k)
  }
  return Array.from(set)
}

export interface ApplyReadinessOptions {
  hasHistoricalData: boolean
  allowedCompetitors?: string[]
  /** User-provided numbers that ARE allowed to appear (budget band, price point). */
  allowedNumbers?: string[]
}

/**
 * Make confidence / missing-data / competitor-completeness SERVER-AUTHORITATIVE
 * and apply anti-hallucination scrubbing. Mutates a normalized copy and returns it.
 * The model's own confidenceReport/missingData/competitorAnalysisComplete are
 * DISCARDED and replaced here.
 */
export function applyServerReadiness(
  input: StrategyOutput,
  caps: StrategyCapabilities,
  opts: ApplyReadinessOptions,
): StrategyOutput {
  const s = normalizeStrategyOutput(input)
  const allowedNumbers = opts.allowedNumbers ?? []

  // 1. Authoritative readiness (overwrite anything the model proposed).
  s.confidenceReport = deriveConfidenceReport(caps)
  s.missingData = collectMissingKeys(caps)
  s.competitorAnalysisComplete = caps.competitorAnalysis.ready

  // 2. No historical data → every KPI / metric is a hypothesis.
  if (!opts.hasHistoricalData) {
    s.kpis = asArray<any>(s.kpis).map(k => (isObj(k) ? { ...k, isHypothesis: true } : k))
    s.successMetricsDetailed = asArray<any>(s.successMetricsDetailed).map(
      m => (isObj(m) ? { ...m, isHypothesis: true } : m),
    )
  }

  // 3. marketContext is always an assumption.
  if (isObj(s.marketContext)) {
    s.marketContext = { ...(s.marketContext as any), isAssumption: true }
  }

  // 4. Scrub fabricated performance/currency numbers from advisory text fields.
  if (typeof s.estimatedResults === 'string') {
    s.estimatedResults = scrubUnsupportedNumbers(s.estimatedResults, allowedNumbers)
  }
  s.riskNotes = asArray<string>(s.riskNotes).map(n =>
    typeof n === 'string' ? scrubUnsupportedNumbers(n, allowedNumbers) : n,
  )
  if (isObj(s.adSetupPlan)) {
    const ap: Record<string, unknown> = { ...(s.adSetupPlan as object) }
    for (const k of Object.keys(ap)) {
      if (typeof ap[k] === 'string') ap[k] = scrubUnsupportedNumbers(ap[k] as string, allowedNumbers)
    }
    s.adSetupPlan = ap as any
  }

  return s
}
