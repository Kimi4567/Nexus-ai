import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: Promise<{ id: string }> }

async function ownsCampaign(campaignId: string, userId: string) {
  return prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
  })
}

// GET /api/campaigns/[id] — full campaign detail + activities
export async function GET(req: NextRequest, props: Params) {
  const params = await props.params
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

    return NextResponse.json({ campaign: { ...campaign, socialPostCount } })
  } catch (err: any) {
    console.error('[campaigns/[id] GET]', err)
    return NextResponse.json({ error: 'Failed to load campaign' }, { status: 500 })
  }
}

// PATCH /api/campaigns/[id] — update fields + auto-log activity
export async function PATCH(req: NextRequest, props: Params) {
  const params = await props.params
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
      if (!sentinelPassed) {
        return NextResponse.json({
          error: 'ENGINE_NOT_READY',
          message: 'Run NEXUS Engine and pass Sentinel review before approval.',
        }, { status: 409 })
      }
    }

    const updated = await prisma.campaign.update({ where: { id: params.id }, data })

    // Campaign status changes are workflow events only. They must not write
    // strategy hooks/angles into Brand Brain as performance learning.

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
export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await ownsCampaign(params.id, userId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const confirmation = req.headers.get('x-nexus-confirm-campaign-delete')
    if (confirmation !== params.id) {
      return NextResponse.json({
        error: 'DELETE_CONFIRMATION_REQUIRED',
        message: 'Permanent campaign deletion requires an explicit campaign-id confirmation.',
      }, { status: 400 })
    }

    // SocialPost.campaignId is intentionally a compatibility field rather than
    // a cascading relation. Never leave orphaned post records after deleting a
    // progressed campaign; archiving is the correct lifecycle action.
    const socialPostCount = await (prisma as any).socialPost.count({
      where: { campaignId: params.id, workspace: { ownerId: userId } },
    })
    if (socialPostCount > 0) {
      return NextResponse.json({
        error: 'CAMPAIGN_HAS_CONTENT',
        message: 'Campaigns with Content Hub posts must be archived, not permanently deleted.',
        socialPostCount,
      }, { status: 409 })
    }

    await prisma.campaign.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[campaigns/[id] DELETE]', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
