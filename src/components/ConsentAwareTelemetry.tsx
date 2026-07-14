'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const COOKIE_CONSENT_EVENT = 'nexus:cookie-consent'
export const COOKIE_CONSENT_KEY = 'nexus_cookie_consent'

type CookieConsent = {
  analytics?: boolean
}

function hasAnalyticsConsent(): boolean {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) return false
    return (JSON.parse(stored) as CookieConsent).analytics === true
  } catch {
    return false
  }
}

export default function ConsentAwareTelemetry() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const syncConsent = () => setEnabled(hasAnalyticsConsent())
    syncConsent()
    window.addEventListener(COOKIE_CONSENT_EVENT, syncConsent)
    window.addEventListener('storage', syncConsent)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, syncConsent)
      window.removeEventListener('storage', syncConsent)
    }
  }, [])

  if (!enabled) return null
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
