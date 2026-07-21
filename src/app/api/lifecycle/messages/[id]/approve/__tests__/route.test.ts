import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), gate: vi.fn(), message: vi.fn(), suppression: vi.fn(), transaction: vi.fn(), updateMany: vi.fn(), activity: vi.fn(), findUnique: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/lifecycleReadiness', () => ({ lifecycleGate: mocks.gate }))
vi.mock('@/lib/leadCrmAccess', () => ({ leadWorkspaceAccessFilter: () => ({ OR: [{ ownerId: 'user-1' }] }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lifecycleMessage: { findFirst: mocks.message },
    contactSuppression: { findFirst: mocks.suppression },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/lifecycle/messages/[id]/approve/route'

const updatedAt = new Date('2026-07-20T12:00:00.000Z')
const context = { params: Promise.resolve({ id: 'message-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CONTACT_SUPPRESSION_HASH_KEY = 'suppression-key-that-is-longer-than-thirty-two-characters'
  process.env.UNSUBSCRIBE_SIGNING_SECRET = 'unsubscribe-key-that-is-longer-than-thirty-two-characters'
  mocks.auth.mockResolvedValue('user-1')
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.message.mockResolvedValue({
    id: 'message-1', workspaceId: 'workspace-1', leadId: 'lead-1', channel: 'EMAIL', purpose: 'FOLLOW_UP', status: 'DRAFT', updatedAt,
    lead: { id: 'lead-1', email: 'person@example.com', phone: null, consentStatus: 'GRANTED' },
  })
  mocks.suppression.mockResolvedValue(null)
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.findUnique.mockResolvedValue({ id: 'message-1', status: 'APPROVED' })
  mocks.transaction.mockImplementation(async callback => callback({
    lifecycleMessage: { updateMany: mocks.updateMany, findUnique: mocks.findUnique },
    leadActivity: { create: mocks.activity },
  }))
})
describe('POST /api/lifecycle/messages/[id]/approve', () => {
  it('approves copy with optimistic concurrency while delivery remains blocked', async () => {
    const response = await POST(new NextRequest('http://localhost/api/lifecycle/messages/message-1/approve', {
      method: 'POST', headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: updatedAt.toISOString() }),
    }), context)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ approvalScope: 'COPY_ONLY', sendsEnabled: false, delivery: { state: 'BLOCKED', providerState: 'NOT_CONNECTED' } })
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'message-1', status: 'DRAFT', updatedAt } }))
    expect(mocks.activity).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'LIFECYCLE_COPY_APPROVED', metadata: expect.objectContaining({ deliveryState: 'BLOCKED' }) }) })
  })
})
