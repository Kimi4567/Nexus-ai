import { decryptToken } from '@/lib/tokenCrypto'

export const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'

export type GoogleAdsAccessTier = 'NONE' | 'TEST' | 'EXPLORER' | 'BASIC' | 'STANDARD'
export type GoogleKeywordMatchType = 'BROAD' | 'PHRASE' | 'EXACT'
export type GoogleLocationPresence = 'PRESENCE' | 'PRESENCE_OR_INTEREST'

type JsonObject = Record<string, unknown>

export interface GoogleAdsDiscoveredAccount {
  customerId: string
  descriptiveName: string
  currencyCode: string
  timeZone: string
  status: string
  testAccount: boolean
  loginCustomerId: string | null
  managerName: string | null
}

export interface GoogleAdsDiscoveredManager {
  customerId: string
  descriptiveName: string
  status: string
  testAccount: boolean
}

export interface GoogleAdsConnectionDiscovery {
  accounts: GoogleAdsDiscoveredAccount[]
  managers: GoogleAdsDiscoveredManager[]
}

export interface GoogleSearchKeyword {
  text: string
  matchType: GoogleKeywordMatchType
}

export interface GoogleSearchLocation {
  name: string
  countryCode: string
  targetType?: string
}

export interface GoogleResolvedLocation extends GoogleSearchLocation {
  resourceName: string
  canonicalName: string
}

export interface GoogleResponsiveSearchAssets {
  headlines: string[]
  descriptions: string[]
  path1?: string
  path2?: string
}

export interface GoogleSearchTargeting {
  keywords: GoogleSearchKeyword[]
  negativeKeywords: GoogleSearchKeyword[]
  locations: GoogleSearchLocation[]
  languageIds: string[]
  languageCodes: string[]
  locationPresence: GoogleLocationPresence | null
  blockers: string[]
}

export interface GoogleSearchDraftAd {
  localId: string
  name: string
  finalUrl: string
  assets: GoogleResponsiveSearchAssets
}

export interface GoogleSearchDraftAdGroup {
  localId: string
  name: string
  keywords: GoogleSearchKeyword[]
  negativeKeywords: GoogleSearchKeyword[]
  ads: GoogleSearchDraftAd[]
}

export interface GoogleSearchDraftInput {
  customerId: string
  campaignName: string
  budgetAmount: number
  startDate?: Date | string | null
  endDate?: Date | string | null
  locationPresence: GoogleLocationPresence
  euPoliticalAdvertisingDeclaration: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'
  locations: GoogleResolvedLocation[]
  languageIds: string[]
  adGroups: GoogleSearchDraftAdGroup[]
}

export interface GoogleSearchMutationBinding {
  campaignOperationIndex: number
  adGroups: Array<{
    localId: string
    operationIndex: number
    ads: Array<{ localId: string; operationIndex: number }>
  }>
}

export interface GoogleSearchDraftMutations {
  mutateOperations: JsonObject[]
  binding: GoogleSearchMutationBinding
}

const LANGUAGE_CRITERION_IDS: Record<string, string> = {
  ar: '1019', bn: '1056', bg: '1020', ca: '1038', zh_cn: '1017', zh_tw: '1018',
  hr: '1039', cs: '1021', da: '1009', nl: '1010', en: '1000', et: '1043', tl: '1042',
  fi: '1011', fr: '1002', de: '1001', el: '1022', gu: '1072', he: '1027', iw: '1027',
  hi: '1023', hu: '1024', is: '1026', id: '1025', it: '1004', ja: '1005', kn: '1086',
  ko: '1012', lv: '1028', lt: '1029', ms: '1102', ml: '1098', mr: '1101', no: '1013',
  fa: '1064', pl: '1030', pt: '1014', pa: '1110', ro: '1032', ru: '1031', sr: '1035',
  sk: '1033', sl: '1034', es: '1003', sv: '1015', ta: '1130', te: '1131', th: '1044',
  tr: '1037', uk: '1036', ur: '1041', vi: '1040',
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}
}

function uniqueStrings(values: unknown[], maxLength?: number): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const normalized = value.trim().replace(/\s+/g, ' ')
    if (!normalized || (maxLength && normalized.length > maxLength)) continue
    const key = normalized.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

