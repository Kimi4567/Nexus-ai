/**
 * POST /api/campaigns/[id]/content-plan/[postId]/rewrite
 *
 * AI-rewrites a content plan post caption using:
 * - Brand voice + tone keywords from BrandProfile
 * - Winning hooks from brand memory
 * - Platform-native style constraints
 * - Optional user instruction (e.g. "make it more casual" / "add urgency")
 *
 * Body: { instruction?: string }
 * Returns: { post: { id, caption, imagePrompt } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'

type Params = { params: { id: string; postId: string } }

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

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Hoisted so the catch can refund a charged-but-failed rewrite.
  let rewriteCharged = false
  try {
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

    // ── 2. Deduct 1 credit ─────────────────────────────────────────────────
    const creditCheck = await checkAndDeductCredits(userId, 'AI_POST_REWRITE') // 1 credit
    if (!creditCheck.ok) {
      return NextResponse.json(
        { error: creditCheck.error ?? 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      )
    }
    rewriteCharged = creditCheck.creditsUsed > 0

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
      },
    })

    // ── 4. Build context ───────────────────────────────────────────────────
    const { instruction } = await req.json().catch(() => ({ instruction: '' }))

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
    const winningHooks = brand?.winningHooks?.slice(0, 3).join(' | ') || ''
    const keyMessage   = aiOutput?.strategy?.keyMessage ?? aiOutput?.keyMessage ?? ''
    const primaryOffer = brand?.primaryOffer ?? aiOutput?.strategy?.primaryOffer ?? ''

    const systemPrompt = `You are an expert social media copywriter for ${brandName}.

Brand voice: ${toneWords}
Avoid: ${avoidWords}${writingStyle ? `\nWriting style: ${writingStyle}` : ''}${audience ? `\nTarget audience: ${audience}` : ''}${winningHooks ? `\nProven hook formulas to draw from: ${winningHooks}` : ''}${keyMessage ? `\nKey campaign message: ${keyMessage}` : ''}${primaryOffer ? `\nPrimary offer/CTA: ${primaryOffer}` : ''}

Platform: ${platform}
Style requirement: ${styleGuide}
Character limit: ${charLimit} characters

Rewrite rules:
- Preserve the core message and CTA intent of the original post
- Apply the brand voice and tone faithfully
- Stay within the character limit
- Keep relevant hashtags (update or replace if needed)
- The hook (first line) must grab attention immediately
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
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
    }

    const chatData = await chatRes.json()
    const newCaption = chatData.choices?.[0]?.message?.content?.trim()

    if (!newCaption) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 502 })
    }

    // Enforce character limit (graceful truncation at word boundary)
    const truncated = newCaption.length > charLimit
      ? newCaption.slice(0, charLimit).replace(/\s+\S*$/, '…')
      : newCaption

    // ── 6. Persist updated caption ─────────────────────────────────────────
    const updated = await (prisma.socialPost as any).update({
      where: { id: params.postId },
      data: { caption: truncated },
      select: { id: true, caption: true, imagePrompt: true },
    })

    return NextResponse.json({ post: updated })
  } catch (err: any) {
    console.error('[content-plan/rewrite POST]', err)
    // Refund — failed rewrite must not charge the user (skip unlimited plans)
    if (rewriteCharged) await refundCredits(userId, 'AI_POST_REWRITE')
    return NextResponse.json({ error: 'Failed to rewrite post', refunded: rewriteCharged }, { status: 500 })
  }
}
