/**
 * Workspace fresh-start reset — scope + safety contract (PR-1G).
 *
 * Guarantees:
 *   - account infra + platform connections are NEVER deleted
 *     (Integration, AdAccount, Project, WorkspaceMember, CreditTransaction,
 *      Subscription, User, Account, Session)
 *   - MarketingLearningEvent IS reset (orphan-trap closed)
 *   - every delete/count/update is scoped to the caller's workspace id
 *   - dry-run deletes nothing, returns counts
 *   - a real reset requires confirmation
 *
 * No DB/network: prisma + auth are mocked.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockAuth, prismaMock, RESET_MODELS, FORBIDDEN_MODELS } = vi.hoisted(() => {
  const RESET_MODELS = [
    'marketingLearningEvent', 'brainLearning', 'brainScoreSnapshot', 'campaignMemory',
    'agentReport', 'agentSuggestion', 'agentRun', 'generatedVisual', 'socialPost',
    'export', 'paidCampaignPack', 'adCampaign', 'uploadSession', 'media', 'campaign',
  ]
  // These must NEVER be deleted by the reset (connections / access / account).
  const FORBIDDEN_MODELS = ['integration', 'adAccount', 'project', 'workspaceMember']
  const models: Record<string, any> = {}
  for (const m of [...RESET_MODELS, ...FORBIDDEN_MODELS]) {
    models[m] = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), count: vi.fn().mockResolvedValue(1) }
  }
  const prismaMock = {
    ...models,
    workspace: { findFirst: vi.fn().mockResolvedValue({ id: 'ws1' }) },
    brandProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'bp1' }), update: vi.fn().mockResolvedValue({}) },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  } as Record<string, any>
  prismaMock.$transaction = vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock))
  return {
    RESET_MODELS,
    FORBIDDEN_MODELS,
    mockAuth: vi.fn(),
    prismaMock,
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockAuth }))

import { POST } from '../reset/route'

const req = (body: Record<string, unknown>) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ id: 'user1' })
  prismaMock.workspace.findFirst.mockResolvedValue({ id: 'ws1' })
  prismaMock.brandProfile.findUnique.mockResolvedValue({ id: 'bp1' })
  for (const m of [...RESET_MODELS, ...FORBIDDEN_MODELS]) {
    prismaMock[m].deleteMany.mockResolvedValue({ count: 1 })
    prismaMock[m].count.mockResolvedValue(1)
  }
})

describe('POST /api/workspace/reset (PR-1G)', () => {
  it('rejects a real reset without confirmation', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    for (const m of RESET_MODELS) expect(prismaMock[m].deleteMany).not.toHaveBeenCalled()
  })

  it('accepts the strong confirmText and deletes only journey/brain models', async () => {
    const res = await POST(req({ confirmText: 'RESET MY NEXUS WORKSPACE' }))
    const data = await res.json()
    expect(data.ok).toBe(true)
    for (const m of RESET_MODELS) {
      expect(prismaMock[m].deleteMany).toHaveBeenCalledWith({ where: { workspaceId: 'ws1' } })
    }
    // MarketingLearningEvent orphan trap is closed.
    expect(prismaMock.marketingLearningEvent.deleteMany).toHaveBeenCalled()
    // Brand Brain fields reset, row kept (update, not delete).
    expect(prismaMock.brandProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws1' } })
    )
    expect(data.brandProfileReset).toBe(true)
    expect(data.connectionsPreserved).toBe(true)
    expect(data.creditsUnchanged).toBe(true)
    expect(data.preserved).toEqual(expect.arrayContaining(['Integration', 'AdAccount', 'CreditTransaction']))
  })

  it('NEVER deletes connections / access / account models', async () => {
    await POST(req({ confirmText: 'RESET MY NEXUS WORKSPACE' }))
    for (const m of FORBIDDEN_MODELS) {
      expect(prismaMock[m].deleteMany).not.toHaveBeenCalled()
    }
  })

  it('rejects the legacy weak confirm token', async () => {
    const res = await POST(req({ confirm: 'RESET' }))
    expect(res.status).toBe(400)
    expect(prismaMock.campaign.deleteMany).not.toHaveBeenCalled()
  })

  it('dry-run deletes nothing and returns counts', async () => {
    const res = await POST(req({ dryRun: true }))
    const data = await res.json()
    expect(data.dryRun).toBe(true)
    expect(data.wouldDelete).toBeTruthy()
    for (const m of RESET_MODELS) {
      expect(prismaMock[m].count).toHaveBeenCalledWith({ where: { workspaceId: 'ws1' } })
      expect(prismaMock[m].deleteMany).not.toHaveBeenCalled()
    }
    expect(prismaMock.brandProfile.update).not.toHaveBeenCalled()
  })
})
