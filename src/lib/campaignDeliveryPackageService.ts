import { prisma } from '@/lib/prisma'
import { CAMPAIGN_SNAPSHOT_SCOPE } from '@/lib/campaignSnapshots'
import { buildCampaignDeliveryPackage } from '@/lib/campaignDeliveryPackage'

export async function getCampaignDeliveryPackage(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
    select: {
      id: true,
      name: true,
      workspaceId: true,
      snapshots: {
        where: { scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, version: true, scope: true, payload: true, payloadHash: true },
      },
    },
  })
  if (!campaign) return null

  const posts = await prisma.socialPost.findMany({
    where: { campaignId, workspaceId: campaign.workspaceId },
    orderBy: [{ contentPlanIndex: 'asc' }, { createdAt: 'asc' }],
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
      publishedAt: true,
      status: true,
      platformPostId: true,
      platformUrl: true,
      approvedSnapshot: {
        select: { id: true, version: true, scope: true, payload: true, payloadHash: true },
      },
      mediaApprovalSnapshot: {
        select: { id: true, version: true, scope: true, payload: true, payloadHash: true },
      },
      scheduledSnapshot: {
        select: { id: true, version: true, scope: true, payload: true, payloadHash: true },
      },
    },
  })

  const manifest = buildCampaignDeliveryPackage({
    generatedAt: new Date(),
    campaign: { id: campaign.id, name: campaign.name },
    strategySnapshot: campaign.snapshots[0] ?? null,
    posts,
  })

  return {
    manifest,
    posts: posts.map(({
      approvedSnapshot: _approvedSnapshot,
      mediaApprovalSnapshot: _mediaApprovalSnapshot,
      scheduledSnapshot: _scheduledSnapshot,
      ...post
    }) => post),
  }
}
