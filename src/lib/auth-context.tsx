'use client'

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import supabase from './supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

// ── Auth context shape ──────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null
  session: Session | null
  /** true while the initial session is being read from storage */
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, options?: { name?: string }) => Promise<void>
  logout: () => Promise<void>
  /** Returns "Bearer <access_token>" or "" if not authenticated */
  authHeader: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ── Provider ────────────────────────────────────────────────────────────────
// Holds the SINGLE shared auth state for the entire app.
// All useAuth() calls read from here — no more per-component independent state.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  // loading stays true until getSession() resolves — the only reliable way to know
  // whether a persisted session exists.
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    // resolved prevents double-setting state from two async sources
    let resolved = false

    const resolveAuth = (sess: Session | null) => {
      if (!mounted || resolved) return
      resolved = true
      setSession(sess)
      setUser(sess?.user ?? null)
      setLoading(false)
    }

    // ── Source 1: getSession() ────────────────────────────────────────────────
    // Reads from localStorage, auto-refreshes access token if expired,
    // returns the final valid session (or null if refresh fails).
    // Primary and most reliable source — handles network gracefully.
    supabase.auth.getSession()
      .then(({ data }) => resolveAuth(data.session))
      .catch(() => resolveAuth(null))

    // ── Source 2: onAuthStateChange ───────────────────────────────────────────
    // Dual role:
    //   a) INITIAL_SESSION with a valid session = fast-path before getSession resolves
    //      (we ignore INITIAL_SESSION null — that fires during in-progress refresh)
    //   b) SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED update state after boot
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, sess) => {
        if (!mounted) return

        if (event === 'INITIAL_SESSION') {
          // Fast-path: use it only when it has a real session and we haven't resolved yet
          if (sess && !resolved) resolveAuth(sess)
          return
        }

        // Post-boot state transitions — always update
        setSession(sess)
        setUser(sess?.user ?? null)
        if (!resolved) resolveAuth(sess)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Login page handles redirect via window.location.href — we don't push here
    // to avoid double-navigation. If called programmatically, push to onboarding.
    router.push('/onboarding')
  }, [router])

  const signup = useCallback(async (
    email: string,
    password: string,
    options?: { name?: string },
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: options?.name } },
    })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    router.push('/')
  }, [router])

  // authHeader reads from the shared session — always up-to-date after token refresh
  const authHeader = useCallback((): string => {
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }, [session])

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      authHeader,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────────────────────
// All components call this — they share the same state from AuthProvider.

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Make sure it is in providers.tsx.')
  }
  return ctx
}

// ── Protected-route helper ─────────────────────────────────────────────────
// Waits for loading to finish before deciding to redirect.

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect once loading is done AND the user is confirmed not authenticated
    if (!loading && !isAuthenticated && !pathname.startsWith('/auth')) {
      router.push('/auth/login')
    }
  }, [loading, isAuthenticated, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
