/**
 * PATCH /api/campaigns/[id]/content-plan/[postId]
 * Update a single content plan post (caption, imagePrompt, mediaSource, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
  getMediaAttachmentConfirmationError,
  isMediaAllowedForPost,
  isMediaAttachmentConfirmationComplete,
} from '@/lib/contentHubMediaAttachment'

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

    if ('uploadedMediaId' in body) {
      if (body.uploadedMediaId === null) {
        if (!isMediaAttachmentConfirmationComplete({
          action: 'remove',
          explicitMediaRemoveConfirmed: body.explicitMediaRemoveConfirmed,
        })) {
          return NextResponse.json({ error: getMediaAttachmentConfirmationError('remove') }, { status: 400 })
        }

        data.uploadedMediaId = null
        data.imageUrl = null
        data.mediaSource = 'GENERATE'
        data.generationStatus = 'PENDING'
      } else if (typeof body.uploadedMediaId === 'string' && body.uploadedMediaId.trim()) {
        const action = post.imageUrl || post.uploadedMediaId ? 'replace' : 'attach'
        if (!isMediaAttachmentConfirmationComplete({
          action,
          explicitMediaAttachConfirmed: body.explicitMediaAttachConfirmed,
          explicitMediaReplaceConfirmed: body.explicitMediaReplaceConfirmed,
        })) {
          return NextResponse.json({ error: getMediaAttachmentConfirmationError(action) }, { status: 400 })
        }

        const media = await prisma.media.findUnique({
          where: { id: body.uploadedMediaId },
          select: {
            id: true,
            workspaceId: true,
            campaignId: true,
            url: true,
          },
        })

        if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })
        if (!isMediaAllowedForPost({
          mediaWorkspaceId: media.workspaceId,
          postWorkspaceId: post.workspaceId,
          mediaCampaignId: media.campaignId,
          campaignId: params.id,
        })) {
          return NextResponse.json({ error: 'Media does not belong to this workspace or campaign' }, { status: 403 })
        }

        data.uploadedMediaId = media.id
        data.imageUrl = media.url
        data.mediaSource = CONTENT_HUB_UPLOADED_MEDIA_SOURCE
        data.generationStatus = 'DONE'
      } else {
        return NextResponse.json({ error: 'Invalid uploadedMediaId' }, { status: 400 })
      }
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
        uploadedMediaId: true,
        generationStatus: true,
      },
    })

    return NextResponse.json({ post: updated })
  } catch (err: any) {
    console.error('[content-plan/[postId] PATCH]', err)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
