'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Campaign results are stored in sessionStorage (set by the wizard after AI generation).
 * This route exists for deep-link compatibility — it redirects to the primary results page
 * which reads from sessionStorage. If no session data exists, the results page will show
 * an appropriate empty state prompting the user to create a campaign.
 */
export default function CampaignIdResultsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/campaign/results')
  }, [router])

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center text-gray-400">
      Loading results...
    </div>
  )
}
