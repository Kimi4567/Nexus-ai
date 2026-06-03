/**
 * NEXUS AI — Output Quality Validator
 *
 * Post-generation guardrail that scans AI output for:
 *   1. Banned generic phrases (from promptRules.ts)
 *   2. Missing specificity signals (brand name, audience name, concrete numbers)
 *   3. Structural completeness (required fields present)
 *
 * Usage:
 *   import { validateOutput } from '@/lib/ai/outputValidator'
 *   const report = validateOutput(jsonString, { brandName: 'Acme' })
 *   if (report.score < 60) console.warn('[AI Quality]', report.violations)
 */

// ── Banned phrase list (keep in sync with promptRules.ts) ─────────────────────
const BANNED: string[] = [
  'innovative', 'innovation', 'innovative approach', 'innovative solution',
  'cutting-edge', 'state-of-the-art', 'next-generation', 'next-gen',
  'game-changer', 'game-changing', 'revolutionary', 'groundbreaking',
  'world-class', 'best-in-class', 'industry-leading', 'market-leading',
  'leverage', 'leverage ai', 'leverage synergies',
  'transform your', 'transformation', 'unlock your potential',
  'take to the next level', 'elevate your brand',
  'powerful solution', 'robust solution', 'comprehensive solution', 'scalable solution',
  'seamless experience', 'seamless integration', 'seamlessly',
  'drive results', 'drive meaningful results', 'maximize roi',
  "in today's digital landscape", 'in the competitive landscape',
  'proven roi', 'guaranteed results', 'industry best practices',
  'empower your', 'empower team',
  'holistic approach', 'end-to-end solution',
  'dynamic content', 'eye-catching', 'stunning visuals',
  'capture the essence', 'tell your story',
  'data-driven', 'actionable insights',
]

// ── Specificity signals — presence of any raises score ───────────────────────
const SPECIFICITY_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'has_percentage',    pattern: /\d+%/ },
  { label: 'has_dollar',        pattern: /\$\d+/ },
  { label: 'has_number',        pattern: /\b\d{2,}\b/ },
  { label: 'has_timeframe',     pattern: /\b(\d+\s*(days?|weeks?|months?|hours?))\b/i },
  { label: 'has_platform_name', pattern: /\b(instagram|tiktok|facebook|linkedin|youtube|snapchat)\b/i },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QualityReport {
  /** 0–100. Below 50 = low quality, 50–75 = acceptable, 75+ = good */
  score: number
  /** Specific banned phrases found */
  violations: string[]
  /** Structural or specificity warnings */
  warnings: string[]
  /** Quick pass/fail for logging */
  passed: boolean
}

export interface ValidateOptions {
  /** Brand name to check for presence */
  brandName?: string
  /** Minimum acceptable score (default: 40) */
  minScore?: number
}

// ── Core validator ─────────────────────────────────────────────────────────────

export function validateOutput(
  text: string,
  opts: ValidateOptions = {}
): QualityReport {
  const { brandName, minScore = 40 } = opts
  const lower = text.toLowerCase()

  const violations: string[] = []
  const warnings: string[] = []

  // 1. Scan for banned phrases (−5 pts each, capped at −50)
  for (const phrase of BANNED) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push(phrase)
    }
  }

  // 2. Check brand name presence (+10 if found, warning if missing)
  if (brandName) {
    if (!lower.includes(brandName.toLowerCase())) {
      warnings.push(`Brand name "${brandName}" not mentioned in output`)
    }
  }

  // 3. Specificity signals (+5 each, up to +15)
  let specificityBonus = 0
  for (const { label, pattern } of SPECIFICITY_PATTERNS) {
    if (pattern.test(text)) {
      specificityBonus += 5
    }
  }
  specificityBonus = Math.min(specificityBonus, 15)

  // 4. Length check — very short outputs are suspect
  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount < 50) {
    warnings.push(`Output is very short (${wordCount} words) — may be incomplete`)
  }

  // 5. JSON validity check (if content looks like JSON)
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      JSON.parse(text)
    } catch {
      warnings.push('Output is not valid JSON despite JSON-like structure')
    }
  }

  // ── Score calculation ──────────────────────────────────────────────────────
  const bannedPenalty = Math.min(violations.length * 5, 50)
  const brandBonus    = brandName && lower.includes(brandName.toLowerCase()) ? 10 : 0
  const score = Math.max(0, Math.min(100,
    70                  // base
    - bannedPenalty     // deduct for banned phrases
    + specificityBonus  // bonus for concrete numbers/references
    + brandBonus        // bonus for brand mention
  ))

  return {
    score,
    violations,
    warnings,
    passed: score >= minScore && violations.length === 0,
  }
}

// ── Batch validator for multi-field objects ───────────────────────────────────
// Recursively extracts all string values and validates them together.

export function validateOutputObject(
  obj: unknown,
  opts: ValidateOptions = {}
): QualityReport {
  const allText = extractStrings(obj).join(' ')
  return validateOutput(allText, opts)
}

function extractStrings(val: unknown): string[] {
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) return val.flatMap(extractStrings)
  if (val && typeof val === 'object') {
    return Object.values(val as Record<string, unknown>).flatMap(extractStrings)
  }
  return []
}

// ── Log helper — call this in API routes ─────────────────────────────────────

export function logQualityReport(
  route: string,
  report: QualityReport,
  context?: string
): void {
  if (report.passed) {
    console.log(`[AI Quality] ✓ ${route} score=${report.score}${context ? ` (${context})` : ''}`)
    return
  }

  console.warn(`[AI Quality] ✗ ${route} score=${report.score}${context ? ` (${context})` : ''}`)
  if (report.violations.length > 0) {
    console.warn(`[AI Quality]   Banned phrases: ${report.violations.slice(0, 5).join(', ')}`)
  }
  if (report.warnings.length > 0) {
    console.warn(`[AI Quality]   Warnings: ${report.warnings.join('; ')}`)
  }
}
