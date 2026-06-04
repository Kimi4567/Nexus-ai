/**
 * GET /api/campaigns/[id]/content-plan
 * Returns all DRAFT SocialPost records for the campaign (the content plan).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Params) {
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
        // Return only content-plan posts (not yet published)
        publishedAt: null,
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
      },
    })

    return NextResponse.json({ posts })
  } catch (err: any) {
    console.error('[content-plan GET]', err)
    return NextResponse.json({ error: 'Failed to load content plan' }, { status: 500 })
  }
}
