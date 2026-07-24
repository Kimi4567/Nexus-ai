import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  workspaceFindFirst: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: { workspace: { findFirst: mocks.workspaceFindFirst } },
}))
vi.mock('@/lib/approvalPreferenceLearning', () => ({
  refreshApprovalPreferenceProposals: mocks.refresh,
}))

import { POST } from '@/app/api/brain/proposals/refresh/route'

const request = {} as Request

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.refresh.mockResolvedValue({
    created: 2,
    plans: [],
    approvalEventCount: 7,
    uniqueApprovedPostCount: 3,
    duplicateApprovalEventsIgnored: 4,
  })
})

describe('POST /api/brain/proposals/refresh', () => {
  it('requires authentication', async () => {
    mocks.getAuthUser.mockResolvedValue(null)
    const response = await POST(request as any)
    expect(response.status).toBe(401)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('creates zero-credit review proposals from unique approval decisions', async () => {
    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.refresh).toHaveBeenCalledWith('workspace-1')
    expect(body).toMatchObject({
      success: true,
      creditsUsed: 0,
      created: 2,
      approvalEventCount: 7,
      uniqueApprovedPostCount: 3,
      duplicateApprovalEventsIgnored: 4,
    })
  })
})
