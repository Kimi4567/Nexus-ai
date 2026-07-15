/**
 * GET   /api/ad-campaigns/[id]  — Full campaign detail (with ad sets + ads)
 * PATCH /api/ad-campaigns/[id]  — Update campaign fields
 * DELETE /api/ad-campaigns/[id] — Archive (soft delete) a campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'
import { resolvePaidStrategyRevisionTruth } from '@/lib/paidStrategyRevision'

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
        strategySnapshot: {
          select: { id: true, version: true, scope: true, payloadHash: true, createdAt: true },
        },
        budgetApprovalSnapshot: {
          select: { id: true, version: true, scope: true, payloadHash: true, createdAt: true },
        },
        launchApprovalSnapshot: {
          select: { id: true, version: true, scope: true, payloadHash: true, createdAt: true },
        },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const sourceStrategy = campaign.organicCampaignId
      ? await prisma.campaign.findFirst({
          where: {
            id: campaign.organicCampaignId,
            workspace: { ownerId: user.id },
          },
          select: { id: true, name: true, status: true, updatedAt: true },
        })
      : null
    const latestStrategySnapshot = campaign.organicCampaignId
      ? await prisma.campaignSnapshot.findFirst({
          where: {
            workspaceId: campaign.workspaceId,
            campaignId: campaign.organicCampaignId,
            scope: 'STRATEGY_APPROVAL',
          },
          orderBy: { version: 'desc' },
          select: { id: true, version: true },
        })
      : null
    const sourceRevision = resolvePaidStrategyRevisionTruth({
      pinnedSnapshotId: campaign.strategySnapshotId,
      latestSnapshot: latestStrategySnapshot,
    })

    return NextResponse.json({ campaign: { ...campaign, sourceStrategy, sourceRevision } })
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
    if (existing.status !== 'DRAFT' || existing.platformCampaignId) {
      return NextResponse.json({
        error: 'PAID_DRAFT_NOT_EDITABLE',
        code: 'PAID_DRAFT_NOT_EDITABLE',
      }, { status: 409 })
    }
    const paidSource = await getPaidStrategySourceForUser({
      campaignId: typeof existing.organicCampaignId === 'string' ? existing.organicCampaignId : '',
      userId: user.id,
      strategySnapshotId: typeof existing.strategySnapshotId === 'string' ? existing.strategySnapshotId : null,
      requirePinnedSnapshot: true,
    })

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

    if (
      (status !== undefined && status !== 'DRAFT')
      || platformCampaignId !== undefined
      || platformStatus !== undefined
    ) {
      return NextResponse.json({
        error: 'Paid campaign lifecycle and provider IDs cannot be changed through generic updates. Use the explicit platform activation route after final approval, or the dedicated draft, pause, and archive routes.',
        mode: 'activation_route_required',
      }, { status: 400 })
    }
    if (objective !== undefined && objective !== paidSource.truth.executionObjective) {
      return NextResponse.json({
        error: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        code: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        expectedObjective: paidSource.truth.executionObjective,
      }, { status: 422 })
    }

    const budgetDecisionChanged = [
      name,
      objective,
      budgetType,
      dailyBudget,
      lifetimeBudget,
      currency,
      startDate,
      endDate,
      adAccountId,
      utmCampaign,
    ].some(value => value !== undefined)

    const updated = await db.adCampaign.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(objective !== undefined && { objective }),
        ...(status !== undefined && { status: 'DRAFT' }),
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
        ...(budgetDecisionChanged && {
          budgetApprovalSnapshotId: null,
          launchApprovalSnapshotId: null,
        }),
      },
    })

    return NextResponse.json({ campaign: updated })
  } catch (err) {
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
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
