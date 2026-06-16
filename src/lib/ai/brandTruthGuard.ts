/**
 * Brand Brain Truth Guard (PR-G)
 *
 * Deterministic backstop that prevents Brand Brain AI assistance (AI Assist,
 * Website Scanner, Content Analyzer) from saving fabricated facts as brand truth.
 *
 * Prompt rules (UNSUPPORTED_CLAIMS_RULES) are the first line of defence; this is
 * the second, non-negotiable line: even if the model ignores the prompt, unsafe
 * unsupported claims are scrubbed or downgraded here before they reach the user
 * or the saved Brand Brain (which is injected into every agent).
 *
 * Pure + framework-free so it is trivially unit-testable. No network, no I/O.
 *
 * What it does NOT do: it never blocks normal, safe suggestions, never changes
 * credit logic, and never invents replacement content — it only removes or
 * softens unsupported metrics, fake proof, and overclaimed automation/readiness.
 *
 * User-provided values are preserved: pass them via `allowed` and any figure
 * echoed from the user's own input is kept (delegated to scrubUnsupportedNumbers).
 */

import { scrubUnsupportedNumbers } from '@/lib/strategyNormalize'

type Rule = [RegExp, string]

// ── Fabricated social proof → "to validate" framing (never asserted as fact) ──
const SOCIAL_PROOF_RULES: Rule[] = [
  [/\bcase stud(?:y|ies)\b/gi, 'possible case-study angle to validate'],
  [/\btestimonials?\b/gi, 'testimonials to collect'],
  [/\bcustomer success stor(?:y|ies)\b/gi, 'customer outcomes to validate'],
  [/\bsuccess stor(?:y|ies)\b/gi, 'outcomes to validate'],
  [/\bproven results?\b/gi, 'intended outcomes'],
  [/\b(?:that\s+)?proves?\s+results?\b/gi, 'aimed at outcomes to validate'],
  [/\bproven track record\b/gi, 'intended track record'],
  [/\b(?:our |the )?clients?\s+(?:achieved|experienced|saw|got|enjoyed)\b/gi, 'clients may experience'],
  [/\b(?:our |the )?customers?\s+(?:achieved|experienced|saw|got|enjoyed)\b/gi, 'customers may experience'],
  [/\btrusted by thousands\b/gi, 'built to earn trust'],
  [/\bsignificant growth\b/gi, 'potential growth'],
  [/\bproven\b/gi, 'intended'],
  [/\bguaranteed\b/gi, 'aimed-for'],
]

// ── Overclaimed automation / platform readiness → honest, approval-gated wording ──
const AUTOMATION_RULES: Rule[] = [
  [/\bautomatic(?:ally)?\s+publish(?:ing|es|ed)?\b/gi, 'approval-gated publishing when connected and enabled'],
  [/\bpublish(?:es|ing|ed)?\s+automatic(?:ally)?\b/gi, 'approval-gated publishing when connected and enabled'],
  [/\bauto[-\s]?publish(?:ing|es|ed)?\b/gi, 'approval-gated publishing when connected and enabled'],
  [/\bautomated\s+publishing\b/gi, 'approval-gated publishing when connected and enabled'],
  [/\b(?:ads?|campaigns?)\s+(?:are|is)\s+(?:running|live)\b/gi, 'ads can be planned (not live until approved)'],
  [/\blive\s+ads?\b/gi, 'planned ads (approval-gated)'],
  [/\bfully\s+automated\b/gi, 'assisted, with approval steps'],
  [/\bagency\s+replacement\b/gi, 'an alternative to an agency over time'],
  [/\breplaces?\s+(?:your\s+)?(?:marketing\s+)?agency\b/gi, 'works as an alternative to an agency over time'],
]

// ── Efficiency/productivity gains stated as fact (numbers already scrubbed) ──
const EFFICIENCY_RULES: Rule[] = [
  [/\befficiency\s+gains?\b/gi, 'improved efficiency'],
  [/\bproductivity\s+gains?\b/gi, 'improved consistency'],
]

const ALL_RULES: Rule[] = [...SOCIAL_PROOF_RULES, ...AUTOMATION_RULES, ...EFFICIENCY_RULES]

/**
 * Guard a single text value: scrub unsupported numbers (keeping user-provided
 * ones via `allowed`), then downgrade fabricated proof / overclaimed automation.
 */
export function guardBrandText(text: unknown, allowed: string[] = []): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''
  let t = scrubUnsupportedNumbers(text, allowed)
  for (const [re, replacement] of ALL_RULES) t = t.replace(re, replacement)
  // Tidy artefacts left by the numeric scrub ("—") and collapsed whitespace.
  t = t
    .replace(/\b(?:of|by|to|up to|around|about)\s+—/gi, '')
    .replace(/—\s*%/g, '')
    .replace(/\(\s*—\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
  return t
}

/** Guard a list of strings (drops empties after guarding). */
export function guardBrandList(list: unknown, allowed: string[] = []): string[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((x): x is string => typeof x === 'string')
    .map((s) => guardBrandText(s, allowed))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Guard a scanner/analyzer "extracted" object in place-safe fashion: every
 * string field is text-guarded, every string[] field is list-guarded, all other
 * values pass through untouched. Returns a new object.
 */
export function guardExtracted(
  obj: Record<string, unknown> | null | undefined,
  allowed: string[] = [],
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') out[key] = guardBrandText(value, allowed)
    else if (Array.isArray(value)) out[key] = guardBrandList(value, allowed)
    else out[key] = value
  }
  return out
}