export function normalizeGoogleCustomerId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).replace(/\D/g, '')
  return /^\d{6,20}$/.test(normalized) ? normalized : null
}

export function googleAdsApiVersion(): string {
  const configured = (process.env.GOOGLE_ADS_API_VERSION || 'v24').trim()
  const version = configured.startsWith('v') ? configured : `v${configured}`
  return /^v\d+$/.test(version) ? version : 'v24'
}

export function googleAdsAccessTier(): GoogleAdsAccessTier {
  const configured = (process.env.GOOGLE_ADS_ACCESS_TIER || 'NONE').trim().toUpperCase()
  return ['TEST', 'EXPLORER', 'BASIC', 'STANDARD'].includes(configured)
    ? configured as GoogleAdsAccessTier
    : 'NONE'
}

export function googleAdsAccountCanExecute(testAccount: boolean): boolean {
  const tier = googleAdsAccessTier()
  if (tier === 'NONE') return false
  if (tier === 'TEST') return testAccount
  return true
}

export function googleAdsAccountExecutionBlocker(
  testAccount: boolean,
  accountStatus: string,
): string | null {
  const normalizedStatus = accountStatus.trim().toUpperCase() || 'UNKNOWN'
  if (normalizedStatus !== 'ENABLED') {
    return `Connection verified, but Google Ads reports account status ${normalizedStatus}. Complete or reactivate the Google Ads account before execution.`
  }
  if (!googleAdsAccountCanExecute(testAccount)) {
    return `Connection verified, but GOOGLE_ADS_ACCESS_TIER=${googleAdsAccessTier()} does not authorize this account for execution.`
  }
  return null
}

function googleAdsBaseUrl(): string {
  return `https://googleads.googleapis.com/${googleAdsApiVersion()}`
}

async function responseJson(response: Response): Promise<JsonObject> {
  const text = await response.text()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return asObject(parsed)
  } catch {
    return { message: text.slice(0, 500) }
  }
}

function errorMessage(data: JsonObject, fallback: string): string {
  const error = asObject(data.error)
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  if (typeof data.message === 'string' && data.message.trim()) return data.message
  return fallback
}

export class GoogleAdsApiError extends Error {
  readonly status: number
  readonly requestId: string | null
  readonly details: unknown

  constructor(message: string, status: number, requestId: string | null, details?: unknown) {
    super(message)
    this.name = 'GoogleAdsApiError'
    this.status = status
    this.requestId = requestId
    this.details = details
  }
}

export class GoogleAdsOAuthError extends Error {
  readonly status: number
  readonly code: string
  readonly description: string | null

  constructor(input: {
    status: number
    code: string
    description?: string | null
  }) {
    const message = input.code === 'invalid_client'
      ? 'Google Ads rejected the OAuth client credentials. Rotate the client secret and reconnect.'
      : input.code === 'invalid_grant'
        ? 'The Google authorization expired or was already used. Start the Google Ads connection again.'
        : input.code === 'redirect_uri_mismatch'
          ? 'The Google Ads OAuth callback does not match the redirect URI configured in Google Cloud.'
          : `Google Ads token exchange failed (${input.code})`
    super(message)
    this.name = 'GoogleAdsOAuthError'
    this.status = input.status
    this.code = input.code
    this.description = input.description?.trim() || null
  }
}

async function googleAdsFetchWithToken<T extends JsonObject>(input: {
  path: string
  accessToken: string
  developerToken: string
  method?: 'GET' | 'POST'
  body?: JsonObject
  loginCustomerId?: string | null
}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
    'developer-token': input.developerToken,
    'Content-Type': 'application/json',
  }
  const loginCustomerId = normalizeGoogleCustomerId(input.loginCustomerId)
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId

  const response = await fetch(`${googleAdsBaseUrl()}/${input.path.replace(/^\//, '')}`, {
    method: input.method || 'GET',
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: 'no-store',
  })
  const data = await responseJson(response)
  if (!response.ok || data.error) {
    throw new GoogleAdsApiError(
      errorMessage(data, `Google Ads API request failed (${response.status})`),
      response.status,
      response.headers.get('request-id'),
      asObject(data.error).details,
    )
  }
  return data as T
}

