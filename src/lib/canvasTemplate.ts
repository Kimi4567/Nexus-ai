/**
 * canvasTemplate.ts
 *
 * Client-side branded post image generator using HTML Canvas API.
 * Canvas uses the browser's native text engine → full Arabic/RTL support.
 * Returns a base64 PNG data URL that can be uploaded to Cloudinary.
 */

export interface TemplateOptions {
  type: 'quote' | 'stat' | 'tip' | 'promo'
  headline: string
  subtext: string
  stat: string
  statLabel: string
  cta: string
  brandName: string
  primaryColor: string   // hex e.g. '#7c3aed'
  accentColor: string    // hex e.g. '#1a1b2e'
  logoUrl: string
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'square'
}

const SIZES: Record<string, { w: number; h: number }> = {
  instagram: { w: 1080, h: 1080 },
  facebook:  { w: 1200, h: 630  },
  linkedin:  { w: 1200, h: 628  },
  tiktok:    { w: 1080, h: 1350 },
  square:    { w: 1080, h: 1080 },
}

// ─── Load an image, ignoring CORS errors ──────────────────────────────────────
async function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)   // silently skip on CORS / 404
    img.src = src
    setTimeout(() => resolve(null), 4000)  // 4s timeout
  })
}

// ─── Word-wrap helper ─────────────────────────────────────────────────────────
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  if (!text) return []
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      // If single word is longer than maxWidth, truncate it
      if (ctx.measureText(word).width > maxWidth) {
        let truncated = word
        while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
          truncated = truncated.slice(0, -1)
        }
        lines.push(truncated + '…')
        line = ''
      } else {
        line = word
      }
    }
    if (lines.length >= maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

// ─── Detect RTL ───────────────────────────────────────────────────────────────
function isRTL(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(text)
}

// ─── Draw text block (centered, multi-line) ───────────────────────────────────
function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  fontSize: number,
  color: string,
  weight = 'bold',
  maxLines = 4
): number {
  if (!text) return cy
  ctx.save()
  ctx.font = `${weight} ${fontSize}px system-ui, "Segoe UI", Arial, sans-serif`
  ctx.fillStyle = color
  const rtl = isRTL(text)
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textAlign = 'center'
  const lines = wrapLines(ctx, text, maxWidth, maxLines)
  const lineH = fontSize * 1.35
  const totalH = lines.length * lineH
  let y = cy - totalH / 2 + fontSize * 0.75
  for (const l of lines) {
    ctx.fillText(l, cx, y)
    y += lineH
  }
  ctx.restore()
  return y
}

