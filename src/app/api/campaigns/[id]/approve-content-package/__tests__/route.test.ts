import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  campaignFindFirst: vi.fn(),
  postFindMany: vi.fn(),
  postCount: vi.fn(),
  approveContent: vi.fn(),
  approveMedia: vi.fn(),
  scheduleContent: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    socialPost: {
      findMany: mocks.postFindMany,
      count: mocks.postCount,
    },
  },
}))
vi.mock('@/app/api/campaigns/[id]/approve-content-plan/route', () => ({
  POST: mocks.approveContent,
}))
vi.mock('@/app/api/campaigns/[id]/approve-media-plan/route', () => ({
  POST: mocks.approveMedia,
}))
vi.mock('@/app/api/campaigns/[id]/schedule-content-plan/route', () => ({
  POST: mocks.scheduleContent,
}))

import { POST } from '../route'

const context = { params: Promise.resolve({ id: 'campaign-1' }) }
const futureDate = '2026-08-20T10:00:00.000Z'
const readyDraft = {
  id: 'post-1',
  status: 'DRAFT',
  scheduledAt: new Date(futureDate),
  imageUrl: 'https://cdn.example.com/post.jpg',
  uploadedMediaId: null,
  mediaSource: 'GENERATE',
  generationStatus: 'DONE',
}

function request(
  overrides: Record<string, unknown> = {},
  idempotencyKey = 'content-package-command-123',
) {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/approve-content-package', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer session',
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      consent: {
        authorized: true,
        publishMode: 'MANUAL',
        scheduledAtByPostId: { 'post-1': futureDate },
      },
      ...overrides,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.setSystemTime(new Date('2026-08-01T10:00:00.000Z'))
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.campaignFindFirst.mockResolvedValue({
    id: 'campaign-1',
    workspaceId: 'workspace-1',
  })
  mocks.postFindMany.mockReset()
  mocks.postFindMany
    .mockResolvedValueOnce([readyDraft])
    .mockResolvedValueOnce([{ id: 'post-1' }])
  mocks.postCount.mockResolvedValue(1)
  mocks.approveContent.mockResolvedValue(NextResponse.json({
    success: true,
    approved: 1,
    snapshot: { id: 'content-snapshot-1' },
  }))
  mocks.approveMedia.mockResolvedValue(NextResponse.json({
    success: true,
    approved: 1,
    snapshot: { id: 'media-snapshot-1' },
  }))
  mocks.scheduleContent.mockResolvedValue(NextResponse.json({
    success: true,
    scheduled: 1,
    publishMode: 'MANUAL',
    snapshot: { id: 'schedule-snapshot-1' },
  }))
})

