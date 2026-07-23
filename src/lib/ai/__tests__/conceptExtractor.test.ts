import { describe, expect, it } from 'vitest'
import { extractVisualConcept } from '@/lib/ai/conceptExtractor'

describe('extractVisualConcept', () => {
  it('uses a grounded interior-design concept before the broad property fallback', async () => {
    const concept = await extractVisualConcept({
      text: 'تصور ثلاثي الأبعاد ولوحة مواد لمشروع تصميم داخلي.',
      industry: 'Home & Furniture',
      brandName: 'دار سكنى',
      language: 'ar',
    })

    expect(concept.centralElement).toContain('interior designer')
    expect(concept.headline).toBe('راجع تصور مساحتك قبل التنفيذ')
    expect(concept.headline).not.toMatch(/الأفضل|أحلامك/)
  })

  it('does not turn ordinary interior cost and execution language into a SaaS workflow metaphor', async () => {
    const concept = await extractVisualConcept({
      text: 'Show the same living room before and after renovation. راجع التكلفة والمراحل قبل التنفيذ.',
      industry: 'Home & Furniture',
      brandName: 'دار سكنى',
      language: 'ar',
    })

    expect(concept.centralElement).toContain('same residential living room')
    expect(concept.centralElement).toContain('pre-renovation')
    expect(concept.centralElement).toContain('completed interior')
    expect(concept.centralElement).not.toMatch(/tokens|workflow|six distinct tactile stages/)
  })

  it('translates an unsafe interior cost chart into a truthful physical planning scene', async () => {
    const concept = await extractVisualConcept({
      text: 'A detailed cost breakdown chart for interior design phases, focused on clarity and organization.',
      industry: 'Home & Furniture',
      brandName: 'دار سكنى',
      language: 'en',
    })

    expect(concept.centralElement).toContain('project-phase trays')
    expect(concept.centralElement).toContain('scope and cost planning')
    expect(concept.centralElement).not.toMatch(/chart|dashboard|tokens/)
  })

  it('keeps a team-led interior brief as a collaborative interior-design scene', async () => {
    const concept = await extractVisualConcept({
      text: 'A team of interior designers actively working on a residential project.',
      industry: 'Home & Furniture',
      brandName: 'دار سكنى',
      language: 'en',
    })

    expect(concept.centralElement).toContain('team of interior designers')
    expect(concept.centralElement).toContain('residential scale model')
  })

  it('keeps the unknown-industry fallback explicitly review-only', async () => {
    const concept = await extractVisualConcept({
      text: 'تفاصيل العرض',
      industry: 'Other',
      brandName: 'علامة تجريبية',
      language: 'ar',
    })

    expect(concept.headline).toContain('للمراجعة')
    expect(concept.headline).not.toContain('الأفضل')
    expect(concept.cta).toBe('راجع التفاصيل')
  })
})
