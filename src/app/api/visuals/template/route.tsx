/**
 * GET /api/visuals/template
 *
 * Branded post image generator using @vercel/og (Satori + resvg).
 * Returns a PNG image — zero AI cost, zero API calls.
 *
 * Query params:
 *   type          quote | stat | tip | promo     (default: quote)
 *   headline      Main text / hook
 *   subtext       Secondary text / body (optional)
 *   stat          Big stat number (stat template only)
 *   statLabel     Label under the stat
 *   cta           Call-to-action text (promo template)
 *   brandName     Brand name string
 *   primaryColor  Hex color e.g. %23FF9500 (# url-encoded)
 *   accentColor   Secondary hex color
 *   logoUrl       HTTPS URL to brand logo (Cloudinary or any public image)
 *   platform      instagram | tiktok | linkedin | facebook (affects size)
 */

import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// ─── Platform → canvas dimensions ─────────────────────────────────────────────
const SIZES: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  facebook:  { width: 1200, height: 630  },
  linkedin:  { width: 1200, height: 628  },
  tiktok:    { width: 1080, height: 1350 },
  square:    { width: 1080, height: 1080 },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function clean(hex: string): string {
  return hex.startsWith('#') ? hex : `#${hex}`
}

/** Truncate text to max chars */
function trunc(text: string, max: number): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams

  const type         = sp.get('type')         || 'quote'
  const headline     = sp.get('headline')     || ''
  const subtext      = sp.get('subtext')      || ''
  const stat         = sp.get('stat')         || ''
  const statLabel    = sp.get('statLabel')    || ''
  const cta          = sp.get('cta')          || ''
  const brandName    = sp.get('brandName')    || 'Brand'
  const primaryColor = clean(sp.get('primaryColor') || 'FF9500')
  const accentColor  = clean(sp.get('accentColor')  || '1a1b2e')
  const logoUrl      = sp.get('logoUrl')      || ''
  const platform     = sp.get('platform')     || 'instagram'

  const size = SIZES[platform.toLowerCase()] || SIZES.instagram
  const W = size.width
  const H = size.height

  // Font sizes relative to canvas width
  const fsHuge    = Math.round(W * 0.092)  // ~100px at 1080
  const fsLarge   = Math.round(W * 0.065)  // ~70px
  const fsMed     = Math.round(W * 0.042)  // ~45px
  const fsSm      = Math.round(W * 0.030)  // ~32px
  const fsXs      = Math.round(W * 0.024)  // ~26px
  const pad       = Math.round(W * 0.065)  // ~70px padding

  const headlineText = trunc(headline, 120)
  const subtextText  = trunc(subtext, 200)

  // ─── Template: QUOTE ──────────────────────────────────────────────────────────
  if (type === 'quote') {
    return new ImageResponse(
      (
        <div
          style={{
            width: W, height: H,
            background: accentColor,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Brand color side bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: Math.round(W * 0.018),
            background: primaryColor,
            display: 'flex',
          }} />

          {/* Brand color top bar */}
          <div style={{
            width: '100%', height: Math.round(H * 0.008),
            background: primaryColor,
            display: 'flex',
          }} />

          {/* Main content area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: `${pad}px ${pad + Math.round(W * 0.018)}px`,
          }}>

            {/* Opening quote mark */}
            <div style={{
              fontSize: Math.round(fsHuge * 2.5),
              color: primaryColor,
              lineHeight: 0.5,
              marginBottom: Math.round(H * 0.04),
              opacity: 0.7,
              display: 'flex',
              fontWeight: 900,
            }}>
              "
            </div>

            {/* Headline / Quote text */}
            <div style={{
              fontSize: headlineText.length > 60 ? fsMed : fsLarge,
              fontWeight: 800,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.25,
              maxWidth: '90%',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              {headlineText}
            </div>

            {/* Subtext */}
            {subtextText && (
              <div style={{
                marginTop: Math.round(H * 0.04),
                fontSize: fsSm,
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'center',
                maxWidth: '80%',
                lineHeight: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {subtextText}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${Math.round(H * 0.03)}px ${pad + Math.round(W * 0.018)}px`,
            borderTop: `1px solid rgba(255,255,255,0.08)`,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(W * 0.018),
            }}>
              {/* Brand color dot */}
              <div style={{
                width: Math.round(W * 0.018),
                height: Math.round(W * 0.018),
                borderRadius: '50%',
                background: primaryColor,
                display: 'flex',
              }} />
              <span style={{
                fontSize: fsSm,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.06em',
                display: 'flex',
              }}>
                {brandName.toUpperCase()}
              </span>
            </div>
            {/* Logo */}
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                width={Math.round(W * 0.1)}
                height={Math.round(W * 0.1)}
                style={{ objectFit: 'contain', borderRadius: 8 }}
                alt=""
              />
            )}
          </div>
        </div>
      ),
      { width: W, height: H }
    )
  }

  // ─── Template: STAT ───────────────────────────────────────────────────────────
  if (type === 'stat') {
    const statText  = trunc(stat || headline, 20)
    const labelText = trunc(statLabel || subtext, 80)

    return new ImageResponse(
      (
        <div
          style={{
            width: W, height: H,
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Brand color top band */}
          <div style={{
            width: '100%',
            height: Math.round(H * 0.012),
            background: primaryColor,
            display: 'flex',
          }} />

          {/* Main content */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: `${pad}px`,
          }}>

            {/* Tiny brand color label */}
            <div style={{
              fontSize: fsXs,
              fontWeight: 800,
              color: primaryColor,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: Math.round(H * 0.03),
              display: 'flex',
            }}>
              {brandName}
            </div>

            {/* HUGE stat number */}
            <div style={{
              fontSize: fsHuge * (statText.length <= 5 ? 2 : 1.3),
              fontWeight: 900,
              color: accentColor,
              lineHeight: 0.9,
              marginBottom: Math.round(H * 0.03),
              display: 'flex',
            }}>
              {statText}
            </div>

            {/* Stat label */}
            {labelText && (
              <div style={{
                fontSize: fsMed,
                fontWeight: 600,
                color: '#333',
                lineHeight: 1.35,
                maxWidth: '85%',
                display: 'flex',
                flexWrap: 'wrap',
              }}>
                {labelText}
              </div>
            )}

            {/* Decorative line */}
            <div style={{
              marginTop: Math.round(H * 0.05),
              width: Math.round(W * 0.12),
              height: 6,
              background: primaryColor,
              borderRadius: 3,
              display: 'flex',
            }} />
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${Math.round(H * 0.03)}px ${pad}px`,
            background: accentColor,
          }}>
            <span style={{
              fontSize: fsSm,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.06em',
              display: 'flex',
            }}>
              {brandName.toUpperCase()}
            </span>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                width={Math.round(W * 0.09)}
                height={Math.round(W * 0.09)}
                style={{ objectFit: 'contain', filter: 'brightness(10)' }}
                alt=""
              />
            )}
          </div>
        </div>
      ),
      { width: W, height: H }
    )
  }

  // ─── Template: TIP ────────────────────────────────────────────────────────────
  if (type === 'tip') {
    return new ImageResponse(
      (
        <div
          style={{
            width: W, height: H,
            background: '#f8f9ff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Brand color header band */}
          <div style={{
            width: '100%',
            background: primaryColor,
            padding: `${Math.round(H * 0.04)}px ${pad}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: Math.round(H * 0.14),
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontSize: fsXs,
                fontWeight: 800,
                color: 'rgba(0,0,0,0.4)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                display: 'flex',
              }}>
                INSIGHT
              </span>
              <span style={{
                fontSize: fsSm,
                fontWeight: 900,
                color: '#000000',
                display: 'flex',
              }}>
                {brandName}
              </span>
            </div>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                width={Math.round(W * 0.1)}
                height={Math.round(W * 0.1)}
                style={{ objectFit: 'contain' }}
                alt=""
              />
            )}
          </div>

          {/* Main content */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: `${pad}px`,
          }}>
            {/* Headline */}
            <div style={{
              fontSize: headlineText.length > 70 ? fsMed : fsLarge,
              fontWeight: 800,
              color: accentColor,
              lineHeight: 1.2,
              marginBottom: Math.round(H * 0.04),
              display: 'flex',
              flexWrap: 'wrap',
            }}>
              {headlineText}
            </div>

            {/* Body */}
            {subtextText && (
              <div style={{
                fontSize: fsSm,
                color: '#555',
                lineHeight: 1.65,
                display: 'flex',
                flexWrap: 'wrap',
              }}>
                {subtextText}
              </div>
            )}
          </div>

          {/* Bottom accent bar */}
          <div style={{
            width: '100%',
            height: Math.round(H * 0.008),
            background: primaryColor,
            display: 'flex',
          }} />
        </div>
      ),
      { width: W, height: H }
    )
  }

  // ─── Template: PROMO (default) ────────────────────────────────────────────────
  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H,
          background: accentColor,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Background geometric accent */}
        <div style={{
          position: 'absolute',
          right: -Math.round(W * 0.15),
          top: -Math.round(H * 0.15),
          width: Math.round(W * 0.65),
          height: Math.round(W * 0.65),
          borderRadius: '50%',
          background: primaryColor,
          opacity: 0.1,
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute',
          right: Math.round(W * 0.05),
          bottom: Math.round(H * 0.1),
          width: Math.round(W * 0.35),
          height: Math.round(W * 0.35),
          borderRadius: '50%',
          background: primaryColor,
          opacity: 0.08,
          display: 'flex',
        }} />

        {/* Top logo row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${pad * 0.8}px ${pad}px`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: Math.round(W * 0.02),
          }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                width={Math.round(W * 0.09)}
                height={Math.round(W * 0.09)}
                style={{ objectFit: 'contain', filter: 'brightness(10)' }}
                alt=""
              />
            )}
            <span style={{
              fontSize: fsSm,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '0.06em',
              display: 'flex',
            }}>
              {brandName.toUpperCase()}
            </span>
          </div>
          {/* Brand color pill */}
          <div style={{
            background: primaryColor,
            borderRadius: 100,
            padding: `${Math.round(H * 0.012)}px ${Math.round(W * 0.03)}px`,
            display: 'flex',
          }}>
            <span style={{
              fontSize: fsXs,
              fontWeight: 800,
              color: '#000',
              letterSpacing: '0.1em',
              display: 'flex',
            }}>
              NEW
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `0 ${pad}px`,
        }}>
          {/* Headline */}
          <div style={{
            fontSize: headlineText.length > 60 ? fsMed : fsLarge,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: Math.round(H * 0.04),
            display: 'flex',
            flexWrap: 'wrap',
          }}>
            {headlineText}
          </div>

          {/* Subtext */}
          {subtextText && (
            <div style={{
              fontSize: fsSm,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.55,
              marginBottom: Math.round(H * 0.06),
              maxWidth: '80%',
              display: 'flex',
              flexWrap: 'wrap',
            }}>
              {subtextText}
            </div>
          )}

          {/* CTA button */}
          {cta && (
            <div style={{
              display: 'flex',
              alignSelf: 'flex-start',
              background: primaryColor,
              borderRadius: 14,
              padding: `${Math.round(H * 0.022)}px ${Math.round(W * 0.055)}px`,
            }}>
              <span style={{
                fontSize: fsSm,
                fontWeight: 800,
                color: '#000000',
                display: 'flex',
              }}>
                {trunc(cta, 40)}
              </span>
            </div>
          )}
        </div>

        {/* Bottom divider line */}
        <div style={{
          width: '100%',
          height: Math.round(H * 0.006),
          background: primaryColor,
          opacity: 0.4,
          display: 'flex',
        }} />
      </div>
    ),
    { width: W, height: H }
  )
}
