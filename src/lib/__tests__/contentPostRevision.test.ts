import { describe, expect, it } from 'vitest'
import {
  contentReviewResetData,
  isImmutableExecutionPost,
  mediaReviewResetData,
  reopensContentReview,
} from '@/lib/contentPostRevision'

describe('contentPostRevision', () => {
  it('keeps provider-confirmed and provider-processing records immutable', () => {
    expect(isImmutableExecutionPost('PUBLISHED')).toBe(true)
    expect(isImmutableExecutionPost('PROCESSING')).toBe(true)
    expect(isImmutableExecutionPost('SCHEDULED')).toBe(false)
  })

  it('reopens approved, scheduled, and failed content for review', () => {
    expect(reopensContentReview('APPROVED')).toBe(true)
    expect(reopensContentReview('SCHEDULED')).toBe(true)
    expect(reopensContentReview('FAILED')).toBe(true)
    expect(reopensContentReview('DRAFT')).toBe(false)
  })

  it('clears approval and provider execution assignment without losing the planned target', () => {
    expect(contentReviewResetData('SCHEDULED')).toMatchObject({
      status: 'DRAFT',
      approvedAt: null,
      approvedSnapshotId: null,
      mediaApprovalSnapshotId: null,
      scheduledSnapshotId: null,
      publishMode: 'MANUAL',
      integrationId: null,
      pageId: null,
      autoPublishConsentAt: null,
      platformPostId: null,
    })
    expect(contentReviewResetData('DRAFT')).toEqual({})
  })

  it('retains the copy snapshot when only media changes', () => {
    expect(mediaReviewResetData({
      status: 'SCHEDULED',
      approvedSnapshotId: 'copy-snapshot-2',
    })).toMatchObject({
      status: 'APPROVED',
      mediaApprovalSnapshotId: null,
      scheduledSnapshotId: null,
      publishMode: 'MANUAL',
      integrationId: null,
      autoPublishConsentAt: null,
      platformPostId: null,
    })
    expect(mediaReviewResetData({
      status: 'APPROVED',
      approvedSnapshotId: 'copy-snapshot-2',
    })).not.toHaveProperty('approvedSnapshotId')
    expect(mediaReviewResetData({
      status: 'APPROVED',
      approvedSnapshotId: null,
    })).toMatchObject({
      status: 'DRAFT',
      approvedAt: null,
      approvedSnapshotId: null,
    })
  })
})
