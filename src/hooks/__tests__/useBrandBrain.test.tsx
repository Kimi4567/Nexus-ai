// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getBrandBrainLoadGate, useBrandBrain } from '../useBrandBrain'

type AuthState = {
  loading: boolean
  isAuthenticated: boolean
  authHeader: () => string
}

let authState: AuthState

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => authState,
}))

describe('getBrandBrainLoadGate', () => {
  it('waits while auth is still resolving', () => {
    expect(getBrandBrainLoadGate({
      authLoading: true,
      isAuthenticated: false,
      authorization: '',
    })).toEqual({ status: 'wait-for-auth' })
  })

  it('skips when auth resolved unauthenticated', () => {
    expect(getBrandBrainLoadGate({
      authLoading: false,
      isAuthenticated: false,
      authorization: '',
    })).toEqual({ status: 'skip-unauthenticated' })
  })

  it('waits for a real authorization header before loading Brand Brain', () => {
    expect(getBrandBrainLoadGate({
      authLoading: false,
      isAuthenticated: true,
      authorization: '',
    })).toEqual({ status: 'wait-for-auth' })
  })

  it('allows loading only after auth resolves with a token', () => {
    expect(getBrandBrainLoadGate({
      authLoading: false,
      isAuthenticated: true,
      authorization: 'Bearer token',
    })).toEqual({ status: 'load', authorization: 'Bearer token' })
  })
})

describe('useBrandBrain auth-ready loading', () => {
  beforeEach(() => {
    authState = {
      loading: true,
      isAuthenticated: false,
      authHeader: () => '',
    }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('does not call /api/brand before the auth token exists', async () => {
    const { result, rerender } = renderHook(() => useBrandBrain())

    await act(async () => {})
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    authState = {
      loading: false,
      isAuthenticated: true,
      authHeader: () => '',
    }
    rerender()

    await act(async () => {})
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('loads Brand Brain once a token is available', async () => {
    authState = {
      loading: false,
      isAuthenticated: true,
      authHeader: () => 'Bearer ready-token',
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        brandProfile: { brandName: 'Nesreen Studio', toneKeywords: 'warm, practical' },
        maturity: { score: 55, missing: [] },
      }),
    } as Response)

    const { result } = renderHook(() => useBrandBrain())

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/brand', {
      headers: { Authorization: 'Bearer ready-token' },
    }))

    await waitFor(() => {
      expect(result.current.brand?.brandName).toBe('Nesreen Studio')
      expect(result.current.brand?.toneKeywords).toEqual(['warm', 'practical'])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  it('retries one transient 401 instead of showing a false Brand Brain error', async () => {
    authState = {
      loading: false,
      isAuthenticated: true,
      authHeader: () => 'Bearer ready-token',
    }

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          brandProfile: { brandName: 'Nesreen Studio' },
          maturity: { score: 55, missing: [] },
        }),
      } as Response)

    const { result } = renderHook(() => useBrandBrain())

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1))
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(result.current.brand?.brandName).toBe('Nesreen Studio')
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
})
