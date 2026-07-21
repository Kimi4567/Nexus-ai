import { createHash, createHmac } from 'node:crypto'

export const LANDING_PAGE_LOCALES = ['AR', 'EN', 'BILINGUAL'] as const
export const LANDING_PAGE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export const LANDING_PAGE_THEMES = ['MIDNIGHT', 'IVORY', 'VIOLET'] as const
export const CLIENT_CONVERSION_EVENTS = ['PAGE_VIEW', 'CTA_CLICK'] as const

export type LandingPageLocale = (typeof LANDING_PAGE_LOCALES)[number]
export type LandingPageStatus = (typeof LANDING_PAGE_STATUSES)[number]
export type LandingPageTheme = (typeof LANDING_PAGE_THEMES)[number]
export type ClientConversionEvent = (typeof CLIENT_CONVERSION_EVENTS)[number]

export interface LandingPageDraft {
  name: string
  campaignId: string
  captureFormId: string | null
  locale: LandingPageLocale
  headline: string
  subheadline: string | null
  body: string | null
  benefits: string[]
  proof: string | null
  primaryCtaLabel: string
  primaryCtaUrl: string | null
  theme: { variant: LandingPageTheme }
  seoTitle: string | null
  seoDescription: string | null
  seoIndexable: boolean
}

export interface PublicLandingPageSnapshot {
  schemaVersion: 1
  publicId: string
  locale: LandingPageLocale
  headline: string
  subheadline: string | null
  body: string | null
  benefits: string[]
  proof: string | null
  primaryCta: {
    label: string
    href: string
    kind: 'LEAD_FORM' | 'EXTERNAL'
    captureFormPublicId: string | null
  }
  theme: { variant: LandingPageTheme }
  seo?: {
    title: string | null
    description: string | null
    indexable: boolean
  }
}

type ParseResult =
  | { ok: true; value: LandingPageDraft }
  | { ok: false; error: string }

function text(value: unknown, max: number, required = false): string | null {
  if (typeof value !== 'string') return required ? '' : null
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (!cleaned) return required ? '' : null
  return cleaned.slice(0, max)
}

function containsMarkup(value: string | null): boolean {
  return Boolean(value && (/<\/?[a-z][^>]*>/i.test(value) || /javascript\s*:/i.test(value)))
}

function seoText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

function safeExternalUrl(value: unknown): string | null {
  const candidate = text(value, 800)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    const localHttp = process.env.NODE_ENV !== 'production'
      && url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !localHttp) return null
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return null
  }
}

export function isClientConversionEvent(value: unknown): value is ClientConversionEvent {
  return typeof value === 'string' && CLIENT_CONVERSION_EVENTS.includes(value as ClientConversionEvent)
}

export function parseLandingPageDraft(input: Record<string, unknown>): ParseResult {
  const name = text(input.name, 120, true) || ''
  const campaignId = text(input.campaignId, 100, true) || ''
  const captureFormId = text(input.captureFormId, 100)
  const headline = text(input.headline, 180, true) || ''
  const subheadline = text(input.subheadline, 500)
  const body = text(input.body, 2400)
  const proof = text(input.proof, 600)
  const primaryCtaLabel = text(input.primaryCtaLabel, 80, true) || ''
  const requestedUrl = text(input.primaryCtaUrl, 800)
  const primaryCtaUrl = safeExternalUrl(requestedUrl)
  const seoTitle = seoText(input.seoTitle)
  const seoDescription = seoText(input.seoDescription)
  const seoIndexable = input.seoIndexable === true
  const locale = typeof input.locale === 'string' ? input.locale.toUpperCase() : 'AR'
  const rawTheme = input.theme && typeof input.theme === 'object'
    ? (input.theme as Record<string, unknown>).variant
    : input.theme
  const theme = typeof rawTheme === 'string' ? rawTheme.toUpperCase() : 'MIDNIGHT'
  const benefits = Array.isArray(input.benefits)
    ? input.benefits.slice(0, 6).map(item => text(item, 220)).filter((item): item is string => Boolean(item))
    : []

  if (!name || !campaignId || !headline || !primaryCtaLabel) {
    return { ok: false, error: 'Name, campaign, headline, and CTA label are required.' }
  }
  if (!LANDING_PAGE_LOCALES.includes(locale as LandingPageLocale)) {
    return { ok: false, error: 'Locale must be AR, EN, or BILINGUAL.' }
  }
  if (!LANDING_PAGE_THEMES.includes(theme as LandingPageTheme)) {
    return { ok: false, error: 'Theme must be MIDNIGHT, IVORY, or VIOLET.' }
  }
  if (requestedUrl && !primaryCtaUrl) {
    return { ok: false, error: 'External CTA URL must use HTTPS.' }
  }
  if (input.seoIndexable !== undefined && typeof input.seoIndexable !== 'boolean') {
    return { ok: false, error: 'Search visibility must be an explicit boolean.' }
  }
  if ((seoTitle?.length ?? 0) > 70) {
    return { ok: false, error: 'SEO title must be 70 characters or fewer.' }
  }
  if ((seoDescription?.length ?? 0) > 180) {
    return { ok: false, error: 'SEO description must be 180 characters or fewer.' }
  }
  if (seoIndexable && (!seoTitle || seoTitle.length < 10 || !seoDescription || seoDescription.length < 50)) {
    return { ok: false, error: 'Indexable pages require an SEO title of 10–70 characters and a description of 50–180 characters.' }
  }
  if ([name, headline, subheadline, body, proof, primaryCtaLabel, seoTitle, seoDescription, ...benefits].some(value => containsMarkup(value))) {
    return { ok: false, error: 'Landing page content must be plain text without HTML or scripts.' }
  }

  return {
    ok: true,
    value: {
      name,
      campaignId,
      captureFormId,
      locale: locale as LandingPageLocale,
      headline,
      subheadline,
      body,
      benefits,
      proof,
      primaryCtaLabel,
      primaryCtaUrl,
      theme: { variant: theme as LandingPageTheme },
      seoTitle,
      seoDescription,
      seoIndexable,
    },
  }
}

