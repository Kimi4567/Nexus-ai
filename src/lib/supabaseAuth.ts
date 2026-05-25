import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Nexus] Missing SUPABASE_SERVICE_ROLE_KEY — server auth will be limited.')
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey)

export async function verifySupabaseToken(accessToken?: string) {
  if (!accessToken) return null
  try {
    const { data, error } = await adminClient.auth.getUser(accessToken)
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
