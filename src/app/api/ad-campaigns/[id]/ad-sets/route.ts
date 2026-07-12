/**
 * GET  /api/ad-campaigns/[id]/ad-sets  — List ad sets for a campaign
 * POST /api/ad-campaigns/[id]/ad-sets  — Create a new ad set
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const adSets = await db.adSet.findMany({
      where: { adCampaignId: params.id },
      orderBy: { createdAt: 'asc' },
      include: {
        ads: {
          select: {
            id: true,
            name: true,
            status: true,
            format: true,
            headline: true,
            callToAction: true,
            imageUrl: true,
            impressions: true,
            clicks: true,
            spend: true,
            ctr: true,
            aiGenerated: true,
            variantLabel: true,
            isWinner: true,
          },
        },
        _count: { select: { ads: true } },
      },
    })

    return NextResponse.json({ adSets })
  } catch (err) {
    console.error('[ad-sets GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      name,
      dailyBudget,
      lifetimeBudget,
      bidStrategy = 'LOWEST_COST',
      bidAmount,
      startDate,
      endDate,
      targeting,
      placements,
      optimizationGoal,
      billingEvent,
    } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const adSet = await db.adSet.create({
      data: {
        adCampaignId: params.id,
        name,
        status: 'DRAFT',
        dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null,
        lifetimeBudget: lifetimeBudget ? parseFloat(lifetimeBudget) : null,
        bidStrategy,
        bidAmount: bidAmount ? parseFloat(bidAmount) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        targeting: targeting || null,
        placements: placements || null,
        optimizationGoal: optimizationGoal || null,
        billingEvent: billingEvent || null,
      },
    })

    return NextResponse.json({ adSet }, { status: 201 })
  } catch (err) {
    console.error('[ad-sets POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
