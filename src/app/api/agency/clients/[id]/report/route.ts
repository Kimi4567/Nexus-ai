/**
 * GET /api/agency/clients/[id]/report
 * Returns a summary report for a client workspace — used for client-facing reporting.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({
    where: { id: params.id, ownerId: userId },
    include: {
      campaigns: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, goal: true, platforms: true,
          status: true, createdAt: true, shareToken: true, isPublic: true,
          aiOutput: true,
        },
      },
      _count: { select: { campaigns: true, projects: true } },
    },
  })

  if (!workspace) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const campaigns = workspace.campaigns
  const statusCounts = campaigns.reduce((acc: Record<string, number>, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  const platformCounts = campaigns.flatMap(c => c.platforms).reduce((acc: Record<string, number>, p) => {
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})

  const goalCounts = campaigns.reduce((acc: Record<string, number>, c) => {
    acc[c.goal] = (acc[c.goal] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    client: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      createdAt: workspace.createdAt,
    },
    summary: {
      totalCampaigns: workspace._count.campaigns,
      totalProjects: workspace._count.projects,
      statusBreakdown: statusCounts,
      platformBreakdown: platformCounts,
      goalBreakdown: goalCounts,
    },
    recentCampaigns: campaigns.slice(0, 10).map(c => ({
      id: c.id,
      name: c.name,
      goal: c.goal,
      platforms: c.platforms,
      status: c.status,
      createdAt: c.createdAt,
      shareUrl: c.isPublic && c.shareToken
        ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${c.shareToken}`
        : null,
    })),
  })
}
