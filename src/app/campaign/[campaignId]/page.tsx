'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

/**
 * Legacy route — redirects to the canonical campaigns/[id] page.
 */
export default function LegacyCampaignRedirect() {
  const router = useRouter()
  const params = useParams()
  const id = params?.campaignId as string

  useEffect(() => {
    if (id) router.replace(`/campaigns/${id}`)
    else router.replace('/campaigns')
  }, [id, router])

  return null
}
