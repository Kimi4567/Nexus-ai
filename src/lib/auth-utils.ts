/**
 * Server-side auth utilities — Supabase only (NextAuth removed)
 */
import { verifySupabaseToken } from './supabaseAuth'
import { headers } from 'next/headers'

export interface AuthenticatedUser {
  id: string
  email?: string | null
  name?: string | null
}

/**
 * Get the current user from the Authorization header (server components / route handlers)
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const headersList = await headers()
    const authHeader = headersList.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return null
    const user = await verifySupabaseToken(token)
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
    }
  } catch {
    return null
  }
}

/**
 * Require auth — throws if not authenticated
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Authentication required')
  return user
}
