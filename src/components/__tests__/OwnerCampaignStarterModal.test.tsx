// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/CreditConfirmModal', () => ({
  default: (props: {
    isOpen: boolean
    cost: number
    onConfirm: () => void
  }) => props.isOpen
    ? (
        <div role="dialog" aria-label="credit confirmation">
          <button type="button" onClick={props.onConfirm}>
            confirm-credit-{props.cost}
          </button>
        </div>
      )
    : null,
}))

import OwnerCampaignStarterModal from '@/components/OwnerCampaignStarterModal'

const onStart = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('OwnerCampaignStarterModal', () => {
  it('keeps the owner choice simple and states the no-publish/no-spend boundary', () => {
    render(
      <OwnerCampaignStarterModal
        open
        busy={false}
        error={null}
        locale="ar"
        authHeader={() => 'Bearer token'}
        onClose={() => undefined}
        onStart={onStart}
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByText(/لن ينشر NEXUS أي محتوى ولن ينفق أي ميزانية/)).toBeTruthy()
    expect(screen.getByText('مراجعة التكلفة وبدء التجهيز')).toBeTruthy()
  })

  it('passes the selected outcome only after the explicit 12-credit confirmation', () => {
    render(
      <OwnerCampaignStarterModal
        open
        busy={false}
        error={null}
        locale="en"
        authHeader={() => 'Bearer token'}
        onClose={() => undefined}
        onStart={onStart}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: /More sales/ }))
    fireEvent.click(screen.getByText('Review cost and start'))
    expect(onStart).not.toHaveBeenCalled()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.queryByText('What outcome matters most now?')).toBeNull()
    fireEvent.click(screen.getByText('confirm-credit-12'))
    expect(onStart).toHaveBeenCalledWith('SALES')
  })
})
