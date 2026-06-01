/**
 * useBillingStatus — lightweight hook to fetch + cache billing status.
 * Cached for 60 seconds so the sidebar doesn't hammer the API on every render.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface BillingStatus {
  plan: string
  hasActiveSubscription: boolean
  credits: {
    remaining: number
    used: number
    max: number   // -1 = unlimited
  }
  currentPeriodEnd: string | null
  status: string
}

const CACHE_TTL = 60_000  // 60 seconds
let _cache: { data: BillingStatus; ts: number } | null = null

export function useBillingStatus() {
  const [status, setStatus] = useState<BillingStatus | null>(_cache?.data ?? null)
  const [loading, setLoading] = useState(!_cache)

  const fetch = useCallback(async (force = false) => {
    if (!force && _cache && Date.now() - _cache.ts < CACHE_TTL) {
      setStatus(_cache.data)
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setLoading(false); return }

    try {
      const res = await window.fetch('/api/billing/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('status error')
      const data: BillingStatus = await res.json()
      // Normalize: if credits is a number (legacy), wrap it
      if (typeof data.credits === 'number') {
        const n = data.credits as unknown as number
        data.credits = { remaining: n, used: 0, max: n === -1 ? -1 : 15 }
      }
      _cache = { data, ts: Date.now() }
      setStatus(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  /** Call after a successful AI generation to update cache */
  const invalidate = () => { _cache = null; fetch(true) }

  const creditsRemaining = status?.credits?.remaining ?? 0
  const creditsMax       = status?.credits?.max ?? 15
  const isUnlimited      = creditsMax === -1
  const isPaid           = status?.hasActiveSubscription ?? false
  const isLow            = !isUnlimited && creditsRemaining <= 3 && creditsRemaining > 0
  const isEmpty          = !isUnlimited && creditsRemaining <= 0

  return { status, loading, invalidate, creditsRemaining, creditsMax, isUnlimited, isPaid, isLow, isEmpty }
}
