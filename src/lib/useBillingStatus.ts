/**
 * useBillingStatus — lightweight hook to fetch + cache billing status.
 *
 * Cached for 60s so the sidebar doesn't hammer the API on every render, but it
 * REVALIDATES on window focus, tab visibility, and route (pathname) change so
 * the sidebar credit balance never lags behind /billing after a spend.
 * Cross-instance throttle + in-flight dedupe prevent refetch storms.
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export interface BillingStatus {
  plan: string
  hasActiveSubscription: boolean
  /** False when live Stripe billing is intentionally disabled (beta/hold). */
  billingEnabled?: boolean
  credits: {
    remaining: number
    used: number
    max: number   // -1 = unlimited
  }
  currentPeriodEnd: string | null
  status: string
}

const CACHE_TTL = 60_000          // serve cache for 60s on normal reads
const REVALIDATE_THROTTLE = 8_000 // min gap between focus/visibility/path revalidations (storm guard)

let _cache: { data: BillingStatus; ts: number; userId: string } | null = null
let _inflight: Promise<void> | null = null
let _lastRevalidate = 0

export function useBillingStatus() {
  // Do not seed from the module cache before we know the current auth user;
  // otherwise logging out and into another account can briefly expose the
  // previous user's plan/credit balance. The per-user cache is still used after
  // getSession resolves below.
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async (force = false) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setStatus(null)
      setLoading(false)
      return
    }
    // Supabase normally includes `session.user.id`; use the access token as a
    // test/legacy fallback so the cache is still isolated per authenticated
    // session without ever sharing anonymous data.
    const userId = session.user?.id ?? session.access_token

    // Serve a fresh cache only for the authenticated user currently mounted.
    if (!force && _cache && _cache.userId === userId && Date.now() - _cache.ts < CACHE_TTL) {
      setStatus(_cache.data)
      setLoading(false)
      return
    }

    // Dedupe concurrent fetches (e.g. several mounted consumers on focus) into one request.
    if (_inflight) {
      await _inflight
      if (_cache?.userId === userId) {
        setStatus(_cache.data)
        setLoading(false)
      } else {
        // A concurrent request for another account must not hydrate this hook
        // with that account's data. The in-flight request has completed, so a
        // forced retry is safe and will fetch this user's status.
        await fetchStatus(true)
      }
      return
    }

    _inflight = (async () => {
      try {
        const res = await window.fetch('/api/billing/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('status error')
        const data: BillingStatus = await res.json()
        // Normalize: if credits is a number (legacy), wrap it
        if (typeof data.credits === 'number') {
          const n = data.credits as unknown as number
          // Legacy responses do not carry a reliable plan allowance. Keep the
          // denominator unknown instead of inventing a stale 15-credit quota.
          data.credits = { remaining: n, used: 0, max: n === -1 ? -1 : 0 }
        }
        _cache = { data, ts: Date.now(), userId }
      } catch { /* silent */ }
    })()

    try { await _inflight } finally { _inflight = null }
    // Never hydrate from a cache entry produced for a different session if the
    // auth context changed while this request was in flight.
    if (_cache?.userId === userId) setStatus(_cache.data)
    else setStatus(null)
    setLoading(false)
  }, [])

  // Initial load
  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Throttled force-refresh used by focus / visibility / navigation triggers.
  const revalidate = useCallback(() => {
    const now = Date.now()
    if (now - _lastRevalidate < REVALIDATE_THROTTLE) return // storm guard (shared across instances)
    _lastRevalidate = now
    fetchStatus(true)
  }, [fetchStatus])

  // Revalidate on route change (skip the initial mount run).
  const pathname = usePathname()
  const didMountPath = useRef(false)
  useEffect(() => {
    if (!didMountPath.current) { didMountPath.current = true; return }
    revalidate()
  }, [pathname, revalidate])

  // Revalidate on window focus / tab becoming visible.
  useEffect(() => {
    const onFocus = () => revalidate()
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') revalidate()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [revalidate])

  /** Call after a successful credit-spending action to refresh immediately. */
  const invalidate = useCallback(() => {
    _cache = null
    _lastRevalidate = 0
    return fetchStatus(true)
  }, [fetchStatus])

  const creditsRemaining = status?.credits?.remaining ?? 0
  const creditsMax       = status?.credits?.max ?? 0
  const isUnlimited      = creditsMax === -1
  const isPaid           = status?.hasActiveSubscription ?? false
  // Guard against loading — don't show warning states while data is still fetching
  const isLow  = !loading && !isUnlimited && creditsRemaining <= 3 && creditsRemaining > 0
  const isEmpty = !loading && !isUnlimited && creditsRemaining <= 0

  return { status, loading, invalidate, refetch: fetchStatus, creditsRemaining, creditsMax, isUnlimited, isPaid, isLow, isEmpty }
}
