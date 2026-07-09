'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StartPageRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/onboarding')
  }, [router])

  return (
    <div className="min-h-screen bg-[#f6f8fc] flex items-center justify-center text-[#071332]">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-100 border-t-indigo-600 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-500">جاري فتح إعداد Brand Brain...</p>
      </div>
    </div>
  )
}
