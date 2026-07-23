import { describe, expect, it } from 'vitest'
import {
  buildContentApprovalSnapshotPayload,
  buildMediaApprovalSnapshotPayload,
  buildScheduleDecisionSnapshotPayload,
  hashCampaignSnapshotPayload,
} from '@/lib/campaignSnapshots'
import { buildCampaignDeliveryPackage, type DeliveryPackagePost } from '@/lib/campaignDeliveryPackage'

const strategyPayload = {
  schemaVersion: 1,
  scope: 'STRATEGY_APPROVAL',
  campaign: {
    id: 'campaign-1', name: 'Launch', goal: 'LEADS', audience: 'Owners', platforms: ['LINKEDIN'],
  },
  strategyOrder: { language: 'en' },
  strategy: { positioning: 'Evidence-led growth' },
}
const strategySnapshot = {
  id: 'strategy-1', version: 1, scope: 'STRATEGY_APPROVAL', payload: strategyPayload,
  payloadHash: hashCampaignSnapshotPayload(strategyPayload),
}
const strategyReference = {
  id: strategySnapshot.id,
  version: strategySnapshot.version,
  scope: strategySnapshot.scope,
  payloadHash: strategySnapshot.payloadHash,
}
const basePost: DeliveryPackagePost = {
  id: 'post-1', platform: 'LINKEDIN', publishTarget: 'LINKEDIN', caption: 'Book a call', link: null,
  imagePrompt: null, videoPrompt: null, imageUrl: 'https://cdn.example/creative.jpg',
  uploadedMediaId: null, sourceMediaId: 'media-1', mediaSource: 'UPLOAD', generationStatus: 'DONE',
  isVideoPost: false, contentPlanIndex: 1, variantGroup: null, variantLabel: 'A', scheduledAt: null,
  status: 'APPROVED', platformPostId: null, platformUrl: null,
}

function approvedPost(overrides: Partial<DeliveryPackagePost> = {}): DeliveryPackagePost {
  const post = { ...basePost, ...overrides }
  const copyPayload = buildContentApprovalSnapshotPayload({
    campaignId: 'campaign-1', strategySnapshot: strategyReference, posts: [post],
  })
  const mediaPayload = buildMediaApprovalSnapshotPayload({
    campaignId: 'campaign-1', strategySnapshot: strategyReference,
    copyApprovalSnapshotIds: ['copy-2'], posts: [post],
  })
  return {
    ...post,
    approvedSnapshot: {
      id: 'copy-2', version: 2, scope: 'CONTENT_APPROVAL', payload: copyPayload,
      payloadHash: hashCampaignSnapshotPayload(copyPayload),
    },
    mediaApprovalSnapshot: {
      id: 'media-3', version: 3, scope: 'CONTENT_MEDIA_APPROVAL', payload: mediaPayload,
      payloadHash: hashCampaignSnapshotPayload(mediaPayload),
    },
  }
}

function scheduledPost(overrides: Partial<DeliveryPackagePost> = {}): DeliveryPackagePost {
  const reviewed = approvedPost({
    status: 'SCHEDULED',
    scheduledAt: new Date('2026-07-22T09:00:00.000Z'),
    ...overrides,
  })
  const decisionPost = {
    ...reviewed,
    approvedSnapshotId: 'copy-2',
    mediaApprovalSnapshotId: 'media-3',
    integrationId: 'integration-1',
    pageId: null,
    pageName: 'LinkedIn member',
    platformOptions: null,
    publishMode: 'MANUAL',
    autoPublishConsentAt: null,
  }
  const schedulePayload = buildScheduleDecisionSnapshotPayload({
    campaignId: 'campaign-1',
    strategySnapshot: strategyReference,
    publishMode: 'MANUAL',
    posts: [decisionPost],
  })
  return {
    ...decisionPost,
    scheduledSnapshotId: 'schedule-4',
    scheduledSnapshot: {
      id: 'schedule-4', version: 4, scope: 'SCHEDULE_DECISION', payload: schedulePayload,
      payloadHash: hashCampaignSnapshotPayload(schedulePayload),
    },
  }
}

