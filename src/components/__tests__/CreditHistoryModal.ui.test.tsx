// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreditHistoryModal, { type Transaction } from '@/components/CreditHistoryModal'

const authHeader = vi.hoisted(() => vi.fn(() => 'Bearer test-token'))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ authHeader }),
}))

vi.mock('@/lib/i18n-context', () => ({
  useI18n: () => ({ locale: 'en', dir: 'ltr' }),
}))

function transaction(index: number): Transaction {
  return {
    id: `tx-${index}`,
    action: 'RUN_FULL_STRATEGY',
    description: `Operation ${index}`,
    amount: -12,
    entityId: `campaign-${index}`,
    entityType: 'campaign',
    pricingVersion: '2026-07-16-v2',
    status: 'SETTLED',
    creditCost: 12,
    reservedAt: null,
    settledAt: '2026-07-16T06:07:01.000Z',
    refundedAt: null,
    createdAt: '2026-07-16T06:07:00.000Z',
  }
}

describe('CreditHistoryModal browsing controls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ history: Array.from({ length: 25 }, (_, index) => transaction(index + 1)) }),
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('paginates long ledgers and supports a real search', async () => {
    render(<CreditHistoryModal open onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('Operation 1')).toBeTruthy())
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(screen.queryByText('Operation 11')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Operation 11')).toBeTruthy()
    expect(screen.getByText('2/3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Search credit history'), { target: { value: 'Operation 25' } })
    expect(screen.getByText('Operation 25')).toBeTruthy()
    expect(screen.getByText('1/1')).toBeTruthy()
  })
})
