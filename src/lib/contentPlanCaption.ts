/**
 * Content-plan caption resolution.
 *
 * Trust Sprint #4: video slots return `videoCaption` (not `caption`), so the old
 * `gen.caption ?? gen.text ?? "Post N for <platform>"` fallthrough shipped a
 * generic ENGLISH placeholder for every video post. This resolves a real caption
 * for any slot and, only as a last resort, returns brand-relevant, language-aware
 * copy — never a generic placeholder.
 */

export interface GeneratedPostLike {
  caption?: unknown
  videoCaption?: unknown
  text?: unknown
}

export interface CaptionFallbackOpts {
  /** Arabic for ar/bilingual/unset campaigns; English only when explicitly 'en'. */
  isArabic: boolean
  /** Brand name to anchor the fallback copy. */
  brand: string
  /** A meaningful hint (key message / offer / campaign name) for the fallback. */
  hint: string
}

/** Last-resort caption — always real, brand-relevant, language-aware copy. */
export function fallbackCaption(isArabic: boolean, brand: string, hint: string): string {
  const b = (brand || '').trim() || (isArabic ? 'علامتك' : 'Your brand')
  const h = (hint || '').trim()
  if (isArabic) return h ? `${b} — ${h} ✨` : `${b} — تابعونا لمزيد من المحتوى المميز ✨`
  return h ? `${b} — ${h} ✨` : `${b} — stay tuned for more great content ✨`
}

/**
 * Resolve the user-facing caption for a generated post slot.
 * Prefers AI copy (caption → videoCaption → text); falls back to language-aware
 * brand copy. Returns a non-empty string for every slot.
 */
export function resolvePostCaption(gen: GeneratedPostLike, opts: CaptionFallbackOpts): string {
  const src = gen?.caption ?? gen?.videoCaption ?? gen?.text
  if (typeof src === 'string' && src.trim().length > 0) return src
  return fallbackCaption(opts.isArabic, opts.brand, opts.hint)
}
