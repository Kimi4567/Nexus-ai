/**
 * PATCH /api/campaigns/[id]/content-plan/[postId]
 * Update a single content plan post (caption, imagePrompt, mediaSource, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: { id: string; postId: string } }

const ALLOWED_FIELDS = [
  'caption', 'imagePrompt', 'videoPrompt', 'mediaSource',
  'uploadedMediaId', 'imageUrl', 'generationStatus', 'scheduledAt',
] as const

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Verify ownership
    const post = await prisma.socialPost.findFirst({
      where: {
        id: params.postId,
        campaignId: params.id,
        workspace: { ownerId: userId },
      },
    })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, any> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body) data[field] = body[field]
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await (prisma.socialPost as any).update({
      where: { id: params.postId },
      data,
      select: {
        id: true,
        caption: true,
        imagePrompt: true,
        imageUrl: true,
        mediaSource: true,
        generationStatus: true,
      },
    })

    return NextResponse.json({ post: updated })
  } catch (err: any) {
    console.error('[content-plan/[postId] PATCH]', err)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
