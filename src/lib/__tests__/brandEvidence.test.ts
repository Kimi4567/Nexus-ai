import { describe, expect, it } from 'vitest'
import {
  BRAND_EVIDENCE_MAX_BYTES,
  buildPromotedEvidenceProof,
  classifyEvidenceClaimTruth,
  guardEvidenceClaims,
  mergeApprovedEvidenceProofs,
  sanitizeEvidenceFileName,
  validateEvidenceFile,
} from '@/lib/brandEvidence'

describe('brand evidence contract', () => {
  it('accepts only supported matching MIME and extension pairs', () => {
    expect(validateEvidenceFile({ fileName: 'brand.pdf', mimeType: 'application/pdf', sizeBytes: 100 })).toMatchObject({ ok: true })
    expect(validateEvidenceFile({
      fileName: 'brand-deck.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: 100,
    })).toMatchObject({ ok: true, extension: 'pptx' })
    expect(validateEvidenceFile({
      fileName: 'brand-deck.pdf',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: 100,
    })).toEqual({ ok: false, error: 'unsupported_file_type' })
    expect(validateEvidenceFile({ fileName: 'brand.exe', mimeType: 'application/pdf', sizeBytes: 100 })).toEqual({ ok: false, error: 'unsupported_file_type' })
    expect(validateEvidenceFile({ fileName: 'brand.pdf', mimeType: 'application/pdf', sizeBytes: BRAND_EVIDENCE_MAX_BYTES + 1 })).toEqual({ ok: false, error: 'file_too_large' })
  })

  it('creates a path-safe file name without trusting user path segments', () => {
    expect(sanitizeEvidenceFileName('../../My Brand Proof.pdf')).toBe('My-Brand-Proof.pdf')
  })

  it('keeps only claims anchored to an exact excerpt', () => {
    const source = 'Nexus completed 240 customer projects in 2025. The company is ISO 27001 certified.'
    expect(guardEvidenceClaims({ claims: [
      {
        claim: 'Nexus completed 240 customer projects in 2025.',
        category: 'performance',
        evidenceExcerpt: 'Nexus completed 240 customer projects in 2025.',
        sourceLocator: 'Page 2',
        confidence: 0.95,
      },
      {
        claim: 'Nexus generated $2 million.',
        category: 'performance',
        evidenceExcerpt: 'Nexus completed 240 customer projects in 2025.',
      },
      {
        claim: 'Nexus has won many awards.',
        evidenceExcerpt: 'This sentence does not exist.',
      },
    ] }, source)).toEqual([
      {
        claim: 'Nexus completed 240 customer projects in 2025.',
        category: 'PERFORMANCE',
        evidenceExcerpt: 'Nexus completed 240 customer projects in 2025.',
        sourceLocator: 'Page 2',
        confidence: 0.95,
      },
    ])
  })

  it('keeps source identity in the promoted proof', () => {
    expect(buildPromotedEvidenceProof(
      { claim: 'Nexus is ISO certified.', sourceLocator: 'Page 4' },
      'certification.pdf',
    )).toBe('Nexus is ISO certified. [Source: certification.pdf — Page 4]')
  })

  it('flags only a near-identical confirmed statement with conflicting numbers', () => {
    const existing = [{
      id: 'claim-old',
      category: 'PERFORMANCE',
      truthStatus: 'CONFIRMED',
      claim: 'Average customer acquisition cost was AED 120 in Q2.',
    }]

    expect(classifyEvidenceClaimTruth({
      category: 'PERFORMANCE',
      claim: 'Average customer acquisition cost was AED 180 in Q2.',
    }, existing)).toMatchObject({
      truthStatus: 'CONFLICTING',
      conflictClaimId: 'claim-old',
    })
  })

  it('does not hallucinate a conflict for non-numeric or unrelated evidence', () => {
    const existing = [{
      id: 'claim-old',
      category: 'COMPANY',
      truthStatus: 'CONFIRMED',
      claim: 'The company serves hospitality teams.',
    }]

    expect(classifyEvidenceClaimTruth({
      category: 'COMPANY',
      claim: 'The company also serves retail teams.',
    }, existing)).toEqual({
      truthStatus: 'PROPOSED',
      conflictClaimId: null,
      conflictReason: null,
    })
    expect(classifyEvidenceClaimTruth({
      category: 'OFFER',
      claim: 'The annual plan costs AED 999.',
    }, existing)).toMatchObject({ truthStatus: 'PROPOSED' })
  })

  it('does not let a stale form erase approved source-linked proof', () => {
    expect(mergeApprovedEvidenceProofs(
      ['Manual proof'],
      ['Source proof', 'Source proof'],
    )).toEqual(['Manual proof', 'Source proof'])
  })
})
