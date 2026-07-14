export type PaidExecutionBlockerCode =
  | 'BUDGET_REQUIRED'
  | 'ADS_REQUIRED'
  | 'AD_COPY_REQUIRED'
  | 'DESTINATION_URL_REQUIRED'
  | 'AD_MEDIA_REQUIRED'
  | 'AD_MEDIA_PREFLIGHT_REQUIRED'
  | 'UNSUPPORTED_VIDEO_CREATIVE'
  | 'AD_DISAPPROVED'
  | 'META_PAGE_REQUIRED'
  | 'UNSUPPORTED_LIFETIME_BUDGET'
  | 'GOOGLE_SEARCH_ONLY'
  | 'GOOGLE_RSA_ASSETS_REQUIRED'
  | 'GOOGLE_KEYWORDS_REQUIRED'
  | 'GOOGLE_TARGETING_REQUIRED'
  | 'GOOGLE_DAILY_BUDGET_REQUIRED'

export interface PaidExecutionBlocker {
  code: PaidExecutionBlockerCode
  message: string
  adId?: string
}

export interface PaidExecutionAdInput {
  id?: string | null
  name?: string | null
  primaryText?: string | null
  headline?: string | null
  destinationUrl?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  reviewStatus?: string | null
  specsValidated?: boolean | null
  specsErrors?: string[] | null
  googleHeadlines?: string[] | null
  googleDescriptions?: string[] | null
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

function isUnsafePublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  const isPlaceholder = (
    normalized === 'example.com' ||
    normalized === 'example.org' ||
    normalized === 'example.net' ||
    normalized.endsWith('.example.com') ||
    normalized.endsWith('.example.org') ||
    normalized.endsWith('.example.net')
  )

  return (
    !normalized ||
    isPlaceholder ||
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    isPrivateIpv4(normalized)
  )
}

export function normalizePaidDestinationUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      isUnsafePublicHostname(hostname)
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function normalizePaidCreativeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      isUnsafePublicHostname(url.hostname)
    ) return null
    return url.toString()
  } catch {
    return null
  }
}

function slugifyCampaign(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)

  return slug || 'nexus_paid_campaign'
}

export function buildTrackedPaidDestinationUrl({
  destinationUrl,
  platform,
  campaignSlug,
}: {
  destinationUrl: unknown
  platform: unknown
  campaignSlug: string
}): string | null {
  const normalized = normalizePaidDestinationUrl(destinationUrl)
  if (!normalized) return null

  const url = new URL(normalized)
  const source = typeof platform === 'string' && platform.trim()
    ? platform.trim().toLowerCase()
    : 'paid'

  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', source)
  if (!url.searchParams.has('utm_medium')) {
    url.searchParams.set('utm_medium', source === 'google' ? 'cpc' : 'paid_social')
  }
  if (!url.searchParams.has('utm_campaign')) {
    url.searchParams.set('utm_campaign', slugifyCampaign(campaignSlug))
  }

  return url.toString()
}

