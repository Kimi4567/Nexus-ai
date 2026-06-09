/**
 * NEXUS — Cloudinary Brand Overlay Utility
 *
 * Transforms AI-generated image URLs to include brand identity elements
 * via Cloudinary's URL-based transformation API.
 *
 * Zero extra API calls — pure URL manipulation.
 * Cloudinary's CDN applies the transformation on first request and caches it.
 *
 * What it adds to every AI-generated image:
 *   1. Platform-correct aspect ratio crop (1:1 for social, 1.91:1 for LinkedIn)
 *   2. Brand name text — white bold, bottom-left, with drop shadow
 *   3. Logo — top-right corner (only if a Cloudinary-hosted logo is available)
 *
 * Result: raw AI image → branded, platform-ready post visual
 */

export type OverlayPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'square'

export interface BrandOverlayOptions {
  brandName: string
  logoPublicId?: string   // Cloudinary public_id of uploaded logo (optional)
  platform?: OverlayPlatform
}

// ─── Platform crop dimensions ─────────────────────────────────────────────────

const PLATFORM_CROP: Record<OverlayPlatform, string> = {
  instagram: 'c_fill,w_1080,h_1080',
  facebook:  'c_fill,w_1200,h_630',
  linkedin:  'c_fill,w_1200,h_628',
  tiktok:    'c_fill,w_1080,h_1350',  // portrait 4:5 — safe for TikTok and IG
  square:    'c_fill,w_1080,h_1080',
}

// ─── Map our DB platform enum to overlay platform ─────────────────────────────

export function platformToOverlay(platform: string): OverlayPlatform {
  const map: Record<string, OverlayPlatform> = {
    META:      'square',     // Meta feed — 1:1 safe for both IG + FB stories
    INSTAGRAM: 'instagram',  // Instagram — 1080×1080 square
    FACEBOOK:  'facebook',   // Facebook  — 1200×630 landscape
    LINKEDIN:  'linkedin',   // LinkedIn  — 1200×628 landscape
    TIKTOK:    'tiktok',     // TikTok    — 1080×1350 portrait 4:5
    X:         'facebook',   // X/Twitter — landscape same as FB
    TWITTER:   'facebook',   // legacy alias
  }
  return map[platform?.toUpperCase()] || 'square'
}

// ─── Extract Cloudinary public_id from a URL ──────────────────────────────────

/**
 * If the logo URL is hosted on Cloudinary, extract its public_id so it
 * can be referenced in layer overlays (e.g. l_nexus:brand:logo_abc).
 * Returns undefined if the URL isn't Cloudinary-hosted.
 */
