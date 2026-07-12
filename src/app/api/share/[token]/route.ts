/**
 * GET /api/share/[token]
 * Public endpoint — returns campaign data for shared link, no auth required.
 * Increments view count.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(params.token)) {
      return NextResponse.json({ error: 'Invalid share token' }, { status: 400 })
    }
    const campaign = await prisma.campaign.findFirst({
      where: { shareToken: params.token, isPublic: true },
      select: {
        id: true,
        name: true,
        goal: true,
        platforms: true,
        tone: true,
        audience: true,
        aiOutput: true,
        createdAt: true,
        shareViews: true,
        project: {
          select: {
            workspace: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or link has been revoked' }, { status: 404 })
    }

    // Increment view count (fire-and-forget)
    prisma.campaign.update({
      where: { id: campaign.id },
      data: { shareViews: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      goal: campaign.goal,
      platforms: campaign.platforms,
      tone: campaign.tone,
      targetAudience: campaign.audience,
      aiOutput: campaign.aiOutput,
      createdAt: campaign.createdAt,
      workspaceName: campaign.project?.workspace?.name || 'Nexus AI',
    }, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (err) {
    console.error('[share/token]', err)
    return NextResponse.json({ error: 'Failed to load shared campaign' }, { status: 500 })
  }
}
