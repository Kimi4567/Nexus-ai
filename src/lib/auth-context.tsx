'use client'

import { ReactNode, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import supabase from './supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    router.push('/onboarding') // onboarding checks if workspace exists → redirects to dashboard
  }, [router])

  // signup does NOT redirect — the register page shows "check your email" screen
  const signup = useCallback(async (email: string, password: string, options?: { name?: string }) => {
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

  const authHeader = useCallback((): string => {
    return session?.access_token ? `Bearer ${session.access_token}` : ''
  }, [session])

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    authHeader,
  }
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !isAuthenticated && !pathname.startsWith('/auth')) {
      router.push('/auth/login')
    }
  }, [loading, isAuthenticated, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
