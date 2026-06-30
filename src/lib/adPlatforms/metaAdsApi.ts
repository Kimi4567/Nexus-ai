/**
 * Meta Marketing API v21.0 — Nexus Ads Draft Creation Layer
 *
 * Responsible for:
 *   - Creating paused campaign draft objects via the Meta Marketing API
 *   - Creating paused Ad Sets with AI-generated targeting
 *   - Creating paused Ad Creatives + Ads
 *   - Reading campaign insights for performance sync
 *
 * Compliance:
 *   - Requires Business Verification + App Review (ads_management scope)
 *   - Developer-mode: works only for test ad accounts until App Review approved
 *   - All tokens stored encrypted via lib/tokenCrypto.ts
 *   - Rate limiting: Meta enforces 200 API calls / hour per token
 *
 * Architecture:
 *   - `hasApiAccess` flag in AdAccount table controls paused API draft creation
 *   - When false: returns dry-run export (JSON payload) instead of API draft creation
 *   - When true: creates paused Meta draft objects and updates platform IDs
 */

import { decryptToken } from '@/lib/tokenCrypto'

const META_API_BASE = 'https://graph.facebook.com/v21.0'
const META_API_VERSION = 'v21.0'

// ── Meta API types ─────────────────────────────────────────────────────────
export interface MetaCampaignPayload {
  name: string
  objective: string          // Meta objective enum
  status: 'ACTIVE' | 'PAUSED'
  special_ad_categories: string[]
}

export interface MetaAdSetPayload {
  name: string
  campaign_id: string
  daily_budget: number       // in cents (USD × 100)
  billing_event: string
  optimization_goal: string
  bid_strategy?: string
  targeting: MetaTargeting
  status: 'ACTIVE' | 'PAUSED'
  start_time?: string        // Unix timestamp or ISO string
  end_time?: string
}

export interface MetaTargeting {
  age_min?: number
  age_max?: number
  genders?: number[]         // 1=male, 2=female
  geo_locations?: {
    countries?: string[]
    cities?: Array<{ key: string; radius: number; distance_unit: string }>
    regions?: Array<{ key: string }>
  }
  interests?: Array<{ id: string; name: string }>
  behaviors?: Array<{ id: string; name: string }>
  publisher_platforms?: string[]
  facebook_positions?: string[]
  instagram_positions?: string[]
  custom_audiences?: Array<{ id: string }>
  excluded_custom_audiences?: Array<{ id: string }>
  flexible_spec?: Array<Record<string, Array<{ id: string; name: string }>>>
}

export interface MetaAdCreativePayload {
  name: string
  object_story_spec: {
    page_id: string
    link_data?: {
      message: string
      link: string
      caption?: string
      description?: string
      call_to_action?: { type: string; value: { link: string } }
      image_hash?: string
    }
    video_data?: {
      video_id: string
      message: string
      call_to_action?: { type: string; value: { link: string } }
    }
  }
}

export interface MetaAdPayload {
  name: string
  adset_id: string
  creative: { creative_id: string }
  status: 'ACTIVE' | 'PAUSED'
  tracking_specs?: unknown[]
}

// ── Objective mapping ──────────────────────────────────────────────────────
// Maps our internal objectives to Meta's Campaign Objective API enum
export const NEXUS_TO_META_OBJECTIVE: Record<string, string> = {
  TRAFFIC:         'OUTCOME_TRAFFIC',
  CONVERSIONS:     'OUTCOME_SALES',
  LEAD_GENERATION: 'OUTCOME_LEADS',
  BRAND_AWARENESS: 'OUTCOME_AWARENESS',
  ENGAGEMENT:      'OUTCOME_ENGAGEMENT',
  VIDEO_VIEWS:     'OUTCOME_TRAFFIC',
  APP_INSTALLS:    'OUTCOME_APP_PROMOTION',
  CATALOG_SALES:   'OUTCOME_SALES',
  STORE_TRAFFIC:   'OUTCOME_AWARENESS',
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────
async function metaFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE'
    token: string
    body?: Record<string, unknown>
  }
): Promise<T> {
  const url = `${META_API_BASE}/${path}`
  const method = options.method || 'GET'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  let finalUrl = url
  if (method === 'GET') {
    const params = new URLSearchParams({ access_token: options.token })
    finalUrl = `${url}?${params.toString()}`
  } else {
    fetchOptions.body = JSON.stringify({
      ...options.body,
      access_token: options.token,
    })
  }

  const response = await fetch(finalUrl, fetchOptions)
  const data = await response.json()

  if (!response.ok || data.error) {
    const err = data.error || { message: `HTTP ${response.status}`, code: response.status }
    throw new MetaApiError(
      err.message || 'Meta API error',
      err.code,
      err.error_subcode,
      err.fbtrace_id,
    )
  }

  return data as T
}

