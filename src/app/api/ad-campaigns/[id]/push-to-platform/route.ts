/**
 * POST /api/ad-campaigns/[id]/push-to-platform
 *
 * Exports or live-pushes a campaign to the connected ad platform.
 *
 * Behavior:
 *   - hasApiAccess = true  → Live push via Meta Marketing API
 *   - hasApiAccess = false → Dry-run: returns JSON payload for manual import
 *
 * Meta flow:
 *   1. Create campaign (returns platformCampaignId)
 *   2. Create ad set (returns platformAdSetId)
 *   3. Create ad creative per Ad record
 *   4. Create ad (binds ad set + creative)
 *   5. Update campaign.platformCampaignId, adSet.platformAdSetId, ad.platformAdId
 *
 * After a successful push, campaign status → ACTIVE (live) or remains DRAFT (dry-run)
 *
 * Rate limiting: Meta allows 200 calls/hour. For campaigns with many ads,
 * we batch creations and add 200ms delays between calls.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { createMetaAdsApi, nexusToMetaTargeting, NEXUS_TO_META_OBJECTIVE } from '@/lib/adPlatforms/metaAdsApi'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // ── Route to platform handler ──────────────────────────────────────
    if (campaign.platform === 'META') {
      return handleMetaPush(campaign)
    }

    // Other platforms: dry-run export only
    return NextResponse.json({
      mode: 'dry_run',
      platform: campaign.platform,
      message: `${campaign.platform} live push coming soon. JSON payload exported below.`,
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
    console.error('[push-to-platform]', err)
    const message = err instanceof Error ? err.message : 'Push failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── Meta push handler ──────────────────────────────────────────────────────
async function handleMetaPush(campaign: Record<string, unknown>) {
  const adAccount = campaign.adAccount as Record<string, unknown> | null

  // ── Dry-run if no API access ─────────────────────────────────────────
  if (!adAccount || !adAccount.hasApiAccess) {
    const api = createMetaAdsApi('dry_run_token', 'act_0')
    const adSets = campaign.adSets as Array<Record<string, unknown>>
    const allAds = adSets.flatMap(s => (s.ads as Array<Record<string, unknown>>) || [])

    const payload = api.buildDryRunPayload({
      campaignName: String(campaign.name),
      objective: String(campaign.objective),
      dailyBudget: Number(campaign.dailyBudget || 50),
      targeting: campaign.aiAudienceBrief
        ? nexusToMetaTargeting(campaign.aiAudienceBrief as Record<string, unknown>)
        : {},
      ads: allAds.map(ad => ({
        headline: String(ad.headline || ''),
        primaryText: String(ad.primaryText || ''),
        cta: String(ad.callToAction || 'LEARN_MORE'),
      })),
      destinationUrl: String(campaign.utmCampaign || ''),
    })

    return NextResponse.json({
      mode: 'dry_run',
      message: 'Meta API access pending approval. Here is your importable campaign payload.',
      payload,
      instructions: [
        'Go to Meta Ads Manager (business.facebook.com)',
        'Create Campaign → use values from this JSON',
        'For automated push: go to Settings → Connections and connect your Meta Ad Account',
        'Meta App Review is required for live API access (2-6 weeks)',
      ],
    })
  }

  // ── Live push ────────────────────────────────────────────────────────
  try {
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
        status: 'ACTIVE',
      },
    })

    await sleep(300) // Rate limit buffer

    // 2. Create Ad Sets
    const adSets = campaign.adSets as Array<Record<string, unknown>>
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
          daily_budget: Number(adSet.dailyBudget || campaign.dailyBudget || 50),
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
          data: { platformAdSetId: metaAdSetId, platformStatus: 'PAUSED' },
        })

        await sleep(200)

        // 3. Create Ads within this set
        const ads = adSet.ads as Array<Record<string, unknown>>
        for (const ad of ads) {
          try {
            // Creative first
            const creativeId = await api.createAdCreative({
              name: `Creative — ${ad.headline}`,
              object_story_spec: {
                page_id: String(adAccount.pageId || '[[PAGE_ID_REQUIRED]]'),
                link_data: {
                  message: String(ad.primaryText || ''),
                  link: String(campaign.utmCampaign || 'https://example.com'),
                  caption: String(ad.description || ''),
                  description: String(ad.description || ''),
                  call_to_action: {
                    type: String(ad.callToAction || 'LEARN_MORE'),
                    value: { link: String(campaign.utmCampaign || 'https://example.com') },
                  },
                  ...(ad.imageUrl ? { image_hash: String(ad.imageUrl) } : {}),
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
              data: { platformAdId: metaAdId, platformStatus: 'PAUSED' },
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
      mode: 'live',
      success: true,
      results,
      note: results.errors!.length > 0
        ? 'Some ads had errors — check results.errors for details'
        : 'All campaign elements created successfully in Meta. Campaign starts in PAUSED state.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Meta API error'
    return NextResponse.json({ error: message, mode: 'live_failed' }, { status: 500 })
  }
}
