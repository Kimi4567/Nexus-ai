import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: { id: string } }

async function ownsCampaign(campaignId: string, userId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
  })
}

function mergeUnique(existing: string[] | null | undefined, incoming: unknown[], limit = 20): string[] {
  const current = Array.isArray(existing) ? existing : []
  const next = incoming
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
  return Array.from(new Set([...current, ...next])).slice(-limit)
}

// GET /api/campaigns/[id] — full campaign detail + activities
export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [campaign, socialPostCount] = await Promise.all([
      prisma.campaign.findFirst({
        where: { id: params.id, workspace: { ownerId: userId } },
        include: {
          activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
      // FL4: Count content-plan posts for this campaign (uses cast — SocialPost has no Campaign back-relation)
      (prisma as any).socialPost.count({ where: { campaignId: params.id } }).catch(() => 0),
    ])

    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Track last viewed (non-blocking)
    prisma.campaign.update({
      where: { id: params.id },
      data: { lastViewedAt: new Date() },
    }).catch(() => {})

    return NextResponse.json({ campaign: { ...campaign, socialPostCount } })
  } catch (err: any) {
    console.error('[campaigns/[id] GET]', err)
    return NextResponse.json({ error: 'Failed to load campaign' }, { status: 500 })
  }
}

// PATCH /api/campaigns/[id] — update fields + auto-log activity
export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await ownsCampaign(params.id, userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const allowed = ['name', 'description', 'status', 'favorite', 'audience', 'tone', 'platforms', 'aiOutput']
    const data: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    if (body.status === 'ACTIVE') {
      const aiOutput = (existing.aiOutput as any) || {}
      const sentinelPassed = aiOutput.sentinelReview?.status === 'passed'
      const calendarReady = Array.isArray(aiOutput.calendarItems) && aiOutput.calendarItems.length > 0
      if (!sentinelPassed || !calendarReady) {
        return NextResponse.json({
          error: 'ENGINE_NOT_READY',
          message: 'Run NEXUS Engine, pass Sentinel, and build the calendar before approval.',
        }, { status: 409 })
      }
    }

    const updated = await prisma.campaign.update({ where: { id: params.id }, data })

    if (body.status === 'ACTIVE') {
      const aiOutput = (existing.aiOutput as any) || {}
      const strategy = aiOutput.strategy || {}
      const hooks = [
        ...(Array.isArray(aiOutput.topHooks) ? aiOutput.topHooks.slice(0, 5) : []),
        ...(Array.isArray(strategy.topHooks) ? strategy.topHooks.slice(0, 5) : []),
      ]
      const angles = [
        ...(Array.isArray(strategy.contentAngles) ? strategy.contentAngles.slice(0, 5) : []),
        ...(Array.isArray(strategy.contentPillars) ? strategy.contentPillars.slice(0, 5).map((p: any) => typeof p === 'string' ? p : p?.pillar || p?.title || p?.topic) : []),
      ]
      const platforms = Array.isArray(existing.platforms) ? existing.platforms.map(String) : []

      const brand = await prisma.brandProfile.findUnique({ where: { workspaceId: existing.workspaceId } })
      if (brand) {
        await prisma.brandProfile.update({
          where: { workspaceId: existing.workspaceId },
          data: {
            winningHooks: mergeUnique(brand.winningHooks, hooks),
            winningAngles: mergeUnique(brand.winningAngles, angles),
            topPlatforms: mergeUnique(brand.topPlatforms, platforms, 12),
            aiInsights: {
              ...((brand.aiInsights as any) || {}),
              lastApprovedCampaignId: existing.id,
              lastApprovedAt: new Date().toISOString(),
              lastApprovedPositioning: strategy.positioning || existing.description || undefined,
            },
          },
        }).catch(() => null)
      }
    }

    // Auto-log activity
    let activityType = 'updated'
    let activityDesc = 'Campaign updated'
    if ('status' in body) {
      activityType = body.status === 'ARCHIVED' ? 'archived' : 'updated'
      activityDesc = `Status changed to ${body.status}`
    } else if ('favorite' in body) {
      activityType = 'favorited'
      activityDesc = body.favorite ? 'Added to favorites ⭐' : 'Removed from favorites'
    } else if ('name' in body) {
      activityDesc = `Renamed to "${body.name}"`
    }

    prisma.campaignActivity.create({
      data: { campaignId: params.id, type: activityType, description: activityDesc },
    }).catch(() => {})

    return NextResponse.json({ campaign: updated })
  } catch (err: any) {
    console.error('[campaigns/[id] PATCH]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id] — hard delete
export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await ownsCampaign(params.id, userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.campaign.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[campaigns/[id] DELETE]', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
