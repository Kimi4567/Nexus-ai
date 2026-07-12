/**
 * GET /api/campaigns/[id]/content-plan
 * Returns all DRAFT SocialPost records for the campaign (the content plan).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
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
        publishedAt: true,
        manuallyPublishedAt: true,
        platformUrl: true,
        errorMessage: true,
        // A/B Testing fields
        variantGroup: true,
        variantLabel: true,
        variantWinner: true,
      },
    })

    return NextResponse.json({ posts })
  } catch (err: any) {
    console.error('[content-plan GET]', err)
    return NextResponse.json({ error: 'Failed to load content plan' }, { status: 500 })
  }
}
