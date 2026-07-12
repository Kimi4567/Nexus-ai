import { describe, expect, it } from 'vitest'
import { generateAdConcepts, generateMarketingStrategy, generateScript } from '@/lib/ai/mock'

describe('no-provider AI fallback truth contract', () => {
  it('returns a labelled planning hypothesis without performance targets', async () => {
    const strategy = await generateMarketingStrategy({ name: 'Acme', audience: 'operators', goal: 'LEADS', platforms: ['LINKEDIN'] }, { businessType: 'software' })
    expect(strategy.evidenceStatus).toBe('planning_hypothesis')
    expect(strategy.metrics.evidenceStatus).toBe('not_available')
    const serialized = JSON.stringify(strategy).toLowerCase()
    expect(serialized).not.toMatch(/targetctr|targetroas|expectedreach|3x more|customers achieved|sales increased/)
  })

  it('never invents reach or customer proof in concepts and scripts', async () => {
    const concepts = await generateAdConcepts({ name: 'Acme', audience: 'operators', platforms: ['INSTAGRAM'] }, null)
    expect(concepts.every((concept) => concept.estimatedReach === null)).toBe(true)
    expect(JSON.stringify(concepts).toLowerCase()).not.toMatch(/real customer|thousands|doubled|guaranteed/)
    expect(await generateScript('a product launch')).toContain('NO PERFORMANCE EVIDENCE')
  })
})
