/**
 * PATCH /api/campaigns/[id]/paid-pack/metrics
 * Save performance metrics + mark campaign status
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      impressions,
      reach,
      clicks,
      ctr,
      cpc,
      cpm,
      spend,
      conversions,
      roas,
      metricsSource = 'manual',
      status,
      launchNotes,
    } = body

    const metrics = { impressions, reach, clicks, ctr, cpc, cpm, spend, conversions, roas }

    const pack = await db.paidCampaignPack.update({
      where: { campaignId: params.id },
      data: {
        metrics,
        metricsSource,
        metricsUpdatedAt: new Date(),
        ...(status && { status }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        ...(status === 'LAUNCHED' && { launchedAt: new Date() }),
        ...(launchNotes !== undefined && { launchNotes }),
      },
    })

    return NextResponse.json({ pack, success: true })
  } catch (err) {
    console.error('[paid-pack/metrics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
