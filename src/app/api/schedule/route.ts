import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'

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
        status: { in: ['SCHEDULED', 'DRAFT', 'PUBLISHED', 'FAILED'] },
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

// POST — schedule a new post
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { integrationId, pageId, pageName, caption, imageUrl, platform, campaignId, scheduledAt } = body

    if (!integrationId || !pageId || !caption || !scheduledAt) {
      return NextResponse.json(
        { error: 'integrationId, pageId, caption, and scheduledAt are required' },
        { status: 400 }
      )
    }

    const scheduledDate = new Date(scheduledAt)
    if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'A valid future schedule time is required' },
        { status: 400 }
      )
    }

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const integration = await prisma.integration.findFirst({
      where: { id: integrationId, workspaceId: workspace.id },
    })
    if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })

    const post = await prisma.socialPost.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaignId || null,
        integrationId,
        platform: platform as any,
        pageId,
        pageName: pageName || '',
        caption,
        imageUrl: imageUrl || null,
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
      },
    })

    return NextResponse.json({ post })
  } catch (err: any) {
    console.error('[Schedule POST] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 })
  }
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
      select: { id: true, status: true },
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

    await prisma.socialPost.delete({ where: { id: post.id } })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Schedule DELETE] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
