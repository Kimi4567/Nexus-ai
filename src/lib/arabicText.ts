/**
 * NEXUS — Arabic Typography Layer
 *
 * Renders pixel-perfect Arabic text as a compositable Sharp buffer.
 * Uses Satori (Vercel's JSX→SVG engine) with Noto Naskh Arabic font for
 * correct Arabic shaping (RTL, letter joining, diacritics).
 *
 * Why Satori and not SVG via librsvg?
 *   - librsvg on Vercel Lambda lacks Arabic fonts → boxes / garbled output
 *   - Satori embeds the font and uses HarfBuzz for correct Arabic shaping
 *   - Output is an SVG that Sharp converts to a PNG buffer for compositing
 *
 * Font: Noto Naskh Arabic Bold (Google Fonts) — ~80 KB woff2, fetched once
 * and cached in the module-level variable `_arabicFontCache`.
 *
 * Fallback: if Satori is not installed or font loading fails, returns null.
 * The caller (brandComposite.ts) will omit the text layer in that case.
 */

// Module-level cache — survives across warm Lambda invocations
let _arabicFontCache: ArrayBuffer | null = null

/** Load Noto Naskh Arabic Bold from Google Fonts CDN (with module-level cache) */
async function loadArabicFont(): Promise<ArrayBuffer | null> {
  if (_arabicFontCache) return _arabicFontCache

  // Google Fonts CDN — Noto Naskh Arabic variable weight
  const FONT_URL =
    'https://fonts.gstatic.com/s/notonaskharabic/v33/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc9EXhrn.woff2'

  try {
    const res = await fetch(FONT_URL, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(6000) : undefined,
    })
    if (!res.ok) {
      console.warn('[arabicText] Arabic font fetch failed:', res.status)
      return null
    }
    _arabicFontCache = await res.arrayBuffer()
    return _arabicFontCache
  } catch (err) {
    console.warn('[arabicText] Arabic font load error:', err)
    return null
  }
}

/**
 * Render an Arabic headline as a transparent PNG buffer (same dimensions as
 * the target image) ready to be composited by Sharp.
 *
 * Positions the text in the lower-center area with a semi-transparent dark
 * backing pill for legibility against any background.
 *
 * Returns null if Satori is not installed or font loading fails —
 * caller should skip the text layer gracefully.
 */
export async function renderArabicTextLayer(
  text: string,
  imageWidth: number,
  imageHeight: number
): Promise<Buffer | null> {
  if (!text?.trim()) return null

  try {
    // Dynamic import — gracefully skips if satori is not installed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const satoriModule = await import('satori').catch(() => null) as any
    if (!satoriModule) {
      console.warn('[arabicText] satori not installed — skipping Arabic text layer')
      return null
    }
    const satori = satoriModule.default ?? satoriModule

    const fontData = await loadArabicFont()
    if (!fontData) return null

    // Scale font size proportionally to image width
    const fontSize   = imageWidth >= 1080 ? 64 : imageWidth >= 800 ? 54 : 44
    const padX       = Math.round(imageWidth  * 0.06)
    const padBottom  = Math.round(imageHeight * 0.18)

    // Satori element (React-element-compatible plain object, no JSX needed)
    const element = {
      type: 'div',
      props: {
        style: {
          width:          imageWidth,
          height:         imageHeight,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'flex-end',
          background:     'transparent',
          paddingLeft:    padX,
          paddingRight:   padX,
          paddingBottom:  padBottom,
          boxSizing:      'border-box',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                background:   'rgba(0, 0, 0, 0.42)',
                borderRadius: 14,
                padding:      '20px 32px',
                color:        '#FFFFFF',
                fontSize,
                fontWeight:   '700',
                fontFamily:   '"Noto Naskh Arabic"',
                textAlign:    'center',
                lineHeight:   '1.55',
                direction:    'rtl',
                width:        '100%',
                // Drop shadow for legibility
                filter:       'drop-shadow(0px 2px 18px rgba(0,0,0,0.85))',
              },
              children: text,
            },
          },
        ],
      },
    }

    const svg = await satori(element, {
      width:  imageWidth,
      height: imageHeight,
      fonts: [
        {
          name:   'Noto Naskh Arabic',
          data:   fontData,
          weight: 700,
          style:  'normal',
        },
      ],
    })

    // Convert SVG → PNG buffer via Sharp
    const { default: sharp } = await import('sharp')
    const buffer = await sharp(Buffer.from(svg))
      .resize(imageWidth, imageHeight)
      .png()
      .toBuffer()

    return buffer
  } catch (err) {
    console.warn('[arabicText] renderArabicTextLayer failed:', err)
    return null
  }
}
