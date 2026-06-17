import { describe, it, expect } from 'vitest'
import { commitTag, wouldCommit } from '../tagInput'

describe('commitTag — Brand Brain tag fields (Enter / comma / blur all route here)', () => {
  it('adds a trimmed value', () => {
    expect(commitTag([], '  No time to market  ')).toEqual(['No time to market'])
    expect(commitTag(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('ignores empty / whitespace-only input (never adds a blank chip)', () => {
    expect(commitTag(['a'], '')).toEqual(['a'])
    expect(commitTag(['a'], '   ')).toEqual(['a'])
    expect(commitTag([], '')).toEqual([])
  })

  it('de-duplicates exact matches', () => {
    expect(commitTag(['Leads'], 'Leads')).toEqual(['Leads'])
    expect(commitTag(['Leads'], '  Leads  ')).toEqual(['Leads'])
  })

  it('defensively filters non-string existing values and never throws', () => {
    expect(commitTag(['ok', 5 as unknown as string, null as unknown as string], 'new')).toEqual(['ok', 'new'])
    expect(commitTag(null as unknown as string[], 'x')).toEqual(['x'])
    expect(commitTag(undefined as unknown as string[], 'x')).toEqual(['x'])
  })

  it('preserves order and existing chips (blur commit must not reorder/lose data)', () => {
    expect(commitTag(['one', 'two'], 'three')).toEqual(['one', 'two', 'three'])
  })
})

describe('wouldCommit — used to avoid no-op state updates', () => {
  it('is true only when a new chip would be added', () => {
    expect(wouldCommit(['a'], 'b')).toBe(true)
    expect(wouldCommit(['a'], 'a')).toBe(false)
    expect(wouldCommit(['a'], '  ')).toBe(false)
    expect(wouldCommit([], 'first')).toBe(true)
  })
})
