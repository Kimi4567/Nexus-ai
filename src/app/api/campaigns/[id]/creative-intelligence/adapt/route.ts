import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { adaptPostCopyToMedia } from '@/lib/ai/creativeIntelligence'
import {
  CREATIVE_INTELLIGENCE_VERSION,
  deriveCreativeMatch,
  getCreativeCompatibility,
  readMediaIntelligence,
  type CreativeMediaCandidate,
  type CreativePostCandidate,
  type StoredCreativeMatch,
} from '@/lib/creativeIntelligence'
import {
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import {
  CONTENT_HUB_REWRITE_COST,
  validateCreativeAdaptationConfirmation,
} from '@/lib/contentHubActionSafety'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import {
  CONTENT_REVISION_HISTORY_NOTE,
  contentReviewResetData,
  isImmutableExecutionPost,
  reopensContentReview,
} from '@/lib/contentPostRevision'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, props: Params) {
  let chargedCredit: CreditDeductionOk | null = null
  let chargedUserId: string | null = null
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: campaignId } = await props.params

  try {
    const body = await req.json().catch(() => ({}))
    const postId = typeof body.postId === 'string' ? body.postId.trim() : ''
    const mediaId = typeof body.mediaId === 'string' ? body.mediaId.trim() : ''
    if (!postId || !mediaId) {
      return NextResponse.json({ error: 'A post and media asset are required.' }, { status: 400 })
    }

    const confirmation = validateCreativeAdaptationConfirmation({
      confirmed: body.explicitAdaptationConfirmed,
      acknowledgedCreditCost: body.acknowledgedCreditCost,
      acknowledgedReopensReview: body.acknowledgedReopensReview,
      acknowledgedNoPublishOrSchedule: body.acknowledgedNoPublishOrSchedule,
    })
    if (!confirmation.ok) {
      return NextResponse.json({ error: confirmation.error, code: 'CREATIVE_ADAPTATION_CONFIRMATION_REQUIRED' }, { status: 400 })
    }

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
                toneKeywords: true,
                writingStyle: true,
                avoidKeywords: true,
                complianceNotes: true,
                verifiedProof: true,
              },
            },
          },
        },
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const [post, media] = await Promise.all([
      (prisma.socialPost as any).findFirst({
        where: { id: postId, campaignId, workspaceId: campaign.workspaceId },
      }),
      (prisma.media as any).findFirst({
        where: {
          id: mediaId,
          workspaceId: campaign.workspaceId,
          OR: [{ campaignId: null }, { campaignId }],
        },
      }),
    ])
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    if (isImmutableExecutionPost(post.status)) {
      return NextResponse.json({
        error: 'Published or provider-processing posts are immutable. Create a new draft for this adaptation.',
        code: 'PUBLISHED_POST_IMMUTABLE',
      }, { status: 409 })
    }

    const postCandidate: CreativePostCandidate = {
      id: post.id,
      caption: post.caption,
      imagePrompt: post.imagePrompt,
      videoPrompt: post.videoPrompt,
      platform: post.publishTarget || post.platform,
      isVideoPost: Boolean(post.isVideoPost),
      contentPlanIndex: post.contentPlanIndex,
    }
    const mediaCandidate: CreativeMediaCandidate = {
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
    if (getCreativeCompatibility(postCandidate, mediaCandidate) !== 'DIRECT') {
      return NextResponse.json({
        error: post.isVideoPost
          ? 'Adapting copy for this slot requires a real video. An image can be used only as a video-generation reference.'
          : 'Adapting copy for this slot requires an image asset.',
        code: 'DIRECT_MEDIA_REQUIRED',
      }, { status: 409 })
    }
    const intelligence = readMediaIntelligence(media.intelligence)
    if (media.intelligenceStatus !== 'READY' || !intelligence) {
      return NextResponse.json({
        error: 'Analyze this media before adapting campaign copy to it.',
        code: 'MEDIA_INTELLIGENCE_REQUIRED',
      }, { status: 409 })
    }
    if (!isAiProviderConfigured()) {
      return NextResponse.json(getAiProviderUnavailablePayload(body.locale), { status: 503 })
    }

    const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'AI_POST_REWRITE')
    if (rateLimitResponse) return rateLimitResponse
    const credit = await checkAndDeductCredits(userId, 'AI_POST_REWRITE', undefined, {
      entityId: post.id,
      entityType: 'creative_copy_adaptation',
      operationKey: getCreditOperationKey(req, 'AI_POST_REWRITE', 'creative_copy_adaptation', post.id),
      description: `NEXUS copy-to-media adaptation — post ${post.contentPlanIndex || post.id}`,
    })
    if (!credit.ok) return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
    chargedCredit = credit
    chargedUserId = userId

    const adapted = await adaptPostCopyToMedia({
      post: postCandidate,
      media: mediaCandidate,
      analysis: intelligence,
      brandContext: {
        campaignName: campaign.name,
        goal: campaign.goal,
        audience: campaign.audience,
        tone: campaign.tone,
        platforms: campaign.platforms,
        ...(campaign.workspace.brandProfile ?? {}),
      },
      strategyContext: campaign.aiOutput || campaign.strategy || {},
    })

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'AI_POST_REWRITE',
      deduction: credit,
      providerEconomics: {
        providerCostUsd: adapted.usage.estimatedProviderCostUsd,
        providerPricingVersion: adapted.usage.pricingVersion,
        providerUsage: adapted.usage,
      },
    })
    if (!finalization.ok) {
      chargedCredit = null
      return NextResponse.json({
        error: 'Copy adaptation could not finalize the credit charge. Reserved credits were returned.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }

    const selectedMatch = deriveCreativeMatch({
      ...postCandidate,
      caption: adapted.caption,
    }, mediaCandidate)
    const storedMatch: StoredCreativeMatch & { selection: Record<string, unknown> } = {
      version: CREATIVE_INTELLIGENCE_VERSION,
      generatedAt: new Date().toISOString(),
      topMatches: [{
        ...selectedMatch,
        recommendedDecision: selectedMatch.verdict === 'WEAK' ? 'CREATE_NEW' : 'USE_EXISTING',
        reasons: [
          'The final caption was adapted to this asset’s observed evidence.',
          ...selectedMatch.reasons,
        ].slice(0, 3),
      }],
      selection: {
        mediaId: media.id,
        decision: 'ADAPT_COPY',
        approved: false,
        changeSummary: adapted.changeSummary,
        unsupportedClaimsRemoved: adapted.unsupportedClaimsRemoved,
      },
    }
    const reopensReview = reopensContentReview(post.status)
    const updated = await prisma.$transaction(async tx => {
      const next = await (tx.socialPost as any).update({
        where: { id: post.id },
        data: {
          caption: adapted.caption,
          imageUrl: media.url,
          uploadedMediaId: media.id,
          sourceType: 'USER_ASSET',
          sourceMediaId: media.id,
          mediaSource: 'UPLOAD',
          generationStatus: 'DONE',
          creativeMatch: storedMatch,
          creativeMatchedAt: new Date(),
          ...contentReviewResetData(post.status),
        },
        select: {
          id: true,
          caption: true,
          imageUrl: true,
          uploadedMediaId: true,
          mediaSource: true,
          generationStatus: true,
          status: true,
          approvedAt: true,
          approvedSnapshotId: true,
          mediaApprovalSnapshotId: true,
        },
      })
      if (reopensReview) {
        await tx.postStatusHistory.create({
          data: {
            socialPostId: post.id,
            workspaceId: post.workspaceId,
            fromStatus: post.status,
            toStatus: 'DRAFT',
            actor: 'USER',
            note: CONTENT_REVISION_HISTORY_NOTE,
          },
        })
      }
      return next
    })
    chargedCredit = null
    return NextResponse.json({
      post: updated,
      changeSummary: adapted.changeSummary,
      unsupportedClaimsRemoved: adapted.unsupportedClaimsRemoved,
      creditsUsed: credit.creditsUsed,
      creditsRemaining: credit.creditsRemaining,
      creditCharge: { ...getCreditActionPolicy('AI_POST_REWRITE'), creditsUsed: credit.creditsUsed },
      published: false,
      scheduled: false,
      approvalRequired: true,
    })
  } catch (error) {
    console.error('[creative-intelligence/adapt POST]', error)
    const refund = chargedUserId
      ? await refundCreditDeduction({
          userId: chargedUserId,
          action: 'AI_POST_REWRITE',
          deduction: chargedCredit,
          reason: 'Copy-to-media adaptation failed before a usable persisted draft',
        })
      : { status: 'noop' as const }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Copy adaptation failed',
      refunded: refund.status === 'refunded' || refund.status === 'noop',
      refundPending: refund.status === 'failed',
    }, { status: 500 })
  }
}
