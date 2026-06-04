import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId, ensureDbUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // ensureDbUser verifies the JWT AND upserts the Prisma User row in one
    // step — guaranteeing the DB row exists before workspace.create runs.
    const user = await ensureDbUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const data = await request.json()

    const {
      name,
      slug,
      description,
    } = data

    // Check if workspace slug already exists
    const existing = await prisma.workspace.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Workspace slug already exists' },
        { status: 400 }
      )
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        description,
        ownerId: user.id,
      },
    })

    return NextResponse.json(workspace)
  } catch (error) {
    console.error('Workspace creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getServerUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = { id: userId }

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        _count: {
          select: {
            projects: true,
            campaigns: true,
          },
        },
      },
    })

    return NextResponse.json(workspaces)
  } catch (error) {
    console.error('Workspace fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    )
  }
}
