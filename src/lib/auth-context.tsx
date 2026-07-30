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
import supabase, { restoreBrowserSession } from './supabaseClient'
import type { User, Session } from '@supabase/supabase-js'
import { getBrandBrainReadiness } from './brandReadiness'
import { getFirstRunJourney, type StrategyState } from './firstUserJourney'

// ── Auth context shape ──────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null
  session: Session | null
  /** true while the initial session is being read from storage */
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, options?: { name?: string }) => Promise<{ needsEmailConfirmation: boolean }>
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
  const pathname = usePathname()

  useEffect(() => {
    // Customer-facing campaign pages are intentionally public. Avoid booting
    // Supabase session recovery on them: a stale app refresh token must not add
    // auth noise or latency to unsubscribe, landing, or lead-intake journeys.
    const publicCustomerJourney = pathname === '/unsubscribe'
      || pathname.startsWith('/lead-form/')
      || pathname.startsWith('/lp/')
    if (publicCustomerJourney) {
      setSession(null)
      setUser(null)
      setLoading(false)
      return
    }

    let mounted = true
    // resolved prevents double-setting state from two async sources
    let resolved = false
    let bootTimeout: ReturnType<typeof setTimeout> | null = null

    const resolveAuth = (sess: Session | null) => {
      if (!mounted || resolved) return
      resolved = true
      if (bootTimeout) clearTimeout(bootTimeout)
      setSession(sess)
      setUser(sess?.user ?? null)
      setLoading(false)
    }

    // Supabase session recovery can wait on a cross-tab refresh lock. Never leave
    // the whole application behind an infinite loading screen if that lock stalls.
    bootTimeout = setTimeout(() => resolveAuth(null), 10_000)

    // ── Source 1: cookie session recovery + one-time legacy migration ─────────
    // Reads the SSR-compatible cookie session. Existing users are migrated from
    // the former localStorage session without being forced to sign in again.
    restoreBrowserSession()
      .then(resolveAuth)
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

        // On every sign-in, fire a background sync to ensure the Prisma User
        // row exists with the real email. This makes new users visible in the
        // admin dashboard immediately, without waiting for their first API call.
        if (event === 'SIGNED_IN' && sess?.access_token) {
          fetch('/api/user/me', {
            headers: { Authorization: `Bearer ${sess.access_token}` },
          }).catch(() => {})
        }
      }
    )

    return () => {
      mounted = false
      if (bootTimeout) clearTimeout(bootTimeout)
      subscription.unsubscribe()
    }
  }, [pathname])

  // ── Auth actions ─────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // BUG-02 fix: route returning users to dashboard, new users to onboarding
    // Login page also handles redirect — this fires when login() is called programmatically
    if (data.session?.access_token) {
      try {
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        const me = await res.json()
        if (!me?.workspaceId) {
          router.push('/onboarding')
          return
        }

        const [brandRes, statsRes] = await Promise.allSettled([
          fetch('/api/brand', { headers: { Authorization: `Bearer ${data.session.access_token}` } }),
          fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${data.session.access_token}` } }),
        ])
        const brandData = brandRes.status === 'fulfilled' && brandRes.value.ok ? await brandRes.value.json() : null
        const statsData = statsRes.status === 'fulfilled' && statsRes.value.ok ? await statsRes.value.json() : null
        const brandProfile = brandData?.brandProfile ?? null
        const brandReadiness = getBrandBrainReadiness(brandProfile)
        const campaignCount = statsData?.stats?.campaigns?.total ?? 0
        const contentPostsTotal = statsData?.stats?.contentPosts?.total ?? 0
        const approvedOrLaterPosts = statsData?.stats?.contentPosts?.approvedOrLater ?? 0
        const strategyState: StrategyState = campaignCount === 0 ? 'none' : (contentPostsTotal > 0 ? 'approved' : 'draft')
        const journey = getFirstRunJourney({
          hasWorkspace: true,
          hasBrandProfile: Boolean(brandProfile?.brandName || brandProfile?.industry || brandProfile?.description),
          brandBrainReady: brandReadiness.ready,
          strategyState,
          hasCampaignOrContent: campaignCount > 0 || contentPostsTotal > 0,
          hasContent: contentPostsTotal > 0,
          contentApproved: approvedOrLaterPosts > 0,
        })
        router.push(journey.state === 'execution_ready_later' ? '/dashboard' : journey.href)
      } catch {
        router.push('/dashboard')
      }
    }
  }, [router])

  const signup = useCallback(async (
    email: string,
    password: string,
    options?: { name?: string },
  ) => {
    const emailRedirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/login`
      : undefined

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: options?.name },
        emailRedirectTo,
      },
    })
    if (error) throw error
    return { needsEmailConfirmation: !data.session }
  }, [])

  const logout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      Object.keys(localStorage)
        .filter((key) => key === 'nexus_chat_v2' || key.startsWith('nexus_chat_v3:'))
        .forEach((key) => localStorage.removeItem(key))
    }
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    // The protected shell unmounts as soon as Supabase emits the sign-out
    // event. A client-side push can be abandoned at that point and leave an
    // empty protected page behind, so complete sign-out with a hard redirect.
    if (typeof window !== 'undefined') {
      window.location.assign('/auth/login')
      return
    }
    router.replace('/auth/login')
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
