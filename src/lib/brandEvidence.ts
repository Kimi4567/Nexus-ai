export const BRAND_EVIDENCE_BUCKET = 'brand-evidence'
export const BRAND_EVIDENCE_MAX_BYTES = 6 * 1024 * 1024
export const BRAND_EVIDENCE_MAX_DOCUMENTS = 10
export const BRAND_EVIDENCE_WORKSPACE_MAX_BYTES = 50 * 1024 * 1024
export const BRAND_EVIDENCE_MAX_SOURCE_CHARS = 40_000
export const BRAND_EVIDENCE_MAX_CLAIMS = 10

export const BRAND_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
] as const

export type BrandEvidenceMimeType = (typeof BRAND_EVIDENCE_MIME_TYPES)[number]

const MIME_EXTENSIONS: Record<BrandEvidenceMimeType, readonly string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/plain': ['txt'],
  'text/markdown': ['md', 'markdown'],
  'text/csv': ['csv'],
  'application/json': ['json'],
}

export const BRAND_EVIDENCE_CATEGORIES = [
  'PRODUCT',
  'CERTIFICATION',
  'PERFORMANCE',
  'CUSTOMER',
  'COMPANY',
  'POLICY',
  'OFFER',
  'OTHER',
] as const

export type BrandEvidenceCategory = (typeof BRAND_EVIDENCE_CATEGORIES)[number]

export const BRAND_EVIDENCE_TRUTH_STATUSES = [
  'PROPOSED',
  'CONFIRMED',
  'CONFLICTING',
  'OUTDATED',
] as const

export type BrandEvidenceTruthStatus = (typeof BRAND_EVIDENCE_TRUTH_STATUSES)[number]

export interface EvidenceFileValidationInput {
  fileName: unknown
  mimeType: unknown
  sizeBytes: unknown
}

export type EvidenceFileValidationResult =
  | { ok: true; fileName: string; mimeType: BrandEvidenceMimeType; sizeBytes: number; extension: string }
  | { ok: false; error: 'invalid_file_name' | 'unsupported_file_type' | 'invalid_file_size' | 'file_too_large' }

export interface GuardedEvidenceClaim {
  claim: string
  category: BrandEvidenceCategory
  evidenceExcerpt: string
  sourceLocator: string | null
  confidence: number | null
}

export interface ExistingEvidenceClaim {
  id: string
  claim: string
  category: string
  truthStatus?: string | null
}

export interface EvidenceTruthClassification {
  truthStatus: Extract<BrandEvidenceTruthStatus, 'PROPOSED' | 'CONFLICTING'>
  conflictClaimId: string | null
  conflictReason: string | null
}

function extensionOf(fileName: string): string {
  const last = fileName.toLowerCase().split('.').pop()
  return last && last !== fileName.toLowerCase() ? last : ''
}

export function validateEvidenceFile(input: EvidenceFileValidationInput): EvidenceFileValidationResult {
  if (typeof input.fileName !== 'string' || !input.fileName.trim() || input.fileName.trim().length > 180) {
    return { ok: false, error: 'invalid_file_name' }
  }

  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.toLowerCase().trim() : ''
  if (!BRAND_EVIDENCE_MIME_TYPES.includes(mimeType as BrandEvidenceMimeType)) {
    return { ok: false, error: 'unsupported_file_type' }
  }

  const extension = extensionOf(input.fileName.trim())
  if (!MIME_EXTENSIONS[mimeType as BrandEvidenceMimeType].includes(extension)) {
    return { ok: false, error: 'unsupported_file_type' }
  }

  const sizeBytes = typeof input.sizeBytes === 'number' ? input.sizeBytes : Number(input.sizeBytes)
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: 'invalid_file_size' }
  }
  if (sizeBytes > BRAND_EVIDENCE_MAX_BYTES) {
    return { ok: false, error: 'file_too_large' }
  }

  return {
    ok: true,
    fileName: input.fileName.trim(),
    mimeType: mimeType as BrandEvidenceMimeType,
    sizeBytes,
    extension,
  }
}

export function sanitizeEvidenceFileName(fileName: string): string {
  const normalized = fileName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const safe = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120)
  return safe || 'brand-evidence.txt'
}

export function normalizeEvidenceText(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function comparable(value: string): string {
  return normalizeEvidenceText(value).replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function trimText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? normalizeEvidenceText(value).slice(0, maxLength) : ''
}

function numericTokens(value: string): string[] {
  return value.match(/(?:[$€£AEDUSD]*\s*)?\d[\d,.]*(?:\s*%|\s*(?:days?|years?|months?|hours?))?/gi) ?? []
}

function canonicalNumber(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/\s+/g, '').replace(/,/g, '')
}

