/**
 * Trust Sprint #6 — Content Hub localization integrity.
 *
 * The Content Hub chrome was hardcoded English; in Arabic campaigns the buttons,
 * statuses and empty/loading states stayed in English. These tests pin that the
 * contentHub i18n dictionary is complete in BOTH locales (so t() never falls back
 * to a raw key), that Arabic strings are actually Arabic, and that the new
 * "preview only" trust label exists and is clear in both languages.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { translations } from '@/lib/i18n-context'

const REQUIRED_KEYS = [
  'title', 'posts', 'imagesReady', 'videoSlots', 'generatePrompt',
  'approveAll', 'generateImages', 'regeneratePlan', 'buildPlan',
  'allPlatforms', 'statusLabel', 'filterAll', 'filterPending', 'filterReady', 'filterScheduled',
  'emptyTitle', 'emptyDesc', 'buildingTitle', 'buildingDesc',
  'statusPending', 'statusReady', 'statusUploadVideo', 'statusFailed',
  'edit', 'rewrite', 'img', 'vid', 'cancel', 'save',
  'previewOnly', 'imgWillGenerate', 'imgUploadVideo', 'captionPlaceholder',
  'approveConfirmTitle', 'approveConfirmYes',
]

const hasArabic = (s: string) => /[؀-ۿ]/.test(s)
const hasLatin = (s: string) => /[A-Za-z]/.test(s)
const PLACEHOLDER = /Post \d+ for|Facebook \/ Instagram/i

describe('Content Hub i18n dictionary', () => {
  it('3 & 4. every required key is a non-empty string in BOTH ar and en', () => {
    for (const k of REQUIRED_KEYS) {
      expect(typeof translations.ar.contentHub?.[k], `ar.contentHub.${k}`).toBe('string')
      expect((translations.ar.contentHub[k] as string).length).toBeGreaterThan(0)
      expect(typeof translations.en.contentHub?.[k], `en.contentHub.${k}`).toBe('string')
      expect((translations.en.contentHub[k] as string).length).toBeGreaterThan(0)
    }
  })

  it('5. ar and en contentHub have identical key sets (no missing key → no raw-key fallback)', () => {
    expect(Object.keys(translations.ar.contentHub).sort())
      .toEqual(Object.keys(translations.en.contentHub).sort())
  })

  it('3. Arabic labels are actually Arabic, not leftover English', () => {
    for (const k of ['title', 'approveAll', 'generateImages', 'regeneratePlan',
      'statusPending', 'statusReady', 'edit', 'rewrite', 'emptyTitle', 'buildPlan']) {
      expect(hasArabic(translations.ar.contentHub[k]), `ar.contentHub.${k} should be Arabic`).toBe(true)
    }
  })

  it('4. English labels render as readable English', () => {
    expect(translations.en.contentHub.title).toBe('Content Hub')
    expect(translations.en.contentHub.statusReady).toBe('Ready')
    expect(hasLatin(translations.en.contentHub.approveAll)).toBe(true)
  })

  it('2. preview-only trust label is present and clear in BOTH languages', () => {
    expect(translations.en.contentHub.previewOnly).toMatch(/preview/i)
    expect(translations.en.contentHub.previewOnly).toMatch(/not real|performance/i)
    expect(hasArabic(translations.ar.contentHub.previewOnly)).toBe(true)
    expect(translations.ar.contentHub.previewOnly).toMatch(/معاينة/)
  })

  it('7. caption placeholder is not the old English "Post N for" fake placeholder', () => {
    expect(translations.en.contentHub.captionPlaceholder).not.toMatch(PLACEHOLDER)
    expect(translations.ar.contentHub.captionPlaceholder).not.toMatch(PLACEHOLDER)
  })

  it('8. A/B draft selection copy is preference language, not winner/performance learning language', () => {
    expect(translations.en.contentHub.winner).toBe('Selected variant')
    expect(translations.en.contentHub.pickWinner).toBe('Select variant')
    expect(translations.en.contentHub.win).toBe('Select')
    expect(translations.ar.contentHub.winner).toBe('النسخة المختارة')
    expect(translations.ar.contentHub.pickWinner).toBe('اختر النسخة المفضلة')
    expect(translations.ar.contentHub.win).toBe('اختر')

    const pageSource = readFileSync(
      new URL('../../app/campaigns/[id]/content-hub/page.tsx', import.meta.url),
      'utf8',
    )
    expect(pageSource).not.toMatch(/Winner selected|Hook added to Brand Brain|Pick Winner/)
    expect(pageSource).not.toMatch(/🏆\s*\{t\('contentHub\.(winner|win)'\)\}/)
  })
})
