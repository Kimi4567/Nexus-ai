import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const original = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const THUMBNAILS = ['🚀', '⚡', '🎯', '🔥', '💡', '🌟', '📣', '🎪', '💎', '🎨']

    const duplicate = await prisma.campaign.create({
      data: {
        name: `${original.name} (Copy)`,
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
            description: `Duplicated from "${original.name}"`,
          },
        },
      },
    })

    // Log on original too
    prisma.campaignActivity.create({
      data: {
        campaignId: params.id,
        type: 'duplicated',
        description: `Duplicated into new campaign "${duplicate.name}"`,
      },
    }).catch(() => {})

    return NextResponse.json({ campaign: duplicate })
  } catch (err: any) {
    console.error('[duplicate]', err)
    return NextResponse.json({ error: 'Duplicate failed' }, { status: 500 })
  }
}
