import { describe, expect, it } from 'vitest'
import { derivePlatformReadiness, type AdAccountReadinessInput, type SocialAccount } from '@/lib/platformReadiness'
import { deriveStrategyExecutionBridge } from '@/lib/strategyExecutionBridge'

const metaWithPageAndIg: SocialAccount = {
  platform: 'META',
  status: 'CONNECTED',
  pages: [{ id: 'page_1', name: 'Main Page', igAccountId: 'ig_1' }],
}

const metaAdsReady: AdAccountReadinessInput = {
  platform: 'META',
  status: 'ACTIVE',
  platformAccountId: 'act_123',
  pageId: 'page_1',
  hasApiAccess: true,
}

describe('deriveStrategyExecutionBridge', () => {
  it('maps an organic strategy to organic platform readiness only', () => {
    const platformStates = derivePlatformReadiness([
      metaWithPageAndIg,
      { platform: 'TIKTOK', status: 'CONNECTED' },
    ])

    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: ['FACEBOOK', 'TIKTOK'],
      platformStates,
      campaignId: 'campaign_1',
    })

    expect(bridge.includesOrganic).toBe(true)
    expect(bridge.includesPaid).toBe(false)
    expect(bridge.paidRequirements).toEqual([])
    expect(bridge.paidNoteEn).toContain('not part of this organic-only strategy')
    expect(bridge.organicRequirements).toHaveLength(2)
    expect(bridge.organicRequirements.map((item) => [item.platformKey, item.status])).toEqual([
      ['facebook', 'ready'],
      ['tiktok', 'blocked'],
    ])
    expect(bridge.overallStatus).toBe('blocked')
  })

  it('keeps paid-only strategy separate from organic publishing platforms', () => {
    const platformStates = derivePlatformReadiness([metaWithPageAndIg], [metaAdsReady])

    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'paid',
      campaignPlatforms: ['FACEBOOK', 'INSTAGRAM'],
      platformStates,
      campaignId: 'campaign_1',
    })

    expect(bridge.includesOrganic).toBe(false)
    expect(bridge.organicRequirements).toEqual([])
    expect(bridge.organicNoteEn).toContain('Organic publishing is not part')
    expect(bridge.paidRequirements).toHaveLength(1)
    expect(bridge.paidRequirements[0].platformKey).toBe('paid')
    expect(bridge.paidRequirements[0].status).toBe('ready')
    expect(bridge.paidRequirements[0].reasonEn).toContain('explicit confirmation')
    expect(bridge.paidRequirements[0].reasonEn).not.toMatch(/automatically|active campaign/i)
  })

  it('blocks full strategy paid execution when Meta Ads API access is not verified', () => {
    const platformStates = derivePlatformReadiness(
      [metaWithPageAndIg],
      [{ ...metaAdsReady, hasApiAccess: false }],
    )

    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'full',
      campaignPlatforms: ['FACEBOOK'],
      platformStates,
      campaignId: 'campaign_1',
    })

    expect(bridge.includesOrganic).toBe(true)
    expect(bridge.includesPaid).toBe(true)
    expect(bridge.organicRequirements[0].status).toBe('ready')
    expect(bridge.paidRequirements[0].status).toBe('blocked')
    expect(bridge.paidRequirements[0].readinessStatus).toBe('permission_unverified')
    expect(bridge.summaryEn).toBe('Execution needs platform/account setup')
  })

  it('does not invent readiness when an organic strategy has no saved campaign platforms', () => {
    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: [],
      platformStates: derivePlatformReadiness([]),
    })

    expect(bridge.organicRequirements).toHaveLength(1)
    expect(bridge.organicRequirements[0].id).toBe('organic-platforms-not-set')
    expect(bridge.organicRequirements[0].status).toBe('blocked')
    expect(bridge.organicRequirements[0].reasonEn).toContain('no saved campaign platforms')
    expect(bridge.overallStatus).toBe('blocked')
  })

  it('keeps YouTube Shorts blocked because no publishing integration exists yet', () => {
    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: ['YOUTUBE_SHORTS'],
      platformStates: derivePlatformReadiness([]),
    })

    expect(bridge.organicRequirements[0].platformKey).toBe('youtube')
    expect(bridge.organicRequirements[0].status).toBe('blocked')
    expect(bridge.organicRequirements[0].readinessStatus).toBe('not_available')
    expect(bridge.organicRequirements[0].reasonEn).toContain('does not have a supported publishing integration')
    expect(bridge.organicRequirements[0].actionHref).toBeUndefined()
  })

  it('uses a conservative checking state while platform readiness is loading', () => {
    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'full',
      campaignPlatforms: ['FACEBOOK'],
      platformStates: [],
      platformReadinessLoaded: false,
    })

    expect(bridge.overallStatus).toBe('checking')
    expect(bridge.organicRequirements[0].status).toBe('checking')
    expect(bridge.paidRequirements[0].status).toBe('checking')
    expect(bridge.helperEn).toContain('read-only bridge')
  })

  it('keeps execution bridge copy away from active/auto-launch claims', () => {
    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'full',
      campaignPlatforms: ['FACEBOOK'],
      platformStates: derivePlatformReadiness([metaWithPageAndIg], [metaAdsReady]),
    })

    const runtimeCopy = [
      bridge.summaryEn,
      bridge.helperEn,
      ...bridge.organicRequirements.flatMap((item) => [item.titleEn, item.reasonEn]),
      ...bridge.paidRequirements.flatMap((item) => [item.titleEn, item.reasonEn]),
    ].join(' ')

    expect(runtimeCopy).not.toMatch(/ready to launch|active campaign|automated publishing|spend approved/i)
  })
})
