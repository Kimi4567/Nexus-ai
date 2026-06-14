// @vitest-environment jsdom

/**
 * Strategy PR-2B2A — StrategySection (premium collapsible) behavior.
 * Pure UI; no network, no generation.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StrategySection from '@/components/StrategySection'

describe('StrategySection', () => {
  it('renders title and children expanded when defaultOpen', () => {
    render(
      <StrategySection title="Marketing Funnel" defaultOpen>
        <p>funnel body</p>
      </StrategySection>,
    )
    expect(screen.getByText('Marketing Funnel')).toBeTruthy()
    expect(screen.getByText('funnel body')).toBeTruthy()
  })

  it('hides children when collapsed by default, shows after toggle', () => {
    render(
      <StrategySection title="Channel Strategy" defaultOpen={false}>
        <p>channel body</p>
      </StrategySection>,
    )
    // collapsed: body not in the DOM
    expect(screen.queryByText('channel body')).toBeNull()
    // header is a button reflecting collapsed state
    const btn = screen.getByRole('button', { name: /Channel Strategy/i })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(screen.getByText('channel body')).toBeTruthy()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('locked sections stay open and are not toggleable', () => {
    render(
      <StrategySection title="Readiness" locked defaultOpen={false}>
        <p>always visible</p>
      </StrategySection>,
    )
    // locked overrides defaultOpen=false → content visible
    expect(screen.getByText('always visible')).toBeTruthy()
    const btn = screen.getByRole('button', { name: /Readiness/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(btn)
    expect(screen.getByText('always visible')).toBeTruthy()
  })

  it('renders an optional hint', () => {
    render(
      <StrategySection title="KPIs" hint="2 metrics" defaultOpen>
        <p>kpi body</p>
      </StrategySection>,
    )
    expect(screen.getByText('2 metrics')).toBeTruthy()
  })
})
