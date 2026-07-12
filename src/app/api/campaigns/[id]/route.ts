import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: Promise<{ id: string }> }

async function ownsCampaign(campaignId: string, userId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
  })
}

const CAMPAIGN_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])

// GET /api/campaigns/[id] — full campaign detail + activities
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
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
export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params;
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

    if ('status' in body && !CAMPAIGN_STATUSES.has(String(body.status))) {
      return NextResponse.json({ error: 'Invalid campaign status' }, { status: 400 })
    }

    if (body.status === 'ACTIVE') {
      return NextResponse.json({
        error: 'USE_STRATEGY_APPROVAL_ENDPOINT',
        message: 'Approve strategy through /strategy-approval so the decision is validated and audited.',
      }, { status: 409 })
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

    const updated = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.update({ where: { id: params.id }, data })
      await tx.campaignActivity.create({
        data: { campaignId: params.id, type: activityType, description: activityDesc },
      })

      return campaign
    })

    return NextResponse.json({ campaign: updated })
  } catch (err: any) {
    console.error('[campaigns/[id] PATCH]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id] — hard delete
export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params;
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
