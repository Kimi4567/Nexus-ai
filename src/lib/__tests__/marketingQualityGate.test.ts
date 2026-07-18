import { describe, expect, it } from 'vitest'
import {
  isPersistedMarketingQualityGatePassed,
  reviewBrandTruthConsistency,
  reviewStrategyGrounding,
} from '@/lib/ai/marketingQualityGate'

const dentalBrand = {
  brandName: 'Noura Dental Studio',
  industry: 'Dental clinic',
  description: 'A local dental clinic offering consultations and treatment planning.',
  primaryOffer: 'Book a dental consultation',
  targetAudience: 'Adults aged 25-54 in Abu Dhabi who want clear treatment guidance.',
  audienceAge: '25-54',
  audiencePainPoints: ['Unclear treatment options'],
  audienceDesires: ['A confident consultation decision'],
  conversionDestination: 'https://example.test/book-consultation',
  topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
  verifiedProof: [],
}

const groundedStrategy = {
  positioning: 'Clear dental consultation guidance for adults in Abu Dhabi.',
  keyMessage: 'Understand your dental treatment options before booking.',
  differentiation: 'A consultation-first dental experience with clear next steps.',
  targetAudienceRefined: 'Adults aged 25-54 in Abu Dhabi.',
  contentPillars: ['Dental education', 'Consultation preparation', 'Treatment options'],
  topHooks: ['Not sure what to ask your dentist?'],
  ctaVariations: ['Book a dental consultation'],
  contentAnglesDetailed: [{
    title: 'Questions for your dental consultation',
    hook: 'Bring these questions to your dentist.',
    pain: 'Treatment options can feel unclear.',
    desiredOutcome: 'A more informed consultation.',
    objection: 'I do not know where to begin.',
    platform: 'INSTAGRAM',
    cta: 'Book a dental consultation',
  }],
}

