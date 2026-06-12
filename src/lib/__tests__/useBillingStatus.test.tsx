// @vitest-environment jsdom

/**
 * Trust Sprint #3 — sidebar credit freshness.
 *
 * useBillingStatus must revalidate the billing balance on window focus, tab
 * visibility, and route (pathname) change, with a throttle so rapid events
 * don't storm the API, and invalidate() must force an immediate refetch after
 * a spend. Module state is reset per test via vi.resetModules() + dynamic import.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'

const getSession = vi.fn()
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getSession } } }))

let mockPathname = '/dashboard'
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

const billingResponse = {
  plan: 'GROWTH',
  hasActiveSubscription: true,
  credits: { remaining: 271, used: 10, max: 150 },
  currentPeriodEnd: null,
  status: 'active',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fetchMock: any

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mockPathname = '/dashboard'
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => billingResponse }))
  // The hook calls window.fetch
  ;(window as unknown as { fetch: unknown }).fetch = fetchMock
})

afterEach(() => cleanup())

async function loadHook() {
  const mod = await import('@/lib/useBillingStatus')
  return mod.useBillingStatus
}

describe('useBillingStatus revalidation', () => {
  it('fetches billing status on mount', async () => {
    const useBillingStatus = await loadHook()
    renderHook(() => useBillingStatus())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('4a. refetches on window focus', async () => {
    const useBillingStatus = await loadHook()
    renderHook(() => useBillingStatus())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('4b. refetches on tab visibility becoming visible', async () => {
    const useBillingStatus = await loadHook()
    renderHook(() => useBillingStatus())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('4c. refetches on pathname (route) change', async () => {
    const useBillingStatus = await loadHook()
    const { rerender } = renderHook(() => useBillingStatus())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    mockPathname = '/billing'
    await act(async () => { rerender() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('5. invalidate() forces an immediate refetch (after a credit spend)', async () => {
    const useBillingStatus = await loadHook()
    const { result } = renderHook(() => useBillingStatus())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => { result.current.invalidate() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('6. throttles rapid focus events into a single refetch (no storm)', async () => {
    const useBillingStatus = await loadHook()
    renderHook(() => useBillingStatus())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('focus'))
    })
    // Only ONE extra fetch despite three rapid events (throttle guard).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
