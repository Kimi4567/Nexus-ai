import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/app/onboarding/page.tsx'), 'utf8')

describe('limited onboarding dashboard continuity', () => {
  it('creates the minimum workspace shell before entering the gated dashboard', () => {
    expect(SRC).toContain('const handleOpenLimitedDashboard = async () =>')
    expect(SRC).toContain("await ensureWorkspace({")
    expect(SRC).toContain("method: 'POST'")
    expect(SRC).toContain("router.push('/dashboard')")
    expect(SRC).not.toContain("<QuietButton onClick={() => router.push('/dashboard')}")
  })

  it('keeps failure visible instead of silently looping back to onboarding', () => {
    expect(SRC).toContain('role="alert"')
    expect(SRC).toContain('تعذّر تجهيز مساحة العمل المحدودة')
    expect(SRC).toContain('Could not prepare the limited workspace')
  })
})
