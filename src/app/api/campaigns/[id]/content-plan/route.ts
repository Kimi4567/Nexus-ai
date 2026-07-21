/**
 * GET /api/campaigns/[id]/content-plan
 * Returns all DRAFT SocialPost records for the campaign (the content plan).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { readRejectedVideoReview } from '@/lib/rejectedMediaReview'
import { buildContentPlanTruthContext, reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'
import { getDraftVariantComparison } from '@/lib/draftVariantComparison'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: {
        workspace: { select: { brandProfile: true } },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const posts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        // PR5 visibility: include published posts too, so a manually-published post
        // doesn't "disappear" from the Content Hub. The UI summarises + badges them.
      },
      orderBy: [{ contentPlanIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        publishTarget: true,
        caption: true,
        imageUrl: true,
        imagePrompt: true,
        videoPrompt: true,
        isVideoPost: true,
        generationStatus: true,
        mediaSource: true,
        uploadedMediaId: true,
        contentPlanIndex: true,
        scheduledAt: true,
        status: true,
        // Publishing lifecycle (manual publishing checklist — PR4)
        publishMode: true,
        approvedAt: true,
        approvedSnapshotId: true,
        mediaApprovalSnapshotId: true,
        scheduledSnapshotId: true,
        publishedAt: true,
        manuallyPublishedAt: true,
        platformPostId: true,
        platformUrl: true,
        analyticsData: true,
        analyticsUpdatedAt: true,
        errorMessage: true,
        // A/B Testing fields
        variantGroup: true,
        variantLabel: true,
        variantWinner: true,
      },
    })

    // Rejected generated videos are retained for audit, but never attached to
    // the post. Return a safe read-only preview so the user can see what was
    // produced and why NEXUS blocked it instead of making the output disappear.
    const videoGenerations = await (prisma.generation as any).findMany({
      where: {
        campaignId: params.id,
        type: 'VIDEO',
        provider: 'runway',
        status: 'FAILED',
        output: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        output: true,
        metadata: true,
        params: true,
      },
    })
    const rejectedVideoByPostId = new Map<string, ReturnType<typeof readRejectedVideoReview>>()
    for (const generation of videoGenerations) {
      const generationParams = generation.params && typeof generation.params === 'object' && !Array.isArray(generation.params)
        ? generation.params as Record<string, unknown>
        : null
      const postId = typeof generationParams?.postId === 'string' ? generationParams.postId : null
      if (!postId || rejectedVideoByPostId.has(postId)) continue
      const review = readRejectedVideoReview(generation)
      if (review) rejectedVideoByPostId.set(postId, review)
    }

    const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy && typeof aiOutput.strategy === 'object' && !Array.isArray(aiOutput.strategy)
      ? aiOutput.strategy
      : aiOutput
    const reviewablePosts = posts.filter((post: any) => ['DRAFT', 'APPROVED', 'SCHEDULED'].includes(post.status))
    const qualityReview = reviewContentPlanForApproval(
      reviewablePosts,
      strategy,
      buildContentPlanTruthContext(campaign.workspace.brandProfile),
    )

    return NextResponse.json({
      posts: posts.map((post: any) => ({
        ...post,
        draftComparison: post.variantGroup
          ? getDraftVariantComparison(strategy, post.contentPlanIndex)
          : null,
        rejectedVideoReview: rejectedVideoByPostId.get(post.id) ?? null,
        providerPlatform: post.platform,
        // Legacy META rows remain explicitly ambiguous; the UI must ask for a
        // channel instead of silently claiming Instagram or Facebook.
        platform: post.publishTarget || post.platform,
      })),
      qualityReview,
    })
  } catch (err: any) {
    console.error('[content-plan GET]', err)
    return NextResponse.json({ error: 'Failed to load content plan' }, { status: 500 })
  }
}
