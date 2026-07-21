import { describe, expect, it } from 'vitest'
import {
  calculateLeadResponseDueAt,
  canTransitionLeadStage,
  isLeadResponseOverdue,
  leadStageTransitionOptions,
  normalizeLeadEmail,
  normalizeLeadPhone,
  sanitizeLeadAttribution,
  stageProvidesContactEvidence,
} from '@/lib/leadLifecycle'

describe('lead lifecycle', () => {
  it('normalizes deduplication identities without inventing missing contact data', () => {
    expect(normalizeLeadEmail('  USER@Example.COM ')).toBe('user@example.com')
    expect(normalizeLeadEmail('not-an-email')).toBeNull()
    expect(normalizeLeadPhone('+971 (50) 123-4567')).toBe('+971501234567')
    expect(normalizeLeadPhone('123')).toBeNull()
  })

  it('allows explicit funnel progression and controlled reopening only', () => {
    expect(canTransitionLeadStage('NEW', 'CONTACTED')).toBe(true)
    expect(canTransitionLeadStage('NEW', 'WON')).toBe(false)
    expect(canTransitionLeadStage('WON', 'OPPORTUNITY')).toBe(true)
    expect(leadStageTransitionOptions('OPPORTUNITY')).toEqual(['OPPORTUNITY', 'NURTURING', 'WON', 'LOST'])
  })

  it('keeps only bounded first-touch attribution fields', () => {
    expect(sanitizeLeadAttribution({
      source: 'google', medium: 'cpc', campaign: 'summer',
      arbitrarySecret: 'must-not-persist',
    })).toEqual({ source: 'google', medium: 'cpc', campaign: 'summer' })
  })

  it('calculates bounded response SLAs and stops overdue alerts after contact', () => {
    const createdAt = new Date('2026-07-20T10:00:00.000Z')
    expect(calculateLeadResponseDueAt(createdAt, 24).toISOString()).toBe('2026-07-21T10:00:00.000Z')
    expect(calculateLeadResponseDueAt(createdAt, 1000).toISOString()).toBe('2026-07-27T10:00:00.000Z')
    expect(isLeadResponseOverdue({ stage: 'NEW', responseDueAt: '2026-07-20T11:00:00.000Z' }, new Date('2026-07-20T12:00:00.000Z'))).toBe(true)
    expect(isLeadResponseOverdue({ stage: 'CONTACTED', firstContactedAt: '2026-07-20T11:30:00.000Z', responseDueAt: '2026-07-20T11:00:00.000Z' }, new Date('2026-07-20T12:00:00.000Z'))).toBe(false)
    expect(stageProvidesContactEvidence('QUALIFIED')).toBe(true)
    expect(stageProvidesContactEvidence('NEW')).toBe(false)
  })
})
