/**
 * Nexus AI — Output Quality Guardrails
 *
 * Every AI output from Nexus must pass three tests:
 *   1. Actionability  — does it have concrete, specific next steps?
 *   2. Brand binding  — does it reference the user's actual brand data?
 *   3. Specificity    — does it avoid generic filler phrases that add no signal?
 *
 * Usage:
 *   const result = validateAIOutput(strategyText, { brandName: 'Nexus AI', industry: 'SaaS' })
 *   if (result.score < 60) console.warn('[quality]', result.warnings)
 *
 * The validator does NOT auto-reject or regenerate (that would double cost/latency).
 * Instead it logs quality signals and returns metadata that can be:
 *   - Logged for monitoring (catch degraded prompt performance over time)
 *   - Surfaced to users as a "quality score" badge in the UI
 *   - Used to decide whether to offer a "Regenerate with higher quality" option
 */

// ── Generic phrase detection ───────────────────────────────────────────────────

/**
 * Phrases that add no marketing signal.
 * These appear in bad AI outputs when the model ignores brand context.
 */
const GENERIC_PHRASES_EN = [
  'take your business to the next level',
  'maximize your roi',
  'maximize roi',
  'comprehensive solution',
  'innovative approach',
  'innovative solution',
  'cutting-edge technology',
  'cutting-edge',
  'state-of-the-art',
  'best-in-class',
  'world-class',
  'seamlessly integrate',
  'leverage synergies',
  'synergistic',
  'empower your team',
  'empower your business',
  'transform your business',
  'revolutionize your',
  'skyrocket your',
  'unlock your potential',
  'unleash your potential',
  'drive meaningful results',
  'drive results',
  'data-driven insights',
  'actionable insights',    // only when used as filler, not when specific
  'end-to-end solution',
  'holistic approach',
  'robust solution',
  'scalable solution',
  'game-changer',
  'game changing',
  'disruptive',
  'groundbreaking',
  'best practices',
  'thought leader',
  'key stakeholders',
  'move the needle',
  'low-hanging fruit',
  'circle back',
  'synergy',
  'paradigm shift',
  'pivot',
]

const GENERIC_PHRASES_AR = [
  'الحل الشامل',
  'الحل الذكي',
  'يرفع مستوى',
  'يضاعف الأرباح',
  'الحل الأمثل',
  'يحسّن كل شيء',
  'يطور أعمالك',
  'ينقل عملك',
  'نقلة نوعية',
  'ثورة حقيقية',
  'حل متكامل',
  'بصورة شاملة',
  'ببساطة تامة',
  'يلبي جميع احتياجاتك',
  'الأفضل في فئته',
  'رؤى قابلة للتنفيذ',  // when used as filler
  'نتائج ملموسة',
  'تحسين الأداء العام',
  'زيادة الإنتاجية',
]

// ── Actionability signals ──────────────────────────────────────────────────────

const ACTIONABILITY_PATTERNS = [
  /\b(step \d|خطوة \d|\d+\.\s|\d+\))/i,           // numbered steps
  /\b(action:|اجراء:|التالي:|do:|next:)/i,          // action headers
  /^\s*[-•*]\s/m,                                    // bullet points
  /\b(publish|post|create|write|schedule|launch|انشر|اكتب|جدول|أنشئ|ابدأ)\b/i,
  /week \d|week one|الأسبوع/i,                      // week-based execution
  /\b(january|february|march|q1|q2|q3|q4|يناير|فبراير|الربع)/i,
]

// ── Brand binding signals ──────────────────────────────────────────────────────

