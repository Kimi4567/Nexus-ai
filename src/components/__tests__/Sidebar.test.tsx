// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from '@/components/Sidebar'

const billingState = vi.hoisted(() => ({
  value: {
    creditsRemaining: 0,
    creditsMax: 10,
    isUnlimited: false,
    isPaid: false,
    isLow: false,
    isEmpty: true,
    loading: false,
    status: {
      plan: 'free',
      status: 'active',
      hasActiveSubscription: false,
      credits: { remaining: 0, max: 10 },
    },
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/brand',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'free@example.com', user_metadata: { name: 'Free User' } },
    isAuthenticated: true,
    authHeader: () => 'Bearer test-token',
  }),
}))

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

vi.mock('@/lib/i18n-context', () => ({
  useI18n: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    dir: 'ltr',
    t: (key: string) => ({
      'sidebar.home': 'Home',
      'sidebar.brand': 'Brand Brain',
      'sidebar.strategy': 'Strategy',
      'sidebar.campaigns': 'Campaigns',
      'sidebar.contentHub': 'Content Hub',
      'sidebar.calendar': 'Calendar',
      'sidebar.media': 'Media',
      'sidebar.mediaLibrary': 'Media Library',
      'sidebar.connections': 'Connections',
      'sidebar.badgeSetup': 'Setup',
      'sidebar.settings': 'Settings',
      'sidebar.billing': 'Billing',
      'sidebar.expand': 'Expand',
      'sidebar.collapse': 'Collapse',
      'sidebar.upgradePro': 'Upgrade Pro',
      'sidebar.unlockAll': 'Unlock more with a paid plan',
      'sidebar.analytics': 'Analytics',
      'sidebar.sectionPlan': 'Plan',
      'sidebar.sectionProduce': 'Produce',
      'sidebar.sectionOperate': 'Operate',
      'sidebar.sectionLearn': 'Learn',
      'sidebar.sectionAccount': 'Account',
      'sidebar.primaryNavigation': 'Primary navigation',
      'language.switchLabel': 'Arabic',
      'nav.logout': 'Log out',
    }[key] ?? key),
  }),
}))

vi.mock('@/lib/useBillingStatus', () => ({
  useBillingStatus: () => billingState.value,
}))

describe('Sidebar credit presentation', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    billingState.value = {
      creditsRemaining: 0,
      creditsMax: 10,
      isUnlimited: false,
      isPaid: false,
      isLow: false,
      isEmpty: true,
      loading: false,
      status: {
        plan: 'free',
        status: 'active',
        hasActiveSubscription: false,
        credits: { remaining: 0, max: 10 },
      },
    }
  })

  it('shows honest zero-credit copy for a non-paid zero-credit state', () => {
    render(<Sidebar collapsed={false} setCollapsed={() => {}} />)

    expect(screen.getByText('⚠ No credits left')).toBeTruthy()
    expect(screen.queryByText('PRO')).toBeNull()
  })

  it('keeps the empty-credit warning for a paid finite zero-credit state', () => {
    billingState.value = {
      creditsRemaining: 0,
      creditsMax: 150,
      isUnlimited: false,
      isPaid: true,
      isLow: false,
      isEmpty: true,
      loading: false,
      status: {
        plan: 'growth',
        status: 'active',
        hasActiveSubscription: true,
        credits: { remaining: 0, max: 150 },
      },
    }

    render(<Sidebar collapsed={false} setCollapsed={() => {}} />)

    expect(screen.getByText('⚠ No credits left')).toBeTruthy()
  })

  it('uses workflow navigation labels and keeps future modules out of primary navigation', () => {
    render(<Sidebar collapsed={false} setCollapsed={() => {}} />)

    expect(screen.getByText('Plan')).toBeTruthy()
    expect(screen.getByText('Produce')).toBeTruthy()
    expect(screen.getByText('Operate')).toBeTruthy()
    expect(screen.getByText('Learn')).toBeTruthy()
    expect(screen.getByText('Account')).toBeTruthy()

    expect(screen.getByText('Home')).toBeTruthy()
    expect(screen.getByText('Brand Brain')).toBeTruthy()
    expect(screen.getByText('Strategy')).toBeTruthy()
    expect(screen.getByText('Campaigns')).toBeTruthy()
    expect(screen.getByText('Content Hub')).toBeTruthy()
    expect(screen.getByText('Calendar')).toBeTruthy()
    expect(screen.getByText('Media Library')).toBeTruthy()
    expect(screen.getByText('Analytics')).toBeTruthy()
    expect(screen.getByText('Connections')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Connections Setup' })).toBeTruthy()
    expect(document.body.textContent).toContain('Connections Setup')
    expect(screen.getAllByText('Billing').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0)

    expect(screen.queryByText('Templates')).toBeNull()
    expect(screen.queryByText('Score History')).toBeNull()
    expect(screen.queryByText('NEX — Studio')).toBeNull()
    expect(screen.queryByText('VEX — Ads')).toBeNull()
    expect(screen.queryByText('Sentinel — Monitor')).toBeNull()
  })
})
