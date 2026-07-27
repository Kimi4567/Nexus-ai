import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { buildStatusHistory } from '@/lib/postStatus'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await adminClient.auth.getUser(token)
  return user || null
}

// GET — list all scheduled posts for this user
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ posts: [] })

    // Ordering:
    //  - default `scheduledAt asc` keeps the calendar's "earliest upcoming first" behaviour.
    //  - `?order=recent` orders by createdAt desc so MANUALLY published posts
    //    (which have scheduledAt = null and would otherwise sort last / fall outside
    //    the take cap) surface at the top of the post-history list.
    const order = new URL(req.url).searchParams.get('order')
    const orderBy = order === 'recent'
      ? ({ createdAt: 'desc' } as const)
      : ({ scheduledAt: 'asc' } as const)

    const posts = await prisma.socialPost.findMany({
      where: {
        workspaceId: workspace.id,
        status: { in: ['SCHEDULED', 'PROCESSING', 'DRAFT', 'APPROVED', 'PUBLISHED', 'FAILED'] },
      },
      orderBy,
      take: 50,
    })

    return NextResponse.json({ posts })
  } catch (err: any) {
    console.error('[Schedule GET] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to fetch scheduled posts' }, { status: 500 })
  }
}

// POST — legacy free-form scheduling is deliberately closed. Scheduling must
// start from an approved, media-ready campaign post in Content Hub so Brand
// Brain, review history, and execution gates cannot be bypassed.
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    error: 'Free-form scheduling is no longer supported. Approve copy, confirm media, and schedule the campaign post from Content Hub.',
    code: 'CONTENT_HUB_SCHEDULING_REQUIRED',
    href: '/content-hub',
  }, { status: 410 })
}

// DELETE — cancel a scheduled post
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('id')
    if (!postId) return NextResponse.json({ error: 'Post ID required' }, { status: 400 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, workspaceId: workspace.id },
      select: {
        id: true,
        status: true,
        workspaceId: true,
        campaignId: true,
        updatedAt: true,
      },
    })
    if (!post) return NextResponse.json({ error: 'Scheduled record not found' }, { status: 404 })

    if (post.status !== 'SCHEDULED' && post.status !== 'FAILED') {
      return NextResponse.json({
        error: 'Published posts and review records are retained as immutable history. Only scheduled or failed records can be removed here.',
        mode: 'history_retained',
      }, { status: 409 })
    }

    const expectedConfirmation = post.status === 'FAILED'
      ? 'dismiss_failed_record'
      : 'cancel_scheduled_post'
    if (req.headers.get('x-nexus-confirm-operation') !== expectedConfirmation) {
      return NextResponse.json({
        error: post.status === 'FAILED'
          ? 'Explicit failed-record dismissal confirmation is required.'
          : 'Explicit schedule cancellation confirmation is required.',
        mode: 'confirmation_required',
      }, { status: 400 })
    }

    if (post.status === 'SCHEDULED') {
      const result = await prisma.$transaction(async tx => {
        const changed = await tx.socialPost.updateMany({
          where: {
            id: post.id,
            workspaceId: workspace.id,
            status: 'SCHEDULED',
            publishedAt: null,
            updatedAt: post.updatedAt,
          },
          data: {
            status: 'APPROVED',
            publishMode: 'MANUAL',
            scheduledSnapshotId: null,
            integrationId: null,
            pageId: null,
            pageName: null,
            platformOptions: Prisma.DbNull,
            autoPublishConsentAt: null,
            publishAttemptedAt: null,
            publishLeaseUntil: null,
            publishLeaseToken: null,
            platformPostId: null,
            platformUrl: null,
          },
        })
        if (changed.count !== 1) throw new Error('SCHEDULE_CANCEL_CONCURRENT_CHANGE')

        await tx.postStatusHistory.create({
          data: buildStatusHistory({
            socialPostId: post.id,
            workspaceId: post.workspaceId,
            fromStatus: 'SCHEDULED',
            toStatus: 'APPROVED',
            actor: 'USER',
            note: 'cancel_schedule',
          }),
        })
        return changed
      })

      return NextResponse.json({
        success: true,
        reverted: result.count,
        status: 'APPROVED',
        mode: 'schedule_cancelled',
      })
    }

    // Failed execution records are the only records this endpoint actually
    // dismisses. Scheduled campaign content is retained and returned to review.
    await prisma.socialPost.delete({ where: { id: post.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof Error && err.message === 'SCHEDULE_CANCEL_CONCURRENT_CHANGE') {
      return NextResponse.json({
        error: 'The scheduled post changed while it was being cancelled. Reload before trying again.',
        code: 'SCHEDULE_CANCEL_CONCURRENT_CHANGE',
      }, { status: 409 })
    }
    console.error('[Schedule DELETE] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