interface BrandContext {
  brandName?: string | null
  industry?: string | null
  targetAudience?: string | null
  primaryOffer?: string | null
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface GuardrailResult {
  /** Quality score 0–100. Below 50 = poor, 50–75 = acceptable, 75+ = good */
  score: number
  /** True if the output passes the minimum quality bar (score ≥ 50) */
  passesMinimum: boolean
  /** Generic phrases found in the output */
  genericPhrasesFound: string[]
  /** True if the output references at least one piece of brand data */
  hasBrandReference: boolean
  /** True if the output contains concrete, actionable steps */
  hasActionableSteps: boolean
  /** Human-readable warnings for logging/debugging */
  warnings: string[]
  /** Severity level for quick filtering */
  severity: 'ok' | 'warn' | 'fail'
}

export function validateAIOutput(
  output: string,
  brand: BrandContext = {},
): GuardrailResult {
  if (!output || output.trim().length < 50) {
    return {
      score: 0,
      passesMinimum: false,
      genericPhrasesFound: [],
      hasBrandReference: false,
      hasActionableSteps: false,
      warnings: ['Output is empty or too short'],
      severity: 'fail',
    }
  }

  const lower = output.toLowerCase()

  // 1. Generic phrase detection
  const allPhrases = [...GENERIC_PHRASES_EN, ...GENERIC_PHRASES_AR]
  const genericFound = allPhrases.filter(p => lower.includes(p.toLowerCase()))

  // 2. Brand reference check
  let hasBrandReference = true   // default true if no brand data to check against
  const brandTerms: string[] = []

  if (brand.brandName) brandTerms.push(brand.brandName)
  if (brand.industry) brandTerms.push(brand.industry)
  if (brand.targetAudience) brandTerms.push(brand.targetAudience.slice(0, 20))
  if (brand.primaryOffer) brandTerms.push(brand.primaryOffer.slice(0, 20))

  if (brandTerms.length > 0) {
    hasBrandReference = brandTerms.some(term =>
      lower.includes(term.toLowerCase()),
    )
  }

  // 3. Actionability check
  const hasActionableSteps = ACTIONABILITY_PATTERNS.some(p => p.test(output))

  // 4. Length-based signal — very short outputs are usually incomplete
  const hasMinLength = output.trim().length >= 200

  // 5. Score calculation
  let score = 100

  // Deduct for generic phrases (up to -30)
  score -= Math.min(30, genericFound.length * 8)

  // Deduct for missing brand reference (-20)
  if (!hasBrandReference && brandTerms.length > 0) score -= 20

  // Deduct for no actionable steps (-15)
  if (!hasActionableSteps) score -= 15

  // Deduct for very short output (-15)
  if (!hasMinLength) score -= 15

  score = Math.max(0, Math.min(100, score))

  // 6. Warnings
  const warnings: string[] = []

  if (genericFound.length > 0) {
    warnings.push(
      `Generic phrases (${genericFound.length}): "${genericFound.slice(0, 3).join('", "')}"` +
      (genericFound.length > 3 ? ` +${genericFound.length - 3} more` : ''),
    )
  }

  if (!hasBrandReference && brandTerms.length > 0) {
    warnings.push(`No reference to brand context (checked: ${brandTerms.slice(0,2).join(', ')})`)
  }

  if (!hasActionableSteps) {
    warnings.push('No actionable steps detected — output may be too abstract')
  }

  if (!hasMinLength) {
    warnings.push(`Output is short (${output.trim().length} chars) — may be incomplete`)
  }

  const passesMinimum = score >= 50
  const severity = score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'fail'

  return {
    score,
    passesMinimum,
    genericPhrasesFound: genericFound,
    hasBrandReference,
    hasActionableSteps,
    warnings,
    severity,
  }
}

/**
 * Log quality result to console (dev) or monitoring (prod).
 * Call this after every major AI generation.
 */
export function logOutputQuality(
  agentName: string,
  result: GuardrailResult,
  userId?: string,
): void {
  if (result.severity === 'ok') return  // Don't spam logs for good outputs

  const prefix = `[quality:${agentName}]${userId ? ` user=${userId}` : ''}`

  if (result.severity === 'warn') {
    console.warn(`${prefix} score=${result.score} warnings:`, result.warnings)
  } else {
    console.error(`${prefix} FAILED score=${result.score} warnings:`, result.warnings)
  }
}

/**
 * Convenience: validate AND log in one call.
 * Returns the result so callers can still act on it.
 */
export function checkAndLog(
  agentName: string,
  output: string,
  brand: BrandContext = {},
  userId?: string,
): GuardrailResult {
  const result = validateAIOutput(output, brand)
  logOutputQuality(agentName, result, userId)
  return result
}
