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
    META:      'square',    // Instagram + Facebook feed — 1:1 works for both
    LINKEDIN:  'linkedin',
    TIKTOK:    'tiktok',
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

  // ── 2. Brand name text — white bold, bottom-left, drop shadow ────────────
  // Cloudinary font format: FontFamily_Size_style (e.g. Arial_34_bold)
  const safeText = encodeOverlayText(brandName)
  if (safeText) {
    transforms.push(
      `l_text:Arial_34_bold:${safeText},co_white,g_south_west,x_28,y_28,e_shadow:40`
    )
  }

  // ── 3. Logo — top-right corner (only if Cloudinary public_id is available) ─
  // Cloudinary image layers require 3 steps: define layer / transform it / apply it
  if (logoPublicId) {
    transforms.push(`l_${logoPublicId}`)
    transforms.push('c_fit,w_70,h_70')
    transforms.push('fl_layer_apply,g_north_east,x_20,y_20')
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
