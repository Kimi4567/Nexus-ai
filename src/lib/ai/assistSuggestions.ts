/**
 * PR-M3.3B — Assisted-draft suggestion contract builder.
 *
 * Deterministic, pure, framework-free (no network, no I/O) transform that turns a
 * Scanner/Analyzer "extracted" object — AFTER it has already passed the
 * brandTruthGuard (guardExtracted) — into a safe, evidence-based suggestion
 * contract for the (future) review-before-apply flow.
 *
 * Anti-hallucination is non-negotiable and enforced here as a deterministic
 * second layer on top of the prompt rules + truth guard:
 *  - A field is only `extracted`/`observed` with high/medium confidence when its
 *    significant words actually appear in the source text. Otherwise it is
 *    downgraded to `inferred` + `low` confidence with a safety note.
 *  - Any value carrying a number/percent NOT present in the source is downgraded
 *    (defense-in-depth; the numeric scrub already removed unsupported numbers).
 *  - `pricePoint` is always `inferred` (it's a judgement, not a quoted fact).
 *  - verifiedProof + manual-only fields (businessGoal, budgets, destinations,
 *    strategy type/duration/objective, language) are NEVER suggested.
 *  - Absent/empty fields are reported in `missing` — never invented.
 */

export type AssistBasis = 'extracted' | 'observed' | 'inferred' | 'missing'
export type AssistConfidence = 'high' | 'medium' | 'low'
export type AssistSource = 'website' | 'content'

export interface AssistFieldSuggestion {
  field: string
  /** Display string (arrays are joined with ", "). */
  suggested: string
  /** Raw items for array-valued fields (so apply can merge without re-splitting). */
  items?: string[]
  source: AssistSource
  sourceRef: string
  basis: Exclude<AssistBasis, 'missing'>
  confidence: AssistConfidence
  evidence: string
  safetyNote: string
}

export interface AssistDraftResult {
  suggestions: AssistFieldSuggestion[]
  missing: string[]
  safetyNotes: string[]
}

// Website Scanner fields → default basis. pricePoint is a judgement → inferred.
const WEBSITE_FIELD_BASIS: Record<string, 'extracted' | 'inferred'> = {
  brandName: 'extracted',
  industry: 'extracted',
  description: 'extracted',
  primaryOffer: 'extracted',
  targetAudience: 'extracted',
  uniqueAdvantages: 'extracted',
  toneKeywords: 'extracted',
  writingStyle: 'extracted',
  audiencePainPoints: 'extracted',
  strategicNotes: 'extracted',
  competitors: 'extracted',
  pricePoint: 'inferred',
}

// Content Analyzer fields → default basis. Content patterns are `observed`,
// not `extracted`, unless a value is literally quoted (still treated as observed).
const CONTENT_FIELD_BASIS: Record<string, 'observed'> = {
  winningHooks: 'observed',
  winningAngles: 'observed',
  toneKeywords: 'observed',
  audiencePainPoints: 'observed',
  audienceDesires: 'observed',
  writingStyle: 'observed',
  strategicNotes: 'observed',
}

// Never auto-suggested under any circumstances (user-owned / manual-only / proof).
export const NEVER_SUGGEST = new Set<string>([
  'verifiedProof',
  'businessGoal',
  'marketingBudget',
  'conversionDestination',
  'leadHandling',
  'languagePreference',
  'audienceAge',
  'audienceLocation',
])

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'our', 'are', 'from',
  'who', 'what', 'their', 'them', 'they', 'has', 'have', 'into', 'over', 'about',
  'a', 'an', 'of', 'to', 'in', 'on', 'or', 'is', 'it', 'as', 'by', 'be', 'we',
])

function significantTokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
    ),
  )
}

function hasUnsupportedNumber(value: string, sourceLc: string): boolean {
  const nums = value.match(/\d[\d,.]*%?/g)
  if (!nums) return false
  return nums.some((n) => !sourceLc.includes(n.toLowerCase()))
}

