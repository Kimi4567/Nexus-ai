/**
 * Content Plan Generation API
 * POST /api/campaigns/[id]/generate-content-plan
 *
 * Generates the full monthly content plan for a campaign:
 * - Reads strategy from campaign.aiOutput
 * - Checks user's plan quota (PLAN_QUOTAS)
 * - Uses GPT-4o-mini to generate post captions + image prompts for each slot
 * - Detects user's uploaded media and optionally assigns to posts
 * - Creates SocialPost records with status=DRAFT, generationStatus=PENDING
 * - Video slots get isVideoPost=true, no image generation — user uploads their own
 *
 * DELETE /api/campaigns/[id]/generate-content-plan
 * Clears all PENDING/DRAFT content plan posts (not yet published)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { checkAndDeductCredits } from '@/lib/credits'
import { PLAN_QUOTAS } from '@/lib/stripe'

type Params = { params: { id: string } }

// ── Platform distribution helpers ─────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  META: 'Facebook',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  TIKTOK: 'TikTok',
  X: 'X (Twitter)',
  TWITTER: 'X (Twitter)',
}

/** Distribute N posts across an array of platforms as evenly as possible */
function distributePosts(
  totalPosts: number,
  totalVideoSlots: number,
  platforms: string[],
): Array<{ platform: string; isVideoPost: boolean; index: number }> {
  if (!platforms.length) platforms = ['META']

  const slots: Array<{ platform: string; isVideoPost: boolean; index: number }> = []
  let idx = 0

  // Interleave posts across platforms
  for (let i = 0; i < totalPosts; i++) {
    const platform = platforms[i % platforms.length].toUpperCase()
    slots.push({ platform, isVideoPost: false, index: idx++ })
  }

  // Distribute video slots (spread across platforms too)
  for (let i = 0; i < totalVideoSlots; i++) {
    const platform = platforms[i % platforms.length].toUpperCase()
    slots.push({ platform, isVideoPost: true, index: idx++ })
  }

  return slots
}

