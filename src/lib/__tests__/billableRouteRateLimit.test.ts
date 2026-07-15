import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? routeFiles(path) : entry.name === 'route.ts' ? [path] : []
  })
}

describe('billable route abuse protection', () => {
  it('puts every user-triggered credit charge behind a rate limit', () => {
    const unprotected = routeFiles('src/app/api')
      .filter(path => !path.includes('/cron/'))
      .filter(path => {
        const source = readFileSync(path, 'utf8')
        if (!source.includes('checkAndDeductCredits(')) return false
        return !/(?:enforceBillableAiRateLimit|aiRateLimit(?:Db)?|chatRateLimitDb|suggestRateLimitDb|checkRateLimit\()/.test(source)
      })

    expect(unprotected).toEqual([])
  })

  it('runs the shared distributed guard before the first credit reservation', () => {
    const misordered = routeFiles('src/app/api')
      .filter(path => {
        const source = readFileSync(path, 'utf8')
        const guard = source.indexOf('await enforceBillableAiRateLimit(')
        const charge = source.indexOf('await checkAndDeductCredits(')
        return guard >= 0 && charge >= 0 && guard > charge
      })

    expect(misordered).toEqual([])
  })
})
