/**
 * PR-H1 — Brand Brain Tag Input commit logic (pure, shared).
 *
 * Every Brand Brain chip/tag field (Pain Points, Desires, Unique Advantages,
 * Platforms, Tone keywords, Avoid keywords, …) commits typed text through this
 * one function — on Enter, on comma, and on blur — so user input is never
 * silently discarded when they click Save All, press Next, or tap elsewhere.
 *
 * Pure + framework-free for deterministic unit testing.
 */

/**
 * Returns the next tag array after attempting to commit `raw`.
 * - Trims surrounding whitespace.
 * - Ignores empty input (returns the existing list unchanged).
 * - De-duplicates (case-sensitive exact match) — no duplicate chips.
 * - Filters any non-string values defensively.
 */
export function commitTag(values: unknown, raw: string): string[] {
  const safe = Array.isArray(values)
    ? values.filter((v): v is string => typeof v === 'string')
    : []
  const v = (raw ?? '').trim()
  if (!v || safe.includes(v)) return safe
  return [...safe, v]
}

/** True when committing `raw` would actually add a new chip (used to avoid no-op state updates). */
export function wouldCommit(values: unknown, raw: string): boolean {
  return commitTag(values, raw).length !== (Array.isArray(values) ? values.filter(v => typeof v === 'string').length : 0)
}
