/**
 * NEXUS — Professional Brand Post Compositor
 *
 * Transforms AI-generated images into premium social ad posts using
 * server-side Sharp + SVG compositing.
 *
 * Output design (Apple/Nike premium ad standard):
 * ┌─────────────────────────────────────────────┐
 * │                                              │
 * │         AI-generated scene (full bleed)     │
 * │                                              │
 * │                                              │
 * │  ·  ·  ·  ·  gradient fade bottom  ·  ·  · │
 * │ BRAND NAME              ←        → [LOGO]   │
 * ├══════════ thin brand accent bar ═════════════┤
 * └─────────────────────────────────────────────┘
 *
 * Requirements: npm install sharp
 * Vercel compatible: yes (sharp is officially supported)
 */

import sharp from 'sharp'

// ─── Platform dimension map ───────────────────────────────────────────────────

const PLATFORM_DIMENSIONS: Record<string, { w: number; h: number }> = {
  instagram: { w: 1080, h: 1080 },
  square:    { w: 1080, h: 1080 },
  facebook:  { w: 1200, h: 630  },
  linkedin:  { w: 1200, h: 628  },
  tiktok:    { w: 1080, h: 1350 },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandCompositeOptions {
  brandName: string
  logoUrl?: string | null          // Cloudinary URL of the brand logo
  accentColor?: string | null      // Brand primary color e.g. '#6366f1'
  platform?: string                // instagram | square | facebook | linkedin | tiktok
  adHeadline?: string | null       // Arabic (or any) ad copy headline — composited via SVG
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escape special chars for SVG text content */
function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .slice(0, 60) // hard cap — prevents overflow
}

/** Parse a hex color to RGB tuple */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length !== 6) return [99, 102, 241] // default NEXUS purple
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Extract first usable hex color from a palette string like "deep blue, #4f46e5, gold" */
function extractFirstColor(palette?: string | null): string | null {
  if (!palette) return null
  const match = palette.match(/#[0-9a-fA-F]{6}/)
  return match ? match[0] : null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the headline from a social media caption.
 * Takes the first sentence/line, strips hashtags + mentions, caps at maxChars.
 * Handles Arabic, English, and mixed captions.
 */
function extractAdHeadline(caption: string, maxChars = 42): string {
  if (!caption?.trim()) return ''
  const firstLine = caption
    .split(/\n|!|؟|\?/)[0]           // first sentence or line
    .replace(/[#@]\S+/g, '')          // strip hashtags + mentions
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '') // strip emojis
    .replace(/\s+/g, ' ')
    .trim()
  if (!firstLine) return ''
  if (firstLine.length <= maxChars) return firstLine
  // Break at word boundary nearest to maxChars
  const truncated = firstLine.slice(0, maxChars)
  const lastSpace  = truncated.lastIndexOf(' ')
  return lastSpace > Math.floor(maxChars * 0.5)
    ? truncated.slice(0, lastSpace).trim()
    : truncated.trim()
}

// ─── SVG layer builders ───────────────────────────────────────────────────────

/**
 * Dark gradient strip — fades from transparent at top → near-black at bottom.
 * Covers the bottom 38% of the image for deep vignette.
 */
function buildGradientSvg(w: number, h: number): Buffer {
  const startY = Math.round(h * 0.62)
  const gradH  = h - startY
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
      <stop offset="55%"  stop-color="#000000" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.93"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${startY}" width="${w}" height="${gradH}" fill="url(#g)"/>
</svg>`)
}

/**
 * Arabic ad headline — centered, bold, rendered via RTL SVG text.
 * Positioned in the gradient zone (mid-lower area) so it sits clearly
 * above the brand name bar. Renders beautifully in Arabic or any script.
 *
 * For long text: splits into 2 lines at the midpoint nearest a word boundary.
 */
function buildAdHeadlineSvg(w: number, h: number, text: string): Buffer {
  const MAX_PER_LINE = 22  // Arabic chars (wider than Latin)
  const fontSize    = w >= 1080 ? 62 : w >= 800 ? 50 : 40
  const lineHeight  = Math.round(fontSize * 1.35)
  const centerX     = Math.round(w / 2)

  // Split into up to 2 lines if needed
  let lines: string[]
  if (text.length <= MAX_PER_LINE) {
    lines = [text]
  } else {
    // Find split point nearest to middle at a space boundary
    const mid = Math.floor(text.length / 2)
    let splitAt = text.lastIndexOf(' ', mid)
    if (splitAt < 4) splitAt = text.indexOf(' ', mid)
    if (splitAt < 0) splitAt = mid
    lines = [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()]
  }

  // Vertical position: center block at ~73% of image height (within gradient zone)
  const totalH  = lines.length * lineHeight
  const blockY  = Math.round(h * 0.73) - Math.round(totalH / 2)

  // Semi-transparent background pill for max legibility
  const bgPad  = 18
  const bgX    = Math.round(w * 0.04)
  const bgW    = w - 2 * bgX
  const bgY    = blockY - bgPad
  const bgH    = totalH + bgPad * 2

  const textEls = lines.map((line, i) => {
    const y = blockY + fontSize + i * lineHeight
    return `  <text
    x="${centerX}"
    y="${y}"
    text-anchor="middle"
    direction="rtl"
    unicode-bidi="embed"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="bold"
    font-size="${fontSize}px"
    fill="white"
    filter="url(#headlineShadow)"
  >${escXml(line)}</text>`
  }).join('\n')

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="headlineShadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="12" flood-color="rgba(0,0,0,0.92)"/>
    </filter>
  </defs>
  <rect x="${bgX}" y="${bgY}" width="${bgW}" height="${bgH}" rx="12" fill="rgba(0,0,0,0.30)"/>
${textEls}
</svg>`)
}

/**
 * Brand name text — white bold, bottom-left, with feDropShadow for legibility
 * on any background color.
 */
function buildBrandTextSvg(w: number, h: number, brandName: string): Buffer {
  // Font size scales with image width
  const fontSize = w >= 1080 ? 54 : w >= 800 ? 44 : 36
  const paddingX = Math.round(w * 0.033)   // ~36px at 1080
  const paddingY = Math.round(h * 0.038)   // ~41px at 1080 (from bottom)

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="rgba(0,0,0,0.95)"/>
    </filter>
  </defs>
  <text
    x="${paddingX}"
    y="${h - paddingY}"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="bold"
    font-size="${fontSize}px"
    fill="white"
    filter="url(#shadow)"
    letter-spacing="0.5"
  >${escXml(brandName)}</text>
</svg>`)
}

/**
 * Thin accent bar — brand color, 6px, pinned to the very bottom.
 * Matches the look of Apple, Nike, premium tech brand social ads.
 */
function buildAccentBarSvg(w: number, h: number, color: string): Buffer {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="${h - 6}" width="${w}" height="6" fill="${color}"/>
</svg>`)
}

// ─── Logo fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetch + resize logo to fit neatly in the bottom-right corner.
 * Returns null if logo is unavailable or fails to load.
 */
async function fetchAndResizeLogo(logoUrl: string, targetSize: number): Promise<Buffer | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(logoUrl, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    const buf = Buffer.from(arrayBuf)

    // Resize to square, contain within targetSize × targetSize, transparent background
    return await sharp(buf)
      .resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

// ─── Main compositor ──────────────────────────────────────────────────────────

/**
 * Composite a professional branded ad post from a Cloudinary-hosted AI image.
 *
 * Steps:
 *   1. Fetch the raw AI image
 *   2. Resize + crop to platform dimensions
 *   3. Composite gradient strip, brand name, logo, accent bar as SVG layers
 *   4. Return as JPEG buffer (95 quality, progressive)
 *
 * The caller is responsible for re-uploading the buffer to Cloudinary.
 */
export async function composeBrandedPost(
  imageUrl: string,
  opts: BrandCompositeOptions
): Promise<Buffer> {
  const platform = (opts.platform || 'square').toLowerCase()
  const dims = PLATFORM_DIMENSIONS[platform] || PLATFORM_DIMENSIONS.square
  const { w, h } = dims

  // ── 1. Fetch base image ───────────────────────────────────────────────────
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())

  // ── 2. Build SVG layers ───────────────────────────────────────────────────
  const accentColor = extractFirstColor(opts.accentColor) || '#6366f1'
  const [r, g, b] = hexToRgb(accentColor)

  const gradientSvg  = buildGradientSvg(w, h)
  const brandTextSvg = buildBrandTextSvg(w, h, opts.brandName)
  const accentBarSvg = buildAccentBarSvg(w, h, `rgb(${r},${g},${b})`)

  // Arabic ad headline — extract + build SVG if caption provided
  const rawHeadline = opts.adHeadline ? extractAdHeadline(opts.adHeadline) : null
  const headlineSvg = rawHeadline ? buildAdHeadlineSvg(w, h, rawHeadline) : null

  // ── 3. Fetch + resize logo (optional) ────────────────────────────────────
  const logoSize = Math.round(w * 0.1)  // 10% of width: 108px at 1080
  const logoPaddingX = Math.round(w * 0.025)
  const logoPaddingY = Math.round(h * 0.025)

  const logoBuffer = opts.logoUrl
    ? await fetchAndResizeLogo(opts.logoUrl, logoSize)
    : null

  // ── 4. Composite everything using Sharp ───────────────────────────────────
  const compositeInputs: sharp.OverlayOptions[] = [
    // Gradient strip — must come first so all text/logo sit above it
    { input: gradientSvg, top: 0, left: 0 },
  ]

  // Arabic ad headline — middle of image, above brand strip
  if (headlineSvg) {
    compositeInputs.push({ input: headlineSvg, top: 0, left: 0 })
  }

  // Logo — bottom-right, with padding
  if (logoBuffer) {
    const logoTop  = h - logoSize - logoPaddingY
    const logoLeft = w - logoSize - logoPaddingX
    compositeInputs.push({ input: logoBuffer, top: logoTop, left: logoLeft })
  }

  // Brand name text (English) — bottom-left
  compositeInputs.push({ input: brandTextSvg, top: 0, left: 0 })

  // Accent bar (on top of everything — always fully visible)
  compositeInputs.push({ input: accentBarSvg, top: 0, left: 0 })

  const result = await sharp(imgBuf)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .composite(compositeInputs)
    .jpeg({ quality: 95, progressive: true })
    .toBuffer()

  return result
}

// ─── Cloudinary re-upload helper ──────────────────────────────────────────────

/**
 * Convert a Sharp output buffer to a base64 data URI accepted by
 * imageGen.uploadToCloudinary().
 */
export function bufferToDataUri(buffer: Buffer, mimeType = 'image/jpeg'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}
