import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthError } from '@/lib/cronAuth'
import { decryptToken } from '@/lib/tokenCrypto'
import { fetchTikTokPublishStatus } from '@/lib/tiktokPublishing'
import { buildLearningEvent } from '@/lib/brandBrainEvents'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function failProcessingPost(post: any, reason: string): Promise<void> {
  const failedEvent = buildLearningEvent({
    workspaceId: post.workspaceId,
    campaignId: post.campaignId,
    socialPostId: post.id,
    from: 'PROCESSING',
    to: 'FAILED',
    actor: 'CRON',
    publishMode: 'AUTO',
    platform: 'TIKTOK',
    scheduledAt: post.scheduledAt,
  })
  await prisma.$transaction([
    prisma.socialPost.update({
      where: { id: post.id },
      data: { status: 'FAILED', errorMessage: reason.slice(0, 500) },
    }),
    prisma.postStatusHistory.create({
      data: {
        socialPostId: post.id,
        workspaceId: post.workspaceId,
        fromStatus: 'PROCESSING',
        toStatus: 'FAILED',
        actor: 'CRON',
        note: `[TIKTOK_FAILED] ${reason}`.slice(0, 500),
      },
    }),
    ...(failedEvent ? [prisma.marketingLearningEvent.create({ data: failedEvent as any })] : []),
  ])
}

async function run() {
  const posts = await prisma.socialPost.findMany({
    where: {
      status: 'PROCESSING',
      publishTarget: 'TIKTOK',
      platformPostId: { not: null },
      integrationId: { not: null },
    },
    include: { integration: true },
    orderBy: { publishAttemptedAt: 'asc' },
    take: 30,
  })
  let published = 0
  let failed = 0
  let pending = 0

  for (const post of posts) {
    const token = post.integration?.accessToken ? decryptToken(post.integration.accessToken) : null
    if (!token || !post.platformPostId) {
      await failProcessingPost(post, 'TikTok reconciliation token is unavailable')
      failed++
      continue
    }
    try {
      const result = await fetchTikTokPublishStatus(token, post.platformPostId)
      if (result.complete) {
        const publicPostId = result.publicPostIds[0] || post.platformPostId
        const publishedAt = new Date()
        const learningEvent = buildLearningEvent({
          workspaceId: post.workspaceId,
          campaignId: post.campaignId,
          socialPostId: post.id,
          from: 'PROCESSING',
          to: 'PUBLISHED',
          actor: 'CRON',
          publishMode: 'AUTO',
          platform: 'TIKTOK',
          scheduledAt: post.scheduledAt,
          publishedAt,
        })
        await prisma.$transaction([
          prisma.socialPost.update({
            where: { id: post.id },
            data: {
              status: 'PUBLISHED',
              publishedAt,
              platformPostId: publicPostId,
              errorMessage: null,
            },
          }),
          prisma.postStatusHistory.create({
            data: {
              socialPostId: post.id,
              workspaceId: post.workspaceId,
              fromStatus: 'PROCESSING',
              toStatus: 'PUBLISHED',
              actor: 'CRON',
              note: `[TIKTOK_CONFIRMED] ${result.status}`,
            },
          }),
          ...(learningEvent ? [prisma.marketingLearningEvent.create({ data: learningEvent as any })] : []),
        ])
        published++
      } else if (result.failed) {
        const reason = result.failReason || 'TikTok processing failed'
        await failProcessingPost(post, reason)
        failed++
      } else {
        pending++
      }
    } catch (error) {
      // Provider/network failures are retried by the next reconciliation run;
      // they are not evidence that the post itself failed.
      const attemptedAt = post.publishAttemptedAt ? new Date(post.publishAttemptedAt).getTime() : 0
      const timedOut = attemptedAt > 0 && attemptedAt <= Date.now() - 24 * 60 * 60 * 1000
      if (timedOut) {
        await failProcessingPost(post, 'TikTok did not confirm publication within 24 hours; review the platform before retrying')
        failed++
      } else {
        pending++
        console.warn('[Cron:reconcile-social-publishing]', post.id, error)
      }
    }
  }
  return { processed: posts.length, published, failed, pending }
}

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError
  return NextResponse.json({ ok: true, ...(await run()) })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
