/**
 * GET  /api/ad-campaigns  — List all paid ad campaigns for the workspace
 * POST /api/ad-campaigns  — Create a new paid ad campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import {
  buildTrackedPaidDestinationUrl,
  normalizePaidDestinationUrl,
} from '@/lib/paidExecutionReadiness'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'
import { paidPlatformSupportsObjective } from '@/lib/paidExecutionObjective'
import { resolvePaidStrategyRevisionTruth } from '@/lib/paidStrategyRevision'
import { paidStrategyAllowsPlatform } from '@/lib/paidStrategyPlatforms'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ campaigns: [] })

    const campaigns = await db.adCampaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      include: {
        adAccount: {
          select: {
            id: true,
            platform: true,
            platformAccountName: true,
            currency: true,
            status: true,
          },
        },
        adSets: {
          select: { id: true, name: true, status: true, totalSpend: true },
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
        _count: {
          select: { adSets: true },
        },
      },
    })

    const sourceIds: string[] = Array.from(new Set<string>(
      (campaigns as Array<{ organicCampaignId?: string | null }>)
        .flatMap(campaign => campaign.organicCampaignId ? [campaign.organicCampaignId] : []),
    ))
    const sourceStrategies = sourceIds.length > 0
      ? await prisma.campaign.findMany({
          where: { id: { in: sourceIds }, workspaceId: workspace.id },
          select: { id: true, name: true, status: true, updatedAt: true },
        })
      : []
    const strategySnapshots = sourceIds.length > 0
      ? await prisma.campaignSnapshot.findMany({
          where: {
            workspaceId: workspace.id,
            campaignId: { in: sourceIds },
            scope: 'STRATEGY_APPROVAL',
          },
          orderBy: { version: 'desc' },
          select: { id: true, campaignId: true, version: true },
        })
      : []
    const sourceById = new Map(sourceStrategies.map(source => [source.id, source]))
    const latestSnapshotByCampaign = new Map<string, { id: string; version: number }>()
    for (const snapshot of strategySnapshots) {
      if (!latestSnapshotByCampaign.has(snapshot.campaignId)) {
        latestSnapshotByCampaign.set(snapshot.campaignId, snapshot)
      }
    }

    return NextResponse.json({
      campaigns: campaigns.map((campaign: { organicCampaignId?: string | null; strategySnapshotId?: string | null }) => {
        const latestSnapshot = campaign.organicCampaignId
          ? latestSnapshotByCampaign.get(campaign.organicCampaignId) ?? null
          : null
        return {
          ...campaign,
          sourceStrategy: campaign.organicCampaignId
            ? sourceById.get(campaign.organicCampaignId) ?? null
            : null,
          sourceRevision: resolvePaidStrategyRevisionTruth({
            pinnedSnapshotId: campaign.strategySnapshotId,
            latestSnapshot,
          }),
        }
      }),
    })
  } catch (err) {
    console.error('[ad-campaigns GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      name,
      platform,
      adAccountId,
      organicCampaignId,
      objective,
      budgetType = 'DAILY',
      dailyBudget,
      lifetimeBudget,
      currency = 'USD',
      startDate,
      endDate,
      utmCampaign,
      utmMedium,
      destinationUrl,
      isAbTest = false,
    } = body

    if (!name || !platform) {
      return NextResponse.json({ error: 'name and platform are required' }, { status: 400 })
    }
    if (!['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN'].includes(String(platform))) {
      return NextResponse.json({ error: 'Unsupported paid platform' }, { status: 400 })
    }

    const paidSource = await getPaidStrategySourceForUser({
      campaignId: typeof organicCampaignId === 'string' ? organicCampaignId : '',
      userId: user.id,
    })
    const workspaceId = paidSource.campaign.workspaceId
    if (objective && objective !== paidSource.truth.executionObjective) {
      return NextResponse.json({
        error: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        code: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        expectedObjective: paidSource.truth.executionObjective,
      }, { status: 422 })
    }
    if (!paidPlatformSupportsObjective(platform, paidSource.truth.executionObjective)) {
      return NextResponse.json({
        error: 'PAID_PLATFORM_OBJECTIVE_UNSUPPORTED',
        code: 'PAID_PLATFORM_OBJECTIVE_UNSUPPORTED',
        objective: paidSource.truth.executionObjective,
        platform,
      }, { status: 422 })
    }
    if (!paidStrategyAllowsPlatform(paidSource.truth, platform)) {
      return NextResponse.json({
        error: 'PAID_PLATFORM_STRATEGY_MISMATCH',
        code: 'PAID_PLATFORM_STRATEGY_MISMATCH',
        approvedPlatforms: paidSource.truth.approvedPlatforms,
        planningOnlyPlatforms: paidSource.truth.planningOnlyPlatforms,
      }, { status: 422 })
    }
    const normalizedBudgetType = budgetType === 'LIFETIME' ? 'LIFETIME' : 'DAILY'
    const parsedDailyBudget = dailyBudget === undefined || dailyBudget === null || dailyBudget === ''
      ? null
      : Number(dailyBudget)
    const parsedLifetimeBudget = lifetimeBudget === undefined || lifetimeBudget === null || lifetimeBudget === ''
      ? null
      : Number(lifetimeBudget)
    const selectedBudget = normalizedBudgetType === 'DAILY' ? parsedDailyBudget : parsedLifetimeBudget
    if (selectedBudget === null || !Number.isFinite(selectedBudget) || selectedBudget <= 0) {
      return NextResponse.json({
        error: 'PAID_BUDGET_REQUIRED',
        code: 'PAID_BUDGET_REQUIRED',
      }, { status: 422 })
    }
    const startAt = startDate ? new Date(startDate) : null
    const endAt = endDate ? new Date(endDate) : null
    if (
      !startAt
      || !endAt
      || Number.isNaN(startAt.getTime())
      || Number.isNaN(endAt.getTime())
      || endAt.getTime() <= startAt.getTime()
    ) {
      return NextResponse.json({
        error: 'PAID_SCHEDULE_REQUIRED',
        code: 'PAID_SCHEDULE_REQUIRED',
      }, { status: 422 })
    }
    if (!adAccountId) {
      return NextResponse.json({
        error: 'PAID_AD_ACCOUNT_REQUIRED',
        code: 'PAID_AD_ACCOUNT_REQUIRED',
      }, { status: 422 })
    }

    const baseDestinationUrl = normalizePaidDestinationUrl(destinationUrl)
    if (!baseDestinationUrl) {
      return NextResponse.json({
        error: 'A public HTTPS conversion destination is required. Placeholder, local, and non-HTTPS URLs are not allowed.',
        code: 'INVALID_PAID_DESTINATION',
      }, { status: 400 })
    }

    const campaignSlug = typeof utmCampaign === 'string' && utmCampaign.trim()
      ? utmCampaign.trim()
      : name
    const trackedDestinationUrl = buildTrackedPaidDestinationUrl({
      destinationUrl: baseDestinationUrl,
      platform,
      campaignSlug,
    })
    if (!trackedDestinationUrl) {
      return NextResponse.json({ error: 'Could not create a tracked conversion destination.' }, { status: 400 })
    }
    const trackedUrl = new URL(trackedDestinationUrl)

    // Validate ad account belongs to this workspace if provided
    if (adAccountId) {
      const account = await db.adAccount.findFirst({
        where: { id: adAccountId, workspaceId },
      })
      if (!account) {
        return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
      }
      if (account.platform !== platform) {
        return NextResponse.json({ error: 'The selected ad account does not match the campaign platform.' }, { status: 400 })
      }
      if (account.status !== 'ACTIVE') {
        return NextResponse.json({
          error: 'PAID_AD_ACCOUNT_NOT_ACTIVE',
          code: 'PAID_AD_ACCOUNT_NOT_ACTIVE',
        }, { status: 422 })
      }
      if (account.currency && String(account.currency).toUpperCase() !== String(currency).toUpperCase()) {
        return NextResponse.json({
          error: 'AD_ACCOUNT_CURRENCY_MISMATCH',
          code: 'AD_ACCOUNT_CURRENCY_MISMATCH',
          expectedCurrency: account.currency,
        }, { status: 422 })
      }
    }

    const campaign = await db.adCampaign.create({
      data: {
        workspaceId,
        adAccountId: adAccountId || null,
        organicCampaignId: paidSource.campaign.id,
        strategySnapshotId: paidSource.snapshot.id,
        platform,
        name,
        objective: paidSource.truth.executionObjective,
        status: 'DRAFT',
        budgetType: normalizedBudgetType,
        dailyBudget: normalizedBudgetType === 'DAILY' ? parsedDailyBudget : null,
        lifetimeBudget: normalizedBudgetType === 'LIFETIME' ? parsedLifetimeBudget : null,
        currency,
        startDate: startAt,
        endDate: endAt,
        utmSource: trackedUrl.searchParams.get('utm_source'),
        utmCampaign: trackedUrl.searchParams.get('utm_campaign'),
        utmMedium: utmMedium || trackedUrl.searchParams.get('utm_medium') || 'paid_social',
        trackingUrls: {
          baseDestinationUrl,
          [String(platform).toLowerCase()]: trackedDestinationUrl,
        },
        isAbTest,
      },
      include: {
        adAccount: {
          select: { id: true, platform: true, platformAccountName: true, currency: true },
        },
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (err) {
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    console.error('[ad-campaigns POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
