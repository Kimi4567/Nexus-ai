import { afterEach, describe, expect, it } from 'vitest'
import {
  buildGoogleSearchDraftMutations,
  extractGoogleResponsiveSearchAssets,
  extractGoogleSearchTargeting,
  googleAdsAccountCanExecute,
  readGoogleSearchMutationResources,
} from '@/lib/adPlatforms/googleAdsApi'

const originalTier = process.env.GOOGLE_ADS_ACCESS_TIER

afterEach(() => {
  if (originalTier === undefined) delete process.env.GOOGLE_ADS_ACCESS_TIER
  else process.env.GOOGLE_ADS_ACCESS_TIER = originalTier
})

describe('Google Ads execution foundation', () => {
  it('keeps test access limited to provider-confirmed test accounts', () => {
    process.env.GOOGLE_ADS_ACCESS_TIER = 'TEST'
    expect(googleAdsAccountCanExecute(true)).toBe(true)
    expect(googleAdsAccountCanExecute(false)).toBe(false)

    process.env.GOOGLE_ADS_ACCESS_TIER = 'EXPLORER'
    expect(googleAdsAccountCanExecute(false)).toBe(true)
  })

  it('requires structured Search keywords, locations, languages, and presence mode', () => {
    const targeting = extractGoogleSearchTargeting({
      google_campaign_type: 'SEARCH',
      google_keywords: [{ text: 'ai marketing agency', matchType: 'PHRASE' }],
      google_negative_keywords: [{ text: 'free', matchType: 'PHRASE' }],
      google_locations: [{ name: 'Dubai', countryCode: 'AE', targetType: 'City' }],
      google_location_presence: 'PRESENCE',
      languages: ['ar', 'en'],
    })

    expect(targeting.blockers).toEqual([])
    expect(targeting.languageIds).toEqual(['1019', '1000'])
    expect(targeting.keywords).toEqual([{ text: 'ai marketing agency', matchType: 'PHRASE' }])
  })

  it('never truncates RSA copy and only accepts assets inside provider limits', () => {
    const assets = extractGoogleResponsiveSearchAssets({
      creativeSpecs: {
        googleAds: {
          headlines: ['Headline One', 'Headline Two', 'Headline Three', 'x'.repeat(31)],
          descriptions: ['Description one', 'Description two', 'x'.repeat(91)],
        },
      },
    })
    expect(assets.headlines).toEqual(['Headline One', 'Headline Two', 'Headline Three'])
    expect(assets.descriptions).toEqual(['Description one', 'Description two'])
  })

  it('builds one atomic paused Search mutation set and maps provider resource names', () => {
    const draft = buildGoogleSearchDraftMutations({
      customerId: '123-456-7890',
      campaignName: 'NEXUS Search Review',
      budgetAmount: 25,
      locationPresence: 'PRESENCE',
      euPoliticalAdvertisingDeclaration: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      locations: [{
        name: 'Dubai',
        countryCode: 'AE',
        targetType: 'City',
        resourceName: 'geoTargetConstants/1000012',
        canonicalName: 'Dubai, Dubai, United Arab Emirates',
      }],
      languageIds: ['1000', '1019'],
      adGroups: [{
        localId: 'set_1',
        name: 'High intent',
        keywords: [{ text: 'ai marketing agency', matchType: 'PHRASE' }],
        negativeKeywords: [{ text: 'free', matchType: 'PHRASE' }],
        ads: [{
          localId: 'ad_1',
          name: 'Reviewed RSA',
          finalUrl: 'https://nexus-grow.com/offer?utm_source=google',
          assets: {
            headlines: ['Headline One', 'Headline Two', 'Headline Three'],
            descriptions: ['Description one', 'Description two'],
          },
        }],
      }],
    })

    expect(draft.mutateOperations[0]).toHaveProperty('campaignBudgetOperation.create')
    expect(draft.mutateOperations[1]).toMatchObject({
      campaignOperation: { create: { status: 'PAUSED', advertisingChannelType: 'SEARCH' } },
    })
    expect(JSON.stringify(draft.mutateOperations)).toContain('targetSearchNetwork')
    expect(JSON.stringify(draft.mutateOperations)).toContain('DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING')

    const responses = draft.mutateOperations.map(() => ({}))
    responses[draft.binding.campaignOperationIndex] = {
      campaignResult: { resourceName: 'customers/1234567890/campaigns/101' },
    }
    const group = draft.binding.adGroups[0]
    responses[group.operationIndex] = {
      adGroupResult: { resourceName: 'customers/1234567890/adGroups/202' },
    }
    responses[group.ads[0].operationIndex] = {
      adGroupAdResult: { resourceName: 'customers/1234567890/adGroupAds/202~303' },
    }

    expect(readGoogleSearchMutationResources({ mutateOperationResponses: responses }, draft.binding)).toEqual({
      campaignResourceName: 'customers/1234567890/campaigns/101',
      adGroups: [{
        localId: 'set_1',
        resourceName: 'customers/1234567890/adGroups/202',
        ads: [{ localId: 'ad_1', resourceName: 'customers/1234567890/adGroupAds/202~303' }],
      }],
    })
  })
})
