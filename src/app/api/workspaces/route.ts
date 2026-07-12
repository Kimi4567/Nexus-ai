import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId, ensureDbUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getWorkspaceLimit } from '@/lib/commercialPlans'

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/[\r\n]+/g, ' ').slice(0, 80) : ''
}

function cleanSlug(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
    : ''
}

export async function POST(request: NextRequest) {
  try {
    const user = await ensureDbUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const data = await request.json().catch(() => ({}))
    const name = cleanName(data.name)
    const slug = cleanSlug(data.slug)
    const description = typeof data.description === 'string' ? data.description.trim().slice(0, 500) : null
    if (name.length < 2 || slug.length < 3) {
      return NextResponse.json({ error: 'Valid workspace name and slug are required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize workspace creation per owner so concurrent requests cannot
      // both pass the count check and exceed the commercial allowance.
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `workspace-limit:${user.id}`)

      const dbUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { subscriptionStatus: true, role: true },
      })
      const limit = getWorkspaceLimit(dbUser?.subscriptionStatus, dbUser?.role)
      const current = await tx.workspace.count({ where: { ownerId: user.id } })
      if (current >= limit) return { limitReached: true as const, limit, current }

      const existing = await tx.workspace.findUnique({ where: { slug }, select: { id: true } })
      if (existing) return { slugExists: true as const }

      const workspace = await tx.workspace.create({
        data: { name, slug, description, ownerId: user.id },
      })
      return { workspace, limit, current: current + 1 }
    })

    if ('limitReached' in result) {
      return NextResponse.json({
        error: 'Workspace limit reached for the current plan',
        code: 'WORKSPACE_LIMIT_REACHED',
        limit: result.limit,
        current: result.current,
        upgradeHref: '/billing',
      }, { status: 403 })
    }
    if ('slugExists' in result) {
      return NextResponse.json({ error: 'Workspace slug already exists' }, { status: 409 })
    }
    return NextResponse.json(result.workspace, { status: 201 })
  } catch (error: any) {
    console.error('Workspace creation error:', error)
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Workspace slug already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getServerUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const workspaces = await prisma.workspace.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      include: { _count: { select: { projects: true, campaigns: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(workspaces)
  } catch (error) {
    console.error('Workspace fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 })
  }
}
