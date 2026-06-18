import { describe, it, expect } from 'vitest'
import {
  applySelectedSuggestionsToDraft,
  isApplicableField,
  type AppliedSuggestion,
} from '@/lib/brand/applySuggestions'
import type { BrandProfile } from '@/hooks/useBrandBrain'

const sug = (over: Partial<AppliedSuggestion> & { field: string }): AppliedSuggestion => ({
  suggestedValue: '',
  basis: 'extracted',
  confidence: 'high',
  ...over,
})

describe('applySelectedSuggestionsToDraft', () => {
  it('fills an empty scalar field', () => {
    const form: BrandProfile = { description: '' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'description', suggestedValue: 'An AI marketing operator.' })])
    expect(out.description).toBe('An AI marketing operator.')
  })

  it('keeps a non-empty scalar by default (no overwrite)', () => {
    const form: BrandProfile = { description: 'Existing description.' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'description', suggestedValue: 'New suggestion.' })])
    expect(out.description).toBe('Existing description.')
  })

  it('replaces a non-empty scalar ONLY when explicitly in replaceFields', () => {
    const form: BrandProfile = { description: 'Existing description.' }
    const out = applySelectedSuggestionsToDraft(
      form,
      [sug({ field: 'description', suggestedValue: 'New suggestion.' })],
      new Set(['description']),
    )
    expect(out.description).toBe('New suggestion.')
  })

  it('merges + dedupes array fields and never removes existing items', () => {
    const form: BrandProfile = { toneKeywords: ['Professional', 'clear'] }
    const out = applySelectedSuggestionsToDraft(form, [
      sug({ field: 'toneKeywords', suggestedValue: 'clear, supportive, direct', items: ['clear', 'supportive', 'direct'], basis: 'observed' }),
    ])
    // existing kept, new appended, case-insensitive dedupe ("clear")
    expect(out.toneKeywords).toEqual(['Professional', 'clear', 'supportive', 'direct'])
  })

  it('uses raw items (not the comma-joined string) for arrays', () => {
    const form: BrandProfile = { winningHooks: [] }
    const out = applySelectedSuggestionsToDraft(form, [
      sug({ field: 'winningHooks', suggestedValue: 'Stop guessing, and win', items: ['Stop guessing, and win'], basis: 'observed' }),
    ])
    // comma inside the single hook is preserved because items[] is used
    expect(out.winningHooks).toEqual(['Stop guessing, and win'])
  })

  it('appends strategicNotes instead of replacing', () => {
    const form: BrandProfile = { strategicNotes: 'First note.' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'strategicNotes', suggestedValue: 'Second note.' })])
    expect(out.strategicNotes).toBe('First note.\n\nSecond note.')
  })

  it('does not duplicate an identical strategicNotes append', () => {
    const form: BrandProfile = { strategicNotes: 'Already contains the insight.' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'strategicNotes', suggestedValue: 'the insight' })])
    expect(out.strategicNotes).toBe('Already contains the insight.')
  })

  it('fills strategicNotes when empty', () => {
    const form: BrandProfile = { strategicNotes: '' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'strategicNotes', suggestedValue: 'A note.' })])
    expect(out.strategicNotes).toBe('A note.')
  })

  it('ignores manual-only / blocked fields even if injected', () => {
    const form: BrandProfile = { verifiedProof: [], businessGoal: '' }
    const out = applySelectedSuggestionsToDraft(form, [
      sug({ field: 'verifiedProof', suggestedValue: '5-star reviews', items: ['5-star reviews'] }),
      sug({ field: 'businessGoal', suggestedValue: 'grow revenue' }),
      sug({ field: 'marketingBudget', suggestedValue: '$5000' }),
    ])
    expect(out.verifiedProof).toEqual([])
    expect(out.businessGoal).toBe('')
    expect(isApplicableField('verifiedProof')).toBe(false)
    expect(isApplicableField('businessGoal')).toBe(false)
  })

  it('ignores unsupported / non-allowlisted fields', () => {
    const form: BrandProfile = { brandName: '' }
    const out = applySelectedSuggestionsToDraft(form, [
      sug({ field: 'totallyUnknownField', suggestedValue: 'x' }),
      sug({ field: 'logoUrl', suggestedValue: 'http://x/y.png' }),
    ])
    expect((out as Record<string, unknown>).totallyUnknownField).toBeUndefined()
    expect(out.logoUrl).toBeUndefined()
    expect(isApplicableField('logoUrl')).toBe(false)
  })

  it('leaves unselected fields untouched', () => {
    const form: BrandProfile = { description: 'keep me', targetAudience: 'keep me too', toneKeywords: ['a'] }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'description', suggestedValue: 'new', })], new Set(['description']))
    expect(out.targetAudience).toBe('keep me too')
    expect(out.toneKeywords).toEqual(['a'])
  })

  it('applies a low/inferred suggestion only because the caller selected it (no extra gate here)', () => {
    // The component decides default selection; once passed in, the helper applies it
    // under the SAME field rules (here: empty scalar fill).
    const form: BrandProfile = { pricePoint: '' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'pricePoint', suggestedValue: 'mid-range', basis: 'inferred', confidence: 'low' })])
    expect(out.pricePoint).toBe('mid-range')
  })

  it('does not overwrite a non-empty low/inferred scalar without Replace', () => {
    const form: BrandProfile = { pricePoint: 'luxury' }
    const out = applySelectedSuggestionsToDraft(form, [sug({ field: 'pricePoint', suggestedValue: 'mid-range', basis: 'inferred', confidence: 'low' })])
    expect(out.pricePoint).toBe('luxury')
  })

  it('returns a NEW object and never mutates the input', () => {
    const form: BrandProfile = { description: '', toneKeywords: ['a'] }
    const snapshot = JSON.stringify(form)
    const out = applySelectedSuggestionsToDraft(form, [
      sug({ field: 'description', suggestedValue: 'filled' }),
      sug({ field: 'toneKeywords', suggestedValue: 'b', items: ['b'], basis: 'observed' }),
    ])
    expect(out).not.toBe(form)
    expect(JSON.stringify(form)).toBe(snapshot) // input unchanged
    expect(out.description).toBe('filled')
    expect(out.toneKeywords).toEqual(['a', 'b'])
  })

  it('is a pure transform (no throw on empty selection, returns a copy)', () => {
    const form: BrandProfile = { description: 'x' }
    const out = applySelectedSuggestionsToDraft(form, [])
    expect(out).not.toBe(form)
    expect(out.description).toBe('x')
  })
})
