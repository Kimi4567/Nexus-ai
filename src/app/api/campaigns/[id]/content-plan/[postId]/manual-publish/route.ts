/**
 * POST /api/campaigns/[id]/content-plan/[postId]/manual-publish
 *
 * Records the user's own confirmation that they published a SCHEDULED + MANUAL post
 * by hand. NEXUS does NOT publish anything to any platform here — there is no social
 * API call. It only:
 *   - SCHEDULED → PUBLISHED (guarded by postStatus; DRAFT/APPROVED rejected),
 *   - sets manuallyPublishedAt = publishedAt = now (publishMode stays MANUAL),
 *   - saves an optional live post URL to platformUrl,
 *   - records PostStatusHistory SCHEDULED → PUBLISHED, actor USER, manual note.
 *
 * AUTO posts are rejected (those publish via the cron, not by hand).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { planManualPublish } from '@/lib/manualPublish'

type Params = { params: { id: string; postId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const post = await (prisma.socialPost as any).findFirst({
      where: { id: params.postId, campaignId: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true, status: true, publishMode: true },
    })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => ({} as any))
    const liveUrl: string | null = typeof body?.liveUrl === 'string' ? body.liveUrl : null

    const plan = planManualPublish(
      { id: post.id, workspaceId: post.workspaceId, status: post.status, publishMode: post.publishMode },
      { liveUrl }
    )
    if (!plan.ok) {
      return NextResponse.json({ error: plan.error }, { status: 400 })
    }

    const updated = await (prisma.socialPost as any).update({
      where: { id: post.id },
      data: plan.update.data,
      select: { id: true, status: true, manuallyPublishedAt: true, publishedAt: true, platformUrl: true, publishMode: true },
    })

    await (prisma as any).postStatusHistory
      .create({ data: plan.history })
      .catch((e: any) => console.error('[manual-publish] history write failed', e?.message))

    return NextResponse.json({
      success: true,
      post: updated,
      // Honest result copy keys the UI can show; NEXUS did NOT auto-publish.
      message: 'Marked as manually published',
    })
  } catch (err: any) {
    console.error('[manual-publish POST]', err)
    return NextResponse.json({ error: 'Failed to mark as manually published' }, { status: 500 })
  }
}