describe('POST approve-content-package', () => {
  it('requires authentication before reading or changing the package', async () => {
    mocks.getUserId.mockResolvedValueOnce(null)

    const response = await POST(request(), context)

    expect(response.status).toBe(401)
    expect(mocks.campaignFindFirst).not.toHaveBeenCalled()
    expect(mocks.approveContent).not.toHaveBeenCalled()
  })

  it('requires replay protection and explicit manual-schedule consent', async () => {
    const missingKey = await POST(request({}, ''), context)
    expect(missingKey.status).toBe(400)
    await expect(missingKey.json()).resolves.toMatchObject({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
    })

    const autoPublishConsent = await POST(request({
      consent: {
        authorized: true,
        publishMode: 'AUTO',
        scheduledAtByPostId: { 'post-1': futureDate },
      },
    }), context)
    expect(autoPublishConsent.status).toBe(400)
    await expect(autoPublishConsent.json()).resolves.toMatchObject({
      error: 'CONTENT_PACKAGE_CONSENT_REQUIRED',
      publishAuthorized: false,
      spendAuthorized: false,
    })
    expect(mocks.approveContent).not.toHaveBeenCalled()
  })

  it('blocks incomplete media before recording copy approval', async () => {
    mocks.postFindMany.mockReset()
    mocks.postFindMany.mockResolvedValueOnce([{
      ...readyDraft,
      imageUrl: null,
      generationStatus: 'PENDING',
    }])

    const response = await POST(request(), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'MEDIA_REVIEW_REQUIRED',
      pendingMedia: 1,
      contentApprovalRecorded: false,
      creditsCharged: 0,
      publishAuthorized: false,
    })
    expect(mocks.approveContent).not.toHaveBeenCalled()
  })

  it('validates every reviewed future date before recording copy approval', async () => {
    const response = await POST(request({
      consent: {
        authorized: true,
        publishMode: 'MANUAL',
        scheduledAtByPostId: { 'post-1': '2026-07-01T10:00:00.000Z' },
      },
    }), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'SCHEDULE_DATE_REVIEW_REQUIRED',
      contentApprovalRecorded: false,
      scheduleRecorded: false,
    })
    expect(mocks.approveContent).not.toHaveBeenCalled()
  })

  it('approves copy and media then records only an internal manual schedule', async () => {
    const response = await POST(request(), context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      packageState: 'SCHEDULE_RECORDED',
      scheduled: 1,
      contentApprovalRecorded: true,
      mediaApprovalRecorded: true,
      scheduleRecorded: true,
      creditsCharged: 0,
      publishAuthorized: false,
      spendAuthorized: false,
    })
    expect(mocks.approveContent).toHaveBeenCalledTimes(1)
    expect(mocks.approveMedia).toHaveBeenCalledTimes(1)
    expect(mocks.scheduleContent).toHaveBeenCalledTimes(1)

    const [scheduleRequest] = mocks.scheduleContent.mock.calls[0]
    expect(scheduleRequest.headers.get('Authorization')).toBe('Bearer session')
    await expect(scheduleRequest.json()).resolves.toEqual({
      publishMode: 'MANUAL',
      explicitAutoPublishConfirmed: false,
      scheduledAtByPostId: { 'post-1': futureDate },
    })
  })

  it('reports truthful partial success when media approval needs review', async () => {
    mocks.approveMedia.mockResolvedValueOnce(NextResponse.json({
      error: 'Weak media needs an explicit override.',
      code: 'WEAK_MEDIA_OVERRIDE_CONFIRMATION_REQUIRED',
    }, { status: 409 }))

    const response = await POST(request(), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'WEAK_MEDIA_OVERRIDE_CONFIRMATION_REQUIRED',
      packageState: 'NEEDS_REVIEW',
      failedStage: 'MEDIA_APPROVAL',
      contentApprovalRecorded: true,
      mediaApprovalRecorded: false,
      scheduleRecorded: false,
      publishAuthorized: false,
    })
    expect(mocks.scheduleContent).not.toHaveBeenCalled()
  })

  it('reports that copy and media remain approved when scheduling fails', async () => {
    mocks.scheduleContent.mockResolvedValueOnce(NextResponse.json({
      error: 'A reviewed date changed.',
      code: 'SCHEDULE_CONCURRENT_CHANGE',
    }, { status: 409 }))

    const response = await POST(request(), context)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SCHEDULE_CONCURRENT_CHANGE',
      failedStage: 'SCHEDULE',
      contentApprovalRecorded: true,
      mediaApprovalRecorded: true,
      scheduleRecorded: false,
      creditsCharged: 0,
      publishAuthorized: false,
    })
  })

  it('retains an existing internal schedule without replaying approval steps', async () => {
    mocks.postFindMany.mockReset()
    mocks.postFindMany.mockResolvedValueOnce([{
      ...readyDraft,
      status: 'SCHEDULED',
    }])

    const response = await POST(request(), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      unchanged: true,
      packageState: 'SCHEDULE_RETAINED',
      scheduled: 1,
      scheduleRecorded: true,
      publishAuthorized: false,
      spendAuthorized: false,
    })
    expect(mocks.approveContent).not.toHaveBeenCalled()
    expect(mocks.approveMedia).not.toHaveBeenCalled()
    expect(mocks.scheduleContent).not.toHaveBeenCalled()
  })
})
