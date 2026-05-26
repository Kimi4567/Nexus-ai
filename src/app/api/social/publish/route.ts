import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PublishRequest {
  integrationId: string   // which connected account
  pageId: string          // Facebook page ID or IG account ID
  pageName?: string
  caption: string
  imageUrl?: string       // optional image
  link?: string           // optional link
  platform: 'FACEBOOK' | 'INSTAGRAM'
  campaignId?: string
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: PublishRequest = await req.json()
  const { integrationId, pageId, pageName, caption, imageUrl, link, platform, campaignId } = body

  if (!integrationId || !pageId || !caption) {
    return NextResponse.json({ error: 'integrationId, pageId and caption are required' }, { status: 400 })
  }

  const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // Fetch integration & verify ownership
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, workspaceId: workspace.id, status: 'CONNECTED' },
  })
  if (!integration || !integration.accessToken) {
    return NextResponse.json({ error: 'Integration not connected' }, { status: 400 })
  }

  // Find the page-level access token from config
  const pages: any[] = (integration.config as any)?.pages || []
  const page = pages.find(p => p.id === pageId)
  const pageToken = page?.accessToken || integration.accessToken

  let platformPostId: string | null = null
  let platformUrl: string | null = null
  let errorMessage: string | null = null
  let status: 'PUBLISHED' | 'FAILED' = 'PUBLISHED'

  try {
    if (platform === 'FACEBOOK') {
      platformPostId = await publishToFacebook({ pageId, pageToken, caption, imageUrl, link })
      platformUrl = `https://www.facebook.com/${platformPostId}`
    } else if (platform === 'INSTAGRAM') {
      const igAccountId = page?.igAccountId
      if (!igAccountId) throw new Error('No Instagram Business Account linked to this page')
      platformPostId = await publishToInstagram({ igAccountId, pageToken, caption, imageUrl })
      platformUrl = `https://www.instagram.com/p/${platformPostId}`
    }
  } catch (err: any) {
    console.error('[Social Publish] Error:', err)
    status = 'FAILED'
    errorMessage = err.message || 'Publish failed'
  }

  // Record the post — requires `prisma generate` after running social_publishing.sql migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socialPost = await (prisma as any).socialPost.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaignId || null,
      integrationId,
      platform: 'META',
      pageId,
      pageName: pageName || page?.name || null,
      caption,
      imageUrl: imageUrl || null,
      link: link || null,
      platformPostId,
      platformUrl,
      status,
      errorMessage,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  })

  if (status === 'FAILED') {
    return NextResponse.json({ error: errorMessage, socialPost }, { status: 500 })
  }

  return NextResponse.json({ ok: true, socialPost, platformUrl })
}

// ── Facebook Page Post ─────────────────────────────────────────────────────

async function publishToFacebook({
  pageId, pageToken, caption, imageUrl, link,
}: { pageId: string; pageToken: string; caption: string; imageUrl?: string; link?: string }) {
  let url: string
  let body: Record<string, string>

  if (imageUrl) {
    // Photo post
    url = `https://graph.facebook.com/v19.0/${pageId}/photos`
    body = { caption, url: imageUrl, access_token: pageToken }
  } else {
    // Text/link post
    url = `https://graph.facebook.com/v19.0/${pageId}/feed`
    body = { message: caption, access_token: pageToken }
    if (link) body.link = link
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()

  if (data.error) throw new Error(`Facebook API: ${data.error.message}`)
  return data.id as string
}

// ── Instagram Business Post ────────────────────────────────────────────────

async function publishToInstagram({
  igAccountId, pageToken, caption, imageUrl,
}: { igAccountId: string; pageToken: string; caption: string; imageUrl?: string }) {
  if (!imageUrl) throw new Error('Instagram requires an image URL')

  // Step 1: create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: pageToken,
      }),
    }
  )
  const containerData = await containerRes.json()
  if (containerData.error) throw new Error(`IG container: ${containerData.error.message}`)

  const containerId = containerData.id

  // Step 2: publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: pageToken,
      }),
    }
  )
  const publishData = await publishRes.json()
  if (publishData.error) throw new Error(`IG publish: ${publishData.error.message}`)

  return publishData.id as string
}
