import { describe, expect, it } from 'vitest'
import {
  META_ADS_API_ACCESS_DISABLE_CONFIRMATION,
  META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
  deriveMetaAdsApiAccessState,
  missingMetaAdsReviewScopes,
  validateMetaAdsApiAccessChange,
  type MetaAdsApiAccessAccount,
} from '@/lib/metaAdsApiAccess'

const readyAccount: MetaAdsApiAccessAccount = {
  platform: 'META',
  status: 'ACTIVE',
  accessToken: 'encrypted-token',
  hasApiAccess: false,
  permissionScopes: ['public_profile', 'ads_management', 'ads_read', 'business_management'],
}

describe('metaAdsApiAccess', () => {
  it('derives review-needed until the admin gate marks API access ready', () => {
    expect(deriveMetaAdsApiAccessState(readyAccount)).toBe('review_needed')
    expect(deriveMetaAdsApiAccessState({ ...readyAccount, hasApiAccess: true })).toBe('reviewed_api_ready')
  })

  it('does not treat non-Meta or disconnected accounts as API-ready', () => {
    expect(deriveMetaAdsApiAccessState({ ...readyAccount, platform: 'GOOGLE' })).toBe('not_meta_ads_account')
    expect(deriveMetaAdsApiAccessState({ ...readyAccount, status: 'DISCONNECTED' })).toBe('not_connected')
    expect(deriveMetaAdsApiAccessState({ ...readyAccount, accessToken: null })).toBe('not_connected')
  })

  it('requires the exact paid Marketing API scopes before enablement', () => {
    const missing = { ...readyAccount, permissionScopes: ['public_profile', 'ads_read'] }
    expect(missingMetaAdsReviewScopes(missing)).toEqual(['ads_management', 'business_management'])
    expect(deriveMetaAdsApiAccessState(missing)).toBe('missing_reviewed_scopes')
  })

  it('requires explicit enable confirmation and HTTPS evidence', () => {
    expect(validateMetaAdsApiAccessChange({
      account: readyAccount,
      nextHasApiAccess: true,
      confirmation: META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
      evidenceUrl: 'https://developers.facebook.com/apps/123/app-review/',
    })).toEqual({ ok: true, reason: null })

    expect(validateMetaAdsApiAccessChange({
      account: readyAccount,
      nextHasApiAccess: true,
      confirmation: 'yes',
      evidenceUrl: 'https://developers.facebook.com/apps/123/app-review/',
    }).reason).toBe('explicit_meta_review_confirmation_required')

    expect(validateMetaAdsApiAccessChange({
      account: readyAccount,
      nextHasApiAccess: true,
      confirmation: META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
      evidenceUrl: 'http://example.com/review',
    }).reason).toBe('https_evidence_url_required')
  })

  it('requires a separate explicit disable confirmation', () => {
    expect(validateMetaAdsApiAccessChange({
      account: { ...readyAccount, hasApiAccess: true },
      nextHasApiAccess: false,
      confirmation: META_ADS_API_ACCESS_DISABLE_CONFIRMATION,
    })).toEqual({ ok: true, reason: null })

    expect(validateMetaAdsApiAccessChange({
      account: { ...readyAccount, hasApiAccess: true },
      nextHasApiAccess: false,
      confirmation: META_ADS_API_ACCESS_ENABLE_CONFIRMATION,
    }).reason).toBe('explicit_disable_confirmation_required')
  })
})
