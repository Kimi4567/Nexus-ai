import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
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
import { PINTEREST_PUBLISH_SCOPES } from '@/lib/pinterestPublishing'
import { THREADS_OPERATIONAL_SCOPES } from '@/lib/threadsPublishing'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
  readSnapshotStrategyReference,
  reviewPostAgainstApprovalSnapshot,
  reviewPostAgainstMediaApprovalSnapshot,
} from '@/lib/campaignSnapshots'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// The lease is deliberately longer than the route's maximum runtime. If a
// worker crashes after claiming a post, a later cron invocation can reclaim it
// once this window expires; while the lease is live, concurrent invocations
// cannot call the provider for the same post.
const PUBLISH_LEASE_MS = 15 * 60 * 1000

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
      approvedSnapshot: { select: { scope: true, payload: true } },
      mediaApprovalSnapshot: { select: { scope: true, payload: true } },
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

  // Revalidate the strategy against the current Brand Brain immediately before
  // a provider call. This closes the legacy/stale-approval gap: editing Brand
  // Brain after scheduling cannot leave contradictory copy eligible to publish.
  const campaignIds = Array.from(new Set(
    duePosts.map((post: any) => post.campaignId).filter((id): id is string => typeof id === 'string' && Boolean(id)),
  ))
  const publishCampaigns = campaignIds.length > 0
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          description: true,
          aiOutput: true,
          goal: true,
          audience: true,
          tone: true,
          platforms: true,
        },
      })
    : []
  const workspaceIds = Array.from(new Set(publishCampaigns.map(campaign => campaign.workspaceId)))
  const publishBrands = workspaceIds.length > 0
    ? await prisma.brandProfile.findMany({ where: { workspaceId: { in: workspaceIds } } })
    : []
  const strategySnapshots = campaignIds.length > 0
    ? await prisma.campaignSnapshot.findMany({
        where: { campaignId: { in: campaignIds }, scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL },
        orderBy: { version: 'desc' },
        select: { id: true, campaignId: true, version: true, scope: true, payloadHash: true },
      })
    : []
  const campaignById = new Map(publishCampaigns.map(campaign => [campaign.id, campaign]))
  const brandByWorkspaceId = new Map(publishBrands.map(brand => [brand.workspaceId, brand]))
  const strategySnapshotByCampaignId = new Map<string, typeof strategySnapshots[number]>()
  for (const snapshot of strategySnapshots) {
    if (!strategySnapshotByCampaignId.has(snapshot.campaignId)) {
      strategySnapshotByCampaignId.set(snapshot.campaignId, snapshot)
    }
  }

  console.log(`[Cron:publish] AUTO-eligible: ${autoEligibleCount} · skipped (manual/legacy, untouched): ${skippedManualCount}`)

  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      const leaseToken = randomUUID()
      const leaseUntil = new Date(now.getTime() + PUBLISH_LEASE_MS)
      const claim = await prisma.socialPost.updateMany({
        where: {
          id: post.id,
          status: 'SCHEDULED',
          publishMode: 'AUTO',
          OR: [
            { publishLeaseUntil: null },
            { publishLeaseUntil: { lt: now } },
          ],
        },
        data: {
          publishLeaseToken: leaseToken,
          publishLeaseUntil: leaseUntil,
        },
      })
      if (claim.count !== 1) {
        // Another invocation owns the live lease. This is an expected
        // concurrency outcome, not a failed publish attempt.
        return { id: post.id, success: false, skipped: true }
      }

      let providerResult: Awaited<ReturnType<typeof publishSocialPost>> | null = null
      try {
        const campaign = typeof post.campaignId === 'string' ? campaignById.get(post.campaignId) : null
        if (!campaign) throw new Error('MARKETING_QUALITY_GATE_FAILED: campaign strategy is unavailable')
        const brand = brandByWorkspaceId.get(campaign.workspaceId)
        if (!brand) throw new Error('MARKETING_QUALITY_GATE_FAILED: Brand Brain is unavailable')
        const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
          ? campaign.aiOutput as Record<string, unknown>
          : {}
        const strategyQuality = reviewStrategyGrounding({
          strategy: aiOutput.strategy ?? aiOutput,
          brand,
          allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
          goal: String(campaign.goal),
        })
        if (strategyQuality.status !== 'passed') {
          throw new Error(`MARKETING_QUALITY_GATE_FAILED: ${strategyQuality.blockers.map(blocker => blocker.code).join(', ')}`)
        }
        const contentSnapshotReview = reviewPostAgainstApprovalSnapshot(post, (post as any).approvedSnapshot)
        if (!contentSnapshotReview.ok) {
          throw new Error(`${contentSnapshotReview.code}: current post revision has no matching approval evidence`)
        }
        const mediaSnapshotReview = reviewPostAgainstMediaApprovalSnapshot(post, (post as any).mediaApprovalSnapshot)
        if (!mediaSnapshotReview.ok) {
          throw new Error(`${mediaSnapshotReview.code}: current post media has no matching approval evidence`)
        }
        const strategySnapshot = strategySnapshotByCampaignId.get(campaign.id)
        const approvedStrategy = readSnapshotStrategyReference((post as any).approvedSnapshot?.payload)
        if (!strategySnapshot || approvedStrategy?.id !== strategySnapshot.id) {
          throw new Error('CONTENT_APPROVED_FOR_OLDER_STRATEGY: reopen and approve this post again')
        }
        const currentStrategyPayload = buildStrategyApprovalSnapshotPayload({ campaign, brandProfile: brand })
        if (hashCampaignSnapshotPayload(currentStrategyPayload) !== strategySnapshot.payloadHash) {
          throw new Error('STRATEGY_APPROVAL_SNAPSHOT_STALE: campaign or Brand Brain changed after approval')
        }

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
        if (target === 'PINTEREST' && post.isVideoPost) {
          throw new Error('PINTEREST_IMAGE_REQUIRED: scheduled Pinterest publishing supports reviewed image Pins only')
        }
        if (target === 'PINTEREST' && String((integration.config as any)?.accessTier || '').toUpperCase() !== 'STANDARD') {
          throw new Error('PINTEREST_STANDARD_ACCESS_REQUIRED: public scheduled Pins require Pinterest Standard access')
        }
        if (target === 'THREADS' && post.isVideoPost) {
          throw new Error('THREADS_VIDEO_NOT_SUPPORTED: scheduled Threads publishing supports reviewed text and images only')
        }
        if (target === 'THREADS' && String((integration.config as any)?.accessTier || '').toUpperCase() !== 'LIVE') {
          throw new Error('THREADS_LIVE_ACCESS_REQUIRED: public scheduled Threads posts require a Live Meta app')
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
                  : target === 'PINTEREST'
                    ? [...PINTEREST_PUBLISH_SCOPES]
                  : target === 'THREADS'
                    ? [...THREADS_OPERATIONAL_SCOPES]
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
            data: {
              errorMessage: message,
              publishLeaseToken: null,
              publishLeaseUntil: null,
            },
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
          data: {
            status: 'FAILED',
            errorMessage: message,
            publishLeaseToken: null,
            publishLeaseUntil: null,
          },
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
            publishLeaseToken: null,
            publishLeaseUntil: null,
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
            publishLeaseToken: null,
            publishLeaseUntil: null,
          },
        }).catch(() => {})
        return { id: post.id, success: false, reconciliationRequired: true, error: reconciliationMessage }
      }
    })
  )

  const skippedByLease = results.filter(r => r.status === 'fulfilled' && (r.value as any).skipped).length
  const processedResults = results.filter(r => !(r.status === 'fulfilled' && (r.value as any).skipped))
  const succeeded = processedResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
  const retriesScheduled = processedResults.filter(r => r.status === 'fulfilled' && (r.value as any).retryScheduled).length
  const failed = processedResults.length - succeeded - retriesScheduled

  console.log(`[Cron:publish] Done — ${succeeded} published, ${failed} failed.`)
  return {
    processed: processedResults.length,
    succeeded,
    failed,
    retriesScheduled,
    skippedByLease,
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
