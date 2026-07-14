import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exchangeGoogleAdsAuthorizationCode } from '../googleAdsApi'

describe('exchangeGoogleAdsAuthorizationCode', () => {
  const originalClientId = process.env.GOOGLE_ADS_CLIENT_ID
  const originalClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET

  beforeEach(() => {
    process.env.GOOGLE_ADS_CLIENT_ID = 'client-id'
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalClientId === undefined) delete process.env.GOOGLE_ADS_CLIENT_ID
    else process.env.GOOGLE_ADS_CLIENT_ID = originalClientId
    if (originalClientSecret === undefined) delete process.env.GOOGLE_ADS_CLIENT_SECRET
    else process.env.GOOGLE_ADS_CLIENT_SECRET = originalClientSecret
  })

  it('preserves the safe Google OAuth error code for diagnostics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Bad Request',
    }), { status: 400 })))

    const exchange = exchangeGoogleAdsAuthorizationCode({
      code: 'one-time-code',
      redirectUri: 'https://preview.example.com/api/social/callback/google-ads',
    })

    await expect(exchange).rejects.toMatchObject({
      name: 'GoogleAdsOAuthError',
      status: 400,
      code: 'invalid_grant',
      description: 'Bad Request',
      message: 'The Google authorization expired or was already used. Start the Google Ads connection again.',
    })
  })

  it('returns tokens without logging or exposing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/adwords',
    }), { status: 200 })))

    await expect(exchangeGoogleAdsAuthorizationCode({
      code: 'one-time-code',
      redirectUri: 'https://preview.example.com/api/social/callback/google-ads',
    })).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    })
  })
})
