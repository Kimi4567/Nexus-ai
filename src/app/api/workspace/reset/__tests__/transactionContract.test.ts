import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/api/workspace/reset/route.ts', 'utf8')

describe('workspace reset transaction contract', () => {
  it('uses a serializable batch transaction instead of a long interactive callback', () => {
    expect(source).toContain('isolationLevel: Prisma.TransactionIsolationLevel.Serializable')
    expect(source).toContain('...deleteOperations')
    expect(source).not.toContain('pg_advisory_xact_lock')
  })

  it('keeps reset verification and Brand Brain reset in the same batch', () => {
    expect(source).toContain('brandResetOperation')
    expect(source).toContain('...verificationOperations')
    expect(source).toContain('brandVerificationOperation')
    expect(source).toContain('resetVerified')
  })
})
