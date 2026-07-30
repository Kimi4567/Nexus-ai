// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreditConfirmModal from '@/components/CreditConfirmModal'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function modal() {
  return (
    <CreditConfirmModal
      isOpen
      onClose={() => undefined}
      onConfirm={() => undefined}
      cost={12}
      actionTitle="Prepare campaign strategy"
      reason="Create a reviewable campaign strategy."
      authHeader={() => 'Bearer test'}
      locale="en"
    />
  )
}

describe('CreditConfirmModal balance gate', () => {
  it('shows a neutral loading state instead of a false upgrade action', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    render(modal())

    expect(screen.getByText('Checking balance…')).toBeTruthy()
    expect(screen.queryByText('Upgrade plan')).toBeNull()
    expect(screen.queryByText('Approve and start')).toBeNull()
  })

  it('shows the exact post-action balance only after the live balance resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ creditsRemaining: 15 }),
    }))
    render(modal())

    await waitFor(() => {
      expect(screen.getByText(/Your balance after this action will be 3 credits/)).toBeTruthy()
    })
    expect(screen.getByText('Confirm — 12 credits')).toBeTruthy()
    expect(screen.queryByText('Upgrade plan')).toBeNull()
  })

  it('keeps spending disabled when the balance cannot be verified', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(modal())

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no credits were charged')
    })
    expect(screen.queryByText('Upgrade plan')).toBeNull()
  })
})
