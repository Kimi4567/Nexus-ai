/**
 * GET  /api/agency/clients — list all client workspaces with stats
 * POST /api/agency/clients — create a new client workspace
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: userId },
    include: {
      _count: { select: { campaigns: true, projects: true } },
      campaigns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, name: true, status: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(workspaces.map(ws => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description,
    logo: ws.logo,
    campaignCount: ws._count.campaigns,
    projectCount: ws._count.projects,
    lastCampaign: ws.campaigns[0] || null,
    createdAt: ws.createdAt,
  })))
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Client name is required' }, { status: 400 })

  // Generate unique slug
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  let slug = base
  let attempt = 0
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${++attempt}`
  }

  const workspace = await prisma.workspace.create({
    data: { name: name.trim(), slug, description: description?.trim() || null, ownerId: userId },
  })

  // Seed a default project so the workspace is immediately usable
  await prisma.project.create({
    data: {
      name: `${name.trim()} — Main`,
      workspaceId: workspace.id,
      businessType: 'ECOMMERCE',
      businessInfo: {},
    },
  }).catch(() => {}) // non-blocking

  return NextResponse.json(workspace, { status: 201 })
}
