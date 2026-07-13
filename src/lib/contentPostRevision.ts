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
  'Content or media changed; approval and execution assignment were cleared for review.'
