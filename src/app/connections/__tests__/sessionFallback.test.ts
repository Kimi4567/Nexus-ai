import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/connections/page.tsx', 'utf8')

describe('/connections session fallback', () => {
  it('does not leave an unauthenticated user behind an infinite loading state', () => {
    expect(source).toContain("if (loading) {")
    expect(source).toContain("if (!isAuthenticated) {")
    expect(source).toContain("router.replace('/auth/login')")
    expect(source).toContain('Sign in required')
    expect(source).toContain('تسجيل الدخول مطلوب')
    expect(source).toContain('href="/auth/login"')
  })
})
