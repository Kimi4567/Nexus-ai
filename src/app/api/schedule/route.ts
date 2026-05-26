import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user || null
}

// GET — list all scheduled posts for this user
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
  if (!workspace) return NextResponse.json({ posts: [] })

  const posts = await prisma.socialPost.findMany({
    where: {
      workspaceId: workspace.id,
      status: { in: ['SCHEDULED', 'DRAFT', 'PUBLISHED', 'FAILED'] },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  })

  return NextResponse.json({ posts })
}

// POST — schedule a new post
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { integrationId, pageId, pageName, caption, imageUrl, platform, campaignId, scheduledAt } = body

  if (!integrationId || !pageId || !caption || !scheduledAt) {
    return NextResponse.json({ error: 'integrationId, pageId, caption, and scheduledAt are required' }, { status: 400 })
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
      scheduledAt: new Date(scheduledAt),
    },
  })

  return NextResponse.json({ post })
}

// DELETE — cancel a scheduled post
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const postId = searchParams.get('id')
  if (!postId) return NextResponse.json({ error: 'Post ID required' }, { status: 400 })

  const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.socialPost.deleteMany({
    where: { id: postId, workspaceId: workspace.id },
  })

  return NextResponse.json({ success: true })
}
