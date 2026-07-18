import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetServerUserId, mockGeneratedVisual } = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockGeneratedVisual: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: { generatedVisual: mockGeneratedVisual } }))

import { DELETE, GET, PATCH } from '../route'

const request = (body?: unknown) => ({
  json: async () => body ?? {},
}) as any
const params = { params: Promise.resolve({ id: 'visual_1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('owner_1')
})

describe('/api/visuals/[id] workspace isolation', () => {
  it('scopes polling reads to the authenticated workspace owner', async () => {
    mockGeneratedVisual.findFirst.mockResolvedValue({ id: 'visual_1', status: 'GENERATING' })

    const response = await GET(request(), params)

    expect(response.status).toBe(200)
    expect(mockGeneratedVisual.findFirst).toHaveBeenCalledWith({
      where: { id: 'visual_1', workspace: { ownerId: 'owner_1' } },
    })
  })

  it('returns 404 and never mutates a visual outside the user workspace', async () => {
    mockGeneratedVisual.findFirst.mockResolvedValue(null)

    const patchResponse = await PATCH(request({ isArchived: true }), params)
    const deleteResponse = await DELETE(request(), params)

    expect(patchResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
    expect(mockGeneratedVisual.update).not.toHaveBeenCalled()
  })
})
