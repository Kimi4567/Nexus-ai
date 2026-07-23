import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildMediaApprovalSnapshotPayload,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
  readSnapshotStrategyReference,
  reviewPostAgainstApprovalSnapshot,
  reviewPostAgainstMediaApprovalSnapshot,
} from '@/lib/campaignSnapshots'
import {
  deriveCreativeMatch,
  parseStoredCreativeMatch,
  type CreativeMediaMatch,
} from '@/lib/creativeIntelligence'

type Params = { params: Promise<{ id: string }> }
type WeakMediaApprovalRisk = {
  postId: string
  contentPlanIndex: number | null
  mediaId: string
  score: number
  verdict: string
  reasons: string[]
  gaps: string[]
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        status: true,
        goal: true,
        audience: true,
        tone: true,
        platforms: true,
        aiOutput: true,
        workspace: { select: { brandProfile: true } },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const strategySnapshot = await prisma.campaignSnapshot.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, scope: true, payloadHash: true },
    })
    if (!strategySnapshot) {
      return NextResponse.json({
        error: 'Approve the strategy revision before approving media.',
        code: 'STRATEGY_APPROVAL_SNAPSHOT_REQUIRED',
      }, { status: 409 })
    }
    const currentStrategyPayload = buildStrategyApprovalSnapshotPayload({
      campaign,
      brandProfile: campaign.workspace.brandProfile,
      persistedApprovedAiOutput: true,
    })
    if (hashCampaignSnapshotPayload(currentStrategyPayload) !== strategySnapshot.payloadHash) {
      return NextResponse.json({
        error: 'The campaign or Brand Brain changed after strategy approval. Review the strategy again before media approval.',
        code: 'STRATEGY_APPROVAL_SNAPSHOT_STALE',
      }, { status: 409 })
    }

    const posts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: campaign.id,
        workspaceId: campaign.workspaceId,
        status: 'APPROVED',
        publishedAt: null,
      },
      select: {
        id: true,
        platform: true,
        publishTarget: true,
        caption: true,
        imagePrompt: true,
        videoPrompt: true,
        imageUrl: true,
        link: true,
        uploadedMediaId: true,
        sourceMediaId: true,
        mediaSource: true,
        generationStatus: true,
        isVideoPost: true,
        contentPlanIndex: true,
        variantGroup: true,
        variantLabel: true,
        scheduledAt: true,
        approvedSnapshotId: true,
        approvedSnapshot: { select: { scope: true, payload: true } },
        mediaApprovalSnapshot: { select: { scope: true, payload: true } },
        creativeMatch: true,
        updatedAt: true,
      },
    })
    if (posts.length === 0) {
      return NextResponse.json({ success: true, approved: 0, message: 'No copy-approved posts need media approval.' })
    }

    const copyBlockers = posts.flatMap((post: any) => {
      const review = reviewPostAgainstApprovalSnapshot(post, post.approvedSnapshot)
      if (!review.ok) return [{ postId: post.id, code: review.code }]
      const approvedStrategy = readSnapshotStrategyReference(post.approvedSnapshot?.payload)
      return approvedStrategy?.id === strategySnapshot.id
        ? []
        : [{ postId: post.id, code: 'CONTENT_APPROVED_FOR_OLDER_STRATEGY' }]
    })
    if (copyBlockers.length > 0) {
      return NextResponse.json({
        error: 'One or more copy revisions need review before their media can be approved.',
        code: 'COPY_APPROVAL_REVIEW_REQUIRED',
        blockers: copyBlockers,
      }, { status: 409 })
    }

    const notReady = posts.filter((post: any) => !isContentPostMediaReadyForScheduling(post))
    if (notReady.length > 0) {
      return NextResponse.json({
        error: 'Every copy-approved post needs final, confirmed media before media approval.',
        code: 'MEDIA_REVIEW_REQUIRED',
        pendingMedia: notReady.length,
      }, { status: 409 })
    }

    const uploadedMediaIds = Array.from(new Set<string>(posts.flatMap((post: any) => (
      typeof post.uploadedMediaId === 'string' && post.uploadedMediaId.length > 0
        ? [post.uploadedMediaId]
        : []
    ))))
    const uploadedMedia = uploadedMediaIds.length > 0
      ? await prisma.media.findMany({
          where: { id: { in: uploadedMediaIds }, workspaceId: campaign.workspaceId },
          select: {
            id: true,
            url: true,
            fileName: true,
            type: true,
            mimeType: true,
            width: true,
            height: true,
            duration: true,
            category: true,
            tags: true,
            intelligenceStatus: true,
            intelligence: true,
          },
        })
      : []
    const uploadedMediaById = new Map(uploadedMedia.map(media => [media.id, media]))
    const weakMedia: WeakMediaApprovalRisk[] = posts.flatMap((post: any) => {
      if (!post.uploadedMediaId) return []
      const storedMatch = parseStoredCreativeMatch(post.creativeMatch)?.topMatches
        .find(match => match.mediaId === post.uploadedMediaId)
      const media = uploadedMediaById.get(post.uploadedMediaId)
      const derivedMatch = !storedMatch && media?.intelligenceStatus === 'READY'
        ? deriveCreativeMatch({
            id: post.id,
            caption: post.caption,
            imagePrompt: post.imagePrompt,
            videoPrompt: post.videoPrompt,
            platform: post.publishTarget || String(post.platform),
            isVideoPost: post.isVideoPost,
            contentPlanIndex: post.contentPlanIndex,
          }, {
            ...media,
            type: String(media.type),
          })
        : null
      const match: CreativeMediaMatch | undefined = storedMatch ?? derivedMatch ?? undefined
      if (!match || !['WEAK', 'REJECTED'].includes(match.verdict)) return []
      return [{
        postId: post.id,
        contentPlanIndex: typeof post.contentPlanIndex === 'number' ? post.contentPlanIndex : null,
        mediaId: post.uploadedMediaId,
        score: match.score,
        verdict: match.verdict,
        reasons: match.reasons.slice(0, 2),
        gaps: match.gaps.slice(0, 2),
      }]
    })
    const explicitWeakMediaApprovalConfirmed = body.explicitWeakMediaApprovalConfirmed === true
    if (weakMedia.length > 0 && !explicitWeakMediaApprovalConfirmed) {
      return NextResponse.json({
        error: 'One or more attached assets have a known weak creative match. Review the warning and explicitly confirm any manual override.',
        code: 'WEAK_MEDIA_OVERRIDE_CONFIRMATION_REQUIRED',
        weakMedia,
      }, { status: 409 })
    }

    const alreadyCurrent = posts.every((post: any) => (
      reviewPostAgainstMediaApprovalSnapshot(post, post.mediaApprovalSnapshot).ok
    ))
    if (alreadyCurrent && weakMedia.length === 0) {
      return NextResponse.json({ success: true, approved: 0, unchanged: true, message: 'Media is already approved.' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const versionedCampaign = await tx.campaign.update({
        where: { id: campaign.id },
        data: { snapshotVersion: { increment: 1 } },
        select: { snapshotVersion: true },
      })
      const payload = buildMediaApprovalSnapshotPayload({
        campaignId: campaign.id,
        strategySnapshot,
        copyApprovalSnapshotIds: posts.map((post: any) => String(post.approvedSnapshotId)),
        posts,
        ...(weakMedia.length > 0 ? {
          qualityOverride: {
            explicitlyConfirmed: true as const,
            weakMedia: weakMedia.map(item => ({
              postId: item.postId,
              contentPlanIndex: item.contentPlanIndex,
              mediaId: item.mediaId,
              score: item.score,
              verdict: item.verdict,
            })),
          },
        } : {}),
      })
      const snapshot = await tx.campaignSnapshot.create({
        data: {
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          version: versionedCampaign.snapshotVersion,
          scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL,
          payload: payload as any,
          payloadHash: hashCampaignSnapshotPayload(payload),
          createdById: userId,
        },
        select: { id: true, version: true, scope: true, payloadHash: true },
      })

      for (const post of posts as any[]) {
        const changed = await tx.socialPost.updateMany({
          where: {
            id: post.id,
            campaignId: campaign.id,
            workspaceId: campaign.workspaceId,
            status: 'APPROVED',
            approvedSnapshotId: post.approvedSnapshotId,
            updatedAt: post.updatedAt,
          },
          data: {
            mediaApprovalSnapshotId: snapshot.id,
            scheduledSnapshotId: null,
          },
        })
        if (changed.count !== 1) throw new Error('MEDIA_APPROVAL_CONCURRENT_CHANGE')
      }

      await tx.postStatusHistory.createMany({
        data: posts.map((post: any) => ({
          socialPostId: post.id,
          workspaceId: campaign.workspaceId,
          fromStatus: 'APPROVED',
          toStatus: 'APPROVED',
          actor: 'USER',
          note: `[MEDIA_APPROVAL] Final media approved in immutable snapshot ${snapshot.id}`,
        })),
      })

      await tx.campaignActivity.create({
        data: {
          campaignId: campaign.id,
          type: 'content_media_approved',
          description: 'Final media revisions approved separately from copy and scheduling',
          metadata: {
            snapshotId: snapshot.id,
            snapshotVersion: snapshot.version,
            snapshotHash: snapshot.payloadHash,
            postCount: posts.length,
            weakMediaOverrideConfirmed: weakMedia.length > 0,
            weakMedia: weakMedia.map(item => ({
              postId: item.postId,
              contentPlanIndex: item.contentPlanIndex,
              mediaId: item.mediaId,
              score: item.score,
              verdict: item.verdict,
            })),
          },
        },
      })
      return snapshot
    })

    return NextResponse.json({
      success: true,
      approved: posts.length,
      unchanged: false,
      weakMediaOverrideRecorded: weakMedia.length > 0,
      snapshot: result,
      message: `${posts.length} media revision${posts.length === 1 ? '' : 's'} approved`,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_APPROVAL_CONCURRENT_CHANGE') {
      return NextResponse.json({
        error: 'A post changed during media approval. Reload and review the final media again.',
        code: 'MEDIA_APPROVAL_CONCURRENT_CHANGE',
      }, { status: 409 })
    }
    console.error('[approve-media-plan POST]', error)
    return NextResponse.json({ error: 'Failed to approve media plan' }, { status: 500 })
  }
}