// ── MetaApiError ───────────────────────────────────────────────────────────
export class MetaApiError extends Error {
  code: number
  subcode?: number
  traceId?: string
  isRateLimit: boolean
  isPermission: boolean

  constructor(message: string, code: number, subcode?: number, traceId?: string) {
    super(message)
    this.name = 'MetaApiError'
    this.code = code
    this.subcode = subcode
    this.traceId = traceId
    this.isRateLimit = code === 17 || code === 4 || code === 613
    this.isPermission = code === 200 || code === 10 || code === 190
  }
}

// ── Main MetaAdsApi class ──────────────────────────────────────────────────
export class MetaAdsApi {
  private token: string
  private adAccountId: string // e.g. "act_123456789"

  constructor(encryptedToken: string, adAccountId: string) {
    // Decrypt the stored token
    this.token = decryptToken(encryptedToken) || encryptedToken
    this.adAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  }

  /**
   * Validate that the token is still valid
   */
  async validateToken(): Promise<{ userId: string; name: string }> {
    return this.metaGet<{ id: string; name: string }>('me', { fields: 'id,name' })
      .then(u => ({ userId: u.id, name: u.name }))
  }

  /**
   * List all ad accounts accessible by this token
   */
  async listAdAccounts(): Promise<Array<{
    id: string; name: string; account_status: number; currency: string
  }>> {
    const res = await this.metaGet<{ data: Array<{ id: string; name: string; account_status: number; currency: string }> }>(
      'me/adaccounts',
      { fields: 'id,name,account_status,currency,timezone_name,owner', limit: '20' }
    )
    return res.data || []
  }

  // ── Campaign CRUD ────────────────────────────────────────────────────────

  /**
   * Create a campaign in Meta Ads Manager
   * Returns the Meta campaign ID
   */
  async createCampaign(payload: MetaCampaignPayload): Promise<string> {
    const res = await this.metaPost<{ id: string }>(
      `${this.adAccountId}/campaigns`,
      {
        name: payload.name,
        objective: payload.objective,
        status: payload.status,
        special_ad_categories: payload.special_ad_categories || [],
        buying_type: 'AUCTION',
      }
    )
    return res.id
  }

  /**
   * Create an ad set under a campaign
   */
  async createAdSet(payload: MetaAdSetPayload): Promise<string> {
    const res = await this.metaPost<{ id: string }>(
      `${this.adAccountId}/adsets`,
      {
        name: payload.name,
        campaign_id: payload.campaign_id,
        daily_budget: Math.round(payload.daily_budget * 100), // Convert to cents
        billing_event: payload.billing_event,
        optimization_goal: payload.optimization_goal,
        bid_strategy: payload.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
        targeting: JSON.stringify(payload.targeting),
        status: payload.status,
        ...(payload.start_time && { start_time: payload.start_time }),
        ...(payload.end_time && { end_time: payload.end_time }),
      }
    )
    return res.id
  }

  /**
   * Create an ad creative (the visual + copy component)
   */
  async createAdCreative(payload: MetaAdCreativePayload): Promise<string> {
    const res = await this.metaPost<{ id: string }>(
      `${this.adAccountId}/adcreatives`,
      {
        name: payload.name,
        object_story_spec: payload.object_story_spec,
      }
    )
    return res.id
  }

