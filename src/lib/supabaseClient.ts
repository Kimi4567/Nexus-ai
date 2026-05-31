import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Only warn in browser/development, not during SSR build
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder'))) {
  console.warn('[Nexus] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Explicit localStorage adapter — avoids issues where Supabase storage
// detection fails in some Next.js App Router SSR/hydration edge cases.
// The SSR guard (typeof window check) prevents server-side crashes.
const nexusStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(key, value) } catch {}
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    try { window.localStorage.removeItem(key) } catch {}
  },
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: nexusStorage,
    storageKey: 'nexus-auth-token',
  },
})

export { supabase }
export default supabase
