import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (entry === '__tests__') return []
    return statSync(path).isDirectory()
      ? routeFiles(path)
      : entry === 'route.ts' ? [path] : []
  })
}

describe('AI credit charge traceability', () => {
  it('links every API credit reservation to explicit execution context', () => {
    const chargedRoutes = routeFiles('src/app/api')
      .map(path => ({ path, source: readFileSync(path, 'utf8') }))
      .filter(({ source }) => /await\s+checkAndDeductCredits\s*\(/.test(source))

    expect(chargedRoutes.length).toBeGreaterThan(10)
    for (const { path, source } of chargedRoutes) {
      const calls = source.match(/await\s+checkAndDeductCredits\s*\(/g)?.length ?? 0
      const entityIds = source.match(/entityId\s*:/g)?.length ?? 0
      const entityTypes = source.match(/entityType\s*:/g)?.length ?? 0
      expect(entityIds, `${path} has an unlinked credit charge`).toBeGreaterThanOrEqual(calls)
      expect(entityTypes, `${path} has an untyped credit charge`).toBeGreaterThanOrEqual(calls)
    }
  })
})
