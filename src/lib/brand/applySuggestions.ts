/**
 * PR-M3.3D — Apply selected Assisted-draft suggestions to the local Brand Brain form.
 *
 * Pure, framework-free transform: takes the current form draft + the user's
 * explicitly-selected suggestions + the set of non-empty scalar fields the user
 * chose to Replace, and returns a NEW BrandProfile draft. It NEVER:
 *  - mutates the input object,
 *  - calls any API / save endpoint,
 *  - invents values or evidence,
 *  - touches manual-only / blocked fields or fields outside the allowlist,
 *  - overwrites a non-empty scalar unless that field was explicitly marked Replace,
 *  - removes existing array items (arrays only ever merge + dedupe).
 *
 * Persistence remains a separate, explicit "Save All" action in the page. This
 * helper only produces the next local draft.
 */

import type { BrandProfile } from '@/hooks/useBrandBrain'
import { CLIENT_RENDERABLE_FIELDS, CLIENT_NEVER_SHOW_FIELDS } from '@/lib/brand/assistFieldLabels'

/** Minimal shape needed to apply a suggestion (subset of the review shell type). */
export interface AppliedSuggestion {
  field: string
  /** Display/scalar value (also the source for splitting if `items` is absent). */
  suggestedValue: string
  /** Raw array items for array-valued fields (preferred over re-splitting). */
  items?: string[]
  basis: 'extracted' | 'observed' | 'inferred' | 'missing'
  confidence: 'high' | 'medium' | 'low'
}

// Scalar fields that fill-if-empty / keep-by-default / replace-if-explicit.
export const SCALAR_FIELDS = new Set<string>([
  'brandName',
  'industry',
  'description',
  'primaryOffer',
  'targetAudience',
  'writingStyle',
  'pricePoint',
])

// Scalar field that APPENDS (never replaces, never loses existing text).
export const APPEND_FIELDS = new Set<string>(['strategicNotes'])

// Array fields that merge + dedupe (never remove existing items).
export const ARRAY_FIELDS = new Set<string>([
  'uniqueAdvantages',
  'toneKeywords',
  'audiencePainPoints',
  'audienceDesires',
  'competitors',
  'winningHooks',
  'winningAngles',
])

/** A field may be applied only if allow-listed, not blocked, and known to a rule. */
export function isApplicableField(field: string): boolean {
  if (CLIENT_NEVER_SHOW_FIELDS.has(field)) return false
  if (!CLIENT_RENDERABLE_FIELDS.has(field)) return false
  return SCALAR_FIELDS.has(field) || APPEND_FIELDS.has(field) || ARRAY_FIELDS.has(field)
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** Items for an array suggestion: prefer raw `items`, else split the joined value. */
function suggestionItems(s: AppliedSuggestion): string[] {
  const raw = Array.isArray(s.items) && s.items.length > 0
    ? s.items
    : asString(s.suggestedValue).split(',')
  return raw.map((x) => x.trim()).filter((x) => x.length > 0)
}

/** Case-insensitive, trimmed union that preserves existing order and never removes. */
function mergeDedupe(existing: string[], incoming: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of [...existing, ...incoming]) {
    const t = v.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/**
 * Apply the selected suggestions to a copy of `form`.
 * @param form          current local draft (not mutated)
 * @param selected      suggestions the user explicitly selected
 * @param replaceFields non-empty scalar fields the user explicitly chose to Replace
 */
export function applySelectedSuggestionsToDraft(
  form: BrandProfile,
  selected: AppliedSuggestion[],
  replaceFields: Set<string> = new Set(),
): BrandProfile {
  const next: BrandProfile = { ...form }

  for (const s of selected) {
    const field = s.field
    if (!isApplicableField(field)) continue // blocked / manual-only / unsupported

    // ── Array fields: merge + dedupe, never remove ──
    if (ARRAY_FIELDS.has(field)) {
      const incoming = suggestionItems(s)
      if (incoming.length === 0) continue
      const existing = asArray((next as Record<string, unknown>)[field])
      ;(next as Record<string, unknown>)[field] = mergeDedupe(existing, incoming)
      continue
    }

    // ── strategicNotes: append (skip if the note is already present) ──
    if (APPEND_FIELDS.has(field)) {
      const addition = asString(s.suggestedValue).trim()
      if (!addition) continue
      const existing = asString((next as Record<string, unknown>)[field]).trim()
      if (!existing) {
        ;(next as Record<string, unknown>)[field] = addition
      } else if (!existing.toLowerCase().includes(addition.toLowerCase())) {
        ;(next as Record<string, unknown>)[field] = `${existing}\n\n${addition}`
      }
      // else: identical note already present → no duplicate append
      continue
    }

    // ── Scalar fields: fill empty; keep non-empty unless explicit Replace ──
    if (SCALAR_FIELDS.has(field)) {
      const incoming = asString(s.suggestedValue).trim()
      if (!incoming) continue
      const existing = asString((next as Record<string, unknown>)[field]).trim()
      if (!existing) {
        ;(next as Record<string, unknown>)[field] = incoming // fill empty
      } else if (replaceFields.has(field)) {
        ;(next as Record<string, unknown>)[field] = incoming // explicit replace
      }
      // else: keep existing (no overwrite by default)
      continue
    }
  }

  return next
}
