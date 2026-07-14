/**
 * GET   /api/ad-campaigns/[id]  — Full campaign detail (with ad sets + ads)
 * PATCH /api/ad-campaigns/[id]  — Update campaign fields
 * DELETE /api/ad-campaigns/[id] — Archive (soft delete) a campaign
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
      where: {
        id: params.id,
        workspace: { ownerId: user.id },
      },
      include: {
        adAccount: {
          select: {
            id: true,
            platform: true,
            platformAccountName: true,
            businessName: true,
            currency: true,
            status: true,
            hasApiAccess: true,
            pixelId: true,
            pageId: true,
          },
        },
        adSets: {
          orderBy: { createdAt: 'asc' },
          include: {
            ads: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                platformAdId: true,
                platformCreativeId: true,
                name: true,
                status: true,
                format: true,
                primaryText: true,
                headline: true,
                description: true,
                aiHook: true,
                callToAction: true,
                destinationUrl: true,
                imageUrl: true,
                videoUrl: true,
                impressions: true,
                clicks: true,
                spend: true,
                ctr: true,
                cpc: true,
                roas: true,
                aiGenerated: true,
                aiAngle: true,
                variantGroup: true,
                variantLabel: true,
                isWinner: true,
                reviewStatus: true,
                specsValidated: true,
                specsErrors: true,
                creativeSpecs: true,
              },
            },
          },
        },
        performanceSnapshots: {
          where: { adSetId: null, adId: null }, // campaign-level only
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('[ad-campaigns/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const {
      name,
      objective,
      status,
      budgetType,
      dailyBudget,
      lifetimeBudget,
      currency,
      startDate,
      endDate,
      adAccountId,
      aiStrategy,
      aiAudienceBrief,
      aiBudgetPlan,
      brandBrainSnapshot,
      utmCampaign,
      platformCampaignId,
      platformStatus,
    } = body

    if (status === 'ACTIVE' || ['ACTIVE', 'ENABLED', 'RUNNING', 'LIVE'].includes(String(platformStatus).toUpperCase())) {
      return NextResponse.json({
        error: 'Paid campaigns cannot be marked active through generic updates. Use the explicit platform activation route after final approval.',
        mode: 'activation_route_required',
      }, { status: 400 })
    }

    const updated = await db.adCampaign.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(objective !== undefined && { objective }),
        ...(status !== undefined && { status }),
        ...(budgetType !== undefined && { budgetType }),
        ...(dailyBudget !== undefined && { dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null }),
        ...(lifetimeBudget !== undefined && { lifetimeBudget: lifetimeBudget ? parseFloat(lifetimeBudget) : null }),
        ...(currency !== undefined && { currency }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(adAccountId !== undefined && { adAccountId }),
        ...(aiStrategy !== undefined && { aiStrategy }),
        ...(aiAudienceBrief !== undefined && { aiAudienceBrief }),
        ...(aiBudgetPlan !== undefined && { aiBudgetPlan }),
        ...(brandBrainSnapshot !== undefined && { brandBrainSnapshot }),
        ...(utmCampaign !== undefined && { utmCampaign }),
        ...(platformCampaignId !== undefined && { platformCampaignId }),
        ...(platformStatus !== undefined && { platformStatus }),
      },
    })

    return NextResponse.json({ campaign: updated })
  } catch (err) {
    console.error('[ad-campaigns/[id] PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Soft-archive rather than hard-delete to preserve performance data
    await db.adCampaign.update({
      where: { id: params.id },
      data: { status: 'ARCHIVED' },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ad-campaigns/[id] DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
