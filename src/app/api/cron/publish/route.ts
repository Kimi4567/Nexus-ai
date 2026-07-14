import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { autoPublishWhere, skippedManualWhere, isAutoPublishEligible } from '@/lib/publishGate'
import { cronAuthError } from '@/lib/cronAuth'
import { isRetryableSocialPublishError, publishSocialPost } from '@/lib/socialPublishers'
import { hasVerifiedProviderScope, X_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'
import { buildLearningEvent } from '@/lib/brandBrainEvents'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'
import { reviewContentPostForPublishing } from '@/lib/contentPlanApprovalGuard'
import { YOUTUBE_READ_SCOPE, YOUTUBE_UPLOAD_SCOPE } from '@/lib/youtubePublishing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET  /api/cron/publish  — triggered by Vercel cron every hour at minute 5.
 * POST /api/cron/publish  — authenticated manual/backup trigger using the same job.
 *
 * This is hourly scheduling, not real-time delivery. The UI must never promise
 * minute-level publishing precision.
 */

// ── Core publish logic ─────────────────────────────────────────
async function runPublishJob() {
  const now = new Date()
  console.log('[Cron:publish] Running at', now.toISOString())

  // ── PUBLISH SAFETY GATE (PR 3) ───────────────────────────────────────────────
  // Only auto-publish posts the user explicitly opted into automatic publishing
  // (publishMode = AUTO). MANUAL posts (the default) and legacy rows are NEVER
  // auto-published — even when SCHEDULED and past due. This is enforced at TWO
  // layers: the DB query below, and a defensive in-code filter, so a manual post
  // can never reach the publishing code through either path.
  const duePosts = (await prisma.socialPost.findMany({
    where: autoPublishWhere(now) as any,
    include: {
      integration: true,
      statusHistory: {
        where: { actor: 'CRON', toStatus: 'SCHEDULED', note: { startsWith: '[PUBLISH_RETRY]' } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
    take: 20,
  })).filter((p: any) => isAutoPublishEligible(p, now))

  // Safe, server-side-only observability (never surfaced to users as a metric).
  const skippedManualCount = await prisma.socialPost
    .count({ where: skippedManualWhere(now) as any })
    .catch(() => 0)
  const autoEligibleCount = duePosts.length

  console.log(`[Cron:publish] AUTO-eligible: ${autoEligibleCount} · skipped (manual/legacy, untouched): ${skippedManualCount}`)

  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      let providerResult: Awaited<ReturnType<typeof publishSocialPost>> | null = null
      try {
        // BUG-01 fix: no optimistic write — only write PUBLISHED after platform confirms
        const integration = post.integration
        if (!integration?.accessToken) throw new Error('No access token')
        if (!isContentPostMediaReadyForScheduling(post)) {
          throw new Error('CONTENT_REVIEW_REQUIRED: scheduled media is no longer ready for publishing')
        }
        const publishReview = reviewContentPostForPublishing(post)
        if (publishReview.length > 0) {
          throw new Error(`CONTENT_REVIEW_REQUIRED: ${publishReview.map(issue => issue.reason).join(', ')}`)
        }
        const rawTarget = String(post.publishTarget || post.platform).toUpperCase()
        const target = rawTarget === 'YOUTUBE_SHORTS'
          ? 'YOUTUBE'
          : rawTarget === 'TWITTER'
            ? 'X'
            : rawTarget
        if (target === 'X' && post.isVideoPost) {
          throw new Error('X_VIDEO_NOT_SUPPORTED: scheduled X publishing supports reviewed text and images only')
        }
        const requiredScopes = target === 'FACEBOOK'
          ? ['pages_manage_posts']
          : target === 'INSTAGRAM'
            ? ['instagram_content_publish']
            : target === 'LINKEDIN'
              ? [post.pageId ? 'w_organization_social' : 'w_member_social']
              : target === 'TIKTOK'
                ? ['video.publish']
                : target === 'X'
                  ? [...X_CONTENT_SCOPES]
                  : [YOUTUBE_UPLOAD_SCOPE]
        const missingScope = requiredScopes.find(scope => !hasVerifiedProviderScope(integration.config, scope))
        if (missingScope) {
          throw new Error(`Verified ${missingScope} permission is unavailable; reconnect before publishing`)
        }
        if (target === 'YOUTUBE' && !hasVerifiedProviderScope(integration.config, YOUTUBE_READ_SCOPE)) {
          throw new Error(`Verified ${YOUTUBE_READ_SCOPE} permission is unavailable; reconnect before publishing`)
        }

        // Resolve a page-level token where Meta supplied one. Match either the
        // Facebook Page ID or its linked Instagram account ID.
        const pages: any[] = (integration.config as any)?.pages || []
        const page = pages.find((p: any) => p.id === post.pageId || p.igAccountId === post.pageId)
        const rawPageToken = page?.accessToken || integration.accessToken
        const accessToken = decryptToken(rawPageToken) ?? rawPageToken
        providerResult = await publishSocialPost({
          platform: target,
          caption: post.caption,
          imageUrl: post.imageUrl,
          pageId: post.pageId,
          accountId: integration.accountId,
          accessToken,
          integrationConfig: integration.config as Record<string, unknown> | null,
          platformOptions: post.platformOptions as Record<string, unknown> | null,
        })

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown publishing failure'
        const previousRetries = Array.isArray((post as any).statusHistory) ? (post as any).statusHistory.length : 0
        const shouldRetry = isRetryableSocialPublishError(err) && previousRetries < 2
        console.error(`[Cron:publish] Provider failed for ${post.id}:`, message)

        if (shouldRetry) {
          await prisma.socialPost.update({
            where: { id: post.id },
            data: { errorMessage: message },
          }).catch(() => {})
          await prisma.postStatusHistory.create({
            data: {
              socialPostId: post.id,
              workspaceId: post.workspaceId,
              fromStatus: 'SCHEDULED',
              toStatus: 'SCHEDULED',
              actor: 'CRON',
              note: `[PUBLISH_RETRY] ${message}`.slice(0, 500),
            },
          }).catch(() => {})
          return { id: post.id, success: false, retryScheduled: true, error: message }
        }

        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'FAILED', errorMessage: message },
        }).catch(() => {})
        await prisma.postStatusHistory.create({
          data: {
            socialPostId: post.id,
            workspaceId: post.workspaceId,
            fromStatus: 'SCHEDULED',
            toStatus: 'FAILED',
            actor: 'CRON',
            note: `[PUBLISH_FAILED] ${message}`.slice(0, 500),
          },
        }).catch(() => {})
        const failedEvent = buildLearningEvent({
          workspaceId: post.workspaceId,
          campaignId: post.campaignId,
          socialPostId: post.id,
          from: 'SCHEDULED',
          to: 'FAILED',
          actor: 'CRON',
          publishMode: 'AUTO',
          platform: String(post.publishTarget || post.platform),
          scheduledAt: post.scheduledAt,
        })
        if (failedEvent) await prisma.marketingLearningEvent.create({ data: failedEvent as any }).catch(() => {})
        return { id: post.id, success: false, retryScheduled: false, error: message }
      }

      try {
        const processing = providerResult.state === 'PROCESSING'
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: processing ? 'PROCESSING' : 'PUBLISHED',
            publishedAt: processing ? null : now,
            publishAttemptedAt: now,
            platformPostId: providerResult.platformPostId,
            platformUrl: providerResult.platformUrl ?? null,
            errorMessage: null,
          },
        })
        await prisma.postStatusHistory.create({
          data: {
            socialPostId: post.id,
            workspaceId: post.workspaceId,
            fromStatus: 'SCHEDULED',
            toStatus: processing ? 'PROCESSING' : 'PUBLISHED',
            actor: 'CRON',
            note: processing
              ? '[PUBLISH_PROCESSING] Provider accepted the upload; awaiting final confirmation'
              : '[PUBLISH_CONFIRMED] Provider confirmed publication',
          },
        }).catch(() => {})
        if (!processing) {
          const event = buildLearningEvent({
            workspaceId: post.workspaceId,
            campaignId: post.campaignId,
            socialPostId: post.id,
            from: 'SCHEDULED',
            to: 'PUBLISHED',
            actor: 'CRON',
            publishMode: 'AUTO',
            platform: String(post.publishTarget || post.platform),
            scheduledAt: post.scheduledAt,
            publishedAt: now,
            platformUrl: providerResult.platformUrl ?? null,
          })
          if (event) await prisma.marketingLearningEvent.create({ data: event as any }).catch(() => {})
        }
        return { id: post.id, success: true, processing }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Database persistence failed'
        const reconciliationMessage = `RECONCILIATION_REQUIRED: platform confirmed ${providerResult.platformPostId}, but local persistence failed: ${message}`
        console.error(`[Cron:publish] ${reconciliationMessage}`)
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: 'FAILED',
            platformPostId: providerResult.platformPostId,
            platformUrl: providerResult.platformUrl ?? null,
            errorMessage: reconciliationMessage.slice(0, 500),
          },
        }).catch(() => {})
        return { id: post.id, success: false, reconciliationRequired: true, error: reconciliationMessage }
      }
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
  const retriesScheduled = results.filter(r => r.status === 'fulfilled' && (r.value as any).retryScheduled).length
  const failed = results.length - succeeded - retriesScheduled

  console.log(`[Cron:publish] Done — ${succeeded} published, ${failed} failed.`)
  return {
    processed: results.length,
    succeeded,
    failed,
    retriesScheduled,
    // Safe counts (auto-publish gate observability)
    autoEligibleCount,
    publishedCount: succeeded,
    skippedManualCount,
    timestamp: now.toISOString(),
  }
}

// ── Route handlers ─────────────────────────────────────────────

/** Vercel cron calls GET */
export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError
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
  const authError = cronAuthError(req)
  if (authError) return authError
  try {
    const result = await runPublishJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron:publish] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
