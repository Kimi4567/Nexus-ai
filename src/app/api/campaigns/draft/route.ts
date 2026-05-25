import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { projectId, name } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
      },
      include: {
        workspace: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    const draftName = name || `Draft campaign ${new Date().toLocaleDateString()}`
    const campaign = await prisma.campaign.create({
      data: {
        name: draftName,
        description: '',
        workspaceId: project.workspaceId,
        projectId,
        goal: 'SALES',
        audience: '',
        tone: 'PROFESSIONAL',
        platforms: [],
        status: 'DRAFT',
      },
    })

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Draft campaign creation failed', error)
    return NextResponse.json({ error: 'Unable to create draft campaign' }, { status: 500 })
  }
}