export function evaluatePaidExecutionReadiness({
  platform,
  budgetType,
  dailyBudget,
  lifetimeBudget,
  ads,
  pageId,
  requireMetaPage = false,
  googleCampaignType,
  googleKeywordCount,
  googleTargetingReady,
}: {
  platform: unknown
  budgetType: unknown
  dailyBudget: unknown
  lifetimeBudget: unknown
  ads: PaidExecutionAdInput[]
  pageId?: unknown
  requireMetaPage?: boolean
  googleCampaignType?: unknown
  googleKeywordCount?: unknown
  googleTargetingReady?: unknown
}) {
  const blockers: PaidExecutionBlocker[] = []
  const normalizedBudgetType = budgetType === 'LIFETIME' ? 'LIFETIME' : 'DAILY'
  const rawBudget = normalizedBudgetType === 'LIFETIME' ? lifetimeBudget : dailyBudget
  const budgetAmount = typeof rawBudget === 'number' ? rawBudget : Number(rawBudget)

  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    blockers.push({
      code: 'BUDGET_REQUIRED',
      message: `A positive ${normalizedBudgetType.toLowerCase()} budget is required before platform execution.`,
    })
  }

  if (platform === 'META' && normalizedBudgetType === 'LIFETIME') {
    blockers.push({
      code: 'UNSUPPORTED_LIFETIME_BUDGET',
      message: 'Automated Meta draft creation currently requires an explicit daily budget. Lifetime budgets remain planning-only.',
    })
  }

  if (platform === 'GOOGLE' && normalizedBudgetType === 'LIFETIME') {
    blockers.push({
      code: 'GOOGLE_DAILY_BUDGET_REQUIRED',
      message: 'Automated Google Search draft creation currently requires a reviewed average daily budget.',
    })
  }

  if (platform === 'GOOGLE' && googleCampaignType !== 'SEARCH') {
    blockers.push({
      code: 'GOOGLE_SEARCH_ONLY',
      message: 'Automated Google Ads execution currently supports reviewed Search campaigns only.',
    })
  }

  if (platform === 'GOOGLE' && (typeof googleKeywordCount !== 'number' || googleKeywordCount < 1)) {
    blockers.push({
      code: 'GOOGLE_KEYWORDS_REQUIRED',
      message: 'Google Search needs at least one reviewed keyword with an explicit match type.',
    })
  }

  if (platform === 'GOOGLE' && googleTargetingReady !== true) {
    blockers.push({
      code: 'GOOGLE_TARGETING_REQUIRED',
      message: 'Google Search location, language, presence mode, and negative-keyword targeting must be reviewed before platform creation.',
    })
  }

  if (platform === 'META' && requireMetaPage && (typeof pageId !== 'string' || !pageId.trim())) {
    blockers.push({
      code: 'META_PAGE_REQUIRED',
      message: 'A verified Facebook Page is required before creating Meta platform drafts.',
    })
  }

  if (!Array.isArray(ads) || ads.length === 0) {
    blockers.push({
      code: 'ADS_REQUIRED',
      message: 'At least one reviewed ad draft is required before platform execution.',
    })
  }

  for (const [index, ad] of (ads || []).entries()) {
    const adName = ad.name?.trim() || `Ad ${index + 1}`
    const adId = ad.id || undefined

    if (platform !== 'GOOGLE' && (!ad.primaryText?.trim() || !ad.headline?.trim())) {
      blockers.push({
        code: 'AD_COPY_REQUIRED',
        message: `${adName} needs both primary text and a headline.`,
        adId,
      })
    }

    if (platform === 'GOOGLE') {
      const headlines = Array.isArray(ad.googleHeadlines) ? ad.googleHeadlines : []
      const descriptions = Array.isArray(ad.googleDescriptions) ? ad.googleDescriptions : []
      const validHeadlines = headlines.filter(value => typeof value === 'string' && value.trim() && value.trim().length <= 30)
      const validDescriptions = descriptions.filter(value => typeof value === 'string' && value.trim() && value.trim().length <= 90)
      if (new Set(validHeadlines.map(value => value.trim().toLocaleLowerCase())).size < 3
        || new Set(validDescriptions.map(value => value.trim().toLocaleLowerCase())).size < 2) {
        blockers.push({
          code: 'GOOGLE_RSA_ASSETS_REQUIRED',
          message: `${adName} needs at least 3 unique headlines (30 characters max) and 2 unique descriptions (90 characters max) for a responsive search ad.`,
          adId,
        })
      }
    }

    if (!normalizePaidDestinationUrl(ad.destinationUrl)) {
      blockers.push({
        code: 'DESTINATION_URL_REQUIRED',
        message: `${adName} needs a public HTTPS conversion destination with tracking.`,
        adId,
      })
    }

    if (platform === 'META') {
      const validImage = normalizePaidCreativeUrl(ad.imageUrl)
      const validVideo = normalizePaidCreativeUrl(ad.videoUrl)

      if (!validImage && validVideo) {
        blockers.push({
          code: 'UNSUPPORTED_VIDEO_CREATIVE',
          message: `${adName} uses video, but automated Meta video upload is not available in this execution path yet.`,
          adId,
        })
      } else if (!validImage) {
        blockers.push({
          code: 'AD_MEDIA_REQUIRED',
          message: `${adName} needs a reviewed image before a Meta platform draft can be created.`,
          adId,
        })
      } else if (ad.specsValidated !== true || (Array.isArray(ad.specsErrors) && ad.specsErrors.length > 0)) {
        blockers.push({
          code: 'AD_MEDIA_PREFLIGHT_REQUIRED',
          message: `${adName} needs a validated image preflight before a Meta platform draft can be created.`,
          adId,
        })
      }
    }

    if (ad.reviewStatus?.toUpperCase() === 'DISAPPROVED') {
      blockers.push({
        code: 'AD_DISAPPROVED',
        message: `${adName} is disapproved and cannot be executed.`,
        adId,
      })
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    budgetAmount: Number.isFinite(budgetAmount) && budgetAmount > 0 ? budgetAmount : null,
    adCount: ads.length,
  }
}