export async function exchangeGoogleAdsAuthorizationCode(input: {
  code: string
  redirectUri: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  scopes: string[]
}> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Google Ads OAuth is not configured')

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
    cache: 'no-store',
  })
  const data = await responseJson(response)
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new GoogleAdsOAuthError({
      status: response.status,
      code: typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : 'token_exchange_failed',
      description: typeof data.error_description === 'string'
        ? data.error_description
        : null,
    })
  }
  if (typeof data.refresh_token !== 'string' || !data.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke the previous grant and reconnect with consent.')
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in || 3600),
    scopes: typeof data.scope === 'string'
      ? data.scope.split(/\s+/).filter(Boolean)
      : [],
  }
}

async function refreshGoogleAdsAccessToken(encryptedRefreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken = decryptToken(encryptedRefreshToken) || encryptedRefreshToken
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Ads refresh credentials are missing')
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const data = await responseJson(response)
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new Error(errorMessage(data, 'Google Ads token refresh failed'))
  }
  return data.access_token
}

export async function discoverGoogleAdsConnection(accessToken: string): Promise<GoogleAdsConnectionDiscovery> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) throw new Error('Google Ads developer token is not configured')

  const accessible = await googleAdsFetchWithToken<{ resourceNames?: unknown }>({
    path: 'customers:listAccessibleCustomers',
    accessToken,
    developerToken,
  })
  const resourceNames = Array.isArray(accessible.resourceNames) ? accessible.resourceNames : []
  const seedIds = resourceNames
    .map(resource => normalizeGoogleCustomerId(typeof resource === 'string' ? resource : ''))
    .filter((value): value is string => Boolean(value))
  const discovered = new Map<string, GoogleAdsDiscoveredAccount>()
  const managers = new Map<string, GoogleAdsDiscoveredManager>()
  const failures: string[] = []

  for (const seedId of seedIds.slice(0, 25)) {
    try {
      const hierarchy = await googleAdsFetchWithToken<{ results?: unknown }>({
        path: `customers/${seedId}/googleAds:search`,
        accessToken,
        developerToken,
        loginCustomerId: seedId,
        method: 'POST',
        body: {
          query: `SELECT customer_client.client_customer, customer_client.level, customer_client.manager, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.id, customer_client.status, customer_client.test_account FROM customer_client WHERE customer_client.level <= 1`,
        },
      })
      const rows = Array.isArray(hierarchy.results) ? hierarchy.results : []
      const managerRow = rows
        .map(row => asObject(asObject(row).customerClient))
        .find(client => Number(client.level) === 0)
      const managerName = typeof managerRow?.descriptiveName === 'string' ? managerRow.descriptiveName : null
      for (const row of rows) {
        const client = asObject(asObject(row).customerClient)
        const customerId = normalizeGoogleCustomerId(client.id)
        if (!customerId || client.hidden === true) continue
        if (client.manager === true) {
          managers.set(customerId, {
            customerId,
            descriptiveName: typeof client.descriptiveName === 'string' && client.descriptiveName.trim()
              ? client.descriptiveName.trim()
              : `Google Ads Manager ${customerId}`,
            status: typeof client.status === 'string' ? client.status : 'UNKNOWN',
            testAccount: client.testAccount === true,
          })
          continue
        }
        const status = typeof client.status === 'string' ? client.status : 'UNKNOWN'
        discovered.set(customerId, {
          customerId,
          descriptiveName: typeof client.descriptiveName === 'string' && client.descriptiveName.trim()
            ? client.descriptiveName.trim()
            : `Google Ads ${customerId}`,
          currencyCode: typeof client.currencyCode === 'string' ? client.currencyCode : 'USD',
          timeZone: typeof client.timeZone === 'string' ? client.timeZone : 'UTC',
          status,
          testAccount: client.testAccount === true,
          loginCustomerId: customerId === seedId ? null : seedId,
          managerName: customerId === seedId ? null : managerName,
        })
      }
      if (rows.length > 0) continue
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }

    try {
      const direct = await googleAdsFetchWithToken<{ results?: unknown }>({
        path: `customers/${seedId}/googleAds:search`,
        accessToken,
        developerToken,
        method: 'POST',
        body: {
          query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account, customer.status FROM customer LIMIT 1',
        },
      })
      const customer = asObject(asObject((Array.isArray(direct.results) ? direct.results[0] : null)).customer)
      const customerId = normalizeGoogleCustomerId(customer.id) || seedId
      if (customer.manager === true) {
        managers.set(customerId, {
          customerId,
          descriptiveName: typeof customer.descriptiveName === 'string' && customer.descriptiveName.trim()
            ? customer.descriptiveName.trim()
            : `Google Ads Manager ${customerId}`,
          status: typeof customer.status === 'string' ? customer.status : 'UNKNOWN',
          testAccount: customer.testAccount === true,
        })
      } else {
        const status = typeof customer.status === 'string' ? customer.status : 'UNKNOWN'
        discovered.set(customerId, {
          customerId,
          descriptiveName: typeof customer.descriptiveName === 'string' && customer.descriptiveName.trim()
            ? customer.descriptiveName.trim()
            : `Google Ads ${customerId}`,
          currencyCode: typeof customer.currencyCode === 'string' ? customer.currencyCode : 'USD',
          timeZone: typeof customer.timeZone === 'string' ? customer.timeZone : 'UTC',
          status,
          testAccount: customer.testAccount === true,
          loginCustomerId: null,
          managerName: null,
        })
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (discovered.size === 0 && managers.size === 0) {
    const suffix = failures[0] ? `: ${failures[0]}` : ''
    throw new Error(`No accessible Google Ads customer was available${suffix}`)
  }
  return {
    accounts: [...discovered.values()],
    managers: [...managers.values()],
  }
}

export async function discoverGoogleAdsAccounts(accessToken: string): Promise<GoogleAdsDiscoveredAccount[]> {
  const discovery = await discoverGoogleAdsConnection(accessToken)
  if (discovery.accounts.length === 0) {
    throw new Error('No non-manager Google Ads account was available')
  }
  return discovery.accounts
}

function normalizeMatchType(value: unknown): GoogleKeywordMatchType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_')
  if (normalized === 'BROAD' || normalized === 'BROAD_MATCH') return 'BROAD'
  if (normalized === 'PHRASE' || normalized === 'PHRASE_MATCH') return 'PHRASE'
  if (normalized === 'EXACT' || normalized === 'EXACT_MATCH') return 'EXACT'
  return null
}

function parseKeywordArray(value: unknown): GoogleSearchKeyword[] {
  if (!Array.isArray(value)) return []
  const result: GoogleSearchKeyword[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const record = asObject(item)
    const text = typeof record.text === 'string' ? record.text.trim().replace(/\s+/g, ' ') : ''
    const matchType = normalizeMatchType(record.matchType || record.match_type)
    if (!text || text.length > 80 || !matchType) continue
    const key = `${text.toLocaleLowerCase()}::${matchType}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ text, matchType })
  }
  return result
}

export function extractGoogleSearchTargeting(value: unknown): GoogleSearchTargeting {
  const targeting = asObject(value)
  const blockers: string[] = []
  const campaignType = typeof targeting.google_campaign_type === 'string'
    ? targeting.google_campaign_type.trim().toUpperCase()
    : ''
  if (campaignType !== 'SEARCH') blockers.push('Google automated execution currently supports Search campaigns only.')

  const keywords = parseKeywordArray(targeting.google_keywords || targeting.keywords)
  const negativeKeywords = parseKeywordArray(targeting.google_negative_keywords || targeting.negativeKeywords)
  if (keywords.length < 1) blockers.push('At least one reviewed Google keyword with an explicit match type is required.')
  if (negativeKeywords.length < 1) blockers.push('At least one reviewed negative keyword with an explicit match type is required.')

  const rawLocations = Array.isArray(targeting.google_locations) ? targeting.google_locations : []
  const locations: GoogleSearchLocation[] = []
  for (const raw of rawLocations) {
    const location = asObject(raw)
    const name = typeof location.name === 'string' ? location.name.trim() : ''
    const countryCode = typeof location.countryCode === 'string'
      ? location.countryCode.trim().toUpperCase()
      : typeof location.country_code === 'string'
        ? location.country_code.trim().toUpperCase()
        : ''
    const targetType = typeof location.targetType === 'string'
      ? location.targetType.trim()
      : typeof location.target_type === 'string'
        ? location.target_type.trim()
        : undefined
    if (name && /^[A-Z]{2}$/.test(countryCode)) locations.push({ name, countryCode, targetType })
  }
  if (locations.length < 1) blockers.push('At least one reviewed Google location with an ISO country code is required.')

  const rawLanguages = Array.isArray(targeting.languages) ? targeting.languages : []
  const languageCodes = uniqueStrings(rawLanguages)
    .map(code => code.toLocaleLowerCase().replace('-', '_'))
  const unknownLanguages = languageCodes.filter(code => !LANGUAGE_CRITERION_IDS[code])
  const languageIds = languageCodes
    .map(code => LANGUAGE_CRITERION_IDS[code])
    .filter((id): id is string => Boolean(id))
  if (languageIds.length < 1) blockers.push('At least one supported Google Ads language code is required.')
  if (unknownLanguages.length > 0) blockers.push(`Unsupported Google Ads language codes: ${unknownLanguages.join(', ')}.`)

  const locationPresence = targeting.google_location_presence === 'PRESENCE'
    || targeting.google_location_presence === 'PRESENCE_OR_INTEREST'
    ? targeting.google_location_presence as GoogleLocationPresence
    : null
  if (!locationPresence) blockers.push('Google location presence mode must be explicitly reviewed.')

  return {
    keywords,
    negativeKeywords,
    locations,
    languageIds: [...new Set(languageIds)],
    languageCodes,
    locationPresence,
    blockers,
  }
}

export function extractGoogleResponsiveSearchAssets(
  ad: JsonObject,
  siblingAds: JsonObject[] = [],
): GoogleResponsiveSearchAssets {
  const specs = asObject(ad.creativeSpecs)
  const google = asObject(specs.googleAds || specs.google_ads)
  const explicitHeadlines = Array.isArray(google.headlines) ? google.headlines : []
  const explicitDescriptions = Array.isArray(google.descriptions) ? google.descriptions : []
  const siblingHeadlineCandidates = siblingAds.flatMap(sibling => [sibling.headline, sibling.aiHook])
  const siblingDescriptionCandidates = siblingAds.flatMap(sibling => [sibling.description, sibling.primaryText])
  const headlines = uniqueStrings([
    ...explicitHeadlines,
    ad.headline,
    ad.aiHook,
    ...siblingHeadlineCandidates,
  ], 30).slice(0, 15)
  const descriptions = uniqueStrings([
    ...explicitDescriptions,
    ad.description,
    ad.primaryText,
    ...siblingDescriptionCandidates,
  ], 90).slice(0, 4)
  const path1 = typeof google.path1 === 'string' && google.path1.trim().length <= 15
    ? google.path1.trim()
    : undefined
  const path2 = typeof google.path2 === 'string' && google.path2.trim().length <= 15
    ? google.path2.trim()
    : undefined
  return { headlines, descriptions, ...(path1 ? { path1 } : {}), ...(path2 ? { path2 } : {}) }
}

function googleDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export function buildGoogleSearchDraftMutations(input: GoogleSearchDraftInput): GoogleSearchDraftMutations {
  const customerId = normalizeGoogleCustomerId(input.customerId)
  if (!customerId) throw new Error('Invalid Google Ads customer ID')
  if (!Number.isFinite(input.budgetAmount) || input.budgetAmount <= 0) {
    throw new Error('A positive Google Ads daily budget is required')
  }
  if (input.adGroups.length < 1 || input.adGroups.some(group => group.ads.length < 1 || group.keywords.length < 1)) {
    throw new Error('Google Search requires at least one ad group with keywords and responsive search ads')
  }

  let nextTempId = -1
  const temp = () => nextTempId--
  const budgetResourceName = `customers/${customerId}/campaignBudgets/${temp()}`
  const campaignResourceName = `customers/${customerId}/campaigns/${temp()}`
  const mutateOperations: JsonObject[] = [
    {
      campaignBudgetOperation: {
        create: {
          resourceName: budgetResourceName,
          name: `${input.campaignName} — NEXUS budget ${Date.now()}`,
          amountMicros: String(Math.round(input.budgetAmount * 1_000_000)),
          deliveryMethod: 'STANDARD',
          explicitlyShared: false,
        },
      },
    },
    {
      campaignOperation: {
        create: {
          resourceName: campaignResourceName,
          name: input.campaignName,
          status: 'PAUSED',
          advertisingChannelType: 'SEARCH',
          campaignBudget: budgetResourceName,
          targetSpend: {},
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: false,
            targetContentNetwork: false,
          },
          geoTargetTypeSetting: {
            positiveGeoTargetType: input.locationPresence,
            negativeGeoTargetType: 'PRESENCE',
          },
          containsEuPoliticalAdvertising: input.euPoliticalAdvertisingDeclaration,
          ...(googleDate(input.startDate) ? { startDate: googleDate(input.startDate) } : {}),
          ...(googleDate(input.endDate) ? { endDate: googleDate(input.endDate) } : {}),
        },
      },
    },
  ]
  const binding: GoogleSearchMutationBinding = { campaignOperationIndex: 1, adGroups: [] }

  for (const location of input.locations) {
    mutateOperations.push({
      campaignCriterionOperation: {
        create: {
          campaign: campaignResourceName,
          location: { geoTargetConstant: location.resourceName },
        },
      },
    })
  }
  for (const languageId of input.languageIds) {
    mutateOperations.push({
      campaignCriterionOperation: {
        create: {
          campaign: campaignResourceName,
          language: { languageConstant: `languageConstants/${languageId}` },
        },
      },
    })
  }

  const groupResources = input.adGroups.map(group => ({
    group,
    resourceName: `customers/${customerId}/adGroups/${temp()}`,
  }))
  for (const item of groupResources) {
    const operationIndex = mutateOperations.length
    mutateOperations.push({
      adGroupOperation: {
        create: {
          resourceName: item.resourceName,
          campaign: campaignResourceName,
          name: item.group.name,
          status: 'PAUSED',
          type: 'SEARCH_STANDARD',
        },
      },
    })
    binding.adGroups.push({ localId: item.group.localId, operationIndex, ads: [] })
  }

  for (const item of groupResources) {
    for (const keyword of [...item.group.keywords, ...item.group.negativeKeywords]) {
      const negative = item.group.negativeKeywords.includes(keyword)
      mutateOperations.push({
        adGroupCriterionOperation: {
          create: {
            adGroup: item.resourceName,
            status: 'ENABLED',
            negative,
            keyword: { text: keyword.text, matchType: keyword.matchType },
          },
        },
      })
    }
  }

  for (const item of groupResources) {
    const groupBinding = binding.adGroups.find(group => group.localId === item.group.localId)!
    const adGroupTempId = item.resourceName.split('/').pop()
    for (const ad of item.group.ads) {
      const adTempId = temp()
      const operationIndex = mutateOperations.length
      mutateOperations.push({
        adGroupAdOperation: {
          create: {
            resourceName: `customers/${customerId}/adGroupAds/${adGroupTempId}~${adTempId}`,
            adGroup: item.resourceName,
            status: 'PAUSED',
            ad: {
              name: ad.name,
              finalUrls: [ad.finalUrl],
              responsiveSearchAd: {
                headlines: ad.assets.headlines.map(text => ({ text })),
                descriptions: ad.assets.descriptions.map(text => ({ text })),
                ...(ad.assets.path1 ? { path1: ad.assets.path1 } : {}),
                ...(ad.assets.path2 ? { path2: ad.assets.path2 } : {}),
              },
            },
          },
        },
      })
      groupBinding.ads.push({ localId: ad.localId, operationIndex })
    }
  }
  return { mutateOperations, binding }
}

function operationResourceName(value: unknown): string | null {
  const response = asObject(value)
  for (const key of ['campaignResult', 'adGroupResult', 'adGroupAdResult', 'campaignBudgetResult']) {
    const resourceName = asObject(response[key]).resourceName
    if (typeof resourceName === 'string' && resourceName) return resourceName
  }
  return null
}

export function readGoogleSearchMutationResources(
  response: JsonObject,
  binding: GoogleSearchMutationBinding,
): {
  campaignResourceName: string
  adGroups: Array<{ localId: string; resourceName: string; ads: Array<{ localId: string; resourceName: string }> }>
} {
  const responses = Array.isArray(response.mutateOperationResponses) ? response.mutateOperationResponses : []
  const campaignResourceName = operationResourceName(responses[binding.campaignOperationIndex])
  if (!campaignResourceName) throw new Error('Google Ads did not return the created campaign resource name')
  const adGroups = binding.adGroups.map(group => {
    const resourceName = operationResourceName(responses[group.operationIndex])
    if (!resourceName) throw new Error(`Google Ads did not return ad group ${group.localId}`)
    const ads = group.ads.map(ad => {
      const adResourceName = operationResourceName(responses[ad.operationIndex])
      if (!adResourceName) throw new Error(`Google Ads did not return ad ${ad.localId}`)
      return { localId: ad.localId, resourceName: adResourceName }
    })
    return { localId: group.localId, resourceName, ads }
  })
  return { campaignResourceName, adGroups }
}

export class GoogleAdsApi {
  private readonly customerId: string
  private readonly loginCustomerId: string | null
  private readonly encryptedAccessToken: string | null
  private readonly encryptedRefreshToken: string
  private readonly developerToken: string

  constructor(input: {
    customerId: string
    loginCustomerId?: string | null
    encryptedAccessToken?: string | null
    encryptedRefreshToken: string
  }) {
    const customerId = normalizeGoogleCustomerId(input.customerId)
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    if (!customerId) throw new Error('Invalid Google Ads customer ID')
    if (!developerToken) throw new Error('Google Ads developer token is not configured')
    this.customerId = customerId
    this.loginCustomerId = normalizeGoogleCustomerId(input.loginCustomerId)
    this.encryptedAccessToken = input.encryptedAccessToken || null
    this.encryptedRefreshToken = input.encryptedRefreshToken
    this.developerToken = developerToken
  }

  private async accessToken(): Promise<string> {
    if (this.encryptedRefreshToken) return refreshGoogleAdsAccessToken(this.encryptedRefreshToken)
    const accessToken = this.encryptedAccessToken
      ? decryptToken(this.encryptedAccessToken) || this.encryptedAccessToken
      : null
    if (!accessToken) throw new Error('Google Ads access token is missing')
    return accessToken
  }

  private async request<T extends JsonObject>(input: {
    path: string
    method?: 'GET' | 'POST'
    body?: JsonObject
    retryRead?: boolean
    includeLoginCustomerId?: boolean
  }): Promise<T> {
    const execute = () => this.accessToken().then(accessToken => googleAdsFetchWithToken<T>({
      path: input.path,
      accessToken,
      developerToken: this.developerToken,
      loginCustomerId: input.includeLoginCustomerId === false ? null : this.loginCustomerId,
      method: input.method,
      body: input.body,
    }))
    try {
      return await execute()
    } catch (error) {
      if (
        input.retryRead
        && error instanceof GoogleAdsApiError
        && [429, 500, 502, 503, 504].includes(error.status)
      ) return execute()
      throw error
    }
  }

  async suggestGeoTargets(locations: GoogleSearchLocation[]): Promise<GoogleResolvedLocation[]> {
    const resolved: GoogleResolvedLocation[] = []
    for (const location of locations) {
      const response = await this.request<{ geoTargetConstantSuggestions?: unknown }>({
        path: 'geoTargetConstants:suggest',
        method: 'POST',
        includeLoginCustomerId: false,
        retryRead: true,
        body: {
          locale: 'en',
          countryCode: location.countryCode,
          locationNames: { names: [location.name] },
        },
      })
      const suggestions = (Array.isArray(response.geoTargetConstantSuggestions)
        ? response.geoTargetConstantSuggestions
        : [])
        .map(item => asObject(item))
        .filter(item => typeof item.searchTerm !== 'string' || item.searchTerm.toLocaleLowerCase() === location.name.toLocaleLowerCase())
        .map(item => asObject(item.geoTargetConstant))
        .filter(item => (
          item.status === 'ENABLED'
          && item.countryCode === location.countryCode
          && (!location.targetType || item.targetType === location.targetType)
        ))
      if (suggestions.length !== 1) {
        throw new Error(`Google location "${location.name}" (${location.countryCode}) did not resolve to one exact enabled target. Review the location name and type.`)
      }
      const suggestion = suggestions[0]
      if (typeof suggestion.resourceName !== 'string') {
        throw new Error(`Google location "${location.name}" did not return a resource name.`)
      }
      resolved.push({
        ...location,
        resourceName: suggestion.resourceName,
        canonicalName: typeof suggestion.canonicalName === 'string'
          ? suggestion.canonicalName
          : typeof suggestion.name === 'string'
            ? suggestion.name
            : location.name,
      })
    }
    return resolved
  }

  async createPausedSearchDraft(input: Omit<GoogleSearchDraftInput, 'customerId'>) {
    const draft = buildGoogleSearchDraftMutations({ ...input, customerId: this.customerId })
    const response = await this.request<JsonObject>({
      path: `customers/${this.customerId}/googleAds:mutate`,
      method: 'POST',
      body: { mutateOperations: draft.mutateOperations },
      retryRead: false,
    })
    return readGoogleSearchMutationResources(response, draft.binding)
  }

  private async setSearchDraftStatus(input: {
    campaignResourceName: string
    adGroupResourceNames: string[]
    adResourceNames: string[]
  }, status: 'ENABLED' | 'PAUSED'): Promise<void> {
    const mutateOperations: JsonObject[] = [
      ...input.adResourceNames.map(resourceName => ({
        adGroupAdOperation: {
          update: { resourceName, status },
          updateMask: 'status',
        },
      })),
      ...input.adGroupResourceNames.map(resourceName => ({
        adGroupOperation: {
          update: { resourceName, status },
          updateMask: 'status',
        },
      })),
      {
        campaignOperation: {
          update: { resourceName: input.campaignResourceName, status },
          updateMask: 'status',
        },
      },
    ]
    await this.request<JsonObject>({
      path: `customers/${this.customerId}/googleAds:mutate`,
      method: 'POST',
      body: { mutateOperations },
      retryRead: false,
    })
  }

  async activateSearchDraft(input: {
    campaignResourceName: string
    adGroupResourceNames: string[]
    adResourceNames: string[]
  }): Promise<void> {
    return this.setSearchDraftStatus(input, 'ENABLED')
  }

  async pauseSearchCampaign(input: {
    campaignResourceName: string
    adGroupResourceNames: string[]
    adResourceNames: string[]
  }): Promise<void> {
    return this.setSearchDraftStatus(input, 'PAUSED')
  }

  async getCampaignInsights(platformCampaignId: string): Promise<Array<{
    date: string
    spend: number
    impressions: number
    clicks: number
    conversions: number
    conversionValue: number
    status: string | null
  }>> {
    const campaignId = normalizeGoogleCustomerId(platformCampaignId.split('/').pop() || platformCampaignId)
    if (!campaignId) throw new Error('Invalid Google Ads campaign ID')
    const response = await this.request<{ results?: unknown }>({
      path: `customers/${this.customerId}/googleAds:search`,
      method: 'POST',
      retryRead: true,
      body: {
        query: `SELECT segments.date, campaign.status, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS ORDER BY segments.date`,
      },
    })
    const rows = Array.isArray(response.results) ? response.results : []
    return rows.map(row => {
      const record = asObject(row)
      const metrics = asObject(record.metrics)
      const campaign = asObject(record.campaign)
      const segments = asObject(record.segments)
      return {
        date: typeof segments.date === 'string' ? segments.date : '',
        spend: Number(metrics.costMicros || 0) / 1_000_000,
        impressions: Number(metrics.impressions || 0),
        clicks: Number(metrics.clicks || 0),
        conversions: Number(metrics.conversions || 0),
        conversionValue: Number(metrics.conversionsValue || 0),
        status: typeof campaign.status === 'string' ? campaign.status : null,
      }
    }).filter(row => Boolean(row.date))
  }
}

export function createGoogleAdsApi(input: {
  customerId: string
  loginCustomerId?: string | null
  encryptedAccessToken?: string | null
  encryptedRefreshToken: string
}) {
  return new GoogleAdsApi(input)
}
