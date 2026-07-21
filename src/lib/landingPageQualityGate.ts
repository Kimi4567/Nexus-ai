export const LANDING_PAGE_QUALITY_CHECK_IDS = [
  'DESTINATION',
  'HEADLINE',
  'OFFER_DETAIL',
  'BENEFITS',
  'PROOF',
  'SEARCH_METADATA',
  'SEARCH_SNIPPET_FIT',
  'MESSAGE_MATCH',
] as const

export type LandingPageQualityCheckId = (typeof LANDING_PAGE_QUALITY_CHECK_IDS)[number]
export type LandingPageQualityStatus = 'BLOCKER' | 'WARNING' | 'READY' | 'INFO'
export type LandingPageMeasurementMode = 'SERVER_CONFIRMED_FORM' | 'CLIENT_REPORTED_CLICK' | 'NOT_CONFIGURED'

export interface LandingPageQualityInput {
  headline: string
  subheadline: string
  body: string
  benefits: string[]
  proof: string
  primaryCtaLabel: string
  primaryCtaUrl: string
  captureFormId: string
  seoTitle: string
  seoDescription: string
  seoIndexable: boolean
}

export interface LandingPageQualityCheck {
  id: LandingPageQualityCheckId
  status: LandingPageQualityStatus
  weight: number
}

export interface LandingPageQualityResult {
  score: number
  blockers: number
  warnings: number
  measurementMode: LandingPageMeasurementMode
  checks: LandingPageQualityCheck[]
}

const MESSAGE_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'our', 'into', 'this', 'that',
  'على', 'إلى', 'الى', 'من', 'في', 'عن', 'مع', 'هذا', 'هذه', 'لك', 'كل',
])

function lengthStatus(value: string, readyMin: number, readyMax: number): LandingPageQualityStatus {
  const length = value.trim().length
  if (length === 0) return 'BLOCKER'
  return length >= readyMin && length <= readyMax ? 'READY' : 'WARNING'
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter(token => token.length >= 3 && !MESSAGE_STOP_WORDS.has(token)) ?? [],
  )
}

function hasMessageMatch(headline: string, seoTitle: string): boolean {
  const headlineTokens = meaningfulTokens(headline)
  const titleTokens = meaningfulTokens(seoTitle)
  if (headlineTokens.size === 0 || titleTokens.size === 0) return false
  return [...headlineTokens].some(token => titleTokens.has(token))
}

function scoreChecks(checks: LandingPageQualityCheck[]): number {
  const scored = checks.filter(check => check.weight > 0 && check.status !== 'INFO')
  const available = scored.reduce((total, check) => total + check.weight, 0)
  if (available === 0) return 0
  const earned = scored.reduce((total, check) => {
    if (check.status === 'READY') return total + check.weight
    if (check.status === 'WARNING') return total + (check.weight * 0.5)
    return total
  }, 0)
  return Math.round((earned / available) * 100)
}

export function evaluateLandingPageQuality(input: LandingPageQualityInput): LandingPageQualityResult {
  const hasCaptureForm = Boolean(input.captureFormId.trim())
  const hasExternalDestination = /^https:\/\//i.test(input.primaryCtaUrl.trim())
  const hasDestination = hasCaptureForm || hasExternalDestination
  const hasCta = Boolean(input.primaryCtaLabel.trim())
  const headlineStatus = lengthStatus(input.headline, 20, 100)
  const offerReady = input.subheadline.trim().length >= 30 && input.body.trim().length >= 120
  const benefitsReady = input.benefits.filter(item => item.trim()).length >= 3
  const proofReady = Boolean(input.proof.trim())
  const metadataComplete = input.seoTitle.trim().length >= 10
    && input.seoTitle.trim().length <= 70
    && input.seoDescription.trim().length >= 50
    && input.seoDescription.trim().length <= 180
  const snippetFit = input.seoTitle.trim().length >= 30
    && input.seoTitle.trim().length <= 60
    && input.seoDescription.trim().length >= 70
    && input.seoDescription.trim().length <= 160

  const checks: LandingPageQualityCheck[] = [
    {
      id: 'DESTINATION',
      status: hasDestination && hasCta ? 'READY' : 'BLOCKER',
      weight: 3,
    },
    {
      id: 'HEADLINE',
      status: headlineStatus,
      weight: 2,
    },
    {
      id: 'OFFER_DETAIL',
      status: offerReady ? 'READY' : 'WARNING',
      weight: 2,
    },
    {
      id: 'BENEFITS',
      status: benefitsReady ? 'READY' : 'WARNING',
      weight: 1,
    },
    {
      id: 'PROOF',
      status: proofReady ? 'READY' : 'INFO',
      weight: 0,
    },
    {
      id: 'SEARCH_METADATA',
      status: input.seoIndexable ? (metadataComplete ? 'READY' : 'BLOCKER') : 'INFO',
      weight: input.seoIndexable ? 2 : 0,
    },
    {
      id: 'SEARCH_SNIPPET_FIT',
      status: input.seoIndexable ? (snippetFit ? 'READY' : 'WARNING') : 'INFO',
      weight: input.seoIndexable ? 1 : 0,
    },
    {
      id: 'MESSAGE_MATCH',
      status: input.seoIndexable
        ? (hasMessageMatch(input.headline, input.seoTitle) ? 'READY' : 'WARNING')
        : 'INFO',
      weight: input.seoIndexable ? 1 : 0,
    },
  ]

  return {
    score: scoreChecks(checks),
    blockers: checks.filter(check => check.status === 'BLOCKER').length,
    warnings: checks.filter(check => check.status === 'WARNING').length,
    measurementMode: hasCaptureForm
      ? 'SERVER_CONFIRMED_FORM'
      : hasExternalDestination
        ? 'CLIENT_REPORTED_CLICK'
        : 'NOT_CONFIGURED',
    checks,
  }
}
