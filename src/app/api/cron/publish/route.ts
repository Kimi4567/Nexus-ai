import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { autoPublishWhere, skippedManualWhere, isAutoPublishEligible } from '@/lib/publishGate'
import { cronAuthError } from '@/lib/cronAuth'
import { isRetryableSocialPublishError, publishSocialPost } from '@/lib/socialPublishers'

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

        // Resolve a page-level token where Meta supplied one. Match either the
        // Facebook Page ID or its linked Instagram account ID.
        const pages: any[] = (integration.config as any)?.pages || []
        const page = pages.find((p: any) => p.id === post.pageId || p.igAccountId === post.pageId)
        const rawPageToken = page?.accessToken || integration.accessToken
        const accessToken = decryptToken(rawPageToken) ?? rawPageToken
        providerResult = await publishSocialPost({
          platform: String(post.platform),
          caption: post.caption,
          imageUrl: post.imageUrl,
          pageId: post.pageId,
          accountId: integration.accountId,
          accessToken,
          integrationConfig: integration.config as Record<string, unknown> | null,
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
        return { id: post.id, success: false, retryScheduled: false, error: message }
      }

      try {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: now,
            platformPostId: providerResult.platformPostId,
            platformUrl: providerResult.platformUrl ?? null,
            errorMessage: null,
          },
        })
        return { id: post.id, success: true }
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
