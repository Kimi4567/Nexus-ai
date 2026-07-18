import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * One authenticated read for the global Content Hub.
 *
 * The previous client fetched the campaign list and then opened as many as 12
 * content-plan requests. Besides being slow, that produced a temporary empty
 * board while the real posts were still arriving. This route returns one
 * workspace-consistent snapshot instead.
 */
export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const db = prisma as any
    const campaigns = await db.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        thumbnail: true,
        platforms: true,
        createdAt: true,
      },
    })
    const campaignIds = campaigns.slice(0, 12).map((campaign: { id: string }) => campaign.id)
    const campaignNames = new Map<string, string>(
      campaigns.map((campaign: { id: string; name: string }) => [campaign.id, campaign.name]),
    )

    const posts = campaignIds.length
      ? await db.socialPost.findMany({
          where: { workspaceId: workspace.id, campaignId: { in: campaignIds } },
          orderBy: [{ campaignId: 'asc' }, { contentPlanIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            campaignId: true,
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
            approvedAt: true,
            approvedSnapshotId: true,
            mediaApprovalSnapshotId: true,
            scheduledSnapshotId: true,
            status: true,
            publishedAt: true,
            manuallyPublishedAt: true,
            platformUrl: true,
          },
        })
      : []

    return NextResponse.json({
      version: 1,
      generatedAt: new Date().toISOString(),
      campaigns,
      posts: posts.map((post: Record<string, unknown>) => ({
        ...post,
        campaignName: campaignNames.get(String(post.campaignId)) || 'Campaign',
        providerPlatform: post.platform,
        platform: post.publishTarget || post.platform,
      })),
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[content-hub/overview]', error)
    return NextResponse.json({ error: 'Failed to load Content Hub overview' }, { status: 500 })
  }
}
