/**
 * POST /api/ad-campaigns/[id]/activate-platform
 *
 * Activates an already-created PAUSED paid platform draft after explicit
 * approval. This route never creates campaigns, ad sets, ads, budgets, or
 * creatives. It only changes existing platform objects from PAUSED to ACTIVE
 * after all approval gates pass.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { createMetaAdsApi } from '@/lib/adPlatforms/metaAdsApi'
import { canActivatePlatformCampaign } from '@/lib/paidBoundary'
import { evaluatePaidExecutionReadiness } from '@/lib/paidExecutionReadiness'

export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: {
        adAccount: true,
        adSets: {
          include: { ads: true },
        },
      },
    })

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const adAccount = campaign.adAccount as Record<string, unknown> | null
    const adSets = (campaign.adSets || []) as Array<Record<string, unknown> & {
      ads?: Array<Record<string, unknown>>
    }>
    const readiness = evaluatePaidExecutionReadiness({
      platform: campaign.platform,
      budgetType: campaign.budgetType,
      dailyBudget: campaign.dailyBudget,
      lifetimeBudget: campaign.lifetimeBudget,
      ads: adSets.flatMap(adSet => adSet.ads || []),
    })

    if (campaign.platform !== 'META') {
      return NextResponse.json({
        error: `${campaign.platform} activation is not available yet. No platform action was taken.`,
        mode: 'unsupported_platform',
      }, { status: 400 })
    }

    const activationAllowed = canActivatePlatformCampaign({
      platform: campaign.platform,
      localStatus: campaign.status,
      platformCampaignId: campaign.platformCampaignId,
      platformStatus: campaign.platformStatus,
      adAccountHasApiAccess: adAccount?.hasApiAccess,
      explicitPlatformActivationConfirmed: body.explicitPlatformActivationConfirmed,
      explicitSpendActivationConfirmed: body.explicitSpendActivationConfirmed,
      explicitBudgetConfirmed: body.explicitBudgetConfirmed,
      explicitExecutionReadinessConfirmed: body.explicitExecutionReadinessConfirmed,
      executionReady: readiness.ready,
    })

    if (!activationAllowed) {
      return NextResponse.json({
        error: readiness.ready
          ? 'Paid activation requires a paused platform draft, approved API access, confirmed budget, and explicit launch/spend approval. No platform action was taken.'
          : 'Paid execution readiness is incomplete. No platform action was taken.',
        mode: 'activation_blocked',
        blockers: readiness.blockers,
        gates: {
          platform: campaign.platform,
          localStatus: campaign.status,
          platformStatus: campaign.platformStatus,
          platformCampaignIdPresent: typeof campaign.platformCampaignId === 'string' && campaign.platformCampaignId.trim().length > 0,
          adAccountHasApiAccess: adAccount?.hasApiAccess === true,
          explicitPlatformActivationConfirmed: body.explicitPlatformActivationConfirmed === true,
          explicitSpendActivationConfirmed: body.explicitSpendActivationConfirmed === true,
          explicitBudgetConfirmed: body.explicitBudgetConfirmed === true,
          explicitExecutionReadinessConfirmed: body.explicitExecutionReadinessConfirmed === true,
          executionReady: readiness.ready,
        },
      }, { status: 400 })
    }

    if (!adAccount?.accessToken || !adAccount?.platformAccountId) {
      return NextResponse.json({
        error: 'Connected Meta ad account credentials are missing. No platform action was taken.',
        mode: 'activation_blocked',
      }, { status: 409 })
    }

    const missingPlatformObjects: string[] = []

    if (!campaign.platformCampaignId) missingPlatformObjects.push('campaign.platformCampaignId')
    for (const adSet of adSets) {
      if (!adSet.platformAdSetId) missingPlatformObjects.push(`adSet:${String(adSet.id)}.platformAdSetId`)
      for (const ad of adSet.ads || []) {
        if (!ad.platformAdId) missingPlatformObjects.push(`ad:${String(ad.id)}.platformAdId`)
      }
    }

    if (adSets.length === 0) missingPlatformObjects.push('adSets')

    if (missingPlatformObjects.length > 0) {
      return NextResponse.json({
        error: 'Activation requires an existing paused platform draft for the campaign, every ad set, and every ad. No platform action was taken.',
        mode: 'activation_blocked',
        missingPlatformObjects,
      }, { status: 409 })
    }

    const api = createMetaAdsApi(
      String(adAccount.accessToken),
      String(adAccount.platformAccountId)
    )

    const activated = {
      campaignId: String(campaign.platformCampaignId),
      adSetIds: [] as string[],
      adIds: [] as string[],
    }

    // Activate children first while the campaign remains paused. This avoids
    // delivery until the final campaign-level activation succeeds.
    for (const adSet of adSets) {
      const adSetId = String(adSet.platformAdSetId)
      await api.updateObjectStatus(adSetId, 'ACTIVE')
      activated.adSetIds.push(adSetId)

      for (const ad of adSet.ads || []) {
        const adId = String(ad.platformAdId)
        await api.updateObjectStatus(adId, 'ACTIVE')
        activated.adIds.push(adId)
      }
    }

    await api.updateCampaignStatus(String(campaign.platformCampaignId), 'ACTIVE')

    for (const adSet of adSets) {
      await db.adSet.update({
        where: { id: String(adSet.id) },
        data: { status: 'ACTIVE' },
      })

      for (const ad of adSet.ads || []) {
        await db.ad.update({
          where: { id: String(ad.id) },
          data: { status: 'ACTIVE' },
        })
      }
    }

    const updated = await db.adCampaign.update({
      where: { id: String(campaign.id) },
      data: {
        status: 'ACTIVE',
        platformStatus: 'ACTIVE',
      },
    })

    return NextResponse.json({
      mode: 'platform_activation',
      success: true,
      campaign: updated,
      activated,
      note: 'Existing Meta platform draft objects were activated after explicit approval. Paid spend may occur on the connected platform.',
    })
  } catch (err) {
    console.error('[activate-platform]', err)
    const message = err instanceof Error ? err.message : 'Activation failed'
    return NextResponse.json({ error: message, mode: 'platform_activation_failed' }, { status: 500 })
  }
}
