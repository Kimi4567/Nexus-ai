import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  buildCreativeIntelligencePayload,
  CREATIVE_INTELLIGENCE_BATCH_LIMIT,
  CREATIVE_INTELLIGENCE_VERSION,
  parseStoredCreativeMatch,
  rankCreativeMediaForPost,
  type CreativeMediaCandidate,
  type CreativePostCandidate,
  type StoredCreativeMatch,
} from '@/lib/creativeIntelligence'
import { analyzeCampaignMedia, getMediaEvidenceFrames } from '@/lib/ai/creativeIntelligence'
import {
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import {
  CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
  validateMediaIntelligenceConfirmation,
} from '@/lib/contentHubActionSafety'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'

type Params = { params: Promise<{ id: string }> }

interface LoadedCampaignContext {
  campaign: any
  posts: CreativePostCandidate[]
  media: CreativeMediaCandidate[]
  storedMatches: Record<string, StoredCreativeMatch | null>
}

function asPostCandidate(post: any): CreativePostCandidate {
  return {
    id: post.id,
    caption: post.caption,
    imagePrompt: post.imagePrompt,
    videoPrompt: post.videoPrompt,
    platform: post.publishTarget || post.platform,
    isVideoPost: Boolean(post.isVideoPost),
    contentPlanIndex: post.contentPlanIndex,
  }
}

function asMediaCandidate(media: any): CreativeMediaCandidate {
  return {
    id: media.id,
    url: media.url,
    fileName: media.fileName,
    type: media.type,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    duration: media.duration,
    category: media.category,
    tags: media.tags,
    intelligenceStatus: media.intelligenceStatus,
    intelligence: media.intelligence,
  }
}

async function loadCampaignContext(campaignId: string, userId: string): Promise<LoadedCampaignContext | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspace: { ownerId: userId } },
    select: {
      id: true,
      name: true,
      goal: true,
      audience: true,
      tone: true,
      platforms: true,
      aiOutput: true,
      strategy: true,
      workspaceId: true,
      workspace: {
        select: {
          brandProfile: {
            select: {
              brandName: true,
              industry: true,
              description: true,
              primaryOffer: true,
              uniqueAdvantages: true,
              visualStyle: true,
              colorPalette: true,
              complianceNotes: true,
              verifiedProof: true,
            },
          },
        },
      },
    },
  })
  if (!campaign) return null

  const [posts, media] = await Promise.all([
    (prisma.socialPost as any).findMany({
      where: { campaignId, workspaceId: campaign.workspaceId },
      orderBy: [{ contentPlanIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        caption: true,
        imagePrompt: true,
        videoPrompt: true,
        platform: true,
        publishTarget: true,
        isVideoPost: true,
        contentPlanIndex: true,
        creativeMatch: true,
      },
    }),
    (prisma.media as any).findMany({
      where: {
        workspaceId: campaign.workspaceId,
        OR: [{ campaignId: null }, { campaignId }],
        type: { in: ['IMAGE', 'VIDEO', 'LOGO'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        url: true,
        fileName: true,
        type: true,
        mimeType: true,
        width: true,
        height: true,
        duration: true,
        category: true,
        tags: true,
        intelligenceStatus: true,
        intelligence: true,
      },
    }),
  ])

  return {
    campaign,
    posts: posts.map(asPostCandidate),
    media: media.map(asMediaCandidate),
    storedMatches: Object.fromEntries(posts.map((post: any) => [post.id, parseStoredCreativeMatch(post.creativeMatch)])),
  }
}

function responsePayload(context: LoadedCampaignContext) {
  const payload = buildCreativeIntelligencePayload({
    posts: context.posts,
    media: context.media,
    storedMatches: context.storedMatches,
  })
  const analyzablePending = context.media.filter(media => (
    media.intelligenceStatus !== 'READY' && getMediaEvidenceFrames(media).length > 0
  ))
  payload.summary.batchSize = Math.min(CREATIVE_INTELLIGENCE_BATCH_LIMIT, analyzablePending.length)
  return payload
}

export async function GET(req: NextRequest, props: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await props.params
  const context = await loadCampaignContext(id, userId)
  if (!context) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  return NextResponse.json(responsePayload(context))
}

export async function POST(req: NextRequest, props: Params) {
  let chargedCredit: CreditDeductionOk | null = null
  let chargedUserId: string | null = null
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await props.params

  try {
    const context = await loadCampaignContext(id, userId)
    if (!context) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const analyzablePending = context.media
      .filter(media => media.intelligenceStatus !== 'READY' && getMediaEvidenceFrames(media).length > 0)
      .slice(0, CREATIVE_INTELLIGENCE_BATCH_LIMIT)
    const previewUnavailable = context.media
      .filter(media => media.intelligenceStatus !== 'READY' && getMediaEvidenceFrames(media).length === 0)
      .map(media => media.id)

    if (analyzablePending.length === 0) {
      return NextResponse.json({
        error: context.media.length === 0
          ? 'Upload campaign images or videos before running Creative Intelligence.'
          : 'All previewable campaign media is already analyzed.',
        code: context.media.length === 0 ? 'MEDIA_REQUIRED' : 'MEDIA_INTELLIGENCE_UP_TO_DATE',
        payload: responsePayload(context),
      }, { status: 409 })
    }

    const confirmation = validateMediaIntelligenceConfirmation({
      confirmed: body.explicitAnalysisConfirmed,
      acknowledgedCreditCost: body.acknowledgedCreditCost,
      acknowledgedAssetCount: body.acknowledgedAssetCount,
      expectedAssetCount: analyzablePending.length,
      acknowledgedNoAutomaticChanges: body.acknowledgedNoAutomaticChanges,
    })
    if (!confirmation.ok) {
      return NextResponse.json({
        error: confirmation.error,
        code: 'MEDIA_INTELLIGENCE_CONFIRMATION_REQUIRED',
        expected: {
          assetCount: analyzablePending.length,
          creditCost: CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
        },
      }, { status: 400 })
    }
    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(body.locale), { status: 503 })
    }

    const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'MEDIA_INTELLIGENCE_ANALYSIS')
    if (rateLimitResponse) return rateLimitResponse
    const credit = await checkAndDeductCredits(userId, 'MEDIA_INTELLIGENCE_ANALYSIS', undefined, {
      entityId: id,
      entityType: 'campaign_media_intelligence',
      operationKey: getCreditOperationKey(req, 'MEDIA_INTELLIGENCE_ANALYSIS', 'campaign_media_intelligence', id),
      description: `NEXUS Creative Intelligence — ${analyzablePending.length} campaign assets`,
    })
    if (!credit.ok) return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
    chargedCredit = credit
    chargedUserId = userId

    const brandProfile = context.campaign.workspace.brandProfile
    const analysis = await analyzeCampaignMedia({
      media: analyzablePending,
      posts: context.posts,
      locale: body.locale === 'ar' ? 'ar' : 'en',
      brandContext: {
        campaignName: context.campaign.name,
        goal: context.campaign.goal,
        audience: context.campaign.audience,
        tone: context.campaign.tone,
        platforms: context.campaign.platforms,
        ...(brandProfile ?? {}),
      },
    })

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'MEDIA_INTELLIGENCE_ANALYSIS',
      deduction: credit,
      providerEconomics: {
        providerCostUsd: analysis.usage.estimatedProviderCostUsd,
        providerPricingVersion: analysis.usage.pricingVersion,
        providerUsage: analysis.usage,
      },
    })
    if (!finalization.ok) {
      chargedCredit = null
      return NextResponse.json({
        error: 'Creative Intelligence could not finalize the credit charge. Reserved credits were returned.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }

    const mergedMedia = context.media.map(media => analysis.analysesByMediaId[media.id]
      ? { ...media, intelligenceStatus: 'READY', intelligence: analysis.analysesByMediaId[media.id] }
      : media)
    const generatedAt = new Date().toISOString()
    const matchesByPostId = Object.fromEntries(context.posts.map(post => [
      post.id,
      rankCreativeMediaForPost(post, mergedMedia, analysis.providerMatches),
    ]))

    await prisma.$transaction(async tx => {
      for (const [mediaId, intelligence] of Object.entries(analysis.analysesByMediaId)) {
        await (tx.media as any).update({
          where: { id: mediaId },
          data: {
            intelligenceStatus: 'READY',
            intelligence,
            intelligenceVersion: CREATIVE_INTELLIGENCE_VERSION,
            intelligenceAnalyzedAt: new Date(),
          },
        })
      }
      if (previewUnavailable.length > 0) {
        await (tx.media as any).updateMany({
          where: { id: { in: previewUnavailable }, workspaceId: context.campaign.workspaceId },
          data: { intelligenceStatus: 'NEEDS_PREVIEW' },
        })
      }
      for (const post of context.posts) {
        const stored: StoredCreativeMatch = {
          version: CREATIVE_INTELLIGENCE_VERSION,
          generatedAt,
          topMatches: matchesByPostId[post.id] ?? [],
        }
        await (tx.socialPost as any).update({
          where: { id: post.id },
          data: { creativeMatch: stored, creativeMatchedAt: new Date() },
        })
      }
    })
    chargedCredit = null

    const refreshed = await loadCampaignContext(id, userId)
    if (!refreshed) throw new Error('Campaign disappeared after media analysis')
    return NextResponse.json({
      payload: responsePayload(refreshed),
      analyzedAssets: Object.keys(analysis.analysesByMediaId).length,
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: { ...getCreditActionPolicy('MEDIA_INTELLIGENCE_ANALYSIS'), creditsUsed: credit.creditsUsed },
      limitations: {
        rightsConfirmed: false,
        audioTranscribed: false,
        automaticAttachment: false,
        automaticPublishing: false,
      },
    })
  } catch (error) {
    console.error('[creative-intelligence POST]', error)
    const refund = chargedUserId
      ? await refundCreditDeduction({
          userId: chargedUserId,
          action: 'MEDIA_INTELLIGENCE_ANALYSIS',
          deduction: chargedCredit,
          reason: 'Creative media intelligence failed before a usable persisted result',
        })
      : { status: 'noop' as const }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Creative Intelligence failed',
      refunded: refund.status === 'refunded' || refund.status === 'noop',
      refundPending: refund.status === 'failed',
    }, { status: 500 })
  }
}
