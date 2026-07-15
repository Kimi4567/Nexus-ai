import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, prismaMock, txMock } = vi.hoisted(() => {
  const txMock = {
    brandProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    brandEvidenceClaim: { update: vi.fn() },
    brandEvidenceDocument: { update: vi.fn() },
  }
  return {
    authMock: vi.fn(),
    txMock,
    prismaMock: {
      brandEvidenceClaim: { findFirst: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    },
  }
})

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: authMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { PATCH } from '../route'

const request = (action: string) => ({ json: async () => ({ action }) }) as any
const context = { params: Promise.resolve({ id: 'claim-1' }) }

describe('brand evidence claim review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ id: 'user-1' })
    prismaMock.brandEvidenceClaim.findFirst.mockResolvedValue({
      id: 'claim-1',
      documentId: 'document-1',
      workspaceId: 'workspace-1',
      claim: 'Nexus is ISO certified.',
      sourceLocator: 'Page 4',
      truthStatus: 'PROPOSED',
      conflictClaimId: null,
      promotedProof: null,
      document: { originalName: 'certificate.pdf' },
    })
    txMock.brandProfile.findUnique.mockResolvedValue({ verifiedProof: ['Manual proof'] })
    txMock.brandProfile.upsert.mockResolvedValue({})
    txMock.brandEvidenceClaim.update.mockResolvedValue({ id: 'claim-1', status: 'APPROVED', reviewedAt: new Date() })
    txMock.brandEvidenceDocument.update.mockResolvedValue({})
    ;(txMock.brandEvidenceClaim as any).count = vi.fn().mockResolvedValue(0)
  })

  it('promotes an approved source-linked claim and closes review when none remain', async () => {
    const response = await PATCH(request('approve'), context)
    expect(response.status).toBe(200)
    expect(txMock.brandProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1' },
      update: {
        verifiedProof: [
          'Manual proof',
          'Nexus is ISO certified. [Source: certificate.pdf — Page 4]',
        ],
      },
    }))
    expect(txMock.brandEvidenceDocument.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: { status: 'READY' },
    })
  })

  it('removes the exact promoted proof when a claim is rejected later', async () => {
    const promotedProof = 'Nexus is ISO certified. [Source: certificate.pdf — Page 4]'
    prismaMock.brandEvidenceClaim.findFirst.mockResolvedValueOnce({
      id: 'claim-1',
      documentId: 'document-1',
      workspaceId: 'workspace-1',
      claim: 'Nexus is ISO certified.',
      sourceLocator: 'Page 4',
      truthStatus: 'CONFIRMED',
      conflictClaimId: null,
      promotedProof,
      document: { originalName: 'certificate.pdf' },
    })
    txMock.brandProfile.findUnique.mockResolvedValueOnce({ verifiedProof: ['Manual proof', promotedProof] })
    txMock.brandEvidenceClaim.update.mockResolvedValueOnce({ id: 'claim-1', status: 'REJECTED', reviewedAt: new Date() })

    const response = await PATCH(request('reject'), context)
    expect(response.status).toBe(200)
    expect(txMock.brandProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { verifiedProof: ['Manual proof'] },
    }))
  })

  it('requires a separate explicit decision for conflicting numeric evidence', async () => {
    prismaMock.brandEvidenceClaim.findFirst.mockResolvedValueOnce({
      id: 'claim-1',
      documentId: 'document-1',
      workspaceId: 'workspace-1',
      claim: 'Average acquisition cost was AED 180.',
      sourceLocator: 'Page 2',
      truthStatus: 'CONFLICTING',
      conflictClaimId: 'claim-old',
      promotedProof: null,
      document: { originalName: 'new-report.pdf' },
    })

    const response = await PATCH(request('approve'), context)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      code: 'EXPLICIT_CONFLICT_APPROVAL_REQUIRED',
      conflictClaimId: 'claim-old',
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('replaces the old confirmed proof only after explicit conflict resolution', async () => {
    const previousProof = 'Average acquisition cost was AED 120. [Source: q1.pdf — Page 2]'
    prismaMock.brandEvidenceClaim.findFirst
      .mockResolvedValueOnce({
        id: 'claim-1',
        documentId: 'document-1',
        workspaceId: 'workspace-1',
        claim: 'Average acquisition cost was AED 180.',
        sourceLocator: 'Page 3',
        truthStatus: 'CONFLICTING',
        conflictClaimId: 'claim-old',
        promotedProof: null,
        document: { originalName: 'q2.pdf' },
      })
      .mockResolvedValueOnce({ id: 'claim-old', promotedProof: previousProof })
    txMock.brandProfile.findUnique.mockResolvedValueOnce({ verifiedProof: ['Manual proof', previousProof] })

    const response = await PATCH(request('approve_conflict'), context)

    expect(response.status).toBe(200)
    expect(txMock.brandProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        verifiedProof: [
          'Manual proof',
          'Average acquisition cost was AED 180. [Source: q2.pdf — Page 3]',
        ],
      },
    }))
    expect(txMock.brandEvidenceClaim.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'claim-old' },
      data: expect.objectContaining({ status: 'REJECTED', truthStatus: 'OUTDATED', promotedProof: null }),
    }))
    expect(txMock.brandEvidenceClaim.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'claim-1' },
      data: expect.objectContaining({ status: 'APPROVED', truthStatus: 'CONFIRMED' }),
    }))
  })

  it('does not reveal or mutate a claim outside the authenticated workspace', async () => {
    prismaMock.brandEvidenceClaim.findFirst.mockResolvedValueOnce(null)
    const response = await PATCH(request('approve'), context)
    expect(response.status).toBe(404)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
