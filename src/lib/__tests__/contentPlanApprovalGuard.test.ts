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
  it('blocks invented SaaS capabilities and outcomes that are absent from Brand Brain', () => {
    const review = reviewContentPlanForApproval([
      { caption: 'Our system offers seamless integration and instant support while reducing your costs.' },
    ], {}, ['Unified lead management with clear reports'])

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unverified_feature_or_outcome')
  })

  it('does not block a capability explicitly supplied by Brand Brain', () => {
    const review = reviewContentPlanForApproval([
      { caption: 'The system integrates with HubSpot for a connected workflow.' },
    ], {}, ['Native HubSpot integration is included.'])

    expect(review.issues.map(issue => issue.reason)).not.toContain('unverified_feature_or_outcome')
  })

  it('blocks the observed clinic-operations drift at approval time', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'The front desk feels the handoff problem before leadership. Bring this workflow checklist to your team meeting.' },
      { contentPlanIndex: 2, caption: 'Use request, owner, last update, and next admin step for every appointment.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unexpected_operational_saas_drift')
  })

  it('does not let a stale clinic-software strategy override dental Brand Brain facts', () => {
    const staleStrategy = {
      positioning: 'A workflow platform for clinic front-desk teams',
      contentPillars: ['clinic workflow', 'bilingual administrative communication'],
      contentAnglesDetailed: [
        { title: 'Front-desk handoff', hook: 'Map the admin workflow' },
      ],
    }
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'The front desk feels the handoff problem before leadership. Bring this workflow checklist to your team meeting.' },
    ], staleStrategy, [
      'Noura Dental Studio',
      'Dental clinic providing preventive, cosmetic, and restorative consultations',
    ])

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

  it('blocks generic legacy hook formulas before approval or publishing', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'هل تعلم أن التسويق الذكي يمكن أن يغير مسار شركتك؟' },
      { contentPlanIndex: 2, caption: 'Did you know analytics can transform your business?' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.filter(issue => issue.reason === 'generic_hook_formula')).toHaveLength(2)
  })

  it('blocks shopping CTAs when Brand Brain has no verified conversion destination', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Shop the look and browse our collection.' },
      { contentPlanIndex: 2, caption: 'تسوق الآن واكتشف المجموعة.' },
    ], {
      keyMessage: 'Modern abayas for women in the UAE',
      contentAnglesDetailed: [
        { title: 'Modern abaya details' },
        { title: 'Product selection' },
      ],
    }, ['Modern abayas for women in the UAE'])

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unverified_feature_or_outcome')
  })

  it('blocks polished but non-specific analytics, quality, and help formulas', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'التحليلات ليست مجرد أرقام، بل هي مفتاح النجاح!' },
      { contentPlanIndex: 2, caption: 'الجودة تبدأ من هنا: الموافقات البشرية.' },
      { contentPlanIndex: 3, caption: 'اكتشف كيف يمكننا مساعدتك في النمو.' },
      { contentPlanIndex: 4, caption: 'Analytics are more than just numbers; they are the key to success.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.filter(issue => issue.reason === 'generic_hook_formula')).toHaveLength(4)
  })

  it('allows aligned, review-safe drafts', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Save three questions to ask your dentist during a dental consultation.' },
      { contentPlanIndex: 2, caption: 'Understand the treatment options and book a dental consultation to discuss next steps.' },
    ], strategy, facts)

    expect(review).toEqual({ ok: true, issues: [] })
  })
})