export function extractCloudinaryPublicId(url: string): string | undefined {
  if (!url?.includes('res.cloudinary.com')) return undefined

  const uploadIdx = url.indexOf('/upload/')
  if (uploadIdx === -1) return undefined

  let path = url.slice(uploadIdx + 8)
  // Strip optional version prefix (v1234567890/)
  path = path.replace(/^v\d+\//, '')
  // Strip file extension
  path = path.replace(/\.[^.]+$/, '')
  // Convert folder slashes to Cloudinary layer colon syntax
  path = path.replace(/\//g, ':')

  return path || undefined
}

// ─── Text sanitizer ───────────────────────────────────────────────────────────

/**
 * Sanitize brand name for Cloudinary text overlay.
 *
 * Rules (Cloudinary text layer in URL format):
 *  - Spaces         → underscore (Cloudinary renders _ as space)
 *  - Commas         → remove (break the transformation parameter list)
 *  - Slashes        → remove (break the URL path)
 *  - Percent signs  → remove (cause double-encoding issues)
 *  - Keep Arabic/Unicode as-is — browsers will percent-encode the full URL correctly
 */
function encodeOverlayText(text: string): string {
  return text
    .trim()
    .slice(0, 35)
    .replace(/\s+/g, '_')       // spaces → underscores
    .replace(/[,/%\\]/g, '')     // strip chars that break Cloudinary URL parsing
    .replace(/[^a-zA-Z0-9_\-.ءاأإآبتثجحخدذرزسشصضطظعغفقكلمنهوي]/g, '_') // safe chars only
    .replace(/_+/g, '_')        // collapse consecutive underscores
    .replace(/^_|_$/g, '')      // trim leading/trailing underscores
}

// ─── Core overlay function ────────────────────────────────────────────────────

/**
 * Apply brand overlay transformations to a Cloudinary-hosted image URL.
 *
 * Safe to call on any URL — returns the original unchanged if:
 *   - brandName is empty
 *   - URL is not hosted on Cloudinary (external/DALL-E temporary URLs)
 *   - /upload/ marker not found in URL
 *
 * @param cloudinaryUrl  Cloudinary secure_url from upload response
 * @param opts           Brand options (name, optional logo, platform)
 * @returns              Transformed URL with brand overlays baked in
 */
export function applyBrandOverlay(
  cloudinaryUrl: string,
  opts: BrandOverlayOptions
): string {
  const { brandName, logoPublicId, platform = 'square' } = opts

  // Guard: only works on Cloudinary-hosted images
  if (!cloudinaryUrl?.includes('res.cloudinary.com')) return cloudinaryUrl
  if (!brandName?.trim()) return cloudinaryUrl

  const uploadMarker = '/upload/'
  const uploadIdx = cloudinaryUrl.indexOf(uploadMarker)
  if (uploadIdx === -1) return cloudinaryUrl

  // Split URL at /upload/ boundary
  const base = cloudinaryUrl.slice(0, uploadIdx + uploadMarker.length)
  const rest = cloudinaryUrl.slice(uploadIdx + uploadMarker.length)

  const transforms: string[] = []

  // ── 1. Platform crop ──────────────────────────────────────────────────────
  transforms.push(PLATFORM_CROP[platform])

  // ── 2. Brand name text — white bold, bottom-left, strong shadow ─────────
  // Layout: brand name anchored bottom-left, logo anchored bottom-right.
  // This mirrors the professional "split badge" layout used in premium social ads.
  // Cloudinary font format: FontFamily_Size_style (e.g. Arial_44_bold)
  const safeText = encodeOverlayText(brandName)
  if (safeText) {
    transforms.push(
      `l_text:Arial_44_bold:${safeText},co_white,g_south_west,x_28,y_32,e_shadow:80`
    )
  }

  // ── 3. Logo — bottom-right corner, 120×120, strong shadow ────────────────
  // Cloudinary image layers require 3 steps: define layer / transform it / apply it.
  // Larger logo (120px) is clearly visible on all platforms.
  // Drop shadow added via e_shadow:60 for readability against any background.
  if (logoPublicId) {
    transforms.push(`l_${logoPublicId}`)
    transforms.push('c_fit,w_120,h_120,e_shadow:60')
    transforms.push('fl_layer_apply,g_south_east,x_24,y_24')
  }

  return `${base}${transforms.join('/')}/${rest}`
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Apply brand overlay using a brand profile object (from Prisma BrandProfile).
 * Handles logo extraction automatically.
 *
 * @param cloudinaryUrl  Image URL from Cloudinary upload
 * @param brand          BrandProfile record (or partial)
 * @param platform       Target platform for crop dimensions
 */
export function applyBrandOverlayFromProfile(
  cloudinaryUrl: string,
  brand: { brandName?: string | null; logoUrl?: string | null } | null | undefined,
  platform: OverlayPlatform = 'square'
): string {
  if (!brand?.brandName) return cloudinaryUrl

  const logoPublicId = brand.logoUrl
    ? extractCloudinaryPublicId(brand.logoUrl)
    : undefined

  return applyBrandOverlay(cloudinaryUrl, {
    brandName: brand.brandName,
    logoPublicId,
    platform,
  })
}
