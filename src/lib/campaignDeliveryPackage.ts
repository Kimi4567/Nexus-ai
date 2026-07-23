import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  hashCampaignSnapshotPayload,
  readStrategyApprovalSnapshotPayload,
  reviewPostAgainstApprovalSnapshot,
  reviewPostAgainstMediaApprovalSnapshot,
  reviewPostAgainstScheduleDecisionSnapshot,
  type SnapshotContentPost,
} from '@/lib/campaignSnapshots'

type SnapshotEvidence = {
  id: string
  version: number
  scope: string
  payload: unknown
  payloadHash: string
}

export type DeliveryPackagePost = SnapshotContentPost & {
  status: string
  approvedSnapshotId?: string | null
  mediaApprovalSnapshotId?: string | null
  scheduledSnapshotId?: string | null
  integrationId?: string | null
  pageId?: string | null
  pageName?: string | null
  platformOptions?: unknown
  publishMode?: string | null
  autoPublishConsentAt?: string | Date | null
  approvedSnapshot?: SnapshotEvidence | null
  mediaApprovalSnapshot?: SnapshotEvidence | null
  scheduledSnapshot?: SnapshotEvidence | null
  platformPostId?: string | null
  platformUrl?: string | null
}

export type DeliveryPackageState =
  | 'NO_CONTENT'
  | 'REVIEW_DRAFT'
  | 'COPY_APPROVED'
  | 'READY_FOR_SCHEDULING'
  | 'SCHEDULED'
  | 'PROVIDER_PUBLISHED'

function verifiedSnapshot(
  snapshot: SnapshotEvidence | null | undefined,
  expectedScope: string,
): boolean {
  return Boolean(
    snapshot
    && snapshot.scope === expectedScope
    && snapshot.payloadHash === hashCampaignSnapshotPayload(snapshot.payload),
  )
}

export function buildCampaignDeliveryPackage(input: {
  generatedAt: Date
  campaign: { id: string; name: string }
  strategySnapshot?: SnapshotEvidence | null
  posts: DeliveryPackagePost[]
}) {
  const strategyVerified = verifiedSnapshot(input.strategySnapshot, CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL)
  const approvedStrategy = strategyVerified
    ? readStrategyApprovalSnapshotPayload(input.strategySnapshot?.payload)
    : null

  const posts = input.posts.map(post => {
    const copyApproved = verifiedSnapshot(post.approvedSnapshot, CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL)
      && reviewPostAgainstApprovalSnapshot(post, post.approvedSnapshot).ok
    const mediaApproved = verifiedSnapshot(post.mediaApprovalSnapshot, CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL)
      && reviewPostAgainstMediaApprovalSnapshot(post, post.mediaApprovalSnapshot).ok
    const scheduleRecorded = verifiedSnapshot(post.scheduledSnapshot, CAMPAIGN_SNAPSHOT_SCOPE.SCHEDULE_DECISION)
      && reviewPostAgainstScheduleDecisionSnapshot(post, post.scheduledSnapshot).ok
    const providerPublicationVerified = post.status === 'PUBLISHED' && Boolean(post.platformPostId)

    return {
      id: post.id,
      platform: post.publishTarget ?? post.platform ?? null,
      status: post.status,
      contentPlanIndex: post.contentPlanIndex ?? null,
      copyApproved,
      mediaApproved,
      scheduleRecorded,
      providerPublicationVerified,
      approvalEvidence: {
        copy: copyApproved && post.approvedSnapshot ? {
          id: post.approvedSnapshot.id,
          version: post.approvedSnapshot.version,
          payloadHash: post.approvedSnapshot.payloadHash,
        } : null,
        media: mediaApproved && post.mediaApprovalSnapshot ? {
          id: post.mediaApprovalSnapshot.id,
          version: post.mediaApprovalSnapshot.version,
          payloadHash: post.mediaApprovalSnapshot.payloadHash,
        } : null,
        schedule: scheduleRecorded && post.scheduledSnapshot ? {
          id: post.scheduledSnapshot.id,
          version: post.scheduledSnapshot.version,
          payloadHash: post.scheduledSnapshot.payloadHash,
        } : null,
      },
    }
  })

  const copyApprovedCount = posts.filter(post => post.copyApproved).length
  const mediaApprovedCount = posts.filter(post => post.mediaApproved).length
  const scheduleRecordedCount = posts.filter(post => post.scheduleRecorded).length
  const providerPublicationVerifiedCount = posts.filter(post => post.providerPublicationVerified).length
  const state: DeliveryPackageState = posts.length === 0
    ? 'NO_CONTENT'
    : !approvedStrategy || copyApprovedCount !== posts.length
      ? 'REVIEW_DRAFT'
      : mediaApprovedCount !== posts.length
        ? 'COPY_APPROVED'
        : providerPublicationVerifiedCount === posts.length
          ? 'PROVIDER_PUBLISHED'
          : scheduleRecordedCount === posts.length
            ? 'SCHEDULED'
            : 'READY_FOR_SCHEDULING'

  return {
    schemaVersion: 1 as const,
    generatedAt: input.generatedAt.toISOString(),
    campaign: input.campaign,
    state,
    strategy: {
      source: approvedStrategy ? 'APPROVED_SNAPSHOT' as const : 'LIVE_DRAFT' as const,
      approvalEvidence: approvedStrategy && input.strategySnapshot ? {
        id: input.strategySnapshot.id,
        version: input.strategySnapshot.version,
        payloadHash: input.strategySnapshot.payloadHash,
      } : null,
    },
    counts: {
      posts: posts.length,
      copyApproved: copyApprovedCount,
      mediaApproved: mediaApprovedCount,
      scheduleRecorded: scheduleRecordedCount,
      providerPublicationVerified: providerPublicationVerifiedCount,
    },
    posts,
    limitations: [
      'This package does not imply provider permission, scheduling, publication, spend, or performance.',
      'Approval evidence applies only to the exact immutable revisions identified by its hashes.',
      'Provider publication is verified only when a published record has a provider post ID.',
    ],
    approvedStrategy,
  }
}
