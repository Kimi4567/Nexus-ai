import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedAdminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase server configuration is unavailable')
  }

  cachedAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedAdminClient
}

/**
 * Backwards-compatible lazy client. Importing an API route must never require
 * deployment secrets during Next.js page-data collection.
 */
const adminClient = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export async function verifySupabaseToken(accessToken?: string) {
  if (!accessToken) return null
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken)
    if (error) {
      console.warn('[Nexus] Supabase token verification failed', error.message)
      return null
    }
    return data.user
  } catch (err) {
    console.error('[Nexus] verifySupabaseToken error', err)
    return null
  }
}

export { adminClient }
export default { verifySupabaseToken }
