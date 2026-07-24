import { describe, expect, it } from 'vitest'

import {
  buildApprovalPreferencePlans,
  type ApprovalPreferenceEvent,
  type ApprovalPreferencePost,
} from '@/lib/approvalPreferenceLearning'

function event(
  id: string,
  socialPostId: string,
  createdAt = '2026-07-23T10:00:00.000Z',
): ApprovalPreferenceEvent {
  return { id, socialPostId, campaignId: 'campaign-1', createdAt }
}

function post(
  id: string,
  caption: string,
  overrides: Partial<ApprovalPreferencePost> = {},
): ApprovalPreferencePost {
  return {
    id,
    campaignId: 'campaign-1',
    platform: 'META',
    publishTarget: 'INSTAGRAM',
    caption,
    status: 'APPROVED',
    approvedSnapshotId: 'snapshot-1',
    ...overrides,
  }
}

describe('buildApprovalPreferencePlans', () => {
  it('requires three unique, currently reviewed posts with immutable approval snapshots', () => {
    const result = buildApprovalPreferencePlans({
      events: [event('e1', 'p1'), event('e2', 'p2'), event('e3', 'p3')],
      posts: [
        post('p1', 'AED 149 per month. Review the details.'),
        post('p2', 'Delivery in 48 hours. Check eligibility.'),
        post('p3', '1 kg each month. Confirm the order.', { approvedSnapshotId: null }),
      ],
    })

    expect(result.uniqueApprovedPostCount).toBe(2)
    expect(result.plans).toHaveLength(0)
  })

  it('deduplicates repeated approval events by post before calculating confidence', () => {
    const result = buildApprovalPreferencePlans({
      events: [
        event('e1', 'p1'),
        event('e2', 'p1', '2026-07-23T11:00:00.000Z'),
        event('e3', 'p2'),
        event('e4', 'p2', '2026-07-23T11:00:00.000Z'),
        event('e5', 'p3'),
      ],
      posts: [
        post('p1', 'AED 149 per month. Review the details.'),
        post('p2', 'Delivery in 48 hours. Check eligibility.'),
        post('p3', '1 kg each month. Confirm the order.'),
      ],
    })

    expect(result.approvalEventCount).toBe(5)
    expect(result.uniqueApprovedPostCount).toBe(3)
    expect(result.duplicateApprovalEventsIgnored).toBe(2)
    expect(result.plans[0]?.evidence.uniqueApprovedPostCount).toBe(3)
    expect(result.plans[0]?.evidence.duplicateApprovalEventsIgnored).toBe(2)
  })

  it('creates reviewable editorial preferences without performance or causal claims', () => {
    const result = buildApprovalPreferencePlans({
      events: [event('e1', 'p1'), event('e2', 'p2'), event('e3', 'p3')],
      posts: [
        post('p1', 'كيلوغرام واحد شهريًا مقابل 149 درهمًا. راجع التفاصيل.'),
        post('p2', 'التوصيل داخل دبي خلال 48 ساعة. تحقق من العنوان.'),
        post('p3', 'مدة المراجعة 4 ساعات. تأكد من ملاءمة الاشتراك.'),
      ],
    })

    expect(result.plans.map(plan => plan.evidence.signalType)).toEqual([
      'concrete_reviewable_details',
      'review_before_action_cta',
    ])
    for (const plan of result.plans) {
      expect(plan.trigger).toBe('approved_content')
      expect(plan.field).toBe('strategicNotes')
      expect(plan.evidence.causalClaim).toBe(false)
      expect(plan.evidence.performanceEvidence).toBe(false)
      expect(plan.proposed).toContain('وليس دليل أداء')
      expect(plan.reason).toContain('ولا يثبت')
    }
  })

  it('does not infer a preference when the pattern is not repeated across the sample', () => {
    const result = buildApprovalPreferencePlans({
      events: [event('e1', 'p1'), event('e2', 'p2'), event('e3', 'p3')],
      posts: [
        post('p1', 'Try a calmer opening.'),
        post('p2', 'A simple statement without a call to action.'),
        post('p3', 'AED 149. Review the details.'),
      ],
    })

    expect(result.plans).toHaveLength(0)
  })

  it('changes the idempotency fingerprint when an approved caption changes', () => {
    const events = [event('e1', 'p1'), event('e2', 'p2'), event('e3', 'p3')]
    const basePosts = [
      post('p1', 'AED 149 per month. Review the details.'),
      post('p2', 'Delivery in 48 hours. Check eligibility.'),
      post('p3', '1 kg each month. Confirm the order.'),
    ]
    const first = buildApprovalPreferencePlans({ events, posts: basePosts })
    const second = buildApprovalPreferencePlans({
      events,
      posts: basePosts.map(item => item.id === 'p3'
        ? { ...item, caption: '2 kg each month. Confirm the order.' }
        : item),
    })

    expect(first.plans[0]?.evidence.fingerprint)
      .not.toBe(second.plans[0]?.evidence.fingerprint)
  })
})
