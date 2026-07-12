/**
 * GET    /api/ad-campaigns/[id]/ad-sets/[setId]  — Get ad set detail
 * PATCH  /api/ad-campaigns/[id]/ad-sets/[setId]  — Update ad set
 * DELETE /api/ad-campaigns/[id]/ad-sets/[setId]  — Archive ad set
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string; setId: string }> }
) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adSet = await db.adSet.findFirst({
      where: {
        id: params.setId,
        adCampaign: { id: params.id, workspace: { ownerId: user.id } },
      },
      include: {
        ads: true,
        _count: { select: { ads: true } },
      },
    })

    if (!adSet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ adSet })
  } catch (err) {
    console.error('[ad-sets/[setId] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; setId: string }> }
) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await db.adSet.findFirst({
      where: {
        id: params.setId,
        adCampaign: { id: params.id, workspace: { ownerId: user.id } },
      },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      name, status, dailyBudget, lifetimeBudget, bidStrategy, bidAmount,
      startDate, endDate, targeting, placements, optimizationGoal, billingEvent,
      platformAdSetId, platformStatus,
    } = body

    const updated = await db.adSet.update({
      where: { id: params.setId },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(dailyBudget !== undefined && { dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null }),
        ...(lifetimeBudget !== undefined && { lifetimeBudget: lifetimeBudget ? parseFloat(lifetimeBudget) : null }),
        ...(bidStrategy !== undefined && { bidStrategy }),
        ...(bidAmount !== undefined && { bidAmount: bidAmount ? parseFloat(bidAmount) : null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(targeting !== undefined && { targeting }),
        ...(placements !== undefined && { placements }),
        ...(optimizationGoal !== undefined && { optimizationGoal }),
        ...(billingEvent !== undefined && { billingEvent }),
        ...(platformAdSetId !== undefined && { platformAdSetId }),
        ...(platformStatus !== undefined && { platformStatus }),
      },
    })

    return NextResponse.json({ adSet: updated })
  } catch (err) {
    console.error('[ad-sets/[setId] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; setId: string }> }
) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await db.adSet.findFirst({
      where: {
        id: params.setId,
        adCampaign: { id: params.id, workspace: { ownerId: user.id } },
      },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Soft-archive to preserve ad performance data
    await db.adSet.update({
      where: { id: params.setId },
      data: { status: 'ARCHIVED' },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ad-sets/[setId] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
