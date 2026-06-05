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
import { sendContentPlanReadyEmail } from '@/lib/email/resend'

type Params = { params: { id: string } }

// ── Platform distribution helpers ─────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  META:      'Facebook / Instagram',
  LINKEDIN:  'LinkedIn',
  TIKTOK:    'TikTok',
  YOUTUBE:   'YouTube',
}

/**
 * Map any user-facing platform string to a valid IntegrationType enum value.
 * The Prisma enum only knows: META | LINKEDIN | TIKTOK | YOUTUBE | GOOGLE | STRIPE | CLOUDINARY | SLACK
 * Instagram, Facebook, Twitter, X, Snapchat, Pinterest all collapse to META.
 */
function toIntegrationType(raw: string): string {
  const map: Record<string, string> = {
    INSTAGRAM: 'META',
    FACEBOOK:  'META',
    TWITTER:   'META',
    X:         'META',
    SNAPCHAT:  'META',
    PINTEREST: 'META',
    REELS:     'META',
    STORIES:   'META',
    THREADS:   'META',
    LINKEDIN:  'LINKEDIN',
    TIKTOK:    'TIKTOK',
    YOUTUBE:   'YOUTUBE',
    YOUTUBE_SHORTS: 'YOUTUBE',
    META:      'META',
    GOOGLE:    'GOOGLE',
  }
  return map[raw.toUpperCase()] ?? 'META'
}

// ── Platform-native best posting hours (UTC-agnostic — local-ish heuristic) ───

/**
 * Returns the best posting hour (0–23) for a platform.
 * Research-backed peaks: we cycle through multiple slots so consecutive posts
 * on the same platform hit different windows across the 30-day plan.
 */
const PLATFORM_BEST_HOURS: Record<string, number[]> = {
  META:     [11, 15, 20],  // Facebook/Instagram: 11am, 3pm, 8pm
  LINKEDIN: [8,  12, 17],  // LinkedIn: 8am, 12pm, 5pm (Tue-Thu focused)
  TIKTOK:   [19, 21, 12],  // TikTok: 7pm, 9pm, 12pm
  YOUTUBE:  [14, 16, 20],  // YouTube: 2pm, 4pm, 8pm
}

