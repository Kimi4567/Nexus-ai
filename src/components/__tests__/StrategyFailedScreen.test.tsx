// @vitest-environment jsdom

/**
 * Trust & Reliability Sprint #1 — the strategy-failure UI.
 *
 * Proves the failure screen exists with a Retry action and shows the refund
 * message when credits were refunded. Together with strategyOutcome.test.ts
 * (failed → never proceeds; success → proceeds) this covers the required proofs.
 */

import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import StrategyFailedScreen from '../StrategyFailedScreen'

afterEach(() => cleanup())

const baseProps = {
  title: 'Strategy generation failed',
  description: "We couldn't generate your campaign strategy. No content was created.",
  refundNote: 'The credits charged for this attempt have been refunded.',
  retryLabel: 'Try again',
  viewCampaignLabel: 'Go to campaign page',
  onRetry: () => {},
  onViewCampaign: () => {},
}

describe('StrategyFailedScreen', () => {
  it('renders the failure title and description (not a success state)', () => {
    render(<StrategyFailedScreen {...baseProps} refunded={false} />)
    expect(screen.getByText('Strategy generation failed')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('shows the refund message when refunded is true', () => {
    render(<StrategyFailedScreen {...baseProps} refunded={true} />)
    const note = screen.getByTestId('refund-note')
    expect(note).toBeTruthy()
    expect(note.textContent).toContain('refunded')
  })

  it('does NOT show the refund message when refunded is false', () => {
    render(<StrategyFailedScreen {...baseProps} refunded={false} />)
    expect(screen.queryByTestId('refund-note')).toBeNull()
  })

  it('exposes a Retry action that fires onRetry', () => {
    const onRetry = vi.fn()
    render(<StrategyFailedScreen {...baseProps} refunded={true} onRetry={onRetry} />)
    const retry = screen.getByRole('button', { name: /try again/i })
    expect(retry).toBeTruthy()
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers a secondary action to view the campaign instead of pretending success', () => {
    const onViewCampaign = vi.fn()
    render(<StrategyFailedScreen {...baseProps} refunded={false} onViewCampaign={onViewCampaign} />)
    fireEvent.click(screen.getByRole('button', { name: /go to campaign page/i }))
    expect(onViewCampaign).toHaveBeenCalledTimes(1)
  })
})
