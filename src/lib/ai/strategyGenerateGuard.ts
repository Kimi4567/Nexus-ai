/**
 * PR-C — safety guard for the onboarding strategy generator (/api/strategy/generate).
 *
 * That endpoint is a direct model call whose prompt previously asked for a KPI
 * "Specific target" and a paid budget section, with NO anti-hallucination
 * protection (unlike the run-full / orchestrator path which uses
 * applyServerReadiness + scrubUnsupportedNumbers). This module provides:
 *
 *   1. buildStrategyPrompt(): a pure, testable prompt builder whose JSON-schema
 *      hints are English/neutral (no hard-coded Arabic that leaks into EN output)
 *      and that forbids invented KPI numbers / budgets / readiness.
 *   2. guardGeneratedStrategy(): a pure, defence-in-depth post-processor that
 *      neutralizes fabricated numbers the model may still emit — reusing the
 *      shared scrubUnsupportedNumbers (%, currency, ROAS/CPL/CPA/CPM/CPC/CTR) and
 *      adding two local patterns NOT covered by it: multiplier-ROI ("4x") and
 *      bare outcome counts ("100 leads"). User-provided numbers stay (allowlist).
 *
 * Pure functions only — no network, no generation, no side effects. Does NOT
 * touch run-full, the orchestrator, the strategist agent, or strategyNormalize
 * (it only imports the existing scrubber from it).
 */

import { scrubUnsupportedNumbers } from '@/lib/strategyNormalize'

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const asArray = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const normNum = (s: string) => s.replace(/[\s,]/g, '').toLowerCase()

// Extra invented-metric patterns NOT covered by scrubUnsupportedNumbers:
// multiplier ROI ("4x", "10x") and bare outcome counts ("100 leads", "50 sales").
const MULTIPLIER = /\b\d[\d.,]*\s*x\b/gi
const OUTCOME_COUNT =
  /\b\d[\d.,]*\s*(?:leads?|sales|customers?|clients?|signups?|sign-?ups?|subscribers?|conversions?|followers?|downloads?|installs?|orders?|purchases?|deals?)\b/gi

/** Build the allowlist of numbers the user actually provided (so we never scrub them). */
export function extractAllowedNumbers(
  ...vals: Array<string | number | null | undefined>
): string[] {
  return vals.flatMap((v) => {
    if (v === null || v === undefined) return []
    const s = String(v)
    return /\d/.test(s) ? [s] : []
  })
}

/**
 * Neutralize fabricated numbers in a free-text string. Reuses the shared scrubber
 * for %/currency/ROAS-family, then strips multiplier-ROI and bare outcome counts.
 * Any number echoed from `allowed` (user-provided) is preserved.
 */
export function scrubStrategyText(text: unknown, allowed: string[] = []): string {
  if (typeof text !== 'string') return ''
  if (!text) return text
  const allowSet = allowed.filter(Boolean).map(normNum)
  const keep = (m: string) =>
    allowSet.some((a) => a.includes(normNum(m)) || normNum(m).includes(a))
  let t = scrubUnsupportedNumbers(text, allowed) // %, currency, ROAS/CPL/CPA/CPM/CPC/CTR
  t = t.replace(MULTIPLIER, (m) => (keep(m) ? m : '—'))
  t = t.replace(OUTCOME_COUNT, (m) => (keep(m) ? m : '—'))
  return t
}

/**
 * Defence-in-depth: walk the known free-text fields of the onboarding strategy
 * shape and neutralize any fabricated numbers. Structural numbers (week indices,
 * posting frequency, pillar weight `percentage`) are left untouched. Pure — never
 * throws; unknown shapes are returned as-is.
 */
export function guardGeneratedStrategy(strategy: unknown, allowed: string[] = []): unknown {
  if (!isObj(strategy)) return strategy
  const scrub = (t: unknown) => scrubStrategyText(t, allowed)
  const s: Record<string, unknown> = { ...strategy }

  if (typeof s.summary === 'string') s.summary = scrub(s.summary)

  s.themes = asArray<Record<string, unknown>>(s.themes).map((th) =>
    isObj(th)
      ? { ...th, focus: scrub(th.focus), contentIdeas: asArray(th.contentIdeas).map(scrub) }
      : th,
  )

  s.pillars = asArray<Record<string, unknown>>(s.pillars).map((p) =>
    isObj(p)
      ? { ...p, description: scrub(p.description), examples: asArray(p.examples).map(scrub) }
      : p,
  )

  // KPIs must be qualitative — scrub any fabricated number from target/how.
  s.kpis = asArray<Record<string, unknown>>(s.kpis).map((k) =>
    isObj(k) ? { ...k, target: scrub(k.target), how: scrub(k.how) } : k,
  )

  s.tactics = asArray<Record<string, unknown>>(s.tactics).map((t) =>
    isObj(t) ? { ...t, tip: scrub(t.tip) } : t,
  )

  s.quickWins = asArray(s.quickWins).map(scrub)

  if (isObj(s.budget)) {
    s.budget = {
      ...(s.budget as Record<string, unknown>),
      organic: scrub((s.budget as Record<string, unknown>).organic),
      paid: scrub((s.budget as Record<string, unknown>).paid),
    }
  }

  // Deterministic, conservative paid-safety guarantee (never implies spend/approval).
  s.paidSafety = {
    spend: 'requires_explicit_approval',
    budget: allowed.length > 0 ? allowed[0] : 'requires_confirmation',
    platformReadiness: 'needs_verification',
    note: 'Paid planning only — no spend without explicit approval.',
  }

  return s
}