  /**
   * Create an ad (binds ad set + creative)
   */
  async createAd(payload: MetaAdPayload): Promise<string> {
    const res = await this.metaPost<{ id: string }>(
      `${this.adAccountId}/ads`,
      {
        name: payload.name,
        adset_id: payload.adset_id,
        creative: payload.creative,
        status: payload.status,
        ...(payload.tracking_specs && { tracking_specs: payload.tracking_specs }),
      }
    )
    return res.id
  }

  /**
   * Fetch campaign insights (for performance sync)
   * Returns daily breakdown for the last N days
   */
  async getCampaignInsights(
    campaignId: string,
    datePreset = 'last_30d'
  ): Promise<Array<{
    date_start: string
    spend: string
    impressions: string
    clicks: string
    ctr: string
    cpc: string
    actions?: Array<{ action_type: string; value: string }>
    purchase_roas?: Array<{ action_type: string; value: string }>
  }>> {
    const res = await this.metaGet<{ data: unknown[] }>(
      `${campaignId}/insights`,
      {
        fields: 'date_start,spend,impressions,clicks,ctr,cpc,actions,purchase_roas,reach',
        time_increment: '1',
        date_preset: datePreset,
        limit: '30',
      }
    )
    return res.data as Array<{
      date_start: string
      spend: string
      impressions: string
      clicks: string
      ctr: string
      cpc: string
      actions?: Array<{ action_type: string; value: string }>
      purchase_roas?: Array<{ action_type: string; value: string }>
    }>
  }

  /**
   * Update campaign status (pause / activate)
   */
  async updateCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<boolean> {
    await this.metaPost<{ success: boolean }>(campaignId, { status })
    return true
  }

