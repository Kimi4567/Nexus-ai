import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  discoverGoogleAdsAccounts,
  exchangeGoogleAdsAuthorizationCode,
  googleAdsAccountExecutionBlocker,
} from '../googleAdsApi'

describe('exchangeGoogleAdsAuthorizationCode', () => {
  const originalClientId = process.env.GOOGLE_ADS_CLIENT_ID
  const originalClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const originalDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const originalAccessTier = process.env.GOOGLE_ADS_ACCESS_TIER

  beforeEach(() => {
    process.env.GOOGLE_ADS_CLIENT_ID = 'client-id'
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'client-secret'
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'developer-token'
    process.env.GOOGLE_ADS_ACCESS_TIER = 'EXPLORER'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalClientId === undefined) delete process.env.GOOGLE_ADS_CLIENT_ID
    else process.env.GOOGLE_ADS_CLIENT_ID = originalClientId
    if (originalClientSecret === undefined) delete process.env.GOOGLE_ADS_CLIENT_SECRET
    else process.env.GOOGLE_ADS_CLIENT_SECRET = originalClientSecret
    if (originalDeveloperToken === undefined) delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    else process.env.GOOGLE_ADS_DEVELOPER_TOKEN = originalDeveloperToken
    if (originalAccessTier === undefined) delete process.env.GOOGLE_ADS_ACCESS_TIER
    else process.env.GOOGLE_ADS_ACCESS_TIER = originalAccessTier
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

  it('discovers a draft child account without claiming it can execute', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        resourceNames: ['customers/3319467856'],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          { customerClient: {
            id: '3319467856', level: '0', manager: true,
            descriptiveName: 'NEXUS AI Marketing OS', status: 'ENABLED',
          } },
          { customerClient: {
            id: '4364965297', level: '1', manager: false,
            descriptiveName: 'NEXUS AI Sandbox Ads', currencyCode: 'AED',
            timeZone: 'Asia/Dubai', status: 'UNKNOWN', testAccount: false,
          } },
        ],
      }), { status: 200 })))

    await expect(discoverGoogleAdsAccounts('access-token')).resolves.toEqual([
      expect.objectContaining({
        customerId: '4364965297',
        descriptiveName: 'NEXUS AI Sandbox Ads',
        status: 'UNKNOWN',
        loginCustomerId: '3319467856',
      }),
    ])
    expect(googleAdsAccountExecutionBlocker(false, 'UNKNOWN')).toContain('status UNKNOWN')
  })

  it('allows execution only when both account status and access tier are ready', () => {
    expect(googleAdsAccountExecutionBlocker(false, 'ENABLED')).toBeNull()
    expect(googleAdsAccountExecutionBlocker(false, 'SUSPENDED')).toContain('status SUSPENDED')
    process.env.GOOGLE_ADS_ACCESS_TIER = 'TEST'
    expect(googleAdsAccountExecutionBlocker(false, 'ENABLED')).toContain('GOOGLE_ADS_ACCESS_TIER=TEST')
  })
})
