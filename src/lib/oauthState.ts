import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export type OAuthProvider = 'meta' | 'meta_ads' | 'linkedin' | 'tiktok' | 'youtube' | 'x'

type OAuthStatePayload = {
  v: 1
  provider: OAuthProvider
  userId: string
  issuedAt: number
  nonce: string
  context?: string
}

const MAX_AGE_MS = 10 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('OAUTH_STATE_SECRET must be configured with at least 32 characters')
  }
  return secret
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', stateSecret()).update(encodedPayload).digest('base64url')
}

export function createOAuthState(userId: string, provider: OAuthProvider, context?: string): string {
  if (!userId) throw new Error('OAuth state requires a userId')
  if (context && context.length > 160) throw new Error('OAuth state context is too long')
  const payload: OAuthStatePayload = {
    v: 1,
    provider,
    userId,
    issuedAt: Date.now(),
    nonce: randomBytes(16).toString('base64url'),
    ...(context ? { context } : {}),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyOAuthState(state: string, provider: OAuthProvider): OAuthStatePayload {
  const [encoded, signature, extra] = state.split('.')
  if (!encoded || !signature || extra) throw new Error('Malformed OAuth state')

  const expected = sign(encoded)
  const receivedBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (
    receivedBytes.length !== expectedBytes.length
    || !timingSafeEqual(receivedBytes, expectedBytes)
  ) throw new Error('Invalid OAuth state signature')

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Partial<OAuthStatePayload>
  if (
    payload.v !== 1
    || payload.provider !== provider
    || typeof payload.userId !== 'string'
    || !payload.userId
    || typeof payload.issuedAt !== 'number'
    || typeof payload.nonce !== 'string'
    || (payload.context !== undefined && typeof payload.context !== 'string')
  ) throw new Error('Invalid OAuth state payload')

  const age = Date.now() - payload.issuedAt
  if (age < -60_000 || age > MAX_AGE_MS) throw new Error('Expired OAuth state')
  return payload as OAuthStatePayload
}
