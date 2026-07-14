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
import {
  createGoogleAdsApi,
  extractGoogleResponsiveSearchAssets,
  extractGoogleSearchTargeting,
} from '@/lib/adPlatforms/googleAdsApi'
import { canActivatePlatformCampaign } from '@/lib/paidBoundary'
import { evaluatePaidExecutionReadiness } from '@/lib/paidExecutionReadiness'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'
import { paidPlatformSupportsObjective } from '@/lib/paidExecutionObjective'

export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
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

    const paidSource = await getPaidStrategySourceForUser({
      campaignId: typeof campaign.organicCampaignId === 'string' ? campaign.organicCampaignId : '',
      userId: user.id,
    })
    if (campaign.objective !== paidSource.truth.executionObjective) {
      return NextResponse.json({
        error: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
        code: 'PAID_OBJECTIVE_STRATEGY_MISMATCH',
      }, { status: 422 })
    }
    if (!paidPlatformSupportsObjective(campaign.platform, paidSource.truth.executionObjective)) {
      return NextResponse.json({
        error: 'PAID_PLATFORM_OBJECTIVE_UNSUPPORTED',
        code: 'PAID_PLATFORM_OBJECTIVE_UNSUPPORTED',
      }, { status: 422 })
    }

    const body = await req.json().catch(() => ({}))
    const adAccount = campaign.adAccount as Record<string, unknown> | null
    const adSets = (campaign.adSets || []) as Array<Record<string, unknown> & {
      ads?: Array<Record<string, unknown>>
    }>
    const googleTargeting = adSets.map(adSet => {
      const local = adSet.targeting && typeof adSet.targeting === 'object'
        ? adSet.targeting as Record<string, unknown>
        : null
      return extractGoogleSearchTargeting(
        Array.isArray(local?.google_keywords) || Array.isArray(local?.keywords)
          ? local
          : campaign.aiAudienceBrief,
      )
    })
    const readinessAds = adSets.flatMap(adSet => {
      const ads = adSet.ads || []
      return ads.map(ad => {
        const assets = extractGoogleResponsiveSearchAssets(ad, ads)
        return {
          ...ad,
          googleHeadlines: assets.headlines,
          googleDescriptions: assets.descriptions,
        }
      })
    })
    const readiness = evaluatePaidExecutionReadiness({
      platform: campaign.platform,
      budgetType: campaign.budgetType,
      dailyBudget: campaign.dailyBudget,
      lifetimeBudget: campaign.lifetimeBudget,
      ads: readinessAds,
      googleCampaignType: campaign.platform === 'GOOGLE' ? 'SEARCH' : undefined,
      googleKeywordCount: campaign.platform === 'GOOGLE'
        ? googleTargeting.reduce((sum, targeting) => sum + targeting.keywords.length, 0)
        : undefined,
      googleTargetingReady: campaign.platform === 'GOOGLE'
        ? googleTargeting.length > 0 && googleTargeting.every(targeting => targeting.blockers.length === 0)
        : undefined,
    })

    if (campaign.platform !== 'META' && campaign.platform !== 'GOOGLE') {
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

    if (!adAccount?.accessToken || !adAccount?.platformAccountId || (campaign.platform === 'GOOGLE' && !adAccount?.refreshToken)) {
      return NextResponse.json({
        error: `Connected ${campaign.platform} ad account credentials are missing. No platform action was taken.`,
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

    const activated = {
      campaignId: String(campaign.platformCampaignId),
      adSetIds: [] as string[],
      adIds: [] as string[],
    }

    if (campaign.platform === 'GOOGLE') {
      const api = createGoogleAdsApi({
        customerId: String(adAccount.platformAccountId),
        loginCustomerId: typeof adAccount.loginCustomerId === 'string' ? adAccount.loginCustomerId : null,
        encryptedAccessToken: String(adAccount.accessToken),
        encryptedRefreshToken: String(adAccount.refreshToken),
      })
      const adGroupResourceNames = adSets.map(adSet => String(adSet.platformAdSetId))
      const adResourceNames = adSets.flatMap(adSet => (adSet.ads || []).map(ad => String(ad.platformAdId)))
      await api.activateSearchDraft({
        campaignResourceName: String(campaign.platformCampaignId),
        adGroupResourceNames,
        adResourceNames,
      })
      activated.adSetIds.push(...adGroupResourceNames)
      activated.adIds.push(...adResourceNames)
    } else {
      const api = createMetaAdsApi(
        String(adAccount.accessToken),
        String(adAccount.platformAccountId)
      )

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
    }

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
        platformStatus: campaign.platform === 'GOOGLE' ? 'ENABLED' : 'ACTIVE',
      },
    })

    return NextResponse.json({
      mode: 'platform_activation',
      success: true,
      campaign: updated,
      activated,
      note: `Existing ${campaign.platform} platform draft objects were activated after explicit approval. Paid spend may occur on the connected platform.`,
    })
  } catch (err) {
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    console.error('[activate-platform]', err)
    const message = err instanceof Error ? err.message : 'Activation failed'
    return NextResponse.json({ error: message, mode: 'platform_activation_failed' }, { status: 500 })
  }
}
