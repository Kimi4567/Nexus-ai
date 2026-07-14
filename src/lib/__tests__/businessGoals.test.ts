import { describe, expect, it } from 'vitest'
import {
  businessGoalLabel,
  campaignObjectiveForGoal,
  normalizeBusinessGoal,
} from '@/lib/businessGoals'

describe('business goal normalization', () => {
  it('converts legacy onboarding codes into durable Brand Brain text', () => {
    expect(normalizeBusinessGoal('generate_leads')).toBe('Generate qualified leads')
    expect(normalizeBusinessGoal('increase_sales')).toBe('Increase sales')
  })

  it('preserves user-authored goals without translating or rewriting them', () => {
    expect(normalizeBusinessGoal('Book qualified consultations in Dubai')).toBe('Book qualified consultations in Dubai')
  })

  it('returns localized display labels while keeping campaign objectives semantic', () => {
    expect(businessGoalLabel('build_awareness', 'ar')).toBe('بناء الوعي بالعلامة التجارية')
    expect(campaignObjectiveForGoal('generate_leads')).toBe('leads')
    expect(campaignObjectiveForGoal('retain_customers')).toBeNull()
  })
})