/** FLC3: Pick platform-optimal posting hour for slot i */
function bestHourForPlatform(platform: string, slotIndex: number): number {
  const hours = PLATFORM_BEST_HOURS[platform] ?? [10, 14, 18]
  return hours[slotIndex % hours.length]
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

  // Interleave posts across platforms — normalize to valid IntegrationType
  for (let i = 0; i < totalPosts; i++) {
    const platform = toIntegrationType(platforms[i % platforms.length])
    slots.push({ platform, isVideoPost: false, index: idx++ })
  }

  // Distribute video slots — normalize to valid IntegrationType
  for (let i = 0; i < totalVideoSlots; i++) {
    const platform = toIntegrationType(platforms[i % platforms.length])
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

    // FL2: Prefer connected platforms from Integration table over wizard selection.
    // This ensures the content plan targets channels the user actually has connected.
    const connectedIntegrations = await prisma.integration.findMany({
      where: {
        workspaceId,
        status: 'CONNECTED' as any,
        // Exclude non-social integrations
        type: { notIn: ['STRIPE', 'CLOUDINARY', 'GOOGLE', 'SLACK'] as any[] },
      },
      select: { type: true },
    })
    const platforms: string[] =
      connectedIntegrations.length > 0
        ? [...new Set(connectedIntegrations.map(i => String(i.type)))]
        : ((campaign.platforms as string[]) ?? ['META'])

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
    const enableABTesting: boolean = body.enableABTesting ?? false

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

    // Helper: generate a simple UUID-like group ID for A/B pairs
    function makeVariantGroup(): string {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    }

    // Pre-compute A/B variant groups per image slot (non-video only)
    // Each image slot index → variantGroup string (shared between A and B)
    const variantGroups: Record<number, string> = {}
    if (enableABTesting) {
      slots.forEach((slot, i) => {
        if (!slot.isVideoPost) variantGroups[i] = makeVariantGroup()
      })
    }

    const postsToCreate = slots.map((slot, i) => {
      const gen = generatedPosts[i] ?? generatedPosts.find((g: any) => g.index === slot.index) ?? {}
      const caption = gen.caption ?? gen.text ?? `Post ${i + 1} for ${PLATFORM_LABELS[slot.platform] ?? slot.platform}`
      const imagePrompt = gen.imagePrompt ?? ''
      const videoPrompt = gen.videoScript ?? gen.videoCaption ?? ''
      const dayOffset = Math.max(1, Math.min(30, gen.scheduledDayOffset ?? i + 1))

      const scheduledAt = new Date(now)
      scheduledAt.setDate(now.getDate() + dayOffset)
      // FLC3: Platform-native best posting hour instead of naive stagger
      scheduledAt.setHours(bestHourForPlatform(slot.platform, i), 0, 0, 0)

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
        // A/B fields — set A label + group for image slots when testing enabled
        variantGroup:  (!slot.isVideoPost && enableABTesting) ? variantGroups[i] : null,
        variantLabel:  (!slot.isVideoPost && enableABTesting) ? 'A' : null,
        variantWinner: false,
      }
    })

    await (prisma.socialPost as any).createMany({ data: postsToCreate })

    // ── 9b. Generate and insert B variants (if A/B enabled) ────────────────
    let bVariantsCreated = 0
    if (enableABTesting) {
      try {
        const HOOK_STYLES = [
          'Use a provocative question as the opening hook.',
          'Lead with a surprising statistic or counterintuitive fact.',
          'Start with a bold, confident statement that challenges conventional thinking.',
          'Open with an emotional story-driven hook (1-2 sentences of narrative).',
          'Begin with a "before/after" or "problem → solution" framing.',
        ]

        const bSystemPrompt = `You are an expert social media content strategist for ${brandName}.

Campaign: "${campaignName}"
Key message: "${keyMessage}"
Target audience: ${targetAudience}
Content pillars: ${pillarText}
Tone: ${tone}
Offer/CTA: ${offer}

You are generating VARIANT B captions. Each variant must use a DIFFERENT hook style from the original.
For each post, the hook style is specified — follow it exactly.
Keep the same platform, same CTA intent, same language as the original post — only the hook/opening changes.

Return a JSON array of caption objects (same count as input):
[{ "index": 0, "caption": "..." }]`

        const imageSlotsWithAB = slots
          .map((slot, i) => ({ slot, i }))
          .filter(({ slot }) => !slot.isVideoPost)

        const bUserMsg = `Generate B-variant captions for ${imageSlotsWithAB.length} image posts.
Slots:
${imageSlotsWithAB.map(({ slot, i }) => JSON.stringify({
  index: i,
  platform: slot.platform,
  hookStyle: HOOK_STYLES[i % HOOK_STYLES.length],
})).join('\n')}`

        const bRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: bSystemPrompt },
              { role: 'user', content: bUserMsg },
            ],
            temperature: 0.9,
            response_format: { type: 'json_object' },
          }),
        })
        const bData = await bRes.json()
        let bPosts: any[] = []
        try {
          const raw = JSON.parse(bData.choices?.[0]?.message?.content ?? '{}')
          bPosts = Array.isArray(raw) ? raw : (raw.posts ?? raw.captions ?? raw.variants ?? [])
        } catch { bPosts = [] }

        const bVariantsToCreate = imageSlotsWithAB.map(({ slot, i }, bIdx) => {
          const gen = generatedPosts[i] ?? generatedPosts.find((g: any) => g.index === slot.index) ?? {}
          const bGen = bPosts[bIdx] ?? bPosts.find((b: any) => b.index === i) ?? {}
          const caption = bGen.caption ?? gen.caption ?? `B Variant Post ${i + 1}`
          const imagePrompt = gen.imagePrompt ?? '' // reuse same image prompt for B

          const dayOffset = Math.max(1, Math.min(30, gen.scheduledDayOffset ?? i + 1))
          const scheduledAt = new Date(now)
          scheduledAt.setDate(now.getDate() + dayOffset)
          scheduledAt.setHours(bestHourForPlatform(slot.platform, i), 0, 0, 0)

          let uploadedMediaId: string | null = null
          let effectiveMediaSource = mediaSource
          if (mediaSource !== 'GENERATE' && userMedia.length > 0) {
            uploadedMediaId = userMedia[i % userMedia.length].id
          }

          return {
            workspaceId,
            campaignId: params.id,
            platform: slot.platform as any,
            caption,
            imagePrompt,
            videoPrompt: null,
            isVideoPost: false,
            generationStatus: 'PENDING',
            mediaSource: effectiveMediaSource,
            uploadedMediaId,
            contentPlanIndex: slot.index + 1, // same index as A — they share a slot
            status: 'DRAFT' as const,
            scheduledAt,
            autoGenerated: true,
            variantGroup: variantGroups[i],
            variantLabel: 'B',
            variantWinner: false,
          }
        })

        if (bVariantsToCreate.length > 0) {
          await (prisma.socialPost as any).createMany({ data: bVariantsToCreate })
          bVariantsCreated = bVariantsToCreate.length
        }
      } catch (abErr) {
        // Non-fatal: A/B generation failure doesn't fail the whole request
        console.warn('[generate-content-plan] A/B variant generation failed:', abErr)
      }
    }

    // ── 10. Send "Content Plan Ready" email (non-blocking) ────────────────
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }).then(user => {
      if (user?.email) {
        sendContentPlanReadyEmail(
          user.email,
          user.name ?? '',
          campaignName,
          postsToCreate.length,
          params.id,
        ).catch(() => { /* non-fatal */ })
      }
    }).catch(() => { /* non-fatal */ })

    // ── 11. Return summary ────────────────────────────────────────────────
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
        abTesting: enableABTesting ? { enabled: true, bVariants: bVariantsCreated } : { enabled: false },
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
