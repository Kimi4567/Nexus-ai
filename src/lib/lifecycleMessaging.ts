import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeLeadEmail, normalizeLeadPhone } from '@/lib/leadLifecycle'

export const LIFECYCLE_CHANNELS = ['EMAIL', 'SMS'] as const
export const LIFECYCLE_PURPOSES = ['DOUBLE_OPT_IN', 'FOLLOW_UP', 'NURTURE', 'WIN_BACK'] as const
export const LIFECYCLE_MESSAGE_STATUSES = ['DRAFT', 'APPROVED', 'CANCELLED'] as const

export type LifecycleChannel = typeof LIFECYCLE_CHANNELS[number]
export type LifecyclePurpose = typeof LIFECYCLE_PURPOSES[number]

export type LifecycleBlocker =
  | 'NO_DESTINATION'
  | 'SUPPRESSED'
  | 'CONSENT_NOT_GRANTED'
  | 'PROVIDER_NOT_CONNECTED'

type UnsubscribePayload = {
  v: 1
  workspaceId: string
  leadId: string
  channel: LifecycleChannel
  exp: number
}
function requiredSecret(name: 'CONTACT_SUPPRESSION_HASH_KEY' | 'UNSUBSCRIBE_SIGNING_SECRET'): string {
  const value = process.env[name]?.trim()
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters`)
  return value
}

function signature(value: string): Buffer {
  return createHmac('sha256', requiredSecret('UNSUBSCRIBE_SIGNING_SECRET')).update(value).digest()
}

function decodePayload(encoded: string): UnsubscribePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<UnsubscribePayload>
    if (
      parsed.v !== 1
      || typeof parsed.workspaceId !== 'string'
      || typeof parsed.leadId !== 'string'
      || !isLifecycleChannel(parsed.channel)
      || typeof parsed.exp !== 'number'
    ) return null
    return parsed as UnsubscribePayload
  } catch {
    return null
  }
}

export function isLifecycleChannel(value: unknown): value is LifecycleChannel {
  return typeof value === 'string' && (LIFECYCLE_CHANNELS as readonly string[]).includes(value)
}

export function isLifecyclePurpose(value: unknown): value is LifecyclePurpose {
  return typeof value === 'string' && (LIFECYCLE_PURPOSES as readonly string[]).includes(value)
}

export function normalizeLifecycleDestination(channel: LifecycleChannel, value: unknown): string | null {
  return channel === 'EMAIL' ? normalizeLeadEmail(value) : normalizeLeadPhone(value)
}

export function hashLifecycleDestination(channel: LifecycleChannel, value: unknown): string | null {
  const normalized = normalizeLifecycleDestination(channel, value)
  if (!normalized) return null
  return createHmac('sha256', requiredSecret('CONTACT_SUPPRESSION_HASH_KEY'))
    .update(`${channel}:${normalized}`)
    .digest('hex')
}

export function evaluateLifecycleDelivery(input: {
  channel: LifecycleChannel
  purpose: LifecyclePurpose
  destination: unknown
  consentStatus: string
  suppressed: boolean
}): { eligibleAfterProviderApproval: boolean; blockers: LifecycleBlocker[] } {
  const blockers: LifecycleBlocker[] = []
  if (!normalizeLifecycleDestination(input.channel, input.destination)) blockers.push('NO_DESTINATION')
  if (input.suppressed) blockers.push('SUPPRESSED')
  if (input.purpose !== 'DOUBLE_OPT_IN' && input.consentStatus !== 'GRANTED') {
    blockers.push('CONSENT_NOT_GRANTED')
  }

  const eligibleAfterProviderApproval = blockers.length === 0
  blockers.push('PROVIDER_NOT_CONNECTED')
  return { eligibleAfterProviderApproval, blockers }
}

export function createUnsubscribeToken(input: {
  workspaceId: string
  leadId: string
  channel: LifecycleChannel
  expiresAt: Date
}): string {
  const payload: UnsubscribePayload = {
    v: 1,
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    channel: input.channel,
    exp: Math.floor(input.expiresAt.getTime() / 1000),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${signature(encoded).toString('base64url')}`
}

export function verifyUnsubscribeToken(token: unknown, now = new Date()): UnsubscribePayload | null {
  if (typeof token !== 'string' || token.length > 2048) return null
  const [encoded, received, ...rest] = token.split('.')
  if (!encoded || !received || rest.length) return null

  let receivedSignature: Buffer
  try {
    receivedSignature = Buffer.from(received, 'base64url')
  } catch {
    return null
  }
  const expected = signature(encoded)
  if (receivedSignature.length !== expected.length || !timingSafeEqual(receivedSignature, expected)) return null

  const payload = decodePayload(encoded)
  if (!payload || payload.exp <= Math.floor(now.getTime() / 1000)) return null
  return payload
}
