// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      'sidebar.brand': 'Brand',
      'sidebar.media': 'Media',
      'sidebar.connect': 'Connect',
      'sidebar.badgeSetup': 'Setup',
      'sidebar.settings': 'Settings',
      'sidebar.billing': 'Billing',
      'sidebar.expand': 'Expand',
      'sidebar.collapse': 'Collapse',
      'sidebar.upgradePro': 'Upgrade Pro',
      'sidebar.unlockAll': 'Unlock more with a paid plan',
      'language.switchLabel': 'Arabic',
      'nav.logout': 'Log out',
    }[key] ?? key),
  }),
}))

vi.mock('@/lib/useBillingStatus', () => ({
  useBillingStatus: () => billingState.value,
}))

describe('Sidebar credit presentation', () => {
  beforeEach(() => {
    billingState.value = {
      creditsRemaining: 0,
      creditsMax: 10,
      isUnlimited: false,
      isPaid: false,
      isLow: false,
      isEmpty: true,
      loading: false,
    }
  })

  it('shows calm trial copy for a non-paid zero-credit first-run state', () => {
    render(<Sidebar collapsed={false} setCollapsed={() => {}} />)

    expect(screen.getByText('Free trial credits ready')).toBeTruthy()
    expect(screen.queryByText(/No credits left/i)).toBeNull()
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
    }

    render(<Sidebar collapsed={false} setCollapsed={() => {}} />)

    expect(screen.getByText('⚠ No credits left')).toBeTruthy()
  })
})
