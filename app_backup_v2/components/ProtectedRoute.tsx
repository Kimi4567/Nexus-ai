'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuth } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuth) {
      router.push('/login')
    }
  }, [isAuth, router])

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020204' }}>
        <div className="animate-spin w-8 h-8 border-2 border-amber border-t-transparent rounded-full" />
      </div>
    )
  }

  return <>{children}</>
}

export { ProtectedRoute }
