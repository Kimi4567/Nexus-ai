import { describe, it, expect } from 'vitest'
import {
  classifyUserForBackfill,
  buildMigratedGrant,
  MIGRATION_SOURCE,
} from '@/lib/credits/backfillClassify'

describe('classifyUserForBackfill', () => {
  it('1. positive balance + not migrated → CREATE', () => {
    expect(classifyUserForBackfill(132, false)).toBe('CREATE')
    expect(classifyUserForBackfill(1, false)).toBe('CREATE')
  })

  it('2. zero balance → SKIP_ZERO', () => {
    expect(classifyUserForBackfill(0, false)).toBe('SKIP_ZERO')
  })

  it('3. negative / unlimited (-1) → SKIP_UNLIMITED', () => {
    expect(classifyUserForBackfill(-1, false)).toBe('SKIP_UNLIMITED')
    expect(classifyUserForBackfill(-50, false)).toBe('SKIP_UNLIMITED')
  })

  it('4. already migrated → SKIP_MIGRATED (idempotency wins over balance)', () => {
    expect(classifyUserForBackfill(132, true)).toBe('SKIP_MIGRATED')
    expect(classifyUserForBackfill(0, true)).toBe('SKIP_MIGRATED')
    expect(classifyUserForBackfill(-1, true)).toBe('SKIP_MIGRATED')
  })
})

describe('buildMigratedGrant', () => {
  it('5. positive balance → MIGRATED grant with correct amount/remaining/source, non-expiring, ACTIVE', () => {
    const g = buildMigratedGrant(132)
    expect(g).toEqual({
      type: 'MIGRATED',
      amount: 132,
      remaining: 132,
      expiresAt: null,
      status: 'ACTIVE',
      source: MIGRATION_SOURCE,
    })
  })

  it('source constant is the agreed value', () => {
    expect(MIGRATION_SOURCE).toBe('migration:initial-aiCredits')
  })
})
