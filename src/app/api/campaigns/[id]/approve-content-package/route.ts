import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'
import { parseIdempotencyKey } from '@/lib/idempotencyKey.server'
import { prisma } from '@/lib/prisma'
import { POST as approveContentPlan } from '@/app/api/campaigns/[id]/approve-content-plan/route'
import { POST as approveMediaPlan } from '@/app/api/campaigns/[id]/approve-media-plan/route'
import { POST as scheduleContentPlan } from '@/app/api/campaigns/[id]/schedule-content-plan/route'

type Params = { params: Promise<{ id: string }> }
type PackageConsent = {
  authorized?: unknown
  publishMode?: unknown
  scheduledAtByPostId?: unknown
  explicitWeakMediaApprovalConfirmed?: unknown
}

type PackagePost = {
  id: string
  status: string
  scheduledAt: Date | null
  imageUrl: string | null
  uploadedMediaId: string | null
  mediaSource: string | null
  generationStatus: string | null
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function responsePayload(response: Response): Promise<Record<string, unknown>> {
  return objectRecord(await response.json().catch(() => ({})))
}

function internalRequest(
  request: NextRequest,
  pathname: string,
  body: Record<string, unknown>,
): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const authorization = request.headers.get('authorization')
  if (authorization) headers.set('Authorization', authorization)
  return new NextRequest(new URL(pathname, request.url), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function partialResponse(input: {
  response: Response
  payload: Record<string, unknown>
  stage: 'CONTENT_APPROVAL' | 'MEDIA_APPROVAL' | 'SCHEDULE'
  contentApprovalRecorded: boolean
  mediaApprovalRecorded: boolean
}) {
  return NextResponse.json({
    ...input.payload,
    success: false,
    packageState: 'NEEDS_REVIEW',
    failedStage: input.stage,
    contentApprovalRecorded: input.contentApprovalRecorded,
    mediaApprovalRecorded: input.mediaApprovalRecorded,
    scheduleRecorded: false,
    creditsCharged: 0,
    publishAuthorized: false,
    spendAuthorized: false,
  }, {
    status: input.response.status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function POST(request: NextRequest, props: Params) {
  const { id } = await props.params
  const userId = await getServerUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const operationKey = parseIdempotencyKey(request)
  if (!operationKey) {
    return NextResponse.json({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'A valid Idempotency-Key is required for package approval.',
    }, { status: 400 })
  }

  const body = await request.json().catch(() => ({})) as { consent?: PackageConsent }
  const consent = body.consent
  if (consent?.authorized !== true || consent.publishMode !== 'MANUAL') {
    return NextResponse.json({
      error: 'CONTENT_PACKAGE_CONSENT_REQUIRED',
      message: 'Explicit consent is required for copy, media, and the internal manual schedule.',
      publishAuthorized: false,
      spendAuthorized: false,
    }, { status: 400 })
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspace: { ownerId: userId } },
    select: { id: true, workspaceId: true },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const posts = await prisma.socialPost.findMany({
    where: {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      publishedAt: null,
      status: { in: ['DRAFT', 'APPROVED', 'SCHEDULED'] },
    },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      imageUrl: true,
      uploadedMediaId: true,
      mediaSource: true,
      generationStatus: true,
    },
    orderBy: [{ contentPlanIndex: 'asc' }, { createdAt: 'asc' }],
  }) as PackagePost[]

  if (posts.length === 0) {
    return NextResponse.json({
      error: 'CONTENT_PACKAGE_REQUIRED',
      message: 'No reviewable content package exists for this campaign.',
    }, { status: 409 })
  }

  const reviewablePosts = posts.filter(post => post.status === 'DRAFT' || post.status === 'APPROVED')
  if (reviewablePosts.length === 0 && posts.every(post => post.status === 'SCHEDULED')) {
    return NextResponse.json({
      success: true,
      unchanged: true,
      packageState: 'SCHEDULE_RETAINED',
      scheduled: posts.length,
      contentApprovalRecorded: true,
      mediaApprovalRecorded: true,
      scheduleRecorded: true,
      creditsCharged: 0,
      publishAuthorized: false,
      spendAuthorized: false,
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const pendingMedia = reviewablePosts.filter(
    post => !isContentPostMediaReadyForScheduling(post),
  )
  if (pendingMedia.length > 0) {
    return NextResponse.json({
      error: 'MEDIA_REVIEW_REQUIRED',
      message: 'Complete final media for every post before approving the package.',
      pendingMedia: pendingMedia.length,
      postIds: pendingMedia.map(post => post.id),
      contentApprovalRecorded: false,
      mediaApprovalRecorded: false,
      scheduleRecorded: false,
      creditsCharged: 0,
      publishAuthorized: false,
      spendAuthorized: false,
    }, { status: 409 })
  }

  const submittedDates = objectRecord(consent.scheduledAtByPostId)
  const knownPostIds = new Set(posts.map(post => post.id))
  const unknownPostIds = Object.keys(submittedDates).filter(postId => !knownPostIds.has(postId))
  if (unknownPostIds.length > 0) {
    return NextResponse.json({
      error: 'SCHEDULE_DATE_POST_MISMATCH',
      message: 'The package includes dates for posts outside the reviewed batch.',
      postIds: unknownPostIds,
    }, { status: 409 })
  }

  const reviewedSchedule: Record<string, string> = {}
  const decisionAt = Date.now()
  const dateBlockers = reviewablePosts.flatMap(post => {
    const value = submittedDates[post.id]
    const candidate = typeof value === 'string' ? new Date(value) : new Date(Number.NaN)
    if (Number.isNaN(candidate.getTime())) {
      return [{ postId: post.id, code: 'SCHEDULE_DATE_REQUIRED' }]
    }
    if (candidate.getTime() <= decisionAt) {
      return [{ postId: post.id, code: 'SCHEDULE_DATE_IN_PAST' }]
    }
    reviewedSchedule[post.id] = candidate.toISOString()
    return []
  })
  if (dateBlockers.length > 0) {
    return NextResponse.json({
      error: 'SCHEDULE_DATE_REVIEW_REQUIRED',
      message: 'Review a valid future date for every post before approving the package.',
      blockers: dateBlockers,
      contentApprovalRecorded: false,
      mediaApprovalRecorded: false,
      scheduleRecorded: false,
      creditsCharged: 0,
      publishAuthorized: false,
      spendAuthorized: false,
    }, { status: 409 })
  }

  const routeContext = { params: Promise.resolve({ id }) }
  const contentResponse = await approveContentPlan(
    internalRequest(
      request,
      `/api/campaigns/${encodeURIComponent(id)}/approve-content-plan`,
      { mode: 'approve' },
    ),
    routeContext,
  )
  const contentPayload = await responsePayload(contentResponse)
  if (!contentResponse.ok) {
    return partialResponse({
      response: contentResponse,
      payload: contentPayload,
      stage: 'CONTENT_APPROVAL',
      contentApprovalRecorded: false,
      mediaApprovalRecorded: false,
    })
  }

  const mediaResponse = await approveMediaPlan(
    internalRequest(
      request,
      `/api/campaigns/${encodeURIComponent(id)}/approve-media-plan`,
      {
        explicitWeakMediaApprovalConfirmed:
          consent.explicitWeakMediaApprovalConfirmed === true,
      },
    ),
    routeContext,
  )
  const mediaPayload = await responsePayload(mediaResponse)
  if (!mediaResponse.ok) {
    return partialResponse({
      response: mediaResponse,
      payload: mediaPayload,
      stage: 'MEDIA_APPROVAL',
      contentApprovalRecorded: true,
      mediaApprovalRecorded: false,
    })
  }

  // A retry may contain posts that were already scheduled by the first
  // response. Send dates only for the still-approved subset so the scheduling
  // route can resume without treating retained schedule entries as foreign.
  const approvedPosts = await prisma.socialPost.findMany({
    where: {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      publishedAt: null,
      status: 'APPROVED',
    },
    select: { id: true },
  })
  const remainingSchedule = Object.fromEntries(
    approvedPosts.flatMap(post => (
      reviewedSchedule[post.id] ? [[post.id, reviewedSchedule[post.id]]] : []
    )),
  )

  const scheduleResponse = await scheduleContentPlan(
    internalRequest(
      request,
      `/api/campaigns/${encodeURIComponent(id)}/schedule-content-plan`,
      {
        publishMode: 'MANUAL',
        explicitAutoPublishConfirmed: false,
        scheduledAtByPostId: remainingSchedule,
      },
    ),
    routeContext,
  )
  const schedulePayload = await responsePayload(scheduleResponse)
  if (!scheduleResponse.ok) {
    return partialResponse({
      response: scheduleResponse,
      payload: schedulePayload,
      stage: 'SCHEDULE',
      contentApprovalRecorded: true,
      mediaApprovalRecorded: true,
    })
  }

  const scheduled = await prisma.socialPost.count({
    where: {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      publishedAt: null,
      status: 'SCHEDULED',
    },
  })

  return NextResponse.json({
    success: true,
    unchanged: false,
    packageState: 'SCHEDULE_RECORDED',
    contentApproval: contentPayload,
    mediaApproval: mediaPayload,
    schedule: schedulePayload,
    scheduled,
    contentApprovalRecorded: true,
    mediaApprovalRecorded: true,
    scheduleRecorded: true,
    creditsCharged: 0,
    publishAuthorized: false,
    spendAuthorized: false,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
