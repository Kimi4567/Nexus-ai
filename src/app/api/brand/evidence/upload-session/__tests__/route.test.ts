import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, prismaMock, signedUploadMock, rateLimitMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  rateLimitMock: vi.fn(),
  signedUploadMock: vi.fn(),
  prismaMock: {
    workspace: { findFirst: vi.fn() },
    brandEvidenceDocument: { aggregate: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: authMock }))
vi.mock('@/lib/dbRateLimit', () => ({ uploadSessionRateLimitDb: rateLimitMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/supabaseAuth', () => ({
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ createSignedUploadUrl: signedUploadMock }) },
  }),
}))

import { POST } from '../route'

const request = (body: Record<string, unknown>) => ({ json: async () => body }) as any

describe('brand evidence secure upload session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ id: 'user-1' })
    rateLimitMock.mockResolvedValue({ ok: true })
    prismaMock.workspace.findFirst.mockResolvedValue({ id: 'workspace-1' })
    prismaMock.brandEvidenceDocument.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { sizeBytes: null } })
    prismaMock.brandEvidenceDocument.create.mockResolvedValue({ id: 'document-1' })
    prismaMock.brandEvidenceDocument.delete.mockResolvedValue({})
    signedUploadMock.mockResolvedValue({ data: { token: 'signed-token' }, error: null })
  })

  it('creates a workspace-scoped private upload path and returns only a short-lived token', async () => {
    const response = await POST(request({ fileName: '../../Brand Proof.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }))
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(prismaMock.brandEvidenceDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        originalName: '../../Brand Proof.pdf',
        storageBucket: 'brand-evidence',
        storagePath: expect.stringMatching(/^workspace-1\/[0-9a-f-]+\/Brand-Proof\.pdf$/),
      }),
      select: { id: true },
    })
    expect(payload).not.toHaveProperty('signedUrl')
    expect(payload).not.toHaveProperty('publicUrl')
    expect(payload.token).toBe('signed-token')
  })

  it('rejects unsupported files before touching the database or storage', async () => {
    const response = await POST(request({ fileName: 'payload.exe', mimeType: 'application/octet-stream', sizeBytes: 100 }))
    expect(response.status).toBe(400)
    expect(prismaMock.workspace.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.brandEvidenceDocument.create).not.toHaveBeenCalled()
    expect(signedUploadMock).not.toHaveBeenCalled()
  })

  it('removes the pending database record when signing fails', async () => {
    signedUploadMock.mockResolvedValueOnce({ data: null, error: new Error('storage unavailable') })
    const response = await POST(request({ fileName: 'proof.pdf', mimeType: 'application/pdf', sizeBytes: 100 }))
    expect(response.status).toBe(503)
    expect(prismaMock.brandEvidenceDocument.delete).toHaveBeenCalledWith({ where: { id: 'document-1' } })
  })

  it('enforces the workspace storage ceiling before signing or creating a row', async () => {
    prismaMock.brandEvidenceDocument.aggregate.mockResolvedValueOnce({
      _count: { _all: 10 },
      _sum: { sizeBytes: 1024 },
    })
    const response = await POST(request({ fileName: 'proof.pdf', mimeType: 'application/pdf', sizeBytes: 100 }))
    expect(response.status).toBe(409)
    expect(prismaMock.brandEvidenceDocument.create).not.toHaveBeenCalled()
    expect(signedUploadMock).not.toHaveBeenCalled()
  })
})
