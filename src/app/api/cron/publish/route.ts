import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

        // Get page token from integration config
        const pages: any[] = (integration.config as any)?.pages || []
        const page = pages.find((p: any) => p.id === post.pageId)
        const pageToken = page?.accessToken || integration.accessToken

        // Publish to Meta (Facebook/Instagram)
        const platformStr = String(post.platform)
        if (platformStr === 'FACEBOOK') {
          const body: any = { message: post.caption, access_token: pageToken }
          if (post.imageUrl) {
            body.url = post.imageUrl
          }
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
        } else if (platformStr === 'INSTAGRAM') {
          // Step 1: Create media container
          const igAccountId = post.pageId
          const containerBody: any = {
            caption: post.caption,
            access_token: pageToken,
          }
          if (post.imageUrl) {
            containerBody.image_url = post.imageUrl
            containerBody.media_type = 'IMAGE'
          } else {
            containerBody.media_type = 'IMAGE'
            containerBody.image_url = 'https://placehold.co/1080x1080/111/6366f1?text=Nexus'
          }

          const containerRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(containerBody) }
          )
          const container = await containerRes.json()
          if (container.error) throw new Error(container.error.message)

          // Step 2: Publish container
          const publishRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
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
            data: {
              status: 'PUBLISHED',
              publishedAt: now,
              platformPostId: published.id,
            },
          })
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
