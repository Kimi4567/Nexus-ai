import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { readLockedCampaignAllowance } from '@/lib/campaignCommercial'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const THUMBNAILS = ['🚀', '⚡', '🎯', '🔥', '💡', '🌟', '📣', '🎪', '💎', '🎨']
    const result = await prisma.$transaction(async (tx) => {
      const original = await tx.campaign.findFirst({
        where: { id: params.id, workspace: { ownerId: userId } },
      })
      if (!original) return { notFound: true as const }

      const allowance = await readLockedCampaignAllowance(tx, userId)
      if (allowance.limit !== 999 && allowance.current >= allowance.limit) {
        return { limitReached: true as const, allowance }
      }

      const duplicate = await tx.campaign.create({
        data: {
          name: `${original.name.slice(0, 111)} (Copy)`,
          description: original.description,
          goal: original.goal,
          audience: original.audience,
          tone: original.tone,
          platforms: original.platforms,
          workspaceId: original.workspaceId,
          projectId: original.projectId,
          status: 'DRAFT',
          aiOutput: original.aiOutput ?? undefined,
          thumbnail: THUMBNAILS[Math.floor(Math.random() * THUMBNAILS.length)],
          activities: {
            create: {
              type: 'duplicated',
              description: `Duplicated from "${original.name.slice(0, 120)}"`,
            },
          },
        },
      })
      await tx.campaignActivity.create({
        data: {
          campaignId: params.id,
          type: 'duplicated',
          description: `Duplicated into new campaign "${duplicate.name}"`,
        },
      })
      return { duplicate, allowance }
    })

    if ('notFound' in result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('limitReached' in result) {
      return NextResponse.json({
        error: 'CAMPAIGN_LIMIT_REACHED',
        limit: result.allowance.limit,
        current: result.allowance.current,
        resetsAt: result.allowance.periodEnd.toISOString(),
        upgradeUrl: '/billing',
      }, { status: 403 })
    }

    return NextResponse.json({ campaign: result.duplicate }, { status: 201 })
  } catch (err: any) {
    console.error('[duplicate]', err)
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
  }
}
