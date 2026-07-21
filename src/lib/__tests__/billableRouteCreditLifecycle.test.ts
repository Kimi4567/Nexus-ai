import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function findChargedRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return findChargedRoutes(path)
      if (!entry.isFile() || entry.name !== 'route.ts') return []
      return readFileSync(path, 'utf8').includes('checkAndDeductCredits') ? [path] : []
    })
    .sort()
}

const chargedRoutes = findChargedRoutes('src/app/api')

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
