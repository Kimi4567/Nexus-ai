import { describe, expect, it } from 'vitest'
import { parseLegacySessionTokens } from '@/lib/supabaseClient'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('legacy Supabase browser-session migration', () => {
  const expected = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
  }

  it('accepts the direct session shape used by the former storage adapter', () => {
    expect(parseLegacySessionTokens(JSON.stringify({
      ...expected,
      user: { id: 'user-id' },
    }))).toEqual(expected)
  })

  it('accepts a nested historical session wrapper', () => {
    expect(parseLegacySessionTokens(JSON.stringify({
      currentSession: expected,
    }))).toEqual(expected)
  })

  it.each([
    null,
    '',
    'not-json',
    JSON.stringify({ access_token: 'only-one-token' }),
    JSON.stringify({ currentSession: null }),
  ])('rejects malformed or incomplete state', (raw) => {
    expect(parseLegacySessionTokens(raw)).toBeNull()
  })

  it('returns migrated users to the originally requested protected page', () => {
    const loginSource = readFileSync(
      resolve(process.cwd(), 'src/app/auth/login/page.tsx'),
      'utf8',
    )

    expect(loginSource).toContain('authLoading || !isAuthenticated || loading')
    expect(loginSource).toContain("window.location.replace(redirectTo || '/dashboard')")
  })
})
