import { describe, expect, it, vi } from 'vitest'
import { getUtcMonthlyWindow, readLockedCampaignAllowance } from '@/lib/campaignCommercial'

describe('campaign commercial window', () => {
  it('uses an exact UTC calendar month for fallback billing windows', () => {
    const { periodStart, periodEnd } = getUtcMonthlyWindow(new Date('2026-12-31T23:59:59.000Z'))
    expect(periodStart.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(periodEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('locks per owner and counts account-wide creations in the active subscription period', async () => {
    const periodStart = new Date('2026-07-01T00:00:00.000Z')
    const periodEnd = new Date('2026-08-01T00:00:00.000Z')
    const tx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      user: { findUnique: vi.fn().mockResolvedValue({ subscriptionStatus: 'FREE', role: 'USER' }) },
      subscription: { findUnique: vi.fn().mockResolvedValue({ plan: 'PRO', status: 'ACTIVE', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd }) },
      campaign: { count: vi.fn().mockResolvedValue(9) },
    } as any

    const result = await readLockedCampaignAllowance(tx, 'owner-1', new Date('2026-07-12T12:00:00.000Z'))
    expect(result).toMatchObject({ limit: 10, current: 9, plan: 'PRO', periodStart, periodEnd })
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(expect.any(String), 'campaign-limit:owner-1')
    expect(tx.campaign.count).toHaveBeenCalledWith({
      where: { workspace: { ownerId: 'owner-1' }, createdAt: { gte: periodStart, lt: periodEnd } },
    })
  })
})