  /**
   * Dry-run mode: Build the complete API payload without sending to Meta
   * Used when hasApiAccess = false or during development
   */
  buildDryRunPayload(options: {
    campaignName: string
    objective: string
    dailyBudget: number
    targeting: MetaTargeting
    ads: Array<{ headline: string; primaryText: string; cta: string }>
    destinationUrl?: string
    pageId?: string
  }): Record<string, unknown> {
    const metaObjective = NEXUS_TO_META_OBJECTIVE[options.objective] || 'OUTCOME_TRAFFIC'

    return {
      campaign: {
        name: options.campaignName,
        objective: metaObjective,
        status: 'PAUSED',
        special_ad_categories: [],
        buying_type: 'AUCTION',
        _note: 'Import this via Meta Ads Manager → Campaigns → Import',
      },
      adset: {
        name: `${options.campaignName} — Ad Set 1`,
        daily_budget: Math.round(options.dailyBudget * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: metaObjective.includes('LEADS') ? 'LEAD_GENERATION' : 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: options.targeting,
        status: 'PAUSED',
      },
      ads: options.ads.map((ad, i) => ({
        name: `Ad Variant ${i + 1}`,
        status: 'PAUSED',
        creative: {
          name: `Creative ${i + 1} — ${ad.headline}`,
          object_story_spec: {
            page_id: options.pageId || '[[YOUR_PAGE_ID]]',
            link_data: {
              message: ad.primaryText,
              link: options.destinationUrl || '[[YOUR_URL]]',
              name: ad.headline,
              call_to_action: {
                type: ad.cta,
                value: { link: options.destinationUrl || '[[YOUR_URL]]' },
              },
            },
          },
        },
      })),
      _meta: {
        api_version: META_API_VERSION,
        generated_at: new Date().toISOString(),
        instructions: [
          '1. Go to Meta Ads Manager → Create Campaign',
          '2. Use the values in this JSON as your campaign settings',
          '3. For programmatic access: connect your Meta ad account via Nexus Settings → Connections',
          '4. Meta App Review approval required for live API push',
        ],
      },
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────
  private async metaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const searchParams = new URLSearchParams({
      ...params,
      access_token: this.token,
    })
    const url = `${META_API_BASE}/${path}?${searchParams.toString()}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok || data.error) {
      const err = data.error || { message: `HTTP ${res.status}`, code: res.status }
      throw new MetaApiError(err.message, err.code, err.error_subcode, err.fbtrace_id)
    }
    return data as T
  }

  private async metaPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return metaFetch<T>(path, { method: 'POST', token: this.token, body })
  }
}

// ── Factory ────────────────────────────────────────────────────────────────
/**
 * Create a MetaAdsApi instance from a decrypted AdAccount record
 */
export function createMetaAdsApi(
  encryptedToken: string,
  platformAccountId: string
): MetaAdsApi {
  return new MetaAdsApi(encryptedToken, platformAccountId)
}

/**
 * Convert Nexus AdSet targeting JSON (from AI strategy) to Meta's targeting spec
 */
export function nexusToMetaTargeting(aiTargeting: Record<string, unknown>): MetaTargeting {
  const targeting: MetaTargeting = {}

  if (aiTargeting.locations && Array.isArray(aiTargeting.locations)) {
    // Simple country-level targeting from location strings
    targeting.geo_locations = {
      countries: (aiTargeting.locations as string[])
        .map(l => COUNTRY_NAME_TO_CODE[l.toLowerCase()] || null)
        .filter(Boolean) as string[],
    }
  }

  if (aiTargeting.meta_interests && Array.isArray(aiTargeting.meta_interests)) {
    // Meta interests require numeric IDs from the Targeting Search API.
    // If pre-resolved IDs are provided (format: "12345:Interest Name"), use them.
    // Otherwise skip interests — campaigns will use broad targeting which is
    // often more effective for cold audiences anyway.
    const resolvedInterests: Array<{ id: string; name: string }> = []

    for (const item of aiTargeting.meta_interests as string[]) {
      if (typeof item === 'string' && item.includes(':')) {
        // Pre-resolved format: "6003139266461:Entrepreneurship"
        const colonIdx = item.indexOf(':')
        const id = item.slice(0, colonIdx).trim()
        const name = item.slice(colonIdx + 1).trim()
        if (id && !isNaN(Number(id))) {
          resolvedInterests.push({ id, name })
        }
      }
      // Skip unresolved names — don't add _pending_ IDs which cause API errors
    }

    if (resolvedInterests.length > 0) {
      targeting.interests = resolvedInterests
    }
    // If no resolved interests, targeting falls back to broad (no interests filter)
    // This is intentional — broad targeting is valid and often better for awareness campaigns
  }

  if (aiTargeting.meta_placements && Array.isArray(aiTargeting.meta_placements)) {
    const placements = aiTargeting.meta_placements as string[]
    if (placements.some(p => p.toLowerCase().includes('facebook'))) {
      targeting.publisher_platforms = targeting.publisher_platforms || []
      targeting.publisher_platforms.push('facebook')
      targeting.facebook_positions = ['feed', 'right_hand_column']
    }
    if (placements.some(p => p.toLowerCase().includes('instagram'))) {
      targeting.publisher_platforms = targeting.publisher_platforms || []
      targeting.publisher_platforms.push('instagram')
      targeting.instagram_positions = ['stream', 'reels', 'story']
    }
  }

  return targeting
}

// Country name → ISO code lookup (common MENA + global)
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'saudi arabia': 'SA', 'uae': 'AE', 'united arab emirates': 'AE',
  'egypt': 'EG', 'kuwait': 'KW', 'qatar': 'QA', 'bahrain': 'BH',
  'oman': 'OM', 'jordan': 'JO', 'morocco': 'MA', 'tunisia': 'TN',
  'united states': 'US', 'us': 'US', 'united kingdom': 'GB', 'uk': 'GB',
  'germany': 'DE', 'france': 'FR', 'canada': 'CA', 'australia': 'AU',
  'india': 'IN', 'pakistan': 'PK', 'turkey': 'TR',
}
