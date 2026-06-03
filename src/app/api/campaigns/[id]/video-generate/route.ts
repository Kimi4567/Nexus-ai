/**
 * POST /api/campaigns/[id]/video-generate
 *
 * Submit a video generation prediction to Replicate.
 * Returns immediately with a generationId — the client polls
 * /api/campaigns/[id]/video-status/[generationId] for completion.
 *
 * Video generation is gated by a monthly quota (NOT credits) per plan:
 *   FREE: 0 videos/month, PRO: 5/month, BUSINESS: 20/month
 * This protects margins since video costs $0.30–$1.00/video via Replicate.
 *
 * Sprint Q — Video Intelligence | Sprint AI — Quota-based billing
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { PLAN_VIDEO_QUOTA } from '@/lib/stripe'
import {
  isVideoProviderAvailable,
  isImg2VideoAvailable,
  submitReplicatePrediction,
  submitImageToVideoGeneration,
} from '@/lib/ai/videoGen'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export const maxDuration = 30

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sprint AF — check mode before provider check
  const rawBody = await req.json().catch(() => ({}))
  const mode: 'text2video' | 'img2video' = rawBody.mode === 'img2video' ? 'img2video' : 'text2video'

  // For img2video mode we only need REPLICATE_API_TOKEN (no model version needed for SVD)
  if (mode === 'img2video') {
    if (!isImg2VideoAvailable()) {
      return NextResponse.json({
        providerAvailable: false,
        message: 'Image-to-video provider not configured. Add REPLICATE_API_TOKEN to enable this feature.',
      })
    }
  } else if (!isVideoProviderAvailable()) {
    return NextResponse.json({
      providerAvailable: false,
      message: 'Video generation provider not configured. Generate a Video Brief to plan your video content.',
    })
  }

  // ── Video quota check (replaces credit deduction) ──────────────────────────
  // Fetch user plan + count their video generations this calendar month
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, role: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  // Admins bypass quota entirely (founders / internal testing)
  const isAdmin = user.role === 'ADMIN'

  const planKey = (user.subscriptionStatus || 'FREE').toUpperCase()
  const monthlyLimit = isAdmin ? 999 : (PLAN_VIDEO_QUOTA[planKey] ?? 0)

  if (monthlyLimit === 0) {
    return NextResponse.json({
      ok: false,
      error: 'VIDEO_QUOTA_EXCEEDED',
      message: 'Video generation is not available on the Free plan. Upgrade to Pro to generate up to 5 videos per month.',
      upgradeUrl: '/billing',
    }, { status: 402 })
  }

  // Count this user's video generations in the current calendar month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const monthlyVideoCount = await db.generation.count({
    where: {
      type: 'VIDEO',
      createdAt: { gte: startOfMonth },
      campaign: { workspace: { ownerId: userId } },
    },
  }).catch(() => 0) // Non-fatal — if table doesn't exist yet, allow the request

  if (monthlyVideoCount >= monthlyLimit) {
    return NextResponse.json({
      ok: false,
      error: 'VIDEO_QUOTA_EXCEEDED',
      message: `You've used all ${monthlyLimit} video${monthlyLimit === 1 ? '' : 's'} for this month. Your quota resets on the 1st of next month.`,
      used: monthlyVideoCount,
      limit: monthlyLimit,
      upgradeUrl: '/billing',
    }, { status: 402 })
  }

  const { prompt, durationSeconds = 5, sourceImageUrl, motionHint, script } = rawBody

  // For text-to-video, prompt is required. For img2video, sourceImageUrl is required.
  if (mode === 'img2video') {
    if (!sourceImageUrl || typeof sourceImageUrl !== 'string') {
      return NextResponse.json({ error: 'sourceImageUrl is required for img2video mode' }, { status: 400 })
    }
  } else {
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }
  }

  // Get workspace
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  // Verify campaign belongs to user
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspace: { ownerId: userId } },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Create Generation record in QUEUED state
  let generation: any
  try {
    generation = await db.generation.create({
      data: {
        campaignId: params.id,
        type: 'VIDEO',
        prompt: mode === 'img2video' ? `[img2video] ${sourceImageUrl}` : prompt,
        params: {
          mode,
          durationSeconds,
          ...(mode === 'img2video'
            ? { sourceImageUrl, motionHint }
            : { model: process.env.REPLICATE_VIDEO_MODEL_VERSION, script: script || null }),
        },
        status: 'QUEUED',
        provider: 'replicate',
      },
    })
  } catch (dbErr) {
    console.error('[video-generate] DB create error:', dbErr)
    return NextResponse.json({ error: 'Failed to create generation record' }, { status: 500 })
  }

  // Submit to Replicate (non-blocking result — client will poll)
  try {
    const prediction = mode === 'img2video'
      ? await submitImageToVideoGeneration(sourceImageUrl, motionHint)
      : await submitReplicatePrediction(prompt, durationSeconds)

    // Update with Replicate's prediction ID
    await db.generation.update({
      where: { id: generation.id },
      data: {
        externalId: prediction.id,
        status: 'QUEUED',
        metadata: { replicatePredictionId: prediction.id, startedAt: new Date().toISOString() },
      },
    })

    // Activity log (non-blocking)
    prisma.campaignActivity.create({
      data: {
        campaignId: params.id,
        type: 'updated',
        description: mode === 'img2video'
          ? 'Image-to-video generation started — awaiting Replicate render'
          : 'Video generation started — awaiting Replicate render',
      },
    }).catch(() => {})

    return NextResponse.json({
      providerAvailable: true,
      mode,
      generationId: generation.id,
      externalId: prediction.id,
      status: 'QUEUED',
      videoQuotaUsed: monthlyVideoCount + 1,
      videoQuotaLimit: monthlyLimit,
    })
  } catch (err: any) {
    console.error('[video-generate] Replicate error:', err)

    // Mark generation as failed
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', error: err.message },
    }).catch(() => {})

    return NextResponse.json({
      error: err.message || 'Video generation failed to start',
      generationId: generation.id,
    }, { status: 500 })
  }
}
