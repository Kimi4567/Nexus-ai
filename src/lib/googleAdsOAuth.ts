import { createHash, randomBytes, timingSafeEqual } from 'crypto'

export function createGoogleAdsOAuthNonce(): string {
  return randomBytes(32).toString('base64url')
}

export function googleAdsOAuthNonceHash(nonce: string): string {
  return createHash('sha256').update(nonce).digest('base64url')
}

export function googleAdsOAuthContextMatches(context: string, nonce: string): boolean {
  const expected = Buffer.from(googleAdsOAuthNonceHash(nonce))
  const received = Buffer.from(context)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