describe('marketingQualityGate', () => {
  it('blocks contradictory structured and narrative audience ages', () => {
    const report = reviewBrandTruthConsistency({
      ...dentalBrand,
      audienceAge: '45-54',
    }, '2026-07-14T00:00:00.000Z')

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('brand_age_range_conflict')
  })

  it('blocks strategy readiness when the saved industry conflicts with the business description', () => {
    const report = reviewBrandTruthConsistency({
      ...dentalBrand,
      industry: 'Health & Beauty',
    }, '2026-07-14T00:00:00.000Z')

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('brand_industry_too_broad_or_misaligned')
  })

  it('accepts vertical SaaS when customer-domain words also appear in the profile', () => {
    const report = reviewBrandTruthConsistency({
      brandName: 'ClinicFlow UAE',
      industry: 'Software & Tech',
      description: 'A B2B SaaS platform for private dental clinics that manages appointments and front-desk workflows.',
      primaryOffer: 'Monthly clinic operations software subscription.',
      targetAudience: 'Owners and managers of dental clinics in the UAE.',
      verifiedProof: [],
    }, '2026-07-16T00:00:00.000Z')

    expect(report.status).toBe('passed')
    expect(report.blockers.map(item => item.code)).not.toContain('brand_industry_too_broad_or_misaligned')
  })

  it('allows missing proof as a visible limitation rather than inventing it', () => {
    const report = reviewStrategyGrounding({
      strategy: groundedStrategy,
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM', 'FACEBOOK'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('passed')
    expect(report.warnings.map(item => item.code)).toContain('verified_proof_missing')
    expect(isPersistedMarketingQualityGatePassed(report)).toBe(true)
  })

  it('blocks customer-facing internal workflow copy for a dental provider', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          title: 'Fix the front desk handoff',
          hook: 'Leadership sees the handoff problem at the team meeting.',
          cta: 'Compare the current workflow and save this idea for review.',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('customer_copy_drifted_to_internal_operations')
  })

  it('blocks audience expansion and channels that were never reviewed', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        targetAudienceRefined: 'Families with children who recently moved to Abu Dhabi.',
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          platform: 'LINKEDIN',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('ungrounded_audience_expansion')
    expect(report.blockers.map(item => item.code)).toContain('platform_outside_reviewed_scope')
  })

  it('blocks a reviewed platform that disappears from the strategy plan', () => {
    const report = reviewStrategyGrounding({
      strategy: groundedStrategy,
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM', 'PINTEREST'],
      requireAllReviewedPlatforms: true,
      checkedAt: '2026-07-18T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('reviewed_platform_missing_from_strategy')
  })

  it('blocks unsourced platform-growth claims and allows an explicit validation hypothesis', () => {
    const unsourced = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        channelMix: [{
          platform: 'INSTAGRAM',
          rationale: 'Instagram is the highest-engagement and most effective platform for this category.',
          contentFrequency: 'Review after evidence exists',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(unsourced.blockers.map(item => item.code)).toContain('unsourced_channel_market_claim')

    const hypothesis = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        channelMix: [{
          platform: 'INSTAGRAM',
          rationale: 'Planning hypothesis to validate: Instagram may be a high-engagement review surface for the saved audience.',
          contentFrequency: 'Review after evidence exists',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(hypothesis.blockers.map(item => item.code)).not.toContain('unsourced_channel_market_claim')
  })

  it('blocks an unsupported quality superlative before paid review or approval', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        keyMessage: 'Experience the freshest premium care in Abu Dhabi.',
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.filter(item => item.code === 'unsupported_quality_superlative')).toHaveLength(2)
  })

  it('preserves a user-supplied premium position', () => {
    const report = reviewStrategyGrounding({
      strategy: { ...groundedStrategy, positioning: 'Premium consultation guidance for adults.' },
      brand: { ...dentalBrand, description: 'A premium dental consultation studio.' },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('unsupported_quality_superlative')
  })

  it('blocks shopping CTAs when no conversion destination exists', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        ctaVariations: ['Shop the look', 'Browse our collection'],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women aged 25-34 in the UAE.',
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('conversion_cta_without_destination')
  })

  it('blocks unsupported fashion use, culture, collection, and material claims', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        positioning: 'Modern abayas for women in the UAE.',
        targetAudienceRefined: 'Style-conscious professionals seeking office wear.',
        contentPillars: ['Cultural heritage', 'A varied collection for every occasion'],
        ctaVariations: ['Review the documented details'],
        contentAnglesDetailed: [{
          title: 'Comfortable premium fabrics for meetings',
          platform: 'INSTAGRAM',
          cta: 'Review the documented details',
        }],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women aged 25-34 in the UAE.',
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.filter(item => item.code === 'ungrounded_brand_context')).toHaveLength(4)
  })

  it('does not treat a negated premium statement as approved positioning', () => {
    const report = reviewStrategyGrounding({
      strategy: { ...groundedStrategy, positioning: 'Premium consultation guidance for adults.' },
      brand: { ...dentalBrand, description: 'A local clinic, not premium positioning.' },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).toContain('unsupported_quality_superlative')
  })

  it('allows workflow language when the saved offer is operations software', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Clinic workflow software for front desk teams.',
        keyMessage: 'Give every clinic handoff a clear owner.',
        differentiation: 'A shared clinic operations dashboard.',
        targetAudienceRefined: 'Clinic operations managers.',
        contentPillars: ['Workflow visibility', 'Front desk handoff', 'Clinic operations'],
        topHooks: ['Who owns the next handoff?'],
        ctaVariations: ['Request a software demo'],
        contentAnglesDetailed: [{
          title: 'Front desk handoff checklist',
          hook: 'Give the workflow one visible owner.',
          pain: 'Internal requests get lost.',
          desiredOutcome: 'Clearer team ownership.',
          objection: 'We already use spreadsheets.',
          platform: 'LINKEDIN',
          cta: 'Request a software demo',
        }],
      },
      brand: {
        brandName: 'ClinicFlow',
        industry: 'SaaS',
        description: 'Clinic management software for front desk operations.',
        primaryOffer: 'A clinic workflow platform',
        targetAudience: 'Clinic operations managers',
        topPlatforms: ['LINKEDIN'],
        verifiedProof: [],
      },
      allowedPlatforms: ['LINKEDIN'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('passed')
  })

  it('treats an operating system as an operations product and YouTube Shorts as the reviewed YouTube channel', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'An AI marketing operating system for a reviewable workflow.',
        keyMessage: 'Give the marketing workflow a clear owner and next step.',
        differentiation: 'One operating system for strategy, approval, and learning.',
        targetAudienceRefined: 'Founders and lean marketing leads at growing businesses.',
        contentPillars: ['Workflow clarity', 'Approval control', 'Measured learning'],
        topHooks: ['Who owns the next marketing decision?'],
        ctaVariations: ['Review the workflow'],
        contentAnglesDetailed: [{
          title: 'Marketing workflow review',
          hook: 'Give every marketing decision a reviewable next step.',
          pain: 'Marketing work is scattered across tools and people.',
          desiredOutcome: 'A governed marketing workflow.',
          objection: 'We already use several tools.',
          platform: 'YouTube Shorts',
          cta: 'Review the workflow',
        }],
      },
      brand: {
        brandName: 'NEXUS AI',
        industry: 'Tech & Apps',
        description: 'An AI marketing operating system for growing businesses.',
        primaryOffer: 'A governed marketing operating system subscription.',
        targetAudience: 'Founders and lean marketing leads at growing businesses.',
        audiencePainPoints: ['Marketing work is scattered across tools and people'],
        topPlatforms: ['YOUTUBE'],
        verifiedProof: [],
      },
      allowedPlatforms: ['YOUTUBE'],
      checkedAt: '2026-07-15T00:00:00.000Z',
    })

    expect(report.status).toBe('passed')
    expect(report.blockers).toEqual([])
  })
})