function semanticTokens(value: string): string[] {
  const withoutNumbers = comparable(value).replace(/\d[\d,.]*/g, ' <number> ')
  return withoutNumbers
    .match(/[\p{L}]+|<number>/gu)
    ?.filter(token => token === '<number>' || token.length >= 3) ?? []
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(semanticTokens(left))
  const rightTokens = new Set(semanticTokens(right))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union > 0 ? intersection / union : 0
}

function excerptSupportsClaimNumbers(claim: string, excerpt: string): boolean {
  const excerptNumbers = new Set(numericTokens(excerpt).map(canonicalNumber))
  return numericTokens(claim).every(token => excerptNumbers.has(canonicalNumber(token)))
}

function normalizeCategory(value: unknown): BrandEvidenceCategory {
  const category = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return BRAND_EVIDENCE_CATEGORIES.includes(category as BrandEvidenceCategory)
    ? category as BrandEvidenceCategory
    : 'OTHER'
}

function normalizeConfidence(value: unknown): number | null {
  const confidence = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(confidence)) return null
  return Math.min(1, Math.max(0, confidence))
}

/**
 * Converts untrusted model output into claims that are anchored to an exact
 * excerpt in the uploaded source. Unsupported numbers are rejected even when
 * the model returns a plausible-sounding claim.
 */
export function guardEvidenceClaims(raw: unknown, sourceText: string): GuardedEvidenceClaim[] {
  const candidates = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { claims?: unknown }).claims)
      ? (raw as { claims: unknown[] }).claims
      : []
  const normalizedSource = comparable(sourceText)
  const seen = new Set<string>()
  const guarded: GuardedEvidenceClaim[] = []

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const item = candidate as Record<string, unknown>
    const claim = trimText(item.claim, 500)
    const evidenceExcerpt = trimText(item.evidenceExcerpt, 900)
    const sourceLocator = trimText(item.sourceLocator, 120) || null
    if (claim.length < 8 || evidenceExcerpt.length < 8) continue
    if (!normalizedSource.includes(comparable(evidenceExcerpt))) continue
    if (!excerptSupportsClaimNumbers(claim, evidenceExcerpt)) continue

    const dedupeKey = comparable(claim)
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    guarded.push({
      claim,
      category: normalizeCategory(item.category),
      evidenceExcerpt,
      sourceLocator,
      confidence: normalizeConfidence(item.confidence),
    })
    if (guarded.length >= BRAND_EVIDENCE_MAX_CLAIMS) break
  }

  return guarded
}

/**
 * Flags only a narrow, explainable contradiction: a confirmed claim in the
 * same category says almost the same thing but contains different numeric
 * evidence. Non-numeric or semantically ambiguous differences remain proposed
 * for human review instead of being labelled as conflicts by guesswork.
 */
export function classifyEvidenceClaimTruth(
  claim: Pick<GuardedEvidenceClaim, 'claim' | 'category'>,
  existingClaims: readonly ExistingEvidenceClaim[],
): EvidenceTruthClassification {
  const incomingNumbers = new Set(numericTokens(claim.claim).map(canonicalNumber))
  if (incomingNumbers.size === 0) {
    return { truthStatus: 'PROPOSED', conflictClaimId: null, conflictReason: null }
  }

  const conflict = existingClaims.find(existing => {
    if (existing.category !== claim.category) return false
    if (existing.truthStatus && existing.truthStatus !== 'CONFIRMED') return false
    const existingNumbers = new Set(numericTokens(existing.claim).map(canonicalNumber))
    if (existingNumbers.size === 0) return false
    const sameNumbers = incomingNumbers.size === existingNumbers.size
      && [...incomingNumbers].every(value => existingNumbers.has(value))
    return !sameNumbers && tokenSimilarity(claim.claim, existing.claim) >= 0.8
  })

  if (!conflict) {
    return { truthStatus: 'PROPOSED', conflictClaimId: null, conflictReason: null }
  }
  return {
    truthStatus: 'CONFLICTING',
    conflictClaimId: conflict.id,
    conflictReason: 'A confirmed claim in the same category makes a near-identical statement with different numeric evidence.',
  }
}

export function buildPromotedEvidenceProof(
  claim: Pick<GuardedEvidenceClaim, 'claim' | 'sourceLocator'>,
  originalName: string,
): string {
  const locator = claim.sourceLocator ? ` — ${claim.sourceLocator}` : ''
  return `${claim.claim} [Source: ${originalName}${locator}]`
}

export function mergeApprovedEvidenceProofs(
  submittedProofs: readonly string[],
  approvedEvidenceProofs: readonly string[],
): string[] {
  return Array.from(new Set(
    [...submittedProofs, ...approvedEvidenceProofs]
      .map(proof => proof.trim())
      .filter(Boolean),
  ))
}

export function truncateEvidenceSource(sourceText: string): string {
  return normalizeEvidenceText(sourceText).slice(0, BRAND_EVIDENCE_MAX_SOURCE_CHARS)
}
