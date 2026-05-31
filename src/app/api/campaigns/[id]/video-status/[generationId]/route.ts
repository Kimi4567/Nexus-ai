/**
 * GET /api/campaigns/[id]/video-status/[generationId]
 *
 * Poll video generation status. On each call:
 * 1. Reads Generation record from DB
 * 2. If still processing: polls Replicate and syncs status to DB
 * 3. If succeeded: saves video URL to Generation.output + creates Media record
 * 4. Returns current status, progress, and output URL if available
 *
 * Sprint Q — Video Intelligence
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  pollReplicatePrediction,
  extractVideoUrl,
  mapReplicateStatus,
} from '@/lib/ai/videoGen'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

type Params = { params: { id: string; generationId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to user
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspace: { ownerId: userId } },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Fetch generation record
  let generation: any
  try {
    generation = await db.generation.findUnique({
      where: { id: params.generationId },
    })
  } catch {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
  }
  if (!generation) return NextResponse.json({ error: 'Generation not found' }, { status: 404 })

  // If already terminal, return cached result
  if (
    generation.status === 'COMPLETED' ||
    generation.status === 'FAILED' ||
    generation.status === 'CANCELLED'
  ) {
    return NextResponse.json({
      status: generation.status,
      progress: generation.progress,
      output: generation.output,
      error: generation.error,
    })
  }

  // Poll Replicate for live status
  if (generation.provider === 'replicate' && generation.externalId) {
    try {
      const prediction = await pollReplicatePrediction(generation.externalId)
      const nexusStatus = mapReplicateStatus(prediction.status)
      const videoUrl = extractVideoUrl(prediction)

      // Compute progress
      const progress =
        nexusStatus === 'COMPLETED' ? 100 :
        nexusStatus === 'PROCESSING' ? 60 :
        nexusStatus === 'QUEUED'     ? 20 : 0

      // Determine update data
      const updateData: any = {
        status: nexusStatus,
        progress,
      }

      if (prediction.error) updateData.error = prediction.error

      // On success: save URL and create Media record
      if (nexusStatus === 'COMPLETED' && videoUrl) {
        updateData.output = videoUrl

        // Save to Media Library (non-blocking on error)
        try {
          const workspace = await prisma.workspace.findFirst({
            where: { ownerId: userId },
            orderBy: { createdAt: 'asc' },
          })
          if (workspace) {
            await prisma.media.create({
              data: {
                workspaceId: workspace.id,
                campaignId: params.id,
                fileName: `video_${generation.id.slice(0, 8)}.mp4`,
                mimeType: 'video/mp4',
                type: 'VIDEO',
                url: videoUrl,
                size: 0,
                category: 'generated',
                tags: ['ai-generated', 'replicate'],
              },
            })
          }
        } catch (mediaErr) {
          console.error('[video-status] Media create failed:', mediaErr)
        }

        // Activity log
        prisma.campaignActivity.create({
          data: {
            campaignId: params.id,
            type: 'updated',
            description: 'Video generation completed — saved to Media Library',
          },
        }).catch(() => {})
      }

      // Update DB
      await db.generation.update({
        where: { id: generation.id },
        data: updateData,
      })

      return NextResponse.json({
        status: nexusStatus,
        progress,
        output: videoUrl,
        error: prediction.error || null,
      })
    } catch (pollErr: any) {
      console.error('[video-status] Replicate poll error:', pollErr)
      // Don't fail the request — return last known status from DB
      return NextResponse.json({
        status: generation.status,
        progress: generation.progress,
        output: generation.output,
        error: null,
      })
    }
  }

  // Fallback: return DB state
  return NextResponse.json({
    status: generation.status,
    progress: generation.progress,
    output: generation.output,
    error: generation.error,
  })
}
