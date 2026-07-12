import { describe, expect, it } from 'vitest'
import { reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'

const strategy = {
  keyMessage: 'Prepare for a clear dental consultation',
  primaryOffer: 'Book a dental consultation',
  contentPillars: ['dental education', 'consultation preparation'],
  contentAnglesDetailed: [
    { title: 'Questions for your dentist', cta: 'Save the consultation checklist' },
    { title: 'Understand treatment options', cta: 'Book a consultation' },
  ],
}

const facts = ['Noura Dental Studio', 'Dental consultations and treatment planning']

describe('contentPlanApprovalGuard', () => {
  it('blocks the observed clinic-operations drift at approval time', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'The front desk feels the handoff problem before leadership. Bring this workflow checklist to your team meeting.' },
      { contentPlanIndex: 2, caption: 'Use request, owner, last update, and next admin step for every appointment.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unexpected_operational_saas_drift')
  })

  it('blocks unsupported performance or guarantee claims even when vocabulary overlaps', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Save these dental consultation questions for guaranteed results.' },
      { contentPlanIndex: 2, caption: 'Understand treatment options, then book a dental consultation.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.some(issue => issue.reason.includes('guarantee'))).toBe(true)
  })

  it('allows aligned, review-safe drafts', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Save three questions to ask your dentist during a dental consultation.' },
      { contentPlanIndex: 2, caption: 'Understand the treatment options and book a dental consultation to discuss next steps.' },
    ], strategy, facts)

    expect(review).toEqual({ ok: true, issues: [] })
  })
})
