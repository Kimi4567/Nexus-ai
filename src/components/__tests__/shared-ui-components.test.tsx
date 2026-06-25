// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActionButton } from '@/components/ui/ActionButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { MetricCard } from '@/components/ui/MetricCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReadinessBadge, READINESS_BADGE_LABELS } from '@/components/ui/ReadinessBadge'
import { SectionCard } from '@/components/ui/SectionCard'
import { StatusBadge, STATUS_BADGE_LABELS } from '@/components/ui/StatusBadge'

describe('DS-PR2 shared UI components', () => {
  it('renders the page and section primitives', () => {
    render(
      <>
        <PageHeader
          eyebrow="Strategy"
          title="Marketing Strategy"
          description="Plan the next best move."
          primaryAction={<ActionButton>Primary</ActionButton>}
          secondaryAction={<ActionButton variant="ghost">Secondary</ActionButton>}
        />
        <SectionCard title="Readiness" description="Current operating state">
          <p>Section content</p>
        </SectionCard>
      </>
    )

    expect(screen.getByText('Marketing Strategy')).toBeTruthy()
    expect(screen.getByText('Plan the next best move.')).toBeTruthy()
    expect(screen.getByText('Readiness')).toBeTruthy()
    expect(screen.getByText('Section content')).toBeTruthy()
  })

  it('keeps status badge labels truthful and excludes Live', () => {
    render(
      <>
        <StatusBadge status="autoScheduled" />
        <StatusBadge status="published" />
        <StatusBadge status="failed" />
      </>
    )

    expect(screen.getByText('Auto-plan queued')).toBeTruthy()
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(Object.values(STATUS_BADGE_LABELS).join(' ')).not.toMatch(/\bLive\b/i)
  })

  it('renders readiness badges with planning-only language', () => {
    render(
      <>
        <ReadinessBadge status="ready" />
        <ReadinessBadge status="planningOnly" />
        <ReadinessBadge status="permissionNeeded" />
      </>
    )

    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByText('Planning only')).toBeTruthy()
    expect(screen.getByText('Permission needed')).toBeTruthy()
    expect(Object.values(READINESS_BADGE_LABELS).join(' ')).not.toMatch(/\bLive\b/i)
  })

  it('supports button loading and disabled states', () => {
    const onClick = vi.fn()
    render(
      <>
        <ActionButton loading onClick={onClick}>Generating</ActionButton>
        <ActionButton disabled onClick={onClick}>Disabled</ActionButton>
      </>
    )

    expect(screen.getByText('Generating')).toBeTruthy()
    expect(screen.getByText('Disabled')).toBeTruthy()
    screen.getByText('Generating').click()
    screen.getByText('Disabled').click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders empty, loading, error, and metric states', () => {
    render(
      <>
        <EmptyState title="No campaigns yet" description="Create a campaign when ready." />
        <LoadingState label="Checking workspace" />
        <ErrorState title="Could not load data" description="Please try again." />
        <MetricCard label="Credits" value="130" helper="Available for generation" />
      </>
    )

    expect(screen.getByText('No campaigns yet')).toBeTruthy()
    expect(screen.getByText('Checking workspace')).toBeTruthy()
    expect(screen.getByText('Could not load data')).toBeTruthy()
    expect(screen.getByText('130')).toBeTruthy()
  })
})
