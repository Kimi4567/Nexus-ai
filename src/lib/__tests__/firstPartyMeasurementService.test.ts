import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  eventCount: vi.fn(),
  eventFindMany: vi.fn(),
  leadCount: vi.fn(),
  leadFindMany: vi.fn(),
  touchCount: vi.fn(),
  touchFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversionEvent: { count: mocks.eventCount, findMany: mocks.eventFindMany },
    lead: { count: mocks.leadCount, findMany: mocks.leadFindMany },
    leadActivity: { count: mocks.touchCount, findMany: mocks.touchFindMany },
  },
}))

import { readFirstPartyMeasurement } from '@/lib/firstPartyMeasurementService'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.eventCount.mockResolvedValue(0)
  mocks.eventFindMany.mockResolvedValue([])
  mocks.leadCount.mockResolvedValue(0)
  mocks.leadFindMany.mockResolvedValue([])
  mocks.touchCount.mockResolvedValue(0)
  mocks.touchFindMany.mockResolvedValue([])
})

describe('readFirstPartyMeasurement', () => {
  it('scopes events, leads, and recapture attribution to one workspace campaign cohort', async () => {
    await readFirstPartyMeasurement('workspace-1', 'campaign-1')

    expect(mocks.eventCount).toHaveBeenCalledWith({ where: { workspaceId: 'workspace-1', campaignId: 'campaign-1' } })
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1', campaignId: 'campaign-1' },
    }))
    expect(mocks.leadCount).toHaveBeenCalledWith({ where: { workspaceId: 'workspace-1', campaignId: 'campaign-1' } })
    expect(mocks.leadFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1', campaignId: 'campaign-1' },
    }))
    expect(mocks.touchFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        type: 'FORM_RECAPTURED',
        lead: { workspaceId: 'workspace-1', campaignId: 'campaign-1' },
      },
    }))
  })

  it('never introduces a campaign filter into a workspace-wide report', async () => {
    await readFirstPartyMeasurement('workspace-1')

    expect(mocks.eventCount).toHaveBeenCalledWith({ where: { workspaceId: 'workspace-1' } })
    expect(mocks.leadCount).toHaveBeenCalledWith({ where: { workspaceId: 'workspace-1' } })
    expect(mocks.touchCount).toHaveBeenCalledWith({
      where: { type: 'FORM_RECAPTURED', lead: { workspaceId: 'workspace-1' } },
    })
  })
})
