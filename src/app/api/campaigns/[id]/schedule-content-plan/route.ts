/**
 * POST /api/campaigns/[id]/schedule-content-plan
 *
 * Schedules a campaign's APPROVED content-plan posts: APPROVED → SCHEDULED only.
 * This is the SEPARATE scheduling decision that follows approval. It:
 * - moves only APPROVED posts (a DRAFT post can never be scheduled directly here),
 * - requires a valid planned scheduledAt from generation (never invents or overwrites it),
 * - assigns integrationId + pageId per platform if still missing,
 * - records APPROVED → SCHEDULED in PostStatusHistory (actor USER),
 * - never marks anything PUBLISHED and never touches cron/publishing behaviour.
 *
 * DELETE /api/campaigns/[id]/schedule-content-plan
 * Unschedules: SCHEDULED → APPROVED (keeps the approval, just pulls it off the
 * schedule). Published posts are untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { hasValidPlannedDate, planScheduling } from '@/lib/approvalPlan'
import { validateTransition, buildStatusHistory } from '@/lib/postStatus'
import { buildLearningEvents } from '@/lib/brandBrainEvents'
import { canMutateCampaignExecution } from '@/lib/strategyApproval'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'
import { decryptToken } from '@/lib/tokenCrypto'
import { queryTikTokCreatorInfo } from '@/lib/tiktokPublishing'
import { hasVerifiedProviderScope } from '@/lib/socialPlatformConfig'
import { reviewContentPostForPublishing } from '@/lib/contentPlanApprovalGuard'
import { reviewStrategyGrounding } from '@/lib/ai/marketingQualityGate'
import {
  parseYouTubePostOptions,
  YOUTUBE_READ_SCOPE,
  YOUTUBE_UPLOAD_SCOPE,
} from '@/lib/youtubePublishing'
import {
  X_MEDIA_WRITE_SCOPE,
  X_OFFLINE_SCOPE,
  X_TWEET_READ_SCOPE,
  X_TWEET_WRITE_SCOPE,
  X_USERS_READ_SCOPE,
} from '@/lib/xPublishing'
import {
  parsePinterestPostOptions,
  pinterestBoardsFromConfig,
  PINTEREST_PUBLISH_SCOPES,
} from '@/lib/pinterestPublishing'
import {
  parseThreadsPostOptions,
  THREADS_MAX_TEXT_LENGTH,
  THREADS_OPERATIONAL_SCOPES,
} from '@/lib/threadsPublishing'

type Params = { params: Promise<{ id: string }> }

type DestinationSelection = {
  integrationId?: string
  pageId?: string
  pageName?: string
}

type ScheduleRequest = {
  publishMode?: 'MANUAL' | 'AUTO'
  explicitAutoPublishConfirmed?: boolean
  destinationByTarget?: Record<string, DestinationSelection>
  tiktokOptions?: Record<string, unknown>
  youtubeOptionsByPostId?: Record<string, Record<string, unknown>>
  pinterestOptionsByPostId?: Record<string, Record<string, unknown>>
  threadsOptionsByPostId?: Record<string, Record<string, unknown>>
}

function normalizedTarget(target: string): string {
  const value = target.toUpperCase()
  if (value === 'YOUTUBE_SHORTS') return 'YOUTUBE'
  if (value === 'TWITTER') return 'X'
  return value
}

function providerForTarget(target: string): 'META' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'X' | 'PINTEREST' | 'THREADS' | null {
  if (target === 'FACEBOOK' || target === 'INSTAGRAM') return 'META'
  if (target === 'LINKEDIN') return 'LINKEDIN'
  if (target === 'TIKTOK') return 'TIKTOK'
  if (target === 'YOUTUBE') return 'YOUTUBE'
  if (target === 'X') return 'X'
  if (target === 'PINTEREST') return 'PINTEREST'
  if (target === 'THREADS') return 'THREADS'
  return null
}

function objectConfig(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestBody = await req.json().catch(() => ({})) as ScheduleRequest
  const publishMode = requestBody.publishMode === 'AUTO' ? 'AUTO' : 'MANUAL'

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        aiOutput: true,
        goal: true,
        platforms: true,
      },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const brandProfile = await prisma.brandProfile.findUnique({
      where: { workspaceId: campaign.workspaceId },
    })
    if (!canMutateCampaignExecution(String(campaign.status), campaign.aiOutput, brandProfile)) {
      return NextResponse.json({
        error: 'Approve the campaign strategy before scheduling content.',
        code: 'STRATEGY_APPROVAL_REQUIRED',
      }, { status: 409 })
    }
    const aiOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object' && !Array.isArray(campaign.aiOutput)
      ? campaign.aiOutput as Record<string, unknown>
      : {}
    const strategy = aiOutput.strategy ?? aiOutput
    const strategyQuality = reviewStrategyGrounding({
      strategy,
      brand: brandProfile,
      allowedPlatforms: Array.isArray(campaign.platforms) ? campaign.platforms.map(String) : [],
      goal: String(campaign.goal),
    })
    if (strategyQuality.status !== 'passed') {
      return NextResponse.json({
        error: 'The approved strategy no longer matches the current Brand Brain or campaign scope.',
        code: 'MARKETING_QUALITY_GATE_FAILED',
        qualityGate: strategyQuality,
      }, { status: 409 })
    }

    const approvedPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'APPROVED',
        publishedAt: null,
      },
      select: {
        id: true,
        platform: true,
        publishTarget: true,
        integrationId: true,
        scheduledAt: true,
        caption: true,
        imagePrompt: true,
        videoPrompt: true,
        imageUrl: true,
        uploadedMediaId: true,
        mediaSource: true,
        generationStatus: true,
        isVideoPost: true,
      },
    })

    if (approvedPosts.length === 0) {
      return NextResponse.json({ success: true, scheduled: 0, message: 'No approved posts to schedule' })
    }

    const postsNeedingMedia = approvedPosts.filter(
      (post: any) => !isContentPostMediaReadyForScheduling(post),
    )
    if (postsNeedingMedia.length > 0) {
      return NextResponse.json({
        error: 'Complete media review for every approved post before scheduling.',
        code: 'MEDIA_REVIEW_REQUIRED',
        pendingMedia: postsNeedingMedia.length,
      }, { status: 409 })
    }

    const contentIssues = approvedPosts.flatMap((post: any, index: number) =>
      reviewContentPostForPublishing(post, index + 1),
    )
    if (contentIssues.length > 0) {
      return NextResponse.json({
        error: 'Review or regenerate the approved copy before scheduling it.',
        code: 'CONTENT_REVIEW_REQUIRED',
        issues: contentIssues,
      }, { status: 409 })
    }

    if (publishMode === 'AUTO' && requestBody.explicitAutoPublishConfirmed !== true) {
      return NextResponse.json({
        error: 'Explicit confirmation is required before automatic publishing.',
        code: 'EXPLICIT_AUTO_PUBLISH_CONSENT_REQUIRED',
      }, { status: 409 })
    }

    // Build exact destination assignments only after execution readiness passes.
    // MANUAL scheduling may stay unlinked. AUTO scheduling is fail-closed: every
    // post needs a supported, unambiguous destination and provider permission.
    const connectedIntegrations = await prisma.integration.findMany({
      where: {
        workspaceId: campaign.workspaceId,
        status: 'CONNECTED' as any,
        type: { notIn: ['STRIPE', 'CLOUDINARY', 'GOOGLE', 'SLACK'] as any[] },
      },
      select: { id: true, type: true, config: true, accountId: true, accountName: true, accessToken: true, refreshToken: true },
    })

    const assignmentById = new Map<string, {
      integrationId: string
      pageId: string | null
      pageName: string | null
      platformOptions: Record<string, unknown> | null
      publishTarget: string
    }>()
    const blockers: Array<{ code: string; target: string; postId: string; message: string }> = []
    let tiktokCreator: Awaited<ReturnType<typeof queryTikTokCreatorInfo>> | null = null

    for (const post of approvedPosts as any[]) {
      const target = normalizedTarget(String(post.publishTarget || post.platform))
      const provider = providerForTarget(target)
      if (!provider) {
        if (publishMode === 'AUTO') blockers.push({
          code: target === 'META' ? 'AMBIGUOUS_META_DESTINATION' : 'UNSUPPORTED_AUTO_PUBLISH_TARGET',
          target,
          postId: post.id,
          message: target === 'META'
            ? 'Choose Facebook or Instagram for this legacy Meta post before automatic publishing.'
            : `${target} is available for planning, but no automatic publisher is enabled for it yet.`,
        })
        continue
      }
      const requested = requestBody.destinationByTarget?.[target]
      const candidates = connectedIntegrations.filter(intg => String(intg.type) === provider)
      const integration = (requested?.integrationId
        ? candidates.find(intg => intg.id === requested.integrationId)
        : candidates[0]) || null
      if (!integration) {
        if (publishMode === 'AUTO') blockers.push({
          code: 'CONNECTION_REQUIRED', target, postId: post.id,
          message: `Connect and authorize ${target} before automatic publishing.`,
        })
        continue
      }
      const config = objectConfig(integration.config)
      let pageId: string | null = requested?.pageId || null
      let pageName: string | null = requested?.pageName || integration.accountName || null
      let platformOptions: Record<string, unknown> | null = null

      if (target === 'FACEBOOK' || target === 'INSTAGRAM') {
        const requiredScope = target === 'INSTAGRAM' ? 'instagram_content_publish' : 'pages_manage_posts'
        if (publishMode === 'AUTO' && !hasVerifiedProviderScope(config, requiredScope)) {
          blockers.push({
            code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id,
            message: `Reconnect ${target} and grant the verified ${requiredScope} permission before automatic publishing.`,
          })
          continue
        }
        const pages = Array.isArray(config.pages) ? config.pages : []
        const eligible = pages.filter((page: any) => target === 'INSTAGRAM'
          ? Boolean(page?.igAccountId && page?.accessToken)
          : Boolean(page?.id && page?.accessToken))
        const selected = pageId
          ? eligible.find((page: any) => page.id === pageId || page.igAccountId === pageId)
          : eligible.length === 1 ? eligible[0] : null
        if (!selected) {
          if (publishMode === 'AUTO') blockers.push({
            code: eligible.length > 1 ? 'DESTINATION_SELECTION_REQUIRED' : 'PLATFORM_PERMISSION_REQUIRED',
            target, postId: post.id,
            message: eligible.length > 1
              ? `Select the exact ${target} destination before automatic publishing.`
              : `No authorized ${target} destination is available on this Meta connection.`,
          })
          continue
        }
        pageId = target === 'INSTAGRAM' ? selected.igAccountId : selected.id
        pageName = selected.name || pageName
      } else if (target === 'LINKEDIN') {
        const organizations = Array.isArray(config.organizations) ? config.organizations : []
        const selectedOrganizationId = pageId || config.organizationId || null
        const requiredScope = selectedOrganizationId ? 'w_organization_social' : 'w_member_social'
        if (publishMode === 'AUTO' && !hasVerifiedProviderScope(config, requiredScope)) {
          blockers.push({
            code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id,
            message: `Reconnect LinkedIn and grant the verified ${requiredScope} permission before automatic publishing.`,
          })
          continue
        }
        if (selectedOrganizationId) {
          const organization = organizations.find((item: any) => item.id === selectedOrganizationId)
          if (!organization) {
            if (publishMode === 'AUTO') blockers.push({
              code: 'LINKEDIN_ORGANIZATION_PERMISSION_REQUIRED', target, postId: post.id,
              message: 'The selected LinkedIn Page is not authorized for this connection.',
            })
            continue
          }
          pageId = organization.id
          pageName = organization.name || pageName
        } else {
          pageId = null // member publishing is explicit when no organization is selected
        }
      } else if (target === 'TIKTOK') {
        const options = requestBody.tiktokOptions || {}
        if (publishMode === 'AUTO' && !hasVerifiedProviderScope(config, 'video.publish')) {
          blockers.push({ code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id, message: 'Reconnect TikTok and grant the verified video.publish scope.' })
          continue
        }
        if (publishMode === 'AUTO' && requestBody.explicitAutoPublishConfirmed !== true) {
          blockers.push({
            code: 'EXPLICIT_AUTO_PUBLISH_CONSENT_REQUIRED', target, postId: post.id,
            message: 'Confirm that NEXUS may send the approved video to TikTok at its scheduled time.',
          })
          continue
        }
        const token = integration.accessToken ? decryptToken(integration.accessToken) : null
        if (!token) {
          if (publishMode === 'AUTO') blockers.push({ code: 'TOKEN_UNAVAILABLE', target, postId: post.id, message: 'Reconnect TikTok before scheduling automatic publishing.' })
          continue
        }
        if (publishMode === 'AUTO' && !tiktokCreator) {
          try { tiktokCreator = await queryTikTokCreatorInfo(token) } catch {
            blockers.push({ code: 'TIKTOK_CREATOR_INFO_REQUIRED', target, postId: post.id, message: 'TikTok publishing options could not be verified. Reconnect and review them.' })
            continue
          }
        }
        const privacyLevel = String(options.privacyLevel || '')
        if (publishMode === 'AUTO' && !tiktokCreator?.privacyLevelOptions.includes(privacyLevel)) {
          blockers.push({ code: 'TIKTOK_PRIVACY_SELECTION_REQUIRED', target, postId: post.id, message: 'Select one of the current TikTok privacy options.' })
          continue
        }
        platformOptions = {
          privacyLevel,
          disableComment: tiktokCreator?.commentDisabled || Boolean(options.disableComment),
          disableDuet: tiktokCreator?.duetDisabled || Boolean(options.disableDuet),
          disableStitch: tiktokCreator?.stitchDisabled || Boolean(options.disableStitch),
          brandContentToggle: Boolean(options.brandContentToggle),
          brandOrganicToggle: Boolean(options.brandOrganicToggle),
          isAigc: Boolean(options.isAigc),
          explicitConsent: publishMode === 'AUTO' && requestBody.explicitAutoPublishConfirmed === true,
        }
      } else if (target === 'YOUTUBE') {
        if (publishMode === 'AUTO' && !post.isVideoPost) {
          blockers.push({
            code: 'YOUTUBE_VIDEO_REQUIRED', target, postId: post.id,
            message: 'YouTube automatic publishing requires a reviewed video post.',
          })
          continue
        }
        if (
          publishMode === 'AUTO'
          && (!hasVerifiedProviderScope(config, YOUTUBE_UPLOAD_SCOPE) || !hasVerifiedProviderScope(config, YOUTUBE_READ_SCOPE))
        ) {
          blockers.push({
            code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id,
            message: 'Reconnect YouTube and grant verified upload and processing-status permissions.',
          })
          continue
        }
        if (publishMode === 'AUTO' && (!integration.accountId || !integration.refreshToken)) {
          blockers.push({
            code: 'YOUTUBE_OFFLINE_ACCESS_REQUIRED', target, postId: post.id,
            message: 'Reconnect a YouTube channel with offline access before scheduled publishing.',
          })
          continue
        }
        try {
          platformOptions = parseYouTubePostOptions({
            ...(requestBody.youtubeOptionsByPostId?.[post.id] || {}),
            explicitConsent: publishMode === 'AUTO' && requestBody.explicitAutoPublishConfirmed === true,
          }) as unknown as Record<string, unknown>
        } catch (error) {
          if (publishMode === 'AUTO') blockers.push({
            code: 'YOUTUBE_REVIEW_REQUIRED', target, postId: post.id,
            message: error instanceof Error ? error.message : 'Review the YouTube video settings.',
          })
          continue
        }
      } else if (target === 'X') {
        if (publishMode === 'AUTO' && post.isVideoPost) {
          blockers.push({
            code: 'X_VIDEO_NOT_SUPPORTED', target, postId: post.id,
            message: 'X automatic publishing currently supports reviewed text and image posts, not video uploads.',
          })
          continue
        }
        const requiredScopes = [
          X_TWEET_READ_SCOPE,
          X_TWEET_WRITE_SCOPE,
          X_USERS_READ_SCOPE,
          X_MEDIA_WRITE_SCOPE,
          X_OFFLINE_SCOPE,
        ]
        if (publishMode === 'AUTO' && requiredScopes.some(scope => !hasVerifiedProviderScope(config, scope))) {
          blockers.push({
            code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id,
            message: 'Reconnect X and grant verified post, media, readback, and offline permissions.',
          })
          continue
        }
        if (publishMode === 'AUTO' && (!integration.accountId || !integration.refreshToken)) {
          blockers.push({
            code: 'X_OFFLINE_ACCESS_REQUIRED', target, postId: post.id,
            message: 'Reconnect X with offline access before scheduled publishing.',
          })
          continue
        }
        const copyLength = Array.from(String(post.caption || '').trim()).length
        if (publishMode === 'AUTO' && (copyLength === 0 || copyLength > 280)) {
          blockers.push({
            code: 'X_COPY_REVIEW_REQUIRED', target, postId: post.id,
            message: 'Review the X post so it contains copy of 1 to 280 characters before automatic publishing.',
          })
          continue
        }
        platformOptions = {
          explicitConsent: publishMode === 'AUTO' && requestBody.explicitAutoPublishConfirmed === true,
        }
      } else if (target === 'PINTEREST') {
        if (publishMode === 'AUTO' && post.isVideoPost) {
          blockers.push({
            code: 'PINTEREST_IMAGE_REQUIRED', target, postId: post.id,
            message: 'Pinterest automatic publishing currently supports reviewed image Pins only.',
          })
          continue
        }
        if (publishMode === 'AUTO' && String(config.accessTier || '').toUpperCase() !== 'STANDARD') {
          blockers.push({
            code: 'PINTEREST_STANDARD_ACCESS_REQUIRED', target, postId: post.id,
            message: 'Pinterest Standard access is required before Nexus can schedule public Pins.',
          })
          continue
        }
        if (publishMode === 'AUTO' && PINTEREST_PUBLISH_SCOPES.some(scope => !hasVerifiedProviderScope(config, scope))) {
          blockers.push({
            code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id,
            message: 'Reconnect Pinterest and grant verified Board, Pin publishing, and readback permissions.',
          })
          continue
        }
        if (publishMode === 'AUTO' && (!integration.accountId || !integration.refreshToken)) {
          blockers.push({
            code: 'PINTEREST_OFFLINE_ACCESS_REQUIRED', target, postId: post.id,
            message: 'Reconnect Pinterest with continuous refresh access before scheduled publishing.',
          })
          continue
        }
        const copyLength = Array.from(String(post.caption || '').trim()).length
        if (publishMode === 'AUTO' && (copyLength === 0 || copyLength > 800)) {
          blockers.push({
            code: 'PINTEREST_COPY_REVIEW_REQUIRED', target, postId: post.id,
            message: 'Review the Pinterest description so it contains 1 to 800 characters.',
          })
          continue
        }
        try {
          const options = parsePinterestPostOptions({
            ...(requestBody.pinterestOptionsByPostId?.[post.id] || {}),
            explicitConsent: publishMode === 'AUTO' && requestBody.explicitAutoPublishConfirmed === true,
          })
          const board = pinterestBoardsFromConfig(config).find(item => item.id === options.boardId)
          if (!board) throw new Error('Select a Board authorized by this Pinterest connection')
          pageId = board.id
          pageName = board.name
          platformOptions = options as unknown as Record<string, unknown>
        } catch (error) {
          if (publishMode === 'AUTO') blockers.push({
            code: 'PINTEREST_REVIEW_REQUIRED', target, postId: post.id,
            message: error instanceof Error ? error.message : 'Review the Pinterest Pin settings.',
          })
          continue
        }
      } else if (target === 'THREADS') {
        if (publishMode === 'AUTO' && post.isVideoPost) {
          blockers.push({
            code: 'THREADS_VIDEO_NOT_SUPPORTED', target, postId: post.id,
            message: 'Threads automatic publishing currently supports reviewed text and image posts only.',
          })
          continue
        }
        if (publishMode === 'AUTO' && String(config.accessTier || '').toUpperCase() !== 'LIVE') {
          blockers.push({
            code: 'THREADS_LIVE_ACCESS_REQUIRED', target, postId: post.id,
            message: 'The Threads app must be Live before NEXUS can schedule posts for public users.',
          })
          continue
        }
        if (publishMode === 'AUTO' && THREADS_OPERATIONAL_SCOPES.some(scope => !hasVerifiedProviderScope(config, scope))) {
          blockers.push({
            code: 'PLATFORM_SCOPE_REQUIRED', target, postId: post.id,
            message: 'Reconnect Threads and grant verified identity, publishing, and insight permissions.',
          })
          continue
        }
        if (publishMode === 'AUTO' && (!integration.accountId || !integration.accessToken)) {
          blockers.push({
            code: 'THREADS_LONG_LIVED_ACCESS_REQUIRED', target, postId: post.id,
            message: 'Reconnect Threads with a valid long-lived access token before scheduled publishing.',
          })
          continue
        }
        const copyLength = Array.from(String(post.caption || '').trim()).length
        if (publishMode === 'AUTO' && (copyLength === 0 || copyLength > THREADS_MAX_TEXT_LENGTH)) {
          blockers.push({
            code: 'THREADS_COPY_REVIEW_REQUIRED', target, postId: post.id,
            message: `Review the Threads post so it contains 1 to ${THREADS_MAX_TEXT_LENGTH} characters.`,
          })
          continue
        }
        if (publishMode === 'AUTO') {
          try {
            platformOptions = parseThreadsPostOptions({
              ...(requestBody.threadsOptionsByPostId?.[post.id] || {}),
              explicitConsent: requestBody.explicitAutoPublishConfirmed === true,
            }, { hasImage: Boolean(post.imageUrl) }) as unknown as Record<string, unknown>
          } catch (error) {
            blockers.push({
              code: 'THREADS_REVIEW_REQUIRED', target, postId: post.id,
              message: error instanceof Error ? error.message : 'Review the Threads publishing settings.',
            })
            continue
          }
        }
      }
      assignmentById.set(post.id, { integrationId: integration.id, pageId, pageName, platformOptions, publishTarget: target })
    }

    if (publishMode === 'AUTO' && blockers.length > 0) {
      return NextResponse.json({
        error: 'Automatic publishing is not ready for every approved post.',
        code: 'AUTO_PUBLISH_READINESS_REQUIRED',
        blockers,
      }, { status: 409 })
    }

    const skippedInvalidDate = approvedPosts.filter((p: any) => !hasValidPlannedDate(p.scheduledAt)).length
    const plan = planScheduling(
      approvedPosts.map((p: any) => ({
        id: p.id,
        workspaceId: campaign.workspaceId,
        status: 'APPROVED' as const,
        scheduledAt: p.scheduledAt,
      })),
      { actor: 'USER' }
    )

    if (plan.updates.length === 0) {
      return NextResponse.json({
        success: true,
        scheduled: 0,
        skippedInvalidDate,
        message: 'No approved posts with valid planned dates to schedule',
      })
    }
    const platformById = new Map(approvedPosts.map((p: any) => [p.id, String(p.publishTarget || p.platform)]))
    const hasIntegrationById = new Map(approvedPosts.map((p: any) => [p.id, !!p.integrationId]))
    const scheduledIds = new Set(plan.updates.map((u) => u.id))

    let scheduled = 0
    for (const u of plan.updates) {
      const match = assignmentById.get(u.id)
      const needsIntegration = !hasIntegrationById.get(u.id)
      await (prisma.socialPost as any).update({
        where: { id: u.id },
        data: {
          status: u.data.status, // SCHEDULED — planned scheduledAt is kept, never overwritten
          publishMode,
          ...(publishMode === 'AUTO' ? { autoPublishConsentAt: new Date() } : {}),
          ...((publishMode === 'AUTO' || needsIntegration) && match ? {
            integrationId: match.integrationId,
            pageId: match.pageId,
            pageName: match.pageName,
            platformOptions: match.platformOptions as any,
            publishTarget: match.publishTarget,
          } : {}),
        },
      })
      scheduled++
    }

    if (plan.history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: plan.history })
        .catch((e: any) => console.error('[schedule-content-plan] history write failed', e?.message))
    }

    // Brand Brain (PR1): one POST_SCHEDULED event per actual APPROVED → SCHEDULED move.
    const scheduleEvents = buildLearningEvents(
      plan.history.map((h: any) => ({
        workspaceId: h.workspaceId,
        campaignId: campaign.id,
        socialPostId: h.socialPostId,
        from: h.fromStatus ?? null,
        to: h.toStatus,
        actor: h.actor,
        publishMode,
        platform: (platformById.get(h.socialPostId) as string | undefined) ?? null,
      }))
    )
    if (scheduleEvents.length > 0) {
      await (prisma as any).marketingLearningEvent
        .createMany({ data: scheduleEvents })
        .catch((e: any) => console.error('[schedule-content-plan] learning event write failed', e?.message))
    }

    const linked = approvedPosts.filter((p: any) => scheduledIds.has(p.id) && assignmentById.has(p.id)).length
    const message = skippedInvalidDate > 0
      ? `${scheduled} post${scheduled !== 1 ? 's' : ''} scheduled · ${skippedInvalidDate} skipped because planned dates were missing or invalid`
      : `${scheduled} post${scheduled !== 1 ? 's' : ''} scheduled`
    return NextResponse.json({
      success: true,
      scheduled,
      linked,
      skippedInvalidDate,
      message,
      publishMode,
    })
  } catch (err: any) {
    console.error('[schedule-content-plan POST]', err)
    return NextResponse.json({ error: 'Failed to schedule content plan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
      select: { id: true, workspaceId: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Unschedule: SCHEDULED → APPROVED (keeps approval). Only unpublished posts.
    const scheduledPosts = await (prisma.socialPost as any).findMany({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: 'SCHEDULED',
        publishedAt: null,
      },
      select: { id: true },
    })

    let reverted = 0
    const history: any[] = []
    for (const p of scheduledPosts) {
      if (!validateTransition('SCHEDULED', 'APPROVED').ok) continue
      await (prisma.socialPost as any).update({ where: { id: p.id }, data: { status: 'APPROVED' } })
      history.push(buildStatusHistory({ socialPostId: p.id, workspaceId: campaign.workspaceId, fromStatus: 'SCHEDULED', toStatus: 'APPROVED', actor: 'USER', note: 'unschedule' }))
      reverted++
    }
    if (history.length > 0) {
      await (prisma as any).postStatusHistory
        .createMany({ data: history })
        .catch((e: any) => console.error('[schedule-content-plan DELETE] history write failed', e?.message))
    }

    // Brand Brain (PR1): one POST_UNSCHEDULED event per actual SCHEDULED → APPROVED move.
    const unscheduleEvents = buildLearningEvents(
      history.map((h: any) => ({
        workspaceId: h.workspaceId,
        campaignId: campaign.id,
        socialPostId: h.socialPostId,
        from: h.fromStatus ?? null,
        to: h.toStatus,
        actor: h.actor,
        publishMode: 'MANUAL',
      }))
    )
    if (unscheduleEvents.length > 0) {
      await (prisma as any).marketingLearningEvent
        .createMany({ data: unscheduleEvents })
        .catch((e: any) => console.error('[schedule-content-plan DELETE] learning event write failed', e?.message))
    }

    return NextResponse.json({ success: true, reverted })
  } catch (err: any) {
    console.error('[schedule-content-plan DELETE]', err)
    return NextResponse.json({ error: 'Failed to unschedule content plan' }, { status: 500 })
  }
}
