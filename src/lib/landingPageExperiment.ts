import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  hashLandingPageSnapshot,
  type LandingPageDraft,
  type PublicLandingPageSnapshot,
} from '@/lib/landingPageContract'

export const LANDING_EXPERIMENT_VARIABLES = ['HEADLINE', 'SUBHEADLINE', 'CTA_LABEL'] as const
export const LANDING_EXPERIMENT_STATUSES = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const
export const LANDING_EXPERIMENT_VARIANTS = ['CONTROL', 'CHALLENGER'] as const
export const LANDING_EXPERIMENT_DECISIONS = ['KEEP_CONTROL', 'APPLY_CHALLENGER_DRAFT', 'INCONCLUSIVE'] as const

export type LandingExperimentVariable = (typeof LANDING_EXPERIMENT_VARIABLES)[number]
export type LandingExperimentStatus = (typeof LANDING_EXPERIMENT_STATUSES)[number]
export type LandingExperimentVariant = (typeof LANDING_EXPERIMENT_VARIANTS)[number]
export type LandingExperimentDecision = (typeof LANDING_EXPERIMENT_DECISIONS)[number]

export interface LandingExperimentDraft {
  hypothesis: string
  variable: LandingExperimentVariable
  challengerValue: string
  minimumVisitorsPerVariant: number
  minimumConversionsPerVariant: number
  challengerAllocationPercent: number
}

export interface LandingExperimentAssignment {
  experimentId: string
  landingPageId: string
  variant: LandingExperimentVariant
  expiresAt: number
}

export interface LandingExperimentVariantEvidence {
  reportedViews: number
  reportedClicks: number
  confirmedSubmissions: number
  confirmedSubmissionRate: number | null
  minimumEvidenceMet: boolean
}

type ParseResult =
  | { ok: true; value: LandingExperimentDraft }
  | { ok: false; error: string }

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max)
}

function containsMarkup(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value) || /javascript\s*:/i.test(value)
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : Number.NaN
}

export function parseLandingExperimentDraft(input: Record<string, unknown>): ParseResult {
  const hypothesis = cleanText(input.hypothesis, 600)
  const variable = typeof input.variable === 'string' ? input.variable.toUpperCase() : ''
  const maximumValueLength = variable === 'HEADLINE' ? 180 : variable === 'CTA_LABEL' ? 80 : 500
  const challengerValue = cleanText(input.challengerValue, maximumValueLength)
  const minimumVisitorsPerVariant = boundedInteger(input.minimumVisitorsPerVariant, 100, 50, 1_000_000)
  const minimumConversionsPerVariant = boundedInteger(input.minimumConversionsPerVariant, 10, 1, 100_000)
  const challengerAllocationPercent = boundedInteger(input.challengerAllocationPercent, 50, 10, 90)

  if (!hypothesis || !challengerValue) {
    return { ok: false, error: 'Hypothesis and challenger value are required.' }
  }
  if (!LANDING_EXPERIMENT_VARIABLES.includes(variable as LandingExperimentVariable)) {
    return { ok: false, error: 'Experiment variable must be HEADLINE, SUBHEADLINE, or CTA_LABEL.' }
  }
  if (![minimumVisitorsPerVariant, minimumConversionsPerVariant, challengerAllocationPercent].every(Number.isFinite)) {
    return { ok: false, error: 'Experiment evidence thresholds or allocation are outside the allowed range.' }
  }
  if (containsMarkup(hypothesis) || containsMarkup(challengerValue)) {
    return { ok: false, error: 'Experiment content must be plain text without HTML or scripts.' }
  }

  return {
    ok: true,
    value: {
      hypothesis,
      variable: variable as LandingExperimentVariable,
      challengerValue,
      minimumVisitorsPerVariant,
      minimumConversionsPerVariant,
      challengerAllocationPercent,
    },
  }
}

