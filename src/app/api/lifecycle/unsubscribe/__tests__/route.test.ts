import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createUnsubscribeToken } from '@/lib/lifecycleMessaging'

const mocks = vi.hoisted(() => ({
  gate: vi.fn(), lead: vi.fn(), transaction: vi.fn(), suppression: vi.fn(), updateLead: vi.fn(), activity: vi.fn(),
}))

vi.mock('@/lib/lifecycleReadiness', () => ({ lifecycleGate: mocks.gate }))
vi.mock('@/lib/prisma', () => ({
  prisma: { lead: { findFirst: mocks.lead }, $transaction: mocks.transaction },
}))

import { POST } from '@/app/api/lifecycle/unsubscribe/route'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CONTACT_SUPPRESSION_HASH_KEY = 'suppression-key-that-is-longer-than-thirty-two-characters'
  process.env.UNSUBSCRIBE_SIGNING_SECRET = 'unsubscribe-key-that-is-longer-than-thirty-two-characters'
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.lead.mockResolvedValue({ id: 'lead-1', email: 'person@example.com', phone: null })
  mocks.suppression.mockResolvedValue({ id: 'suppression-1' })
  mocks.transaction.mockImplementation(async callback => callback({
    contactSuppression: { upsert: mocks.suppression },
    lead: { update: mocks.updateLead },
    leadActivity: { create: mocks.activity },
  }))
})
describe('POST /api/lifecycle/unsubscribe', () => {
  it('atomically records durable suppression and revokes marketing consent', async () => {
    const token = createUnsubscribeToken({
      workspaceId: 'workspace-1', leadId: 'lead-1', channel: 'EMAIL', expiresAt: new Date(Date.now() + 60_000),
    })
    const response = await POST(new NextRequest('http://localhost/api/lifecycle/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    }))
    expect(response.status).toBe(200)
    expect(mocks.lead).toHaveBeenCalledWith({
      where: { id: 'lead-1', workspaceId: 'workspace-1' },
      select: { id: true, email: true, phone: true },
    })
    expect(mocks.suppression).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ source: 'UNSUBSCRIBE_LINK', destinationHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    }))
    expect(mocks.updateLead).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ consentStatus: 'REVOKED' }) }))
    expect(mocks.activity).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'CONSENT_REVOKED', actor: 'SYSTEM' }) })
  })

  it('rejects a forged token without querying lead data', async () => {
    const response = await POST(new NextRequest('http://localhost/api/lifecycle/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'forged.token' }),
    }))
    expect(response.status).toBe(400)
    expect(mocks.lead).not.toHaveBeenCalled()
  })
})
