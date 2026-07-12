/**
 * API route auth helper — extracts user ID from Supabase JWT
 * Accepts both NextRequest and standard Request
 */
import { verifySupabaseToken } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+([^\s]+)$/i)
  return match?.[1] || null
}

export async function getServerUserId(req: Request): Promise<string | null> {
  const token = getBearerToken(req)
  if (!token) return null
  const user = await verifySupabaseToken(token)
  return user?.id ?? null
}

/** Returns the full user object (id + email) from the Authorization header */
export async function getAuthUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const token = getBearerToken(req)
  if (!token) return null
  const user = await verifySupabaseToken(token)
  if (!user?.id) return null
  return { id: user.id, email: user.email }
}

/**
 * Ensures a Prisma User row exists for the authenticated Supabase user,
 * always syncing the REAL email from the JWT (fixes placeholder email bug).
 * Returns { id, email } or null if unauthenticated.
 */
export async function ensureDbUser(req: Request): Promise<{ id: string; email: string } | null> {
  const token = getBearerToken(req)
  if (!token) return null

  const sbUser = await verifySupabaseToken(token)
  if (!sbUser?.id || !sbUser?.email) return null

  const realEmail = sbUser.email
  const realName  = (sbUser.user_metadata?.name as string | undefined) || null

  try {
    await prisma.user.upsert({
      where: { id: sbUser.id },
      // Always sync real email + name from Supabase Auth metadata
      update: {
        email: realEmail,
        ...(realName ? { name: realName } : {}),
      },
      create: { id: sbUser.id, email: realEmail, name: realName },
    })
  } catch (err) {
    console.error('[ensureDbUser] upsert failed', err)
  }

  return { id: sbUser.id, email: realEmail }
}
