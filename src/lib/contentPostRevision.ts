export function isImmutableExecutionPost(status: unknown): boolean {
  return status === 'PUBLISHED' || status === 'PROCESSING'
}

export function reopensContentReview(status: unknown): boolean {
  return status === 'APPROVED' || status === 'SCHEDULED' || status === 'FAILED'
}

export function contentReviewResetData(status: unknown): Record<string, unknown> {
  if (!reopensContentReview(status)) return {}
  return {
    status: 'DRAFT',
    approvedAt: null,
    approvedSnapshotId: null,
    mediaApprovalSnapshotId: null,
    scheduledSnapshotId: null,
    publishMode: 'MANUAL',
    integrationId: null,
    pageId: null,
    pageName: null,
    platformOptions: null,
    autoPublishConsentAt: null,
    publishAttemptedAt: null,
    platformPostId: null,
    platformUrl: null,
    publishedAt: null,
    errorMessage: null,
  }
}

export function mediaReviewResetData(post: {
  status?: unknown
  approvedSnapshotId?: unknown
}): Record<string, unknown> {
  const hasApprovedCopy = typeof post.approvedSnapshotId === 'string'
    && post.approvedSnapshotId.length > 0
  return {
    status: hasApprovedCopy ? 'APPROVED' : 'DRAFT',
    ...(!hasApprovedCopy ? {
      approvedAt: null,
      approvedSnapshotId: null,
    } : {}),
    mediaApprovalSnapshotId: null,
    scheduledSnapshotId: null,
    publishMode: 'MANUAL',
    integrationId: null,
    pageId: null,
    pageName: null,
    platformOptions: null,
    autoPublishConsentAt: null,
    publishAttemptedAt: null,
    platformPostId: null,
    platformUrl: null,
    publishedAt: null,
    errorMessage: null,
  }
}

export const CONTENT_REVISION_HISTORY_NOTE =
  'Content or media changed; approval snapshot and execution assignment were cleared for review.'

export const MEDIA_REVISION_HISTORY_NOTE =
  'Media changed; copy approval was retained while media approval and execution assignment were cleared for review.'
