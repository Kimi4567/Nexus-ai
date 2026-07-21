import { describe, expect, it } from 'vitest'
import {
  assignLandingExperimentVariant,
  buildChallengerSnapshot,
  createLandingExperimentToken,
  parseLandingExperimentDraft,
  summarizeLandingExperimentVariant,
  verifyLandingExperimentToken,
} from '@/lib/landingPageExperiment'

const snapshot = {
  schemaVersion: 1 as const,
  publicId: 'public-page-1',
  locale: 'EN' as const,
  headline: 'Control headline',
  subheadline: 'Control subheadline',
  body: 'Body',
  benefits: ['One'],
  proof: null,
  primaryCta: { label: 'Start', href: '/lead-form/form-1?lp=public-page-1', kind: 'LEAD_FORM' as const, captureFormPublicId: 'form-1' },
  theme: { variant: 'MIDNIGHT' as const },
}

describe('landing-page experiment contract', () => {
  it('allows exactly one supported variable and rejects markup or unsafe thresholds', () => {
    expect(parseLandingExperimentDraft({ hypothesis: 'A clearer headline increases qualified inquiries.', variable: 'HEADLINE', challengerValue: 'A clearer offer' }).ok).toBe(true)
    expect(parseLandingExperimentDraft({ hypothesis: 'Test', variable: 'BODY', challengerValue: 'Change' })).toMatchObject({ ok: false })
    expect(parseLandingExperimentDraft({ hypothesis: '<script>x</script>', variable: 'HEADLINE', challengerValue: 'Change' })).toMatchObject({ ok: false })
    expect(parseLandingExperimentDraft({ hypothesis: 'Test', variable: 'HEADLINE', challengerValue: 'Change', minimumVisitorsPerVariant: 10 })).toMatchObject({ ok: false })
  })

  it('changes only the declared field in the challenger snapshot', () => {
    const challenger = buildChallengerSnapshot(snapshot, 'CTA_LABEL', 'Book now')
    expect(challenger.primaryCta.label).toBe('Book now')
    expect(challenger.headline).toBe(snapshot.headline)
    expect(challenger.primaryCta.href).toBe(snapshot.primaryCta.href)
    expect(snapshot.primaryCta.label).toBe('Start')
  })

  it('assigns the same fingerprint deterministically', () => {
    const args = { secret: 'a'.repeat(32), experimentId: 'experiment-1', fingerprintParts: ['ip', 'ua', 'en'], challengerAllocationPercent: 50 }
    expect(assignLandingExperimentVariant(args)).toBe(assignLandingExperimentVariant(args))
  })

  it('signs assignments and refuses tampered or expired tokens', () => {
    const secret = 'a'.repeat(32)
    const token = createLandingExperimentToken(secret, { experimentId: 'experiment-1', landingPageId: 'page-1', variant: 'CHALLENGER' })
    expect(verifyLandingExperimentToken(secret, token)).toMatchObject({ experimentId: 'experiment-1', variant: 'CHALLENGER' })
    expect(verifyLandingExperimentToken(secret, `${token}x`)).toBeNull()
    const expired = createLandingExperimentToken(secret, { experimentId: 'experiment-1', landingPageId: 'page-1', variant: 'CONTROL', expiresAt: Date.now() - 1 })
    expect(verifyLandingExperimentToken(secret, expired)).toBeNull()
  })

  it('marks evidence ready only when both declared floors are met without claiming a winner', () => {
    expect(summarizeLandingExperimentVariant({ reportedViews: 100, reportedClicks: 20, confirmedSubmissions: 9, minimumVisitorsPerVariant: 100, minimumConversionsPerVariant: 10 })).toMatchObject({ minimumEvidenceMet: false, confirmedSubmissionRate: 0.09 })
    expect(summarizeLandingExperimentVariant({ reportedViews: 100, reportedClicks: 20, confirmedSubmissions: 10, minimumVisitorsPerVariant: 100, minimumConversionsPerVariant: 10 })).toMatchObject({ minimumEvidenceMet: true, confirmedSubmissionRate: 0.1 })
  })
})
