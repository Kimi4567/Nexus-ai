import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const data = await request.json()

    const {
      name,
      slug,
      description,
    } = data

    // ── Ensure Prisma User row exists BEFORE creating workspace ──────────────
    // New email/password sign-ups only create a Supabase Auth user, NOT a
    // Prisma User row. Without this upsert the workspace.create call throws a
    // foreign-key constraint error (ownerId references non-existent User).
    await prisma.user.upsert({
      where: { id: user.id },
      update: user.email ? { email: user.email } : {},
      create: {
        id: user.id,
        email: user.email || `${user.id}@placeholder.nexus`,
        name: user.name || null,
      },
    })

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
    const user = await requireAuth()

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
