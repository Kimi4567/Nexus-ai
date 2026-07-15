import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const CONTENT_DECISION_STATUSES = ['APPROVED', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED']

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ events: [] })

    const history = await (prisma as any).postStatusHistory.findMany({
      where: {
        workspaceId: workspace.id,
        toStatus: { in: CONTENT_DECISION_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        socialPostId: true,
        fromStatus: true,
        toStatus: true,
        actor: true,
        note: true,
        createdAt: true,
        socialPost: {
          select: {
            campaignId: true,
            platform: true,
            publishTarget: true,
            caption: true,
            status: true,
            approvedAt: true,
            approvedSnapshot: { select: { version: true, scope: true, payloadHash: true } },
            mediaApprovalSnapshot: { select: { version: true, scope: true, payloadHash: true } },
            scheduledSnapshot: { select: { version: true, scope: true, payloadHash: true } },
          },
        },
      },
    })

    const campaignIds: string[] = Array.from(new Set<string>(
      history.flatMap((event: any) => {
        const id = event.socialPost?.campaignId
        return typeof id === 'string' && id.length > 0 ? [id] : []
      }),
    ))
    const campaigns = campaignIds.length
      ? await prisma.campaign.findMany({
          where: { workspaceId: workspace.id, id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : []
    const campaignNames = new Map(campaigns.map(campaign => [campaign.id, campaign.name]))

    return NextResponse.json({
      events: history.map((event: any) => {
        const decisionSnapshot = String(event.note || '').startsWith('[MEDIA_APPROVAL]')
          ? event.socialPost?.mediaApprovalSnapshot
          : ['SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED'].includes(event.toStatus)
          ? event.socialPost?.scheduledSnapshot || event.socialPost?.approvedSnapshot
          : event.socialPost?.approvedSnapshot
        return {
        id: event.id,
        postId: event.socialPostId,
        campaignId: event.socialPost?.campaignId ?? null,
        campaignName: event.socialPost?.campaignId
          ? campaignNames.get(event.socialPost.campaignId) ?? 'Campaign'
          : 'Campaign',
        platform: event.socialPost?.publishTarget || event.socialPost?.platform || null,
        caption: event.socialPost?.caption || '',
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        currentStatus: event.socialPost?.status || null,
        actor: event.actor,
        note: event.note,
        approvedAt: event.socialPost?.approvedAt?.toISOString?.() ?? event.socialPost?.approvedAt ?? null,
        snapshotVersion: decisionSnapshot?.version ?? null,
        snapshotScope: decisionSnapshot?.scope ?? null,
        snapshotHash: decisionSnapshot?.payloadHash ?? null,
        createdAt: event.createdAt.toISOString(),
        }
      }),
    })
  } catch (error) {
    console.error('[approvals/content-ledger]', error)
    return NextResponse.json({ error: 'Failed to load content decision ledger' }, { status: 500 })
  }
}
