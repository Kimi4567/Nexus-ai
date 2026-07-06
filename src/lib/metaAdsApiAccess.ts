export const META_ADS_API_ACCESS_ENABLE_CONFIRMATION = 'CONFIRM_META_APP_REVIEW_APPROVED'
export const META_ADS_API_ACCESS_DISABLE_CONFIRMATION = 'CONFIRM_DISABLE_META_ADS_API_ACCESS'

const REQUIRED_META_ADS_SCOPES = ['ads_management', 'ads_read', 'business_management'] as const

export type MetaAdsApiAccessState =
  | 'not_meta_ads_account'
  | 'not_connected'
  | 'missing_reviewed_scopes'
  | 'reviewed_api_ready'
  | 'review_needed'

export interface MetaAdsApiAccessAccount {
  platform?: string | null
  status?: string | null
  hasApiAccess?: boolean | null
  accessToken?: string | null
  permissionScopes?: string[] | null
}

export interface MetaAdsApiAccessChangeInput {
  account: MetaAdsApiAccessAccount
  nextHasApiAccess: boolean
  confirmation?: string | null
  evidenceUrl?: string | null
}

export interface MetaAdsApiAccessValidation {
  ok: boolean
  reason: string | null
}

function hasReviewedScope(account: MetaAdsApiAccessAccount, scope: string): boolean {
  return Array.isArray(account.permissionScopes) && account.permissionScopes.includes(scope)
}

export function missingMetaAdsReviewScopes(account: MetaAdsApiAccessAccount): string[] {
  return REQUIRED_META_ADS_SCOPES.filter((scope) => !hasReviewedScope(account, scope))
}

export function deriveMetaAdsApiAccessState(account: MetaAdsApiAccessAccount): MetaAdsApiAccessState {
  if ((account.platform || '').toUpperCase() !== 'META') return 'not_meta_ads_account'
  if ((account.status || '').toUpperCase() !== 'ACTIVE' || !account.accessToken) return 'not_connected'
  if (missingMetaAdsReviewScopes(account).length > 0) return 'missing_reviewed_scopes'
  if (account.hasApiAccess === true) return 'reviewed_api_ready'
  return 'review_needed'
}

function isHttpsUrl(value?: string | null): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateMetaAdsApiAccessChange(
  input: MetaAdsApiAccessChangeInput,
): MetaAdsApiAccessValidation {
  const state = deriveMetaAdsApiAccessState(input.account)

  if ((input.account.platform || '').toUpperCase() !== 'META') {
    return { ok: false, reason: 'meta_ads_account_required' }
  }

  if (input.nextHasApiAccess === true) {
    if (input.confirmation !== META_ADS_API_ACCESS_ENABLE_CONFIRMATION) {
      return { ok: false, reason: 'explicit_meta_review_confirmation_required' }
    }
    if (!isHttpsUrl(input.evidenceUrl)) {
      return { ok: false, reason: 'https_evidence_url_required' }
    }
    if (state === 'not_connected') {
      return { ok: false, reason: 'connected_active_meta_ads_account_required' }
    }
    const missingScopes = missingMetaAdsReviewScopes(input.account)
    if (missingScopes.length > 0) {
      return { ok: false, reason: `missing_scopes:${missingScopes.join(',')}` }
    }
  } else if (input.confirmation !== META_ADS_API_ACCESS_DISABLE_CONFIRMATION) {
    return { ok: false, reason: 'explicit_disable_confirmation_required' }
  }

  return { ok: true, reason: null }
}
