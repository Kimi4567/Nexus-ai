'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

/**
 * Guards a page — waits for the initial session check (loading) before
 * deciding to redirect. The old version redirected immediately when
 * isAuthenticated=false without waiting for loading=false, which caused
 * every page refresh to land on /auth/login.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020204' }}>
        <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}

export { ProtectedRoute }
