/**
 * PR-M3.3C — Assisted-draft field labels + client-side safety allowlist.
 *
 * Pure, framework-free helpers used by the Assisted "Create draft" → Review
 * Suggestions flow to (a) render a localized label for each suggested field and
 * (b) defend-in-depth against any unsafe field that might leak from the routes.
 *
 * The server (guardExtracted → buildAssistSuggestions) is the source of truth for
 * basis/confidence/evidence and for the never-suggest policy. This module NEVER
 * upgrades confidence, NEVER invents evidence, and NEVER fills missing fields — it
 * only maps known field keys to display labels and filters out anything unsafe.
 */

// Fields the Assisted review UI is allowed to render. Mirrors the union of the
// Scanner (WEBSITE_FIELD_BASIS) and Analyzer (CONTENT_FIELD_BASIS) policies in
// src/lib/ai/assistSuggestions.ts. Any field NOT in this set is ignored client-side.
export const CLIENT_RENDERABLE_FIELDS = new Set<string>([
  'brandName',
  'industry',
  'description',
  'primaryOffer',
  'targetAudience',
  'uniqueAdvantages',
  'toneKeywords',
  'writingStyle',
  'audiencePainPoints',
  'audienceDesires',
  'strategicNotes',
  'competitors',
  'pricePoint',
  'winningHooks',
  'winningAngles',
])

// Manual-only / user-owned / proof fields that must NEVER be shown as a
// suggestion even if a future route regression leaks one. Mirrors NEVER_SUGGEST
// in src/lib/ai/assistSuggestions.ts (defense-in-depth — the client also enforces it).
export const CLIENT_NEVER_SHOW_FIELDS = new Set<string>([
  'verifiedProof',
  'businessGoal',
  'marketingBudget',
  'conversionDestination',
  'leadHandling',
  'languagePreference',
  'audienceAge',
  'audienceLocation',
])

const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  brandName:          { en: 'Brand name',           ar: 'اسم العلامة' },
  industry:           { en: 'Industry',             ar: 'المجال' },
  description:        { en: 'Business description',  ar: 'وصف النشاط' },
  primaryOffer:       { en: 'Primary offer',        ar: 'العرض الأساسي' },
  targetAudience:     { en: 'Target audience',      ar: 'الجمهور المستهدف' },
  uniqueAdvantages:   { en: 'Unique advantages',    ar: 'المزايا الفريدة' },
  toneKeywords:       { en: 'Tone keywords',        ar: 'كلمات النبرة' },
  writingStyle:       { en: 'Writing style',        ar: 'أسلوب الكتابة' },
  audiencePainPoints: { en: 'Audience pain points', ar: 'نقاط ألم الجمهور' },
  audienceDesires:    { en: 'Audience desires',     ar: 'رغبات الجمهور' },
  strategicNotes:     { en: 'Strategic notes',      ar: 'ملاحظات استراتيجية' },
  competitors:        { en: 'Competitors',          ar: 'المنافسون' },
  pricePoint:         { en: 'Price point',          ar: 'مستوى السعر' },
  winningHooks:       { en: 'Winning hooks',        ar: 'خطافات ناجحة' },
  winningAngles:      { en: 'Winning angles',       ar: 'زوايا ناجحة' },
}

/** Localized display label for a field key (falls back to the raw key). */
export function fieldLabel(field: string, locale?: string): string {
  const entry = FIELD_LABELS[field]
  if (!entry) return field
  return locale === 'ar' ? entry.ar : entry.en
}

/** A field is safe to render only if allow-listed AND not in the never-show set. */
export function isRenderableField(field: string): boolean {
  return CLIENT_RENDERABLE_FIELDS.has(field) && !CLIENT_NEVER_SHOW_FIELDS.has(field)
}
