/**
 * PATCH /api/campaigns/[id]/paid-pack/metrics
 * Save performance metrics + mark campaign status
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import {
  canRecordExternalPaidLaunch,
  canRecordPaidCompletion,
  isUnsafePaidPackStatus,
} from '@/lib/paidBoundary'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
      explicitExternalLaunchConfirmed,
      explicitCompletionConfirmed,
    } = body

    const metricsProvided = [
      impressions,
      reach,
      clicks,
      ctr,
      cpc,
      cpm,
      spend,
      conversions,
      roas,
    ].some((value) => value !== undefined && value !== null && value !== '')

    const existingPack = await db.paidCampaignPack.findUnique({
      where: { campaignId: params.id },
      select: { status: true },
    })

    const allowExternalLaunch = canRecordExternalPaidLaunch({
      requestedStatus: status,
      explicitExternalLaunchConfirmed,
      metricsProvided,
    })
    const allowCompletion = canRecordPaidCompletion({
      requestedStatus: status,
      explicitCompletionConfirmed,
      currentStatus: existingPack?.status,
    })

    if (isUnsafePaidPackStatus(status) && !allowExternalLaunch && !allowCompletion) {
      return NextResponse.json({
        error: 'Manual paid metrics cannot mark paid content launched, completed, active, or ready to launch.',
      }, { status: 400 })
    }

    const metrics = { impressions, reach, clicks, ctr, cpc, cpm, spend, conversions, roas }
    const statusUpdate = allowExternalLaunch
      ? { status: 'LAUNCHED', launchedAt: new Date() }
      : allowCompletion
        ? { status: 'COMPLETED', completedAt: new Date() }
        : {}

    const pack = await db.paidCampaignPack.update({
      where: { campaignId: params.id },
      data: {
        ...(metricsProvided && {
          metrics,
          metricsSource,
          metricsUpdatedAt: new Date(),
        }),
        ...statusUpdate,
        ...(launchNotes !== undefined && { launchNotes }),
      },
    })

    return NextResponse.json({ pack, success: true })
  } catch (err) {
    console.error('[paid-pack/metrics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
