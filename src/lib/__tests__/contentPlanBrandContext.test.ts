import { describe, expect, it } from 'vitest'
import { resolveContentPlanBrandName } from '@/lib/contentPlanBrandContext'

describe('resolveContentPlanBrandName', () => {
  it('prefers Brand Brain brandName over workspace owner/account name', () => {
    expect(resolveContentPlanBrandName({
      name: 'استراتيجية نمو عضوي لـ ClinicFlow AI',
      workspace: {
        name: 'Nesrin Living Studio',
        brandProfile: { brandName: 'ClinicFlow AI' },
      },
    })).toBe('ClinicFlow AI')
  })

  it('extracts Arabic campaign brand when Brand Brain is missing', () => {
    expect(resolveContentPlanBrandName({
      name: 'استراتيجية نمو عضوي لـ ClinicFlow AI',
      workspace: { name: 'Nesrin Living Studio', brandProfile: { brandName: '' } },
    })).toBe('ClinicFlow AI')
  })

  it('extracts English campaign brand when Brand Brain is missing', () => {
    expect(resolveContentPlanBrandName({
      name: 'Organic growth strategy for ClinicFlow AI',
      workspace: { name: 'Nesrin Living Studio' },
    })).toBe('ClinicFlow AI')
  })

  it('falls back to workspace name only when no brand signal exists', () => {
    expect(resolveContentPlanBrandName({
      name: 'Summer campaign',
      workspace: { name: 'Nesrin Living Studio' },
    })).toBe('Nesrin Living Studio')
  })
})
