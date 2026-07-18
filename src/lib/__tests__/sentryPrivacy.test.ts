import { describe, expect, it } from 'vitest'
import {
  createPrivacySafeError,
  getPrivacySafeErrorCode,
  isSentryRuntimeEnabled,
  isValidSentryDsn,
  resolveSentryEnvironment,
  resolveSentrySampleRate,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  stripUrlQueryAndFragment,
} from '@/lib/observability/sentryPrivacy'

const VALID_DSN = 'https://public-key@o123.ingest.sentry.io/456'

describe('Sentry runtime gate', () => {
  it('requires an explicit true flag and a structurally valid DSN', () => {
    expect(isSentryRuntimeEnabled(undefined, VALID_DSN)).toBe(false)
    expect(isSentryRuntimeEnabled('false', VALID_DSN)).toBe(false)
    expect(isSentryRuntimeEnabled('true', undefined)).toBe(false)
    expect(isSentryRuntimeEnabled('TRUE', VALID_DSN)).toBe(true)
  })

  it('rejects placeholders and malformed DSNs', () => {
    expect(isValidSentryDsn('https://...@sentry.io/...')).toBe(false)
    expect(isValidSentryDsn('not-a-url')).toBe(false)
    expect(isValidSentryDsn('https://sentry.io/123')).toBe(false)
    expect(isValidSentryDsn(VALID_DSN)).toBe(true)
  })

  it('keeps sampling inside the supported range', () => {
    expect(resolveSentrySampleRate(undefined, 0.05)).toBe(0.05)
    expect(resolveSentrySampleRate('0.2', 0.05)).toBe(0.2)
    expect(resolveSentrySampleRate('-1', 0.05)).toBe(0.05)
    expect(resolveSentrySampleRate('2', 0.05)).toBe(0.05)
    expect(resolveSentrySampleRate('invalid', 0.05)).toBe(0.05)
  })

  it('resolves an honest environment fallback chain', () => {
    expect(resolveSentryEnvironment('custom', 'preview', 'production')).toBe('custom')
    expect(resolveSentryEnvironment(undefined, 'preview', 'production')).toBe('preview')
    expect(resolveSentryEnvironment(undefined, undefined, undefined)).toBe('unknown')
  })
})

describe('Sentry privacy filter', () => {
  it('removes request bodies, query strings, identity, and secret headers', () => {
    const event = sanitizeSentryEvent({
      message: 'OAuth failed at /callback?code=private-code&state=private-state',
      request: {
        url: 'https://www.nexus-grow.com/api/callback?code=private-code#fragment',
        query_string: 'code=private-code',
        cookies: { session: 'private-session' },
        data: { password: 'private-password' },
        headers: {
          authorization: 'Bearer private-token',
          cookie: 'session=private-session',
          'content-type': 'application/json',
          'user-agent': 'identifying-browser',
          'x-vercel-id': 'dub1::request-id',
        },
      },
      user: {
        id: 'user-id',
        email: 'person@example.com',
        ip_address: '203.0.113.1',
      },
      extra: {
        accessToken: 'private-token',
        nested: { client_secret: 'private-secret', safe: 'kept' },
      },
      exception: {
        values: [{ value: 'Request used Bearer private-token' }],
      },
    })

    expect(event.request).toEqual({
      url: 'https://www.nexus-grow.com/api/callback',
      headers: {
        'content-type': 'application/json',
        'x-vercel-id': 'dub1::request-id',
      },
    })
    expect(event.user).toBeUndefined()
    expect(event.extra).toEqual({
      accessToken: '[Filtered]',
      nested: { client_secret: '[Filtered]', safe: 'kept' },
    })

    const serialized = JSON.stringify(event)
    expect(serialized).not.toContain('private-token')
    expect(serialized).not.toContain('private-secret')
    expect(serialized).not.toContain('private-password')
    expect(serialized).not.toContain('private-session')
    expect(serialized).not.toContain('person@example.com')
    expect(serialized).not.toContain('private-code')
    expect(serialized).not.toContain('private-state')
  })

  it('removes query data from performance spans and prompt-shaped context', () => {
    const event = sanitizeSentryEvent({
      spans: [{ data: { url: 'https://api.example.com/items?token=private', query: 'private-query' } }],
      contexts: { ai: { prompt: 'private customer content', model: 'safe-model-name' } },
    })

    expect(event).toEqual({
      spans: [{ data: { url: 'https://api.example.com/items', query: '[Filtered]' } }],
      contexts: { ai: { prompt: '[Filtered]', model: 'safe-model-name' } },
    })
  })

  it('sanitizes breadcrumb URLs and credentials', () => {
    const breadcrumb = sanitizeSentryBreadcrumb({
      category: 'fetch',
      message: 'Bearer private-token',
      data: {
        url: '/api/social/callback?code=private-code',
        refreshToken: 'private-refresh',
        method: 'GET',
      },
    })

    expect(breadcrumb).toEqual({
      category: 'fetch',
      message: 'Bearer [Filtered]',
      data: {
        url: '/api/social/callback',
        refreshToken: '[Filtered]',
        method: 'GET',
      },
    })
  })

  it('drops console breadcrumbs instead of forwarding application logs', () => {
    expect(sanitizeSentryBreadcrumb({
      category: 'console',
      message: 'customer content that must stay local',
      data: { arguments: ['private brand brief'] },
    })).toBeNull()

    const event = sanitizeSentryEvent({
      breadcrumbs: [
        { category: 'console', message: 'private console output' },
        { category: 'navigation', data: { from: '/brand?workspace=private', to: '/strategy' } },
      ],
    })
    expect(event.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/brand', to: '/strategy' } },
    ])
  })

  it('redacts common identity and credential shapes from text', () => {
    const event = sanitizeSentryEvent({
      message: 'Failed for owner@example.com password=hunter2',
      exception: {
        values: [{ value: 'Bearer secret-token for owner@example.com' }],
      },
    })
    const serialized = JSON.stringify(event)
    expect(serialized).not.toContain('owner@example.com')
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain('secret-token')
  })

  it('creates a stable error without forwarding the original message', () => {
    const original = Object.assign(
      new Error('Database rejected owner@example.com token=private-token'),
      { code: 'P2002' },
    )
    const safe = createPrivacySafeError(original, 'billing.webhook.process')

    expect(safe.name).toBe('Error')
    expect(safe.message).toBe('billing.webhook.process failed')
    expect(safe.stack).not.toContain('owner@example.com')
    expect(safe.stack).not.toContain('private-token')
    expect(getPrivacySafeErrorCode(original)).toBe('P2002')
  })

  it('strips query strings and fragments from absolute and relative URLs', () => {
    expect(stripUrlQueryAndFragment('https://example.com/path?a=1#two')).toBe('https://example.com/path')
    expect(stripUrlQueryAndFragment('/path?a=1#two')).toBe('/path')
  })
})
