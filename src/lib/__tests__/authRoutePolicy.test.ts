import { describe, expect, it } from 'vitest'
import { isPublicOnlyAuthPage, isPublicPage } from '@/lib/authRoutePolicy'

describe('server auth route policy', () => {
  it.each([
    '/',
    '/auth/login',
    '/auth/reset-password',
    '/lead-form/public-id',
    '/lp/campaign',
    '/share/report',
    '/unsubscribe',
    '/meta-review-demo',
  ])('keeps the intended public journey available: %s', (pathname) => {
    expect(isPublicPage(pathname)).toBe(true)
  })

  it.each([
    '/dashboard',
    '/brand',
    '/strategy',
    '/approvals',
    '/operations',
    '/analytics',
    '/settings',
    '/internal/observability-smoke',
  ])('protects application workspaces: %s', (pathname) => {
    expect(isPublicPage(pathname)).toBe(false)
  })

  it('redirects signed-in users only from entry auth screens', () => {
    expect(isPublicOnlyAuthPage('/auth/login')).toBe(true)
    expect(isPublicOnlyAuthPage('/auth/register')).toBe(true)
    expect(isPublicOnlyAuthPage('/auth/forgot-password')).toBe(true)
    expect(isPublicOnlyAuthPage('/auth/reset-password')).toBe(false)
  })

  it('does not let similarly named paths bypass protection', () => {
    expect(isPublicPage('/privacy-export')).toBe(false)
    expect(isPublicPage('/authentic')).toBe(false)
  })
})
