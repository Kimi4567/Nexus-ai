import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    creditGrant: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    user: { update: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { GET } from '../route'

const makeReq = (authorization = 'Bearer cron_secret') =>
  ({ headers: { get: (key: string) => (key === 'authorization' ? authorization : null) } }) as any

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron_secret'
  delete process.env.CREDIT_WALLET_ENABLED
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockPrisma))
  mockPrisma.creditGrant.findMany.mockResolvedValue([])
  mockPrisma.creditGrant.updateMany.mockResolvedValue({ count: 0 })
  mockPrisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remaining: 0 } })
  mockPrisma.user.update.mockResolvedValue({})
})

describe('cron/expire-credits', () => {
  it('fails closed for unauthorized requests', async () => {
    const res = await GET(makeReq('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('is a no-op while the wallet flag is disabled', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, walletEnabled: false, skipped: true, expired: 0 })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('expires grants and reconciles affected user caches when enabled', async () => {
    process.env.CREDIT_WALLET_ENABLED = 'true'
    mockPrisma.creditGrant.findMany.mockResolvedValue([
      { id: 'g1', userId: 'u1' },
      { id: 'g2', userId: 'u1' },
      { id: 'g3', userId: 'u2' },
    ])
    mockPrisma.creditGrant.updateMany.mockResolvedValue({ count: 3 })
    mockPrisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remaining: 12 } })

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, walletEnabled: true, skipped: false, expired: 3, usersReconciled: 2 })
    expect(mockPrisma.creditGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'EXPIRED', remaining: 0 },
    }))
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(2)
  })
})
