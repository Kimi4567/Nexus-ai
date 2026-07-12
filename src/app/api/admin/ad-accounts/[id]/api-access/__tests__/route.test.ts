import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
} from '@/lib/metaAdsApiAccess'

const {
  mockGetAuthUser,
  mockUserFindUnique,
  mockAdAccountFindUnique,
  mockAdAccountUpdate,
  mockReviewCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockAdAccountFindUnique: vi.fn(),
  mockAdAccountUpdate: vi.fn(),
  mockReviewCreate: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({
  getAuthUser: mockGetAuthUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    user: {
      findUnique: mockUserFindUnique,
    },
    adAccount: {
      findUnique: mockAdAccountFindUnique,
      update: mockAdAccountUpdate,
    },
    adAccountApiAccessReview: {
      create: mockReviewCreate,
    },
  },
}))

import { GET, PATCH } from '../route'

function req(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers({ authorization: 'Bearer test' }),
  } as any
}

const params = { params: Promise.resolve({ id: 'ad_account_1' }) }

const connectedMetaAdAccount = {
  id: 'ad_account_1',
  platform: 'META',
  status: 'ACTIVE',
  hasApiAccess: false,
  accessToken: 'encrypted-token',
  permissionScopes: ['public_profile', 'ads_management', 'ads_read', 'business_management'],
  platformAccountId: 'act_123',
  platformAccountName: 'Test Ad Account',
  pageId: 'page_1',
  pageName: 'Test Page',
  businessId: 'biz_1',
  businessName: 'Test Business',
  workspaceId: 'workspace_1',
  updatedAt: new Date('2026-07-06T00:00:00Z'),
}

const reviewRow = {
  id: 'review_1',
  reviewedById: 'admin_1',
  reviewedByEmail: 'admin@nexus-grow.com',
  previousHasApiAccess: false,
  nextHasApiAccess: true,
  evidenceUrl: 'https://developers.facebook.com/apps/123/app-review/',
  reason: 'Meta App Review approved for Marketing API.',
  missingScopes: [],
  createdAt: new Date('2026-07-06T01:00:00Z'),
}

describe('PATCH /api/admin/ad-accounts/[id]/api-access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue({ id: 'admin_1', email: 'admin@nexus-grow.com' })
    mockUserFindUnique.mockResolvedValue({ role: 'ADMIN', email: 'admin@nexus-grow.com' })
    mockAdAccountFindUnique.mockResolvedValue(connectedMetaAdAccount)
    mockAdAccountUpdate.mockResolvedValue({ ...connectedMetaAdAccount, hasApiAccess: true })
    mockReviewCreate.mockResolvedValue(reviewRow)
    mockTransaction.mockImplementation(async (fn) => fn({
      adAccount: { update: mockAdAccountUpdate },
      adAccountApiAccessReview: { create: mockReviewCreate },
    }))
  })

  it('requires admin role', async () => {
    mockUserFindUnique.mockResolvedValue({ role: 'USER', email: 'user@nexus-grow.com' })

    const res = await PATCH(req({ hasApiAccess: true }), params)

    expect(res.status).toBe(403)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockAdAccountUpdate).not.toHaveBeenCalled()
    expect(mockReviewCreate).not.toHaveBeenCalled()
  })

  it('rejects enablement without explicit Meta review confirmation', async () => {
    const res = await PATCH(req({
      hasApiAccess: true,
      confirmation: 'yes',
      evidenceUrl: 'https://developers.facebook.com/apps/123/app-review/',
    }), params)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'explicit_meta_review_confirmation_required' })
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockAdAccountUpdate).not.toHaveBeenCalled()
    expect(mockReviewCreate).not.toHaveBeenCalled()
  })

  it('marks API access ready and writes a durable review ledger row', async () => {
    const res = await PATCH(req({
      hasApiAccess: true,
      confirmation: META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
      evidenceUrl: 'https://developers.facebook.com/apps/123/app-review/',
      reason: 'Meta App Review approved for Marketing API.',
    }), params)

    expect(res.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalled()
    expect(mockAdAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'ad_account_1' },
      data: { hasApiAccess: true },
      select: expect.objectContaining({
        id: true,
        hasApiAccess: true,
        platformAccountId: true,
      }),
    })
    expect(mockReviewCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adAccountId: 'ad_account_1',
        workspaceId: 'workspace_1',
        reviewedById: 'admin_1',
        reviewedByEmail: 'admin@nexus-grow.com',
        previousHasApiAccess: false,
        nextHasApiAccess: true,
        confirmation: META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
        evidenceUrl: 'https://developers.facebook.com/apps/123/app-review/',
        reason: 'Meta App Review approved for Marketing API.',
        missingScopes: [],
      }),
      select: expect.objectContaining({
        id: true,
        reviewedById: true,
        previousHasApiAccess: true,
        nextHasApiAccess: true,
      }),
    })
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.apiAccessState).toBe('reviewed_api_ready')
    expect(json.operatorReceipt.reviewedBy).toBe('admin_1')
    expect(json.operatorReceipt.reviewId).toBe('review_1')
    expect(json.operatorReceipt.durableAuditLog).toBe(true)
    expect(json.review.id).toBe('review_1')
  })

  it('returns recent review history without exposing access tokens', async () => {
    mockAdAccountFindUnique.mockResolvedValue({
      ...connectedMetaAdAccount,
      hasApiAccess: true,
      apiAccessReviews: [reviewRow],
    })

    const res = await GET(req(null), params)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.apiAccessState).toBe('reviewed_api_ready')
    expect(json.account.accessToken).toBeUndefined()
    expect(json.reviews).toHaveLength(1)
    expect(json.reviews[0].id).toBe('review_1')
  })

  it('does not call platform APIs, credits, generation, or publish routes', async () => {
    const routeSource = await import('node:fs').then(({ readFileSync }) =>
      readFileSync('src/app/api/admin/ad-accounts/[id]/api-access/route.ts', 'utf8'),
    )

    expect(routeSource).not.toContain('graph.facebook.com')
    expect(routeSource).not.toContain('checkAndDeductCredits')
    expect(routeSource).not.toContain('updateCampaignStatus')
    expect(routeSource).not.toContain('pushToPlatform')
    expect(routeSource).not.toContain('/api/social/publish')
  })
})
