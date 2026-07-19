/**
 * POST /api/ad-campaigns/[id]/push-to-platform
 *
 * Exports or creates paused draft objects in the connected ad platform.
 *
 * Behavior:
 *   - hasApiAccess = true  → Create paused draft objects via Meta Marketing API
 *   - hasApiAccess = false → Dry-run: returns JSON payload for manual import
 *
 * Meta flow:
 *   1. Create campaign (returns platformCampaignId)
 *   2. Create ad set (returns platformAdSetId)
 *   3. Create ad creative per Ad record
 *   4. Create ad (binds ad set + creative)
 *   5. Update campaign.platformCampaignId, adSet.platformAdSetId, ad.platformAdId
 *
 * After a successful push, campaign remains non-active locally because Meta
 * campaign/ad set/ad objects are created in PAUSED state.
 *
 * Rate limiting: Meta allows 200 calls/hour. For campaigns with many ads,
 * we batch creations and add 200ms delays between calls.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { createMetaAdsApi, nexusToMetaTargeting, NEXUS_TO_META_OBJECTIVE } from '@/lib/adPlatforms/metaAdsApi'
import {
  createGoogleAdsApi,
  extractGoogleResponsiveSearchAssets,
  extractGoogleSearchTargeting,
  type GoogleSearchTargeting,
} from '@/lib/adPlatforms/googleAdsApi'
import { canCreatePlatformDraft, getBudgetTruth, mapPausedPlatformPushStatus } from '@/lib/paidBoundary'
import {
  evaluatePaidExecutionReadiness,
  normalizePaidDestinationUrl,
} from '@/lib/paidExecutionReadiness'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'
import {
  googleSearchBiddingMode,
  paidPlatformSupportsObjective,
} from '@/lib/paidExecutionObjective'
import {
  approvePaidBudgetDecision,
  PaidApprovalError,
} from '@/lib/paidApprovalService'
import { paidStrategyAllowsPlatform } from '@/lib/paidStrategyPlatforms'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load campaign with all relations
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
    if (campaign.status !== 'DRAFT' || campaign.platformCampaignId) {
      return NextResponse.json({
        error: 'PAID_DRAFT_NOT_EDITABLE',
        code: 'PAID_DRAFT_NOT_EDITABLE',
        mode: 'platform_revision_required',
      }, { status: 409 })
    }

    const paidSource = await getPaidStrategySourceForUser({
      campaignId: typeof campaign.organicCampaignId === 'string' ? campaign.organicCampaignId : '',
      userId: user.id,
      strategySnapshotId: typeof campaign.strategySnapshotId === 'string' ? campaign.strategySnapshotId : null,
      requirePinnedSnapshot: true,
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
    if (!paidStrategyAllowsPlatform(paidSource.truth, campaign.platform)) {
      return NextResponse.json({
        error: 'PAID_PLATFORM_STRATEGY_MISMATCH',
        code: 'PAID_PLATFORM_STRATEGY_MISMATCH',
        approvedPlatforms: paidSource.truth.approvedPlatforms,
      }, { status: 422 })
    }
    if (paidSource.truth.launchReadiness && !paidSource.truth.launchReadiness.ready) {
      return NextResponse.json({
        error: 'PAID_STRATEGY_LAUNCH_INPUTS_REQUIRED',
        code: 'PAID_STRATEGY_LAUNCH_INPUTS_REQUIRED',
        blockers: paidSource.truth.launchReadiness.blockers,
      }, { status: 422 })
    }

    const body = await req.json().catch(() => ({}))

    // ── Route to platform handler ──────────────────────────────────────
    if (campaign.platform === 'META') {
      return handleMetaPush(campaign, body, user.id)
    }

    if (campaign.platform === 'GOOGLE') {
      return handleGooglePush(campaign, body, user.id)
    }

    // Other platforms: dry-run export only
    return NextResponse.json({
      mode: 'dry_run',
      platform: campaign.platform,
      message: `${campaign.platform} API draft creation is not available yet. Export the planning payload for manual review.`,
      payload: {
        campaign: {
          name: campaign.name,
          objective: campaign.objective,
          budget: campaign.dailyBudget,
          currency: campaign.currency,
        },
        adSets: campaign.adSets,
      },
    })
  } catch (err) {
    if (err instanceof PaidStrategySourceError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    if (err instanceof PaidApprovalError) {
      return NextResponse.json({ error: err.code, code: err.code }, { status: err.status })
    }
    console.error('[push-to-platform]', err)
    const message = err instanceof Error ? err.message : 'Push failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function googleTargetingForAdSet(
  campaign: Record<string, unknown>,
  adSet: Record<string, unknown>,
): GoogleSearchTargeting {
  const localTargeting = adSet.targeting && typeof adSet.targeting === 'object'
    ? adSet.targeting as Record<string, unknown>
    : null
  const hasLocalKeywords = Array.isArray(localTargeting?.google_keywords)
    || Array.isArray(localTargeting?.keywords)
  return extractGoogleSearchTargeting(
    hasLocalKeywords ? localTargeting : campaign.aiAudienceBrief,
  )
}

async function handleGooglePush(campaign: Record<string, unknown>, body: Record<string, unknown>, userId: string) {
  const adAccount = campaign.adAccount as Record<string, unknown> | null
  const adSets = (campaign.adSets || []) as Array<Record<string, unknown> & {
    ads?: Array<Record<string, unknown>>
  }>
  const groupTargeting = adSets.map(adSet => googleTargetingForAdSet(campaign, adSet))
  const allAds = adSets.flatMap(adSet => {
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
  const targetingBlockers = groupTargeting.flatMap(targeting => targeting.blockers)
  const readiness = evaluatePaidExecutionReadiness({
    platform: campaign.platform,
    budgetType: campaign.budgetType,
    dailyBudget: campaign.dailyBudget,
    lifetimeBudget: campaign.lifetimeBudget,
    ads: allAds,
    googleCampaignType: groupTargeting.every(targeting => !targeting.blockers.some(blocker => blocker.includes('Search campaigns only')))
      ? 'SEARCH'
      : null,
    googleKeywordCount: groupTargeting.reduce((sum, targeting) => sum + targeting.keywords.length, 0),
    googleTargetingReady: adSets.length > 0 && targetingBlockers.length === 0,
  })
  const budgetTruth = getBudgetTruth({
    amount: readiness.budgetAmount,
    fallbackAmount: 50,
    explicitBudgetConfirmed: body.explicitBudgetConfirmed,
  })

  const planningPayload = {
    campaign: {
      name: campaign.name,
      type: 'SEARCH',
      status: 'PAUSED',
      averageDailyBudget: readiness.budgetAmount,
      currency: campaign.currency,
      network: 'GOOGLE_SEARCH_ONLY',
      bidding: googleSearchBiddingMode(campaign.objective),
    },
    targeting: groupTargeting,
    adGroups: adSets.map(adSet => ({
      name: adSet.name,
      ads: (adSet.ads || []).map(ad => ({
        name: ad.name,
        finalUrl: normalizePaidDestinationUrl(ad.destinationUrl),
        responsiveSearchAd: extractGoogleResponsiveSearchAssets(ad, adSet.ads || []),
      })),
    })),
  }

  if (!adAccount || !adAccount.hasApiAccess) {
    return NextResponse.json({
      mode: 'dry_run',
      platform: 'GOOGLE',
      message: 'Google Ads execution access is not verified for this account. This is a reviewed planning payload, not a platform campaign.',
      executionReady: readiness.ready,
      blockers: readiness.blockers,
      targetingBlockers,
      budgetSource: budgetTruth.budgetSource,
      budgetConfirmed: budgetTruth.budgetConfirmed,
      payload: planningPayload,
      instructions: [
        'Connect an enabled non-manager Google Ads account through OAuth.',
        'Use a test account while GOOGLE_ADS_ACCESS_TIER=TEST.',
        'Review keywords, match types, negative keywords, locations, languages, and the daily budget.',
        'NEXUS creates Search objects in PAUSED state only; activation is a separate approval.',
      ],
    })
  }

  if (body.googleContainsEuPoliticalAdvertising !== 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING') {
    return NextResponse.json({
      error: 'Google requires an explicit EU political-advertising declaration before campaign creation. No Google request was sent.',
      mode: 'platform_draft_blocked',
      code: 'GOOGLE_EU_POLITICAL_DECLARATION_REQUIRED',
    }, { status: 400 })
  }

  if (!canCreatePlatformDraft({
    explicitPlatformDraftConfirmed: body.explicitPlatformDraftConfirmed,
    explicitBudgetConfirmed: body.explicitBudgetConfirmed,
    explicitExecutionReadinessConfirmed: body.explicitExecutionReadinessConfirmed,
    executionReady: readiness.ready,
  })) {
    return NextResponse.json({
      error: readiness.ready
        ? 'Creating a paused Google Search draft requires explicit confirmation. No Google request was sent.'
        : 'The Google Search execution brief is incomplete. No Google request was sent.',
      mode: 'platform_draft_blocked',
      blockers: readiness.blockers,
      targetingBlockers,
      budgetSource: budgetTruth.budgetSource,
      budgetConfirmed: budgetTruth.budgetConfirmed,
    }, { status: readiness.ready ? 400 : 409 })
  }

  if (!adAccount.refreshToken || !adAccount.platformAccountId) {
    return NextResponse.json({
      error: 'Google Ads refresh credentials or customer ID are missing. Reconnect the account; no Google request was sent.',
      mode: 'platform_draft_blocked',
    }, { status: 409 })
  }

  try {
    const budgetApproval = await approvePaidBudgetDecision({
      adCampaignId: String(campaign.id),
      userId,
    })
    const api = createGoogleAdsApi({
      customerId: String(adAccount.platformAccountId),
      loginCustomerId: typeof adAccount.loginCustomerId === 'string' ? adAccount.loginCustomerId : null,
      encryptedAccessToken: typeof adAccount.accessToken === 'string' ? adAccount.accessToken : null,
      encryptedRefreshToken: String(adAccount.refreshToken),
    })
    const primaryTargeting = groupTargeting[0]
    const resolvedLocations = await api.suggestGeoTargets(primaryTargeting.locations)
    const created = await api.createPausedSearchDraft({
      campaignName: String(campaign.name),
      objective: campaign.objective as 'TRAFFIC' | 'CONVERSIONS' | 'LEAD_GENERATION',
      budgetAmount: readiness.budgetAmount!,
      startDate: campaign.startDate as Date | string | null,
      endDate: campaign.endDate as Date | string | null,
      locationPresence: primaryTargeting.locationPresence!,
      euPoliticalAdvertisingDeclaration: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      locations: resolvedLocations,
      languageIds: primaryTargeting.languageIds,
      adGroups: adSets.map((adSet, index) => {
        const ads = adSet.ads || []
        return {
          localId: String(adSet.id),
          name: String(adSet.name),
          keywords: groupTargeting[index].keywords,
          negativeKeywords: groupTargeting[index].negativeKeywords,
          ads: ads.map(ad => ({
            localId: String(ad.id),
            name: String(ad.name),
            finalUrl: normalizePaidDestinationUrl(ad.destinationUrl)!,
            assets: extractGoogleResponsiveSearchAssets(ad, ads),
          })),
        }
      }),
    })

    await db.$transaction(async (tx: any) => {
      await tx.adCampaign.update({
        where: { id: String(campaign.id) },
        data: {
          platformCampaignId: created.campaignResourceName,
          platformStatus: 'PAUSED',
          status: mapPausedPlatformPushStatus(campaign.status),
          lastSyncError: null,
        },
      })
      for (const group of created.adGroups) {
        await tx.adSet.update({
          where: { id: group.localId },
          data: { platformAdSetId: group.resourceName, status: 'PAUSED' },
        })
        for (const ad of group.ads) {
          await tx.ad.update({
            where: { id: ad.localId },
            data: { platformAdId: ad.resourceName, status: 'PAUSED' },
          })
        }
      }
    })

    return NextResponse.json({
      mode: 'platform_paused_draft',
      platform: 'GOOGLE',
      success: true,
      results: created,
      resolvedLocations,
      budgetApproval,
      note: 'Google Search campaign, budget, targeting, keywords, ad groups, and responsive search ads were created atomically in PAUSED state. No delivery or spend was activated.',
    })
  } catch (error) {
    if (error instanceof PaidApprovalError) {
      return NextResponse.json({ error: error.code, code: error.code, mode: 'platform_draft_blocked' }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Google Ads API error'
    await db.adCampaign.update({
      where: { id: String(campaign.id) },
      data: { lastSyncError: message },
    }).catch(() => null)
    return NextResponse.json({ error: message, mode: 'platform_draft_failed' }, { status: 502 })
  }
}

// ── Meta push handler ──────────────────────────────────────────────────────
async function handleMetaPush(campaign: Record<string, unknown>, body: Record<string, unknown>, userId: string) {
  const adAccount = campaign.adAccount as Record<string, unknown> | null
  const adSets = (campaign.adSets || []) as Array<Record<string, unknown>>
  const allAds = adSets.flatMap(adSet => (adSet.ads as Array<Record<string, unknown>>) || [])
  const readiness = evaluatePaidExecutionReadiness({
    platform: campaign.platform,
    budgetType: campaign.budgetType,
    dailyBudget: campaign.dailyBudget,
    lifetimeBudget: campaign.lifetimeBudget,
    ads: allAds,
    pageId: adAccount?.pageId,
    requireMetaPage: adAccount?.hasApiAccess === true,
  })

  // ── Dry-run if no API access ─────────────────────────────────────────
  if (!adAccount || !adAccount.hasApiAccess) {
    const api = createMetaAdsApi('dry_run_token', 'act_0')

    const budgetTruth = getBudgetTruth({
      amount: readiness.budgetAmount,
      fallbackAmount: 50,
      explicitBudgetConfirmed: false,
    })
    const destinationUrl = allAds
      .map(ad => normalizePaidDestinationUrl(ad.destinationUrl))
      .find(Boolean) || undefined

    const payload = api.buildDryRunPayload({
      campaignName: String(campaign.name),
      objective: String(campaign.objective),
      dailyBudget: budgetTruth.amount,
      targeting: campaign.aiAudienceBrief
        ? nexusToMetaTargeting(campaign.aiAudienceBrief as Record<string, unknown>)
        : {},
      ads: allAds.map(ad => ({
        headline: String(ad.headline || ''),
        primaryText: String(ad.primaryText || ''),
        cta: String(ad.callToAction || 'LEARN_MORE'),
      })),
      destinationUrl,
      pageId: typeof adAccount?.pageId === 'string' ? adAccount.pageId : undefined,
    })

    return NextResponse.json({
      mode: 'dry_run',
      message: 'Meta API access is not approved. This is an importable planning payload, not a launched campaign.',
      budgetSource: budgetTruth.budgetSource,
      budgetConfirmed: budgetTruth.budgetConfirmed,
      budgetValuePresent: budgetTruth.budgetValuePresent,
      executionReady: readiness.ready,
      blockers: readiness.blockers,
      payload,
      instructions: [
        'Go to Meta Ads Manager (business.facebook.com)',
        'Create a draft campaign only after budget, tracking, creative, and platform readiness are confirmed',
        'For automated push: go to Settings → Connections and connect your Meta Ad Account',
        'Meta App Review is required for live API access (2-6 weeks)',
      ],
    })
  }

  // ── Paused platform draft creation ───────────────────────────────────
  try {
    const campaignBudgetTruth = getBudgetTruth({
      amount: readiness.budgetAmount,
      fallbackAmount: 50,
      explicitBudgetConfirmed: body.explicitBudgetConfirmed,
    })

    if (!canCreatePlatformDraft({
      explicitPlatformDraftConfirmed: body.explicitPlatformDraftConfirmed,
      explicitBudgetConfirmed: body.explicitBudgetConfirmed,
      explicitExecutionReadinessConfirmed: body.explicitExecutionReadinessConfirmed,
      executionReady: readiness.ready,
    })) {
      return NextResponse.json({
        error: readiness.ready
          ? 'Creating platform draft objects requires explicit confirmation. No ads were launched or changed.'
          : 'The paid execution brief is incomplete. No Meta request was sent.',
        mode: 'platform_draft_blocked',
        blockers: readiness.blockers,
        budgetSource: campaignBudgetTruth.budgetSource,
        budgetValuePresent: campaignBudgetTruth.budgetValuePresent,
        budgetConfirmed: campaignBudgetTruth.budgetConfirmed,
        explicitPlatformDraftConfirmed: body.explicitPlatformDraftConfirmed === true,
        explicitBudgetConfirmed: body.explicitBudgetConfirmed === true,
        explicitExecutionReadinessConfirmed: body.explicitExecutionReadinessConfirmed === true,
      }, { status: readiness.ready ? 400 : 409 })
    }

    if (!adAccount.accessToken || !adAccount.platformAccountId || !adAccount.pageId) {
      return NextResponse.json({
        error: 'Meta account credentials or the verified Facebook Page are missing. No Meta request was sent.',
        mode: 'platform_draft_blocked',
      }, { status: 409 })
    }

    const budgetApproval = await approvePaidBudgetDecision({
      adCampaignId: String(campaign.id),
      userId,
    })
    const api = createMetaAdsApi(
      String(adAccount.accessToken),
      String(adAccount.platformAccountId)
    )

    const results: {
      campaignId?: string
      adSetIds?: string[]
      adIds?: string[]
      errors?: string[]
    } = { adSetIds: [], adIds: [], errors: [] }

    // 1. Create Campaign
    const metaObjective = NEXUS_TO_META_OBJECTIVE[String(campaign.objective)] || 'OUTCOME_TRAFFIC'
    const metaCampaignId = await api.createCampaign({
      name: String(campaign.name),
      objective: metaObjective,
      status: 'PAUSED', // Always start paused; user enables in Meta
      special_ad_categories: [],
    })
    results.campaignId = metaCampaignId

    // Update DB with Meta campaign ID
    await db.adCampaign.update({
      where: { id: String(campaign.id) },
      data: {
        platformCampaignId: metaCampaignId,
        platformStatus: 'PAUSED',
        status: mapPausedPlatformPushStatus(campaign.status),
      },
    })

    await sleep(300) // Rate limit buffer

    // 2. Create Ad Sets
    const uploadedImageHashes = new Map<string, string>()
    for (const adSet of adSets) {
      try {
        const targeting = adSet.targeting
          ? nexusToMetaTargeting(adSet.targeting as Record<string, unknown>)
          : campaign.aiAudienceBrief
            ? nexusToMetaTargeting(campaign.aiAudienceBrief as Record<string, unknown>)
            : {}

        const metaAdSetId = await api.createAdSet({
          name: String(adSet.name),
          campaign_id: metaCampaignId,
          daily_budget: Number(adSet.dailyBudget || campaign.dailyBudget),
          billing_event: String(adSet.billingEvent || 'IMPRESSIONS'),
          optimization_goal: String(adSet.optimizationGoal || 'LINK_CLICKS'),
          bid_strategy: String(adSet.bidStrategy || 'LOWEST_COST_WITHOUT_CAP'),
          targeting,
          status: 'PAUSED',
        })

        results.adSetIds!.push(metaAdSetId)

        // Update DB
        await db.adSet.update({
          where: { id: String(adSet.id) },
          data: { platformAdSetId: metaAdSetId, status: 'PAUSED' },
        })

        await sleep(200)

        // 3. Create Ads within this set
        const ads = adSet.ads as Array<Record<string, unknown>>
        for (const ad of ads) {
          try {
            const destinationUrl = normalizePaidDestinationUrl(ad.destinationUrl)
            const imageUrl = String(ad.imageUrl || '')
            if (!destinationUrl || !imageUrl) {
              throw new Error('Execution preflight failed for destination or reviewed image.')
            }

            let imageHash = uploadedImageHashes.get(imageUrl)
            if (!imageHash) {
              imageHash = await api.uploadAdImageFromUrl(imageUrl)
              uploadedImageHashes.set(imageUrl, imageHash)
            }

            // Creative first
            const creativeId = await api.createAdCreative({
              name: `Creative — ${ad.headline}`,
              object_story_spec: {
                page_id: String(adAccount.pageId),
                link_data: {
                  message: String(ad.primaryText || ''),
                  link: destinationUrl,
                  caption: String(ad.description || ''),
                  description: String(ad.description || ''),
                  call_to_action: {
                    type: String(ad.callToAction || 'LEARN_MORE'),
                    value: { link: destinationUrl },
                  },
                  image_hash: imageHash,
                },
              },
            })

            await sleep(200)

            // Then the Ad
            const metaAdId = await api.createAd({
              name: String(ad.name),
              adset_id: metaAdSetId,
              creative: { creative_id: creativeId },
              status: 'PAUSED',
            })

            results.adIds!.push(metaAdId)

            await db.ad.update({
              where: { id: String(ad.id) },
              data: {
                platformAdId: metaAdId,
                platformCreativeId: creativeId,
                status: 'PAUSED',
              },
            })

            await sleep(200)
          } catch (adErr) {
            const msg = adErr instanceof Error ? adErr.message : String(adErr)
            results.errors!.push(`Ad "${ad.name}": ${msg}`)
          }
        }
      } catch (setErr) {
        const msg = setErr instanceof Error ? setErr.message : String(setErr)
        results.errors!.push(`Ad Set "${adSet.name}": ${msg}`)
      }
    }

    return NextResponse.json({
      mode: 'platform_paused_draft',
      success: results.errors!.length === 0,
      partial: results.errors!.length > 0,
      results,
      budgetApproval,
      note: results.errors!.length > 0
        ? 'Some ads had errors — check results.errors for details'
        : 'Platform draft objects were created in Meta in PAUSED state. Review in Meta before any launch or spend.',
    })
  } catch (err) {
    if (err instanceof PaidApprovalError) {
      return NextResponse.json({ error: err.code, code: err.code, mode: 'platform_draft_blocked' }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Meta API error'
    return NextResponse.json({ error: message, mode: 'live_failed' }, { status: 500 })
  }
}
