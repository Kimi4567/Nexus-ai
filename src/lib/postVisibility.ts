/**
 * Post visibility helpers (Publishing & Campaign Calendar Sprint — PR 5).
 *
 * Pure, dependency-free helpers that turn a batch of posts into honest, derived
 * execution-state counts — so the UI can show "where did my post go?" answers
 * (what's planned / approved / scheduled / published) without ever inventing a
 * fake metric or a fake "published" state. All state derivation goes through PR1's
 * `deriveDisplayState`, the single source of truth for honest display.
 */

import { deriveDisplayState, type DisplayState, type PostStateInput } from './postStatus'

export interface VisibilityCounts {
  draft: number
  approved: number
  scheduledManual: number
  scheduledAuto: number
  publishedManual: number
  publishedAuto: number
  failed: number
  /** all genuinely-published posts (manual + auto) */
  published: number
  total: number
}

const EMPTY: VisibilityCounts = {
  draft: 0, approved: 0, scheduledManual: 0, scheduledAuto: 0,
  publishedManual: 0, publishedAuto: 0, failed: 0, published: 0, total: 0,
}

const DISPLAY_TO_KEY: Record<DisplayState, keyof Omit<VisibilityCounts, 'published' | 'total'>> = {
  draft:            'draft',
  approved:         'approved',
  scheduled_manual: 'scheduledManual',
  scheduled_auto:   'scheduledAuto',
  published_manual: 'publishedManual',
  published_auto:   'publishedAuto',
  failed:           'failed',
}

/** True only when a post has genuinely been published (by hand or by a confirmed API publish). */
export function isCompletedState(state: DisplayState): boolean {
  return state === 'published_manual' || state === 'published_auto'
}

/** Tally a batch of posts by honest derived display state. Never invents a state. */
export function summarizeByDisplayState(posts: PostStateInput[]): VisibilityCounts {
  const counts: VisibilityCounts = { ...EMPTY }
  for (const post of posts) {
    const state = deriveDisplayState(post)
    counts[DISPLAY_TO_KEY[state]]++
    if (isCompletedState(state)) counts.published++
    counts.total++
  }
  return counts
}

/**
 * Return a post URL only when it is present AND a valid http(s) link — so the UI never
 * renders a broken or fake "view post" link.
 */
export function publicPostUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null
}
