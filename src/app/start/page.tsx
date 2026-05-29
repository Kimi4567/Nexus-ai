'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StartPageRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/onboarding')
  }, [router])

  return (
    <div className="min-h-screen bg-deep flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-2 border-amber/20 border-t-amber animate-spin" />
        </div>
        <p className="text-text-muted text-sm">جاري التوجيه...</p>
      </div>
    </div>
  )
}
