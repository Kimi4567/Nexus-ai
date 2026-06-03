/**
 * GET /api/campaigns/[id]/video-status
 *
 * Returns the latest COMPLETED video generations for this campaign
 * (both text-to-video and img2video), used by VideoGenerator.tsx to
 * restore the last generated video on component mount.
 *
 * Returns up to 2 records: one per mode (strategy + img2video), so
 * the component can restore each mode's last output independently.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

type Params = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify campaign belongs to user
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspace: { ownerId: userId } },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  try {
    // Fetch latest 10 VIDEO generations for this campaign, completed ones with output
    const generations = await db.generation.findMany({
      where: {
        campaignId: params.id,
        type: 'VIDEO',
        status: 'COMPLETED',
        output: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        output: true,
        prompt: true,
        params: true,
        createdAt: true,
        status: true,
      },
    })

    // Separate into strategy (text2video) and img2video
    const strategyGen = generations.find((g: any) => {
      const p = g.params as any
      return !p?.mode || p?.mode === 'text2video'
    }) || null

    const img2videoGen = generations.find((g: any) => {
      const p = g.params as any
      return p?.mode === 'img2video'
    }) || null

    return NextResponse.json({
      strategy: strategyGen ? {
        generationId: strategyGen.id,
        videoUrl: strategyGen.output,
        createdAt: strategyGen.createdAt,
      } : null,
      img2video: img2videoGen ? {
        generationId: img2videoGen.id,
        videoUrl: img2videoGen.output,
        createdAt: img2videoGen.createdAt,
      } : null,
    })
  } catch {
    // Generation table may not exist yet — return empty gracefully
    return NextResponse.json({ strategy: null, img2video: null })
  }
}
