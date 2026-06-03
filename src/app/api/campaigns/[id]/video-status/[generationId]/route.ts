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
import { generateVoiceover } from '@/lib/ai/ttsGen'
import { mergeVideoAudio, isCloudinaryVideoAvailable } from '@/lib/cloudinaryVideo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// Allow up to 60s — TTS + Cloudinary upload can take 20–40s
export const maxDuration = 60

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

      // On success: auto-generate TTS voiceover + merge with video, then save to Media
      if (nexusStatus === 'COMPLETED' && videoUrl) {
        // ── Guard against duplicate TTS processing (concurrent polls) ──────────
        // If audioReady is already 'done' or 'pending', skip TTS
        const meta = generation.metadata as Record<string, unknown> | null
        const audioReady = meta?.audioReady as string | undefined

        let finalVideoUrl = videoUrl

        if (!audioReady) {
          // Mark TTS as in-progress BEFORE starting (prevents duplicate runs)
          await db.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              progress: 100,
              output: videoUrl, // silent video as fallback
              metadata: { ...(meta || {}), audioReady: 'pending', replicatePredictionId: (meta as any)?.replicatePredictionId },
            },
          })

          // ── Auto TTS + audio merge (strategy mode only — img2video has no script) ─
          const script = (generation.params as any)?.script as string | null
          const durationSeconds = (generation.params as any)?.durationSeconds as number || 5
          const mode = (generation.params as any)?.mode as string

          if (script && mode !== 'img2video' && isCloudinaryVideoAvailable()) {
            try {
              console.log('[video-status] Generating TTS voiceover…')
              const audioBuffer = await generateVoiceover(script)

              if (audioBuffer) {
                console.log('[video-status] Merging audio with video on Cloudinary…')
                finalVideoUrl = await mergeVideoAudio(videoUrl, audioBuffer, generation.id, durationSeconds)
                console.log('[video-status] Merged video URL ready:', finalVideoUrl.slice(0, 80))
              }
            } catch (ttsErr) {
              console.error('[video-status] TTS/merge failed — falling back to silent video:', ttsErr)
              // Non-fatal: user still gets the silent video
            }
          }

          // Update generation record with final URL (merged or silent)
          updateData.output = finalVideoUrl
          updateData.metadata = { ...(meta || {}), audioReady: 'done', replicatePredictionId: (meta as any)?.replicatePredictionId }
        } else if (audioReady === 'pending') {
          // Another request is already processing TTS — return current state
          return NextResponse.json({
            status: 'COMPLETED',
            progress: 100,
            output: generation.output || videoUrl,
            error: null,
            audioProcessing: true,
          })
        } else {
          // audioReady === 'done' — already processed, use cached output
          finalVideoUrl = generation.output || videoUrl
          updateData.output = finalVideoUrl
        }

        // ── Save to Media Library ─────────────────────────────────────────────
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
                url: finalVideoUrl,
                size: 0,
                category: 'generated',
                tags: ['ai-generated', 'replicate', ...(finalVideoUrl !== videoUrl ? ['voiceover'] : [])],
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
            description: finalVideoUrl !== videoUrl
              ? 'Video + AI voiceover generated — saved to Media Library'
              : 'Video generation completed — saved to Media Library',
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
        output: updateData.output ?? videoUrl,
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
