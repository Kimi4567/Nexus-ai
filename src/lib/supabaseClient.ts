import { createBrowserClient } from '@supabase/ssr'
import type { Session } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
export const NEXUS_AUTH_STORAGE_KEY = 'nexus-auth-token'

/** True only when the browser client can reach a real Supabase project. */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey !== 'placeholder',
)

// Only warn in browser/development, not during SSR build
if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  console.warn('[Nexus] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

interface LegacySessionTokens {
  access_token: string
  refresh_token: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Reads the previous localStorage session shape without trusting any user data.
 * Supabase has used both a direct session object and nested session wrappers
 * across client versions, so migration accepts either and requires both tokens.
 */
export function parseLegacySessionTokens(raw: string | null): LegacySessionTokens | null {
  if (!raw) return null

  try {
    const root = asRecord(JSON.parse(raw))
    const candidates = [
      root,
      asRecord(root?.currentSession),
      asRecord(root?.session),
      asRecord(asRecord(root?.data)?.session),
    ]

    for (const candidate of candidates) {
      const accessToken = candidate?.access_token
      const refreshToken = candidate?.refresh_token
      if (
        typeof accessToken === 'string'
        && accessToken.length > 0
        && typeof refreshToken === 'string'
        && refreshToken.length > 0
      ) {
        return { access_token: accessToken, refresh_token: refreshToken }
      }
    }
  } catch {
    return null
  }

  return null
}

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    name: NEXUS_AUTH_STORAGE_KEY,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
})

/**
 * Restores the cookie-backed session. Existing users are migrated once from
 * the former localStorage session and keep their signed-in state.
 */
export async function restoreBrowserSession(): Promise<Session | null> {
  const current = await supabase.auth.getSession()
  if (current.data.session) return current.data.session
  if (typeof window === 'undefined') return null

  let legacyRaw: string | null = null
  try {
    legacyRaw = window.localStorage.getItem(NEXUS_AUTH_STORAGE_KEY)
  } catch {
    return null
  }

  const legacyTokens = parseLegacySessionTokens(legacyRaw)
  if (!legacyTokens) return null

  const migrated = await supabase.auth.setSession(legacyTokens)
  if (migrated.error || !migrated.data.session) return null

  try {
    window.localStorage.removeItem(NEXUS_AUTH_STORAGE_KEY)
  } catch {
    // The cookie session is already valid; storage cleanup can safely be retried
    // by the browser if its storage policy changes.
  }

  return migrated.data.session
}

export { supabase }
export default supabase