describe('campaign delivery package', () => {
  it('labels live content without immutable approvals as a review draft', () => {
    const delivery = buildCampaignDeliveryPackage({
      generatedAt: new Date('2026-07-20T12:00:00.000Z'),
      campaign: { id: 'campaign-1', name: 'Launch' },
      strategySnapshot: null,
      posts: [basePost],
    })
    expect(delivery.state).toBe('REVIEW_DRAFT')
    expect(delivery.strategy.source).toBe('LIVE_DRAFT')
    expect(delivery.counts).toMatchObject({ copyApproved: 0, mediaApproved: 0 })
  })

  it('uses verified immutable evidence before calling a package ready for scheduling', () => {
    const delivery = buildCampaignDeliveryPackage({
      generatedAt: new Date('2026-07-20T12:00:00.000Z'),
      campaign: { id: 'campaign-1', name: 'Launch' },
      strategySnapshot,
      posts: [approvedPost()],
    })
    expect(delivery.state).toBe('READY_FOR_SCHEDULING')
    expect(delivery.strategy.source).toBe('APPROVED_SNAPSHOT')
    expect(delivery.posts[0]).toMatchObject({ copyApproved: true, mediaApproved: true })
    expect(delivery.limitations.join(' ')).toContain('does not imply provider permission')
  })

  it('invalidates copy approval when the live post drifts from its approved revision', () => {
    const originallyApproved = approvedPost()
    const delivery = buildCampaignDeliveryPackage({
      generatedAt: new Date('2026-07-20T12:00:00.000Z'),
      campaign: { id: 'campaign-1', name: 'Launch' },
      strategySnapshot,
      posts: [{ ...originallyApproved, caption: 'Changed after approval' }],
    })
    expect(delivery.state).toBe('REVIEW_DRAFT')
    expect(delivery.posts[0].copyApproved).toBe(false)
  })

  it('claims provider publication only with both published state and provider ID', () => {
    const withoutId = buildCampaignDeliveryPackage({
      generatedAt: new Date(), campaign: { id: 'campaign-1', name: 'Launch' }, strategySnapshot,
      posts: [approvedPost({ status: 'PUBLISHED', platformPostId: null })],
    })
    const withId = buildCampaignDeliveryPackage({
      generatedAt: new Date(), campaign: { id: 'campaign-1', name: 'Launch' }, strategySnapshot,
      posts: [approvedPost({ status: 'PUBLISHED', platformPostId: 'provider-123' })],
    })
    expect(withoutId.counts.providerPublicationVerified).toBe(0)
    expect(withId.counts.providerPublicationVerified).toBe(1)
  })

  it('distinguishes a verified schedule decision from provider-confirmed publication', () => {
    const scheduled = buildCampaignDeliveryPackage({
      generatedAt: new Date(), campaign: { id: 'campaign-1', name: 'Launch' }, strategySnapshot,
      posts: [scheduledPost()],
    })
    const published = buildCampaignDeliveryPackage({
      generatedAt: new Date(), campaign: { id: 'campaign-1', name: 'Launch' }, strategySnapshot,
      posts: [scheduledPost({ status: 'PUBLISHED', platformPostId: 'provider-123' })],
    })

    expect(scheduled.state).toBe('SCHEDULED')
    expect(scheduled.counts.scheduleRecorded).toBe(1)
    expect(published.state).toBe('PROVIDER_PUBLISHED')
  })

  it('does not trust a schedule snapshot after the reviewed destination changes', () => {
    const reviewed = scheduledPost()
    const delivery = buildCampaignDeliveryPackage({
      generatedAt: new Date(), campaign: { id: 'campaign-1', name: 'Launch' }, strategySnapshot,
      posts: [{ ...reviewed, pageId: 'changed-destination' }],
    })

    expect(delivery.state).toBe('READY_FOR_SCHEDULING')
    expect(delivery.counts.scheduleRecorded).toBe(0)
  })
})
