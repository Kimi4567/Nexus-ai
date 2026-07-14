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

  it('keeps YouTube Shorts blocked until a channel is connected', () => {
    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: ['YOUTUBE_SHORTS'],
      platformStates: derivePlatformReadiness([]),
    })

    expect(bridge.organicRequirements[0].platformKey).toBe('youtube')
    expect(bridge.organicRequirements[0].status).toBe('blocked')
    expect(bridge.organicRequirements[0].readinessStatus).toBe('not_connected')
    expect(bridge.organicRequirements[0].reasonEn).toContain('not connected')
    expect(bridge.organicRequirements[0].actionHref).toBe('/connections')
  })

  it('recognizes a fully verified YouTube channel as review-ready', () => {
    const bridge = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: ['YOUTUBE_SHORTS'],
      platformStates: derivePlatformReadiness([{
        platform: 'YOUTUBE',
        status: 'CONNECTED',
        capabilities: { youtubeVideoPublishing: true, youtubeReadback: true, tokenRefresh: true },
      }]),
    })
    expect(bridge.organicRequirements[0]).toMatchObject({ platformKey: 'youtube', status: 'ready' })
  })

  it('maps both X and legacy Twitter campaign keys to verified X readiness', () => {
    const platformStates = derivePlatformReadiness([{
      platform: 'X',
      status: 'CONNECTED',
      capabilities: { xPublishing: true, xMediaPublishing: true, xReadback: true, tokenRefresh: true },
    }])
    for (const campaignPlatform of ['X', 'TWITTER']) {
      const bridge = deriveStrategyExecutionBridge({
        scopeType: 'organic',
        campaignPlatforms: [campaignPlatform],
        platformStates,
      })
      expect(bridge.organicRequirements[0]).toMatchObject({ platformKey: 'x', status: 'ready' })
    }
  })

  it('keeps Pinterest Trial blocked and recognizes verified Standard access', () => {
    const capabilities = {
      pinterestPinPublishing: true,
      pinterestReadback: true,
      pinterestBoardSelection: true,
      tokenRefresh: true,
    }
    const trial = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: ['PINTEREST'],
      platformStates: derivePlatformReadiness([{
        platform: 'PINTEREST', status: 'CONNECTED', capabilities: { ...capabilities, pinterestPublicPublishing: false },
      }]),
    })
    expect(trial.organicRequirements[0]).toMatchObject({ platformKey: 'pinterest', status: 'blocked', readinessStatus: 'needs_setup' })

    const standard = deriveStrategyExecutionBridge({
      scopeType: 'organic',
      campaignPlatforms: ['PINTEREST'],
      platformStates: derivePlatformReadiness([{
        platform: 'PINTEREST', status: 'CONNECTED', capabilities: { ...capabilities, pinterestPublicPublishing: true },
      }]),
    })
    expect(standard.organicRequirements[0]).toMatchObject({ platformKey: 'pinterest', status: 'ready' })
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
