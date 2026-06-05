/**
 * GET  /api/campaigns/[id]/paid-pack  — fetch existing pack (or null)
 * POST /api/campaigns/[id]/paid-pack  — upsert setup (objective, platforms, budget, duration)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(
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

    const pack = await db.paidCampaignPack.findUnique({
      where: { campaignId: params.id },
    })

    return NextResponse.json({ pack })
  } catch (err) {
    console.error('[paid-pack GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: { workspace: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      objective = 'TRAFFIC',
      platforms = [],
      dailyBudget,
      totalBudget,
      durationDays = 7,
      startDate,
      currency = 'USD',
      creativeAssetUrls = [],
      primaryCopyId,
      launchNotes,
      status,
    } = body

    const pack = await db.paidCampaignPack.upsert({
      where: { campaignId: params.id },
      update: {
        objective,
        platforms,
        dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null,
        totalBudget: totalBudget ? parseFloat(totalBudget) : null,
        durationDays: parseInt(durationDays),
        startDate: startDate ? new Date(startDate) : null,
        currency,
        creativeAssetUrls,
        primaryCopyId: primaryCopyId || null,
        ...(launchNotes !== undefined && { launchNotes }),
        ...(status && { status }),
      },
      create: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        objective,
        platforms,
        dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null,
        totalBudget: totalBudget ? parseFloat(totalBudget) : null,
        durationDays: parseInt(durationDays),
        startDate: startDate ? new Date(startDate) : null,
        currency,
        creativeAssetUrls,
        primaryCopyId: primaryCopyId || null,
      },
    })

    return NextResponse.json({ pack, success: true })
  } catch (err) {
    console.error('[paid-pack POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
