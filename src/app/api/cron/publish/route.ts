import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'

export const dynamic = 'force-dynamic'

/**
 * GET  /api/cron/publish  — triggered by Vercel cron (daily at 10:00 UTC — Hobby plan backup)
 * POST /api/cron/publish  — triggered by external cron service every hour for precise scheduling
 *
 * External cron setup (cron-job.org — FREE, no account needed):
 *   1. Go to https://cron-job.org → Create free account
 *   2. New cronjob → URL: https://nexus-grow.com/api/cron/publish
 *   3. Schedule: every 60 minutes
 *   4. Request method: POST
 *   5. Headers → Add header: Authorization: Bearer <CRON_SECRET value from Vercel env>
 *   This gives hourly precision on Vercel Hobby plan at zero cost.
 */

// ── Auth helper ────────────────────────────────────────────────
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  // SEC-05 fix: require auth — open only in dev when secret is explicitly not set
  if (!secret) return process.env.NODE_ENV === 'development'

  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true

  // POST: also allow secret in body (fallback for cron services that can't set headers)
  if (req.method === 'POST') {
    try {
      const body = await req.clone().json().catch(() => ({}))
      if ((body as any).secret === secret) return true
    } catch { /* ignore */ }
  }

  return false
}

// ── Core publish logic ─────────────────────────────────────────
async function runPublishJob() {
  const now = new Date()
  console.log('[Cron:publish] Running at', now.toISOString())

  // Find all scheduled posts due for publishing
  const duePosts = await prisma.socialPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    include: { integration: true },
    take: 20,
  })

  console.log(`[Cron:publish] Found ${duePosts.length} posts to publish`)

  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      try {
        // BUG-01 fix: no optimistic write — only write PUBLISHED after platform confirms
        const integration = post.integration
        if (!integration?.accessToken) throw new Error('No access token')

        // Get page-level token from integration config — always decrypt
        const pages: any[] = (integration.config as any)?.pages || []
        const page = pages.find((p: any) => p.id === post.pageId)
        const rawPageToken = page?.accessToken || integration.accessToken
        const pageToken = decryptToken(rawPageToken) ?? rawPageToken

        // Determine platform + sub-platform
        const platformStr = String(post.platform)
        const igAccountId = page?.igAccountId || null
        const isInstagram = !!(igAccountId && post.pageId === igAccountId)

        // ── META (Facebook or Instagram) ──────────────────────────────────
        if (platformStr === 'META' || platformStr === 'FACEBOOK' || platformStr === 'INSTAGRAM') {
          if (isInstagram) {
            // Instagram Graph API: create container then publish
            const containerRes = await fetch(
              `https://graph.facebook.com/v19.0/${post.pageId}/media`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  caption:     post.caption,
                  access_token: pageToken,
                  media_type:  'IMAGE',
                  image_url:   post.imageUrl || 'https://placehold.co/1080x1080/111/FF9500?text=Nexus',
                }),
              }
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
            // Facebook Pages API
            const fbBody: any = { message: post.caption, access_token: pageToken }
            if (post.imageUrl) fbBody.url = post.imageUrl

            const endpoint = post.imageUrl
              ? `https://graph.facebook.com/v19.0/${post.pageId}/photos`
              : `https://graph.facebook.com/v19.0/${post.pageId}/feed`

            const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fbBody) })
            const data = await res.json()
            if (data.error) throw new Error(data.error.message)

            await prisma.socialPost.update({
              where: { id: post.id },
              data: { status: 'PUBLISHED', publishedAt: now, platformPostId: data.id, platformUrl: `https://facebook.com/${data.id}` },
            })
          }

        // ── LINKEDIN ───────────────────────────────────────────────────────
        } else if (platformStr === 'LINKEDIN') {
          const linkedinToken = decryptToken(integration.accessToken) ?? integration.accessToken
          const personId = integration.accountId || ''
          // FLOW-05 fix: use ARTICLE with originalUrl for image posts (not IMAGE + empty media[])
          const liShareContent: any = {
            shareCommentary:    { text: post.caption },
            shareMediaCategory: post.imageUrl ? 'ARTICLE' : 'NONE',
          }
          if (post.imageUrl) {
            liShareContent.media = [{ status: 'READY', originalUrl: post.imageUrl }]
          }
          const liBody: any = {
            author:  `urn:li:person:${personId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: { 'com.linkedin.ugc.ShareContent': liShareContent },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
          }

          const res  = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${linkedinToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(liBody),
          })
          const data = await res.json()
          if (data.status >= 400) throw new Error(data.message || 'LinkedIn publish failed')

          await prisma.socialPost.update({
            where: { id: post.id },
            data: { status: 'PUBLISHED', publishedAt: now, platformPostId: data.id },
          })

        // ── TIKTOK ────────────────────────────────────────────────────────
        } else if (platformStr === 'TIKTOK') {
          if (!post.imageUrl) throw new Error('TikTok requires a video URL')
          const tiktokToken = decryptToken(integration.accessToken) ?? integration.accessToken

          const res  = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method:  'POST',
            headers: { Authorization: `Bearer ${tiktokToken}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              post_info:   { title: post.caption, privacy_level: 'PUBLIC_TO_EVERYONE' },
              source_info: { source: 'PULL_FROM_URL', video_url: post.imageUrl },
            }),
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
        console.error(`[Cron:publish] Failed post ${post.id}:`, err.message)
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'FAILED', errorMessage: err.message },
        }).catch(() => {})
        return { id: post.id, success: false, error: err.message }
      }
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
  const failed    = results.length - succeeded

  console.log(`[Cron:publish] Done — ${succeeded} published, ${failed} failed.`)
  return { processed: results.length, succeeded, failed, timestamp: now.toISOString() }
}

// ── Route handlers ─────────────────────────────────────────────

/** Vercel cron calls GET */
export async function GET(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runPublishJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron:publish] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** External cron services (cron-job.org) call POST */
export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runPublishJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron:publish] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
