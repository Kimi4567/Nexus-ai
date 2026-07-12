/**
 * B1d-b — referral claim creates matching REFERRAL grants alongside the bonuses.
 *
 * The aiCredits increments, response, and status codes are unchanged; this adds
 * two idempotent REFERRAL grants (one per side) inside the same transaction.
 * Prisma + auth + stripe are mocked; no DB.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockPrisma, tx, mockGetUser } = vi.hoisted(() => {
  const tx = {
    $queryRawUnsafe: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    creditGrant: { createMany: vi.fn() },
  }
  return {
    tx,
    mockGetUser: vi.fn(),
    mockPrisma: {
      user: { findUnique: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mockGetUser } } }))
vi.mock('@/lib/stripe', () => ({ REFERRAL_BONUS_CREDITS: 20 }))

import { POST } from '../route'

const makeReq = (body: Record<string, unknown> = { referralCode: 'NEXUS-ABC234' }) =>
  ({ headers: { get: () => 'Bearer tok' }, json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'newUser' } } })
  tx.$queryRawUnsafe.mockResolvedValue([])
  tx.user.update.mockResolvedValue({})
  tx.user.updateMany.mockResolvedValue({ count: 1 })
  tx.creditGrant.createMany.mockResolvedValue({ count: 1 })
})

describe('POST /api/referral/claim — B1d-b grants', () => {
  it('increments both users by 20 AND creates two side-specific REFERRAL grants', async () => {
    tx.user.findUnique
      .mockResolvedValueOnce({ referredById: null, aiCredits: 0 }) // claimer
      .mockResolvedValueOnce({ id: 'refUser', aiCredits: 5, referralCreditsEarned: 0 }) // referrer

    const res = await POST(makeReq())
    const json = await res.json()

    expect(res.status ?? 200).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.bonusCredits).toBe(20)

    // Both bonuses applied inside the transaction.
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'newUser', referredById: null },
      data: expect.objectContaining({ referredById: 'refUser', aiCredits: { increment: 20 } }),
    }))
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'refUser' },
      data: expect.objectContaining({ aiCredits: { increment: 20 }, referralCreditsEarned: { increment: 20 } }),
    }))

    // Two REFERRAL grants with deterministic, side-specific sources.
    expect(tx.creditGrant.createMany).toHaveBeenCalledTimes(2)
    const sources = tx.creditGrant.createMany.mock.calls.map((c: any) => c[0].data[0].source)
    expect(sources).toContain('referral:refUser:newUser:referred')
    expect(sources).toContain('referral:refUser:newUser:referrer')
    // Shapes: REFERRAL, 20, non-expiring, idempotent.
    for (const c of tx.creditGrant.createMany.mock.calls as any[]) {
      expect(c[0].skipDuplicates).toBe(true)
      expect(c[0].data[0]).toMatchObject({ type: 'REFERRAL', amount: 20, remaining: 20, expiresAt: null, status: 'ACTIVE' })
    }
  })

  it('already-claimed referral → 409, no grants', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ referredById: 'someone' })

    const res = await POST(makeReq())
    expect(res.status).toBe(409)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('invalid referral code → 404, no grants', async () => {
    tx.user.findUnique
      .mockResolvedValueOnce({ referredById: null })
      .mockResolvedValueOnce(null) // referrer not found

    const res = await POST(makeReq())
    expect(res.status).toBe(404)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })

  it('self-referral → 400, no grants', async () => {
    tx.user.findUnique
      .mockResolvedValueOnce({ referredById: null })
      .mockResolvedValueOnce({ id: 'newUser' }) // same as claimer

    const res = await POST(makeReq())
    expect(res.status).toBe(400)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.creditGrant.createMany).not.toHaveBeenCalled()
  })
})
