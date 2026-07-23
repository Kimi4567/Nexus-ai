import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/connections/page.tsx', 'utf8')

describe('connections OAuth return state', () => {
  it('clears stale loading state and refreshes connection truth after cancel/back', () => {
    expect(source).toContain("window.addEventListener('pageshow', handleOAuthReturn)")
    expect(source).toContain("window.addEventListener('focus', handleOAuthReturn)")
    expect(source).toContain("document.addEventListener('visibilitychange', handleVisibility)")
    expect(source).toContain('setConnecting(null)')
    expect(source).toContain('void fetchAccounts()')
  })
})