export function buildChallengerSnapshot(
  control: PublicLandingPageSnapshot,
  variable: LandingExperimentVariable,
  challengerValue: string,
): PublicLandingPageSnapshot {
  const challenger = structuredClone(control)
  if (variable === 'HEADLINE') challenger.headline = challengerValue
  if (variable === 'SUBHEADLINE') challenger.subheadline = challengerValue
  if (variable === 'CTA_LABEL') challenger.primaryCta.label = challengerValue
  return challenger
}

export function applyChallengerToDraft(
  draft: LandingPageDraft,
  variable: LandingExperimentVariable,
  challenger: PublicLandingPageSnapshot,
): LandingPageDraft {
  if (variable === 'HEADLINE') return { ...draft, headline: challenger.headline }
  if (variable === 'SUBHEADLINE') return { ...draft, subheadline: challenger.subheadline }
  return { ...draft, primaryCtaLabel: challenger.primaryCta.label }
}

export function assignLandingExperimentVariant(args: {
  secret: string
  experimentId: string
  fingerprintParts: string[]
  challengerAllocationPercent: number
}): LandingExperimentVariant {
  const digest = createHmac('sha256', args.secret)
    .update(['landing-experiment-allocation:v1', args.experimentId, ...args.fingerprintParts].join('\u001f'))
    .digest()
  const bucket = digest.readUInt32BE(0) % 100
  return bucket < args.challengerAllocationPercent ? 'CHALLENGER' : 'CONTROL'
}

function assignmentSignature(secret: string, encodedPayload: string): string {
  return createHmac('sha256', secret).update(`landing-experiment-assignment:v1:${encodedPayload}`).digest('base64url')
}

export function createLandingExperimentToken(
  secret: string,
  assignment: Omit<LandingExperimentAssignment, 'expiresAt'> & { expiresAt?: number },
): string {
  const payload: LandingExperimentAssignment = {
    ...assignment,
    expiresAt: assignment.expiresAt ?? Date.now() + 7 * 24 * 60 * 60_000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${assignmentSignature(secret, encoded)}`
}

export function verifyLandingExperimentToken(secret: string, token: unknown): LandingExperimentAssignment | null {
  if (secret.trim().length < 32 || typeof token !== 'string' || token.length > 2_000) return null
  const [encoded, suppliedSignature, extra] = token.split('.')
  if (!encoded || !suppliedSignature || extra) return null
  const expectedSignature = assignmentSignature(secret, encoded)
  const expected = Buffer.from(expectedSignature)
  const supplied = Buffer.from(suppliedSignature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<LandingExperimentAssignment>
    if (
      typeof parsed.experimentId !== 'string'
      || typeof parsed.landingPageId !== 'string'
      || !LANDING_EXPERIMENT_VARIANTS.includes(parsed.variant as LandingExperimentVariant)
      || typeof parsed.expiresAt !== 'number'
      || parsed.expiresAt <= Date.now()
    ) return null
    return parsed as LandingExperimentAssignment
  } catch {
    return null
  }
}

export function landingExperimentSnapshotHash(snapshot: PublicLandingPageSnapshot): string {
  return hashLandingPageSnapshot(snapshot)
}

export function summarizeLandingExperimentVariant(args: {
  reportedViews: number
  reportedClicks: number
  confirmedSubmissions: number
  minimumVisitorsPerVariant: number
  minimumConversionsPerVariant: number
}): LandingExperimentVariantEvidence {
  const reportedViews = Math.max(0, args.reportedViews)
  const confirmedSubmissions = Math.max(0, args.confirmedSubmissions)
  return {
    reportedViews,
    reportedClicks: Math.max(0, args.reportedClicks),
    confirmedSubmissions,
    confirmedSubmissionRate: reportedViews > 0 ? confirmedSubmissions / reportedViews : null,
    minimumEvidenceMet:
      reportedViews >= args.minimumVisitorsPerVariant
      && confirmedSubmissions >= args.minimumConversionsPerVariant,
  }
}
