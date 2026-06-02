import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'

// Vercel cron — runs every hour
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/publish", "schedule": "0 * * * *" }] }

export async function GET(req: NextRequest) {
  // Verify this is a legitimate cron call
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  console.log('[Cron] Running publish job at', now.toISOString())

  // Find all scheduled posts due for publishing
  const duePosts = await prisma.socialPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    include: { integration: true },
    take: 20,
  })

  console.log(`[Cron] Found ${duePosts.length} posts to publish`)

  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      try {
        // Mark as processing first
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'PUBLISHED' }, // optimistic update
        })

        const integration = post.integration
        if (!integration?.accessToken) throw new Error('No access token')

        // Get page token from integration config — decrypt before use
        const pages: any[] = (integration.config as any)?.pages || []
        const page = pages.find((p: any) => p.id === post.pageId)
        const rawPageToken = page?.accessToken || integration.accessToken
        const pageToken = decryptToken(rawPageToken) ?? rawPageToken

        // Determine platform: SocialPost.platform uses IntegrationType (META/LINKEDIN/TIKTOK)
        // For META posts, check if the page has an igAccountId → Instagram, else → Facebook
        const platformStr = String(post.platform)
        const igAccountId = page?.igAccountId || null
        const isInstagram = !!(igAccountId && post.pageId === igAccountId)

        if (platformStr === 'META' || platformStr === 'FACEBOOK' || platformStr === 'INSTAGRAM') {
          if (isInstagram) {
            // ── Instagram publish ────────────────────────────────────────────
            const containerBody: any = {
              caption: post.caption,
              access_token: pageToken,
              media_type: 'IMAGE',
              image_url: post.imageUrl || 'https://placehold.co/1080x1080/111/FF9500?text=Nexus',
            }

            const containerRes = await fetch(
              `https://graph.facebook.com/v19.0/${post.pageId}/media`,
              { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(containerBody) }
            )
            const container = await containerRes.json()
            if (container.error) throw new Error(container.error.message)

            const publishRes = await fetch(
              `https://graph.facebook.com/v19.0/${post.pageId}/media_publish`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creation_id: container.id, access_token: pageToken }),
              }
            )
            const published = await publishRes.json()
            if (published.error) throw new Error(published.error.message)

            await prisma.socialPost.update({
              where: { id: post.id },
              data: { status: 'PUBLISHED', publishedAt: now, platformPostId: published.id },
            })
          } else {
            // ── Facebook publish ─────────────────────────────────────────────
            const body: any = { message: post.caption, access_token: pageToken }
            if (post.imageUrl) body.url = post.imageUrl
            const endpoint = post.imageUrl
              ? `https://graph.facebook.com/v19.0/${post.pageId}/photos`
              : `https://graph.facebook.com/v19.0/${post.pageId}/feed`

            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error.message)

            await prisma.socialPost.update({
              where: { id: post.id },
              data: {
                status: 'PUBLISHED',
                publishedAt: now,
                platformPostId: data.id,
                platformUrl: `https://facebook.com/${data.id}`,
              },
            })
          }
        } else if (platformStr === 'LINKEDIN') {
          // ── LinkedIn publish ─────────────────────────────────────────────
          const linkedinToken = decryptToken(integration.accessToken) ?? integration.accessToken
          const personId = integration.accountId || ''
          const body: any = {
            author: `urn:li:person:${personId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: post.caption },
                shareMediaCategory: post.imageUrl ? 'IMAGE' : 'NONE',
              },
            },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
          }
          const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${linkedinToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (data.status >= 400) throw new Error(data.message || 'LinkedIn publish failed')
          await prisma.socialPost.update({
            where: { id: post.id },
            data: { status: 'PUBLISHED', publishedAt: now, platformPostId: data.id },
          })
        } else if (platformStr === 'TIKTOK') {
          // TikTok requires a video URL — skip image-only posts
          if (!post.imageUrl) throw new Error('TikTok requires a video URL')
          const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: { Authorization: `Bearer ${decryptToken(integration.accessToken) ?? integration.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_info: { title: post.caption, privacy_level: 'PUBLIC_TO_EVERYONE' }, source_info: { source: 'PULL_FROM_URL', video_url: post.imageUrl } }),
          })
          const data = await res.json()
          if (data.error?.code !== 'ok') throw new Error(data.error?.message || 'TikTok publish failed')
          await prisma.socialPost.update({
            where: { id: post.id },
            data: { status: 'PUBLISHED', publishedAt: now, platformPostId: data.data?.publish_id },
          })
        } else {
          throw new Error(`Unsupported platform: ${platformStr}`)
        }

        return { id: post.id, success: true }
      } catch (err: any) {
        console.error(`[Cron] Failed to publish post ${post.id}:`, err.message)
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'FAILED', errorMessage: err.message },
        }).catch(() => {})
        return { id: post.id, success: false, error: err.message }
      }
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
  const failed = results.length - succeeded

  console.log(`[Cron] Done. ${succeeded} published, ${failed} failed.`)
  return NextResponse.json({ processed: results.length, succeeded, failed })
}
