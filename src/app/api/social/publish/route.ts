import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { adminClient } from '@/lib/supabaseAuth'

interface PublishRequest {
  integrationId: string   // which connected account
  pageId: string          // Facebook page ID, IG account ID, or LinkedIn person URN
  pageName?: string
  caption: string
  imageUrl?: string       // optional image
  link?: string           // optional link
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK'
  campaignId?: string
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await adminClient.auth.getUser(token)
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

  // Find the page-level access token from config — decrypt before use
  const pages: any[] = (integration.config as any)?.pages || []
  const page = pages.find(p => p.id === pageId)
  const rawPageToken = page?.accessToken || integration.accessToken
  const pageToken = decryptToken(rawPageToken) ?? rawPageToken

  let platformPostId: string | null = null
  let platformUrl: string | null = null
  let errorMessage: string | null = null
  let status: 'PUBLISHED' | 'FAILED' = 'PUBLISHED'

  // For LinkedIn, use the integration's access token directly (no page-level token)
  const rawIntegrationToken = integration.accessToken
  const linkedinToken = decryptToken(rawIntegrationToken) ?? rawIntegrationToken
  const publishToken = platform === 'LINKEDIN' ? linkedinToken : pageToken

  try {
    if (platform === 'FACEBOOK') {
      platformPostId = await publishToFacebook({ pageId, pageToken: publishToken, caption, imageUrl, link })
      platformUrl = `https://www.facebook.com/${platformPostId}`
    } else if (platform === 'INSTAGRAM') {
      const igAccountId = page?.igAccountId
      if (!igAccountId) throw new Error('No Instagram Business Account linked to this page')
      platformPostId = await publishToInstagram({ igAccountId, pageToken: publishToken, caption, imageUrl })
      platformUrl = `https://www.instagram.com/p/${platformPostId}`
    } else if (platform === 'LINKEDIN') {
      // pageId is the LinkedIn person URN for personal posts
      const personId = (integration.config as any)?.personId || pageId
      platformPostId = await publishToLinkedIn({ personId, accessToken: publishToken, caption, imageUrl, link })
      platformUrl = `https://www.linkedin.com/feed/update/urn:li:share:${platformPostId}`
    } else if (platform === 'TIKTOK') {
      if (!imageUrl) throw new Error('TikTok requires a video URL')
      platformPostId = await publishToTikTok({ accessToken: publishToken, caption, videoUrl: imageUrl })
      platformUrl = `https://www.tiktok.com/@${integration.accountName}`
    }
  } catch (err: any) {
    console.error('[Social Publish] Error:', err)
    status = 'FAILED'
    errorMessage = err.message || 'Publish failed'
  }

  // Determine DB platform value — maps to IntegrationType enum
  const dbPlatform =
    platform === 'LINKEDIN' ? 'LINKEDIN' :
    platform === 'TIKTOK'   ? 'TIKTOK'   :
    'META' // FACEBOOK or INSTAGRAM both belong to META integration

  // Record the post — requires `prisma generate` after running social_publishing.sql migration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socialPost = await (prisma as any).socialPost.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaignId || null,
      integrationId,
      platform: dbPlatform,
      pageId,
      pageName: pageName || page?.name || integration.accountName || null,
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

// ── LinkedIn UGC Post ──────────────────────────────────────────────────────

async function publishToLinkedIn({
  personId, accessToken, caption, imageUrl, link,
}: { personId: string; accessToken: string; caption: string; imageUrl?: string; link?: string }) {
  // LinkedIn UGC Posts API — personal post on member's feed
  // author uses URN format: urn:li:person:{id}
  const authorUrn = personId.startsWith('urn:li:') ? personId : `urn:li:person:${personId}`

  let specificContent: object

  if (imageUrl) {
    // Article post with image preview (no binary upload needed)
    specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'ARTICLE',
        media: [{
          status: 'READY',
          originalUrl: imageUrl,
          title: { text: caption.slice(0, 200) },
        }],
      },
    }
  } else if (link) {
    // Article post with link
    specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'ARTICLE',
        media: [{
          status: 'READY',
          originalUrl: link,
        }],
      },
    }
  } else {
    // Text-only post
    specificContent = {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'NONE',
      },
    }
  }

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent,
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok || data.status === 422 || data.serviceErrorCode) {
    throw new Error(`LinkedIn API: ${data.message || data.status || 'Post failed'}`)
  }

  // LinkedIn returns the post ID in the 'id' field (e.g. "urn:li:ugcPost:123456")
  const postId = (data.id as string)?.split(':').pop() || data.id
  return postId as string
}

// ── TikTok Video Post ──────────────────────────────────────────────────────

async function publishToTikTok({
  accessToken, caption, videoUrl,
}: { accessToken: string; caption: string; videoUrl: string }) {
  // TikTok Content Posting API — pull video from URL (updated to v2 endpoint)
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json; charset=UTF-8',
      Authorization:   `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      post_info: {
        title:                   caption.slice(0, 2200),
        privacy_level:           'PUBLIC_TO_EVERYONE',
        disable_duet:            false,
        disable_comment:         false,
        disable_stitch:          false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source:    'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  })

  const initData = await initRes.json()

  if (!initRes.ok || initData.error?.code !== 'ok') {
    throw new Error(`TikTok API: ${initData.error?.message || initData.error?.code || 'Post failed'}`)
  }

  const publishId = initData.data?.publish_id as string
  return publishId
}
