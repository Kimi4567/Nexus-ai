import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/api/workspace/reset/route.ts', 'utf8')

describe('workspace reset transaction contract', () => {
  it('uses a bounded timeout long enough for sequential remote FK-safe deletes', () => {
    expect(source).toContain('const RESET_TRANSACTION_TIMEOUT_MS = 60_000')
    expect(source).toContain('maxWait: 10_000')
    expect(source).toContain('timeout: RESET_TRANSACTION_TIMEOUT_MS')
  })

  it('keeps the final Brand Brain reset inside the same transaction', () => {
    expect(source).toContain('await tx.brandProfile.findUnique')
    expect(source).toContain('await tx.brandProfile.update')
  })
})
