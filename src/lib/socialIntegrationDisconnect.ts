export type SocialDisconnectTombstone = {
  schemaVersion: 1
  lifecycle: 'disconnected'
  disconnectedAt: string
  credentialErasure: 'completed'
  providerRevocation: 'not_confirmed'
}

const TOMBSTONE_KEYS = new Set([
  'schemaVersion',
  'lifecycle',
  'disconnectedAt',
  'credentialErasure',
  'providerRevocation',
])

export function createSocialDisconnectTombstone(now = new Date()): SocialDisconnectTombstone {
  return {
    schemaVersion: 1,
    lifecycle: 'disconnected',
    disconnectedAt: now.toISOString(),
    credentialErasure: 'completed',
    providerRevocation: 'not_confirmed',
  }
}

export function isSanitizedSocialDisconnectConfig(value: unknown): value is SocialDisconnectTombstone {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const config = value as Record<string, unknown>
  const disconnectedAt = typeof config.disconnectedAt === 'string'
    ? new Date(config.disconnectedAt)
    : null

  return Object.keys(config).every(key => TOMBSTONE_KEYS.has(key))
    && config.schemaVersion === 1
    && config.lifecycle === 'disconnected'
    && disconnectedAt !== null
    && Number.isFinite(disconnectedAt.getTime())
    && config.credentialErasure === 'completed'
    && config.providerRevocation === 'not_confirmed'
}
