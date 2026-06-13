/**
 * Visual Ad Engine v1.1 — CTA helper tests.
 *
 * Pure-function coverage for the CTA layout/escaping/truncation/RTL helpers used
 * by the brand compositor. No Sharp/Satori/network is touched here — these assert
 * the contract the compositor relies on, including the "empty CTA → no layer" and
 * "no fake metrics / no provider change" scope guards for PR10.
 */
import { describe, it, expect } from 'vitest'
import {
  isArabicText,
  escapeSvgText,
  prepareCtaText,
  ctaTextColor,
  ctaPillGeometry,
} from '@/lib/visualCta'

describe('visualCta', () => {
  // 1. CTA accepted by the helper and returned as a clean label
  it('accepts a normal English CTA and returns it cleaned', () => {
    expect(prepareCtaText('Order Now')).toBe('Order Now')
  })

  // 2. Empty / whitespace / null CTA → '' so the compositor renders NO CTA layer
  it('returns empty string for empty/whitespace/null CTA (no layer rendered)', () => {
    expect(prepareCtaText('')).toBe('')
    expect(prepareCtaText('   ')).toBe('')
    expect(prepareCtaText(null)).toBe('')
    expect(prepareCtaText(undefined)).toBe('')
  })

  // 3. English CTA is escaped safely for SVG injection
  it('escapes SVG-significant characters in CTA text', () => {
    expect(escapeSvgText('Buy & Save <Now>')).toBe('Buy &amp; Save &lt;Now&gt;')
    expect(escapeSvgText(`"Go" 'now'`)).toBe('&quot;Go&quot; &apos;now&apos;')
  })

  // 4. Arabic CTA is detected → routed through the RTL (Satori) path
  it('detects Arabic CTA text so it routes through the Satori RTL path', () => {
    expect(isArabicText('اطلب الآن')).toBe(true)
    expect(isArabicText('Order Now')).toBe(false)
    expect(isArabicText('')).toBe(false)
    expect(isArabicText(null)).toBe(false)
  })

  // 5. Long CTA is truncated at a word boundary (no ellipsis — it's a button)
  it('truncates an over-long CTA at a word boundary without an ellipsis', () => {
    const out = prepareCtaText('Order Now And Save Big This Weekend Only', 24)
    expect(out.length).toBeLessThanOrEqual(24)
    expect(out).not.toContain('…')
    expect(out).not.toContain('...')
    expect(out.startsWith('Order Now')).toBe(true)
    // No partial trailing word
    expect(out.endsWith(' ')).toBe(false)
  })

  // 6. Pill uses a safe brand-color contrast fallback (light bg → dark text, etc.)
  it('chooses a high-contrast text color and falls back safely for bad hex', () => {
    expect(ctaTextColor('#FFFFFF')).toBe('#0B0B0B') // light bg → dark text
    expect(ctaTextColor('#000000')).toBe('#FFFFFF') // dark bg → white text
    expect(ctaTextColor('#6366f1')).toBe('#FFFFFF') // saturated brand purple → white
    // Invalid hex must not throw — falls back to NEXUS purple luminance → white
    expect(ctaTextColor('not-a-color')).toBe('#FFFFFF')
    expect(ctaTextColor('')).toBe('#FFFFFF')
  })

  // 7. No fake metrics: helper never injects numbers/percentages/claims
  it('never invents metrics, percentages, or claims in the CTA', () => {
    const out = prepareCtaText('Shop the collection')
    expect(out).toBe('Shop the collection')
    expect(out).not.toMatch(/\d+%/)
    expect(out).not.toMatch(/\b\d{2,}\b/)
  })

  // 8. Geometry stays within image bounds and below the headline / above brand row
  it('produces an in-bounds pill geometry in the lower band', () => {
    const w = 1080, h = 1080
    const g = ctaPillGeometry(w, h, 9)
    expect(g.pillX).toBeGreaterThanOrEqual(0)
    expect(g.pillX + g.pillW).toBeLessThanOrEqual(w)
    expect(g.pillW).toBeLessThanOrEqual(Math.round(w * 0.7)) // capped at 70%
    expect(g.centerX).toBe(Math.round(w / 2))
    // Pill centre sits in the lower band (~87.5%), clear of headline (~73-82%)
    const centerY = g.pillY + Math.round(g.pillH / 2)
    expect(centerY).toBeGreaterThan(Math.round(h * 0.82))
    expect(centerY).toBeLessThan(Math.round(h * 0.94))
    expect(g.textBaselineY).toBeGreaterThan(g.pillY)
    expect(g.textBaselineY).toBeLessThan(g.pillY + g.pillH)
  })

  // 9. Headline-only still works when CTA is missing (helper contract for compositor)
  it('keeps headline-only path intact: missing CTA yields no pill text', () => {
    // The compositor only builds a CTA layer when prepareCtaText(...) is truthy.
    expect(prepareCtaText(undefined)).toBeFalsy()
    expect(prepareCtaText('')).toBeFalsy()
    // A present headline-style CTA still produces a label when one IS given
    expect(prepareCtaText('Learn More')).toBeTruthy()
  })

  // 10. Pill width scales with text length but never collapses below the min width
  it('scales pill width with text length within min/max bounds', () => {
    const w = 1080, h = 1080
    const short = ctaPillGeometry(w, h, 3)
    const long = ctaPillGeometry(w, h, 22)
    expect(short.pillW).toBeGreaterThanOrEqual(Math.round(w * 0.18)) // min width
    expect(long.pillW).toBeGreaterThanOrEqual(short.pillW)
    expect(long.pillW).toBeLessThanOrEqual(Math.round(w * 0.7))      // max width
    // Arabic and Latin share the same geometry contract (routing differs, sizing doesn't)
    expect(short.radius).toBe(Math.round(short.pillH / 2))
  })
})
