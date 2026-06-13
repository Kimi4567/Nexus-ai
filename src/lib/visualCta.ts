/**
 * NEXUS — CTA layout helpers for the brand compositor (Visual Ad Engine v1.1).
 *
 * Pure, dependency-free helpers for rendering a call-to-action pill onto a
 * generated creative. The CTA text itself comes from the already-extracted
 * `concept.cta` (conceptExtractor) — this module only cleans, sizes, escapes and
 * places it. It NEVER invents copy, metrics, or claims; an empty CTA yields an
 * empty string so the compositor renders exactly as before.
 *
 * Arabic CTAs are routed through the existing Satori/Noto-Naskh path (correct RTL
 * shaping); Latin CTAs use an SVG pill. The geometry/escaping/truncation below is
 * shared by both and unit-tested without Sharp/Satori.
 */

/** True when the text is primarily Arabic (RTL) — drives Satori vs SVG routing. */
export function isArabicText(text: string | null | undefined): boolean {
  return /[؀-ۿ]/.test(text || '')
}

/** Escape a string for safe inclusion in SVG <text> content. */
export function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Clean a raw CTA into a short, safe button label.
 * - strips hashtags/mentions/emoji, collapses whitespace
 * - hard-caps length at `maxChars`, breaking at a word boundary (no ellipsis — it's a button)
 * - returns '' for empty/whitespace input (caller then renders NO CTA layer)
 */
export function prepareCtaText(raw: string | null | undefined, maxChars = 24): string {
  if (!raw) return ''
  const cleaned = raw
    .replace(/[#@]\S+/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  if (cleaned.length <= maxChars) return cleaned
  const cut = cleaned.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > Math.floor(maxChars * 0.5) ? cut.slice(0, lastSpace) : cut).trim()
}

/** Parse "#rrggbb" → [r,g,b]; falls back to NEXUS purple for anything invalid. */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim())
  if (!m) return [99, 102, 241]
  const h = m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Pick a high-contrast text color for a CTA pill given its background.
 * Light brand colors → near-black text; dark/saturated → white. (WCAG-style luminance.)
 */
export function ctaTextColor(bgHex: string): '#FFFFFF' | '#0B0B0B' {
  const [r, g, b] = hexToRgb(bgHex)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.62 ? '#0B0B0B' : '#FFFFFF'
}

export interface CtaGeometry {
  fontSize: number
  pillW: number
  pillH: number
  pillX: number
  pillY: number
  /** rounded-corner radius (full pill) */
  radius: number
  /** horizontal centre (text anchor) */
  centerX: number
  /** baseline y for the SVG <text> */
  textBaselineY: number
}

/**
 * Compute a centred CTA-pill geometry that sits in the lower band of the image —
 * below the headline zone and clear of the bottom brand-name / logo / accent bar.
 * `textLen` is used to size the pill width (capped at 70% of image width).
 */
export function ctaPillGeometry(w: number, h: number, textLen: number): CtaGeometry {
  const fontSize = w >= 1080 ? 38 : w >= 800 ? 32 : 26
  const padX = Math.round(fontSize * 1.0)
  const padY = Math.round(fontSize * 0.5)
  const estTextW = Math.round(Math.max(textLen, 1) * fontSize * 0.62)
  const maxPillW = Math.round(w * 0.7)
  const minPillW = Math.round(w * 0.18)
  const pillW = Math.min(Math.max(estTextW + padX * 2, minPillW), maxPillW)
  const pillH = fontSize + padY * 2
  const centerX = Math.round(w / 2)
  const pillX = centerX - Math.round(pillW / 2)
  // Vertical centre at ~87.5% of height: below headline (~73–82%), above brand row (~94–98%)
  const centerY = Math.round(h * 0.875)
  const pillY = centerY - Math.round(pillH / 2)
  const radius = Math.round(pillH / 2)
  const textBaselineY = pillY + padY + Math.round(fontSize * 0.78)
  return { fontSize, pillW, pillH, pillX, pillY, radius, centerX, textBaselineY }
}
