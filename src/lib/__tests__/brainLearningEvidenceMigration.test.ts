import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migration = readFileSync('supabase/migrations/20260715090005_add_brain_learning_evidence.sql', 'utf8')

describe('BrainLearning structured evidence migration', () => {
  it('adds the same nullable JSON evidence contract to Prisma and PostgreSQL', () => {
    expect(schema).toContain('evidence Json? // structured source, period, sample, confidence, impact, and rollback contract')
    expect(migration).toContain('ALTER TABLE "BrainLearning"')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "evidence" JSONB')
  })
})
