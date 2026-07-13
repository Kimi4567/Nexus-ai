import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const layout = readFileSync('src/app/layout.tsx', 'utf8')
const telemetry = readFileSync('src/components/ConsentAwareTelemetry.tsx', 'utf8')
const banner = readFileSync('src/components/ui/CookieBanner.tsx', 'utf8')
const register = readFileSync('src/app/auth/register/page.tsx', 'utf8')

describe('optional analytics consent contract', () => {
  it('loads telemetry through the consent-aware boundary', () => {
    expect(layout).toContain('<ConsentAwareTelemetry />')
    expect(layout).not.toContain('<Analytics />')
    expect(telemetry).toContain("analytics === true")
    expect(telemetry).toContain('if (!enabled) return null')
  })

  it('updates the telemetry boundary whenever consent changes', () => {
    expect(banner).toContain('COOKIE_CONSENT_EVENT')
    expect(banner).toContain('analytics: false')
    expect(banner).toContain('analytics: true')
  })

  it('keeps the consent card compact on desktop so it does not block primary forms', () => {
    expect(banner).toContain('md:w-[min(480px,calc(50vw-3rem))]')
    expect(banner).not.toContain('max-w-4xl')
    expect(banner).toContain('aria-label="إغلاق إشعار ملفات تعريف الارتباط"')
  })

  it('does not require optional cookie consent to create an account', () => {
    expect(register).not.toContain('agreeCookies')
    expect(register).not.toContain('cookies: true')
  })
})
