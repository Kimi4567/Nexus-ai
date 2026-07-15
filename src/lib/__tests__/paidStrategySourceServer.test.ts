import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    campaign: { findFirst: vi.fn() },
    campaignSnapshot: { findFirst: vi.fn() },
    marketingLearningEvent: { findFirst: vi.fn() },
  },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import {
  buildStrategyApprovalSnapshotPayload,
  hashCampaignSnapshotPayload,
} from '@/lib/campaignSnapshots'
import {
  getPaidStrategySourceForUser,
  PaidStrategySourceError,
} from '@/lib/paidStrategySourceServer'

const payload = buildStrategyApprovalSnapshotPayload({
  campaign: {
    id: 'campaign-1',
    name: 'Approved lead strategy',
    goal: 'LEADS',
    audience: 'UAE operators',
    platforms: ['META'],
    aiOutput: {
      strategyType: 'paid',
      strategy: { positioning: 'Approved positioning' },
      qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
      sentinelReview: { status: 'passed' },
    },
  },
})

const snapshot = {
  id: 'snapshot-1',
  workspaceId: 'workspace-1',
  campaignId: 'campaign-1',
  version: 3,
  scope: 'STRATEGY_APPROVAL',
  payload,
  payloadHash: hashCampaignSnapshotPayload(payload),
  createdAt: new Date('2026-07-15T08:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.campaign.findFirst.mockResolvedValue({
    id: 'campaign-1',
    workspaceId: 'workspace-1',
    name: 'Live row changed later',
    status: 'ACTIVE',
    goal: 'SALES',
    audience: 'Changed audience',
    platforms: ['GOOGLE'],
    aiOutput: { strategy: { positioning: 'Unapproved live mutation' } },
    updatedAt: new Date('2026-07-15T09:00:00.000Z'),
  })
  prismaMock.marketingLearningEvent.findFirst.mockResolvedValue({
    eventType: 'STRATEGY_APPROVED',
    createdAt: new Date('2026-07-15T08:00:00.000Z'),
    source: 'CAMPAIGN_REVIEW',
  })
  prismaMock.campaignSnapshot.findFirst.mockResolvedValue(snapshot)
})

describe('paid strategy snapshot source', () => {
  it('uses the exact approved snapshot instead of mutable campaign fields', async () => {
    const result = await getPaidStrategySourceForUser({
      campaignId: 'campaign-1',
      userId: 'user-1',
      strategySnapshotId: 'snapshot-1',
      requirePinnedSnapshot: true,
    })

    expect(result.snapshot).toMatchObject({ id: 'snapshot-1', version: 3 })
    expect(result.truth.executionObjective).toBe('LEAD_GENERATION')
    expect(result.campaign.name).toBe('Approved lead strategy')
    expect(result.executionContext).toContain('Approved positioning')
    expect(result.executionContext).not.toContain('Unapproved live mutation')
  })

  it('fails closed for legacy paid drafts without a pinned revision', async () => {
    await expect(getPaidStrategySourceForUser({
      campaignId: 'campaign-1',
      userId: 'user-1',
      strategySnapshotId: null,
      requirePinnedSnapshot: true,
    })).rejects.toEqual(expect.objectContaining<Partial<PaidStrategySourceError>>({
      code: 'PAID_STRATEGY_SNAPSHOT_REQUIRED',
      status: 409,
    }))
  })

  it('blocks a paid draft when a newer strategy revision replaced its source', async () => {
    await expect(getPaidStrategySourceForUser({
      campaignId: 'campaign-1',
      userId: 'user-1',
      strategySnapshotId: 'older-snapshot',
      requirePinnedSnapshot: true,
    })).rejects.toEqual(expect.objectContaining<Partial<PaidStrategySourceError>>({
      code: 'PAID_STRATEGY_REVISION_CHANGED',
      status: 409,
    }))
  })

  it('rejects a snapshot whose stored hash no longer matches its payload', async () => {
    prismaMock.campaignSnapshot.findFirst.mockResolvedValue({ ...snapshot, payloadHash: 'tampered' })

    await expect(getPaidStrategySourceForUser({
      campaignId: 'campaign-1',
      userId: 'user-1',
    })).rejects.toEqual(expect.objectContaining<Partial<PaidStrategySourceError>>({
      code: 'PAID_STRATEGY_SNAPSHOT_INVALID',
      status: 409,
    }))
  })
})
