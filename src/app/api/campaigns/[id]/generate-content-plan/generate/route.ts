/**
 * POST /api/campaigns/[id]/generate-content-plan/generate
 *
 * Bulk image generation for Content Hub posts.
 * Accepts a list of postIds and generates images for PENDING image posts.
 *
 * Processing model:
 * - Max 5 posts per call (stay within Vercel's 60s timeout)
 * - Each post: generate image → upload to Cloudinary → update DB
 * - Frontend polls and re-triggers for remaining posts
 * - Deducts 1 IMAGE_GENERATION credit per image (3 credits = safe margin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  checkAndDeductCredits,
  checkDailyImageCap,
  refundCredits,
  refundCreditsForTransaction,
} from '@/lib/credits'
import { generateWithFlux, platformToFluxSize } from '@/lib/ai/falGen'
import { wrapPromptWithTextFreeBackgroundContract } from '@/lib/ai/imageGen'
import { normalizeContentHubImagePromptForPlatform } from '@/lib/contentHubImageFormat'
import {
  getBulkImageGenerationCost,
  validateBulkImageGenerationConfirmation,
} from '@/lib/contentHubActionSafety'
import {
  getImageProviderUnavailablePayload,
  getMediaStorageUnavailablePayload,
  isImageProviderConfigured,
  isMediaStorageConfigured,
} from '@/lib/ai/provider'

export const maxDuration = 60 // Vercel Pro — 60s max

type Params = { params: Promise<{ id: string }> }
type ImageCreditReservation = {
  postId: string
  creditsUsed: number
  transactionId?: string
  refunded: boolean
  consumed: boolean
}

const CLOUDINARY_CLOUD  = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET

// ── Image generation (mirrors cron/generate-images logic) ─────────────────────

async function generateImage(prompt: string, platform: string): Promise<string> {
  const platformPrompt = normalizeContentHubImagePromptForPlatform(prompt, platform)
  const safePrompt = wrapPromptWithTextFreeBackgroundContract(platformPrompt)

  if (process.env.FAL_KEY) {
    const fluxSize = platformToFluxSize(platform)
    const result = await generateWithFlux({ prompt: safePrompt, imageSize: fluxSize })
    return result.imageUrl
  }

  // Fallback: gpt-image-1 high quality
  const sizeMap: Record<string, '1024x1024' | '1024x1536' | '1536x1024'> = {
    TIKTOK:    '1024x1536',
    YOUTUBE:   '1024x1536',
    YOUTUBE_SHORTS: '1024x1536',
    INSTAGRAM: '1024x1024',
    META:      '1536x1024',
    LINKEDIN:  '1536x1024',
    X:         '1536x1024',
    TWITTER:   '1536x1024',
  }
  const size = sizeMap[platform?.toUpperCase()] ?? '1536x1024'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: safePrompt,
      n: 1,
      size,
      quality: 'high',
      output_format: 'b64_json',
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message || `Image API error: ${res.status}`)
  }
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('Image generation returned no data')
  return `data:image/png;base64,${b64}`
}

async function uploadToCloudinary(imageUrl: string, postId: string): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
    throw new Error('Cloudinary not configured')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const publicId = `content-hub/${postId}`
  const sigString = `folder=nexus/content-hub&public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_SECRET}`

  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(sigString))
  const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const form = new FormData()
  form.append('file', imageUrl)
  form.append('folder', 'nexus/content-hub')
  form.append('public_id', publicId)
  form.append('api_key', CLOUDINARY_KEY)
  form.append('timestamp', String(timestamp))
  form.append('signature', signature)

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  })
  const uploadData = await uploadRes.json()
  if (uploadData.error) throw new Error(`Cloudinary: ${uploadData.error.message}`)
  return uploadData.secure_url as string
}

async function refundImageReservation(
  userId: string,
  reservation: ImageCreditReservation | undefined,
  reason: string,
) {
  if (!reservation || reservation.refunded || reservation.consumed || reservation.creditsUsed <= 0) return
  reservation.refunded = true

  if (reservation.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: reservation.transactionId, reason })
    return
  }

  await refundCredits(userId, 'IMAGE_GENERATION', reason)
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creditReservations: ImageCreditReservation[] = []

  try {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      include: { workspace: { include: { brandProfile: true } } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const requestedIds: string[] = body.postIds ?? []

    // Load posts that need generation
    const postsToGenerate = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        isVideoPost: false,
        mediaSource: 'GENERATE',
        generationStatus: 'PENDING',
        imagePrompt: { not: null },
        ...(requestedIds.length ? { id: { in: requestedIds } } : {}),
      },
      take: 5, // max 5 per call — respect Vercel timeout
    })

    if (postsToGenerate.length === 0) {
      return NextResponse.json({ success: true, generated: 0, message: 'No pending posts to generate' })
    }

    const confirmation = validateBulkImageGenerationConfirmation({
      confirmed: body.explicitBulkImageGenerationConfirmed,
      acknowledgedImageCount: body.acknowledgedImageCount,
      acknowledgedCreditCost: body.acknowledgedCreditCost,
      expectedImageCount: postsToGenerate.length,
    })
    if (!confirmation.ok) {
      return NextResponse.json({
        error: confirmation.error,
        code: 'CONFIRMATION_REQUIRED',
        expectedImageCount: postsToGenerate.length,
        expectedCreditCost: getBulkImageGenerationCost(postsToGenerate.length),
      }, { status: 400 })
    }

    if (!isImageProviderConfigured()) {
      return NextResponse.json(getImageProviderUnavailablePayload(body.language), { status: 503 })
    }
    if (!isMediaStorageConfigured()) {
      return NextResponse.json(getMediaStorageUnavailablePayload(body.language), { status: 503 })
    }

    // The single-image route and the bulk route share the same daily abuse cap.
    // Check the whole confirmed batch before any credit reservation or provider
    // call so a partial batch can never exceed the user's remaining daily quota.
    const planUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })
    const imageCap = await checkDailyImageCap(campaign.workspaceId, planUser?.subscriptionStatus)
    if (!imageCap.allowed || (imageCap.remaining !== -1 && postsToGenerate.length > imageCap.remaining)) {
      return NextResponse.json({
        error: 'DAILY_IMAGE_LIMIT',
        message: `This batch needs ${postsToGenerate.length} image slot${postsToGenerate.length === 1 ? '' : 's'}, but only ${Math.max(0, imageCap.remaining)} remain today. No credits were spent.`,
        requested: postsToGenerate.length,
        used: imageCap.used,
        cap: imageCap.cap,
        remaining: imageCap.remaining,
        upgradeUrl: '/billing',
      }, { status: 429 })
    }

    // Reserve one IMAGE_GENERATION charge per post. Keep each transaction tied
    // to its post so a partial batch failure refunds only the failed image.
    const reservationsByPostId = new Map<string, ImageCreditReservation>()
    for (let i = 0; i < Math.min(postsToGenerate.length, 5); i++) {
      const post = postsToGenerate[i]
      const creditCheck = await checkAndDeductCredits(userId, 'IMAGE_GENERATION')
      if (!creditCheck.ok) {
        await Promise.all(
          creditReservations.map((reservation) =>
            refundImageReservation(userId, reservation, 'Batch image credit reservation failed'),
          ),
        )
        return NextResponse.json({
          error: creditCheck.error ?? 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          generated: 0,
        }, { status: 402 })
      }

      const reservation: ImageCreditReservation = {
        postId: post.id,
        creditsUsed: creditCheck.creditsUsed,
        transactionId: creditCheck.transactionId,
        refunded: false,
        consumed: false,
      }
      creditReservations.push(reservation)
      reservationsByPostId.set(post.id, reservation)
    }

    // Mark all as GENERATING
    await (prisma.socialPost as any).updateMany({
      where: { id: { in: postsToGenerate.map((p: any) => p.id) } },
      data: { generationStatus: 'GENERATING' },
    })

    // Generate images sequentially (avoid parallel API rate-limiting)
    const results: Array<{ id: string; success: boolean; imageUrl?: string; error?: string }> = []

    for (const post of postsToGenerate) {
      const reservation = reservationsByPostId.get(post.id)
      let visualId: string | null = null
      try {
        const visual = await (prisma.generatedVisual as any).create({
          data: {
            workspaceId: campaign.workspaceId,
            campaignId: campaign.id,
            visualType: 'SOCIAL_PREVIEW',
            visualStyle: 'Content Hub',
            prompt: post.imagePrompt!,
            enhancedPrompt: normalizeContentHubImagePromptForPlatform(post.imagePrompt!, post.platform),
            campaignName: campaign.name,
            brandName: campaign.workspace?.brandProfile?.brandName ?? null,
            status: 'GENERATING',
            parentId: `social-post:${post.id}`,
          },
        })
        visualId = visual.id

        const rawUrl = await generateImage(post.imagePrompt!, post.platform)
        // Content Hub media must be durable. Never put a provider-temporary URL
        // or a base64 payload in SocialPost.imageUrl.
        const finalUrl = await uploadToCloudinary(rawUrl, post.id)

        await prisma.$transaction(async (tx) => {
          await (tx.socialPost as any).update({
            where: { id: post.id },
            data: { imageUrl: finalUrl, generationStatus: 'DONE', mediaSource: 'GENERATE' },
          })
          await (tx.generatedVisual as any).update({
            where: { id: visualId! },
            data: { imageUrl: finalUrl, status: 'COMPLETED' },
          })
        })
        if (reservation) reservation.consumed = true

        results.push({ id: post.id, success: true, imageUrl: finalUrl })
      } catch (err: any) {
        console.error(`[Content Hub] Image generation failed for ${post.id}:`, err)
        // Refund this post's image credit — a failed image must not be charged
        await refundImageReservation(userId, reservation, err.message ?? 'Image generation failed')
        if (visualId) {
          await (prisma.generatedVisual as any).update({
            where: { id: visualId },
            data: { status: 'FAILED', errorMessage: String(err.message ?? 'Image generation failed').slice(0, 500) },
          }).catch(() => {})
        }
        await (prisma.socialPost as any).update({ where: { id: post.id }, data: { generationStatus: 'FAILED' } })
        results.push({ id: post.id, success: false, error: err.message })
      }
    }

    const generated = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const remaining = await (prisma.socialPost as any).count({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        generationStatus: 'PENDING',
        isVideoPost: false,
        mediaSource: 'GENERATE',
      },
    })

    return NextResponse.json({
      success: true,
      generated,
      failed,
      remaining,
      results,
    })
  } catch (err: any) {
    console.error('[generate-content-plan/generate POST]', err)
    await Promise.all(
      creditReservations.map((reservation) =>
        refundImageReservation(userId, reservation, err.message ?? 'Batch image generation failed'),
      ),
    )
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
