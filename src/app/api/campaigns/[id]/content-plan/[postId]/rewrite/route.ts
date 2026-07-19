/**
 * POST /api/campaigns/[id]/content-plan/[postId]/rewrite
 *
 * AI-rewrites a content plan post caption using:
 * - Brand voice + tone keywords from BrandProfile
 * - Reviewed hook signals from brand memory
 * - Platform-native style constraints
 * - Optional user instruction (e.g. "make it more casual" / "add urgency")
 *
 * Body: { instruction?: string }
 * Returns: { post: { id, caption, imagePrompt } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { validateRewriteConfirmation } from '@/lib/contentHubActionSafety'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { guardContentDraftText } from '@/lib/ai/contentDraftTruthGuard'
import { buildContentPlanTruthContext, reviewContentPostForPublishing } from '@/lib/contentPlanApprovalGuard'
import {
  CONTENT_REVISION_HISTORY_NOTE,
  contentReviewResetData,
  isImmutableExecutionPost,
  reopensContentReview,
} from '@/lib/contentPostRevision'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'

type Params = { params: Promise<{ id: string; postId: string }> }

// Platform character limits
const PLATFORM_LIMITS: Record<string, number> = {
  META:      2200,
  INSTAGRAM: 2200,
  FACEBOOK:  500,
  LINKEDIN:  1300,
  TIKTOK:    150,
  YOUTUBE:   500,
}

// Platform style guidance
const PLATFORM_STYLE: Record<string, string> = {
  META:      'Instagram-native: punchy hook, emojis, line breaks, relevant hashtags',
  INSTAGRAM: 'Instagram-native: punchy hook, emojis, line breaks, relevant hashtags',
  FACEBOOK:  'Facebook: conversational, slightly longer, community-focused, minimal hashtags',
  LINKEDIN:  'LinkedIn: professional, insight-led, no fluff, 1-3 strategic hashtags',
  TIKTOK:    'TikTok: ultra-short, trend-aware, energetic, 1-2 hashtags max',
  YOUTUBE:   'YouTube: keyword-rich description, call to action, timestamps optional',
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Hoisted so the catch can refund a charged-but-failed rewrite.
  let chargedCredit: CreditDeductionOk | null = null
  try {
    const { instruction, explicitRewriteConfirmed, acknowledgedCreditCost, language } = await req.json().catch(() => ({
      instruction: '',
      explicitRewriteConfirmed: false,
      acknowledgedCreditCost: undefined,
      language: undefined,
    }))

    // ── 1. Verify post ownership ───────────────────────────────────────────
    const post = await (prisma.socialPost as any).findFirst({
      where: {
        id: params.postId,
        campaignId: params.id,
        workspace: { ownerId: userId },
      },
      select: {
        id: true,
        caption: true,
        imagePrompt: true,
        platform: true,
        status: true,
        workspaceId: true,
        campaign: {
          select: {
            name: true,
            tone: true,
            audience: true,
            aiOutput: true,
          },
        },
      },
    })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (isImmutableExecutionPost(post.status)) {
      return NextResponse.json({
        error: 'Published or provider-processing posts are immutable. Create a new draft for a revision.',
        code: 'PUBLISHED_POST_IMMUTABLE',
      }, { status: 409 })
    }

    const confirmation = validateRewriteConfirmation({
      confirmed: explicitRewriteConfirmed,
      acknowledgedCreditCost,
    })
    if (!confirmation.ok) {
      return NextResponse.json({ error: confirmation.error, code: 'CONFIRMATION_REQUIRED' }, { status: 400 })
    }

    if (!isAiProviderConfigured()) {
      const outputLanguage = language || (post.campaign as any)?.aiOutput?.language
      return NextResponse.json(getAiProviderUnavailablePayload(outputLanguage), { status: 503 })
    }

    const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'AI_POST_REWRITE')
    if (rateLimitResponse) return rateLimitResponse

    // ── 2. Deduct 1 credit ─────────────────────────────────────────────────
    const creditCheck = await checkAndDeductCredits(
      userId,
      'AI_POST_REWRITE',
      undefined,
      {
        entityId: params.postId,
        entityType: 'social_post_rewrite',
        operationKey: getCreditOperationKey(req, 'AI_POST_REWRITE', 'social_post_rewrite', params.postId),
      },
    ) // 1 credit
    if (!creditCheck.ok) {
      return NextResponse.json(
        { error: creditCheck.error ?? 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
        { status: creditCheckHttpStatus(creditCheck) },
      )
    }
    chargedCredit = creditCheck

    // ── 3. Load brand profile ──────────────────────────────────────────────
    const brand = await prisma.brandProfile.findUnique({
      where: { workspaceId: post.workspaceId },
      select: {
        brandName: true,
        toneKeywords: true,
        avoidKeywords: true,
        writingStyle: true,
        targetAudience: true,
        winningHooks: true,
        uniqueAdvantages: true,
        primaryOffer: true,
        verifiedProof: true,
        description: true,
        complianceNotes: true,
        conversionDestination: true,
      },
    })

    // ── 4. Build context ───────────────────────────────────────────────────
    const platform    = String(post.platform).toUpperCase()
    const charLimit   = PLATFORM_LIMITS[platform] ?? 2200
    const styleGuide  = PLATFORM_STYLE[platform] ?? 'Platform-native social media post'

    const campaign = post.campaign as any
    const aiOutput = campaign?.aiOutput as any

    const brandName    = brand?.brandName ?? campaign?.name ?? 'Brand'
    const toneWords    = brand?.toneKeywords?.join(', ') || campaign?.tone || 'professional'
    const avoidWords   = brand?.avoidKeywords?.join(', ') || 'none'
    const writingStyle = brand?.writingStyle || ''
    const audience     = brand?.targetAudience || campaign?.audience || ''
    const reviewedHookSignals = brand?.winningHooks?.slice(0, 3).join(' | ') || ''
    const keyMessage   = aiOutput?.strategy?.keyMessage ?? aiOutput?.keyMessage ?? ''
    const primaryOffer = brand?.primaryOffer ?? aiOutput?.strategy?.primaryOffer ?? ''

    const systemPrompt = `You are an expert social media copywriter for ${brandName}.

Brand voice: ${toneWords}
Avoid: ${avoidWords}${writingStyle ? `\nWriting style: ${writingStyle}` : ''}${audience ? `\nTarget audience: ${audience}` : ''}${reviewedHookSignals ? `\nReviewed hook signals to consider: ${reviewedHookSignals}` : ''}${keyMessage ? `\nKey campaign message: ${keyMessage}` : ''}${primaryOffer ? `\nPrimary offer/CTA: ${primaryOffer}` : ''}

Platform: ${platform}
Style requirement: ${styleGuide}
Character limit: ${charLimit} characters

Rewrite rules:
- Preserve the core message and CTA intent of the original post
- Apply the brand voice and tone faithfully
- Stay within the character limit
- Keep relevant hashtags (update or replace if needed)
- The hook (first line) must name the audience situation, task, tension, or objection
- Never start with Did you know / هل تعلم / Imagine if / What if, and never claim that analytics, numbers, or smart marketing transform a business
- Do not invent customer proof, performance, guarantees, awards, results, or platform status
- Return ONLY the new caption text — no explanations, no formatting markers`

    const userMsg = `Original caption:
${post.caption}${instruction ? `\n\nRewrite instruction: ${instruction}` : '\n\nRewrite this caption with stronger brand voice and a better hook, keeping the same intent and CTA.'}`

    // ── 5. Call GPT-4o-mini ────────────────────────────────────────────────
    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // Post rewrite — user-facing output, needs full quality
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.85,
        max_tokens: 600,
      }),
    })

    if (!chatRes.ok) {
      const errText = await chatRes.text()
      console.error('[rewrite] OpenAI error:', errText)
      throw new Error(`OpenAI rewrite failed (${chatRes.status})`)
    }

    const chatData = await chatRes.json()
    const newCaption = chatData.choices?.[0]?.message?.content?.trim()

    if (!newCaption) {
      throw new Error('OpenAI returned an empty rewrite')
    }

    // Enforce character limit (graceful truncation at word boundary)
    const truncated = newCaption.length > charLimit
      ? newCaption.slice(0, charLimit).replace(/\s+\S*$/, '…')
      : newCaption
    const guardedCaption = guardContentDraftText(truncated, {
      verifiedProof: brand?.verifiedProof,
      hasConversionDestination: Boolean(brand?.conversionDestination),
      brandFacts: [
        brand?.brandName,
        brand?.description,
        brand?.primaryOffer,
        brand?.uniqueAdvantages,
        brand?.complianceNotes,
      ],
    })
    const publishReview = reviewContentPostForPublishing(
      { caption: guardedCaption },
      1,
      buildContentPlanTruthContext(brand),
    )
    if (publishReview.length > 0) {
      await refundCreditDeduction({
        userId,
        action: 'AI_POST_REWRITE',
        deduction: chargedCredit,
        reason: 'Generated rewrite failed the saved-content quality gate',
      })
      chargedCredit = null
      return NextResponse.json({
        error: 'The rewrite did not pass the saved-content quality gate. No revised copy was saved.',
        code: 'CONTENT_REVIEW_REQUIRED',
        issues: publishReview,
        refunded: true,
      }, { status: 422 })
    }

    // ── 6. Persist updated caption ─────────────────────────────────────────
    const reopensReview = reopensContentReview(post.status)
    const updated = await prisma.$transaction(async (tx) => {
      const next = await (tx.socialPost as any).update({
        where: { id: params.postId },
        data: { caption: guardedCaption, ...contentReviewResetData(post.status) },
        select: { id: true, caption: true, imagePrompt: true, status: true, approvedAt: true, publishMode: true },
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

    const finalization = await finalizeCreditDeduction({
      userId,
      action: 'AI_POST_REWRITE',
      deduction: creditCheck,
    })
    if (!finalization.ok) {
      chargedCredit = null
      return NextResponse.json({
        error: 'Rewritten post was saved but the credit operation could not be finalized. Reserved credits were returned; refresh the post.',
        code: 'CREDIT_FINALIZATION_FAILED',
        refunded: finalization.refundStatus === 'refunded',
      }, { status: 503 })
    }
    chargedCredit = null

    return NextResponse.json({
      post: updated,
      creditsUsed: creditCheck.creditsUsed,
      creditsRemaining: creditCheck.creditsRemaining,
      creditCharge: buildCreditChargeReceipt('AI_POST_REWRITE', creditCheck),
    })
  } catch (err: any) {
    console.error('[content-plan/rewrite POST]', err)
    const refunded = Boolean(chargedCredit?.creditsUsed)
    await refundCreditDeduction({
      userId,
      action: 'AI_POST_REWRITE',
      deduction: chargedCredit,
      reason: 'Post rewrite failed',
    })
    return NextResponse.json({ error: 'Failed to rewrite post', refunded }, { status: 500 })
  }
}
