/**
 * POST /api/campaigns/[id]/video-generate
 *
 * Submit a video generation prediction to Replicate.
 * Returns immediately with a generationId — the client polls
 * /api/campaigns/[id]/video-status/[generationId] for completion.
 *
 * If REPLICATE_API_TOKEN or REPLICATE_VIDEO_MODEL_VERSION are missing,
 * returns { providerAvailable: false } — the client shows a clean message.
 *
 * Sprint Q — Video Intelligence
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { checkAndDeductCredits } from '@/lib/credits'
import {
  isVideoProviderAvailable,
  submitReplicatePrediction,
} from '@/lib/ai/videoGen'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export const maxDuration = 30

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return clean message if no provider configured
  if (!isVideoProviderAvailable()) {
    return NextResponse.json({
      providerAvailable: false,
      message: 'Video generation provider not configured. Generate a Video Brief to plan your video content.',
    })
  }

  // Credit check
  const credit = await checkAndDeductCredits(userId, 'VIDEO_GENERATION')
  if (!credit.ok) return NextResponse.json(credit, { status: 402 })

  const body = await req.json()
  const { prompt, durationSeconds = 5 } = body

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
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
        prompt,
        params: { durationSeconds, model: process.env.REPLICATE_VIDEO_MODEL_VERSION },
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
    const prediction = await submitReplicatePrediction(prompt, durationSeconds)

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
        description: 'Video generation started — awaiting Replicate render',
      },
    }).catch(() => {})

    return NextResponse.json({
      providerAvailable: true,
      generationId: generation.id,
      externalId: prediction.id,
      status: 'QUEUED',
      creditsRemaining: credit.creditsRemaining,
    })
  } catch (err: any) {
    console.error('[video-generate] Replicate error:', err)

    // Mark generation as failed
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', error: err.message },
    }).catch(() => {})

    // Refund credit on provider failure (best-effort)
    // Note: we don't refund — the brief was consumed regardless
    return NextResponse.json({
      error: err.message || 'Video generation failed to start',
      generationId: generation.id,
    }, { status: 500 })
  }
}
