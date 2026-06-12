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
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'
import { generateWithFlux, platformToFluxSize } from '@/lib/ai/falGen'
import { buildImagePrompt, type VisualContext } from '@/lib/ai/imageGen'

export const maxDuration = 60 // Vercel Pro — 60s max

type Params = { params: { id: string } }

const CLOUDINARY_CLOUD  = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET

// ── Image generation (mirrors cron/generate-images logic) ─────────────────────

function buildPostVisualContext(campaign: any, post: any): VisualContext {
  const brand = campaign.workspace?.brandProfile
  const aiOutput = (campaign.aiOutput as any) || {}
  const strategy = aiOutput.strategy || aiOutput || {}

  return {
    visualType: 'SOCIAL_PREVIEW',
    visualStyle: 'Premium',
    campaignName: campaign.name || undefined,
    campaignGoal: campaign.goal || undefined,
    campaignTone: campaign.tone || undefined,
    audience: campaign.audience || strategy.targetAudience || undefined,
    brandName: brand?.brandName || campaign.workspace?.name || undefined,
    primaryOffer: brand?.primaryOffer || strategy.primaryOffer || strategy.cta || undefined,
    industry: brand?.industry || undefined,
    brandToneWords: Array.isArray(brand?.toneKeywords) ? brand.toneKeywords : [],
    colorPalette: Array.isArray(brand?.colorPalette)
      ? brand.colorPalette.join(', ')
      : (brand?.colorPalette || undefined),
    visualStylePref: brand?.visualStyle || undefined,
    uniqueAdvantages: Array.isArray(brand?.uniqueAdvantages)
      ? brand.uniqueAdvantages.slice(0, 3).join(', ')
      : undefined,
    positioning: strategy.positioning || undefined,
    visualDirection: strategy.visualDirection || post.imagePrompt || undefined,
    differentiation: strategy.differentiation || undefined,
    keyMessage: strategy.keyMessage || strategy.coreMessage || undefined,
    postCaption: post.caption || post.imagePrompt || strategy.keyMessage || campaign.name || '',
    platform: post.platform || 'META',
  }
}

async function generateImage(prompt: string, platform: string): Promise<string> {
  if (process.env.FAL_KEY) {
    const fluxSize = platformToFluxSize(platform)
    const result = await generateWithFlux({ prompt, imageSize: fluxSize })
    return result.imageUrl
  }

  // Fallback: gpt-image-1 high quality
  const sizeMap: Record<string, '1024x1024' | '1024x1536' | '1536x1024'> = {
    TIKTOK:    '1024x1536',
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
      prompt,
      n: 1,
      size,
      quality: 'high',
      output_format: 'b64_json',
    }),
  })

  const data = await res.json()
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

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    // Check credits — 1 credit per image (IMAGE_GENERATION cost = 3)
    // We check once for the batch; each image costs 3 credits
    let creditsWereCharged = false
    for (let i = 0; i < Math.min(postsToGenerate.length, 5); i++) {
      const creditCheck = await checkAndDeductCredits(userId, 'IMAGE_GENERATION')
      if (!creditCheck.ok) {
        // Mark remaining as PENDING (not started)
        return NextResponse.json({
          error: creditCheck.error ?? 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          generated: i,
        }, { status: 402 })
      }
      creditsWereCharged = creditCheck.creditsUsed > 0
    }

    // Mark all as GENERATING
    await (prisma.socialPost as any).updateMany({
      where: { id: { in: postsToGenerate.map((p: any) => p.id) } },
      data: { generationStatus: 'GENERATING' },
    })

    // Generate images sequentially (avoid parallel API rate-limiting)
    const results: Array<{ id: string; success: boolean; imageUrl?: string; error?: string }> = []

    for (const post of postsToGenerate) {
      try {
        const { prompt } = await buildImagePrompt(buildPostVisualContext(campaign, post))
        const rawUrl = await generateImage(prompt, post.platform)

        let finalUrl = rawUrl
        // Upload to Cloudinary if configured (avoids base64 in DB)
        if (CLOUDINARY_CLOUD && CLOUDINARY_KEY && CLOUDINARY_SECRET) {
          try {
            finalUrl = await uploadToCloudinary(rawUrl, post.id)
          } catch (uploadErr) {
            console.warn(`[Content Hub] Cloudinary upload failed for ${post.id}:`, uploadErr)
            // Fall back to raw URL (base64 or CDN URL from Flux)
          }
        }

        await (prisma.socialPost as any).update({ where: { id: post.id }, data: { imageUrl: finalUrl, generationStatus: 'DONE' } })

        results.push({ id: post.id, success: true, imageUrl: finalUrl })
      } catch (err: any) {
        console.error(`[Content Hub] Image generation failed for ${post.id}:`, err)
        await (prisma.socialPost as any).update({ where: { id: post.id }, data: { generationStatus: 'FAILED' } })
        // Refund this post's image credit — a failed image must not be charged
        if (creditsWereCharged) await refundCredits(userId, 'IMAGE_GENERATION')
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
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