/** Find a short evidence snippet from the source containing matched tokens. */
function findEvidence(tokens: string[], source: string): { evidence: string; coverage: number } {
  const sourceLc = source.toLowerCase()
  const matched = tokens.filter((t) => sourceLc.includes(t))
  const coverage = tokens.length ? matched.length / tokens.length : 0
  if (matched.length === 0) return { evidence: '', coverage }
  // Pick the sentence/segment with the most matched tokens.
  const segments = source.split(/(?<=[.!?\n])\s+/)
  let best = ''
  let bestHits = 0
  for (const seg of segments) {
    const segLc = seg.toLowerCase()
    const hits = matched.filter((t) => segLc.includes(t)).length
    if (hits > bestHits) {
      bestHits = hits
      best = seg.trim()
    }
  }
  const evidence = (best || '').replace(/\s+/g, ' ').slice(0, 180).trim()
  return { evidence, coverage }
}

function toItems(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

/**
 * Build the suggestion contract from an ALREADY-GUARDED extracted object.
 * @param guarded  output of guardExtracted (numbers/proof already scrubbed)
 * @param source   'website' | 'content'
 * @param sourceText  the combined source text the extraction came from (for evidence)
 * @param sourceRef   page URL (website) or e.g. "3 content sample(s)" (content)
 */
export function buildAssistSuggestions(
  guarded: Record<string, unknown> | null | undefined,
  { source, sourceText, sourceRef }: { source: AssistSource; sourceText: string; sourceRef: string },
): AssistDraftResult {
  const policy = source === 'website' ? WEBSITE_FIELD_BASIS : CONTENT_FIELD_BASIS
  const suggestions: AssistFieldSuggestion[] = []
  const missing: string[] = []
  const safetyNotes = new Set<string>()
  const obj = guarded && typeof guarded === 'object' ? guarded : {}

  for (const field of Object.keys(policy)) {
    if (NEVER_SUGGEST.has(field)) continue
    const raw = obj[field]
    const items = toItems(raw)
    const isArray = Array.isArray(raw)
    const display = isArray ? items.join(', ') : (typeof raw === 'string' ? raw.trim() : '')

    if (!display) {
      missing.push(field)
      continue
    }

    let basis: Exclude<AssistBasis, 'missing'> = policy[field]
    const tokens = significantTokens(display)
    const { evidence, coverage } = findEvidence(tokens, sourceText)
    let confidence: AssistConfidence
    let safetyNote = ''

    if (basis === 'inferred') {
      // Judgement fields (e.g. pricePoint): never confident.
      confidence = 'low'
      safetyNote = 'Inferred from the source, not directly stated — please review.'
    } else if (hasUnsupportedNumber(display, sourceText.toLowerCase())) {
      // A figure not present in the source slipped through → downgrade hard.
      basis = 'inferred'
      confidence = 'low'
      safetyNote = 'Contains a figure not found in the source — review before applying.'
    } else if (coverage >= 0.6 && evidence) {
      confidence = 'high'
    } else if (coverage >= 0.3 && evidence) {
      confidence = 'medium'
    } else {
      // Weak support → do not present as a confident fact.
      basis = 'inferred'
      confidence = 'low'
      safetyNote = 'Limited direct support in the source — please review.'
    }

    if (safetyNote) safetyNotes.add(safetyNote)
    suggestions.push({
      field,
      suggested: display,
      ...(isArray ? { items } : {}),
      source,
      sourceRef,
      basis,
      confidence,
      evidence,
      safetyNote,
    })
  }

  // Stable order: extracted/observed first (high→low), inferred last.
  const basisRank: Record<string, number> = { extracted: 0, observed: 0, inferred: 1, missing: 2 }
  const confRank: Record<AssistConfidence, number> = { high: 0, medium: 1, low: 2 }
  suggestions.sort(
    (a, b) => basisRank[a.basis] - basisRank[b.basis] || confRank[a.confidence] - confRank[b.confidence],
  )

  return { suggestions, missing, safetyNotes: Array.from(safetyNotes) }
}
