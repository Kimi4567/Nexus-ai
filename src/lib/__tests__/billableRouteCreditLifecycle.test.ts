import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const chargedRoutes = execFileSync(
  'rg',
  ['-l', 'checkAndDeductCredits', 'src/app/api', '-g', 'route.ts'],
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)

describe('billable route credit lifecycle contract', () => {
  it('covers every charged route with request-scoped idempotency and finalization', () => {
    expect(chargedRoutes.length).toBeGreaterThanOrEqual(24)

    for (const route of chargedRoutes) {
      const source = readFileSync(route, 'utf8')
      expect(source, `${route} must derive a scoped operation key`).toContain('getCreditOperationKey')
      expect(source, `${route} must settle or return every reservation`).toContain('finalizeCreditDeduction')
    }
  })

  it('does not use a hard-coded 402 response for replay-safe credit checks', () => {
    for (const route of chargedRoutes) {
      const source = readFileSync(route, 'utf8')
      expect(
        source,
        `${route} must distinguish insufficient balance (402) from an idempotent replay (409)`,
      ).toSatisfy((value: string) =>
        value.includes('creditCheckHttpStatus') || value.includes("error === 'CREDIT_OPERATION_REPLAY'"),
      )
    }
  })
})