// ─── Rounded rect helper ──────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE DRAWERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── QUOTE ────────────────────────────────────────────────────────────────────
function drawQuote(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  o: TemplateOptions,
  logo: HTMLImageElement | null
) {
  const pad = Math.round(W * 0.065)
  const barW = Math.round(W * 0.016)

  // Background
  ctx.fillStyle = o.accentColor
  ctx.fillRect(0, 0, W, H)

  // Left bar
  ctx.fillStyle = o.primaryColor
  ctx.fillRect(0, 0, barW, H)

  // Top bar
  ctx.fillStyle = o.primaryColor
  ctx.fillRect(0, 0, W, Math.round(H * 0.007))

  // Opening quote mark
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.font = `900 ${Math.round(W * 0.32)}px Georgia, "Times New Roman", serif`
  ctx.fillStyle = o.primaryColor
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  ctx.fillText('“', pad + barW, Math.round(H * 0.34))
  ctx.restore()

  // Headline
  const textX = W / 2 + barW / 2
  const headFs = o.headline.length > 70 ? Math.round(W * 0.048) : Math.round(W * 0.062)
  drawTextBlock(ctx, o.headline, textX, H * 0.5, W - pad * 2 - barW, headFs, '#ffffff', 'bold', 4)

  // Footer divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad + barW, H - Math.round(H * 0.13))
  ctx.lineTo(W - pad, H - Math.round(H * 0.13))
  ctx.stroke()

  // Brand dot + name
  const dotR = Math.round(W * 0.010)
  const footY = H - Math.round(H * 0.065)
  ctx.fillStyle = o.primaryColor
  ctx.beginPath()
  ctx.arc(pad + barW + dotR, footY, dotR, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = `700 ${Math.round(W * 0.026)}px system-ui, Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  ctx.fillText(o.brandName.toUpperCase(), pad + barW + dotR * 3, footY + Math.round(W * 0.010))

  // Logo
  if (logo) {
    const ls = Math.round(W * 0.09)
    ctx.drawImage(logo, W - pad - ls, H - Math.round(H * 0.11), ls, ls)
  }
}

// ─── STAT ─────────────────────────────────────────────────────────────────────
function drawStat(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  o: TemplateOptions,
  logo: HTMLImageElement | null
) {
  const pad = Math.round(W * 0.065)

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Top color band
  ctx.fillStyle = o.primaryColor
  ctx.fillRect(0, 0, W, Math.round(H * 0.010))

  // Brand label
  ctx.font = `800 ${Math.round(W * 0.022)}px system-ui, Arial, sans-serif`
  ctx.fillStyle = o.primaryColor
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  ctx.fillText(o.brandName.toUpperCase(), pad, Math.round(H * 0.12))

  // Big stat
  const statText = o.stat || o.headline.slice(0, 20)
  const statFs = Math.round(W * (statText.length <= 5 ? 0.22 : 0.14))
  ctx.font = `900 ${statFs}px system-ui, Arial, sans-serif`
  ctx.fillStyle = o.accentColor
  ctx.textAlign = 'left'
  ctx.fillText(statText, pad, Math.round(H * 0.12) + statFs * 1.1 + Math.round(H * 0.05))

  // Stat label
  const labelY = Math.round(H * 0.12) + statFs * 1.1 + Math.round(H * 0.05) + Math.round(H * 0.04)
  const labelText = o.statLabel || o.subtext
  if (labelText) {
    ctx.font = `600 ${Math.round(W * 0.036)}px system-ui, Arial, sans-serif`
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'left'
    const isRtl = isRTL(labelText)
    ctx.direction = isRtl ? 'rtl' : 'ltr'
    const labelX = isRtl ? W - pad : pad
    const lw = W - pad * 2
    const ls = Math.round(W * 0.036)
    const llines = wrapLines(ctx, labelText, lw, 3)
    let ly = labelY
    for (const l of llines) {
      ctx.fillText(l, labelX, ly)
      ly += ls * 1.4
    }
  }

  // Decorative line
  ctx.fillStyle = o.primaryColor
  roundRect(ctx, pad, H - Math.round(H * 0.15), Math.round(W * 0.10), 6, 3)
  ctx.fill()

  // Footer bar
  ctx.fillStyle = o.accentColor
  ctx.fillRect(0, H - Math.round(H * 0.10), W, Math.round(H * 0.10))

  ctx.font = `700 ${Math.round(W * 0.026)}px system-ui, Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  ctx.fillText(o.brandName.toUpperCase(), pad, H - Math.round(H * 0.038))

  if (logo) {
    const ls = Math.round(W * 0.07)
    ctx.drawImage(logo, W - pad - ls, H - Math.round(H * 0.085), ls, ls)
  }
}

// ─── TIP ──────────────────────────────────────────────────────────────────────
function drawTip(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  o: TemplateOptions,
  logo: HTMLImageElement | null
) {
  const pad = Math.round(W * 0.065)
  const headerH = Math.round(H * 0.15)

  // Light background
  ctx.fillStyle = '#f4f5ff'
  ctx.fillRect(0, 0, W, H)

  // Header band (primaryColor)
  ctx.fillStyle = o.primaryColor
  ctx.fillRect(0, 0, W, headerH)

  // "INSIGHT" label
  ctx.font = `800 ${Math.round(W * 0.020)}px system-ui, Arial, sans-serif`
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.textAlign = 'left'
  ctx.direction = 'ltr'
  ctx.fillText('INSIGHT', pad, Math.round(headerH * 0.4))

  // Brand name in header
  ctx.font = `900 ${Math.round(W * 0.032)}px system-ui, Arial, sans-serif`
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'left'
  ctx.fillText(o.brandName, pad, Math.round(headerH * 0.82))

  // Logo in header
  if (logo) {
    const ls = Math.round(W * 0.085)
    ctx.drawImage(logo, W - pad - ls, Math.round(headerH * 0.12), ls, ls)
  }

  // Headline
  const headFs = o.headline.length > 70 ? Math.round(W * 0.048) : Math.round(W * 0.062)
  drawTextBlock(ctx, o.headline, W / 2, headerH + (H - headerH) * 0.38, W - pad * 2, headFs, o.accentColor, 'bold', 3)

  // Subtext
  if (o.subtext) {
    const subFs = Math.round(W * 0.030)
    const rtl = isRTL(o.subtext)
    ctx.font = `400 ${subFs}px system-ui, Arial, sans-serif`
    ctx.fillStyle = '#555555'
    ctx.textAlign = 'center'
    ctx.direction = rtl ? 'rtl' : 'ltr'
    const subLines = wrapLines(ctx, o.subtext, W - pad * 2, 3)
    let sy = headerH + (H - headerH) * 0.60
    for (const l of subLines) {
      ctx.fillText(l, W / 2, sy)
      sy += subFs * 1.55
    }
  }

  // Bottom bar
  ctx.fillStyle = o.primaryColor
  ctx.fillRect(0, H - Math.round(H * 0.006), W, Math.round(H * 0.006))
}

// ─── PROMO ────────────────────────────────────────────────────────────────────
function drawPromo(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  o: TemplateOptions,
  logo: HTMLImageElement | null
) {
  const pad = Math.round(W * 0.065)

  // Background
  ctx.fillStyle = o.accentColor
  ctx.fillRect(0, 0, W, H)

  // Decorative circle top-right
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = o.primaryColor
  ctx.beginPath()
  ctx.arc(W + Math.round(W * 0.1), -Math.round(H * 0.05), Math.round(W * 0.45), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Decorative circle bottom-right (smaller)
  ctx.save()
  ctx.globalAlpha = 0.07
  ctx.fillStyle = o.primaryColor
  ctx.beginPath()
  ctx.arc(W - Math.round(W * 0.1), H + Math.round(H * 0.05), Math.round(W * 0.28), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Top row: logo + brand + "NEW" badge
  const topY = Math.round(H * 0.07)
  if (logo) {
    const ls = Math.round(W * 0.08)
    ctx.drawImage(logo, pad, topY - ls / 2, ls, ls)
    ctx.font = `800 ${Math.round(W * 0.026)}px system-ui, Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textAlign = 'left'
    ctx.direction = 'ltr'
    ctx.fillText(o.brandName.toUpperCase(), pad + ls + Math.round(W * 0.02), topY + Math.round(W * 0.010))
  } else {
    ctx.font = `800 ${Math.round(W * 0.026)}px system-ui, Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.textAlign = 'left'
    ctx.direction = 'ltr'
    ctx.fillText(o.brandName.toUpperCase(), pad, topY + Math.round(W * 0.010))
  }

  // "NEW" badge
  const badgeW = Math.round(W * 0.12)
  const badgeH = Math.round(H * 0.04)
  ctx.fillStyle = o.primaryColor
  roundRect(ctx, W - pad - badgeW, topY - badgeH / 2, badgeW, badgeH, badgeH / 2)
  ctx.fill()
  ctx.font = `800 ${Math.round(W * 0.020)}px system-ui, Arial, sans-serif`
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.direction = 'ltr'
  ctx.fillText('NEW', W - pad - badgeW / 2, topY + Math.round(W * 0.007))

  // Headline
  const headFs = o.headline.length > 60 ? Math.round(W * 0.056) : Math.round(W * 0.072)
  drawTextBlock(ctx, o.headline, W / 2, H * 0.50, W - pad * 2, headFs, '#ffffff', '900', 3)

  // Subtext
  if (o.subtext) {
    const subFs = Math.round(W * 0.030)
    drawTextBlock(ctx, o.subtext, W / 2, H * 0.68, W - pad * 2, subFs, 'rgba(255,255,255,0.55)', '400', 2)
  }

  // CTA button
  if (o.cta) {
    const btnW = Math.min(ctx.measureText(o.cta).width + Math.round(W * 0.10), W * 0.6)
    const btnH = Math.round(H * 0.06)
    const btnX = pad
    const btnY = H * 0.80
    ctx.fillStyle = o.primaryColor
    roundRect(ctx, btnX, btnY, btnW, btnH, Math.round(btnH * 0.35))
    ctx.fill()
    ctx.font = `800 ${Math.round(W * 0.028)}px system-ui, Arial, sans-serif`
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.direction = 'ltr'
    ctx.fillText(o.cta.slice(0, 40), btnX + btnW / 2, btnY + btnH * 0.66)
  }

  // Bottom divider
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.fillStyle = o.primaryColor
  ctx.fillRect(0, H - Math.round(H * 0.005), W, Math.round(H * 0.005))
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateBrandedImage(opts: TemplateOptions): Promise<string> {
  const { w, h } = SIZES[opts.platform] || SIZES.instagram

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h

  const ctx = canvas.getContext('2d')!

  // Load logo (may fail silently)
  const logoImg = await loadImg(opts.logoUrl)

  switch (opts.type) {
    case 'quote': drawQuote(ctx, w, h, opts, logoImg); break
    case 'stat':  drawStat(ctx, w, h, opts, logoImg);  break
    case 'tip':   drawTip(ctx, w, h, opts, logoImg);   break
    case 'promo': drawPromo(ctx, w, h, opts, logoImg); break
    default:      drawQuote(ctx, w, h, opts, logoImg)
  }

  return canvas.toDataURL('image/png')
}
