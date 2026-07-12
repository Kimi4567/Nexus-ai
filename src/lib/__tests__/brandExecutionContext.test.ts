import { describe, expect, it } from 'vitest'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'

describe('buildBrandExecutionContext', () => {
  it('separates confirmed inputs from unproven learning candidates', () => {
    const context = buildBrandExecutionContext({
      brandName: 'NEXUS',
      primaryOffer: 'AI marketing operations',
      verifiedProof: ['Used by 20 verified customers'],
      winningHooks: ['Stored hook'],
    })

    expect(context).toContain('CONFIRMED BRAND AND BUSINESS INPUTS')
    expect(context).toContain('Verified proof points: Used by 20 verified customers')
    expect(context).toContain('STORED LEARNING CANDIDATES — USE AS HINTS, NOT VERIFIED FACTS')
    expect(context).toContain('Candidate hooks: Stored hook')
  })

  it('never injects AI inference as verified Brand Brain truth', () => {
    const context = buildBrandExecutionContext({
      brandName: 'NEXUS',
      aiInsights: { summary: 'Invented inference must stay out' },
    })
    expect(context).not.toContain('Invented inference')
    expect(context).not.toContain('aiInsights')
  })

  it('returns an empty context for a missing profile and never emits undefined values', () => {
    expect(buildBrandExecutionContext(null)).toBe('')
    expect(buildBrandExecutionContext({ brandName: 'NEXUS' })).not.toContain('undefined')
  })
})