export function buildPublicLandingPageSnapshot(args: {
  publicId: string
  draft: LandingPageDraft
  captureFormPublicId?: string | null
}): PublicLandingPageSnapshot {
  const { publicId, draft, captureFormPublicId } = args
  const href = captureFormPublicId
    ? `/lead-form/${encodeURIComponent(captureFormPublicId)}?lp=${encodeURIComponent(publicId)}`
    : draft.primaryCtaUrl
  if (!href) throw new Error('A live capture form or HTTPS CTA URL is required before publishing.')

  return {
    schemaVersion: 1,
    publicId,
    locale: draft.locale,
    headline: draft.headline,
    subheadline: draft.subheadline,
    body: draft.body,
    benefits: draft.benefits,
    proof: draft.proof,
    primaryCta: {
      label: draft.primaryCtaLabel,
      href,
      kind: captureFormPublicId ? 'LEAD_FORM' : 'EXTERNAL',
      captureFormPublicId: captureFormPublicId || null,
    },
    theme: draft.theme,
    seo: {
      title: draft.seoTitle,
      description: draft.seoDescription,
      indexable: draft.seoIndexable,
    },
  }
}

export function publishedSnapshotIsIndexable(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const seo = (value as Record<string, unknown>).seo
  return Boolean(seo && typeof seo === 'object' && !Array.isArray(seo) && (seo as Record<string, unknown>).indexable === true)
}

export function publishedSnapshotCaptureFormPublicId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const primaryCta = (value as Record<string, unknown>).primaryCta
  if (!primaryCta || typeof primaryCta !== 'object' || Array.isArray(primaryCta)) return null
  const cta = primaryCta as Record<string, unknown>
  return cta.kind === 'LEAD_FORM' && typeof cta.captureFormPublicId === 'string' && cta.captureFormPublicId.trim()
    ? cta.captureFormPublicId.trim()
    : null
}

export function hashLandingPageSnapshot(snapshot: PublicLandingPageSnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

export function conversionFingerprint(secret: string, parts: string[]): string {
  return createHmac('sha256', secret).update(parts.join('\u001f')).digest('hex')
}

export function conversionDedupeKey(args: {
  pageId: string
  eventType: ClientConversionEvent
  fingerprintHash: string
  experimentId?: string | null
  experimentVariant?: string | null
  occurredAt?: Date
}): string {
  const occurredAt = args.occurredAt ?? new Date()
  const windowMs = args.eventType === 'PAGE_VIEW' ? 30 * 60_000 : 10_000
  const bucket = Math.floor(occurredAt.getTime() / windowMs)
  return createHash('sha256')
    .update(`${args.pageId}:${args.eventType}:${args.fingerprintHash}:${args.experimentId || 'none'}:${args.experimentVariant || 'none'}:${bucket}`)
    .digest('hex')
}