export interface BuildStrategyPromptOpts {
  days: number
  weeks: number
  goal: string
  platform?: string
  /** User-provided budget level/number, or undefined. */
  budget?: string
  /** Pre-rendered brand context block (may be empty). */
  brandContext?: string
  /** Output-language instruction from getLanguageInstruction(language). */
  langInstruction: string
}

/**
 * Pure prompt builder. JSON-schema hints are English/neutral so EN requests never
 * get hard-coded Arabic fields; output language is controlled solely by
 * `langInstruction`. Forbids invented KPI numbers, budgets, ROI, and readiness.
 */
export function buildStrategyPrompt(opts: BuildStrategyPromptOpts): string {
  const { days, weeks, goal, platform, budget, brandContext, langInstruction } = opts
  return `You are a world-class marketing strategist specializing in the MENA region (Saudi Arabia, UAE, Egypt, and broader Arab world). Create a detailed ${days}-day marketing strategy.

${langInstruction}

${brandContext ? `BRAND CONTEXT:\n${brandContext}\n` : ''}GOAL: ${goal}
TIMEFRAME: ${days} days
PRIMARY PLATFORM: ${platform || 'Multi-platform (Instagram, Facebook, LinkedIn)'}
BUDGET LEVEL: ${budget || 'Bootstrap (organic only)'}

SAFETY RULES (critical — follow exactly):
- Do NOT invent any number the user did not provide. No KPI targets, no percentage growth, no ROI, no multipliers (e.g. "4x"), no conversion rates, no lead/sales/customer counts, no budgets, no timelines beyond the ${days}-day window, no platform readiness, no ad approval or spend status.
- KPIs must be QUALITATIVE directions only — e.g. "Track lead quality", "Measure engagement trend", "Monitor qualified inquiries", "Improve content consistency", "Review content consistency weekly". Never a specific numeric target.
- Paid is PLANNING ONLY. Never imply ads are ready, approved, live, running, or scheduled. State that no spend happens without explicit approval, that budget requires user confirmation unless the user provided one, and that platform readiness needs verification.
- If a value is unknown, say it is an assumption or needs verification — never fabricate confidence or numbers.

Return a JSON object with this EXACT structure:
{
  "title": "Strategic plan title",
  "summary": "Two-sentence executive summary (no invented numbers)",
  "goal": "${goal}",
  "timeframe": "${days} days",
  "themes": [
    {
      "week": 1,
      "title": "Theme title",
      "focus": "What this week focuses on",
      "contentIdeas": ["idea 1", "idea 2", "idea 3"]
    }
  ],
  "pillars": [
    {
      "name": "Content pillar name",
      "description": "What this pillar covers",
      "percentage": 30,
      "examples": ["example 1", "example 2"]
    }
  ],
  "kpis": [
    {
      "metric": "KPI name",
      "target": "Qualitative direction only — NO numbers, percentages, ROI, or lead/sales counts (e.g. 'Track lead quality')",
      "how": "How to measure it qualitatively"
    }
  ],
  "tactics": [
    {
      "platform": "Platform name",
      "frequency": "X times per week",
      "bestTime": "Best posting time",
      "contentType": "Type of content",
      "tip": "Platform-specific tip"
    }
  ],
  "weeklyPlan": [
    {
      "week": 1,
      "theme": "Week theme",
      "posts": [
        {
          "day": "Monday",
          "platform": "Instagram",
          "type": "Reel",
          "hook": "Post hook/title",
          "caption": "Short caption idea"
        }
      ]
    }
  ],
  "quickWins": ["Quick win you can do today", "Quick win 2", "Quick win 3"],
  "budget": {
    "organic": "Organic strategy advice (no invented spend figures)",
    "paid": "Planning only — no ad spend without explicit approval. Budget requires user confirmation unless the user provided one; platform readiness needs verification.",
    "tools": ["Free tool 1", "Free tool 2"]
  }
}

Generate ${Math.min(weeks, 4)} week themes and weeklyPlan entries with 5-7 posts per week. Make everything specific and actionable for the MENA market, but follow the SAFETY RULES above. Return only valid JSON.`
}
