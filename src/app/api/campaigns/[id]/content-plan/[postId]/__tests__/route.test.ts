import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  postFindFirst: vi.fn(),
  postUpdate: vi.fn(),
  visualFindFirst: vi.fn(),
  mediaFindUnique: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    socialPost: { findFirst: mocks.postFindFirst, update: mocks.postUpdate },
    generatedVisual: { findFirst: mocks.visualFindFirst },
    media: { findUnique: mocks.mediaFindUnique },
  },
}))

import { PATCH } from '../route'

const params = { params: Promise.resolve({ id: 'campaign-1', postId: 'post-1' }) }

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/content-plan/post-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.postFindFirst.mockResolvedValue({
    id: 'post-1',
    workspaceId: 'workspace-1',
    campaignId: 'campaign-1',
    imagePrompt: 'Original prompt',
    imageUrl: null,
    uploadedMediaId: null,
    mediaSource: 'GENERATE',
    generationStatus: 'PENDING',
  })
  mocks.visualFindFirst.mockResolvedValue({
    id: 'visual-1',
    imageUrl: 'https://res.cloudinary.com/demo/visual-1.jpg',
  })
  mocks.postUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'post-1',
    ...data,
  }))
})

describe('PATCH Content Hub post media integrity', () => {
  it('rejects client-authored media readiness fields', async () => {
    const response = await PATCH(request({
      imageUrl: 'https://attacker.example/fake.jpg',
      generationStatus: 'DONE',
      mediaSource: 'GENERATE',
    }), params)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('SERVER_CONTROLLED_MEDIA_STATE')
    expect(mocks.postUpdate).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation before attaching generated media', async () => {
    const response = await PATCH(request({ generatedVisualId: 'visual-1' }), params)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('GENERATED_MEDIA_CONFIRMATION_REQUIRED')
    expect(mocks.visualFindFirst).not.toHaveBeenCalled()
  })

  it('only attaches a completed visual owned by this workspace and campaign', async () => {
    const response = await PATCH(request({
      generatedVisualId: 'visual-1',
      explicitGeneratedMediaAttachConfirmed: true,
    }), params)

    expect(response.status).toBe(200)
    expect(mocks.visualFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'visual-1',
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        status: 'COMPLETED',
        imageUrl: { not: null },
        isArchived: false,
      },
      select: { id: true, imageUrl: true },
    })
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'post-1' },
      data: expect.objectContaining({
        imageUrl: 'https://res.cloudinary.com/demo/visual-1.jpg',
        uploadedMediaId: null,
        mediaSource: 'GENERATE',
        generationStatus: 'DONE',
      }),
    }))
  })

  it('does not accept a generated visual that fails the ownership query', async () => {
    mocks.visualFindFirst.mockResolvedValue(null)
    const response = await PATCH(request({
      generatedVisualId: 'visual-other-workspace',
      explicitGeneratedMediaAttachConfirmed: true,
    }), params)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe('GENERATED_MEDIA_NOT_FOUND')
    expect(mocks.postUpdate).not.toHaveBeenCalled()
  })

  it('invalidates stale generated media when its prompt changes', async () => {
    mocks.postFindFirst.mockResolvedValue({
      id: 'post-1',
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      imagePrompt: 'Original prompt',
      imageUrl: 'https://res.cloudinary.com/demo/old.jpg',
      uploadedMediaId: null,
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
    })

    const response = await PATCH(request({ imagePrompt: 'New approved direction' }), params)

    expect(response.status).toBe(200)
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        imagePrompt: 'New approved direction',
        imageUrl: null,
        uploadedMediaId: null,
        generationStatus: 'PENDING',
      }),
    }))
  })
})
