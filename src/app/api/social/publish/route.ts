import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { getServerUserId } from '@/lib/apiAuth'
import { publishSocialPost } from '@/lib/socialPublishers'
import { hasVerifiedProviderScope, X_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'
import { buildContentPlanTruthContext, reviewContentPostForPublishing } from '@/lib/contentPlanApprovalGuard'
import { YOUTUBE_UPLOAD_SCOPE } from '@/lib/youtubePublishing'
import { PINTEREST_PUBLISH_SCOPES, parsePinterestPostOptions } from '@/lib/pinterestPublishing'
import { parseThreadsPostOptions, THREADS_MAX_TEXT_LENGTH, THREADS_PUBLISH_SCOPES } from '@/lib/threadsPublishing'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import { captureOperationalError } from '@/lib/observability/operationalError'
import { sanitizeSentryText } from '@/lib/observability/sentryPrivacy'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
  readSnapshotStrategyReference,
  reviewPostAgainstApprovalSnapshot,
  reviewPostAgainstMediaApprovalSnapshot,
} from '@/lib/campaignSnapshots'

export const maxDuration = 180

type RequestedPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'YOUTUBE' | 'PINTEREST' | 'THREADS'

interface PublishRequest {
  socialPostId?: unknown
  integrationId?: unknown
  pageId?: unknown
  pageName?: unknown
  caption?: unknown
  imageUrl?: unknown
  link?: unknown
  platform?: unknown
  platformOptions?: unknown
  campaignId?: unknown
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function dbPlatform(platform: RequestedPlatform): 'META' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'YOUTUBE' | 'PINTEREST' | 'THREADS' {
  if (platform === 'LINKEDIN') return 'LINKEDIN'
  if (platform === 'TIKTOK') return 'TIKTOK'
  if (platform === 'X') return 'X'
  if (platform === 'YOUTUBE') return 'YOUTUBE'
  if (platform === 'PINTEREST') return 'PINTEREST'
  if (platform === 'THREADS') return 'THREADS'
  return 'META'
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as PublishRequest
  const integrationId = text(body.integrationId, 100)
  const pageId = text(body.pageId, 200)
  const pageName = text(body.pageName, 200)
  const socialPostId = text(body.socialPostId, 100)
  let caption = text(body.caption, 5_000)
  let imageUrl = text(body.imageUrl, 2_000) || null
  const link = text(body.link, 2_000) || null
  let campaignId = text(body.campaignId, 100) || null
  const platform = text(body.platform, 30) as RequestedPlatform
  const platformOptions = body.platformOptions && typeof body.platformOptions === 'object' && !Array.isArray(body.platformOptions)
    ? body.platformOptions as Record<string, unknown>
    : null

  if (!integrationId || !['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'X', 'YOUTUBE', 'PINTEREST', 'THREADS'].includes(platform)) {
    return NextResponse.json({ error: 'Valid integrationId and platform are required' }, { status: 400 })
  }
  if (['FACEBOOK', 'INSTAGRAM'].includes(platform) && !pageId) {
    return NextResponse.json({ error: 'A connected Meta page/account is required' }, { status: 400 })
  }
  if (platform === 'PINTEREST' && !pageId) {
    return NextResponse.json({ error: 'Select an authorized Pinterest Board' }, { status: 400 })
  }
  if (!socialPostId) {
    return NextResponse.json({
      error: 'Platform publishing must reference an approved, media-ready Content Hub post.',
      code: 'CONTENT_HUB_POST_REQUIRED',
    }, { status: 400 })
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const existingPost = await prisma.socialPost.findFirst({
        where: { id: socialPostId, workspaceId: workspace.id },
        select: {
          id: true,
          campaignId: true,
          platform: true,
          publishTarget: true,
          status: true,
          caption: true,
          imagePrompt: true,
          videoPrompt: true,
          imageUrl: true,
          uploadedMediaId: true,
          mediaSource: true,
          generationStatus: true,
          isVideoPost: true,
          approvedAt: true,
          approvedSnapshotId: true,
          approvedSnapshot: { select: { scope: true, payload: true } },
          mediaApprovalSnapshotId: true,
          mediaApprovalSnapshot: { select: { scope: true, payload: true } },
          scheduledSnapshotId: true,
          link: true,
          sourceMediaId: true,
          contentPlanIndex: true,
          variantGroup: true,
          variantLabel: true,
          scheduledAt: true,
        },
      })

  if (!existingPost) {
    return NextResponse.json({ error: 'Content Hub post not found' }, { status: 404 })
  }
  if (!['APPROVED', 'SCHEDULED'].includes(existingPost.status)) {
    return NextResponse.json({ error: 'The Content Hub post must be approved before platform publishing' }, { status: 409 })
  }
  const approvalSnapshotReview = reviewPostAgainstApprovalSnapshot(existingPost, existingPost.approvedSnapshot)
  if (!approvalSnapshotReview.ok) {
    return NextResponse.json({
      error: 'This post no longer has immutable approval evidence for its current copy and media. Reopen and approve it again.',
      code: approvalSnapshotReview.code,
    }, { status: 409 })
  }
  const mediaApprovalReview = reviewPostAgainstMediaApprovalSnapshot(existingPost, existingPost.mediaApprovalSnapshot)
  if (!mediaApprovalReview.ok) {
    return NextResponse.json({
      error: 'This post media is not the exact revision approved for execution. Review and approve the final media again.',
      code: mediaApprovalReview.code,
    }, { status: 409 })
  }
  if (existingPost.status === 'SCHEDULED' && !existingPost.scheduledSnapshotId) {
    return NextResponse.json({
      error: 'This scheduled post has no recorded schedule decision. Unschedule and schedule it again before publishing.',
      code: 'SCHEDULE_DECISION_SNAPSHOT_REQUIRED',
    }, { status: 409 })
  }
  if (!isContentPostMediaReadyForScheduling(existingPost)) {
    return NextResponse.json({
      error: 'Complete and confirm this post media before platform publishing.',
      code: 'MEDIA_REVIEW_REQUIRED',
    }, { status: 409 })
  }
  if (dbPlatform(platform) !== existingPost.platform) {
    return NextResponse.json({ error: 'Selected platform does not match the approved post platform' }, { status: 409 })
  }
  const approvedTarget = existingPost.publishTarget === 'YOUTUBE_SHORTS'
    ? 'YOUTUBE'
    : existingPost.publishTarget === 'TWITTER'
      ? 'X'
      : existingPost.publishTarget
  if (approvedTarget && approvedTarget !== 'META' && approvedTarget !== platform) {
    return NextResponse.json({ error: 'Selected destination does not match the approved post destination' }, { status: 409 })
  }
  if (platform === 'TIKTOK' && platformOptions?.explicitConsent !== true) {
    return NextResponse.json({ error: 'TikTok requires explicit consent and reviewed publishing options' }, { status: 400 })
  }
  if (platform === 'X' && (existingPost.isVideoPost || platformOptions?.explicitConsent !== true)) {
    return NextResponse.json({
      error: existingPost.isVideoPost
        ? 'X video publishing is not supported yet. Use an approved text or image post.'
        : 'X requires explicit consent for this reviewed post.',
      code: existingPost.isVideoPost ? 'X_VIDEO_NOT_SUPPORTED' : 'X_REVIEW_REQUIRED',
    }, { status: 400 })
  }
  if (platform === 'YOUTUBE' && (!existingPost.isVideoPost || platformOptions?.explicitConsent !== true)) {
    return NextResponse.json({
      error: !existingPost.isVideoPost
        ? 'YouTube publishing requires an approved video post.'
        : 'YouTube requires explicit consent and reviewed video settings.',
      code: !existingPost.isVideoPost ? 'YOUTUBE_VIDEO_REQUIRED' : 'YOUTUBE_REVIEW_REQUIRED',
    }, { status: 400 })
  }
  if (platform === 'PINTEREST') {
    if (existingPost.isVideoPost) {
      return NextResponse.json({
        error: 'Pinterest video publishing is not supported yet. Use an approved image Pin.',
        code: 'PINTEREST_IMAGE_REQUIRED',
      }, { status: 400 })
    }
    try {
      const reviewedOptions = parsePinterestPostOptions(platformOptions)
      if (reviewedOptions.boardId !== pageId) {
        return NextResponse.json({ error: 'Pinterest Board selection does not match the reviewed destination' }, { status: 409 })
      }
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Review the Pinterest publishing settings.',
        code: 'PINTEREST_REVIEW_REQUIRED',
      }, { status: 400 })
    }
  }
  if (platform === 'THREADS') {
    if (existingPost.isVideoPost) {
      return NextResponse.json({
        error: 'Threads video publishing is not enabled yet. Use an approved text or image post.',
        code: 'THREADS_VIDEO_NOT_SUPPORTED',
      }, { status: 400 })
    }
    const copyLength = Array.from(String(existingPost.caption || '').trim()).length
    if (copyLength < 1 || copyLength > THREADS_MAX_TEXT_LENGTH) {
      return NextResponse.json({
        error: `Review the Threads post so it contains 1 to ${THREADS_MAX_TEXT_LENGTH} characters.`,
        code: 'THREADS_COPY_REVIEW_REQUIRED',
      }, { status: 400 })
    }
    try {
      parseThreadsPostOptions(platformOptions, { hasImage: Boolean(existingPost.imageUrl) })
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Review the Threads publishing settings.',
        code: 'THREADS_REVIEW_REQUIRED',
      }, { status: 400 })
    }
  }
  if (campaignId && existingPost.campaignId && campaignId !== existingPost.campaignId) {
    return NextResponse.json({ error: 'Campaign does not match the approved post' }, { status: 409 })
  }
  caption = existingPost.caption
  imageUrl = existingPost.imageUrl
  campaignId = existingPost.campaignId
  if (!caption) {
    return NextResponse.json({ error: 'Approved post caption is required' }, { status: 400 })
  }
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      workspaceId: workspace.id,
      status: 'CONNECTED',
      type: dbPlatform(platform),
    },
  })
  if (!integration?.accessToken) {
    return NextResponse.json({ error: 'Matching integration is not connected' }, { status: 400 })
  }

  if (!campaignId) {
    return NextResponse.json({
      error: 'Publishing requires a campaign with a reviewed Brand Brain-grounded strategy.',
      code: 'MARKETING_QUALITY_GATE_REQUIRED',
    }, { status: 409 })
  }
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      description: true,
      aiOutput: true,
      goal: true,
      audience: true,
      tone: true,
      platforms: true,
      workspace: { select: { brandProfile: true } },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const publishReview = reviewContentPostForPublishing(
    existingPost,
    1,
    buildContentPlanTruthContext(campaign.workspace.brandProfile),
  )
  if (publishReview.length > 0) {
    return NextResponse.json({
      error: 'This saved post needs copy review before it can be sent to a platform.',
      code: 'CONTENT_REVIEW_REQUIRED',
      issues: publishReview,
    }, { status: 409 })
  }
  const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
    ? campaign.aiOutput as Record<string, unknown>
    : {}
  const strategyQuality = reviewStrategyGrounding({
    strategy: aiOutput.strategy ?? aiOutput,
    brand: campaign.workspace.brandProfile,
    allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
    requireAllReviewedPlatforms: true,
    goal: String(campaign.goal),
  })
  if (strategyQuality.status !== 'passed') {
    return NextResponse.json({
      error: 'Publishing is blocked because the source strategy no longer matches Brand Brain or the reviewed campaign scope.',
      code: 'MARKETING_QUALITY_GATE_FAILED',
      qualityGate: strategyQuality,
    }, { status: 409 })
  }
  const strategySnapshot = await prisma.campaignSnapshot.findFirst({
    where: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
    },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, scope: true, payloadHash: true },
  })
  const approvedStrategy = readSnapshotStrategyReference(existingPost.approvedSnapshot?.payload)
  if (!strategySnapshot || approvedStrategy?.id !== strategySnapshot.id) {
    return NextResponse.json({
      error: 'The post was not approved for the current reviewed strategy. Reopen and approve it again before publishing.',
      code: 'CONTENT_APPROVED_FOR_OLDER_STRATEGY',
    }, { status: 409 })
  }
  const currentStrategyPayload = buildStrategyApprovalSnapshotPayload({
    campaign,
    brandProfile: campaign.workspace.brandProfile,
  })
  if (hashCampaignSnapshotPayload(currentStrategyPayload) !== strategySnapshot.payloadHash) {
    return NextResponse.json({
      error: 'The campaign or Brand Brain changed after strategy approval. Review the strategy and content again before publishing.',
      code: 'STRATEGY_APPROVAL_SNAPSHOT_STALE',
    }, { status: 409 })
  }

  const config = integration.config && typeof integration.config === 'object' && !Array.isArray(integration.config)
    ? integration.config as Record<string, unknown>
    : {}
  if (platform === 'PINTEREST' && String(config.accessTier || '').toUpperCase() !== 'STANDARD') {
    return NextResponse.json({
      error: 'Pinterest Standard access is required before publishing public Pins.',
      code: 'PINTEREST_STANDARD_ACCESS_REQUIRED',
    }, { status: 409 })
  }
  if (platform === 'THREADS' && String(config.accessTier || '').toUpperCase() !== 'LIVE') {
    return NextResponse.json({
      error: 'The Threads Meta app must be Live before publishing for public users.',
      code: 'THREADS_LIVE_ACCESS_REQUIRED',
    }, { status: 409 })
  }
  const requiredScopes = platform === 'FACEBOOK'
    ? ['pages_manage_posts']
    : platform === 'INSTAGRAM'
      ? ['instagram_content_publish']
      : platform === 'LINKEDIN'
        ? [pageId ? 'w_organization_social' : 'w_member_social']
        : platform === 'TIKTOK'
          ? ['video.publish']
          : platform === 'X'
            ? [...X_CONTENT_SCOPES]
          : platform === 'PINTEREST'
            ? [...PINTEREST_PUBLISH_SCOPES]
          : platform === 'THREADS'
            ? [...THREADS_PUBLISH_SCOPES]
            : [YOUTUBE_UPLOAD_SCOPE]
  const missingScope = requiredScopes.find(scope => !hasVerifiedProviderScope(config, scope))
  if (missingScope) {
    return NextResponse.json({
      error: `Reconnect ${platform} and grant the verified ${missingScope} permission before publishing.`,
      code: 'PLATFORM_SCOPE_REQUIRED',
    }, { status: 409 })
  }
  const pages = Array.isArray(config.pages) ? config.pages as Array<Record<string, any>> : []
  const page = pages.find((entry) => entry.id === pageId || entry.igAccountId === pageId)
  if (['FACEBOOK', 'INSTAGRAM'].includes(platform) && !page) {
    return NextResponse.json({ error: 'Selected page is not part of this connection' }, { status: 400 })
  }

  const rawToken = page?.accessToken || integration.accessToken
  const accessToken = decryptToken(rawToken) ?? ''
  if (!accessToken) return NextResponse.json({ error: 'Stored platform token could not be decrypted' }, { status: 503 })

  const captionWithLink = link && platform === 'LINKEDIN' ? `${caption}\n\n${link}` : caption
  let published: Awaited<ReturnType<typeof publishSocialPost>> | null = null
  let publishError: string | null = null
  try {
    published = await publishSocialPost({
      platform,
      caption: captionWithLink,
      imageUrl,
      pageId,
      accountId: integration.accountId,
      accessToken,
      integrationConfig: config,
      platformOptions,
      link,
    })
  } catch (error) {
    publishError = sanitizeSentryText(error instanceof Error ? error.message : 'Publish failed').slice(0, 500)
    await captureOperationalError(error, {
      operation: 'publishing.manual-provider-submit',
      route: '/api/social/publish',
      component: 'publishing',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 502,
      retryable: true,
    })
  }

  try {
    const nextStatus = published
      ? (published.state === 'PROCESSING' ? 'PROCESSING' : 'PUBLISHED')
      : 'FAILED'
      const now = new Date()
      const updated = await prisma.$transaction(async (tx) => {
        const socialPost = await tx.socialPost.update({
          where: { id: existingPost.id },
          data: {
            integrationId,
            platform: dbPlatform(platform),
            publishTarget: platform,
            pageId: pageId || null,
            pageName: pageName || page?.name || integration.accountName || null,
            platformPostId: published?.platformPostId ?? null,
            platformUrl: published?.platformUrl ?? null,
            status: nextStatus,
            errorMessage: publishError,
            // This route publishes through a provider API. AUTO is the existing
            // persisted mode for API-confirmed publication; the post is already
            // PUBLISHED, so it can never enter the scheduled cron queue.
            publishMode: 'AUTO',
            approvedAt: existingPost.approvedAt ?? now,
            platformOptions: platformOptions as any,
            autoPublishConsentAt: platformOptions?.explicitConsent === true ? now : null,
            publishAttemptedAt: now,
            publishedAt: nextStatus === 'PUBLISHED' ? now : null,
          },
        })
        await tx.postStatusHistory.create({
          data: {
            socialPostId: existingPost.id,
            workspaceId: workspace.id,
            fromStatus: existingPost.status,
            toStatus: nextStatus,
            actor: 'USER',
            note: published
              ? (nextStatus === 'PROCESSING'
                  ? 'Provider accepted the explicit Content Hub upload; awaiting publication confirmation'
                  : 'Published by explicit Content Hub API action')
              : publishError?.slice(0, 500),
          },
        })
        await tx.marketingLearningEvent.create({
          data: {
            workspaceId: workspace.id,
            campaignId,
            socialPostId: existingPost.id,
            eventType: published
              ? (nextStatus === 'PROCESSING' ? 'POST_API_PROCESSING' : 'POST_API_PUBLISHED')
              : 'POST_FAILED',
            source: 'CONTENT_HUB',
            actor: 'USER',
            metadata: {
              integrationId,
              platform,
              pageId,
              platformPostId: published?.platformPostId ?? null,
              error: publishError,
            },
          },
        })
        return socialPost
      })

      if (!published) return NextResponse.json({ error: publishError, socialPost: updated }, { status: 502 })
      return NextResponse.json(
        {
          ok: true,
          processing: nextStatus === 'PROCESSING',
          socialPost: updated,
          platformUrl: published.platformUrl ?? null,
        },
        { status: nextStatus === 'PROCESSING' ? 202 : 200 },
      )
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'publishing.persist-manual-result',
      route: '/api/social/publish',
      component: 'database',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    if (published) {
      return NextResponse.json({
        error: 'Platform confirmed publication, but local persistence failed. Manual reconciliation is required.',
        platformPostId: published.platformPostId,
        reconciliationRequired: true,
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to record publishing attempt' }, { status: 500 })
  }
}
