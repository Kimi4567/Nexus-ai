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
 *   "increase/improve/grow… by N", and counts ("20 leads", "50 sign-ups").
 * What is preserved: calendar timeframes (30 days, 90 days, 3 months, Q1) and
 *   any number the user actually provided (passed via `allowed`).
 *
 * Pure + framework-free for deterministic unit testing. No network, no I/O.
 */

// Calendar/time durations are legitimate — never treat these as perf numbers.
const TIME_NUM = /\b\d[\d.,]*\s*(?:days?|weeks?|months?|years?|hours?|mins?|minutes?|quarters?|q[1-4])\b/gi

// Performance-number patterns (the things that must be user/analytics-backed).
const PERF_PATTERNS: RegExp[] = [
  /[\d.,]+\s*%/gi, // 20%
  /(?:\$|usd|aed|sar|eur|£|€)\s?[\d.,]+/gi, // $5,000 / AED 3000
  /[\d.,]+\s?(?:x|×)\b/gi, // 2x / 10×
  /\b(?:roi|roas|cpl|cpa|cpm|cpc|ctr)\b[^.\n]{0,12}?[\d.,]+/gi, // ROAS 3.2
  /[\d.,]+[^.\n]{0,12}?\b(?:roi|roas|cpl|cpa|cpm|cpc|ctr)\b/gi, // 3.2 ROAS
  /\b(?:increase|improve|grow|reduce|boost|raise|lower|drive|generate|reach|add|gain|cut|save)\b[^.\n]{0,16}?[\d.,]+/gi, // increase by 20
  /[\d.,]+(?:[^.\n]{0,15}?)\b(?:leads?|sales?|sign[\s-]?ups?|customers?|conversions?|subscribers?|followers?|clients?|orders?|deals?|bookings?)\b/gi, // 200 new leads / 50 sign-ups
  /\b(?:roi|roas|cpl|cpa|cpm|cpc|ctr)\b/gi, // bare perf acronyms — scrubbed only when the line already has an unsupported number (gate requires a digit)
]

const DIRECTIONAL_VERB = /\b(increase|improve|grow|reduce|boost|raise|lower|drive|generate|reach|expand|build|cut|save)\b/i

const normNum = (s: string) => s.replace(/[\s,]/g, '').toLowerCase()

/** Numbers (with $/AED prefixes too) the user explicitly provided — never scrub these. */
function buildAllowedNums(allowed: string[]): string[] {
  const out: string[] = []
  for (const a of allowed) {
    if (typeof a !== 'string') continue
    for (const m of a.match(/[\d.,]+/g) || []) {
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
  for (const re of PERF_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(stripped)) !== null) {
      const numTok = (m[0].match(/[\d.,]+/) || [''])[0]
      const n = normNum(numTok)
      if (!n) continue
      const supported = allowedNums.some((a) => a.includes(n) || n.includes(a))
      if (!supported) return true
    }
  }
  return false
}

/**
 * Rewrite an unsupported KPI target into honest directional wording.
 * Keeps the directional intent (Increase/Improve/…) when present.
 */
export function guardKpiTarget(target: unknown, allowed: string[] = []): string {
  if (typeof target !== 'string' || !target.trim()) return typeof target === 'string' ? target : ''
  const allowedNums = buildAllowedNums(allowed)
  if (!hasUnsupportedPerfNumber(target, allowedNums)) return target
  const verb = (target.match(DIRECTIONAL_VERB) || [])[0]
  if (verb) {
    const v = verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase()
    return v + ' — baseline needed (target to define after first 30 days)'
  }
  return 'Baseline needed — target to define after first 30 days'
}

/** Scrub unsupported performance numbers from a free-text line (keeps timeframes). */
export function guardResultText(text: unknown, allowed: string[] = []): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''
  const allowedNums = buildAllowedNums(allowed)
  if (!hasUnsupportedPerfNumber(text, allowedNums)) return text
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
      const n = normNum((m.match(/[\d.,]+/) || [''])[0])
      return n && allowedNums.some((a) => a.includes(n) || n.includes(a)) ? m : '—'
    })
  }
  // Restore protected timeframes in order.
  let ti = 0
  t = t.replace(new RegExp(SENTINEL, 'g'), () => times[ti++] ?? '')
  return t
    .replace(/\b(?:of|by|to|around|about|up to)\s+—/gi, '')
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

function guardKpiArray(list: unknown, allowed: string[]): unknown {
  if (!Array.isArray(list)) return list
  return list.map((k) => {
    if (!k || typeof k !== 'object') return k
    const kpi = k as KpiLike
    if (typeof kpi.target !== 'string') return kpi
    const guarded = guardKpiTarget(kpi.target, allowed)
    if (guarded === kpi.target) return kpi
    // The number was unsupported → it is, by definition, a hypothesis.
    return { ...kpi, target: guarded, isHypothesis: true }
  })
}

/**
 * Guard a full strategy output object. Returns a new object with KPI targets,
 * success metrics, and estimated results cleaned of unsupported performance
 * numbers. Unknown shapes pass through untouched.
 *
 * @param allowed numbers the user/analytics actually provided (e.g. brief
 *   marketingBudget, pastAdResults). Empty by default → all invented numbers scrubbed.
 */
export function guardStrategyKpis<T extends Record<string, unknown>>(strategy: T, allowed: string[] = []): T {
  if (!strategy || typeof strategy !== 'object') return strategy
  const out: Record<string, unknown> = { ...strategy }
  if ('kpis' in out) out.kpis = guardKpiArray(out.kpis, allowed)
  if ('successMetricsDetailed' in out) out.successMetricsDetailed = guardKpiArray(out.successMetricsDetailed, allowed)
  if (Array.isArray(out.successMetrics)) {
    out.successMetrics = (out.successMetrics as unknown[]).map((s) =>
      typeof s === 'string' ? guardResultText(s, allowed) : s,
    )
  }
  if (typeof out.estimatedResults === 'string') out.estimatedResults = guardResultText(out.estimatedResults, allowed)
  return out as T
}
