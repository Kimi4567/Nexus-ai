type StrategyLike = Record<string, unknown> | null | undefined

export interface StrategyBrandAlignmentInput {
  currentBrandName?: string | null
  campaignName?: string | null
  strategy?: StrategyLike
  aiOutput?: StrategyLike
}

export interface StrategyBrandAlignment {
  currentBrandName: string
  evidenceText: string
  isStale: boolean
}

const STRONG_EVIDENCE_KEYS = [
  'brandName',
  'companyName',
  'businessName',
]

const TITLE_EVIDENCE_KEYS = [
  'campaignName',
  'name',
  'title',
]

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase()
}

interface EvidenceSet {
  strong: string[]
  titles: string[]
}

function collectEvidence(value: StrategyLike): EvidenceSet {
  if (!value || typeof value !== 'object') return { strong: [], titles: [] }

  const evidence: EvidenceSet = { strong: [], titles: [] }
  for (const key of STRONG_EVIDENCE_KEYS) {
    const item = value[key]
    if (typeof item === 'string' && item.trim()) evidence.strong.push(item.trim())
  }

  for (const key of TITLE_EVIDENCE_KEYS) {
    const item = value[key]
    if (typeof item === 'string' && item.trim()) evidence.titles.push(item.trim())
  }

  const nestedStrategy = value.strategy
  if (nestedStrategy && typeof nestedStrategy === 'object') {
    const nested = collectEvidence(nestedStrategy as Record<string, unknown>)
    evidence.strong.push(...nested.strong)
    evidence.titles.push(...nested.titles)
  }

  return evidence
}

function hasStrategyForQualifier(value: string): boolean {
  const normalized = normalizeText(value)
  return /\bfor\b/iu.test(value) || /ل[\u0640\u0650]?\s/u.test(value) || /(^|\s)(for|ل)(\s|$)/u.test(normalized)
}

export function getStrategyBrandAlignment(input: StrategyBrandAlignmentInput): StrategyBrandAlignment {
  const currentBrandName = (input.currentBrandName ?? '').trim()
  const brandKey = normalizeText(currentBrandName)
  const strategyEvidence = collectEvidence(input.strategy)
  const outputEvidence = collectEvidence(input.aiOutput)
  const titleEvidence = [
    input.campaignName ?? '',
    ...strategyEvidence.titles,
    ...outputEvidence.titles,
  ]
    .map(item => item.trim())
    .filter(Boolean)
  const strongEvidence = [
    ...strategyEvidence.strong,
    ...outputEvidence.strong,
  ]
    .map(item => item.trim())
    .filter(Boolean)

  const evidenceText = [...strongEvidence, ...titleEvidence].join(' | ')
  const strongEvidenceKey = normalizeText(strongEvidence.join(' | '))
  const qualifiedTitleKey = normalizeText(titleEvidence.filter(hasStrategyForQualifier).join(' | '))
  const hasStrongEvidence = Boolean(strongEvidenceKey)
  const hasQualifiedTitleEvidence = Boolean(qualifiedTitleKey)

  return {
    currentBrandName,
    evidenceText,
    isStale: Boolean(
      brandKey &&
      (
        (hasStrongEvidence && !strongEvidenceKey.includes(brandKey)) ||
        (!hasStrongEvidence && hasQualifiedTitleEvidence && !qualifiedTitleKey.includes(brandKey))
      )
    ),
  }
}
