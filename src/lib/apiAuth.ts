/**
 * API route auth helper — extracts user ID from Supabase JWT
 * Accepts both NextRequest and standard Request
 */
import { verifySupabaseToken } from '@/lib/supabaseAuth'

export async function getServerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  const user = await verifySupabaseToken(token)
  return user?.id ?? null
}
