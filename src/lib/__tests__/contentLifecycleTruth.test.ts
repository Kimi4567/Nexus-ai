import { describe, expect, it } from 'vitest'
import { deriveContentLifecycleTruth } from '@/lib/contentLifecycleTruth'

const validSchedule = {
  status: 'SCHEDULED',
  approvedAt: '2026-07-15T08:00:00.000Z',
  approvedSnapshotId: 'copy-1',
  imageUrl: 'https://cdn.example.com/post.jpg',
  mediaSource: 'GENERATE',
  generationStatus: 'DONE',
  mediaApprovalSnapshotId: 'media-1',
  scheduledAt: '2026-07-16T08:00:00.000Z',
  scheduledSnapshotId: 'schedule-1',
}

describe('content lifecycle truth', () => {
  it('accepts a schedule only when copy, media, time, and schedule revisions are immutable', () => {
    const truth = deriveContentLifecycleTruth(validSchedule)
    expect(truth.isValidScheduled).toBe(true)
    expect(truth.isInvalidScheduled).toBe(false)
    expect(truth.hasImmutableCopyApproval).toBe(true)
    expect(truth.hasFinalMediaApproval).toBe(true)
  })

  it.each([
    ['copy snapshot', { approvedSnapshotId: null }],
    ['approval timestamp', { approvedAt: null }],
    ['media snapshot', { mediaApprovalSnapshotId: null }],
    ['final media', { generationStatus: 'GENERATING' }],
    ['scheduled time', { scheduledAt: null }],
    ['schedule snapshot', { scheduledSnapshotId: null }],
  ])('fails closed when %s is missing', (_label, missing) => {
    const truth = deriveContentLifecycleTruth({ ...validSchedule, ...missing })
    expect(truth.isValidScheduled).toBe(false)
    expect(truth.isInvalidScheduled).toBe(true)
  })

  it('treats a stored time without full evidence as a proposal, not a schedule', () => {
    const truth = deriveContentLifecycleTruth({
      status: 'SCHEDULED',
      scheduledAt: '2026-07-16T08:00:00.000Z',
    })

    expect(truth.hasProposedTime).toBe(true)
    expect(truth.isValidScheduled).toBe(false)
  })
})
