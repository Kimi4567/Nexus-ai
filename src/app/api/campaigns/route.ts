import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { generateMarketingStrategy } from '@/lib/ai/strategy'
import { generateAdConcepts } from '@/lib/ai/concepts'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const data = await request.json()

    const {
      projectId,
      name,
      goal,
      audience,
      tone,
      platforms,
      mediaIds,
    } = data

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: user.id,
        },
      },
      include: {
        workspace: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        goal,
        audience,
        tone,
        platforms,
        workspaceId: project.workspaceId,
        projectId,
        media: {
          connect: mediaIds?.map((id: string) => ({ id })) || [],
        },
      },
      include: {
        project: true,
        media: true,
      },
    })

    generateMarketingStrategy(campaign, project).catch(console.error)
    generateAdConcepts(campaign, project).catch(console.error)

    await prisma.user.update({
      where: { id: user.id },
      data: { aiCredits: { decrement: 5 } },
    })

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      message: 'Campaign created. AI is generating strategy and concepts...',
    })
  } catch (error) {
    console.error('Campaign creation error:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const campaigns = await prisma.campaign.findMany({
      where: {
        projectId: projectId || undefined,
        workspace: {
          ownerId: user.id,
        },
      },
      include: {
        concepts: true,
        generations: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(campaigns)
  } catch (error) {
    console.error('Campaign fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}
