import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createUnsubscribeToken,
  evaluateLifecycleDelivery,
  hashLifecycleDestination,
  verifyUnsubscribeToken,
} from '@/lib/lifecycleMessaging'

const originalHashKey = process.env.CONTACT_SUPPRESSION_HASH_KEY
const originalSigningSecret = process.env.UNSUBSCRIBE_SIGNING_SECRET

beforeEach(() => {
  process.env.CONTACT_SUPPRESSION_HASH_KEY = 'suppression-key-that-is-longer-than-thirty-two-characters'
  process.env.UNSUBSCRIBE_SIGNING_SECRET = 'unsubscribe-key-that-is-longer-than-thirty-two-characters'
})
afterEach(() => {
  if (originalHashKey === undefined) delete process.env.CONTACT_SUPPRESSION_HASH_KEY
  else process.env.CONTACT_SUPPRESSION_HASH_KEY = originalHashKey
  if (originalSigningSecret === undefined) delete process.env.UNSUBSCRIBE_SIGNING_SECRET
  else process.env.UNSUBSCRIBE_SIGNING_SECRET = originalSigningSecret
})

describe('customer lifecycle safety primitives', () => {
  it('normalizes before hashing and never returns the raw destination', () => {
    const first = hashLifecycleDestination('EMAIL', ' Person@Example.COM ')
    const second = hashLifecycleDestination('EMAIL', 'person@example.com')
    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).not.toContain('person@example.com')
  })

  it('keeps provider delivery blocked even for an otherwise eligible lead', () => {
    expect(evaluateLifecycleDelivery({
      channel: 'EMAIL', purpose: 'FOLLOW_UP', destination: 'person@example.com', consentStatus: 'GRANTED', suppressed: false,
    })).toEqual({ eligibleAfterProviderApproval: true, blockers: ['PROVIDER_NOT_CONNECTED'] })
  })

  it('blocks marketing when consent is absent or the destination is suppressed', () => {
    expect(evaluateLifecycleDelivery({
      channel: 'SMS', purpose: 'NURTURE', destination: '+971501234567', consentStatus: 'UNKNOWN', suppressed: true,
    })).toEqual({
      eligibleAfterProviderApproval: false,
      blockers: ['SUPPRESSED', 'CONSENT_NOT_GRANTED', 'PROVIDER_NOT_CONNECTED'],
    })
  })

  it('allows double-opt-in copy eligibility without claiming verified consent', () => {
    expect(evaluateLifecycleDelivery({
      channel: 'EMAIL', purpose: 'DOUBLE_OPT_IN', destination: 'person@example.com', consentStatus: 'UNKNOWN', suppressed: false,
    })).toEqual({ eligibleAfterProviderApproval: true, blockers: ['PROVIDER_NOT_CONNECTED'] })
  })

  it('rejects tampered and expired unsubscribe tokens', () => {
    const now = new Date('2026-07-20T12:00:00.000Z')
    const token = createUnsubscribeToken({
      workspaceId: 'workspace-1', leadId: 'lead-1', channel: 'EMAIL', expiresAt: new Date('2026-07-21T12:00:00.000Z'),
    })
    expect(verifyUnsubscribeToken(token, now)).toMatchObject({ workspaceId: 'workspace-1', leadId: 'lead-1', channel: 'EMAIL' })
    expect(verifyUnsubscribeToken(`${token.slice(0, -1)}x`, now)).toBeNull()
    expect(verifyUnsubscribeToken(token, new Date('2026-07-22T12:00:00.000Z'))).toBeNull()
  })
})
