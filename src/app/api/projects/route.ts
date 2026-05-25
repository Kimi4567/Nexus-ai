import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const data = await request.json()

    const {
      workspaceId,
      name,
      businessType,
      businessInfo,
    } = data

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: user.id,
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    const project = await prisma.project.create({
      data: {
        name,
        businessType,
        businessInfo,
        workspaceId,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Project creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    const projects = await prisma.project.findMany({
      where: {
        workspaceId: workspaceId || undefined,
        workspace: {
          ownerId: user.id,
        },
      },
      include: {
        _count: {
          select: {
            campaigns: true,
            media: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Project fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