// ── Main POST handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── 1. Load campaign ───────────────────────────────────────────────────
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: { workspace: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const workspaceId = campaign.workspaceId

    // ── 2. Check plan quota ────────────────────────────────────────────────
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      select: { plan: true, status: true },
    })

    const planRaw = subscription?.plan?.toString().toLowerCase() ?? 'free'
    const isActive = ['ACTIVE', 'active'].includes(subscription?.status?.toString() ?? '')
    const planName = isActive ? planRaw : 'free'
    const quota = PLAN_QUOTAS[planName] ?? PLAN_QUOTAS['free']

    // ── 3. Deduct credits (flat 2 credits per content plan generation) ────
    const creditCheck = await checkAndDeductCredits(userId, 'CONTENT_PLAN_GENERATION')
    if (!creditCheck.ok) {
      return NextResponse.json(
        { error: creditCheck.error ?? 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      )
    }

    // ── 4. Read strategy from aiOutput ────────────────────────────────────
    const aiOutput = campaign.aiOutput as any
    const strategy = aiOutput?.strategy ?? aiOutput ?? {}

    const brandName    = campaign.workspace?.name ?? 'Brand'
    const campaignName = campaign.name ?? 'Campaign'
    const platforms    = (campaign.platforms as string[]) ?? ['META']

    const keyMessage    = strategy.keyMessage ?? strategy.coreMessage ?? ''
    const targetAudience = strategy.targetAudience
      ? JSON.stringify(strategy.targetAudience)
      : campaign.audience ?? ''
    const contentPillars: string[] = strategy.contentPillars?.map((p: any) =>
      typeof p === 'string' ? p : p.pillar ?? p.name ?? JSON.stringify(p),
    ) ?? []
    const tone = campaign.tone ?? strategy.tonalDirection ?? 'professional'
    const offer = strategy.primaryOffer ?? strategy.cta ?? ''

    // ── 5. Check for uploaded media the user wants to use ─────────────────
    const body = await req.json().catch(() => ({}))
    const mediaSource: 'GENERATE' | 'UPLOAD' | 'MIXED' = body.mediaSource ?? 'GENERATE'
    const selectedMediaIds: string[] = body.selectedMediaIds ?? []

    let userMedia: Array<{ id: string; url: string; type: string; fileName: string }> = []
    if (mediaSource !== 'GENERATE') {
      userMedia = await prisma.media.findMany({
        where: {
          workspaceId,
          ...(selectedMediaIds.length ? { id: { in: selectedMediaIds } } : {}),
          type: { in: ['IMAGE' as any, 'LOGO' as any] },
        },
        select: { id: true, url: true, type: true, fileName: true },
        take: 30,
      })
    }

    // ── 6. Clear any existing DRAFT content plan posts ────────────────────
    // Cast to any — generationStatus was added via raw SQL migration; prisma generate
    // hasn't re-run yet so the typed client doesn't include it. The cast bypasses
    // both TS compile-time errors AND Prisma's runtime schema validation.
    await (prisma.socialPost as any).deleteMany({
      where: {
        campaignId: params.id,
        workspaceId,
        status: 'DRAFT',
        generationStatus: { in: ['PENDING', 'FAILED'] },
        publishedAt: null,
      },
    })

    // ── 7. Build slot distribution ─────────────────────────────────────────
    const slots = distributePosts(quota.postsPerMonth, quota.videoSlotsPerMonth, platforms)

    // ── 8. Generate all post content via GPT-4o-mini ─────────────────────
    const pillarText = contentPillars.length
      ? contentPillars.slice(0, 5).join(', ')
      : 'brand awareness, engagement, conversion'

    const systemPrompt = `You are an expert social media content strategist for ${brandName}.

Campaign: "${campaignName}"
Key message: "${keyMessage}"
Target audience: ${targetAudience}
Content pillars: ${pillarText}
Tone: ${tone}
Offer/CTA: ${offer}

Generate platform-native social media posts. Each post must:
- Feel native to its platform (length, style, hashtags)
- Rotate across the content pillars
- Have a clear hook in the first sentence
- Include a call to action
- Be in the same language as the campaign description

Return a JSON array of exactly ${slots.length} post objects:
[
  {
    "index": 0,
    "platform": "META",
    "isVideoPost": false,
    "caption": "full post caption text with hashtags",
    "imagePrompt": "detailed DALL-E prompt describing the image: style, colors, composition, brand feel. Never include text/words in the image.",
    "scheduledDayOffset": 1
  }
]

Rules:
- caption: platform-appropriate length (Instagram ≤ 2200 chars, Twitter/X ≤ 280 chars, LinkedIn ≤ 1300 chars, Facebook ≤ 500 chars)
- imagePrompt: vivid, specific, brand-consistent visual description. No text overlays.
- isVideoPost=true slots: write a videoCaption and videoScript field instead of imagePrompt
- scheduledDayOffset: spread posts across 30 days (1–30), roughly 1 per day`

    const userMsg = `Generate content plan for ${slots.length} posts. Slots: ${JSON.stringify(
      slots.map(s => ({ index: s.index, platform: s.platform, isVideoPost: s.isVideoPost })),
    )}`

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
    })
    const chatData = await chatRes.json()

    let generatedPosts: any[] = []
    try {
      const raw = JSON.parse(chatData.choices?.[0]?.message?.content ?? '{}')
      generatedPosts = Array.isArray(raw) ? raw : (raw.posts ?? raw.content ?? [])
    } catch {
      generatedPosts = []
    }

    // ── 9. Create SocialPost records ──────────────────────────────────────
    const now = new Date()
    const postsToCreate = slots.map((slot, i) => {
      const gen = generatedPosts[i] ?? generatedPosts.find((g: any) => g.index === slot.index) ?? {}
      const caption = gen.caption ?? gen.text ?? `Post ${i + 1} for ${PLATFORM_LABELS[slot.platform] ?? slot.platform}`
      const imagePrompt = gen.imagePrompt ?? ''
      const videoPrompt = gen.videoScript ?? gen.videoCaption ?? ''
      const dayOffset = Math.max(1, Math.min(30, gen.scheduledDayOffset ?? i + 1))

      const scheduledAt = new Date(now)
      scheduledAt.setDate(now.getDate() + dayOffset)
      scheduledAt.setHours(9 + (i % 12), 0, 0, 0) // stagger post times

      // Pick an uploaded media image if UPLOAD or MIXED mode
      let uploadedMediaId: string | null = null
      let effectiveMediaSource = mediaSource
      if (mediaSource !== 'GENERATE' && userMedia.length > 0 && !slot.isVideoPost) {
        uploadedMediaId = userMedia[i % userMedia.length].id
      } else if (slot.isVideoPost) {
        effectiveMediaSource = 'UPLOAD' // videos always user-uploaded
      }

      return {
        workspaceId,
        campaignId: params.id,
        platform: slot.platform as any,
        caption,
        imagePrompt: slot.isVideoPost ? null : imagePrompt,
        videoPrompt: slot.isVideoPost ? videoPrompt : null,
        isVideoPost: slot.isVideoPost,
        generationStatus: slot.isVideoPost ? 'AWAITING_UPLOAD' : 'PENDING',
        mediaSource: effectiveMediaSource,
        uploadedMediaId,
        contentPlanIndex: slot.index + 1,
        status: 'DRAFT' as const,
        scheduledAt,
        autoGenerated: true,
      }
    })

    await (prisma.socialPost as any).createMany({ data: postsToCreate })

    // ── 10. Return summary ────────────────────────────────────────────────
    const imagePosts  = postsToCreate.filter(p => !p.isVideoPost).length
    const videoSlots  = postsToCreate.filter(p => p.isVideoPost).length
    const uploadSlots = postsToCreate.filter(p => p.mediaSource === 'UPLOAD' && !p.isVideoPost).length

    return NextResponse.json({
      success: true,
      summary: {
        total: postsToCreate.length,
        imagePosts,
        videoSlots,
        uploadSlots,
        platforms: [...new Set(postsToCreate.map(p => p.platform))],
        planName,
        quota,
      },
    })
  } catch (err: any) {
    console.error('[generate-content-plan POST]', err)
    return NextResponse.json({ error: 'Failed to generate content plan' }, { status: 500 })
  }
}

// ── DELETE: clear pending content plan ────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleted = await prisma.socialPost.deleteMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'DRAFT',
        publishedAt: null,
      },
    })

    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (err: any) {
    console.error('[generate-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to clear content plan' }, { status: 500 })
  }
}
